import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest
) {

  try {

    const body =
      await req.json();

    const sessionId =
      Number(body.sessionId);

    if (!sessionId) {

      return NextResponse.json({

        success: false,

        message: "Session tidak valid"

      }, {

        status: 400

      });

    }

    const session =
      await prisma.stockOpname.findUnique({

        where: {

          id: sessionId

        }

      });

    if (!session) {

      return NextResponse.json({

        success: false,

        message: "Session tidak ditemukan"

      }, {

        status: 404

      });

    }

    if (session.status === "CLOSED") {

      return NextResponse.json({

        success: false,

        message: "Session sudah ditutup"

      }, {

        status: 400

      });

    }

    const items =
      await prisma.stockOpnameItem.findMany({

        where: {

          stockOpnameId: sessionId

        },

        include: {

          barang: true

        }

      });

    await prisma.$transaction(

      async (tx) => {

        for (const item of items) {

          const selisih =
            item.qtyScan - item.qtySystem;

          await tx.barang.update({

            where: {

              id: item.barangId

            },

            data: {

              stock: item.qtyScan

            }

          });

          if (selisih !== 0) {

            await tx.adjustment.create({

              data: {

                barangId: item.barangId,

                qty: selisih,

                note: `Stock Opname #${session.id}`

              }

            });

          }

        }

        await tx.stockOpname.update({

          where: {

            id: sessionId

          },

          data: {

            status: "CLOSED",

            finishedAt: new Date()

          }

        });

      }

    );

    return NextResponse.json({

      success: true,

      message: "Stock Opname berhasil diselesaikan"

    });

  } catch (error: any) {

    console.log(error);

    return NextResponse.json({

      success: false,

      message: error.message

    }, {

      status: 500

    });

  }

}