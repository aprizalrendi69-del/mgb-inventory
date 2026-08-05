import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {

  try {

    const body = await req.json();

    const sessionId = Number(body.sessionId);

    if (!sessionId) {

      return NextResponse.json({

        success: false,

        message: "Session tidak ditemukan"

      });

    }

    await prisma.$transaction(async (tx) => {

      const session =
        await tx.stockOpname.findUnique({

          where: {

            id: sessionId

          },

          include: {

            items: {

              include: {

                barang: true

              }

            }

          }

        });

      if (!session) {

        throw new Error("Stock Opname tidak ditemukan");

      }

      if (session.status === "FINISHED") {

        throw new Error("Stock Opname sudah selesai");

      }

      const adjustment =
        await tx.adjustment.create({

          data: {

            number: `ADJ-${Date.now()}`,

            type: "OPNAME",

            reason: "Stock Opname",

            remarks: session.note,

            status: "APPROVED"

          }

        });

      for (const item of session.items) {

        const before = item.barang.stock;

        const after = item.physicalQty;

        const diff = after - before;

        await tx.barang.update({

          where: {

            id: item.barangId

          },

          data: {

            stock: after

          }

        });

        await tx.inventory.updateMany({

          where: {

            barangId: item.barangId

          },

          data: {

            stock: after,

            availableStock: after

          }

        });

        await tx.adjustmentItem.create({

          data: {

            adjustmentId: adjustment.id,

            barangId: item.barangId,

            qty: Math.abs(diff),

            price: item.barang.purchasePrice,

            type: diff >= 0 ? "IN" : "OUT"

          }

        });

        await tx.stockCard.create({

          data: {

            barangId: item.barangId,

            trxType: "STOCK OPNAME",

            trxNumber: session.number,

            referenceId: session.id,

            qtyIn: diff > 0 ? diff : 0,

            qtyOut: diff < 0 ? Math.abs(diff) : 0,

            balance: after,

            unitPrice: item.barang.purchasePrice,

            totalValue: after * item.barang.purchasePrice,

            note: "Stock Opname"

          }

        });

        await tx.stockMutation.create({

          data: {

            barangId: item.barangId,

            type: "STOCK OPNAME",

            qty: Math.abs(diff),

            stockBefore: before,

            stockAfter: after,

            reference: session.number,

            description: "Final Stock Opname"

          }

        });

      }

      await tx.stockOpname.update({

        where: {

          id: session.id

        },

        data: {

          status: "FINISHED",

          locked: true

        }

      });

    });

    return NextResponse.json({

      success: true,

      message: "Stock Opname berhasil diselesaikan"

    });

  } catch (error: any) {

    console.log(error);

    return NextResponse.json({

      success: false,

      message: error.message

    });

  }

}