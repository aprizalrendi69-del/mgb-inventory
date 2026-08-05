import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {

  const data =
    await prisma.stockOpname.findMany({

      orderBy: {
        id: "desc"
      }

    });

  return NextResponse.json({

    success: true,

    data

  });

}

export async function POST(req: NextRequest) {

  try {

    const body =
      await req.json();

    const session =
      await prisma.stockOpname.create({

        data: {

          warehouse:
            body.warehouse,

          note:
            body.note,

          status: "OPEN"

        }

      });

    return NextResponse.json({

      success: true,

      data: session

    });

  } catch (error: any) {

    return NextResponse.json({

      success: false,

      message: error.message

    });

  }

}