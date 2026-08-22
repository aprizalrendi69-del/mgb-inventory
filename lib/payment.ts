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

type DbClient =
  | typeof prisma
  | Prisma.TransactionClient;

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

export function roundMoney(value: number) {
  return (
    Math.round(
      (value + Number.EPSILON) * 100
    ) / 100
  );
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
) {
  return (
    method === PaymentMethod.CASH ||
    method === PaymentMethod.COD ||
    method === PaymentMethod.CBD
  );
}

export function isTransferPaymentMethod(
  method: PaymentMethod
) {
  return method === PaymentMethod.TRANSFER;
}

export function isTempoPaymentMethod(
  method: PaymentMethod
) {
  return method === PaymentMethod.TEMPO;
}

// =====================================================
// USER ACCESS
// =====================================================

export function canProcessCentralPayment(
  role: Role
) {
  return (
    role === Role.ADMIN ||
    role === Role.MANAGER
  );
}

export function canProcessOutletPayment(
  role: Role
) {
  return (
    role === Role.ADMIN ||
    role === Role.MANAGER ||
    role === Role.OUTLET_ADMIN
  );
}

export function canManagePettyCash(
  role: Role
) {
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
) {
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

export function isValidPayableSettlementMethod(
  method: PaymentMethod
) {
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
) {
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
) {
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
) {
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
    !input.outletId
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
      // 3. FIND PAYABLE
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
      // 4. PAYABLE LOGIC
      // =================================================

      const outstanding =
        payable
          ? roundMoney(
              Number(
                payable.outstanding
              )
            )
          : 0;

      // =================================================
      // PAYABLE EXISTING
      // =================================================
      //
      // Kalau Purchase punya payable, berarti Purchase
      // tersebut adalah TEMPO.
      //
      // Payment yang masuk sekarang berarti pelunasan.
      //
      // CASH/COD/CBD:
      //   Payment + Petty Cash OUT
      //
      // TRANSFER:
      //   Payment saja
      //
      // TEMPO:
      //   Tidak boleh menjadi metode pelunasan.
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
          outstanding <= 0.01
        ) {
          throw new Error(
            "Purchase Payable sudah lunas"
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

        if (
          amount >
          outstanding + 0.01
        ) {
          throw new Error(
            `Jumlah pembayaran Rp ${amount.toLocaleString(
              "id-ID"
            )} melebihi sisa hutang Rp ${outstanding.toLocaleString(
              "id-ID"
            )}`
          );
        }

        const oldPaid =
          roundMoney(
            Number(
              payable.paidAmount
            )
          );

        const newPaid =
          roundMoney(
            oldPaid + amount
          );

        const newOutstanding =
          roundMoney(
            Math.max(
              0,
              outstanding - amount
            )
          );

        const newStatus =
          newOutstanding <= 0.01
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
            pettyCashBalanceBefore + 0.01
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
      // 5. TEMPO
      // =================================================
      //
      // TEMPO:
      // - TIDAK CREATE PAYMENT
      // - CREATE PAYABLE
      // - TIDAK POTONG PETTY CASH
      // =================================================

      if (
        method ===
        PaymentMethod.TEMPO
      ) {
        // Purchase TEMPO tidak boleh sudah punya payable
        if (payable) {
          throw new Error(
            "Purchase Payable untuk Purchase ini sudah tersedia"
          );
        }

        const payableData = {
          supplierId,

          outletId,

          invoiceNumber:
            purchaseNumber,

          invoiceDate:
            paymentDate,

          dueDate:
            null,

          amount:
            purchaseTotal,

          paidAmount:
            0,

          outstanding:
            purchaseTotal,

          status:
            "OUTSTANDING",
        };

        let createdPayable;

        if (
          hasCentralPurchase
        ) {
          createdPayable =
            await tx.purchasePayable.create({
              data: {
                purchaseId:
                  input.purchaseId!,

                ...payableData,
              },
            });
        } else {
          createdPayable =
            await tx.purchasePayable.create({
              data: {
                outletPurchaseId:
                  input.outletPurchaseId!,

                ...payableData,
              },
            });
        }

        return {
          type:
            "PAYABLE" as const,

          payment: null,

          payable: {
            id:
              createdPayable.id,

            amount:
              roundMoney(
                Number(
                  createdPayable.amount
                )
              ),

            paidAmount:
              roundMoney(
                Number(
                  createdPayable.paidAmount
                )
              ),

            outstanding:
              roundMoney(
                Number(
                  createdPayable.outstanding
                )
              ),

            status:
              createdPayable.status,
          },

          pettyCash: null,
        };
      }

      // =================================================
      // 6. NON-TEMPO PURCHASE
      // =================================================
      //
      // CASH / COD / CBD / TRANSFER
      //
      // WAJIB SAMA DENGAN METODE PURCHASE.
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
          "Purchase TEMPO harus diproses sebagai Purchase Payable"
        );
      }

      if (
        normalizedPurchaseMethod !==
        method
      ) {
        throw new Error(
          `Metode pembayaran tidak sesuai dengan Purchase. Metode Purchase: ${normalizedPurchaseMethod}, metode pembayaran: ${method}`
        );
      }

      // =================================================
      // 7. PAYMENT AMOUNT
      // =================================================

      if (
        Math.abs(
          amount -
            purchaseTotal
        ) > 0.01
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
      //
      // HANYA:
      // CASH
      // COD
      // CBD
      //
      // TRANSFER TIDAK MASUK SINI.
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
          pettyCashBalanceBefore + 0.01
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
      // 12. RETURN
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