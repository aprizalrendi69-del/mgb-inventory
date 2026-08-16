import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/*
 * =========================================================
 * CURRENT USER
 * =========================================================
 */

async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get("erp-session");

  if (!session) return null;

  try {
    const sessionData = JSON.parse(session.value);
    const userId = Number(sessionData?.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        role: true,
        outletId: true,
        active: true,
      },
    });

    if (!user || !user.active) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

function cleanValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function getRowValue(
  row: Record<string, unknown>,
  keys: string[]
) {
  for (const key of keys) {
    const value = row[key];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return "";
}

function parseDecimal(value: unknown): number {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  let str = String(value).trim();

  if (!str) {
    return 0;
  }

  str = str.replace(/\s/g, "");

  // 1.250,50
  if (str.includes(".") && str.includes(",")) {
    str = str
      .replace(/\./g, "")
      .replace(",", ".");

    const result = Number(str);

    return Number.isFinite(result) ? result : 0;
  }

  // 8,91
  if (str.includes(",")) {
    const result = Number(
      str.replace(",", ".")
    );

    return Number.isFinite(result) ? result : 0;
  }

  // 8.91
  if (str.includes(".")) {
    const result = Number(str);

    return Number.isFinite(result) ? result : 0;
  }

  const result = Number(str);

  return Number.isFinite(result) ? result : 0;
}

function getNumber(
  row: Record<string, unknown>,
  keys: string[]
) {
  return parseDecimal(
    getRowValue(row, keys)
  );
}

/*
 * =========================================================
 * POST
 * IMPORT BARANG OUTLET
 * =========================================================
 */

export async function POST(req: NextRequest) {
  try {
    // =====================================================
    // 1. SESSION
    // =====================================================

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login atau session sudah tidak aktif",
        },
        { status: 401 }
      );
    }

    // =====================================================
    // 2. ROLE
    // =====================================================

    const allowedRoles = [
      "ADMIN",
      "MANAGER",
      "OUTLET_ADMIN",
    ];

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak memiliki akses",
        },
        { status: 403 }
      );
    }

    // =====================================================
    // 3. FORM DATA
    // =====================================================

    const formData = await req.formData();

    const fileEntry = formData.get("file");

    if (
      !fileEntry ||
      !(fileEntry instanceof File)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "File Excel tidak ditemukan",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 4. OUTLET
    // =====================================================

    let outletId: number;

    if (user.role === "OUTLET_ADMIN") {
      if (
        !user.outletId ||
        !Number.isInteger(user.outletId) ||
        user.outletId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet belum memiliki outlet",
          },
          { status: 400 }
        );
      }

      outletId = user.outletId;
    } else {
      outletId = Number(
        formData.get("outletId")
      );

      if (
        !Number.isInteger(outletId) ||
        outletId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Outlet wajib dipilih",
          },
          { status: 400 }
        );
      }
    }

    // =====================================================
    // 5. CEK OUTLET
    // =====================================================

    const outlet =
      await prisma.outlet.findUnique({
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
          success: false,
          message: "Outlet tidak ditemukan",
        },
        { status: 404 }
      );
    }

    if (!outlet.active) {
      return NextResponse.json(
        {
          success: false,
          message: "Outlet sedang tidak aktif",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 6. FILE SIZE
    // =====================================================

    const MAX_FILE_SIZE = 10 * 1024 * 1024;

    if (fileEntry.size <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "File Excel kosong",
        },
        { status: 400 }
      );
    }

    if (fileEntry.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Ukuran file maksimal 10 MB",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 7. BACA EXCEL
    // =====================================================

    const buffer = Buffer.from(
      await fileEntry.arrayBuffer()
    );

    let workbook: XLSX.WorkBook;

    try {
      workbook = XLSX.read(buffer, {
        type: "buffer",
      });
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "File Excel tidak valid",
        },
        { status: 400 }
      );
    }

    if (!workbook.SheetNames.length) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Excel tidak memiliki sheet",
        },
        { status: 400 }
      );
    }

    const sheet =
      workbook.Sheets[
        workbook.SheetNames[0]
      ];

    if (!sheet) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Sheet Excel tidak ditemukan",
        },
        { status: 400 }
      );
    }

    const rows =
      XLSX.utils.sheet_to_json<
        Record<string, unknown>
      >(sheet, {
        defval: "",
      });

    if (!rows.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Excel kosong",
        },
        { status: 400 }
      );
    }

    if (rows.length > 5000) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Maksimal 5.000 baris per file Excel",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 8. COUNTER
    // =====================================================

    let berhasil = 0;
    let dilewati = 0;
    let gagal = 0;

    const detailGagal: string[] = [];
    const detailLewati: string[] = [];

    const processedBarangIds =
      new Set<number>();

    // =====================================================
    // 9. PROSES ROW
    // =====================================================

    for (
      let index = 0;
      index < rows.length;
      index++
    ) {
      const row = rows[index];
      const nomorBaris = index + 2;

      const kode = cleanValue(
        getRowValue(row, [
          "Kode Barang",
          "Kode",
          "kode",
          "code",
          "CODE",
        ])
      );

      const barcode = cleanValue(
        getRowValue(row, [
          "Barcode",
          "barcode",
          "BARCODE",
        ])
      );

      const nama = cleanValue(
        getRowValue(row, [
          "Nama Barang",
          "Nama",
          "name",
          "Name",
          "nama",
        ])
      );

      const harga = getNumber(row, [
        "Harga",
        "harga",
        "Harga Jual",
        "hargaJual",
      ]);

      if (!kode && !barcode && !nama) {
        gagal++;

        detailGagal.push(
          `Baris ${nomorBaris}: kode/barcode/nama kosong`
        );

        continue;
      }

      try {
        // =================================================
        // CARI BARANG CENTRAL SAJA
        // =================================================

        let barang = null;

        if (kode) {
          barang =
            await prisma.barang.findFirst({
              where: {
                code: kode,
                source: "CENTRAL",
              },
            });
        }

        if (!barang && barcode) {
          barang =
            await prisma.barang.findFirst({
              where: {
                barcode,
                source: "CENTRAL",
              },
            });
        }

        if (!barang && nama) {
          barang =
            await prisma.barang.findFirst({
              where: {
                name: nama,
                source: "CENTRAL",
              },
            });
        }

        // =================================================
        // BARANG CENTRAL TIDAK DITEMUKAN
        // =================================================

        if (!barang) {
          gagal++;

          detailGagal.push(
            `Baris ${nomorBaris}: barang "${kode || barcode || nama}" tidak ditemukan di Master Barang Central`
          );

          continue;
        }

        // =================================================
        // DUPLIKAT DALAM FILE
        // =================================================

        if (
          processedBarangIds.has(
            barang.id
          )
        ) {
          dilewati++;

          detailLewati.push(
            `Baris ${nomorBaris}: barang "${barang.name}" sudah diproses dalam file`
          );

          continue;
        }

        processedBarangIds.add(
          barang.id
        );

        // =================================================
        // TRANSACTION
        // =================================================

        await prisma.$transaction(
          async (tx) => {
            // =============================================
            // OUTLET BARANG
            // =============================================

            await tx.outletBarang.upsert({
              where: {
                outletId_barangId: {
                  outletId,
                  barangId: barang.id,
                },
              },

              update: {
                harga,
                aktif: true,
              },

              create: {
                outletId,
                barangId: barang.id,
                harga,
                aktif: true,
              },
            });

            // =============================================
            // OUTLET STOCK
            // =============================================

            await tx.outletStock.upsert({
              where: {
                outletId_barangId: {
                  outletId,
                  barangId: barang.id,
                },
              },

              update: {},

              create: {
                outletId,
                barangId: barang.id,
                stock: 0,
                minimumStock:
                  barang.minimumStock || 0,
                averageCost:
                  barang.purchasePrice || 0,
              },
            });
          }
        );

        berhasil++;
      } catch (error: any) {
        console.error(
          `IMPORT BARANG OUTLET BARIS ${nomorBaris}:`,
          error
        );

        gagal++;

        detailGagal.push(
          `Baris ${nomorBaris}: ${
            error?.message ||
            "gagal menyimpan ke database"
          }`
        );
      }
    }

    // =====================================================
    // 10. RESPONSE
    // =====================================================

    return NextResponse.json(
      {
        success: true,

        message:
          `Import selesai. Berhasil: ${berhasil}, Dilewati: ${dilewati}, Gagal: ${gagal}.`,

        outlet: {
          id: outlet.id,
          code: outlet.code,
          name: outlet.name,
        },

        summary: {
          total: rows.length,
          berhasil,
          dilewati,
          gagal,
        },

        detail: {
          gagal: detailGagal,
          dilewati: detailLewati,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(
      "IMPORT BARANG OUTLET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal import barang outlet",
      },
      { status: 500 }
    );
  }
}