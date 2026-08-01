import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {

    const employees = await prisma.employee.findMany({
      include: {
        attendances: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    const now = new Date();

    const startMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    const endMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59
    );

    const totalHari = endMonth.getDate();

    const data = employees.map((employee) => {

      const hadir = employee.attendances.filter((item) => {

        const tanggal = new Date(item.checkIn);

        return (
          tanggal >= startMonth &&
          tanggal <= endMonth
        );

      }).length;

      return {

        id: employee.id,

        nik: employee.nik,

        fullname: employee.name,

        role: employee.position ?? "-",

        totalHadir: hadir,

        totalAbsen: totalHari - hadir

      };

    });

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error: any) {

    console.log(error);

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