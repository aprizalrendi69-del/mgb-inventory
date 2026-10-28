import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Master karyawan read endpoint used by the employee page and attendance UI.
 * Intentionally read-only here; employee mutations belong to their dedicated routes.
 */
export async function GET() {
  try {
    const data = await prisma.employee.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: {
        id: true,
        nik: true,
        name: true,
        gender: true,
        position: true,
        department: true,
        phone: true,
        address: true,
        photo: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/employee error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal memuat master karyawan." },
      { status: 500 },
    );
  }
}
