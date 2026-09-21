import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";

type RouteContext = {
  params: Promise<{
    id: string;
    commentId: string;
  }>;
};

// =====================================================
// CURRENT USER
// =====================================================

async function getCurrentUser() {
  const cookieStore = await cookies();

  const sessionCookie =
    cookieStore.get("session") ||
    cookieStore.get("erp-session");

  if (!sessionCookie) {
    return null;
  }

  // ===================================================
  // DATABASE SESSION
  // ===================================================

  try {
    const session = await prisma.session.findUnique({
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

  // ===================================================
  // FALLBACK JSON SESSION
  // ===================================================

  try {
    const parsed = JSON.parse(sessionCookie.value);

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

    const user = await prisma.user.findUnique({
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

// =====================================================
// ACCESS
// =====================================================

function canAccessOutletPurchase(role: Role) {
  return (
    role === Role.ADMIN ||
    role === Role.MANAGER ||
    role === Role.PURCHASING ||
    role === Role.OUTLET_ADMIN
  );
}

// =====================================================
// ID
// =====================================================

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

// =====================================================
// DELETE COMMENT
// =====================================================
//
// URL:
//
// DELETE
// /api/outlet/purchase/{purchaseId}/comment/{commentId}
//
// SECURITY:
//
// 1. User harus login.
// 2. User harus memiliki role yang valid.
// 3. OUTLET_ADMIN hanya boleh mengakses purchase
//    milik outlet sendiri.
// 4. Comment harus berada di purchase yang diminta.
// 5. HANYA PEMBUAT KOMENTAR yang boleh menghapus.
// 6. ADMIN / MANAGER / PURCHASING tidak otomatis
//    boleh menghapus komentar user lain.
//

export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext
) {
  try {
    // =================================================
    // AUTH
    // =================================================

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        {
          status: 401,
        }
      );
    }

    // =================================================
    // ROLE ACCESS
    // =================================================

    if (!canAccessOutletPurchase(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses Purchase Outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // OUTLET ADMIN MUST HAVE OUTLET
    // =================================================

    if (
      user.role === Role.OUTLET_ADMIN &&
      user.outletId === null
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User Outlet Admin belum terhubung dengan outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // PARAMS
    // =================================================

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
            "ID Purchase Outlet tidak valid",
        },
        {
          status: 400,
        }
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
        {
          status: 400,
        }
      );
    }

    // =================================================
    // CHECK PURCHASE ACCESS
    // =================================================
    //
    // Ini sangat penting untuk OUTLET_ADMIN.
    //
    // Tidak boleh hanya mencari comment berdasarkan
    // commentId.
    //
    // Purchase harus terlebih dahulu terbukti boleh
    // diakses oleh user tersebut.
    //

    let purchase;

    if (user.role === Role.OUTLET_ADMIN) {
      purchase =
        await prisma.outletPurchase.findFirst({
          where: {
            id: purchaseId,
            outletId: user.outletId!,
          },

          select: {
            id: true,
            number: true,
            outletId: true,
          },
        });
    } else {
      purchase =
        await prisma.outletPurchase.findUnique({
          where: {
            id: purchaseId,
          },

          select: {
            id: true,
            number: true,
            outletId: true,
          },
        });
    }

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet tidak ditemukan atau Anda tidak memiliki akses",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // FIND COMMENT
    // =================================================

    const existingComment =
      await prisma.purchaseComment.findUnique({
        where: {
          id: commentId,
        },

        select: {
          id: true,
          outletPurchaseId: true,
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
        {
          status: 404,
        }
      );
    }

    // =================================================
    // SECURITY:
    // COMMENT MUST BELONG TO THIS PURCHASE
    // =================================================

    if (
      existingComment.outletPurchaseId !==
      purchaseId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Komentar tidak terkait dengan Purchase Outlet ini",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // SECURITY:
    // ONLY COMMENT OWNER CAN DELETE
    // =================================================
    //
    // INI ADALAH SECURITY UTAMA.
    //
    // Bukan:
    //
    // canDelete
    //
    // Bukan:
    //
    // role === ADMIN
    //
    // Bukan:
    //
    // role === MANAGER
    //
    // HANYA:
    //
    // existingComment.userId === user.id
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
        {
          status: 403,
        }
      );
    }

    // =================================================
    // DELETE
    // =================================================

    await prisma.$transaction(
      async (tx) => {
        // ---------------------------------------------
        // DELETE MENTIONS
        // ---------------------------------------------
        //
        // Aman walaupun relation Prisma belum memakai
        // onDelete: Cascade.
        //

        await tx.purchaseCommentMention.deleteMany({
          where: {
            commentId,
          },
        });

        // ---------------------------------------------
        // DELETE COMMENT
        // ---------------------------------------------

        await tx.purchaseComment.delete({
          where: {
            id: commentId,
          },
        });

        // ---------------------------------------------
        // HISTORY
        // ---------------------------------------------

        await tx.history.create({
          data: {
            transactionType:
              "PURCHASE",

            referenceNumber:
              purchase.number,

            description:
              `Menghapus komentar pada Purchase Order Outlet ${purchase.number}`,

            userId:
              user.id,
          },
        });
      }
    );

    // =================================================
    // RESPONSE
    // =================================================

    return NextResponse.json({
      success: true,

      message:
        "Komentar berhasil dihapus",
    });
  } catch (error) {
    console.error(
      "DELETE OUTLET PURCHASE COMMENT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal menghapus komentar",
      },
      {
        status: 500,
      }
    );
  }
}