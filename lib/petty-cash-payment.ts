import {
  PaymentMethod,
  PaymentStatus,
  PettyCashStatus,
  PettyCashType,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

function generatePettyCashNumber() {
  const now = new Date();

  const date =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");

  const time =
    now.getHours().toString().padStart(2, "0") +
    now.getMinutes().toString().padStart(2, "0") +
    now.getSeconds().toString().padStart(2, "0");

  const random = Math.floor(
    Math.random() * 10000
  )
    .toString()
    .padStart(4, "0");

  return `PC-PO-${date}-${time}-${random}`;
}

function generatePaymentNumber() {
  const now = new Date();

  return (
    "PAY-" +
    now.getTime() +
    "-" +
    Math.floor(
      Math.random() * 1000
    )
  );
}

function generatePayableInvoice(
  purchaseNumber: string
) {
  return `INV-${purchaseNumber}`;
}

// ============================================================
// PROCESS CENTRAL PURCHASE PAYMENT
// ============================================================

export async function processCentralPurchasePayment(
  purchaseId: number,
  userId: number,
  amount?: number,
  referenceNumber?: string | null,
  note?: string | null
) {
  return prisma.$transaction(
    async (tx) => {
      const purchase =
        await tx.purchase.findUnique({
          where: {
            id: purchaseId,
          },

          include: {
            supplier: true,
            payable: true,
          },
        });

      if (!purchase) {
        throw new Error(
          "Purchase tidak ditemukan."
        );
      }

      const paymentAmount =
        Number(
          amount ?? purchase.total
        );

      if (
        !Number.isFinite(
          paymentAmount
        ) ||
        paymentAmount <= 0
      ) {
        throw new Error(
          "Nominal pembayaran tidak valid."
        );
      }

      // ======================================================
      // CEK PEMBAYARAN SUDAH ADA
      // ======================================================

      const existingPayment =
        await tx.payment.findFirst({
          where: {
            purchaseId:
              purchase.id,

            status:
              PaymentStatus.PAID,
          },

          orderBy: {
            id: "desc",
          },
        });

      if (existingPayment) {
        return {
          payment:
            existingPayment,

          alreadyProcessed:
            true,

          purchase,
        };
      }

      // ======================================================
      // TRANSFER
      //
      // LUNAS
      // TIDAK PETTY CASH
      // TIDAK HUTANG
      // ======================================================

      if (
        purchase.paymentMethod ===
        PaymentMethod.TRANSFER
      ) {
        const payment =
          await tx.payment.create({
            data: {
              number:
                generatePaymentNumber(),

              purchaseId:
                purchase.id,

              supplierId:
                purchase.supplierId,

              paymentDate:
                new Date(),

              amount:
                paymentAmount,

              method:
                PaymentMethod.TRANSFER,

              status:
                PaymentStatus.PAID,

              referenceNumber:
                referenceNumber ||
                null,

              note:
                note ||
                "Pembayaran Purchase melalui Transfer.",

              createdBy:
                userId,
            },
          });

        return {
          payment,
          alreadyProcessed:
            false,

          purchase,
        };
      }

      // ======================================================
      // TEMPO
      //
      // HUTANG
      // TIDAK PETTY CASH
      // ======================================================

      if (
        purchase.paymentMethod ===
        PaymentMethod.TEMPO
      ) {
        const invoiceNumber =
          generatePayableInvoice(
            purchase.number
          );

        const dueDate =
          new Date();

        dueDate.setDate(
          dueDate.getDate() + 30
        );

        const payable =
          await tx.purchasePayable.upsert(
            {
              where: {
                purchaseId:
                  purchase.id,
              },

              update: {
                amount:
                  paymentAmount,

                outstanding:
                  paymentAmount,

                status:
                  "OUTSTANDING",

                invoiceDate:
                  new Date(),

                dueDate,
              },

              create: {
                purchaseId:
                  purchase.id,

                supplierId:
                  purchase.supplierId,

                outletId:
                  null,

                invoiceNumber,

                invoiceDate:
                  new Date(),

                dueDate,

                amount:
                  paymentAmount,

                paidAmount: 0,

                outstanding:
                  paymentAmount,

                status:
                  "OUTSTANDING",
              },
            }
          );

        return {
          payable,

          alreadyProcessed:
            false,

          purchase,
        };
      }

      // ======================================================
      // CASH / COD / CBD
      //
      // PETTY CASH -
      // ======================================================

      const account =
        await tx.pettyCashAccount.findUnique(
          {
            where: {
              outletId: null,
            },
          }
        );

      if (!account) {
        throw new Error(
          "Akun Petty Cash Pusat belum tersedia."
        );
      }

      const balanceBefore =
        Number(
          account.currentBalance || 0
        );

      if (
        balanceBefore <
        paymentAmount
      ) {
        throw new Error(
          `Saldo Petty Cash Pusat tidak mencukupi. Saldo saat ini Rp ${balanceBefore.toLocaleString(
            "id-ID"
          )}.`
        );
      }

      const balanceAfter =
        balanceBefore -
        paymentAmount;

      const payment =
        await tx.payment.create({
          data: {
            number:
              generatePaymentNumber(),

            purchaseId:
              purchase.id,

            supplierId:
              purchase.supplierId,

            paymentDate:
              new Date(),

            amount:
              paymentAmount,

            method:
              purchase.paymentMethod,

            status:
              PaymentStatus.PAID,

            referenceNumber:
              referenceNumber ||
              null,

            note:
              note ||
              `Pembayaran PO ${purchase.number} melalui ${purchase.paymentMethod}.`,

            createdBy:
              userId,
          },
        });

      await tx.pettyCash.create({
        data: {
          number:
            generatePettyCashNumber(),

          trxDate:
            new Date(),

          type:
            PettyCashType.OUT,

          category:
            "PAYMENT",

          description:
            `Pembayaran PO ${purchase.number} - ${purchase.supplier.name} (${purchase.paymentMethod})`,

          amount:
            paymentAmount,

          balanceBefore,

          balanceAfter,

          accountId:
            account.id,

          paymentId:
            payment.id,

          outletId:
            null,

          createdBy:
            userId,

          status:
            PettyCashStatus.APPROVED,

          approvedBy:
            userId,

          approvedAt:
            new Date(),
        },
      });

      await tx.pettyCashAccount.update(
        {
          where: {
            id: account.id,
          },

          data: {
            currentBalance:
              balanceAfter,
          },
        }
      );

      return {
        payment,

        alreadyProcessed:
          false,

        purchase,
      };
    }
  );
}

// ============================================================
// PROCESS OUTLET PURCHASE PAYMENT
// ============================================================

export async function processOutletPurchasePayment(
  purchaseId: number,
  userId: number,
  amount?: number,
  referenceNumber?: string | null,
  note?: string | null
) {
  return prisma.$transaction(
    async (tx) => {
      const purchase =
        await tx.outletPurchase.findUnique({
          where: {
            id: purchaseId,
          },

          include: {
            outlet: true,
            supplier: true,
            payable: true,
          },
        });

      if (!purchase) {
        throw new Error(
          "Purchase Outlet tidak ditemukan."
        );
      }

      const paymentAmount =
        Number(
          amount ?? purchase.total
        );

      if (
        !Number.isFinite(
          paymentAmount
        ) ||
        paymentAmount <= 0
      ) {
        throw new Error(
          "Nominal pembayaran tidak valid."
        );
      }

      // ======================================================
      // CEK DOUBLE PAYMENT
      // ======================================================

      const existingPayment =
        await tx.payment.findFirst({
          where: {
            outletPurchaseId:
              purchase.id,

            status:
              PaymentStatus.PAID,
          },

          orderBy: {
            id: "desc",
          },
        });

      if (existingPayment) {
        return {
          payment:
            existingPayment,

          alreadyProcessed:
            true,

          purchase,
        };
      }

      // ======================================================
      // TRANSFER
      // ======================================================

      if (
        purchase.paymentMethod ===
        PaymentMethod.TRANSFER
      ) {
        const payment =
          await tx.payment.create({
            data: {
              number:
                generatePaymentNumber(),

              outletPurchaseId:
                purchase.id,

              supplierId:
                purchase.supplierId,

              paymentDate:
                new Date(),

              amount:
                paymentAmount,

              method:
                PaymentMethod.TRANSFER,

              status:
                PaymentStatus.PAID,

              referenceNumber:
                referenceNumber ||
                null,

              note:
                note ||
                `Pembayaran PO Outlet ${purchase.number} melalui Transfer.`,

              createdBy:
                userId,
            },
          });

        return {
          payment,

          alreadyProcessed:
            false,

          purchase,
        };
      }

      // ======================================================
      // TEMPO
      // ======================================================

      if (
        purchase.paymentMethod ===
        PaymentMethod.TEMPO
      ) {
        const invoiceNumber =
          generatePayableInvoice(
            purchase.number
          );

        const dueDate =
          new Date();

        dueDate.setDate(
          dueDate.getDate() + 30
        );

        const payable =
          await tx.purchasePayable.upsert(
            {
              where: {
                outletPurchaseId:
                  purchase.id,
              },

              update: {
                amount:
                  paymentAmount,

                outstanding:
                  paymentAmount,

                status:
                  "OUTSTANDING",

                invoiceDate:
                  new Date(),

                dueDate,
              },

              create: {
                outletPurchaseId:
                  purchase.id,

                supplierId:
                  purchase.supplierId,

                outletId:
                  purchase.outletId,

                invoiceNumber,

                invoiceDate:
                  new Date(),

                dueDate,

                amount:
                  paymentAmount,

                paidAmount: 0,

                outstanding:
                  paymentAmount,

                status:
                  "OUTSTANDING",
              },
            }
          );

        return {
          payable,

          alreadyProcessed:
            false,

          purchase,
        };
      }

      // ======================================================
      // CASH / COD / CBD
      // ======================================================

      const account =
        await tx.pettyCashAccount.findUnique(
          {
            where: {
              outletId:
                purchase.outletId,
            },
          }
        );

      if (!account) {
        throw new Error(
          `Akun Petty Cash untuk outlet ${purchase.outlet.name} belum tersedia.`
        );
      }

      const balanceBefore =
        Number(
          account.currentBalance || 0
        );

      if (
        balanceBefore <
        paymentAmount
      ) {
        throw new Error(
          `Saldo Petty Cash ${purchase.outlet.name} tidak mencukupi. Saldo saat ini Rp ${balanceBefore.toLocaleString(
            "id-ID"
          )}.`
        );
      }

      const balanceAfter =
        balanceBefore -
        paymentAmount;

      const payment =
        await tx.payment.create({
          data: {
            number:
              generatePaymentNumber(),

            outletPurchaseId:
              purchase.id,

            supplierId:
              purchase.supplierId,

            paymentDate:
              new Date(),

            amount:
              paymentAmount,

            method:
              purchase.paymentMethod,

            status:
              PaymentStatus.PAID,

            referenceNumber:
              referenceNumber ||
              null,

            note:
              note ||
              `Pembayaran PO Outlet ${purchase.number} melalui ${purchase.paymentMethod}.`,

            createdBy:
              userId,
          },
        });

      await tx.pettyCash.create({
        data: {
          number:
            generatePettyCashNumber(),

          trxDate:
            new Date(),

          type:
            PettyCashType.OUT,

          category:
            "PAYMENT",

          description:
            `Pembayaran PO Outlet ${purchase.number} - ${purchase.supplier.name} (${purchase.paymentMethod})`,

          amount:
            paymentAmount,

          balanceBefore,

          balanceAfter,

          accountId:
            account.id,

          paymentId:
            payment.id,

          outletId:
            purchase.outletId,

          createdBy:
            userId,

          status:
            PettyCashStatus.APPROVED,

          approvedBy:
            userId,

          approvedAt:
            new Date(),
        },
      });

      await tx.pettyCashAccount.update(
        {
          where: {
            id: account.id,
          },

          data: {
            currentBalance:
              balanceAfter,
          },
        }
      );

      return {
        payment,

        alreadyProcessed:
          false,

        purchase,
      };
    }
  );
}