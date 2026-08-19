import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search")?.trim() || "";

    const where = search
      ? {
          active: true,
          OR: [
            {
              code: {
                contains: search,
              },
            },
            {
              name: {
                contains: search,
              },
            },
            {
              barcode: {
                contains: search,
              },
            },
          ],
        }
      : {
          active: true,
        };

    const barang = await prisma.barang.findMany({
      where,
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        code: true,
        name: true,
        unit: true,
        barcode: true,
        stock: true,
        minimumStock: true,
        purchasePrice: true,
        inventory: {
          select: {
            stock: true,
            minimumStock: true,
            averageCost: true,
            lastPurchase: true,
            availableStock: true,
            reservedStock: true,
          },
        },
      },
    });

    const barangIds = barang.map((item) => item.id);

    /*
     * =====================================================
     * STOCK OPNAME TERAKHIR PUSAT
     *
     * Stock Opname pusat = opname tanpa outletId.
     * Pada schema yang sekarang outletId bersifat optional.
     * =====================================================
     */
    const opnameItems =
      barangIds.length > 0
        ? await prisma.stockOpnameItem.findMany({
            where: {
              barangId: {
                in: barangIds,
              },
              opname: {
                outletId: null,
                status: {
                  in: [
                    "APPROVED",
                    "COUNTING",
                    "PENDING",
                  ],
                },
              },
            },
            orderBy: {
              opname: {
                date: "desc",
              },
            },
            select: {
              id: true,
              barangId: true,
              systemQty: true,
              physicalQty: true,
              difference: true,
              note: true,
              opname: {
                select: {
                  id: true,
                  code: true,
                  date: true,
                  status: true,
                },
              },
            },
          })
        : [];

    const lastOpnameMap = new Map<
      number,
      {
        opnameId: number;
        code: string;
        date: Date;
        status: string;
        systemQty: number;
        physicalQty: number;
        difference: number;
        note: string | null;
      }
    >();

    for (const item of opnameItems) {
      if (!lastOpnameMap.has(item.barangId)) {
        lastOpnameMap.set(item.barangId, {
          opnameId: item.opname.id,
          code: item.opname.code,
          date: item.opname.date,
          status: item.opname.status,
          systemQty: Number(item.systemQty || 0),
          physicalQty: Number(item.physicalQty || 0),
          difference: Number(item.difference || 0),
          note: item.note ?? null,
        });
      }
    }

    const data = barang.map((item) => {
      /*
       * Stock utama tetap mengambil Barang.stock.
       *
       * Inventory digunakan sebagai fallback / informasi
       * tambahan apabila tersedia.
       */
      const systemStock = Number(
        item.stock ?? item.inventory?.stock ?? 0
      );

      const minimumStock = Number(
        item.minimumStock ??
          item.inventory?.minimumStock ??
          0
      );

      return {
        id: item.id,
        barangId: item.id,
        stock: systemStock,
        minimumStock,
        averageCost: Number(
          item.inventory?.averageCost ??
            item.purchasePrice ??
            0
        ),

        barang: {
          id: item.id,
          code: item.code,
          name: item.name,
          unit: item.unit,
          barcode: item.barcode,
        },

        lastOpname:
          lastOpnameMap.get(item.id) ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("GET CENTRAL STOCK ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        data: [],
        message:
          error?.message ||
          "Gagal mengambil stock pusat",
      },
      {
        status: 500,
      }
    );
  }
}