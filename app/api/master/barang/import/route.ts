import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { prisma } from "@/lib/prisma";

/*
 * =========================================================
 * NORMALISASI NAMA BARANG
 * =========================================================
 */

function normalizeName(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\u00A0/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("id-ID");
}

/*
 * =========================================================
 * NORMALISASI KODE
 * =========================================================
 */

function normalizeCode(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\u00A0/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/*
 * =========================================================
 * NORMALISASI SATUAN
 * =========================================================
 */

function normalizeUnit(value: unknown): string {
  return (
    String(value ?? "")
      .normalize("NFKC")
      .replace(/\u00A0/g, " ")
      .trim()
      .replace(/\s+/g, " ") || "PCS"
  );
}

/*
 * =========================================================
 * NORMALISASI BARCODE
 * =========================================================
 */

function normalizeBarcode(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\u00A0/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/*
 * =========================================================
 * TYPE
 * =========================================================
 */

type ImportError = {
  row: number;
  code?: string;
  name?: string;
  message: string;
};

type RemovedDetail = {
  id: number;
  code: string;
  name: string;
  message: string;
};

type PreservedDetail = {
  id: number;
  code: string;
  name: string;
  message: string;
};

type BarangMapItem = {
  id: number;
  code: string;
  name: string;
  source: string;
  active: boolean;
  barcode?: string | null;
};

/*
 * =========================================================
 * CEK BARANG SUDAH DIGUNAKAN / MASIH MEMPUNYAI RELASI
 * =========================================================
 *
 * Barang hanya boleh dihapus jika:
 *
 * 1. stock === 0
 * 2. tidak mempunyai relasi/history apa pun
 *
 * Kita sengaja memeriksa relasi satu per satu.
 *
 * Jangan hanya mengandalkan foreign key error karena
 * beberapa relasi pada schema dapat menggunakan cascade.
 *
 * =========================================================
 */

async function inspectBarangUsage(
  db: typeof prisma,
  barangId: number
) {
  const barang =
    await db.barang.findUnique({
      where: {
        id: barangId,
      },

      select: {
        id: true,
        code: true,
        name: true,
        source: true,
        stock: true,

        /*
         * ===================================================
         * CENTRAL / INVENTORY RELATIONS
         * ===================================================
         */

        adjustmentItems: {
          select: {
            id: true,
          },
          take: 1,
        },

        batches: {
          select: {
            id: true,
          },
          take: 1,
        },

        batchStocks: {
          select: {
            id: true,
          },
          take: 1,
        },

        deliveryItems: {
          select: {
            id: true,
          },
          take: 1,
        },

        inventory: {
          select: {
            id: true,
          },
        },

        MasterHarga: {
          select: {
            id: true,
          },
          take: 1,
        },

        priceSummary: {
          select: {
            id: true,
          },
        },

        mutationStocks: {
          select: {
            id: true,
          },
          take: 1,
        },

        purchaseItems: {
          select: {
            id: true,
          },
          take: 1,
        },

        receiptItems: {
          select: {
            id: true,
          },
          take: 1,
        },

        stockCards: {
          select: {
            id: true,
          },
          take: 1,
        },

        stockMutations: {
          select: {
            id: true,
          },
          take: 1,
        },

        stockOpnameHistory: {
          select: {
            id: true,
          },
          take: 1,
        },

        stockOpnameItems: {
          select: {
            id: true,
          },
          take: 1,
        },

        /*
         * ===================================================
         * OUTLET / DISTRIBUTION RELATIONS
         * ===================================================
         */

        outletPurchaseItems: {
          select: {
            id: true,
          },
          take: 1,
        },

        outletReceiptItems: {
          select: {
            id: true,
          },
          take: 1,
        },

        outletStocks: {
          select: {
            id: true,
          },
          take: 1,
        },

        outletTransferItems: {
          select: {
            id: true,
          },
          take: 1,
        },

        outletBarang: {
          select: {
            id: true,
          },
          take: 1,
        },

        outletStockOuts: {
          select: {
            id: true,
          },
          take: 1,
        },

        /*
         * ===================================================
         * POS / RECIPE / MANUFACTURE
         * ===================================================
         */

        outletSaleItems: {
          select: {
            id: true,
          },
          take: 1,
        },

        recipeOutputs: {
          select: {
            id: true,
          },
          take: 1,
        },

        productCKOutputs: {
          select: {
            id: true,
          },
        },

        recipeItems: {
          select: {
            id: true,
          },
          take: 1,
        },

        manufactureOrderItems: {
          select: {
            id: true,
          },
          take: 1,
        },

        stockWastes: {
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

  if (!barang) {
    return {
      exists: false,
      canDelete: false,
      reason:
        "Barang tidak ditemukan",
    };
  }

  /*
   * =======================================================
   * STOCK
   * =======================================================
   */

  if (
    Number(barang.stock || 0) !== 0
  ) {
    return {
      exists: true,
      canDelete: false,
      reason:
        `Stock masih ${barang.stock}. Barang tidak boleh dihapus.`,
    };
  }

  /*
   * =======================================================
   * CHECK RELATION
   * =======================================================
   */

  const relationChecks: Array<{
    label: string;
    used: boolean;
  }> = [
    {
      label: "Adjustment",
      used:
        barang.adjustmentItems.length >
        0,
    },

    {
      label: "Batch",
      used:
        barang.batches.length >
        0,
    },

    {
      label: "Batch Stock",
      used:
        barang.batchStocks.length >
        0,
    },

    {
      label: "Delivery",
      used:
        barang.deliveryItems.length >
        0,
    },

    {
      label: "Inventory",
      used:
        !!barang.inventory,
    },

    {
      label: "Master Harga",
      used:
        barang.MasterHarga.length >
        0,
    },

    {
      label: "Price Summary",
      used:
        !!barang.priceSummary,
    },

    {
      label: "Mutation Stock",
      used:
        barang.mutationStocks.length >
        0,
    },

    {
      label: "Purchase",
      used:
        barang.purchaseItems.length >
        0,
    },

    {
      label: "Receipt",
      used:
        barang.receiptItems.length >
        0,
    },

    {
      label: "Stock Card",
      used:
        barang.stockCards.length >
        0,
    },

    {
      label: "Stock Mutation",
      used:
        barang.stockMutations.length >
        0,
    },

    {
      label: "Stock Opname History",
      used:
        barang.stockOpnameHistory.length >
        0,
    },

    {
      label: "Stock Opname Item",
      used:
        barang.stockOpnameItems.length >
        0,
    },

    {
      label: "Outlet Purchase",
      used:
        barang.outletPurchaseItems.length >
        0,
    },

    {
      label: "Outlet Receipt",
      used:
        barang.outletReceiptItems.length >
        0,
    },

    {
      label: "Outlet Stock",
      used:
        barang.outletStocks.length >
        0,
    },

    {
      label: "Outlet Transfer",
      used:
        barang.outletTransferItems.length >
        0,
    },

    {
      label: "Outlet Barang",
      used:
        barang.outletBarang.length >
        0,
    },

    {
      label: "Outlet Stock Out",
      used:
        barang.outletStockOuts.length >
        0,
    },

    {
      label: "Outlet Sale",
      used:
        barang.outletSaleItems.length >
        0,
    },

    {
      label: "Recipe Output",
      used:
        barang.recipeOutputs.length >
        0,
    },

    {
      label: "Product CK",
      used:
        !!barang.productCKOutputs,
    },

    {
      label: "Recipe Item",
      used:
        barang.recipeItems.length >
        0,
    },

    {
      label: "Manufacture",
      used:
        barang.manufactureOrderItems.length >
        0,
    },

    {
      label: "Stock Waste",
      used:
        barang.stockWastes.length >
        0,
    },
  ];

  const usedRelation =
    relationChecks.find(
      (item) => item.used
    );

  if (usedRelation) {
    return {
      exists: true,
      canDelete: false,
      reason:
        `Mempunyai histori/relasi ${usedRelation.label}. Barang dipertahankan.`,
    };
  }

  /*
   * =======================================================
   * AMAN DIHAPUS
   * =======================================================
   */

  return {
    exists: true,
    canDelete: true,
    reason:
      "Tidak mempunyai stock maupun histori/relasi.",
  };
}

/*
 * =========================================================
 * POST - IMPORT MASTER BARANG
 * =========================================================
 *
 * FLOW FINAL:
 *
 * =========================================================
 *
 * A. BACA EXCEL
 *
 * B. PROSES SETIAP BARANG EXCEL
 *
 *    CODE SAMA:
 *
 *      CENTRAL
 *        -> UPDATE ID YANG SAMA
 *
 *      OUTLET
 *        -> SKIP
 *
 *    CODE BARU:
 *
 *      NAMA CENTRAL SUDAH ADA
 *        -> SKIP
 *
 *      NAMA OUTLET SUDAH ADA
 *        -> SKIP
 *
 *      BENAR-BENAR BARU
 *        -> CREATE CENTRAL
 *
 * C. SETELAH EXCEL SELESAI
 *
 *    CARI SEMUA BARANG CENTRAL LAMA
 *    YANG KODENYA TIDAK ADA DI EXCEL.
 *
 *    JIKA:
 *
 *      SUDAH DIPAKAI / ADA RELASI
 *        -> PERTAHANKAN
 *
 *      STOCK > 0
 *        -> PERTAHANKAN
 *
 *      BELUM PERNAH DIPAKAI
 *      + STOCK = 0
 *        -> HAPUS
 *
 * =========================================================
 *
 * IMPORTANT:
 *
 * Tidak ada prisma migrate.
 * Tidak ada db push.
 * Tidak ada reset.
 * Tidak ada delete histori transaksi.
 *
 * =========================================================
 */

export async function POST(
  req: NextRequest
) {
  try {
    /*
     * =====================================================
     * AMBIL FILE
     * =====================================================
     */

    const formData =
      await req.formData();

    const file =
      formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "File Excel tidak ditemukan",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * VALIDASI EXTENSION
     * =====================================================
     */

    const fileName =
      file.name.toLowerCase();

    if (
      !fileName.endsWith(".xlsx") &&
      !fileName.endsWith(".xls")
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "File harus berformat Excel (.xlsx atau .xls)",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * BACA EXCEL
     * =====================================================
     */

    const buffer =
      Buffer.from(
        await file.arrayBuffer()
      );

    const workbook =
      XLSX.read(buffer, {
        type: "buffer",
      });

    if (
      !workbook.SheetNames.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Excel tidak memiliki sheet",
        },
        {
          status: 400,
        }
      );
    }

    const sheet =
      workbook.Sheets[
        workbook.SheetNames[0]
      ];

    const rows =
      XLSX.utils.sheet_to_json<any>(
        sheet,
        {
          defval: "",
        }
      );

    if (!rows.length) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Excel kosong",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * LOAD SEMUA BARANG
     * =====================================================
     */

    const existingBarang =
      await prisma.barang.findMany({
        select: {
          id: true,
          code: true,
          barcode: true,
          name: true,
          category: true,
          unit: true,
          baseUnit: true,
          conversionRate: true,
          minimumStock: true,
          stock: true,
          purchasePrice: true,
          sellingPrice: true,
          hasExpired: true,
          active: true,
          expiredWarning: true,
          source: true,
          sourceOutletId: true,
        },
      });

    /*
     * =====================================================
     * MAP KODE
     * =====================================================
     */

    const existingCodeMap =
      new Map<
        string,
        BarangMapItem
      >();

    for (
      const item of existingBarang
    ) {
      const key =
        normalizeCode(
          item.code
        );

      if (!key) continue;

      if (
        !existingCodeMap.has(
          key
        )
      ) {
        existingCodeMap.set(
          key,
          {
            id: item.id,
            code: item.code,
            name: item.name,
            source:
              String(
                item.source
              ),
            active:
              item.active,
            barcode:
              item.barcode,
          }
        );
      }
    }

    /*
     * =====================================================
     * MAP NAMA CENTRAL
     * =====================================================
     */

    const existingCentralNameMap =
      new Map<
        string,
        BarangMapItem
      >();

    for (
      const item of existingBarang
    ) {
      if (
        String(
          item.source
        ) !== "CENTRAL"
      ) {
        continue;
      }

      const key =
        normalizeName(
          item.name
        );

      if (!key) continue;

      if (
        !existingCentralNameMap.has(
          key
        )
      ) {
        existingCentralNameMap.set(
          key,
          {
            id: item.id,
            code: item.code,
            name: item.name,
            source: "CENTRAL",
            active:
              item.active,
            barcode:
              item.barcode,
          }
        );
      }
    }

    /*
     * =====================================================
     * MAP NAMA OUTLET
     * =====================================================
     */

    const existingOutletNameMap =
      new Map<
        string,
        BarangMapItem
      >();

    for (
      const item of existingBarang
    ) {
      if (
        String(
          item.source
        ) !== "OUTLET"
      ) {
        continue;
      }

      const key =
        normalizeName(
          item.name
        );

      if (!key) continue;

      if (
        !existingOutletNameMap.has(
          key
        )
      ) {
        existingOutletNameMap.set(
          key,
          {
            id: item.id,
            code: item.code,
            name: item.name,
            source: "OUTLET",
            active:
              item.active,
            barcode:
              item.barcode,
          }
        );
      }
    }

    /*
     * =====================================================
     * MAP BARCODE
     * =====================================================
     */

    const existingBarcodeMap =
      new Map<
        string,
        BarangMapItem
      >();

    for (
      const item of existingBarang
    ) {
      const barcode =
        normalizeBarcode(
          item.barcode
        );

      if (!barcode) {
        continue;
      }

      const key =
        barcode.toLowerCase();

      if (
        !existingBarcodeMap.has(
          key
        )
      ) {
        existingBarcodeMap.set(
          key,
          {
            id: item.id,
            code: item.code,
            name: item.name,
            source:
              String(
                item.source
              ),
            active:
              item.active,
            barcode:
              item.barcode,
          }
        );
      }
    }

    /*
     * =====================================================
     * TRACK EXCEL
     * =====================================================
     */

    const processedExcelCodes =
      new Set<string>();

    const processedExcelNames =
      new Set<string>();

    /*
     * =====================================================
     * COUNTER
     * =====================================================
     */

    let baru = 0;
    let update = 0;
    let dilewati = 0;
    let gagal = 0;
    let dihapus = 0;
    let dipertahankan = 0;

    /*
     * =====================================================
     * DETAIL
     * =====================================================
     */

    const skippedDetails: ImportError[] =
      [];

    const failedDetails: ImportError[] =
      [];

    const removedDetails: RemovedDetail[] =
      [];

    const preservedDetails: PreservedDetail[] =
      [];

    /*
     * =====================================================
     * LOOP EXCEL
     * =====================================================
     */

    for (
      let index = 0;
      index < rows.length;
      index++
    ) {
      const row =
        rows[index];

      /*
       * Header Excel = baris 1
       * Data pertama = baris 2
       */

      const nomorBaris =
        index + 2;

      /*
       * ===================================================
       * AMBIL DATA
       * ===================================================
       */

      const kodeRaw =
        row["Kode Barang"] ??
        row["Kode"] ??
        row["kode"] ??
        row["code"] ??
        "";

      const namaRaw =
        row["Nama Barang"] ??
        row["Nama"] ??
        row["nama"] ??
        row["name"] ??
        "";

      const kategoriRaw =
        row["Kategori"] ??
        row["kategori"] ??
        row["Category"] ??
        row["category"] ??
        "";

      const satuanRaw =
        row["Satuan"] ??
        row["Unit"] ??
        row["satuan"] ??
        row["unit"] ??
        "PCS";

      const barcodeRaw =
        row["Barcode"] ??
        row["barcode"] ??
        row["BARCODE"] ??
        "";

      /*
       * ===================================================
       * NORMALISASI
       * ===================================================
       */

      const kode =
        normalizeCode(
          kodeRaw
        );

      const nama =
        String(
          namaRaw ?? ""
        )
          .normalize("NFKC")
          .replace(
            /\u00A0/g,
            " "
          )
          .trim()
          .replace(
            /\s+/g,
            " "
          );

      const namaKey =
        normalizeName(
          nama
        );

      const kategori =
        String(
          kategoriRaw ?? ""
        )
          .normalize("NFKC")
          .replace(
            /\u00A0/g,
            " "
          )
          .trim()
          .replace(
            /\s+/g,
            " "
          );

      const satuan =
        normalizeUnit(
          satuanRaw
        );

      const barcodeExcel =
        normalizeBarcode(
          barcodeRaw
        );

      /*
       * ===================================================
       * VALIDASI WAJIB
       * ===================================================
       */

      if (
        !kode ||
        !nama
      ) {
        gagal++;

        failedDetails.push({
          row: nomorBaris,
          code:
            kode ||
            undefined,
          name:
            nama ||
            undefined,
          message:
            "Kode atau Nama Barang kosong",
        });

        continue;
      }

      /*
       * ===================================================
       * DUPLIKAT KODE DI EXCEL
       * ===================================================
       */

      if (
        processedExcelCodes.has(
          kode
        )
      ) {
        dilewati++;

        skippedDetails.push({
          row: nomorBaris,
          code: kode,
          name: nama,
          message:
            "Kode barang duplikat di dalam file Excel",
        });

        continue;
      }

      /*
       * ===================================================
       * DUPLIKAT NAMA DI EXCEL
       * ===================================================
       */

      if (
        processedExcelNames.has(
          namaKey
        )
      ) {
        dilewati++;

        skippedDetails.push({
          row: nomorBaris,
          code: kode,
          name: nama,
          message:
            "Nama barang duplikat di dalam file Excel",
        });

        continue;
      }

      /*
       * Tandai Excel sudah diproses.
       */

      processedExcelCodes.add(
        kode
      );

      processedExcelNames.add(
        namaKey
      );

      try {
        /*
         * =================================================
         * 1. CEK KODE
         * =================================================
         */

        const existingByCode =
          existingCodeMap.get(
            kode
          );

        if (
          existingByCode
        ) {
          /*
           * -------------------------------------------------
           * KODE MILIK OUTLET
           * -------------------------------------------------
           */

          if (
            existingByCode.source ===
            "OUTLET"
          ) {
            dilewati++;

            skippedDetails.push({
              row: nomorBaris,
              code: kode,
              name: nama,
              message:
                `Kode ${kode} sudah digunakan oleh barang OUTLET "${existingByCode.name}". Barang OUTLET tidak disentuh oleh import master pusat.`,
            });

            continue;
          }

          /*
           * -------------------------------------------------
           * KODE MILIK CENTRAL
           * -------------------------------------------------
           */

          const existing =
            existingBarang.find(
              (item) =>
                item.id ===
                existingByCode.id
            );

          if (!existing) {
            gagal++;

            failedDetails.push({
              row: nomorBaris,
              code: kode,
              name: nama,
              message:
                "Data barang berdasarkan kode tidak ditemukan",
            });

            continue;
          }

          /*
           * =================================================
           * BARCODE
           * =================================================
           */

          const barcodeToUse =
            barcodeExcel ||
            existing.barcode ||
            kode;

          const barcodeKey =
            barcodeToUse.toLowerCase();

          const existingBarcode =
            existingBarcodeMap.get(
              barcodeKey
            );

          if (
            existingBarcode &&
            existingBarcode.id !==
              existing.id
          ) {
            dilewati++;

            skippedDetails.push({
              row: nomorBaris,
              code: kode,
              name: nama,
              message:
                `Barcode "${barcodeToUse}" sudah digunakan oleh barang "${existingBarcode.name}" dengan kode ${existingBarcode.code}.`,
            });

            continue;
          }

          /*
           * =================================================
           * UPDATE CENTRAL
           * =================================================
           *
           * ID TETAP.
           *
           * Stock tidak disentuh.
           * BaseUnit tidak disentuh.
           * ConversionRate tidak disentuh.
           * Purchase history tidak disentuh.
           * Relasi tidak disentuh.
           *
           * Nama boleh mengikuti Excel karena
           * Excel merupakan master terbaru.
           */

          await prisma.barang.update({
            where: {
              id:
                existing.id,
            },

            data: {
              code:
                existing.code,

              barcode:
                barcodeToUse,

              name:
                nama,

              category:
                kategori ||
                null,

              unit:
                satuan ||
                "PCS",

              /*
               * Jangan mengubah:
               *
               * stock
               * baseUnit
               * conversionRate
               * minimumStock
               * purchasePrice
               * sellingPrice
               *
               * Import master hanya mengganti
               * informasi master dasar.
               */

              source:
                "CENTRAL",

              sourceOutletId:
                null,

              /*
               * Kalau barang sebelumnya inactive
               * dan masuk kembali ke Excel,
               * aktifkan kembali.
               */

              active:
                true,
            },
          });

          /*
           * =================================================
           * UPDATE CACHE
           * =================================================
           */

          const cacheItem: BarangMapItem =
            {
              id:
                existing.id,
              code:
                existing.code,
              name:
                nama,
              source:
                "CENTRAL",
              active:
                true,
              barcode:
                barcodeToUse,
            };

          existingCentralNameMap.set(
            namaKey,
            cacheItem
          );

          existingCodeMap.set(
            kode,
            cacheItem
          );

          existingBarcodeMap.set(
            barcodeKey,
            cacheItem
          );

          update++;

          continue;
        }

        /*
         * =================================================
         * 2. KODE BARU
         * =================================================
         *
         * Cari nama CENTRAL.
         */

        const existingByCentralName =
          existingCentralNameMap.get(
            namaKey
          );

        if (
          existingByCentralName
        ) {
          dilewati++;

          skippedDetails.push({
            row: nomorBaris,
            code: kode,
            name: nama,
            message:
              `Nama "${nama}" sudah digunakan oleh barang CENTRAL dengan kode ${existingByCentralName.code}. Kode Excel ${kode} dilewati agar tidak membuat barang duplikat.`,
          });

          continue;
        }

        /*
         * =================================================
         * 3. CEK NAMA OUTLET
         * =================================================
         */

        const existingByOutletName =
          existingOutletNameMap.get(
            namaKey
          );

        if (
          existingByOutletName
        ) {
          dilewati++;

          skippedDetails.push({
            row: nomorBaris,
            code: kode,
            name: nama,
            message:
              `Nama "${nama}" sudah digunakan oleh barang OUTLET dengan kode ${existingByOutletName.code}. Barang OUTLET tidak diubah dan tidak dibuat ulang sebagai CENTRAL.`,
          });

          continue;
        }

        /*
         * =================================================
         * 4. BARANG BARU
         * =================================================
         */

        const barcodeToCreate =
          barcodeExcel ||
          kode;

        const barcodeKey =
          barcodeToCreate.toLowerCase();

        const existingBarcode =
          existingBarcodeMap.get(
            barcodeKey
          );

        if (
          existingBarcode
        ) {
          dilewati++;

          skippedDetails.push({
            row: nomorBaris,
            code: kode,
            name: nama,
            message:
              `Barcode "${barcodeToCreate}" sudah digunakan oleh barang "${existingBarcode.name}" dengan kode ${existingBarcode.code}.`,
          });

          continue;
        }

        /*
         * =================================================
         * CREATE CENTRAL
         * =================================================
         */

        const created =
          await prisma.barang.create({
            data: {
              code:
                kode,

              barcode:
                barcodeToCreate,

              name:
                nama,

              category:
                kategori ||
                null,

              unit:
                satuan ||
                "PCS",

              /*
               * Barang baru mulai
               * dari stock 0.
               */

              stock:
                0,

              minimumStock:
                0,

              purchasePrice:
                0,

              sellingPrice:
                0,

              hasExpired:
                false,

              active:
                true,

              source:
                "CENTRAL",

              sourceOutletId:
                null,
            },
          });

        /*
         * =================================================
         * CACHE CREATE
         * =================================================
         */

        const cacheItem: BarangMapItem =
          {
            id:
              created.id,
            code:
              created.code,
            name:
              created.name,
            source:
              "CENTRAL",
            active:
              true,
            barcode:
              created.barcode,
          };

        existingCentralNameMap.set(
          namaKey,
          cacheItem
        );

        existingCodeMap.set(
          kode,
          cacheItem
        );

        existingBarcodeMap.set(
          barcodeKey,
          cacheItem
        );

        /*
         * Tambahkan ke existingBarang
         * agar proses selanjutnya juga
         * mengetahui barang tersebut.
         */

        existingBarang.push({
          id:
            created.id,
          code:
            created.code,
          barcode:
            created.barcode,
          name:
            created.name,
          category:
            created.category,
          unit:
            created.unit,
          baseUnit:
            created.baseUnit,
          conversionRate:
            created.conversionRate,
          minimumStock:
            created.minimumStock,
          stock:
            created.stock,
          purchasePrice:
            created.purchasePrice,
          sellingPrice:
            created.sellingPrice,
          hasExpired:
            created.hasExpired,
          active:
            created.active,
          expiredWarning:
            created.expiredWarning,
          source:
            created.source,
          sourceOutletId:
            created.sourceOutletId,
        });

        baru++;
      } catch (error) {
        console.error(
          `Gagal import barang pada baris ${nomorBaris}, kode ${kode}:`,
          error
        );

        gagal++;

        failedDetails.push({
          row: nomorBaris,
          code: kode,
          name: nama,
          message:
            error instanceof Error
              ? error.message
              : "Gagal menyimpan barang",
        });
      }
    }

    /*
     * =====================================================
     * REPLACE MASTER
     * =====================================================
     *
     * SEKARANG BARU KITA PROSES BARANG LAMA
     * YANG TIDAK ADA DI EXCEL.
     *
     * HANYA CENTRAL.
     *
     * =====================================================
     */

    const excelCodeSet =
      new Set(
        Array.from(
          processedExcelCodes
        )
      );

    /*
     * =====================================================
     * BARANG CENTRAL LAMA
     * =====================================================
     */

    const centralOldBarang =
      existingBarang.filter(
        (item) =>
          String(
            item.source
          ) === "CENTRAL"
      );

    /*
     * =====================================================
     * LOOP BARANG LAMA
     * =====================================================
     */

    for (
      const item of centralOldBarang
    ) {
      const itemCode =
        normalizeCode(
          item.code
        );

      /*
       * Barang yang masih ada
       * di Excel tidak diproses.
       */

      if (
        excelCodeSet.has(
          itemCode
        )
      ) {
        continue;
      }

      /*
       * ===================================================
       * CEK KEAMANAN DELETE
       * ===================================================
       */

      try {
        const usage =
          await prisma.$transaction(
            async (tx) => {
              /*
               * =================================================
               * RE-CHECK DI DALAM TRANSACTION
               * =================================================
               *
               * Ini penting supaya tidak terjadi:
               *
               * check -> ada perubahan transaksi
               * -> delete barang
               *
               * Kita periksa ulang langsung sebelum delete.
               */

              const inspection =
                await inspectBarangUsage(
                  tx,
                  item.id
                );

              if (
                !inspection.exists
              ) {
                return {
                  action:
                    "MISSING" as const,
                  reason:
                    inspection.reason,
                };
              }

              if (
                !inspection.canDelete
              ) {
                return {
                  action:
                    "PRESERVE" as const,
                  reason:
                    inspection.reason,
                };
              }

              /*
               * =================================================
               * DELETE
               * =================================================
               *
               * Hanya terjadi jika:
               *
               * stock = 0
               * DAN
               * seluruh relasi = kosong.
               */

              await tx.barang.delete({
                where: {
                  id:
                    item.id,
                },
              });

              return {
                action:
                  "DELETE" as const,
                reason:
                  inspection.reason,
              };
            }
          );

        /*
         * =================================================
         * HASIL DELETE
         * =================================================
         */

        if (
          usage.action ===
          "DELETE"
        ) {
          dihapus++;

          removedDetails.push({
            id:
              item.id,
            code:
              item.code,
            name:
              item.name,
            message:
              "Barang lama tidak ada di Excel baru, belum pernah dipakai transaksi/relasi, dan stock 0. Barang dihapus dari master.",
          });

          continue;
        }

        /*
         * =================================================
         * HASIL PRESERVE
         * =================================================
         */

        if (
          usage.action ===
          "PRESERVE"
        ) {
          dipertahankan++;

          preservedDetails.push({
            id:
              item.id,
            code:
              item.code,
            name:
              item.name,
            message:
              usage.reason ||
              "Barang dipertahankan karena masih mempunyai histori/relasi atau stock.",
          });

          continue;
        }

        /*
         * =================================================
         * DATA SUDAH TIDAK ADA
         * =================================================
         */

        if (
          usage.action ===
          "MISSING"
        ) {
          /*
           * Tidak dihitung sebagai delete
           * karena data sudah tidak ada.
           */

          continue;
        }
      } catch (error) {
        /*
         * =================================================
         * JANGAN PAKSA DELETE
         * =================================================
         *
         * Kalau database menolak delete karena
         * ada constraint yang tidak kita ketahui,
         * BARANG DIPERTAHANKAN.
         *
         * Ini lebih aman daripada memaksa.
         */

        console.error(
          `Gagal mengevaluasi penghapusan barang ${item.id} (${item.code}):`,
          error
        );

        dipertahankan++;

        preservedDetails.push({
          id:
            item.id,
          code:
            item.code,
          name:
            item.name,
          message:
            "Barang tidak dihapus karena database mendeteksi constraint/relasi yang tidak aman. Data dipertahankan untuk keamanan histori.",
        });
      }
    }

    /*
     * =====================================================
     * RESPONSE
     * =====================================================
     */

    const totalExcel =
      rows.length;

    const message =
      `Import master selesai. ` +
      `Excel: ${totalExcel}, ` +
      `Baru: ${baru}, ` +
      `Update: ${update}, ` +
      `Dihapus: ${dihapus}, ` +
      `Dipertahankan karena histori: ${dipertahankan}, ` +
      `Dilewati: ${dilewati}, ` +
      `Gagal: ${gagal}.`;

    return NextResponse.json({
      success:
        true,

      message,

      /*
       * ===================================================
       * DATA
       * ===================================================
       */

      data: {
        total:
          totalExcel,

        imported:
          baru,

        updated:
          update,

        removed:
          dihapus,

        /*
         * Dipertahankan untuk kompatibilitas
         * dengan frontend lama.
         *
         * Ini bukan berarti inactive.
         */

        deactivated:
          0,

        skipped:
          dilewati,

        failed:
          gagal,

        preserved:
          dipertahankan,

        errors: [
          ...skippedDetails,
          ...failedDetails,
        ],
      },

      /*
       * ===================================================
       * SUMMARY
       * ===================================================
       */

      summary: {
        totalExcel,

        baru,

        update,

        dihapus:

          dihapus,

        /*
         * Tidak ada lagi konsep
         * otomatis nonaktif.
         */

        dinonaktifkan:
          0,

        dipertahankan:

          dipertahankan,

        dilewati:

          dilewati,

        gagal:

          gagal,

        /*
         * =================================================
         * POLICY
         * =================================================
         */

        importMode:
          "REPLACE MASTER NON-DESTRUCTIVE",

        replacePolicy:
          "Barang CENTRAL lama yang tidak ditemukan dalam Excel diperiksa histori/relasinya.",

        usedPolicy:
          "Barang yang sudah mempunyai transaksi, stock, batch, receipt, purchase, mutation, opname, delivery, recipe, manufacture, waste, atau relasi lain dipertahankan.",

        deletePolicy:
          "Barang CENTRAL lama hanya dihapus jika tidak ada di Excel, stock = 0, dan tidak mempunyai histori/relasi.",

        outletPolicy:
          "Barang OUTLET tidak disentuh oleh import master CENTRAL.",

        historyPolicy:
          "Histori transaksi tidak dihapus.",

        idPolicy:
          "Barang CENTRAL yang di-update mempertahankan ID lama sehingga relasi histori tetap menunjuk ke barang yang sama.",
      },

      /*
       * ===================================================
       * DETAIL DIHAPUS
       * ===================================================
       */

      removedDetails,

      /*
       * ===================================================
       * DETAIL DIPERTAHANKAN
       * ===================================================
       */

      preservedDetails,

      /*
       * ===================================================
       * BACKWARD COMPATIBILITY
       * ===================================================
       *
       * Frontend lama mungkin masih membaca
       * deactivatedDetails.
       *
       * Sekarang tidak ada barang yang
       * "dinonaktifkan" oleh replace.
       */

      deactivatedDetails: [],
    });
  } catch (error: any) {
    console.error(
      "IMPORT MASTER BARANG ERROR:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        message:
          error?.message ||
          "Gagal import master barang",
      },
      {
        status: 500,
      }
    );
  }
}