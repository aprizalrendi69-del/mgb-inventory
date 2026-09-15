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
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/*
 * =========================================================
 * NORMALISASI KODE
 * =========================================================
 */

function normalizeCode(value: unknown): string {
  return String(value ?? "")
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
    .trim()
    .replace(/\s+/g, " ");
}

/*
 * =========================================================
 * POST - IMPORT MASTER BARANG
 * =========================================================
 *
 * FLOW FINAL:
 *
 * 1. Excel dibaca.
 *
 * 2. Barang CENTRAL lama dicari berdasarkan KODE.
 *
 * 3. Jika KODE ditemukan:
 *
 *    a. Jika barang OUTLET
 *       -> SKIP
 *
 *    b. Jika CENTRAL:
 *
 *       - Nama sama
 *         -> UPDATE data master
 *
 *       - Nama berbeda
 *         -> KONFLIK
 *         -> SKIP
 *
 * 4. Jika KODE tidak ditemukan:
 *
 *    Cari berdasarkan NAMA.
 *
 *    a. Nama sudah ada pada CENTRAL
 *       -> SKIP
 *       -> TIDAK membuat barang baru
 *
 *    b. Nama hanya ada pada OUTLET
 *       -> SKIP
 *       -> TIDAK mengambil barang OUTLET
 *
 *    c. Nama benar-benar baru
 *       -> CREATE CENTRAL
 *
 * 5. BARANG LAMA YANG TIDAK ADA DI EXCEL
 *
 *    -> TIDAK DISENTUH
 *
 *    -> TIDAK DI-DELETE
 *    -> TIDAK DI-INACTIVE
 *
 * PENTING:
 *
 * Import ini sekarang bersifat:
 *
 * ADD / UPDATE
 *
 * BUKAN:
 *
 * REPLACE MASTER
 *
 * Jadi Excel boleh hanya berisi barang baru.
 *
 * =========================================================
 *
 * ATURAN DUPLIKAT:
 *
 * CODE SAMA + NAME SAMA
 * -> UPDATE
 *
 * CODE BARU + NAME BARU
 * -> CREATE
 *
 * CODE BARU + NAME SAMA
 * -> SKIP
 *
 * CODE SAMA + NAME BERBEDA
 * -> SKIP KONFLIK
 *
 * =========================================================
 */

