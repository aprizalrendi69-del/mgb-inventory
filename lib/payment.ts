import {
  PaymentMethod,
  PaymentStatus,
  PettyCashStatus,
  PettyCashType,
  Role,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

// =====================================================
// TYPES
// =====================================================

export type ProcessPaymentInput = {
  purchaseId?: number | null;
  outletPurchaseId?: number | null;

  payableId?: number | null;

  supplierId: number;

  amount: number;

  method: PaymentMethod;

  outletId?: number | null;

  userId: number;

  paymentDate?: Date;

  referenceNumber?: string | null;

  remarks?: string | null;

  purchaseNumber?: string;
};

// =====================================================
// MONEY
// =====================================================

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(
    (value + Number.EPSILON) * 100
  ) / 100;
}

// =====================================================
// NORMALIZE PAYMENT METHOD
// =====================================================

export function normalizePaymentMethod(
  value: unknown
): PaymentMethod | null {
  const method = String(value ?? "")
    .trim()
    .toUpperCase();

  if (
    !Object.values(PaymentMethod).includes(
      method as PaymentMethod
    )
  ) {
    return null;
  }

  return method as PaymentMethod;
}

// =====================================================
// PAYMENT METHOD
// =====================================================

export function isPettyCashPaymentMethod(
  method: PaymentMethod
): boolean {
  return (
    method === PaymentMethod.CASH ||
    method === PaymentMethod.COD ||
    method === PaymentMethod.CBD
  );
}

export function isTransferPaymentMethod(
  method: PaymentMethod
): boolean {
  return method === PaymentMethod.TRANSFER;
}

export function isTempoPaymentMethod(
  method: PaymentMethod
): boolean {
  return method === PaymentMethod.TEMPO;
}

// =====================================================
// USER ACCESS
// =====================================================

export function canProcessCentralPayment(
  role: Role
): boolean {
  return (
    role === Role.ADMIN ||
    role === Role.MANAGER
  );
}

export function canProcessOutletPayment(
  role: Role
): boolean {
  return (
    role === Role.ADMIN ||
    role === Role.MANAGER ||
    role === Role.OUTLET_ADMIN
  );
}

export function canManagePettyCash(
  role: Role
): boolean {
  return (
    role === Role.ADMIN ||
    role === Role.MANAGER
  );
}

// =====================================================
// VALID PURCHASE PAYMENT METHOD
// =====================================================

export function isValidPurchasePaymentMethod(
  method: PaymentMethod
): boolean {
  return (
    method === PaymentMethod.CASH ||
    method === PaymentMethod.TRANSFER ||
    method === PaymentMethod.COD ||
    method === PaymentMethod.CBD ||
    method === PaymentMethod.TEMPO
  );
}

// =====================================================
// VALID PAYABLE SETTLEMENT METHOD
// =====================================================
//
// TEMPO TIDAK BOLEH menjadi metode pelunasan.
//
// TEMPO adalah metode hutang saat Purchase dibuat.
// Saat hutang dibayar, metode settlement harus:
// - CASH
// - TRANSFER
// - COD
// - CBD
//
// =====================================================

export function isValidPayableSettlementMethod(
  method: PaymentMethod
): boolean {
  return (
    method === PaymentMethod.CASH ||
    method === PaymentMethod.TRANSFER ||
    method === PaymentMethod.COD ||
    method === PaymentMethod.CBD
  );
}

// =====================================================
// PAYMENT NUMBER
// =====================================================

export async function generatePaymentNumber(
  tx: Prisma.TransactionClient,
  paymentDate: Date
): Promise<string> {
  const year =
    paymentDate.getFullYear();

  const month =
    String(
      paymentDate.getMonth() + 1
    ).padStart(2, "0");

  const period =
    `${year}${month}`;

  const document =
    await tx.documentNumber.upsert({
      where: {
        type_period: {
          type: "PAYMENT",
          period,
        },
      },

      create: {
        type: "PAYMENT",
        prefix: "PAY",
        period,
        lastNumber: 1,
      },

      update: {
        lastNumber: {
          increment: 1,
        },
      },
    });

  return (
    `${document.prefix}-${period}-` +
    String(
      document.lastNumber
    ).padStart(5, "0")
  );
}

