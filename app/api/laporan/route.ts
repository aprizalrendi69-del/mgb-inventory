import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const toNumber = (value: unknown): number => {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
};

const toDateString = (value: Date | null | undefined) => {
  if (!value) return null;

  return value instanceof Date && !Number.isNaN(value.getTime())
    ? value.toISOString()
    : null;
};

const errorResponse = (message: string, status = 400) =>
  NextResponse.json(
    {
      success: false,
      message,
      data: [],
      pagination: {
        page: 1,
        limit: 0,
        total: 0,
        totalPages: 0,
      },
    },
    { status }
  );

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    const type = searchParams.get("type")?.trim().toLowerCase();

    const page = Math.max(
      1,
      Math.floor(toNumber(searchParams.get("page") ?? 1))
    );

    const limit = Math.min(
      200,
      Math.max(1, Math.floor(toNumber(searchParams.get("limit") ?? 50)))
    );

    const skip = (page - 1) * limit;

    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const parseDate = (value: string | null, endOfDay = false) => {
      if (!value) return null;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return undefined;
      }

      const date = new Date(
        `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00`
      );

      if (Number.isNaN(date.getTime())) {
        return undefined;
      }

      // Mencegah tanggal yang tidak valid dinormalisasi oleh JavaScript.
      const jakartaDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);
      const actualDate = [
        jakartaDate.getUTCFullYear(),
        String(jakartaDate.getUTCMonth() + 1).padStart(2, "0"),
        String(jakartaDate.getUTCDate()).padStart(2, "0"),
      ].join("-");

      if (actualDate !== value) {
        return undefined;
      }

      return date;
    };

    const from = parseDate(fromParam);
    const to = parseDate(toParam, true);

    if (from === undefined || to === undefined) {
      return errorResponse(
        "Format tanggal tidak valid. Gunakan format YYYY-MM-DD."
      );
    }

    if (from && to && from > to) {
      return errorResponse("Tanggal awal tidak boleh melebihi tanggal akhir.");
    }

    const dateFilter =
      from || to
        ? {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          }
        : undefined;

    // =========================================================
    // STOCK GUDANG PUSAT
    // GET /api/laporan?type=stock
    // =========================================================

    if (type === "stock") {
      const where = {};

      const [total, stock] = await Promise.all([
        prisma.inventory.count(),
        prisma.inventory.findMany({
          where,
          include: {
            barang: true,
          },
          orderBy: {
            id: "desc",
          },
          skip,
          take: limit,
        }),
      ]);

      const data = stock.map((item) => {
        const qty = toNumber(item.stock);

        return {
          id: item.id,
          barangId: item.barangId,
          number: item.barang?.code ?? "-",
          code: item.barang?.code ?? "-",
          name: item.barang?.name ?? "-",
          qty,
          stock: qty,
          averageCost: toNumber(item.averageCost),
          inventoryValue: qty * toNumber(item.averageCost),
          status: qty > 0 ? "ACTIVE" : "LOW_STOCK",
          date: null,
          barang: item.barang,
        };
      });

      return NextResponse.json({
        success: true,
        type,
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        message: data.length
          ? "Data stok gudang pusat berhasil dimuat."
          : "Belum ada data stok gudang pusat.",
      });
    }

    // =========================================================
    // BARANG MASUK / RECEIPT
    // GET /api/laporan?type=barang-masuk
    // =========================================================

    if (type === "barang-masuk") {
      const where = dateFilter
        ? {
            receiptDate: dateFilter,
          }
        : {};

      const [total, receipts] = await Promise.all([
        prisma.receipt.count({ where }),
        prisma.receipt.findMany({
          where,
          include: {
            supplier: true,
            purchase: true,
            items: {
              include: {
                barang: true,
              },
            },
          },
          orderBy: {
            receiptDate: "desc",
          },
          skip,
          take: limit,
        }),
      ]);

      const data = receipts.flatMap((receipt) =>
        receipt.items.map((item) => ({
          id: `${receipt.id}-${item.id}`,
          receiptId: receipt.id,
          itemId: item.id,
          purchaseId: receipt.purchaseId,
          number: receipt.number,
          invoiceNumber: receipt.invoiceNumber ?? "-",
          name: item.barang?.name ?? "-",
          code: item.barang?.code ?? "-",
          qty: toNumber(item.qty),
          price: toNumber(item.price),
          subtotal: toNumber(item.subtotal),
          status: "RECEIVED",
          date: toDateString(receipt.receiptDate),
          remarks: receipt.remarks ?? "",
          barang: item.barang,
          supplier: receipt.supplier,
          purchase: receipt.purchase,
        }))
      );

      return NextResponse.json({
        success: true,
        type,
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        message: data.length
          ? "Data penerimaan barang berhasil dimuat."
          : "Tidak ada penerimaan barang pada periode ini.",
      });
    }

    // =========================================================
    // BARANG KELUAR / DELIVERY
    // GET /api/laporan?type=barang-keluar
    // =========================================================

    if (type === "barang-keluar") {
      const where = dateFilter
        ? {
            deliveryDate: dateFilter,
          }
        : {};

      const [total, deliveries] = await Promise.all([
        prisma.delivery.count({ where }),
        prisma.delivery.findMany({
          where,
          include: {
            customer: true,
            outlet: true,
            items: {
              where: {
                voided: false,
              },
              include: {
                barang: true,
              },
            },
          },
          orderBy: {
            deliveryDate: "desc",
          },
          skip,
          take: limit,
        }),
      ]);

      const data = deliveries.flatMap((delivery) =>
        delivery.items.map((item) => ({
          id: `${delivery.id}-${item.id}`,
          deliveryId: delivery.id,
          itemId: item.id,
          number: delivery.number,
          name: item.barang?.name ?? "-",
          code: item.barang?.code ?? "-",
          qty: toNumber(item.qty),
          price: toNumber(item.price),
          subtotal: toNumber(item.subtotal),
          status: delivery.status,
          date: toDateString(delivery.deliveryDate),
          remarks: delivery.remarks ?? "",
          outlet: delivery.outlet,
          customer: delivery.customer,
          barang: item.barang,
        }))
      );

      return NextResponse.json({
        success: true,
        type,
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        message: data.length
          ? "Data barang keluar berhasil dimuat."
          : "Tidak ada barang keluar pada periode ini.",
      });
    }

    // =========================================================
    // PURCHASE ORDER GUDANG PUSAT
    // GET /api/laporan?type=purchase
    // =========================================================

    if (type === "purchase") {
      const where = dateFilter
        ? {
            purchaseDate: dateFilter,
          }
        : {};

      const [total, purchases] = await Promise.all([
        prisma.purchase.count({ where }),
        prisma.purchase.findMany({
          where,
          include: {
            supplier: true,
            items: {
              include: {
                barang: true,
              },
            },
            receipts: true,
            payable: true,
          },
          orderBy: {
            purchaseDate: "desc",
          },
          skip,
          take: limit,
        }),
      ]);

      const data = purchases.flatMap((po) =>
        po.items.map((item) => ({
          id: `${po.id}-${item.id}`,
          purchaseId: po.id,
          itemId: item.id,
          number: po.number,
          invoiceNumber: po.invoiceNumber ?? "-",
          name: item.barang?.name ?? "-",
          code: item.barang?.code ?? "-",
          qty: toNumber(item.qty),
          receivedQty: toNumber(item.receivedQty),
          remainingQty: Math.max(
            0,
            toNumber(item.qty) - toNumber(item.receivedQty)
          ),
          price: toNumber(item.price),
          subtotal: toNumber(item.subtotal),
          discount: toNumber(item.discount),
          tax: toNumber(item.tax),
          total: toNumber(item.total),
          status: po.status,
          paymentMethod: po.paymentMethod,
          date: toDateString(po.purchaseDate),
          supplier: po.supplier,
          barang: item.barang,
          purchase: {
            id: po.id,
            number: po.number,
            status: po.status,
            purchaseDate: toDateString(po.purchaseDate),
            subtotal: toNumber(po.subtotal),
            discount: toNumber(po.discount),
            tax: toNumber(po.tax),
            total: toNumber(po.total),
            paymentMethod: po.paymentMethod,
            invoiceNumber: po.invoiceNumber,
            notes: po.notes,
          },
          receipts: po.receipts,
          payable: po.payable,
        }))
      );

      return NextResponse.json({
        success: true,
        type,
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        message: data.length
          ? "Data purchase order berhasil dimuat."
          : "Tidak ada purchase order pada periode ini.",
      });
    }

    // =========================================================
    // JENIS LAPORAN TIDAK DIKENALI
    // =========================================================

    return errorResponse(
      "Jenis laporan tidak ditemukan. Gunakan type=stock, barang-masuk, barang-keluar, atau purchase."
    );
  } catch (error) {
    console.error("[API LAPORAN] GET gagal:", error);

    const message =
      error instanceof Error ? error.message : "Kesalahan tidak diketahui.";

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil laporan.",
        detail:
          process.env.NODE_ENV === "development"
            ? message
            : undefined,
        data: [],
        pagination: {
          page: 1,
          limit: 0,
          total: 0,
          totalPages: 0,
        },
      },
      { status: 500 }
    );
  }
}