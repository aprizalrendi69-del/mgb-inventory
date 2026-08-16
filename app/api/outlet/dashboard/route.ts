import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("erp-session");

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        { status: 401 }
      );
    }

    const sessionData = JSON.parse(session.value);

    const user = await prisma.user.findUnique({
      where: {
        id: sessionData.id,
      },
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
            code: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "User tidak ditemukan",
        },
        { status: 404 }
      );
    }

    if (user.role !== "OUTLET_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "Akses khusus admin outlet",
        },
        { status: 403 }
      );
    }

    if (!user.outletId) {
      return NextResponse.json(
        {
          success: false,
          message: "User belum memiliki outlet",
        },
        { status: 400 }
      );
    }

    const outletId = user.outletId;

    const [
      totalPurchase,
      totalDraft,
      totalApproved,
      totalReceived,
      totalReceipt,
      totalStock,
      lowStock,
      recentPurchase,
    ] = await Promise.all([
      prisma.outletPurchase.count({
        where: {
          outletId,
        },
      }),

      prisma.outletPurchase.count({
        where: {
          outletId,
          status: "DRAFT",
        },
      }),

      prisma.outletPurchase.count({
        where: {
          outletId,
          status: "APPROVED",
        },
      }),

      prisma.outletPurchase.count({
        where: {
          outletId,
          status: "RECEIVED",
        },
      }),

      prisma.outletReceipt.count({
        where: {
          outletId,
        },
      }),

      prisma.outletStock.count({
        where: {
          outletId,
        },
      }),

      prisma.outletStock.count({
        where: {
          outletId,
          stock: {
            lte: 0,
          },
        },
      }),

      prisma.outletPurchase.findMany({
        where: {
          outletId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
        select: {
          id: true,
          number: true,
          purchaseDate: true,
          status: true,
          total: true,
          supplier: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      user,
      data: {
        totalPurchase,
        totalDraft,
        totalApproved,
        totalReceived,
        totalReceipt,
        totalStock,
        lowStock,
        recentPurchase,
      },
    });
  } catch (error: any) {
    console.error("OUTLET DASHBOARD ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Gagal mengambil dashboard outlet",
      },
      { status: 500 }
    );
  }
}