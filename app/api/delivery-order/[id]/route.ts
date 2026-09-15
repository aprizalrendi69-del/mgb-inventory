import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// =========================================================
// GET DELIVERY ORDER DETAIL
// =========================================================

export async function GET(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    // =======================================================
    // PARAMETER
    // =======================================================

    const { id } = await context.params;

    const deliveryId = Number(id);

    if (
      !Number.isInteger(deliveryId) ||
      deliveryId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID Delivery Order tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =======================================================
    // GET DELIVERY
    // =======================================================

    const delivery =
      await prisma.delivery.findUnique({
        where: {
          id: deliveryId,
        },

        include: {
          customer: true,

          suratJalan: true,

          items: {
            include: {
              barang: {
                include: {
                  priceSummary: true,
                },
              },
            },
          },
        },
      });

    // =======================================================
    // NOT FOUND
    // =======================================================

    if (!delivery) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Delivery Order tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =======================================================
    // FORMAT ITEMS
    // =======================================================

    const items =
      delivery.items.map((item) => {
        const qty =
          Number(item.qty ?? 0);

        const deliveryPrice =
          Number(item.price ?? 0);

        const summaryPrice =
          Number(
            item.barang?.priceSummary
              ?.lastPrice ?? 0
          );

        // ---------------------------------------------------
        // PRIORITAS HARGA
        //
        // 1. Harga pada DeliveryItem
        // 2. PriceSummary
        // ---------------------------------------------------

        const price =
          deliveryPrice > 0
            ? deliveryPrice
            : summaryPrice;

        const subtotal =
          Number(
            item.subtotal ?? 0
          ) > 0
            ? Number(item.subtotal)
            : qty * price;

        // ===================================================
        // PENTING
        //
        // Field VOID sengaja dikirim secara eksplisit.
        // Jangan dihilangkan.
        // ===================================================

        return {
          id: item.id,

          deliveryId:
            item.deliveryId,

          barangId:
            item.barangId,

          qty,

          price,

          subtotal,

          note:
            item.note ?? null,

          // =================================================
          // VOID DATA
          // =================================================

          voided:
            item.voided === true,

          voidedAt:
            item.voidedAt ?? null,

          voidedById:
            item.voidedById ?? null,

          voidReason:
            item.voidReason ?? null,

          // =================================================
          // BARANG
          // =================================================

          barang: item.barang
            ? {
                id:
                  item.barang.id,

                code:
                  item.barang.code,

                name:
                  item.barang.name,

                unit:
                  item.barang.unit,

                sellingPrice:
                  item.barang
                    .sellingPrice,

                purchasePrice:
                  item.barang
                    .purchasePrice,

                minimumStock:
                  item.barang
                    .minimumStock,
              }
            : null,
        };
      });

    // =======================================================
    // TOTAL NILAI
    //
    // Tetap menghitung semua item agar nilai DO historis
    // tidak berubah hanya karena item di-void.
    // =======================================================

    const total =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum +
          Number(
            item.subtotal ?? 0
          ),
        0
      );

    // =======================================================
    // TOTAL QTY AKTIF
    //
    // Item VOID tidak dihitung.
    // =======================================================

    const activeTotalQty =
      items.reduce(
        (
          sum,
          item
        ) =>
          !item.voided
            ? sum +
              Number(
                item.qty ?? 0
              )
            : sum,
        0
      );

    // =======================================================
    // TOTAL QTY VOID
    // =======================================================

    const voidedTotalQty =
      items.reduce(
        (
          sum,
          item
        ) =>
          item.voided
            ? sum +
              Number(
                item.qty ?? 0
              )
            : sum,
        0
      );

    // =======================================================
    // RESPONSE
    // =======================================================

    return NextResponse.json({
      success: true,

      data: {
        id:
          delivery.id,

        number:
          delivery.number,

        customerId:
          delivery.customerId,

        deliveryDate:
          delivery.deliveryDate,

        status:
          delivery.status,

        totalQty:
          activeTotalQty,

        remarks:
          delivery.remarks,

        customer:
          delivery.customer,

        suratJalan:
          delivery.suratJalan,

        items,

        total,

        activeTotalQty,

        voidedTotalQty,
      },
    });
  } catch (error) {
    console.error(
      "GET DELIVERY ORDER DETAIL ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil Delivery Order",
      },
      {
        status: 500,
      }
    );
  }
}