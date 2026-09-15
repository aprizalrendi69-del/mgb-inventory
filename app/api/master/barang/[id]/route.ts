import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/*
 * =========================================================
 * MASTER BARANG DETAIL API
 * =========================================================
 *
 * GET    /api/master/barang/[id]
 * PUT    /api/master/barang/[id]
 * DELETE /api/master/barang/[id]
 *
 * DELETE = SOFT DELETE
 * -----------------------------------------
 * Barang tidak dihapus dari database.
 *
 * active = false
 *
 * DELETE TIDAK:
 * - menghapus row Barang
 * - mengurangi stock
 * - menambah STOCK_OUT
 * - menghapus Inventory
 * - menghapus OutletStock
 * - menghapus OutletBarang
 * - menghapus transaksi lama
 * - menghapus histori
 *
 * Tujuannya:
 * data transaksi lama tetap aman.
 *
 * =========================================================
 */


/*
 * =========================================================
 * NORMALIZE NAMA
 * =========================================================
 */

function normalizeName(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}


/*
 * =========================================================
 * NORMALIZE BARCODE
 * =========================================================
 */

function normalizeBarcode(value: unknown) {
  const valueString = String(value ?? "").trim();

  return valueString || null;
}


/*
 * =========================================================
 * SAFE NUMBER
 * =========================================================
 */

function safeNumber(
  value: unknown,
  fallback = 0
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return number;
}


