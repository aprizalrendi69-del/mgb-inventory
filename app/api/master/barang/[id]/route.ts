import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const barang = await prisma.barang.findUnique({
      where: {
        id: Number(id),
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
      "GET MASTER BARANG ERROR:",
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

    if (!body.name?.trim()) {
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

    if (!body.unit?.trim()) {
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

    const conversionRate =
      Number(body.conversionRate ?? 1) || 1;

    if (conversionRate <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Konversi harus lebih besar dari 0",
        },
        {
          status: 400,
        }
      );
    }

    const barang =
      await prisma.$transaction(async (tx) => {
        const existing =
          await tx.barang.findUnique({
            where: {
              id: barangId,
            },
          });

        if (!existing) {
          throw new Error(
            "BARANG_NOT_FOUND"
          );
        }

        const updateBarang =
          await tx.barang.update({
            where: {
              id: barangId,
            },

            data: {
              // Kode tetap mengikuti data lama.
              // Halaman edit memang men-disable kode.
              code:
                existing.code,

              barcode:
                body.barcode?.trim() || null,

              name:
                body.name.trim(),

              category:
                body.category?.trim() || null,

              unit:
                body.unit.trim(),

              // SATUAN DASAR
              baseUnit:
                body.baseUnit?.trim() ||
                body.unit.trim(),

              // KONVERSI
              conversionRate,

              minimumStock:
                Number(
                  body.minimumStock ??
                    body.minStock ??
                    0
                ),

              purchasePrice:
                Number(
                  body.purchasePrice ?? 0
                ),

              sellingPrice:
                Number(
                  body.sellingPrice ?? 0
                ),

              hasExpired:
                Boolean(body.hasExpired),
            },
          });

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
              minimumStock:
                Number(
                  body.minimumStock ??
                    body.minStock ??
                    0
                ),
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

              minimumStock:
                Number(
                  body.minimumStock ??
                    body.minStock ??
                    0
                ),

              maximumStock: 0,

              lastPurchase:
                updateBarang.purchasePrice,

              averageCost:
                updateBarang.purchasePrice,
            },
          });
        }

        /*
         * HISTORY
         *
         * Edit master bukan STOCK_IN.
         *
         * HistoryType saat ini tidak mempunyai
         * MASTER_UPDATE, jadi jangan menggunakan
         * MASTER_UPDATE karena akan menyebabkan
         * Prisma validation error.
         */
        await tx.history.create({
          data: {
            transactionType:
              "MASTER_CREATE",

            referenceNumber:
              updateBarang.code,

            description:
              `Edit Master Barang ${updateBarang.name}`,
          },
        });

        return updateBarang;
      });

    return NextResponse.json({
      success: true,
      message: "Barang berhasil diupdate",
      data: barang,
    });
  } catch (error: any) {
    console.error(
      "PUT MASTER BARANG ERROR:",
      error
    );

    if (
      error?.message ===
      "BARANG_NOT_FOUND"
    ) {
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

    return NextResponse.json(
      {
        success: false,
        message: "Gagal update barang",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(
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
      await prisma.$transaction(async (tx) => {
        const item =
          await tx.barang.update({
            where: {
              id: barangId,
            },

            data: {
              active: false,
            },
          });

        await tx.history.create({
          data: {
            transactionType:
              "STOCK_OUT",

            referenceNumber:
              item.code,

            description:
              `Nonaktif Master Barang ${item.name}`,
          },
        });

        return item;
      });

    return NextResponse.json({
      success: true,
      message: "Barang berhasil dinonaktifkan",
      data: barang,
    });
  } catch (error) {
    console.error(
      "DELETE MASTER BARANG ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Gagal menghapus barang",
      },
      {
        status: 500,
      }
    );
  }
}