import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ids = searchParams.get("ids");

    const include = {
      // =====================================================
      // BATCH STOCK
      // =====================================================

      batchStocks: {
        where: {
          qty: {
            gt: 0,
          },
        },
        orderBy: {
          expiredDate: "asc" as const,
        },
        select: {
          id: true,
          batchNumber: true,
          expiredDate: true,
          qty: true,
        },
      },

      // =====================================================
      // RECEIPT ITEM TERAKHIR
      // Barang -> ReceiptItem -> Receipt -> Supplier
      // =====================================================

      receiptItems: {
        orderBy: {
          receipt: {
            receiptDate: "desc" as const,
          },
        },

        take: 1,

        select: {
          receipt: {
            select: {
              supplier: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    };

    // =====================================================
    // GET BARANG
    // =====================================================

    let barang;

    if (ids) {
      const idList = ids
        .split(",")
        .map((id) => Number(id))
        .filter((id) => !Number.isNaN(id));

      barang = await prisma.barang.findMany({
        where: {
          id: {
            in: idList,
          },
        },
        include,
        orderBy: {
          code: "asc",
        },
      });
    } else {
      barang = await prisma.barang.findMany({
        include,
        orderBy: {
          code: "asc",
        },
      });
    }

    // =====================================================
    // FORMAT DATA
    // =====================================================

    const result = barang.map((item) => {
      const lastReceiptItem = item.receiptItems?.[0];

      const supplier =
        lastReceiptItem?.receipt?.supplier ?? null;

      return {
        ...item,

        supplier: supplier
          ? {
              id: supplier.id,
              code: supplier.code,
              name: supplier.name,
            }
          : null,

        receiptItems: undefined,
      };
    });

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("GET BARCODE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil data barcode",
      },
      {
        status: 500,
      }
    );
  }
}