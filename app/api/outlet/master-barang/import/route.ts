import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// =====================================================
// CURRENT LOGIN USER
// =====================================================

async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get("erp-session");

  if (!session) {
    return null;
  }

  let sessionData: any;

  try {
    sessionData = JSON.parse(session.value);
  } catch {
    return null;
  }

  const userId =
    sessionData?.userId ??
    sessionData?.id ??
    sessionData?.user?.id;

  if (
    userId === null ||
    userId === undefined ||
    userId === ""
  ) {
    return null;
  }

  const numericUserId = Number(userId);

  if (!Number.isInteger(numericUserId)) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: numericUserId,
    },
    select: {
      id: true,
      role: true,
      outletId: true,
      active: true,
    },
  });

  return user;
}

// =====================================================
// ROLE ACCESS
// =====================================================

const ALLOWED_ROLES = [
  "ADMIN",
  "MANAGER",
  "OUTLET_ADMIN",
];

// =====================================================
// HELPERS
// =====================================================

function normalizeText(value: any) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeHeader(value: any) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function parseDecimal(value: any): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  let text = String(value).trim();

  if (!text) {
    return null;
  }

  text = text
    .replace(/[^\d.,-]/g, "")
    .trim();

  if (!text) {
    return null;
  }

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");

  if (hasComma && hasDot) {
    const lastComma = text.lastIndexOf(",");
    const lastDot = text.lastIndexOf(".");

    if (lastComma > lastDot) {
      // Contoh:
      // 1.500.000,50
      text = text.replace(/\./g, "");
      text = text.replace(",", ".");
    } else {
      // Contoh:
      // 1,500,000.50
      text = text.replace(/,/g, "");
    }
  } else if (hasComma) {
    const commaParts = text.split(",");

    if (
      commaParts.length === 2 &&
      commaParts[1].length <= 2
    ) {
      text = text.replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (hasDot) {
    const dotParts = text.split(".");

    if (
      dotParts.length > 2 ||
      (dotParts.length === 2 &&
        dotParts[1].length === 3)
    ) {
      text = text.replace(/\./g, "");
    }
  }

  const parsed = Number(text);

  return Number.isFinite(parsed) ? parsed : null;
}

// =====================================================
// GET COLUMN VALUE
// =====================================================

function getColumnValue(
  row: Record<string, any>,
  aliases: string[]
) {
  const normalizedAliases = aliases.map(normalizeHeader);

  for (const key of Object.keys(row)) {
    const normalizedKey = normalizeHeader(key);

    if (normalizedAliases.includes(normalizedKey)) {
      return row[key];
    }
  }

  return undefined;
}

// =====================================================
// POST - IMPORT MASTER BARANG OUTLET
// =====================================================

export async function POST(req: NextRequest) {
  try {
    // =================================================
    // AUTH
    // =================================================

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          message: "Session login tidak ditemukan.",
        },
        {
          status: 401,
        }
      );
    }

    if (!user.active) {
      return NextResponse.json(
        {
          ok: false,
          message: "User tidak aktif.",
        },
        {
          status: 403,
        }
      );
    }

    if (!ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Anda tidak memiliki akses untuk import Master Barang Outlet.",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // FORM DATA
    // =================================================

    const formData = await req.formData();

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          message: "File Excel tidak ditemukan.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // DETERMINE OUTLET
    // =================================================

    let outletId = user.outletId;

    // ADMIN / MANAGER dapat memilih outlet
    if (
      user.role === "ADMIN" ||
      user.role === "MANAGER"
    ) {
      const formOutletId = formData.get("outletId");

      if (formOutletId) {
        outletId = String(formOutletId);
      }
    }

    if (!outletId) {
      return NextResponse.json(
        {
          ok: false,
          message: "Outlet belum dipilih.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // VALIDATE OUTLET
    // =================================================

    const outlet = await prisma.outlet.findUnique({
      where: {
        id: outletId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        active: true,
      },
    });

    if (!outlet) {
      return NextResponse.json(
        {
          ok: false,
          message: "Outlet tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    if (!outlet.active) {
      return NextResponse.json(
        {
          ok: false,
          message: "Outlet tidak aktif.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // FILE VALIDATION
    // =================================================

    const MAX_FILE_SIZE = 10 * 1024 * 1024;

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          ok: false,
          message: "Ukuran file maksimal 10 MB.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // READ EXCEL
    // =================================================

    const buffer = Buffer.from(
      await file.arrayBuffer()
    );

    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: false,
    });

    if (!workbook.SheetNames.length) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "File Excel tidak memiliki sheet.",
        },
        {
          status: 400,
        }
      );
    }

    const firstSheetName = workbook.SheetNames[0];

    const worksheet =
      workbook.Sheets[firstSheetName];

    if (!worksheet) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Sheet Excel tidak dapat dibaca.",
        },
        {
          status: 400,
        }
      );
    }

    const rows = XLSX.utils.sheet_to_json<
      Record<string, any>
    >(worksheet, {
      defval: "",
      raw: true,
    });

    // =================================================
    // EMPTY EXCEL
    // =================================================

    if (!rows.length) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Excel kosong. Master Barang Outlet tidak diubah.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // MAX ROW
    // =================================================

    const MAX_ROWS = 5000;

    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        {
          ok: false,
          message:
            `Jumlah data maksimal ${MAX_ROWS} baris.`,
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // COLUMN ALIASES
    // =================================================

    const kodeAliases = [
      "Kode Barang",
      "Kode",
      "code",
      "barang code",
      "kodebarang",
      "item code",
      "itemcode",
    ];

    const barcodeAliases = [
      "Barcode",
      "barcode",
      "Kode Barcode",
      "kodebarcode",
      "EAN",
      "ean",
    ];

    const namaAliases = [
      "Nama Barang",
      "Nama",
      "name",
      "barang name",
      "barangname",
      "item name",
      "itemname",
    ];

    const hargaAliases = [
      "Harga",
      "Harga Jual",
      "hargaJual",
      "Harga Outlet",
      "hargaOutlet",
      "Selling Price",
      "sellingPrice",
      "Price",
      "price",
    ];

    // =================================================
    // HEADER VALIDATION
    // =================================================

    const firstRow = rows[0];

    const hasKodeColumn = Object.keys(firstRow).some(
      (key) =>
        kodeAliases
          .map(normalizeHeader)
          .includes(normalizeHeader(key))
    );

    const hasBarcodeColumn = Object.keys(
      firstRow
    ).some(
      (key) =>
        barcodeAliases
          .map(normalizeHeader)
          .includes(normalizeHeader(key))
    );

    const hasNamaColumn = Object.keys(firstRow).some(
      (key) =>
        namaAliases
          .map(normalizeHeader)
          .includes(normalizeHeader(key))
    );

    const hasHargaColumn = Object.keys(firstRow).some(
      (key) =>
        hargaAliases
          .map(normalizeHeader)
          .includes(normalizeHeader(key))
    );

    if (
      !hasKodeColumn &&
      !hasBarcodeColumn &&
      !hasNamaColumn
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Kolom barang tidak ditemukan. Gunakan Kode Barang, Barcode, atau Nama Barang.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // PREPARE IMPORT
    // =================================================

    const preparedRows: Array<{
      rowNumber: number;
      barangId: string;
      harga: number | null;
    }> = [];

    const processedBarangIds = new Set<string>();

    const errors: Array<{
      row: number;
      message: string;
    }> = [];

    // =================================================
    // VALIDATE SEMUA ROW TERLEBIH DAHULU
    // =================================================

    for (
      let index = 0;
      index < rows.length;
      index++
    ) {
      const row = rows[index];

      const excelRowNumber = index + 2;

      const kode = normalizeText(
        getColumnValue(row, kodeAliases)
      );

      const barcode = normalizeText(
        getColumnValue(row, barcodeAliases)
      );

      const nama = normalizeText(
        getColumnValue(row, namaAliases)
      );

      const rawHarga = getColumnValue(
        row,
        hargaAliases
      );

      const harga = hasHargaColumn
        ? parseDecimal(rawHarga)
        : null;

      // -----------------------------------------------
      // IDENTIFIER
      // -----------------------------------------------

      if (!kode && !barcode && !nama) {
        errors.push({
          row: excelRowNumber,
          message:
            "Kode Barang, Barcode, atau Nama Barang wajib diisi.",
        });

        continue;
      }

      // -----------------------------------------------
      // HARGA
      // -----------------------------------------------

      if (
        hasHargaColumn &&
        rawHarga !== null &&
        rawHarga !== undefined &&
        String(rawHarga).trim() !== "" &&
        harga === null
      ) {
        errors.push({
          row: excelRowNumber,
          message:
            `Harga tidak valid: "${rawHarga}".`,
        });

        continue;
      }

      // -----------------------------------------------
      // FIND CENTRAL BARANG
      // -----------------------------------------------

      let barang: {
        id: string;
        code: string | null;
        barcode: string | null;
        name: string;
        purchasePrice: any;
        minimumStock: any;
      } | null = null;

      // 1. KODE
      if (kode) {
        barang =
          await prisma.barang.findFirst({
            where: {
              source: "CENTRAL",
              code: kode,
            },
            select: {
              id: true,
              code: true,
              barcode: true,
              name: true,
              purchasePrice: true,
              minimumStock: true,
            },
          });
      }

      // 2. BARCODE
      if (!barang && barcode) {
        barang =
          await prisma.barang.findFirst({
            where: {
              source: "CENTRAL",
              barcode,
            },
            select: {
              id: true,
              code: true,
              barcode: true,
              name: true,
              purchasePrice: true,
              minimumStock: true,
            },
          });
      }

      // 3. NAMA
      if (!barang && nama) {
        barang =
          await prisma.barang.findFirst({
            where: {
              source: "CENTRAL",
              name: nama,
            },
            select: {
              id: true,
              code: true,
              barcode: true,
              name: true,
              purchasePrice: true,
              minimumStock: true,
            },
          });
      }

      // -----------------------------------------------
      // BARANG TIDAK DITEMUKAN
      // -----------------------------------------------

      if (!barang) {
        errors.push({
          row: excelRowNumber,
          message:
            `Barang tidak ditemukan di Master Barang Pusat${
              kode
                ? ` dengan kode "${kode}"`
                : barcode
                ? ` dengan barcode "${barcode}"`
                : ` dengan nama "${nama}"`
            }.`,
        });

        continue;
      }

      // -----------------------------------------------
      // DUPLICATE DI EXCEL
      // -----------------------------------------------

      if (
        processedBarangIds.has(
          barang.id
        )
      ) {
        errors.push({
          row: excelRowNumber,
          message:
            `Barang "${barang.name}" muncul lebih dari satu kali di Excel.`,
        });

        continue;
      }

      processedBarangIds.add(barang.id);

      preparedRows.push({
        rowNumber: excelRowNumber,
        barangId: barang.id,
        harga,
      });
    }

    // =================================================
    // JIKA ADA ERROR
    //
    // MASTER LAMA BELUM DISENTUH
    // =================================================

    if (errors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Import dibatalkan karena ada data Excel yang tidak valid. Master Barang Outlet lama tidak diubah.",
          errors: errors.slice(0, 100),
          totalErrors: errors.length,
        },
        {
          status: 400,
        }
      );
    }

    if (!preparedRows.length) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Tidak ada data barang yang valid untuk diimport. Master Barang Outlet tidak diubah.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // FULL REPLACE
    //
    // MASTER LAMA:
    // A, B, C, D, E
    //
    // EXCEL:
    // A, B, NORI, SALMON
    //
    // HASIL:
    // A, B, NORI, SALMON
    //
    // OutletBarang lama DIHAPUS SEMUA.
    //
    // OutletStock TIDAK DIHAPUS.
    // =================================================

    const result = await prisma.$transaction(
      async (tx) => {
        // ---------------------------------------------
        // 1. HAPUS SEMUA MASTER BARANG OUTLET LAMA
        // ---------------------------------------------

        const deletedMaster =
          await tx.outletBarang.deleteMany({
            where: {
              outletId,
            },
          });

        // ---------------------------------------------
        // 2. BUAT ULANG MASTER DARI EXCEL
        // ---------------------------------------------

        let createdMaster = 0;

        for (const item of preparedRows) {
          await tx.outletBarang.create({
            data: {
              outletId,
              barangId: item.barangId,
              harga: item.harga ?? 0,
              aktif: true,
            },
          });

          createdMaster++;
        }

        // ---------------------------------------------
        // 3. PASTIKAN OUTLET STOCK ADA
        //
        // Stock existing:
        // - tidak dihapus
        // - tidak direset
        //
        // Stock belum ada:
        // - dibuat stock 0
        // ---------------------------------------------

        let createdStock = 0;

        const importedBarangIds =
          preparedRows.map(
            (item) => item.barangId
          );

        const barangList =
          await tx.barang.findMany({
            where: {
              id: {
                in: importedBarangIds,
              },
              source: "CENTRAL",
            },
            select: {
              id: true,
              purchasePrice: true,
              minimumStock: true,
            },
          });

        for (const barang of barangList) {
          const existingStock =
            await tx.outletStock.findUnique({
              where: {
                outletId_barangId: {
                  outletId,
                  barangId: barang.id,
                },
              },
              select: {
                id: true,
              },
            });

          if (!existingStock) {
            await tx.outletStock.create({
              data: {
                outletId,
                barangId: barang.id,
                stock: 0,
                minimumStock:
                  barang.minimumStock ?? 0,
                averageCost:
                  barang.purchasePrice ?? 0,
              },
            });

            createdStock++;
          }
        }

        return {
          deletedMaster: deletedMaster.count,
          createdMaster,
          createdStock,
        };
      }
    );

    // =================================================
    // SUCCESS
    // =================================================

    return NextResponse.json({
      ok: true,

      message:
        "Master Barang Outlet berhasil diperbarui. Master lama telah diganti seluruhnya berdasarkan isi Excel.",

      outlet: {
        id: outlet.id,
        code: outlet.code,
        name: outlet.name,
      },

      summary: {
        masterLamaDihapus:
          result.deletedMaster,

        masterBaru:
          result.createdMaster,

        outletStockBaru:
          result.createdStock,

        totalExcel:
          preparedRows.length,
      },

      behavior: {
        masterBarangOutlet:
          "FULL_REPLACE",

        barangPusat:
          "TIDAK_DIUBAH",

        outletStock:
          "TIDAK_DIUBAH / HANYA DIBUAT JIKA BELUM ADA",
      },
    });
  } catch (error: any) {
    console.error(
      "IMPORT MASTER BARANG OUTLET ERROR:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          error?.message ||
          "Terjadi kesalahan saat import Master Barang Outlet.",
      },
      {
        status: 500,
      }
    );
  }
}