/*
 * =========================================================
 * GET
 * =========================================================
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const barangId = Number(id);

    if (!Number.isInteger(barangId)) {
      return NextResponse.json(
        {
          success: false,
          message: "ID barang tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const barang =
      await prisma.barang.findUnique({
        where: {
          id: barangId,
        },

        include: {
          inventory: true,
          sourceOutlet: true,
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

    return NextResponse.json({
      success: true,
      data: barang,
    });
  } catch (error) {
    console.error(
      "GET MASTER BARANG DETAIL ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil data barang",
      },
      {
        status: 500,
      }
    );
  }
}


/*
 * =========================================================
 * PUT
 * =========================================================
 */

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const barangId = Number(id);

    if (!Number.isInteger(barangId)) {
      return NextResponse.json(
        {
          success: false,
          message: "ID barang tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const body = await req.json();

    /*
     * =====================================================
     * NORMALISASI INPUT
     * =====================================================
     */

    const name =
      String(body.name ?? "")
        .trim()
        .replace(/\s+/g, " ");

    const unit =
      String(body.unit ?? "")
        .trim()
        .replace(/\s+/g, " ");

    const baseUnit =
      String(
        body.baseUnit ??
          body.unit ??
          ""
      )
        .trim()
        .replace(/\s+/g, " ");

    const category =
      String(body.category ?? "")
        .trim()
        .replace(/\s+/g, " ");

    const barcode =
      normalizeBarcode(body.barcode);


    /*
     * =====================================================
     * VALIDASI DASAR
     * =====================================================
     */

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Nama Barang wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    if (!unit) {
      return NextResponse.json(
        {
          success: false,
          message: "Satuan wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    if (!baseUnit) {
      return NextResponse.json(
        {
          success: false,
          message: "Satuan dasar wajib diisi",
        },
        {
          status: 400,
        }
      );
    }


    /*
     * =====================================================
     * KONVERSI
     * =====================================================
     */

    const conversionRate =
      safeNumber(
        body.conversionRate,
        1
      );

    if (
      !Number.isFinite(conversionRate) ||
      conversionRate <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Konversi harus lebih besar dari 0",
        },
        {
          status: 400,
        }
      );
    }


    /*
     * =====================================================
     * CARI BARANG LAMA
     * =====================================================
     */

    const existing =
      await prisma.barang.findUnique({
        where: {
          id: barangId,
        },
      });

    if (!existing) {
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


    /*
     * =====================================================
     * CEK DUPLIKAT NAMA
     * =====================================================
     *
     * Hanya barang CENTRAL aktif.
     *
     * Contoh:
     *
     * Ayam Fillet
     * ayam fillet
     * AYAM FILLET
     *
     * dianggap sama.
     *
     * =====================================================
     */

    const centralItems =
      await prisma.barang.findMany({
        where: {
          source: "CENTRAL",
          active: true,

          NOT: {
            id: barangId,
          },
        },

        select: {
          id: true,
          code: true,
          name: true,
        },
      });

    const normalizedName =
      normalizeName(name);

    const duplicateName =
      centralItems.find(
        (item) =>
          normalizeName(item.name) ===
          normalizedName
      );

    if (duplicateName) {
      return NextResponse.json(
        {
          success: false,

          message:
            `Nama barang "${name}" sudah digunakan oleh kode ${duplicateName.code}. ` +
            `Gunakan nama barang yang berbeda.`,

          duplicate: {
            id: duplicateName.id,
            code: duplicateName.code,
            name: duplicateName.name,
          },
        },
        {
          status: 409,
        }
      );
    }


    /*
     * =====================================================
     * CEK BARCODE
     * =====================================================
     */

    if (barcode) {
      const duplicateBarcode =
        await prisma.barang.findFirst({
          where: {
            barcode,

            NOT: {
              id: barangId,
            },
          },

          select: {
            id: true,
            code: true,
            name: true,
          },
        });

      if (duplicateBarcode) {
        return NextResponse.json(
          {
            success: false,

            message:
              `Barcode sudah digunakan oleh barang ${duplicateBarcode.code} - ${duplicateBarcode.name}`,

            duplicate: {
              id: duplicateBarcode.id,
              code: duplicateBarcode.code,
              name: duplicateBarcode.name,
            },
          },
          {
            status: 409,
          }
        );
      }
    }


    /*
     * =====================================================
     * NORMALIZE ANGKA
     * =====================================================
     */

    const minimumStock =
      safeNumber(
        body.minimumStock ??
          body.minStock,
        0
      );

    const purchasePrice =
      safeNumber(
        body.purchasePrice,
        0
      );

    const sellingPrice =
      safeNumber(
        body.sellingPrice,
        0
      );


    if (minimumStock < 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Minimum stock tidak boleh negatif",
        },
        {
          status: 400,
        }
      );
    }

    if (purchasePrice < 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Harga beli tidak boleh negatif",
        },
        {
          status: 400,
        }
      );
    }

    if (sellingPrice < 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Harga jual tidak boleh negatif",
        },
        {
          status: 400,
        }
      );
    }


    /*
     * =====================================================
     * UPDATE TRANSACTION
     * =====================================================
     */

    const barang =
      await prisma.$transaction(
        async (tx) => {

          /*
           * ===============================================
           * UPDATE MASTER BARANG
           * ===============================================
           */

          const updateBarang =
            await tx.barang.update({
              where: {
                id: barangId,
              },

              data: {
                /*
                 * KODE TIDAK DIUBAH
                 */
                code: existing.code,

                /*
                 * BARCODE
                 */
                barcode,

                /*
                 * NAMA
                 */
                name,

                /*
                 * KATEGORI
                 */
                category:
                  category || null,

                /*
                 * SATUAN TRANSAKSI
                 */
                unit,

                /*
                 * SATUAN DASAR
                 */
                baseUnit,

                /*
                 * KONVERSI
                 */
                conversionRate,

                /*
                 * MINIMUM STOCK
                 */
                minimumStock,

                /*
                 * HARGA BELI
                 */
                purchasePrice,

                /*
                 * HARGA JUAL
                 */
                sellingPrice,

                /*
                 * EXPIRED
                 */
                hasExpired:
                  Boolean(
                    body.hasExpired
                  ),
              },
            });


          /*
           * ===============================================
           * UPDATE INVENTORY
           * ===============================================
           *
           * Stock TIDAK diubah.
           *
           * ===============================================
           */

          const inventory =
            await tx.inventory.findUnique({
              where: {
                barangId,
              },
            });


          if (inventory) {

            await tx.inventory.update({
              where: {
                barangId,
              },

              data: {
                minimumStock,
              },
            });

          } else {

            await tx.inventory.create({
              data: {
                barangId,

                warehouse: "MAIN",

                stock:
                  updateBarang.stock,

                availableStock:
                  updateBarang.stock,

                reservedStock: 0,

                minimumStock,

                maximumStock: 0,

                lastPurchase:
                  updateBarang.purchasePrice,

                averageCost:
                  updateBarang.purchasePrice,
              },
            });
          }


          /*
           * ===============================================
           * HISTORY
           * ===============================================
           *
           * Schema saat ini hanya memiliki:
           *
           * MASTER_CREATE
           *
           * Jadi jangan menggunakan enum yang tidak ada.
           *
           * ===============================================
           */

          await tx.history.create({
            data: {
              transactionType:
                "MASTER_CREATE",

              referenceNumber:
                updateBarang.code,

              description:
                `Edit Master Barang ${existing.name} menjadi ${updateBarang.name}`,
            },
          });


          return updateBarang;
        }
      );


    /*
     * =====================================================
     * RESPONSE
     * =====================================================
     */

    return NextResponse.json({
      success: true,

      message:
        "Barang berhasil diupdate",

      data: barang,
    });

  } catch (error: any) {

    console.error(
      "PUT MASTER BARANG ERROR:",
      error
    );


    if (
      error?.code === "P2025"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }


    /*
     * UNIQUE CONSTRAINT
     */

    if (
      error?.code === "P2002"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Data barang sudah digunakan oleh barang lain.",
        },
        {
          status: 409,
        }
      );
    }


    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal update barang",
      },
      {
        status: 500,
      }
    );
  }
}


