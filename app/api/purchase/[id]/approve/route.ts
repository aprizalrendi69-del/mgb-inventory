import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import {
  PaymentMethod,
  PaymentStatus,
  PettyCashStatus,
  PettyCashType,
  PurchaseStatus,
} from "@prisma/client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const purchaseId = Number(id);

    if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "ID Purchase Order tidak valid",
        },
        { status: 400 }
      );
    }

    const purchase = await prisma.purchase.findUnique({
      where: {
        id: purchaseId,
      },
      include: {
        supplier: true,
        items: true,
        payable: true,
      },
    });

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase Order tidak ditemukan",
        },
        { status: 404 }
      );
    }

    if (purchase.status !== PurchaseStatus.DRAFT) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase Order sudah diapprove",
        },
        { status: 400 }
      );
    }

    if (!purchase.items || purchase.items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase Order belum memiliki barang",
        },
        { status: 400 }
      );
    }

    if (!purchase.supplier) {
      return NextResponse.json(
        {
          success: false,
          message: "Supplier tidak ditemukan",
        },
        { status: 400 }
      );
    }

    const total = Number(purchase.total);

    if (!Number.isFinite(total) || total <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Total Purchase Order tidak valid",
        },
        { status: 400 }
      );
    }

    const paymentMethod = purchase.paymentMethod;

    /*
     * =====================================================
     * ATURAN PEMBAYARAN
     * =====================================================
     *
     * CASH
     * COD
     * CBD
     * -> langsung keluar dari petty cash pusat
     *
     * TRANSFER
     * -> belum mengurangi petty cash
     * -> belum dibuat transaksi bank
     *
     * TEMPO
     * -> buat PurchasePayable
     * -> tidak mengurangi petty cash
     */

    const isImmediatePettyCash =
      paymentMethod === PaymentMethod.CASH ||
      paymentMethod === PaymentMethod.COD ||
      paymentMethod === PaymentMethod.CBD;

    const isTempo =
      paymentMethod === PaymentMethod.TEMPO;

    const result = await prisma.$transaction(
      async (tx) => {
        /*
         * =================================================
         * 1. RECHECK PO DI DALAM TRANSACTION
         * =================================================
         *
         * Supaya approve tidak bisa dilakukan dua kali
         * secara bersamaan.
         */
        const currentPurchase =
          await tx.purchase.findUnique({
            where: {
              id: purchaseId,
            },
            include: {
              supplier: true,
              payable: true,
            },
          });

        if (!currentPurchase) {
          throw new Error(
            "Purchase Order tidak ditemukan"
          );
        }

        if (
          currentPurchase.status !==
          PurchaseStatus.DRAFT
        ) {
          throw new Error(
            "Purchase Order sudah diapprove"
          );
        }

        /*
         * =================================================
         * 2. UPDATE STATUS PO
         * =================================================
         */
        const approvedPurchase =
          await tx.purchase.update({
            where: {
              id: purchaseId,
            },
            data: {
              status: PurchaseStatus.APPROVED,
            },
          });

        /*
         * =================================================
         * 3. PAYMENT CASH / COD / CBD
         * =================================================
         *
         * Scope pusat:
         * outletId = null
         *
         * Jadi petty cash outlet tidak akan pernah
         * tercampur dengan petty cash pusat.
         */

        let pettyCash = null;

        if (isImmediatePettyCash) {
          /*
           * Ambil transaksi petty cash terakhir pusat.
           *
           * Karena PettyCash tidak memiliki tabel saldo master,
           * saldo berjalan dihitung dari transaksi terakhir.
           */
          const lastPettyCash =
            await tx.pettyCash.findFirst({
              where: {
                outletId: null,
              },
              orderBy: [
                {
                  trxDate: "desc",
                },
                {
                  id: "desc",
                },
              ],
            });

          const balanceBefore = Number(
            lastPettyCash?.balanceAfter ?? 0
          );

          if (!Number.isFinite(balanceBefore)) {
            throw new Error(
              "Saldo petty cash pusat tidak valid"
            );
          }

          const balanceAfter =
            balanceBefore - total;

          /*
           * Tidak boleh minus.
           */
          if (balanceAfter < 0) {
            throw new Error(
              `Saldo petty cash pusat tidak mencukupi. Saldo tersedia Rp ${balanceBefore.toLocaleString(
                "id-ID"
              )}, sedangkan pembayaran Rp ${total.toLocaleString(
                "id-ID"
              )}.`
            );
          }

          /*
           * Nomor transaksi petty cash.
           */
          const pettyCashNumber =
            await generatePettyCashNumber(
              tx,
              currentPurchase.purchaseDate
            );

          pettyCash =
            await tx.pettyCash.create({
              data: {
                number: pettyCashNumber,

                trxDate:
                  currentPurchase.purchaseDate,

                type: PettyCashType.OUT,

                category: "PURCHASE",

                description:
                  `Pembayaran ${paymentMethod} PO ${currentPurchase.number} - ${currentPurchase.supplier.name}`,

                amount: total,

                balanceBefore,

                balanceAfter,

                outletId: null,

                status:
                  PettyCashStatus.APPROVED,

                approvedAt: new Date(),
              },
            });
        }

        /*
         * =================================================
         * 4. TEMPO -> BUAT HUTANG
         * =================================================
         */

        let payable = null;

        if (isTempo) {
          /*
           * Satu PO hanya boleh mempunyai satu payable.
           */
          if (currentPurchase.payable) {
            throw new Error(
              "Hutang untuk Purchase Order ini sudah ada"
            );
          }

          const invoiceNumber =
            `INV-${currentPurchase.number}`;

          payable =
            await tx.purchasePayable.create({
              data: {
                purchaseId:
                  currentPurchase.id,

                supplierId:
                  currentPurchase.supplierId,

                outletId: null,

                invoiceNumber,

                invoiceDate:
                  currentPurchase.purchaseDate,

                /*
                 * Belum menentukan jatuh tempo dari
                 * PO karena schema belum punya setting
                 * term pembayaran.
                 *
                 * Jadi dueDate sementara null.
                 */
                dueDate: null,

                amount: total,

                paidAmount: 0,

                outstanding: total,

                status: "OUTSTANDING",
              },
            });
        }

        /*
         * =================================================
         * 5. HISTORY
         * =================================================
         */

        await tx.history.create({
          data: {
            transactionType: "PURCHASE",

            referenceNumber:
              currentPurchase.number,

            description:
              `Approve Purchase Order ${currentPurchase.number} - ${currentPurchase.supplier.name} - Pembayaran ${paymentMethod}`,
          },
        });

        return {
          purchase: approvedPurchase,
          pettyCash,
          payable,
        };
      },
      {
        maxWait: 5000,
        timeout: 10000,
      }
    );

    let message =
      "Purchase Order berhasil diapprove";

    if (
      paymentMethod === PaymentMethod.CASH ||
      paymentMethod === PaymentMethod.COD ||
      paymentMethod === PaymentMethod.CBD
    ) {
      message =
        `Purchase Order berhasil diapprove dan petty cash pusat berkurang Rp ${total.toLocaleString(
          "id-ID"
        )}`;
    } else if (
      paymentMethod === PaymentMethod.TEMPO
    ) {
      message =
        "Purchase Order berhasil diapprove dan masuk ke hutang supplier";
    } else if (
      paymentMethod === PaymentMethod.TRANSFER
    ) {
      message =
        "Purchase Order berhasil diapprove dengan metode transfer";
    }

    return NextResponse.json({
      success: true,
      message,
      data: result,
    });
  } catch (error) {
    console.error(
      "APPROVE PURCHASE ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Approve Purchase Order gagal";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: 400,
      }
    );
  }
}

/*
 * =========================================================
 * GENERATE PETTY CASH NUMBER
 * =========================================================
 *
 * Contoh:
 * PC-202608-00001
 */
async function generatePettyCashNumber(
  tx: Parameters<
    Parameters<typeof prisma.$transaction>[0]
  >[0],
  trxDate: Date
) {
  const year = trxDate.getFullYear();

  const month = String(
    trxDate.getMonth() + 1
  ).padStart(2, "0");

  const period = `${year}${month}`;

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

  return `${document.prefix}-${period}-${String(
    document.lastNumber
  ).padStart(5, "0")}`;
}