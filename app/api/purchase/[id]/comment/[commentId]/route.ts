import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { cookies } from "next/headers";

type RouteContext = {
  params: Promise<{
    id: string;
    commentId: string;
  }>;
};

async function getCurrentUser() {
  const cookieStore = await cookies();

  const sessionCookie =
    cookieStore.get("session") ||
    cookieStore.get("erp-session");

  if (!sessionCookie) {
    return null;
  }

  try {
    const session =
      await prisma.session.findUnique({
        where: {
          token: sessionCookie.value,
        },
        select: {
          expiresAt: true,
          user: {
            select: {
              id: true,
              fullname: true,
              role: true,
              active: true,
              outletId: true,
            },
          },
        },
      });

    if (session) {
      if (session.expiresAt < new Date()) {
        return null;
      }

      if (!session.user.active) {
        return null;
      }

      return session.user;
    }
  } catch (error) {
    console.error(
      "DATABASE SESSION CHECK ERROR:",
      error
    );
  }

  // Fallback JSON session
  try {
    const parsed = JSON.parse(
      sessionCookie.value
    );

    const userId = Number(
      parsed?.user?.id ??
        parsed?.id ??
        0
    );

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return null;
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          fullname: true,
          role: true,
          active: true,
          outletId: true,
        },
      });

    if (!user || !user.active) {
      return null;
    }

    return user;
  } catch (error) {
    console.error(
      "JSON SESSION CHECK ERROR:",
      error
    );

    return null;
  }
}

function canAccessCentralPurchase(
  role: Role
) {
  return (
    role === Role.ADMIN ||
    role === Role.MANAGER ||
    role === Role.PURCHASING
  );
}

function getPositiveInteger(
  value: string
) {
  const id = Number(value);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return id;
}

// =========================================================
// DELETE COMMENT
// =========================================================

export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext
) {
  try {
    // =====================================================
    // AUTH
    // =====================================================

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        { status: 401 }
      );
    }

    // =====================================================
    // ACCESS PURCHASE PUSAT
    // =====================================================

    if (!canAccessCentralPurchase(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses komentar Purchase Pusat",
        },
        { status: 403 }
      );
    }

    // =====================================================
    // OUTLET USER BLOCK
    // =====================================================

    if (user.outletId !== null) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User outlet tidak dapat menghapus komentar Purchase Pusat",
        },
        { status: 403 }
      );
    }

    // =====================================================
    // PARAMS
    // =====================================================

    const {
      id,
      commentId: commentIdRaw,
    } = await params;

    const purchaseId =
      getPositiveInteger(id);

    if (!purchaseId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID Purchase tidak valid",
        },
        { status: 400 }
      );
    }

    const commentId =
      getPositiveInteger(
        commentIdRaw
      );

    if (!commentId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID komentar tidak valid",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // FIND COMMENT
    // =====================================================

    const existingComment =
      await prisma.purchaseComment.findUnique({
        where: {
          id: commentId,
        },
        select: {
          id: true,
          purchaseId: true,
          userId: true,
          comment: true,
        },
      });

    if (!existingComment) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Komentar tidak ditemukan",
        },
        { status: 404 }
      );
    }

    // =====================================================
    // SECURITY:
    // COMMENT MUST BELONG TO PURCHASE
    // =====================================================

    if (
      existingComment.purchaseId !==
      purchaseId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Komentar tidak terkait dengan Purchase Order ini",
        },
        { status: 404 }
      );
    }

    // =====================================================
    // SECURITY:
    // ONLY COMMENT OWNER CAN DELETE
    // =====================================================
    //
    // INI WAJIB.
    //
    // Walaupun user adalah:
    // ADMIN
    // MANAGER
    // PURCHASING
    //
    // tetap TIDAK BOLEH menghapus komentar
    // milik user lain.
    //

    if (
      existingComment.userId !==
      user.id
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda hanya dapat menghapus komentar yang Anda buat sendiri",
        },
        { status: 403 }
      );
    }

    // =====================================================
    // DELETE
    // =====================================================

    await prisma.$transaction(
      async (tx) => {
        // Hapus mention terlebih dahulu
        // agar aman walaupun FK belum cascade.

        await tx.purchaseCommentMention.deleteMany(
          {
            where: {
              commentId,
            },
          }
        );

        await tx.purchaseComment.delete({
          where: {
            id: commentId,
          },
        });

        // =================================================
        // HISTORY
        // =================================================

        await tx.history.create({
          data: {
            transactionType: "PURCHASE",
            referenceNumber:
              String(purchaseId),
            description:
              `Menghapus komentar pada Purchase Order #${purchaseId}`,
            userId: user.id,
          },
        });
      }
    );

    return NextResponse.json({
      success: true,
      message:
        "Komentar berhasil dihapus",
    });
  } catch (error) {
    console.error(
      "DELETE PURCHASE COMMENT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal menghapus komentar",
      },
      { status: 500 }
    );
  }
}