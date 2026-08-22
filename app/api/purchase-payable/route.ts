import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/*
============================================================
GET PURCHASE PAYABLE
============================================================

SUMBER UTAMA:
- PurchasePayable

MENCAKUP:
- Purchase Pusat
- Purchase Outlet

PurchasePayable menjadi sumber resmi:
- amount
- paidAmount
- outstanding
- status

Payment tidak dihitung ulang di API ini.
Payment hanya ditampilkan oleh halaman sebagai
detail riwayat pembayaran.
============================================================
*/

export async function GET() {
  try {
    const payables =
      await prisma.purchasePayable.findMany({
        orderBy: {
          createdAt: "desc",
        },

        include: {
          supplier: true,
          outlet: true,

          purchase: {
            include: {
              supplier: true,
            },
          },

          outletPurchase: {
            include: {
              supplier: true,
              outlet: true,
            },
          },
        },
      });

    return NextResponse.json(
      payables
    );
  } catch (error) {
    console.error(
      "GET PURCHASE PAYABLE ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Gagal mengambil data Purchase Payable.",
      },
      {
        status: 500,
      }
    );
  }
}