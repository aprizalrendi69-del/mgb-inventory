import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/*
 * =========================================================
 * HISTORY STOCK PUSAT
 * =========================================================
 *
 * SUMBER DATA:
 *
 *   StockCard
 *
 * SCOPE:
 *
 *   warehouse = MAIN
 *
 * TIDAK MENGAMBIL:
 *
 *   - OutletStock
 *   - OutletTransfer
 *   - OutletReceipt
 *   - OutletReceiptItem
 *   - OutletStockOut
 *
 * =========================================================
 *
 * ENDPOINT:
 *
 *   GET /api/history
 *
 * FILTER:
 *
 *   ?search=
 *   ?barangId=
 *   ?trxType=
 *   ?dateFrom=
 *   ?dateTo=
 *
 * =========================================================
 */

export async function GET(
  req: NextRequest
) {
  try {
    const { searchParams } =
      new URL(req.url);

    // ======================================================
    // PARAMETER
    // ======================================================

    const search =
      searchParams
        .get("search")
        ?.trim() || "";

    const barangIdParam =
      searchParams
        .get("barangId")
        ?.trim() || "";

    const trxType =
      searchParams
        .get("trxType")
        ?.trim()
        .toUpperCase() || "";

    const dateFrom =
      searchParams
        .get("dateFrom")
        ?.trim() || "";

    const dateTo =
      searchParams
        .get("dateTo")
        ?.trim() || "";

    // ======================================================
    // VALIDATE BARANG ID
    // ======================================================

    let barangId:
      | number
      | undefined = undefined;

    if (barangIdParam) {
      const parsed =
        Number(barangIdParam);

      if (
        Number.isInteger(parsed) &&
        parsed > 0
      ) {
        barangId = parsed;
      }
    }

    // ======================================================
    // VALIDATE DATE
    // ======================================================

    let parsedDateFrom:
      | Date
      | undefined;

    let parsedDateTo:
      | Date
      | undefined;

    if (dateFrom) {
      const date =
        new Date(
          `${dateFrom}T00:00:00`
        );

      if (
        !Number.isNaN(
          date.getTime()
        )
      ) {
        parsedDateFrom = date;
      }
    }

    if (dateTo) {
      const date =
        new Date(
          `${dateTo}T23:59:59.999`
        );

      if (
        !Number.isNaN(
          date.getTime()
        )
      ) {
        parsedDateTo = date;
      }
    }

    // ======================================================
    // WHERE
    // ======================================================

    const where: Prisma.StockCardWhereInput =
      {
        /*
         * ==================================================
         * WAJIB STOCK PUSAT
         * ==================================================
         */

        warehouse: "MAIN",
      };

    // ======================================================
    // FILTER BARANG
    // ======================================================

    if (barangId) {
      where.barangId = barangId;
    }

    // ======================================================
    // FILTER TRANSACTION TYPE
    // ======================================================

    if (trxType) {
      where.trxType = trxType;
    }

    // ======================================================
    // FILTER TANGGAL
    // ======================================================

    if (
      parsedDateFrom ||
      parsedDateTo
    ) {
      where.trxDate = {};

      if (parsedDateFrom) {
        where.trxDate.gte =
          parsedDateFrom;
      }

      if (parsedDateTo) {
        where.trxDate.lte =
          parsedDateTo;
      }
    }

    // ======================================================
    // SEARCH
    // ======================================================
    //
    // Search:
    //
    // - kode barang
    // - nama barang
    // - barcode
    // - nomor transaksi
    // - catatan
    //
    // ======================================================

    if (search) {
      where.OR = [
        {
          barang: {
            code: {
              contains: search,
            },
          },
        },
        {
          barang: {
            name: {
              contains: search,
            },
          },
        },
        {
          barang: {
            barcode: {
              contains: search,
            },
          },
        },
        {
          trxNumber: {
            contains: search,
          },
        },
        {
          note: {
            contains: search,
          },
        },
      ];
    }

    // ======================================================
    // GET STOCK CARD
    // ======================================================

    const stockCards =
      await prisma.stockCard.findMany(
        {
          where,

          include: {
            barang: true,
          },

          orderBy: [
            {
              trxDate: "desc",
            },
            {
              id: "desc",
            },
          ],
        }
      );

    // ======================================================
    // FORMAT RESPONSE
    // ======================================================

    const data =
      stockCards.map(
        (item, index) => {
          const qtyIn =
            Number(
              item.qtyIn ?? 0
            );

          const qtyOut =
            Number(
              item.qtyOut ?? 0
            );

          const balance =
            Number(
              item.balance ?? 0
            );

          const unitPrice =
            Number(
              item.unitPrice ?? 0
            );

          const totalValue =
            Number(
              item.totalValue ?? 0
            );

          /*
           * =================================================
           * TENTUKAN ARAH TRANSAKSI
           * =================================================
           */

          let direction:
            | "IN"
            | "OUT"
            | "OTHER" =
            "OTHER";

          if (
            qtyIn > 0 &&
            qtyOut <= 0
          ) {
            direction = "IN";
          } else if (
            qtyOut > 0 &&
            qtyIn <= 0
          ) {
            direction = "OUT";
          }

          /*
           * =================================================
           * LABEL TRANSAKSI
           * =================================================
           */

          const transactionType =
            item.trxType ||
            "TRANSAKSI";

          /*
           * =================================================
           * DESCRIPTION
           * =================================================
           */

          const description =
            item.note ||
            `${transactionType} ${
              item.barang?.name ??
              "Barang"
            }`;

          return {
            // -----------------------------------------------
            // IDENTITAS
            // -----------------------------------------------

            id: item.id,

            no: index + 1,

            // -----------------------------------------------
            // BARANG
            // -----------------------------------------------

            barangId:
              item.barangId,

            kodeBarang:
              item.barang?.code ??
              "-",

            code:
              item.barang?.code ??
              "-",

            barcode:
              item.barang?.barcode ??
              null,

            barang:
              item.barang?.name ??
              "-",

            namaBarang:
              item.barang?.name ??
              "-",

            satuan:
              item.barang?.unit ??
              "-",

            // -----------------------------------------------
            // TRANSACTION
            // -----------------------------------------------

            transactionType,

            trxType:
              item.trxType,

            tipe:
              item.trxType,

            direction,

            // -----------------------------------------------
            // REFERENCE
            // -----------------------------------------------

            reference:
              item.trxNumber ??
              "-",

            nomor:
              item.trxNumber ??
              "-",

            trxNumber:
              item.trxNumber ??
              "-",

            referenceId:
              item.referenceId ??
              null,

            // -----------------------------------------------
            // WAREHOUSE
            // -----------------------------------------------

            warehouse:
              item.warehouse ??
              "MAIN",

            // -----------------------------------------------
            // STOCK
            // -----------------------------------------------

            qtyIn,

            qtyOut,

            balance,

            // -----------------------------------------------
            // VALUE
            // -----------------------------------------------

            unitPrice,

            totalValue,

            // -----------------------------------------------
            // DESCRIPTION
            // -----------------------------------------------

            note:
              item.note ??
              null,

            description,

            // -----------------------------------------------
            // DATE
            // -----------------------------------------------

            tanggal:
              item.trxDate,

            trxDate:
              item.trxDate,

            createdAt:
              item.createdAt,

            // -----------------------------------------------
            // USER
            // -----------------------------------------------
            //
            // StockCard yang kamu kirim tidak memiliki
            // relasi user.
            //
            // Jangan mengarang user.
            //
            // -----------------------------------------------

            user: null,
          };
        }
      );

    // ======================================================
    // SUMMARY
    // ======================================================

    const total =
      data.length;

    const totalIn =
      data.filter(
        (item) =>
          item.direction === "IN"
      ).length;

    const totalOut =
      data.filter(
        (item) =>
          item.direction === "OUT"
      ).length;

    const totalOther =
      data.filter(
        (item) =>
          item.direction === "OTHER"
      ).length;

    // ======================================================
    // RESPONSE
    // ======================================================

    return NextResponse.json({
      success: true,

      data,

      meta: {
        warehouse: "MAIN",

        outletId: null,

        total,

        totalIn,

        totalOut,

        totalOther,

        filters: {
          search:
            search || null,

          barangId:
            barangId ?? null,

          trxType:
            trxType || null,

          dateFrom:
            dateFrom || null,

          dateTo:
            dateTo || null,
        },
      },
    });
  } catch (error) {
    console.error(
      "GET /api/history ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Gagal mengambil History Stock Pusat",

        error:
          process.env.NODE_ENV ===
          "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      {
        status: 500,
      }
    );
  }
}