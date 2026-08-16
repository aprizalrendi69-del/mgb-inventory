import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OutletPurchaseStatus, Role } from "@prisma/client";
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
    const sessionCookie = cookieStore.get("erp-session");

    if (!sessionCookie?.value) {
      return NextResponse.json(
        {
          success: false,
          message: "Belum login",
        },
        { status: 401 }
      );
    }

    let sessionData: {
      id: number;
    };

    try {
      sessionData = JSON.parse(sessionCookie.value);
    } catch {
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
        id: sessionData.id,
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
    // ADMIN PUSAT + PURCHASING
    // =========================

    const canApprove =
      user.role === Role.ADMIN ||
      user.role === Role.PURCHASING;

    if (!canApprove) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Hanya Admin Pusat atau Purchasing yang boleh approve Purchase Order Outlet",
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
            "Purchase Order Outlet tidak ditemukan",
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
            "Purchase Order hanya dapat di-approve saat status DRAFT",
        },
        { status: 400 }
      );
    }

    // =========================
    // HARUS ADA ITEM
    // =========================

    if (purchase.items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Order tidak memiliki barang",
        },
        { status: 400 }
      );
    }

    // =========================
    // APPROVE
    // =========================

    const updated =
      await prisma.$transaction(
        async (tx) => {
          const result =
            await tx.outletPurchase.update({
              where: {
                id: purchaseId,
              },
              data: {
                status:
                  OutletPurchaseStatus.APPROVED,
              },
              include: {
                outlet: true,
                supplier: true,
                items: {
                  include: {
                    barang: true,
                  },
                },
              },
            });

          await tx.history.create({
            data: {
              transactionType: "PURCHASE",
              referenceNumber: result.number,
              description:
                `Approve Purchase Order Outlet ${result.number} - ${result.supplier.name}`,
              userId: user.id,
            },
          });

          return result;
        }
      );

    return NextResponse.json({
      success: true,
      message:
        "Purchase Order Outlet berhasil di-approve",
      data: updated,
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
          "Gagal approve Purchase Order Outlet",
      },
      { status: 500 }
    );
  }
}