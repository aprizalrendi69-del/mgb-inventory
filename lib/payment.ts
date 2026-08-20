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
// VALIDATE PAYMENT METHOD
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
//
// outletId = null
// -> PETTY CASH PUSAT
//
// outletId = 1
// -> PETTY CASH OUTLET 1
//
// HANYA APPROVED
//
// Fungsi ini tetap dipertahankan untuk kompatibilitas
// dengan bagian lain aplikasi.
// =====================================================

export async function getCurrentPettyCashBalance(
  tx: Prisma.TransactionClient,
  outletId: number | null
) {
  /*
  -------------------------------------------------------
  SEKARANG SALDO UTAMA DIAMBIL DARI ACCOUNT
  -------------------------------------------------------
  */

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

  if (account) {
    return roundMoney(
      Number(
        account.currentBalance ??
          account.openingBalance ??
          0
      )
    );
  }

  /*
  -------------------------------------------------------
  FALLBACK

  Kalau account belum ditemukan, jangan langsung
  menganggap ada saldo dari transaksi lain.

  Tetap hitung dari transaksi APPROVED sebagai
  fallback kompatibilitas.
  -------------------------------------------------------
  */

  const approvedTransactions =
    await tx.pettyCash.findMany({
      where: {
        outletId,
        status:
          PettyCashStatus.APPROVED,
      },

      select: {
        type: true,
        amount: true,
      },
    });

  let balance = 0;

  for (
    const trx of approvedTransactions
  ) {
    const amount =
      Number(trx.amount) || 0;

    if (
      trx.type ===
      PettyCashType.IN
    ) {
      balance += amount;
    } else if (
      trx.type ===
      PettyCashType.OUT
    ) {
      balance -= amount;
    }
  }

  return roundMoney(balance);
}

// =====================================================
// PROCESS PAYMENT
//
// CASH
// -> PAYMENT PAID
// -> PETTY CASH OUT
//
// COD
// -> PAYMENT PAID
// -> PETTY CASH OUT
//
// CBD
// -> PAYMENT PAID
// -> PETTY CASH OUT
//
// TRANSFER
// -> PAYMENT PAID SAJA
//
// TEMPO
// -> PURCHASE PAYABLE
//
// =====================================================

