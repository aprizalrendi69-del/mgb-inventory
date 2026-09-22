import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

// =====================================================
// TYPES
// =====================================================

type SessionData = {
  id?: number;
};

// =====================================================
// GET CURRENT SESSION USER
// =====================================================

async function getCurrentUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get("erp-session");

  if (!session) return null;

  try {
    const sessionData = JSON.parse(session.value) as SessionData;
    const id = Number(sessionData?.id);

    if (!Number.isInteger(id) || id <= 0) {
      return null;
    }

    return id;
  } catch (error) {
    console.error("INVALID ERP SESSION FOR MENTION USERS:", error);
    return null;
  }
}

// =====================================================
// GET USERS FOR @MENTION
// =====================================================
//
// Endpoint ini KHUSUS untuk kebutuhan mention pada
// diskusi Barang Masuk.
//
// Tidak menggunakan permission /api/master/user karena
// Master User memang membatasi akses berdasarkan role.
//
// Yang dikembalikan hanya user ACTIVE dan field publik
// yang diperlukan frontend mention.
// =====================================================

export async function GET() {
  try {
    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login atau session tidak valid",
        },
        { status: 401 }
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        id: true,
        active: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          message: "User tidak ditemukan",
        },
        { status: 401 }
      );
    }

    if (!currentUser.active) {
      return NextResponse.json(
        {
          success: false,
          message: "Akun tidak aktif",
        },
        { status: 403 }
      );
    }

    const users = await prisma.user.findMany({
      where: {
        active: true,
      },
      orderBy: [
        { fullname: "asc" },
        { id: "asc" },
      ],
      select: {
        id: true,
        username: true,
        fullname: true,
        role: true,
        active: true,
        outletId: true,
        outlet: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: users,
      currentUserId: currentUser.id,
    });
  } catch (error: any) {
    console.error("GET MENTION USERS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ??
          "Gagal mengambil daftar user untuk mention",
      },
      { status: 500 }
    );
  }
}
