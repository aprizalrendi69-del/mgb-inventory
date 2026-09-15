import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const customerIdParam = searchParams.get("customerId");

    const where: any = {};

    // =========================================================
    // FILTER TANGGAL
    // =========================================================
    if (start && end) {
      where.deliveryDate = {
        gte: new Date(`${start}T00:00:00`),
        lte: new Date(`${end}T23:59:59`),
      };
    }

    // =========================================================
    // FILTER CUSTOMER
    // =========================================================
    if (
      customerIdParam &&
      customerIdParam !== "ALL"
    ) {
      const customerId = Number(customerIdParam);

      if (Number.isInteger(customerId) && customerId > 0) {
        where.customerId = customerId;
      }
    }

    // =========================================================
    // AMBIL DELIVERY
    // =========================================================
    const data = await prisma.delivery.findMany({
      where,

      orderBy: {
        deliveryDate: "desc",
      },

      include: {
        customer: true,

        items: {
          include: {
            barang: true,
          },
        },
      },
    });

    // =========================================================
    // AMBIL SEMUA BARANG ID
    // =========================================================
    const barangIds = [
      ...new Set(
        data.flatMap((delivery) =>
          delivery.items.map((item) => item.barangId)
        )
      ),
    ];

    // =========================================================
    // AMBIL HARGA TERAKHIR DARI PRICE SUMMARY
    // =========================================================
    const priceSummaries =
      barangIds.length > 0
        ? await prisma.priceSummary.findMany({
            where: {
              barangId: {
                in: barangIds,
              },
            },

            select: {
              barangId: true,
              lastPrice: true,
            },
          })
        : [];

    // =========================================================
    // PRICE MAP
    // =========================================================
    const priceMap = new Map<number, number>();

    priceSummaries.forEach((item) => {
      priceMap.set(
        item.barangId,
        Number(item.lastPrice ?? 0)
      );
    });

    // =========================================================
    // TOTAL
    // =========================================================
    let totalQty = 0;
    let totalNominal = 0;

    // =========================================================
    // FORMAT RESULT
    // =========================================================
    const result = data.map((delivery) => {
      const items = delivery.items.map((item) => {
        const qty = Number(item.qty ?? 0);

        const deliveryPrice = Number(
          item.price ?? 0
        );

        const summaryPrice = Number(
          priceMap.get(item.barangId) ?? 0
        );

        const sellingPrice = Number(
          item.barang?.sellingPrice ?? 0
        );

        // =====================================================
        // PRIORITAS HARGA
        // 1. Harga transaksi
        // 2. PriceSummary.lastPrice
        // 3. Harga jual barang
        // =====================================================
        const harga =
          deliveryPrice > 0
            ? deliveryPrice
            : summaryPrice > 0
            ? summaryPrice
            : sellingPrice;

        // =====================================================
        // SUBTOTAL
        // =====================================================
        const originalSubtotal = Number(
          item.subtotal ?? 0
        );

        const subtotal =
          deliveryPrice > 0 &&
          originalSubtotal > 0
            ? originalSubtotal
            : qty * harga;

        totalQty += qty;
        totalNominal += subtotal;

        return {
          id: item.id,

          barangId: item.barangId,

          code: item.barang?.code ?? "-",

          name: item.barang?.name ?? "-",

          unit: item.barang?.unit ?? "-",

          qty,

          price: harga,

          subtotal,
        };
      });

      return {
        id: delivery.id,

        number: delivery.number,

        deliveryDate: delivery.deliveryDate,

        status: delivery.status,

        customer: {
          id: delivery.customer?.id ?? null,

          name: delivery.customer?.name ?? "-",
        },

        totalQty: items.reduce(
          (sum, item) => sum + item.qty,
          0
        ),

        totalNominal: items.reduce(
          (sum, item) => sum + item.subtotal,
          0
        ),

        items,
      };
    });

    // =========================================================
    // CUSTOMER FILTER INFO
    // =========================================================
    let selectedCustomer = null;

    if (
      customerIdParam &&
      customerIdParam !== "ALL"
    ) {
      const customerId = Number(customerIdParam);

      if (
        Number.isInteger(customerId) &&
        customerId > 0
      ) {
        const customer = data.find(
          (delivery) =>
            delivery.customer?.id === customerId
        )?.customer;

        if (customer) {
          selectedCustomer = {
            id: customer.id,
            name: customer.name,
          };
        }
      }
    }

    // =========================================================
    // RESPONSE
    // =========================================================
    return NextResponse.json({
      success: true,

      totalTransaksi: result.length,

      totalQty,

      totalNominal,

      filter: {
        start: start || null,
        end: end || null,
        customerId:
          customerIdParam &&
          customerIdParam !== "ALL"
            ? Number(customerIdParam)
            : null,
        customerName:
          selectedCustomer?.name ?? "Semua Customer",
      },

      data: result,
    });
  } catch (error) {
    console.error(
      "LAPORAN BARANG KELUAR ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Gagal mengambil laporan barang keluar",
      },
      {
        status: 500,
      }
    );
  }
}