export async function POST(req: NextRequest) {
  try {
    /*
     * =====================================================
     * AMBIL FILE
     * =====================================================
     */

    const formData = await req.formData();

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: "File Excel tidak ditemukan",
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

    const fileName = file.name.toLowerCase();

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

    const buffer = Buffer.from(
      await file.arrayBuffer()
    );

    const workbook = XLSX.read(buffer, {
      type: "buffer",
    });

    if (!workbook.SheetNames.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Excel tidak memiliki sheet",
        },
        {
          status: 400,
        }
      );
    }

    const sheet =
      workbook.Sheets[workbook.SheetNames[0]];

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
          message: "Excel kosong",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * LOAD BARANG
     * =====================================================
     *
     * Kita tetap mengambil semua Barang.
     *
     * Tetapi:
     *
     * CENTRAL
     * -> boleh di-update
     *
     * OUTLET
     * -> tidak boleh disentuh
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
     * TYPE
     * =====================================================
     */

    type BarangMapItem = {
      id: number;
      code: string;
      name: string;
      source: string;
      active: boolean;
      barcode?: string | null;
    };

    /*
     * =====================================================
     * MAP KODE
     * =====================================================
     *
     * SEMUA BARANG masuk ke map kode.
     *
     * Tujuannya agar:
     *
     * kode CENTRAL
     * maupun
     * kode OUTLET
     *
     * tidak boleh dibuat ulang.
     */

    const existingCodeMap =
      new Map<string, BarangMapItem>();

    for (const item of existingBarang) {
      const key = normalizeCode(item.code);

      if (!key) continue;

      if (!existingCodeMap.has(key)) {
        existingCodeMap.set(key, {
          id: item.id,
          code: item.code,
          name: item.name,
          source: item.source,
          active: item.active,
          barcode: item.barcode,
        });
      }
    }

    /*
     * =====================================================
     * MAP NAMA CENTRAL
     * =====================================================
     *
     * HANYA CENTRAL.
     *
     * Ini penting.
     *
     * Barang OUTLET tidak boleh menyebabkan
     * master barang pusat dianggap sudah ada.
     */

    const existingCentralNameMap =
      new Map<string, BarangMapItem>();

    for (const item of existingBarang) {
      if (item.source !== "CENTRAL") {
        continue;
      }

      const key = normalizeName(item.name);

      if (!key) continue;

      /*
       * Jika database lama sudah mempunyai duplicate,
       * kita simpan item pertama sebagai canonical.
       *
       * Kita tidak menghapus duplicate lama di sini.
       */

      if (!existingCentralNameMap.has(key)) {
        existingCentralNameMap.set(key, {
          id: item.id,
          code: item.code,
          name: item.name,
          source: item.source,
          active: item.active,
          barcode: item.barcode,
        });
      }
    }

    /*
     * =====================================================
     * MAP NAMA OUTLET
     * =====================================================
     *
     * Hanya untuk informasi konflik.
     *
     * Barang OUTLET tidak akan diambil
     * menjadi barang CENTRAL.
     */

    const existingOutletNameMap =
      new Map<string, BarangMapItem>();

    for (const item of existingBarang) {
      if (item.source !== "OUTLET") {
        continue;
      }

      const key = normalizeName(item.name);

      if (!key) continue;

      if (!existingOutletNameMap.has(key)) {
        existingOutletNameMap.set(key, {
          id: item.id,
          code: item.code,
          name: item.name,
          source: item.source,
          active: item.active,
          barcode: item.barcode,
        });
      }
    }

    /*
     * =====================================================
     * MAP BARCODE
     * =====================================================
     *
     * Barcode juga tidak boleh bentrok.
     */

    const existingBarcodeMap =
      new Map<string, BarangMapItem>();

    for (const item of existingBarang) {
      const barcode =
        normalizeBarcode(item.barcode);

      if (!barcode) continue;

      const key =
        barcode.toLowerCase();

      if (!existingBarcodeMap.has(key)) {
        existingBarcodeMap.set(key, {
          id: item.id,
          code: item.code,
          name: item.name,
          source: item.source,
          active: item.active,
          barcode: item.barcode,
        });
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

    /*
     * =====================================================
     * DETAIL SKIPPED
     * =====================================================
     */

    const skippedDetails: Array<{
      row: number;
      code?: string;
      name?: string;
      message: string;
    }> = [];

    /*
     * =====================================================
     * DETAIL FAILED
     * =====================================================
     */

    const failedDetails: Array<{
      row: number;
      code?: string;
      name?: string;
      message: string;
    }> = [];

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
      const row = rows[index];

      /*
       * Header Excel berada di baris 1.
       * Data pertama = baris 2.
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
        normalizeCode(kodeRaw);

      const nama =
        String(namaRaw ?? "")
          .trim()
          .replace(/\s+/g, " ");

      const namaKey =
        normalizeName(nama);

      const kategori =
        String(kategoriRaw ?? "")
          .trim()
          .replace(/\s+/g, " ");

      const satuan =
        normalizeUnit(satuanRaw);

      /*
       * ===================================================
       * BARCODE
       * ===================================================
       *
       * Kalau Excel punya barcode:
       * gunakan barcode tersebut.
       *
       * Kalau kosong:
       * gunakan kode.
       */

      const barcodeExcel =
        normalizeBarcode(
          barcodeRaw
        );

      /*
       * ===================================================
       * VALIDASI WAJIB
       * ===================================================
       */

      if (!kode || !nama) {
        gagal++;

        failedDetails.push({
          row: nomorBaris,
          code:
            kode || undefined,
          name:
            nama || undefined,
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
        processedExcelCodes.has(kode)
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
       * Tandai sudah diproses.
       */

      processedExcelCodes.add(kode);

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
          existingCodeMap.get(kode);

        if (existingByCode) {
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
           * CEK NAMA
           * =================================================
           *
           * KODE SAMA tetapi NAMA BERBEDA
           * tidak boleh otomatis mengganti nama.
           *
           * Ini dianggap konflik master.
           */

          const existingNameKey =
            normalizeName(
              existing.name
            );

          if (
            existingNameKey !==
            namaKey
          ) {
            dilewati++;

            skippedDetails.push({
              row: nomorBaris,
              code: kode,
              name: nama,
              message:
                `Konflik kode ${kode}: database memiliki nama "${existing.name}", sedangkan Excel memiliki nama "${nama}". Baris dilewati agar identitas barang lama tidak berubah.`,
            });

            continue;
          }

          /*
           * =================================================
           * CEK BARCODE
           * =================================================
           *
           * Kalau Excel memberikan barcode berbeda
           * dan barcode tersebut sudah dipakai barang lain,
           * jangan update.
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
           * ID tetap.
           *
           * Stock tidak disentuh.
           * Harga tidak disentuh.
           * Relasi tidak disentuh.
           */

          await prisma.barang.update({
            where: {
              id: existing.id,
            },

            data: {
              /*
               * Pertahankan kode.
               */

              code: existing.code,

              /*
               * Barcode:
               *
               * Jika Excel memberikan barcode,
               * gunakan barcode Excel.
               *
               * Jika tidak,
               * pertahankan barcode lama.
               */

              barcode:
                barcodeExcel ||
                existing.barcode ||
                kode,

              /*
               * Nama sama secara normalisasi.
               *
               * Boleh mengikuti format nama Excel.
               */

              name: nama,

              category:
                kategori || null,

              unit:
                satuan || "PCS",

              /*
               * Tetap CENTRAL.
               */

              source: "CENTRAL",

              sourceOutletId:
                null,

              /*
               * Kalau sebelumnya inactive
               * lalu muncul kembali di Excel,
               * aktifkan kembali.
               */

              active: true,
            },
          });

          /*
           * =================================================
           * UPDATE CACHE NAMA
           * =================================================
           */

          existingCentralNameMap.set(
            namaKey,
            {
              id: existing.id,
              code: existing.code,
              name: nama,
              source: "CENTRAL",
              active: true,
              barcode:
                barcodeExcel ||
                existing.barcode ||
                kode,
            }
          );

          /*
           * =================================================
           * UPDATE CACHE KODE
           * =================================================
           */

          existingCodeMap.set(
            kode,
            {
              id: existing.id,
              code: existing.code,
              name: nama,
              source: "CENTRAL",
              active: true,
              barcode:
                barcodeExcel ||
                existing.barcode ||
                kode,
            }
          );

          /*
           * =================================================
           * UPDATE CACHE BARCODE
           * =================================================
           */

          existingBarcodeMap.set(
            (
              barcodeExcel ||
              existing.barcode ||
              kode
            ).toLowerCase(),
            {
              id: existing.id,
              code: existing.code,
              name: nama,
              source: "CENTRAL",
              active: true,
              barcode:
                barcodeExcel ||
                existing.barcode ||
                kode,
            }
          );

          update++;

          continue;
        }

        /*
         * =================================================
         * 2. KODE BARU
         * =================================================
         *
         * Sekarang cari berdasarkan NAMA CENTRAL.
         */

        const existingByCentralName =
          existingCentralNameMap.get(
            namaKey
          );

        if (existingByCentralName) {
          /*
           * =================================================
           * NAMA SUDAH ADA DI CENTRAL
           * =================================================
           *
           * JANGAN:
           *
           * - create ID baru
           * - mengganti kode lama
           * - memindahkan kode
           *
           * Cukup skip.
           */

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
         *
         * Kalau nama hanya ada pada OUTLET:
         *
         * Jangan mengambil barang OUTLET.
         *
         * Tetapi juga jangan membuat CENTRAL baru
         * dengan nama sama.
         */

        const existingByOutletName =
          existingOutletNameMap.get(
            namaKey
          );

        if (existingByOutletName) {
          dilewati++;

          skippedDetails.push({
            row: nomorBaris,
            code: kode,
            name: nama,
            message:
              `Nama "${nama}" sudah digunakan oleh barang OUTLET dengan kode ${existingByOutletName.code}. Barang OUTLET tidak diubah dan barang CENTRAL baru tidak dibuat untuk nama yang sama.`,
          });

          continue;
        }

        /*
         * =================================================
         * 4. BARANG BENAR-BENAR BARU
         * =================================================
         */

        const barcodeToCreate =
          barcodeExcel || kode;

        /*
         * =================================================
         * CEK BARCODE BARU
         * =================================================
         */

        const barcodeKey =
          barcodeToCreate.toLowerCase();

        const existingBarcode =
          existingBarcodeMap.get(
            barcodeKey
          );

        if (existingBarcode) {
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
              code: kode,

              barcode:
                barcodeToCreate,

              name: nama,

              category:
                kategori || null,

              unit:
                satuan || "PCS",

              /*
               * Barang baru mulai dari stock 0.
               */

              stock: 0,

              minimumStock: 0,

              purchasePrice: 0,

              sellingPrice: 0,

              hasExpired: false,

              active: true,

              /*
               * CENTRAL
               */

              source: "CENTRAL",

              sourceOutletId:
                null,
            },
          });

        /*
         * =================================================
         * UPDATE CACHE CENTRAL NAME
         * =================================================
         */

        existingCentralNameMap.set(
          namaKey,
          {
            id: created.id,
            code: created.code,
            name: created.name,
            source: "CENTRAL",
            active: true,
            barcode:
              created.barcode,
          }
        );

        /*
         * =================================================
         * UPDATE CACHE CODE
         * =================================================
         */

        existingCodeMap.set(
          kode,
          {
            id: created.id,
            code: created.code,
            name: created.name,
            source: "CENTRAL",
            active: true,
            barcode:
              created.barcode,
          }
        );

        /*
         * =================================================
         * UPDATE CACHE BARCODE
         * =================================================
         */

        existingBarcodeMap.set(
          barcodeKey,
          {
            id: created.id,
            code: created.code,
            name: created.name,
            source: "CENTRAL",
            active: true,
            barcode:
              created.barcode,
          }
        );

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
     * TIDAK ADA LAGI PROSES NONAKTIFKAN
     * =====================================================
     *
     * SANGAT PENTING:
     *
     * Import ini BUKAN replace seluruh master.
     *
     * Jadi barang CENTRAL lama yang tidak ada
     * di Excel TIDAK DIUBAH.
     *
     * Contoh:
     *
     * DB:
     * BRG-001 Daging
     * BRG-002 Ayam
     * BRG-003 Bawang
     *
     * Excel:
     * BRG-100 Keju
     *
     * Hasil:
     *
     * BRG-001 Daging  -> tetap ACTIVE
     * BRG-002 Ayam   -> tetap ACTIVE
     * BRG-003 Bawang -> tetap ACTIVE
     * BRG-100 Keju   -> CREATE
     *
     * =====================================================
     */

    /*
     * =====================================================
     * RESPONSE
     * =====================================================
     */

    return NextResponse.json({
      success: true,

      message:
        `Import selesai. ` +
        `Baru: ${baru}, ` +
        `Update: ${update}, ` +
        `Duplikat/konflik dilewati: ${dilewati}, ` +
        `Gagal: ${gagal}.`,

      data: {
        total: rows.length,

        imported: baru,

        updated: update,

        deactivated: 0,

        skipped: dilewati,

        failed: gagal,

        errors: [
          ...skippedDetails,
          ...failedDetails,
        ],
      },

      summary: {
        totalExcel:
          rows.length,

        baru,

        update,

        dinonaktifkan: 0,

        dilewati,

        gagal,

        duplicatePolicy:
          "Nama barang yang sama dianggap satu master. Jika kode Excel berbeda, baris dilewati dan tidak membuat barang duplikat.",

        codeConflictPolicy:
          "Jika kode sudah digunakan tetapi nama berbeda, baris dianggap konflik dan tidak mengubah barang lama.",

        inactivePolicy:
          "Barang CENTRAL lama yang tidak ditemukan dalam Excel tidak diubah dan tidak dinonaktifkan.",

        importMode:
          "ADD / UPDATE - Excel tidak dianggap sebagai pengganti seluruh master barang.",

        outletPolicy:
          "Barang OUTLET tidak disentuh, tidak diubah, dan tidak dikonversi menjadi barang CENTRAL.",
      },

      skippedDetails,

      failedDetails,

      /*
       * Dipertahankan supaya frontend lama
       * yang mungkin masih membaca property ini
       * tidak langsung error.
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
        success: false,

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