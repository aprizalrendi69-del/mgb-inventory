import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {

  try {

    const body = await req.json();

    const sessionId = Number(body.sessionId);

    const session = await prisma.stockOpname.findUnique({

      where: {
        id: sessionId
      },

      include: {
        details: true
      }

    });

    if (!session) {

      return NextResponse.json({

        success: false,
        message: "Session tidak ditemukan"

      }, { status: 404 });

    }

    await prisma.$transaction(

      session.details.map(item =>

        prisma.barang.update({

          where: {
            id: item.barangId
          },

          data: {
            stock: item.qtyScan
          }

        })

      )

    );

    await prisma.stockOpname.update({

      where: {
        id: sessionId
      },

      data: {
        status: "FINISHED",
        finishedAt: new Date()
      }

    });

    return NextResponse.json({

      success: true,
      message: "Stock berhasil diupdate"

    });

  } catch (error: any) {

    return NextResponse.json({

      success: false,
      message: error.message

    }, { status: 500 });

  }

}