// =====================================================
// PETTY CASH NUMBER
// =====================================================

export async function generatePettyCashNumber(
  tx: Prisma.TransactionClient,
  trxDate: Date
): Promise<string> {
  const year =
    trxDate.getFullYear();

  const month =
    String(
      trxDate.getMonth() + 1
    ).padStart(2, "0");

  const period =
    `${year}${month}`;

  const document =
    await tx.documentNumber.upsert({
      where: {
        type_period: {
          type: "PETTY_CASH",
          period,
        },
      },

      create: {
        type: "PETTY_CASH",
        prefix: "PC",
        period,
        lastNumber: 1,
      },

      update: {
        lastNumber: {
          increment: 1,
        },
      },
    });

  return (
    `${document.prefix}-${period}-` +
    String(
      document.lastNumber
    ).padStart(5, "0")
  );
}

// =====================================================
// GET PAYABLE
// =====================================================

export async function getPayable(
  payableId: number
) {
  return prisma.purchasePayable.findUnique({
    where: {
      id: payableId,
    },

    include: {
      supplier: true,
      outlet: true,
      purchase: true,
      outletPurchase: true,
    },
  });
}

// =====================================================
// GET CURRENT PETTY CASH BALANCE
// =====================================================

export async function getCurrentPettyCashBalance(
  tx: Prisma.TransactionClient,
  outletId: number | null
): Promise<number> {
  const account =
    await tx.pettyCashAccount.findFirst({
      where: {
        outletId,
        isActive: true,
      },

      select: {
        currentBalance: true,
        openingBalance: true,
      },

      orderBy: {
        id: "asc",
      },
    });

  if (!account) {
    return 0;
  }

  return roundMoney(
    Number(
      account.currentBalance ??
        account.openingBalance ??
        0
    )
  );
}

// =====================================================
// PROCESS PAYMENT
// =====================================================
//
// ATURAN UTAMA
// -----------------------------------------------------
//
// 1. Purchase TEMPO:
//    - Purchase Payable dibuat ketika RECEIPT.
//    - Fungsi ini TIDAK membuat payable.
//    - Fungsi ini hanya melakukan pelunasan payable.
//
// 2. Purchase non-TEMPO:
//    - Payment dibuat langsung.
//    - Tidak boleh mempunyai PurchasePayable.
//
// 3. DueDate:
//    - Tidak pernah dihitung ulang di sini.
//    - DueDate adalah snapshot historis dari saat payable dibuat.
//
// =====================================================

