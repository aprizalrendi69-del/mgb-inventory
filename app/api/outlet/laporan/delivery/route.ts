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
        id: Number(sessionData.id),
      },
      select: {
        id: true,
        role: true,
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

    // =====================================================
    // OUTLET ADMIN WAJIB PUNYA OUTLET
    // =====================================================

    if (user.role === "OUTLET_ADMIN" && !user.outletId) {
      return NextResponse.json({
        success: true,
        outlet: null,
        data: [],
      });
    }

    // =====================================================
    // FILTER DELIVERY
    // =====================================================
    //
    // LAPORAN DELIVERY OUTLET:
    //
    // HANYA DELIVERY DENGAN STATUS RELEASED
    // YANG DITAMPILKAN.
    //
    // DRAFT  -> TIDAK DITAMPILKAN
    // RELEASED -> DITAMPILKAN
    // DELIVERED -> TIDAK DITAMPILKAN
    // VOID -> TIDAK DITAMPILKAN
    //
    // Untuk OUTLET_ADMIN:
    // outletId selalu berasal dari user login.
    //
    // Untuk ADMIN:
    // dapat melihat seluruh outlet.
    // =====================================================

    const where =
      user.role === "OUTLET_ADMIN"
        ? {
            outletId: user.outletId!,
            status: "RELEASED" as const,
          }
        : {
            status: "RELEASED" as const,
          };

    const deliveries = await prisma.delivery.findMany({
      where,

      orderBy: {
        deliveryDate: "desc",
      },

      include: {
        customer: true,

        outlet: true,

        items: {
          include: {
            barang: true,
          },
        },

        suratJalan: true,
      },
    });

    // =====================================================
    // NORMALISASI DATA DELIVERY
    // =====================================================
    //
    // ITEM VOID TETAP DIKIRIM KE FRONTEND.
    //
    // Tujuannya:
    // - histori item dalam DO tetap lengkap
    // - item VOID dapat diberi tanda VOID
    // - item VOID tidak ikut total qty
    // - item VOID tidak ikut total nilai
    //
    // TIDAK ADA DATA DATABASE YANG DIUBAH.
    // =====================================================

    const data = deliveries.map((delivery) => {
      let total = 0;
      let totalQty = 0;

      const items = delivery.items.map((item) => {
        // =================================================
        // STATUS VOID
        // =================================================

        const voided = Boolean(item.voided);

        // =================================================
        // NORMALISASI HARGA
        // =================================================
        //
        // Prioritas:
        // 1. DeliveryItem.price
        // 2. Barang.sellingPrice
        //
        // Untuk DO lama yang price = 0,
        // tetap dapat menampilkan harga.
        // =================================================

        const price =
          Number(item.price) > 0
            ? Number(item.price)
            : Number(item.barang.sellingPrice ?? 0);

        const qty = Number(item.qty);

        const subtotal = qty * price;

        // =================================================
        // TOTAL HANYA ITEM AKTIF
        // =================================================

        if (!voided) {
          total += subtotal;
          totalQty += qty;
        }

        return {
          id: item.id,

          barangId: item.barangId,

          qty,

          price,

          subtotal,

          note: item.note,

          // =================================================
          // VOID INFORMATION
          // =================================================

          voided,

          voidedAt: item.voidedAt ?? null,

          voidReason: item.voidReason ?? null,

          // =================================================
          // MASTER BARANG
          // =================================================

          barang: {
            id: item.barang.id,

            code: item.barang.code,

            name: item.barang.name,

            unit: item.barang.unit,

            sellingPrice: Number(
              item.barang.sellingPrice ?? 0
            ),

            purchasePrice: Number(
              item.barang.purchasePrice ?? 0
            ),
          },
        };
      });

      return {
        id: delivery.id,

        number: delivery.number,

        deliveryDate: delivery.deliveryDate,

        // Karena query sudah difilter RELEASED,
        // status di laporan ini adalah RELEASED.
        status: delivery.status,

        remarks: delivery.remarks,

        // ===================================================
        // TOTAL AKTIF
        // ===================================================
        //
        // Tidak menggunakan delivery.totalQty secara langsung
        // karena totalQty database bisa masih mencakup item
        // yang kemudian di-VOID.
        // ===================================================

        totalQty,

        total,

        customer: delivery.customer,

        outlet: delivery.outlet,

        suratJalan: delivery.suratJalan,

        items,
      };
    });

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,

      outlet: user.outlet,

      data,
    });
  } catch (error: any) {
    console.error(
      "GET OUTLET DELIVERY REPORT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil laporan Delivery",
      },
      { status: 500 }
    );
  }
}