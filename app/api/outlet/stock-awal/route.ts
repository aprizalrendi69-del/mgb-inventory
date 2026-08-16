import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// =====================================================
// GET
// =====================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const outletId = searchParams.get("outletId");

    const data = await prisma.outletStock.findMany({
      where: outletId
        ? {
            outletId: Number(outletId),
          }
        : undefined,

      include: {
        outlet: true,
        barang: true,
      },

      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("GET STOCK AWAL OUTLET ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil stock outlet",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// POST
// =====================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      outletId,
      barangId,
      qty,
      averageCost,
      minimumStock,
    } = body;

    // ===================================================
    // VALIDASI
    // ===================================================

    if (!outletId || !barangId) {
      return NextResponse.json(
        {
          success: false,
          message: "Outlet dan barang wajib dipilih",
        },
        {
          status: 400,
        }
      );
    }

    const jumlah = Number(qty);
    const harga = Number(averageCost ?? 0);
    const minimum = Number(minimumStock ?? 0);

    if (!Number.isFinite(jumlah) || jumlah < 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Qty stock awal tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    if (!Number.isFinite(harga) || harga < 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Harga modal tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // CEK OUTLET
    // ===================================================

    const outlet = await prisma.outlet.findUnique({
      where: {
        id: Number(outletId),
      },
    });

    if (!outlet) {
      return NextResponse.json(
        {
          success: false,
          message: "Outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // ===================================================
    // CEK BARANG
    // ===================================================

    const barang = await prisma.barang.findUnique({
      where: {
        id: Number(barangId),
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

    // ===================================================
    // TRANSACTION
    // ===================================================

    const result = await prisma.$transaction(
      async (tx) => {
        const existing =
          await tx.outletStock.findUnique({
            where: {
              outletId_barangId: {
                outletId: Number(outletId),
                barangId: Number(barangId),
              },
            },
          });

        // =================================================
        // BELUM ADA STOCK
        // =================================================

        if (!existing) {
          return await tx.outletStock.create({
            data: {
              outletId: Number(outletId),
              barangId: Number(barangId),
              stock: jumlah,
              minimumStock:
                minimum > 0
                  ? minimum
                  : Number(barang.minimumStock ?? 0),
              averageCost: harga,
            },
            include: {
              outlet: true,
              barang: true,
            },
          });
        }

        // =================================================
        // SUDAH ADA
        // =================================================

        const stockLama = Number(existing.stock);
        const costLama = Number(
          existing.averageCost
        );

        const stockBaru =
          stockLama + jumlah;

        // Weighted average cost
        let costBaru = costLama;

        if (stockBaru > 0) {
          costBaru =
            (stockLama * costLama +
              jumlah * harga) /
            stockBaru;
        }

        return await tx.outletStock.update({
          where: {
            id: existing.id,
          },
          data: {
            stock: stockBaru,
            averageCost: costBaru,
            minimumStock:
              minimum > 0
                ? minimum
                : existing.minimumStock,
          },
          include: {
            outlet: true,
            barang: true,
          },
        });
      }
    );

    return NextResponse.json({
      success: true,
      message:
        "Stock awal outlet berhasil disimpan",
      data: result,
    });
  } catch (error: any) {
    console.error(
      "POST STOCK AWAL OUTLET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal menyimpan stock awal outlet",
      },
      {
        status: 500,
      }
    );
  }
}