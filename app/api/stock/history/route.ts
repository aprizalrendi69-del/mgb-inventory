import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const barangId = Number(
      searchParams.get("barangId") || 0
    );

    if (!barangId) {
      return NextResponse.json(
        {
          success: false,
          message: "barangId wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    const barang = await prisma.barang.findUnique({
      where: {
        id: barangId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        unit: true,
        barcode: true,
      },
    });

    if (!barang) {
      return NextResponse.json(
        {
          success: false,
          message: "Barang tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    const cards = await prisma.stockCard.findMany({
      where: {
        barangId,
        warehouse: "MAIN",
      },
      orderBy: [
        {
          trxDate: "desc",
        },
        {
          id: "desc",
        },
      ],
    });

    const data = cards.map((item) => {
      const qtyIn = Number(item.qtyIn || 0);
      const qtyOut = Number(item.qtyOut || 0);

      let type = String(
        item.trxType || ""
      ).toUpperCase();

      let direction:
        | "IN"
        | "OUT"
        | "INFO" = "INFO";

      if (qtyIn > 0) {
        direction = "IN";
      } else if (qtyOut > 0) {
        direction = "OUT";
      }

      let description =
        item.note || "-";

      switch (type) {
        case "RECEIVE":
          description =
            item.note ||
            "Penerimaan barang dari supplier";
          break;

        case "DELIVERY":
        case "DELIVERY_OUT":
          description =
            item.note ||
            "Barang keluar / pengiriman";
          break;

        case "TRANSFER":
        case "TRANSFER_OUT":
          description =
            item.note ||
            "Transfer barang";
          break;

        case "ADJUSTMENT":
          description =
            item.note ||
            "Adjustment stock";
          break;

        case "OPNAME":
        case "STOCK_OPNAME":
          description =
            item.note ||
            "Penyesuaian stock opname";
          break;
      }

      return {
        id: String(item.id),
        date: item.trxDate,
        type,
        direction,
        number:
          item.trxNumber || null,
        outletId: null,
        barangId: item.barangId,
        qty:
          direction === "IN"
            ? qtyIn
            : direction === "OUT"
            ? qtyOut
            : 0,
        stockBefore: null,
        stockAfter: Number(
          item.balance || 0
        ),
        status: null,
        description,
        source: "STOCK_CARD",
        barang,
      };
    });

    /*
     * Stock sebelum transaksi dihitung dari
     * balance transaksi sebelumnya.
     *
     * Karena data disusun DESC, transaksi berikutnya
     * adalah balance sebelum transaksi sekarang.
     */
    for (let i = 0; i < data.length; i++) {
      const current = data[i];

      if (i + 1 < data.length) {
        current.stockBefore =
          data[i + 1].stockAfter;
      } else {
        const qtyIn = current.direction === "IN"
          ? current.qty
          : 0;

        const qtyOut = current.direction === "OUT"
          ? current.qty
          : 0;

        current.stockBefore =
          current.stockAfter -
          qtyIn +
          qtyOut;
      }
    }

    let stockIn = 0;
    let stockOut = 0;
    let informational = 0;

    for (const row of data) {
      if (row.direction === "IN") {
        stockIn += Number(row.qty || 0);
      } else if (row.direction === "OUT") {
        stockOut += Number(row.qty || 0);
      } else {
        informational++;
      }
    }

    return NextResponse.json({
      success: true,
      data,
      summary: {
        total: data.length,
        stockIn,
        stockOut,
        informational,
      },
    });
  } catch (error: any) {
    console.error(
      "GET CENTRAL STOCK HISTORY ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        data: [],
        summary: {
          total: 0,
          stockIn: 0,
          stockOut: 0,
          informational: 0,
        },
        message:
          error?.message ||
          "Gagal mengambil history stock pusat",
      },
      {
        status: 500,
      }
    );
  }
}