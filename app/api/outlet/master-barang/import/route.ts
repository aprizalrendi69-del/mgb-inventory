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

    const userId = Number(
      sessionData?.id ??
        sessionData?.user?.id
    );

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

/**
 * Normalisasi nama/header Excel.
 *
 * Contoh:
 *
 * "Harga"
 * " harga "
 * "HARGA"
 * "Harga Jual"
 * "HARGA JUAL"
 *
 * akan menjadi bentuk yang konsisten.
 */
function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[_-]+/g, " ");
}

/**
 * Normalisasi key untuk pencarian kolom.
 */
function normalizeKey(value: unknown) {
  return normalizeHeader(value)
    .replace(/\s+/g, "");
}

function cleanValue(value: unknown) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

/**
 * Ambil nilai berdasarkan daftar alias key.
 *
 * Pencarian dilakukan dengan normalisasi sehingga:
 *
 * Harga
 * harga
 * HARGA
 * Harga
 *
 * tetap dikenali.
 */
function getRowValue(
  row: Record<string, unknown>,
  keys: string[]
) {
  const normalizedKeys = new Set(
    keys.map((key) => normalizeKey(key))
  );

  for (const [rowKey, value] of Object.entries(row)) {
    const normalizedRowKey =
      normalizeKey(rowKey);

    if (
      !normalizedKeys.has(
        normalizedRowKey
      )
    ) {
      continue;
    }

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

/**
 * Apakah Excel memiliki kolom tertentu?
 *
 * Ini penting khusus untuk Harga.
 *
 * Kita harus membedakan:
 *
 * 1. Kolom Harga tidak ada
 *    -> jangan ubah harga existing.
 *
 * 2. Kolom Harga ada tetapi nilainya 0
 *    -> memang update harga menjadi 0.
 */
function hasColumn(
  rows: Record<string, unknown>[],
  keys: string[]
) {
  if (!rows.length) {
    return false;
  }

  const normalizedKeys = new Set(
    keys.map((key) => normalizeKey(key))
  );

  const firstRow = rows[0];

  for (const rowKey of Object.keys(
    firstRow
  )) {
    if (
      normalizedKeys.has(
        normalizeKey(rowKey)
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Parse angka dengan aman untuk format:
 *
 * 25000
 * 25.000
 * 25,000
 * 25.000,50
 * 25,000.50
 * Rp 25.000
 * Rp25.000
 *
 * Catatan:
 * Jika Excel menyimpan numeric value asli,
 * langsung digunakan sebagai number.
 */
function parseDecimal(
  value: unknown
): number {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  let str = String(value)
    .trim();

  if (!str) {
    return 0;
  }

  /*
   * Hapus simbol currency dan karakter
   * yang tidak diperlukan.
   */
  str = str
    .replace(/rp/gi, "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!str) {
    return 0;
  }

  /*
   * Handle angka negatif.
   */
  const isNegative =
    str.startsWith("-");

  str = str.replace(/-/g, "");

  /*
   * =======================================================
   * ADA TITIK DAN KOMA
   * =======================================================
   *
   * 25.000,50
   * -> 25000.50
   *
   * 25,000.50
   * -> 25000.50
   */
  if (
    str.includes(".") &&
    str.includes(",")
  ) {
    const lastDot =
      str.lastIndexOf(".");

    const lastComma =
      str.lastIndexOf(",");

    /*
     * Separator terakhir dianggap decimal.
     */
    if (lastComma > lastDot) {
      str = str
        .replace(/\./g, "")
        .replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }

    const result = Number(str);

    if (!Number.isFinite(result)) {
      return 0;
    }

    return isNegative
      ? -result
      : result;
  }

  /*
   * =======================================================
   * HANYA KOMA
   * =======================================================
   *
   * 25,000 -> 25000
   * 25,50  -> 25.50
   */
  if (str.includes(",")) {
    const parts = str.split(",");

    const decimalPart =
      parts[parts.length - 1];

    /*
     * Jika 3 digit di belakang koma,
     * lebih masuk akal sebagai pemisah ribuan.
     *
     * 25,000 -> 25000
     *
     * Kalau 1-2 digit:
     *
     * 25,50 -> 25.50
     */
    if (
      parts.length === 2 &&
      decimalPart.length === 3
    ) {
      str = str.replace(/,/g, "");
    } else {
      str = str.replace(/,/g, ".");
    }

    const result = Number(str);

    if (!Number.isFinite(result)) {
      return 0;
    }

    return isNegative
      ? -result
      : result;
  }

  /*
   * =======================================================
   * HANYA TITIK
   * =======================================================
   *
   * 25.000 -> 25000
   * 25.50  -> 25.50
   */
  if (str.includes(".")) {
    const parts = str.split(".");

    const decimalPart =
      parts[parts.length - 1];

    /*
     * 25.000 biasanya format Indonesia
     * untuk 25 ribu.
     *
     * 25.50 dianggap decimal.
     */
    if (
      parts.length === 2 &&
      decimalPart.length === 3
    ) {
      str = str.replace(/\./g, "");
    }

    const result = Number(str);

    if (!Number.isFinite(result)) {
      return 0;
    }

    return isNegative
      ? -result
      : result;
  }

  const result = Number(str);

  if (!Number.isFinite(result)) {
    return 0;
  }

  return isNegative
    ? -result
    : result;
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

export async function POST(
  req: NextRequest
) {
  try {
    // =====================================================
    // 1. SESSION
    // =====================================================

    const user =
      await getCurrentUser();

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

    if (
      !allowedRoles.includes(
        user.role
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak memiliki akses",
        },
        { status: 403 }
      );
    }

    // =====================================================
    // 3. FORM DATA
    // =====================================================

    const formData =
      await req.formData();

    const fileEntry =
      formData.get("file");

    if (
      !fileEntry ||
      !(fileEntry instanceof File)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "File Excel tidak ditemukan",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 4. OUTLET
    // =====================================================

    let outletId: number;

    if (
      user.role ===
      "OUTLET_ADMIN"
    ) {
      if (
        !user.outletId ||
        !Number.isInteger(
          user.outletId
        ) ||
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

      /*
       * OUTLET_ADMIN tidak boleh
       * memilih outlet lain dari FormData.
       */
      outletId =
        user.outletId;
    } else {
      outletId = Number(
        formData.get("outletId")
      );

      if (
        !Number.isInteger(
          outletId
        ) ||
        outletId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet wajib dipilih",
          },
          { status: 400 }
        );
      }
    }

    // =====================================================
    // 5. CEK OUTLET
    // =====================================================

    const outlet =
      await prisma.outlet.findUnique(
        {
          where: {
            id: outletId,
          },

          select: {
            id: true,
            code: true,
            name: true,
            active: true,
          },
        }
      );

    if (!outlet) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tidak ditemukan",
        },
        { status: 404 }
      );
    }

    if (!outlet.active) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet sedang tidak aktif",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 6. FILE SIZE
    // =====================================================

    const MAX_FILE_SIZE =
      10 * 1024 * 1024;

    if (fileEntry.size <= 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "File Excel kosong",
        },
        { status: 400 }
      );
    }

    if (
      fileEntry.size >
      MAX_FILE_SIZE
    ) {
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

    const buffer =
      Buffer.from(
        await fileEntry.arrayBuffer()
      );

    let workbook: XLSX.WorkBook;

    try {
      workbook = XLSX.read(
        buffer,
        {
          type: "buffer",
        }
      );
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "File Excel tidak valid",
        },
        { status: 400 }
      );
    }

    if (
      !workbook.SheetNames.length
    ) {
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
          message:
            "Excel kosong",
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
    // 8. DETEKSI KOLOM HARGA
    // =====================================================

    const hargaColumnKeys = [
      "Harga",
      "harga",
      "Harga Jual",
      "hargaJual",
      "HARGA JUAL",
      "Harga Outlet",
      "hargaOutlet",
    ];

    const hasHargaColumn =
      hasColumn(
        rows,
        hargaColumnKeys
      );

    /*
     * Ini sengaja dibedakan dari nilai harga.
     *
     * hasHargaColumn = false
     * -> jangan update harga existing.
     *
     * hasHargaColumn = true
     * -> harga Excel menjadi sumber harga outlet.
     */

    // =====================================================
    // 9. COUNTER
    // =====================================================

    let berhasil = 0;
    let dilewati = 0;
    let gagal = 0;

    let hargaDiupdate = 0;
    let hargaDipertahankan = 0;

    const detailGagal: string[] = [];
    const detailLewati: string[] = [];

    const processedBarangIds =
      new Set<number>();

    // =====================================================
    // 10. PROSES ROW
    // =====================================================

    for (
      let index = 0;
      index < rows.length;
      index++
    ) {
      const row =
        rows[index];

      const nomorBaris =
        index + 2;

      // ===================================================
      // IDENTITAS BARANG
      // ===================================================

      const kode =
        cleanValue(
          getRowValue(
            row,
            [
              "Kode Barang",
              "Kode",
              "kode",
              "code",
              "CODE",
              "KodeBarang",
            ]
          )
        );

      const barcode =
        cleanValue(
          getRowValue(
            row,
            [
              "Barcode",
              "barcode",
              "BARCODE",
            ]
          )
        );

      const nama =
        cleanValue(
          getRowValue(
            row,
            [
              "Nama Barang",
              "Nama",
              "name",
              "Name",
              "nama",
              "NamaBarang",
            ]
          )
        );

      /*
       * Harga hanya dibaca jika
       * kolom Harga memang tersedia.
       */
      const hargaExcel =
        hasHargaColumn
          ? getNumber(
              row,
              hargaColumnKeys
            )
          : null;

      if (
        !kode &&
        !barcode &&
        !nama
      ) {
        gagal++;

        detailGagal.push(
          `Baris ${nomorBaris}: kode/barcode/nama kosong`
        );

        continue;
      }

      try {
        // =================================================
        // CARI BARANG CENTRAL
        // =================================================

        let barang = null;

        /*
         * Prioritas 1:
         * Kode Barang.
         */
        if (kode) {
          barang =
            await prisma.barang.findFirst(
              {
                where: {
                  code: kode,
                  source:
                    "CENTRAL",
                },
              }
            );
        }

        /*
         * Prioritas 2:
         * Barcode.
         */
        if (
          !barang &&
          barcode
        ) {
          barang =
            await prisma.barang.findFirst(
              {
                where: {
                  barcode,
                  source:
                    "CENTRAL",
                },
              }
            );
        }

        /*
         * Prioritas 3:
         * Nama.
         */
        if (
          !barang &&
          nama
        ) {
          barang =
            await prisma.barang.findFirst(
              {
                where: {
                  name: nama,
                  source:
                    "CENTRAL",
                },
              }
            );
        }

        // =================================================
        // BARANG TIDAK DITEMUKAN
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
            // CEK DATA OUTLET BARANG EXISTING
            // =============================================

            const existing =
              await tx.outletBarang.findUnique(
                {
                  where: {
                    outletId_barangId:
                      {
                        outletId,
                        barangId:
                          barang.id,
                      },
                  },

                  select: {
                    id: true,
                    harga: true,
                    aktif: true,
                  },
                }
              );

            // =============================================
            // SIAPKAN DATA OUTLET BARANG
            // =============================================

            if (existing) {
              /*
               * -------------------------------------------
               * BARANG SUDAH ADA
               * -------------------------------------------
               */

              if (
                hasHargaColumn
              ) {
                /*
                 * Kolom Harga tersedia.
                 *
                 * Walaupun nilainya 0,
                 * itu dianggap sebagai instruksi
                 * untuk mengubah harga menjadi 0.
                 */
                await tx.outletBarang.update(
                  {
                    where: {
                      id: existing.id,
                    },

                    data: {
                      harga:
                        hargaExcel ?? 0,
                      aktif: true,
                    },
                  }
                );

                hargaDiupdate++;
              } else {
                /*
                 * TIDAK ADA kolom Harga.
                 *
                 * Harga existing WAJIB dipertahankan.
                 */
                await tx.outletBarang.update(
                  {
                    where: {
                      id: existing.id,
                    },

                    data: {
                      aktif: true,
                    },
                  }
                );

                hargaDipertahankan++;
              }
            } else {
              /*
               * -------------------------------------------
               * BARANG BARU DI OUTLET
               * -------------------------------------------
               */

              await tx.outletBarang.create(
                {
                  data: {
                    outletId,
                    barangId:
                      barang.id,

                    /*
                     * Kalau Excel punya Harga:
                     * gunakan harga Excel.
                     *
                     * Kalau Excel tidak punya Harga:
                     * barang baru mulai dari 0.
                     */
                    harga:
                      hasHargaColumn
                        ? hargaExcel ?? 0
                        : 0,

                    aktif: true,
                  },
                }
              );

              /*
               * Barang baru dianggap harga sudah
               * diproses jika kolom Harga tersedia.
               */
              if (
                hasHargaColumn
              ) {
                hargaDiupdate++;
              }
            }

            // =============================================
            // OUTLET STOCK
            // =============================================

            await tx.outletStock.upsert(
              {
                where: {
                  outletId_barangId:
                    {
                      outletId,
                      barangId:
                        barang.id,
                    },
                },

                update: {},

                create: {
                  outletId,
                  barangId:
                    barang.id,
                  stock: 0,

                  minimumStock:
                    barang.minimumStock ||
                    0,

                  averageCost:
                    barang.purchasePrice ||
                    0,
                },
              }
            );
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
    // 11. RESPONSE
    // =====================================================

    let message =
      `Import selesai. Berhasil: ${berhasil}, Dilewati: ${dilewati}, Gagal: ${gagal}.`;

    if (
      hasHargaColumn
    ) {
      message +=
        ` Harga diproses: ${hargaDiupdate} barang.`;
    } else {
      message +=
        " Kolom Harga tidak ditemukan, sehingga harga existing tidak diubah.";
    }

    return NextResponse.json(
      {
        success: true,

        message,

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

          /*
           * Informasi harga
           */
          hargaColumnDetected:
            hasHargaColumn,

          hargaDiupdate,

          hargaDipertahankan,
        },

        detail: {
          gagal:
            detailGagal,

          dilewati:
            detailLewati,
        },
      },

      {
        status: 200,
      }
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

      {
        status: 500,
      }
    );
  }
}