/*
 * =========================================================
 * DELETE
 * =========================================================
 *
 * SOFT DELETE
 *
 * Barang:
 *
 * active = false
 *
 * =========================================================
 *
 * PENTING:
 *
 * Barang TIDAK perlu memiliki stock = 0 untuk dinonaktifkan.
 *
 * Kenapa?
 *
 * Karena DELETE bukan transaksi stock.
 *
 * Kita tidak boleh:
 *
 * - mengurangi stock
 * - membuat STOCK_OUT
 * - mengubah Inventory.stock
 * - mengubah OutletStock.stock
 *
 * =========================================================
 */

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {

    const { id } = await params;

    const barangId = Number(id);


    /*
     * =====================================================
     * VALIDASI ID
     * =====================================================
     */

    if (!Number.isInteger(barangId)) {
      return NextResponse.json(
        {
          success: false,
          message: "ID barang tidak valid",
        },
        {
          status: 400,
        }
      );
    }


    /*
     * =====================================================
     * CARI BARANG
     * =====================================================
     */

    const existing =
      await prisma.barang.findUnique({
        where: {
          id: barangId,
        },

        select: {
          id: true,
          code: true,
          name: true,
          active: true,
          stock: true,
          source: true,
        },
      });


    /*
     * =====================================================
     * TIDAK DITEMUKAN
     * =====================================================
     */

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }


    /*
     * =====================================================
     * SUDAH NONAKTIF
     * =====================================================
     */

    if (!existing.active) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Barang ${existing.code} - ${existing.name} sudah tidak aktif.`,
        },
        {
          status: 400,
        }
      );
    }


    /*
     * =====================================================
     * SOFT DELETE
     * =====================================================
     *
     * HANYA mengubah:
     *
     * active: true
     * menjadi
     * active: false
     *
     * =====================================================
     *
     * STOCK TETAP.
     *
     * =====================================================
     */

    const barang =
      await prisma.$transaction(
        async (tx) => {

          const item =
            await tx.barang.update({
              where: {
                id: barangId,
              },

              data: {
                active: false,
              },
            });


          /*
           * ===============================================
           * HISTORY
           * ===============================================
           *
           * Jangan gunakan:
           *
           * STOCK_OUT
           *
           * karena tidak ada stock yang keluar.
           *
           * Enum HistoryType saat ini belum memiliki
           * MASTER_DELETE / MASTER_UPDATE.
           *
           * ===============================================
           */

          await tx.history.create({
            data: {
              transactionType:
                "MASTER_CREATE",

              referenceNumber:
                item.code,

              description:
                `Nonaktif Master Barang ${item.code} - ${item.name}`,
            },
          });


          return item;
        }
      );


    /*
     * =====================================================
     * RESPONSE
     * =====================================================
     */

    return NextResponse.json(
      {
        success: true,

        message:
          `Barang ${barang.code} - ${barang.name} berhasil dinonaktifkan.`,

        data: barang,
      },
      {
        status: 200,
      }
    );

  } catch (error: any) {

    console.error(
      "DELETE MASTER BARANG ERROR:",
      error
    );


    /*
     * =====================================================
     * PRISMA RECORD NOT FOUND
     * =====================================================
     */

    if (
      error?.code === "P2025"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }


    /*
     * =====================================================
     * UNIQUE CONSTRAINT
     * =====================================================
     */

    if (
      error?.code === "P2002"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Data barang mengalami konflik pada database.",
        },
        {
          status: 409,
        }
      );
    }


    /*
     * =====================================================
     * ERROR LAIN
     * =====================================================
     */

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal menonaktifkan barang",
      },
      {
        status: 500,
      }
    );
  }
}