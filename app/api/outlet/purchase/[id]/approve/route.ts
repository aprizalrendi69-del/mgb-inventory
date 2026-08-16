import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  OutletPurchaseStatus,
  Role,
} from "@prisma/client";
import { cookies } from "next/headers";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const purchaseId = Number(id);

    if (!purchaseId) {
      return NextResponse.json(
        {
          success: false,
          message: "ID Purchase tidak valid",
        },
        { status: 400 }
      );
    }

    // =========================
    // SESSION
    // =========================

    const cookieStore = await cookies();

    // Coba session utama aplikasi
    const sessionCookie =
      cookieStore.get("session") ||
      cookieStore.get("erp-session");

    if (!sessionCookie) {
      return NextResponse.json(
        {
          success: false,
          message: "Belum login",
        },
        { status: 401 }
      );
    }

    let userId: number | null = null;

    // =========================
    // SESSION DATABASE
    // =========================

    const session = await prisma.session.findUnique({
      where: {
        token: sessionCookie.value,
      },
      include: {
        user: true,
      },
    });

    if (session) {
      if (session.expiresAt < new Date()) {
        return NextResponse.json(
          {
            success: false,
            message: "Session sudah expired",
          },
          { status: 401 }
        );
      }

      userId = session.user.id;
    } else {
      // =========================
      // SESSION JSON
      // =========================

      try {
        const parsed = JSON.parse(
          sessionCookie.value
        );

        if (parsed?.id) {
          userId = Number(parsed.id);
        }
      } catch {
        // bukan JSON
      }
    }

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          message: "Session tidak valid",
        },
        { status: 401 }
      );
    }

    // =========================
    // USER
    // =========================

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "User tidak ditemukan",
        },
        { status: 401 }
      );
    }

    // =========================
    // ROLE
    // ADMIN + PURCHASING
    // =========================

    const allowedRoles = [
      Role.ADMIN,
      Role.PURCHASING,
    ];

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Hanya Admin atau Purchasing yang boleh approve Purchase Outlet",
        },
        { status: 403 }
      );
    }

    // =========================
    // PURCHASE
    // =========================

    const purchase =
      await prisma.outletPurchase.findUnique({
        where: {
          id: purchaseId,
        },
        include: {
          supplier: true,
          outlet: true,
          items: true,
        },
      });

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet tidak ditemukan",
        },
        { status: 404 }
      );
    }

    // =========================
    // HARUS DRAFT
    // =========================

    if (
      purchase.status !==
      OutletPurchaseStatus.DRAFT
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Purchase Outlet sudah ${purchase.status} dan tidak dapat diapprove lagi`,
        },
        { status: 400 }
      );
    }

    // =========================
    // ITEM
    // =========================

    if (purchase.items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet tidak memiliki barang",
        },
        { status: 400 }
      );
    }

    // =========================
    // APPROVE
    // =========================

    const result =
      await prisma.$transaction(
        async (tx) => {
          const approved =
            await tx.outletPurchase.update({
              where: {
                id: purchase.id,
              },
              data: {
                status:
                  OutletPurchaseStatus.APPROVED,
              },
            });

          await tx.history.create({
            data: {
              transactionType: "PURCHASE",
              referenceNumber:
                purchase.number,
              description:
                `Approve Purchase Outlet ${purchase.number} - ${purchase.supplier.name}`,
              userId: user.id,
            },
          });

          return approved;
        }
      );

    return NextResponse.json({
      success: true,
      message:
        "Purchase Outlet berhasil diapprove",
      data: result,
    });
  } catch (error) {
    console.error(
      "APPROVE OUTLET PURCHASE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Approve Purchase Outlet gagal",
      },
      { status: 500 }
    );
  }
}