export async function processPayment(
  input: ProcessPaymentInput
) {
  const amount =
    roundMoney(
      Number(input.amount)
    );

  const method =
    normalizePaymentMethod(
      input.method
    );

  // ===================================================
  // BASIC VALIDATION
  // ===================================================

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "Jumlah pembayaran harus lebih dari 0"
    );
  }

  if (
    !method ||
    !isValidPurchasePaymentMethod(
      method
    )
  ) {
    throw new Error(
      "Metode pembayaran tidak valid"
    );
  }

  if (
    !Number.isInteger(
      input.supplierId
    ) ||
    input.supplierId <= 0
  ) {
    throw new Error(
      "Supplier tidak valid"
    );
  }

  if (
    !Number.isInteger(
      input.userId
    ) ||
    input.userId <= 0
  ) {
    throw new Error(
      "User pembayaran tidak valid"
    );
  }

  const hasCentralPurchase =
    Number.isInteger(
      input.purchaseId
    ) &&
    Number(input.purchaseId) > 0;

  const hasOutletPurchase =
    Number.isInteger(
      input.outletPurchaseId
    ) &&
    Number(input.outletPurchaseId) > 0;

  if (
    !hasCentralPurchase &&
    !hasOutletPurchase
  ) {
    throw new Error(
      "Purchase tidak valid"
    );
  }

  if (
    hasCentralPurchase &&
    hasOutletPurchase
  ) {
    throw new Error(
      "Payment tidak boleh memiliki Purchase Pusat dan Purchase Outlet sekaligus"
    );
  }

  // ===================================================
  // OUTLET VALIDATION
  // ===================================================

  if (
    hasOutletPurchase &&
    (
      !Number.isInteger(
        input.outletId
      ) ||
      Number(input.outletId) <= 0
    )
  ) {
    throw new Error(
      "Purchase Outlet harus memiliki outlet"
    );
  }

  if (
    hasCentralPurchase &&
    input.outletId !== null &&
    input.outletId !== undefined
  ) {
    throw new Error(
      "Purchase Pusat tidak boleh memiliki outlet"
    );
  }

  const paymentDate =
    input.paymentDate ??
    new Date();

  if (
    Number.isNaN(
      paymentDate.getTime()
    )
  ) {
    throw new Error(
      "Tanggal pembayaran tidak valid"
    );
  }

  // ===================================================
  // TRANSACTION
  // ===================================================

  return prisma.$transaction(
    async (tx) => {
      let purchaseTotal = 0;

      let purchaseNumber =
        input.purchaseNumber ?? "";

      let supplierId =
        input.supplierId;

      let outletId =
        input.outletId ?? null;

      let purchasePaymentMethod:
        | PaymentMethod
        | null = null;

      // =================================================
      // 1. LOAD PURCHASE PUSAT
      // =================================================

      if (hasCentralPurchase) {
        const purchase =
          await tx.purchase.findUnique({
            where: {
              id:
                input.purchaseId!,
            },

            include: {
              supplier: {
                select: {
                  id: true,
                  tempoDays: true,
                },
              },
            },
          });

        if (!purchase) {
          throw new Error(
            "Purchase Pusat tidak ditemukan"
          );
        }

        purchaseTotal =
          roundMoney(
            Number(
              purchase.total
            )
          );

        purchaseNumber =
          purchase.number;

        supplierId =
          purchase.supplierId;

        outletId = null;

        purchasePaymentMethod =
          normalizePaymentMethod(
            purchase.paymentMethod
          );

        if (
          !purchasePaymentMethod
        ) {
          throw new Error(
            "Metode pembayaran Purchase Pusat tidak valid"
          );
        }

        if (
          supplierId !==
          input.supplierId
        ) {
          throw new Error(
            "Supplier pembayaran tidak sesuai dengan Purchase"
          );
        }
      }

      // =================================================
      // 2. LOAD PURCHASE OUTLET
      // =================================================

      if (hasOutletPurchase) {
        const purchase =
          await tx.outletPurchase.findUnique({
            where: {
              id:
                input.outletPurchaseId!,
            },

            include: {
              supplier: {
                select: {
                  id: true,
                  tempoDays: true,
                },
              },
            },
          });

        if (!purchase) {
          throw new Error(
            "Purchase Outlet tidak ditemukan"
          );
        }

        purchaseTotal =
          roundMoney(
            Number(
              purchase.total
            )
          );

        purchaseNumber =
          purchase.number;

        supplierId =
          purchase.supplierId;

        outletId =
          purchase.outletId;

        purchasePaymentMethod =
          normalizePaymentMethod(
            purchase.paymentMethod
          );

        if (
          !purchasePaymentMethod
        ) {
          throw new Error(
            "Metode pembayaran Purchase Outlet tidak valid"
          );
        }

        if (
          input.outletId !==
          purchase.outletId
        ) {
          throw new Error(
            "Outlet pembayaran tidak sesuai dengan Purchase Outlet"
          );
        }

        if (
          supplierId !==
          input.supplierId
        ) {
          throw new Error(
            "Supplier pembayaran tidak sesuai dengan Purchase Outlet"
          );
        }
      }

      // =================================================
      // 3. TEMPO TIDAK BOLEH DIBAYAR SEBAGAI PAYMENT BARU
      // =================================================
      //
      // Jika frontend mengirim:
      //
      // method = TEMPO
      //
      // maka itu BUKAN proses pembayaran.
      //
      // TEMPO sudah seharusnya dibuat menjadi payable
      // pada saat RECEIPT.
      //
      // =================================================

      if (
        method ===
        PaymentMethod.TEMPO
      ) {
        throw new Error(
          "Metode TEMPO tidak dapat diproses sebagai pembayaran. Purchase Payable TEMPO dibuat saat Receipt."
        );
      }

      // =================================================
      // 4. FIND PAYABLE
      // =================================================

      let payable = null;

      if (input.payableId) {
        payable =
          await tx.purchasePayable.findUnique({
            where: {
              id:
                input.payableId,
            },
          });

        if (!payable) {
          throw new Error(
            "Purchase Payable tidak ditemukan"
          );
        }

        // ---------------------------------------------
        // PURCHASE PUSAT
        // ---------------------------------------------

        if (hasCentralPurchase) {
          if (
            payable.purchaseId !==
            input.purchaseId
          ) {
            throw new Error(
              "Purchase Payable tidak sesuai dengan Purchase Pusat"
            );
          }

          if (
            payable.outletPurchaseId !==
            null
          ) {
            throw new Error(
              "Purchase Payable bukan milik Purchase Pusat"
            );
          }
        }

        // ---------------------------------------------
        // PURCHASE OUTLET
        // ---------------------------------------------

        if (hasOutletPurchase) {
          if (
            payable.outletPurchaseId !==
            input.outletPurchaseId
          ) {
            throw new Error(
              "Purchase Payable tidak sesuai dengan Purchase Outlet"
            );
          }

          if (
            payable.purchaseId !==
            null
          ) {
            throw new Error(
              "Purchase Payable bukan milik Purchase Outlet"
            );
          }
        }
      } else if (
        hasCentralPurchase
      ) {
        payable =
          await tx.purchasePayable.findUnique({
            where: {
              purchaseId:
                input.purchaseId!,
            },
          });
      } else if (
        hasOutletPurchase
      ) {
        payable =
          await tx.purchasePayable.findUnique({
            where: {
              outletPurchaseId:
                input.outletPurchaseId!,
            },
          });
      }

      // =================================================
      // 5. VALIDASI SUPPLIER & OUTLET PAYABLE
      // =================================================

      if (payable) {
        if (
          payable.supplierId !==
          supplierId
        ) {
          throw new Error(
            "Supplier Purchase Payable tidak sesuai dengan Purchase"
          );
        }

        if (
          hasCentralPurchase &&
          payable.outletId !== null
        ) {
          throw new Error(
            "Purchase Payable Pusat tidak boleh memiliki outlet"
          );
        }

        if (
          hasOutletPurchase &&
          payable.outletId !==
            outletId
        ) {
          throw new Error(
            "Outlet Purchase Payable tidak sesuai dengan Purchase"
          );
        }
      }

      // =================================================
      // 6. EXISTING PAYABLE
      // =================================================
      //
      // Kalau ada payable:
      //
      // - Purchase harus TEMPO.
      // - Method pembayaran harus settlement method.
      // - DueDate tidak disentuh.
      // - Supplier tempo tidak dihitung ulang.
      //
      // =================================================

      if (payable) {
        if (
          purchasePaymentMethod !==
          PaymentMethod.TEMPO
        ) {
          throw new Error(
            "Purchase non-TEMPO tidak boleh memiliki Purchase Payable"
          );
        }

        if (
          !isValidPayableSettlementMethod(
            method
          )
        ) {
          throw new Error(
            "Pelunasan Purchase Payable harus menggunakan CASH, TRANSFER, COD, atau CBD"
          );
        }

        const payableAmount =
          roundMoney(
            Number(
              payable.amount
            )
          );

        const oldPaid =
          roundMoney(
            Number(
              payable.paidAmount
            )
          );

        const outstanding =
          roundMoney(
            Number(
              payable.outstanding
            )
          );

        // ---------------------------------------------
        // NORMALIZE EXISTING DATA
        // ---------------------------------------------
        //
        // Outstanding tidak boleh negatif.
        // ---------------------------------------------

        if (
          outstanding <= 0
        ) {
          throw new Error(
            "Purchase Payable sudah lunas"
          );
        }

        if (
          amount >
          outstanding
        ) {
          throw new Error(
            `Jumlah pembayaran Rp ${amount.toLocaleString(
              "id-ID"
            )} melebihi sisa hutang Rp ${outstanding.toLocaleString(
              "id-ID"
            )}`
          );
        }

        const newPaid =
          roundMoney(
            oldPaid + amount
          );

        const newOutstanding =
          roundMoney(
            outstanding - amount
          );

        const newStatus =
          newOutstanding === 0
            ? "PAID"
            : newPaid > 0
            ? "PARTIAL"
            : "OUTSTANDING";

        // ---------------------------------------------
        // PETTY CASH
        // ---------------------------------------------

        let pettyCashAccount:
          | {
              id: number;
              outletId: number | null;
              openingBalance: any;
              currentBalance: any;
              isActive: boolean;
              code: string;
              name: string;
            }
          | null = null;

        let pettyCashBalanceBefore =
          0;

        if (
          isPettyCashPaymentMethod(
            method
          )
        ) {
          pettyCashAccount =
            await tx.pettyCashAccount.findFirst({
              where: {
                outletId,
                isActive: true,
              },

              orderBy: {
                id: "asc",
              },
            });

          if (
            !pettyCashAccount
          ) {
            throw new Error(
              outletId === null
                ? "Akun Petty Cash Pusat belum tersedia atau tidak aktif"
                : "Akun Petty Cash Outlet belum tersedia atau tidak aktif"
            );
          }

          pettyCashBalanceBefore =
            roundMoney(
              Number(
                pettyCashAccount.currentBalance ??
                  pettyCashAccount.openingBalance ??
                  0
              )
            );

          if (
            amount >
            pettyCashBalanceBefore
          ) {
            throw new Error(
              `${
                outletId === null
                  ? "Petty Cash Pusat"
                  : "Petty Cash Outlet"
              } tidak mencukupi. Saldo tersedia Rp ${pettyCashBalanceBefore.toLocaleString(
                "id-ID"
              )}, pembayaran Rp ${amount.toLocaleString(
                "id-ID"
              )}`
            );
          }
        }

        // ---------------------------------------------
        // PAYMENT NUMBER
        // ---------------------------------------------

        const paymentNumber =
          await generatePaymentNumber(
            tx,
            paymentDate
          );

        // ---------------------------------------------
        // CREATE PAYMENT
        // ---------------------------------------------

        const payment =
          await tx.payment.create({
            data: {
              number:
                paymentNumber,

              purchaseId:
                hasCentralPurchase
                  ? input.purchaseId!
                  : null,

              outletPurchaseId:
                hasOutletPurchase
                  ? input.outletPurchaseId!
                  : null,

              supplierId,

              paymentDate,

              amount,

              method,

              status:
                PaymentStatus.PAID,

              referenceNumber:
                input.referenceNumber ??
                null,

              note:
                input.remarks ??
                null,

              createdBy:
                input.userId,

              approvedBy:
                input.userId,

              approvedAt:
                paymentDate,
            },
          });

        // ---------------------------------------------
        // UPDATE PAYABLE
        // ---------------------------------------------
        //
        // SANGAT PENTING:
        //
        // invoiceDate TIDAK DIUBAH
        // dueDate     TIDAK DIUBAH
        //
        // Hanya:
        // paidAmount
        // outstanding
        // status
        //
        // ---------------------------------------------

        const updatedPayable =
          await tx.purchasePayable.update({
            where: {
              id:
                payable.id,
            },

            data: {
              paidAmount:
                newPaid,

              outstanding:
                newOutstanding,

              status:
                newStatus,
            },
          });

        // ---------------------------------------------
        // PETTY CASH OUT
        // ---------------------------------------------

        let pettyCash = null;

        if (
          isPettyCashPaymentMethod(
            method
          )
        ) {
          if (
            !pettyCashAccount
          ) {
            throw new Error(
              "Akun Petty Cash tidak ditemukan"
            );
          }

          const balanceBefore =
            pettyCashBalanceBefore;

          const balanceAfter =
            roundMoney(
              balanceBefore -
                amount
            );

          const pettyCashNumber =
            await generatePettyCashNumber(
              tx,
              paymentDate
            );

          pettyCash =
            await tx.pettyCash.create({
              data: {
                number:
                  pettyCashNumber,

                trxDate:
                  paymentDate,

                type:
                  PettyCashType.OUT,

                category:
                  "PURCHASE",

                description:
                  `Pelunasan hutang ${method} Purchase ${purchaseNumber}`,

                amount,

                balanceBefore,

                balanceAfter,

                accountId:
                  pettyCashAccount.id,

                paymentId:
                  payment.id,

                outletId,

                createdBy:
                  input.userId,

                approvedBy:
                  input.userId,

                status:
                  PettyCashStatus.APPROVED,

                approvedAt:
                  paymentDate,
              },
            });

          await tx.pettyCashAccount.update({
            where: {
              id:
                pettyCashAccount.id,
            },

            data: {
              currentBalance:
                balanceAfter,
            },
          });
        }

        // ---------------------------------------------
        // RETURN PAYABLE PAYMENT
        // ---------------------------------------------

        return {
          type:
            "PAYABLE_PAYMENT" as const,

          payment,

          payable: {
            id:
              updatedPayable.id,

            amount:
              roundMoney(
                Number(
                  updatedPayable.amount
                )
              ),

            paidAmount:
              roundMoney(
                Number(
                  updatedPayable.paidAmount
                )
              ),

            outstanding:
              roundMoney(
                Number(
                  updatedPayable.outstanding
                )
              ),

            status:
              updatedPayable.status,

            invoiceDate:
              updatedPayable.invoiceDate,

            dueDate:
              updatedPayable.dueDate,
          },

          pettyCash:
            pettyCash
              ? {
                  id:
                    pettyCash.id,

                  number:
                    pettyCash.number,

                  amount:
                    Number(
                      pettyCash.amount
                    ),

                  balanceBefore:
                    Number(
                      pettyCash.balanceBefore
                    ),

                  balanceAfter:
                    Number(
                      pettyCash.balanceAfter
                    ),

                  outletId:
                    pettyCash.outletId,

                  accountId:
                    pettyCash.accountId,
                }
              : null,
        };
      }

      // =================================================
      // 7. NON-TEMPO PURCHASE
      // =================================================
      //
      // Kalau tidak ada payable:
      // Purchase harus non-TEMPO.
      //
      // =================================================

      if (
        !purchasePaymentMethod
      ) {
        throw new Error(
          "Purchase belum memiliki metode pembayaran"
        );
      }

      const normalizedPurchaseMethod =
        normalizePaymentMethod(
          purchasePaymentMethod
        );

      if (
        !normalizedPurchaseMethod
      ) {
        throw new Error(
          "Metode pembayaran Purchase tidak valid"
        );
      }

      if (
        normalizedPurchaseMethod ===
        PaymentMethod.TEMPO
      ) {
        throw new Error(
          "Purchase TEMPO belum memiliki Purchase Payable. Payable harus dibuat saat Receipt terlebih dahulu."
        );
      }

      // =================================================
      // METHOD PAYMENT HARUS SAMA
      // =================================================

      if (
        normalizedPurchaseMethod !==
        method
      ) {
        throw new Error(
          `Metode pembayaran tidak sesuai dengan Purchase. Metode Purchase: ${normalizedPurchaseMethod}, metode pembayaran: ${method}`
        );
      }

      // =================================================
      // PAYMENT AMOUNT
      // =================================================
      //
      // Tidak menggunakan tolerance +0.01.
      //
      // Semua nominal sudah dibulatkan ke 2 desimal.
      //
      // Jadi:
      //
      // 0.10 === 0.10 -> valid
      // 0.10 > 0.10 -> false
      // 0.11 > 0.10 -> true
      //
      // =================================================

      if (
        amount !==
        purchaseTotal
      ) {
        throw new Error(
          `Jumlah pembayaran Rp ${amount.toLocaleString(
            "id-ID"
          )} tidak sama dengan total Purchase Rp ${purchaseTotal.toLocaleString(
            "id-ID"
          )}`
        );
      }

      // =================================================
      // 8. PETTY CASH
      // =================================================

      let pettyCashAccount:
        | {
            id: number;
            outletId: number | null;
            openingBalance: any;
            currentBalance: any;
            isActive: boolean;
            code: string;
            name: string;
          }
        | null = null;

      let pettyCashBalanceBefore =
        0;

      if (
        isPettyCashPaymentMethod(
          method
        )
      ) {
        pettyCashAccount =
          await tx.pettyCashAccount.findFirst({
            where: {
              outletId,
              isActive: true,
            },

            orderBy: {
              id: "asc",
            },
          });

        if (
          !pettyCashAccount
        ) {
          throw new Error(
            outletId === null
              ? "Akun Petty Cash Pusat belum tersedia atau tidak aktif"
              : "Akun Petty Cash Outlet belum tersedia atau tidak aktif"
          );
        }

        pettyCashBalanceBefore =
          roundMoney(
            Number(
              pettyCashAccount.currentBalance ??
                pettyCashAccount.openingBalance ??
                0
            )
          );

        if (
          amount >
          pettyCashBalanceBefore
        ) {
          throw new Error(
            `${
              outletId === null
                ? "Petty Cash Pusat"
                : "Petty Cash Outlet"
            } tidak mencukupi. Saldo tersedia Rp ${pettyCashBalanceBefore.toLocaleString(
              "id-ID"
            )}, pembayaran Rp ${amount.toLocaleString(
              "id-ID"
            )}`
          );
        }
      }

      // =================================================
      // 9. PAYMENT NUMBER
      // =================================================

      const paymentNumber =
        await generatePaymentNumber(
          tx,
          paymentDate
        );

      // =================================================
      // 10. CREATE PAYMENT
      // =================================================

      const payment =
        await tx.payment.create({
          data: {
            number:
              paymentNumber,

            purchaseId:
              hasCentralPurchase
                ? input.purchaseId!
                : null,

            outletPurchaseId:
              hasOutletPurchase
                ? input.outletPurchaseId!
                : null,

            supplierId,

            paymentDate,

            amount,

            method,

            status:
              PaymentStatus.PAID,

            referenceNumber:
              input.referenceNumber ??
              null,

            note:
              input.remarks ??
              null,

            createdBy:
              input.userId,

            approvedBy:
              input.userId,

            approvedAt:
              paymentDate,
          },
        });

      // =================================================
      // 11. PETTY CASH OUT
      // =================================================

      let pettyCash = null;

      if (
        isPettyCashPaymentMethod(
          method
        )
      ) {
        if (
          !pettyCashAccount
        ) {
          throw new Error(
            "Akun Petty Cash tidak ditemukan"
          );
        }

        const balanceBefore =
          pettyCashBalanceBefore;

        const balanceAfter =
          roundMoney(
            balanceBefore -
              amount
          );

        const pettyCashNumber =
          await generatePettyCashNumber(
            tx,
            paymentDate
          );

        pettyCash =
          await tx.pettyCash.create({
            data: {
              number:
                pettyCashNumber,

              trxDate:
                paymentDate,

              type:
                PettyCashType.OUT,

              category:
                "PURCHASE",

              description:
                `Pembayaran ${method} Purchase ${purchaseNumber}`,

              amount,

              balanceBefore,

              balanceAfter,

              accountId:
                pettyCashAccount.id,

              paymentId:
                payment.id,

              outletId,

              createdBy:
                input.userId,

              approvedBy:
                input.userId,

              status:
                PettyCashStatus.APPROVED,

              approvedAt:
                paymentDate,
            },
          });

        await tx.pettyCashAccount.update({
          where: {
            id:
              pettyCashAccount.id,
          },

          data: {
            currentBalance:
              balanceAfter,
          },
        });
      }

      // =================================================
      // 12. RETURN PAYMENT
      // =================================================

      return {
        type:
          "PAYMENT" as const,

        payment,

        payable: null,

        pettyCash:
          pettyCash
            ? {
                id:
                  pettyCash.id,

                number:
                  pettyCash.number,

                amount:
                  Number(
                    pettyCash.amount
                  ),

                balanceBefore:
                  Number(
                    pettyCash.balanceBefore
                  ),

                balanceAfter:
                  Number(
                    pettyCash.balanceAfter
                  ),

                outletId:
                  pettyCash.outletId,

                accountId:
                  pettyCash.accountId,
              }
            : null,
      };
    },

    {
      maxWait: 5000,
      timeout: 10000,
    }
  );
}