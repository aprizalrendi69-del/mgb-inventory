import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const employeeId = Number(id);

    const employee = await prisma.employee.findUnique({
      where: {
        id: employeeId,
      },
      include: {
        attendances: {
          orderBy: {
            checkIn: "desc",
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
      data: {
        employee: {
          id: employee.id,
          nik: employee.nik,
          name: employee.name,
          position: employee.position,
          department: employee.department,
        },
        attendance: employee.attendances,
      },
    });
  } catch (error: any) {
    console.error(error);

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