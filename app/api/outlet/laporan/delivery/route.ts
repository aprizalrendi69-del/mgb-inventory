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

    if (
      user.role === "OUTLET_ADMIN" &&
      !user.outletId
    ) {
      return NextResponse.json({
        success: true,
        data: [],
        outlet: null,
      });
    }

    // =====================================================
    // FILTER DELIVERY
    // =====================================================

    const where =
      user.role === "OUTLET_ADMIN"
        ? {
            outletId: user.outletId!,
          }
        : undefined;

    const deliveries =
      await prisma.delivery.findMany({
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
    // NORMALISASI HARGA
    // =====================================================
    //
    // DeliveryItem.price dipakai terlebih dahulu.
    //
    // Kalau DO lama masih mempunyai price = 0,
    // gunakan sellingPrice dari master barang.
    //
    // Jadi data lama tetap bisa menampilkan harga.
    // =====================================================

    const data = deliveries.map((delivery) => {
      let total = 0;

      const items = delivery.items.map(
        (item) => {
          const price =
            Number(item.price) > 0
              ? Number(item.price)
              : Number(
                  item.barang.sellingPrice ?? 0
                );

          const subtotal =
            Number(item.qty) * price;

          total += subtotal;

          return {
            id: item.id,
            barangId: item.barangId,
            qty: Number(item.qty),

            price,

            subtotal,

            note: item.note,

            barang: {
              id: item.barang.id,
              code: item.barang.code,
              name: item.barang.name,
              unit: item.barang.unit,
              sellingPrice:
                Number(
                  item.barang.sellingPrice ?? 0
                ),
              purchasePrice:
                Number(
                  item.barang.purchasePrice ?? 0
                ),
            },
          };
        }
      );

      return {
        id: delivery.id,
        number: delivery.number,
        deliveryDate:
          delivery.deliveryDate,
        status: delivery.status,
        remarks: delivery.remarks,
        totalQty:
          Number(delivery.totalQty),
        total,

        customer: delivery.customer,

        outlet: delivery.outlet,

        suratJalan:
          delivery.suratJalan,

        items,
      };
    });

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