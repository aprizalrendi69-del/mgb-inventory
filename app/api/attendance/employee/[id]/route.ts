import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id: idParam } = await context.params;

    const id = Number(idParam);

    const employee = await prisma.employee.findUnique({
      where: {
        id,
      },

      include: {
        attendances: {
          orderBy: {
            date: "desc",
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        {
          success: false,
          message: "Pegawai tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,
      data: employee,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      {
        status: 500,
      }
    );
  }
}