export async function processPayment(
  input: ProcessPaymentInput
) {
  const amount =
    roundMoney(
      Number(
        input.amount
      )
    );

  // ===================================================
  // BASIC VALIDATION
  // ===================================================

  if (
    !Number.isFinite(
      amount
    ) ||
    amount <= 0
  ) {
    throw new Error(
      "Jumlah pembayaran harus lebih dari 0"
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

  if (
    !input.purchaseId &&
    !input.outletPurchaseId
  ) {
    throw new Error(
      "Purchase tidak valid"
    );
  }

  if (
    input.purchaseId &&
    input.outletPurchaseId
  ) {
    throw new Error(
      "Payment tidak boleh memiliki Purchase Pusat dan Purchase Outlet sekaligus"
    );
  }

  if (
    !isValidPurchasePaymentMethod(
      input.method
    )
  ) {
    throw new Error(
      "Metode pembayaran tidak valid"
    );
  }

  // ===================================================
  // OUTLET SECURITY
  // ===================================================

  if (
    input.outletPurchaseId &&
    !input.outletId
  ) {
    throw new Error(
      "Purchase Outlet harus memiliki outlet"
    );
  }

  if (
    input.purchaseId &&
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
        input.purchaseNumber ??
        "";

      let supplierId =
        input.supplierId;

      let outletId =
        input.outletId ??
        null;

      // =================================================
      // 1. LOAD PURCHASE PUSAT
      // =================================================

      if (
        input.purchaseId
      ) {
        const purchase =
          await tx.purchase.findUnique({
            where: {
              id:
                input.purchaseId,
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

        outletId =
          null;

        if (
          purchase.paymentMethod !==
          input.method
        ) {
          throw new Error(
            "Metode pembayaran tidak sesuai dengan Purchase"
          );
        }
      }

      // =================================================
      // 2. LOAD PURCHASE OUTLET
      // =================================================

      if (
        input.outletPurchaseId
      ) {
        const purchase =
          await tx.outletPurchase.findUnique({
            where: {
              id:
                input.outletPurchaseId,
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

        if (
          purchase.paymentMethod !==
          input.method
        ) {
          throw new Error(
            "Metode pembayaran tidak sesuai dengan Purchase Outlet"
          );
        }
      }

      // =================================================
      // 3. VALIDATE TOTAL
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
      // 4. TEMPO
      // =================================================

      if (
        isTempoPaymentMethod(
          input.method
        )
      ) {
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

        let payable;

        // =============================================
        // PURCHASE PUSAT
        // =============================================

        if (
          input.purchaseId
        ) {
          payable =
            await tx.purchasePayable.upsert({
              where: {
                purchaseId:
                  input.purchaseId,
              },

              update:
                payableData,

              create: {
                purchaseId:
                  input.purchaseId,

                ...payableData,
              },
            });
        }

        // =============================================
        // PURCHASE OUTLET
        // =============================================

        else {
          payable =
            await tx.purchasePayable.upsert({
              where: {
                outletPurchaseId:
                  input.outletPurchaseId!,
              },

              update:
                payableData,

              create: {
                outletPurchaseId:
                  input.outletPurchaseId!,

                ...payableData,
              },
            });
        }

        return {
          type:
            "PAYABLE" as const,

          payment:
            null,

          payable: {
            id:
              payable.id,

            amount:
              roundMoney(
                Number(
                  payable.amount
                )
              ),

            paidAmount:
              roundMoney(
                Number(
                  payable.paidAmount
                )
              ),

            outstanding:
              roundMoney(
                Number(
                  payable.outstanding
                )
              ),

            status:
              payable.status,
          },

          pettyCash:
            null,
        };
      }

      // =================================================
      // 5. PETTY CASH ACCOUNT
      //
      // UNTUK CASH / COD / CBD
      //
      // PENTING:
      // accountId harus ditentukan SEBELUM PAYMENT
      // dibuat supaya seluruh proses berada dalam
      // transaction yang sama.
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
          input.method
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

        if (!pettyCashAccount) {
          const owner =
            outletId === null
              ? "Pusat"
              : "Outlet";

          throw new Error(
            `Akun Petty Cash ${owner} belum tersedia atau tidak aktif`
          );
        }

        /*
        ---------------------------------------------------
        SALDO BERJALAN DARI ACCOUNT
        ---------------------------------------------------
        */

        pettyCashBalanceBefore =
          roundMoney(
            Number(
              pettyCashAccount.currentBalance ??
                pettyCashAccount.openingBalance ??
                0
            )
          );

        /*
        ---------------------------------------------------
        VALIDATE SALDO
        ---------------------------------------------------
        */

        if (
          amount >
          pettyCashBalanceBefore
        ) {
          const owner =
            outletId
              ? "Petty Cash outlet"
              : "Petty Cash pusat";

          throw new Error(
            `${owner} tidak mencukupi. Saldo tersedia Rp ${pettyCashBalanceBefore.toLocaleString(
              "id-ID"
            )}, pembayaran Rp ${amount.toLocaleString(
              "id-ID"
            )}`
          );
        }
      }

      // =================================================
      // 6. PAYMENT NUMBER
      // =================================================

      const paymentNumber =
        await generatePaymentNumber(
          tx,
          paymentDate
        );

      // =================================================
      // 7. CREATE PAYMENT
      // =================================================

      const payment =
        await tx.payment.create({
          data: {
            number:
              paymentNumber,

            purchaseId:
              input.purchaseId ??
              null,

            outletPurchaseId:
              input.outletPurchaseId ??
              null,

            supplierId,

            paymentDate,

            amount,

            method:
              input.method,

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
      // 8. PETTY CASH
      //
      // CASH / COD / CBD
      //
      // SEKARANG:
      // - accountId DIISI
      // - balanceBefore dari account
      // - balanceAfter dihitung
      // - currentBalance ACCOUNT diperbarui
      // =================================================

      let pettyCash = null;

      if (
        isPettyCashPaymentMethod(
          input.method
        )
      ) {
        /*
        ---------------------------------------------------
        ACCOUNT HARUS SUDAH ADA
        ---------------------------------------------------
        */

        if (!pettyCashAccount) {
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

        /*
        ---------------------------------------------------
        PETTY CASH NUMBER
        ---------------------------------------------------
        */

        const pettyCashNumber =
          await generatePettyCashNumber(
            tx,
            paymentDate
          );

        /*
        ---------------------------------------------------
        CREATE PETTY CASH
        ---------------------------------------------------

        INI BAGIAN PENTING:

        accountId:
        -> mengikat transaksi ke akun Petty Cash
           yang benar.

        outletId:
        -> tetap menyimpan lokasi transaksi.
        */

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
                `Pembayaran ${input.method} Purchase ${purchaseNumber}`,

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

        /*
        ---------------------------------------------------
        UPDATE CURRENT BALANCE ACCOUNT
        ---------------------------------------------------

        Karena transaksi langsung APPROVED,
        saldo akun juga langsung berkurang.
        */

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
      // 9. TRANSFER
      //
      // PAYMENT SAJA
      //
      // TIDAK ADA PETTY CASH
      // =================================================

      return {
        type:
          "PAYMENT" as const,

        payment,

        payable:
          null,

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
      maxWait:
        5000,

      timeout:
        10000,
    }
  );
}