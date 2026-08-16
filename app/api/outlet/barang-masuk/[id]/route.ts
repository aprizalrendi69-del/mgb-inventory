import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    // ==========================================
    // CEK SESSION
    // ==========================================

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

    let sessionData: any;

    try {
      sessionData = JSON.parse(session.value);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Session tidak valid",
        },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        id: sessionData.id,
      },
      select: {
        id: true,
        role: true,
        outletId: true,
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

    // ==========================================
    // VALIDASI ROLE
    // ==========================================

    if (
      user.role !== "ADMIN" &&
      user.role !== "OUTLET_ADMIN"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak memiliki akses",
        },
        { status: 403 }
      );
    }

    // ==========================================
    // FILTER OUTLET
    //
    // ADMIN
    // → semua outlet
    //
    // OUTLET_ADMIN
    // → hanya outlet miliknya
    // ==========================================

    const outletFilter =
      user.role === "OUTLET_ADMIN"
        ? {
            outletId: user.outletId ?? -1,
          }
        : {};

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "ID barang masuk tidak valid",
        },
        { status: 400 }
      );
    }

    // ==========================================
    // PURCHASE SUPPLIER
    // ==========================================

    if (id.startsWith("PURCHASE-")) {
      const purchaseId = Number(
        id.replace("PURCHASE-", "")
      );

      if (!purchaseId || Number.isNaN(purchaseId)) {
        return NextResponse.json(
          {
            success: false,
            message: "ID purchase tidak valid",
          },
          { status: 400 }
        );
      }

      const purchase =
        await prisma.outletPurchase.findFirst({
          where: {
            id: purchaseId,
            ...outletFilter,
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

      if (!purchase) {
        return NextResponse.json(
          {
            success: false,
            message: "Purchase Order tidak ditemukan",
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          id: purchase.id,
          sourceId: purchase.id,
          sumber: "PURCHASE",

          nomor: purchase.number,
          tanggal: purchase.purchaseDate,

          status: purchase.status,

          remarks:
            purchase.remarks || null,

          outlet: purchase.outlet
            ? {
                id: purchase.outlet.id,
                code: purchase.outlet.code,
                name: purchase.outlet.name,
              }
            : null,

          supplier: purchase.supplier
            ? {
                id: purchase.supplier.id,
                code: purchase.supplier.code,
                name: purchase.supplier.name,
              }
            : null,

          purchase: {
            id: purchase.id,
            number: purchase.number,
            status: purchase.status,
            purchaseDate:
              purchase.purchaseDate,
            remarks: purchase.remarks,
          },

          items: purchase.items.map(
            (item) => ({
              id: item.id,
              barangId: item.barangId,
              qty: item.qty,
              receivedQty:
                item.receivedQty,
              price: item.price,
              subtotal: item.subtotal,
              barang: item.barang,
            })
          ),
        },
      });
    }

    // ==========================================
    // TRANSFER GUDANG PUSAT
    // ==========================================

    if (id.startsWith("TRANSFER-")) {
      const transferId = Number(
        id.replace("TRANSFER-", "")
      );

      if (!transferId || Number.isNaN(transferId)) {
        return NextResponse.json(
          {
            success: false,
            message: "ID transfer tidak valid",
          },
          { status: 400 }
        );
      }

      const transfer =
        await prisma.outletTransfer.findFirst({
          where: {
            id: transferId,
            ...outletFilter,
          },

          include: {
            outlet: true,
            items: {
              include: {
                barang: true,
              },
            },
          },
        });

      if (!transfer) {
        return NextResponse.json(
          {
            success: false,
            message: "Data transfer tidak ditemukan",
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          id: transfer.id,
          sourceId: transfer.id,
          sumber: "TRANSFER",

          nomor: transfer.number,
          tanggal: transfer.transferDate,

          status: transfer.status,

          remarks: null,

          outlet: transfer.outlet
            ? {
                id: transfer.outlet.id,
                code: transfer.outlet.code,
                name: transfer.outlet.name,
              }
            : null,

          supplier: null,
          purchase: null,

          items: transfer.items.map(
            (item) => {
              const price =
                item.barang.purchasePrice ??
                0;

              return {
                id: item.id,
                barangId: item.barangId,

                qty: item.qty,

                receivedQty:
                  item.receivedQty,

                price,

                subtotal:
                  Number(item.qty) *
                  Number(price),

                barang: item.barang,
              };
            }
          ),
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "Sumber barang masuk tidak dikenali",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error(
      "GET DETAIL OUTLET BARANG MASUK ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil detail barang masuk outlet",
      },
      { status: 500 }
    );
  }
}