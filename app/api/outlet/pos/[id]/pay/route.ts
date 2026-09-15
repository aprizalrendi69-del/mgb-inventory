import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canOperateOutlet,
  getOutletActor,
  resolveOutletId,
} from "@/lib/outlet-access";

const fail = (
  message: string,
  status = 400
) =>
  NextResponse.json(
    {
      success: false,
      message,
    },
    { status }
  );

export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const actor =
      await getOutletActor();

    if (
      !actor ||
      !canOperateOutlet(actor)
    ) {
      return fail(
        "Tidak memiliki akses POS.",
        403
      );
    }

    const { id } = await params;

    const saleId = Number(id);

    if (!Number.isInteger(saleId) || saleId <= 0) {
      return fail(
        "ID transaksi tidak valid."
      );
    }

    const body =
      await req.json().catch(
        () => ({})
      );

    const outletId =
      resolveOutletId(
        actor,
        body?.outletId
      );

    if (!outletId) {
      return fail(
        "Outlet tidak valid."
      );
    }

    const sale =
      await prisma.outletSale.findUnique({
        where: {
          id: saleId,
        },
        include: {
          outlet: true,
          items: {
            include: {
              menu: true,
              barang: true,
            },
          },
        },
      });

    if (!sale) {
      return fail(
        "Transaksi POS tidak ditemukan.",
        404
      );
    }

    if (
      sale.outletId !== outletId
    ) {
      return fail(
        "Transaksi bukan milik outlet ini.",
        403
      );
    }

    /**
     * Schema OutletSale sekarang:
     *
     * PAID
     * VOID
     *
     * Jadi transaksi sudah dianggap lunas
     * sejak POST /api/outlet/pos.
     */
    if (sale.status === "VOID") {
      return fail(
        "Transaksi POS sudah di-void.",
        409
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Transaksi POS sudah berstatus PAID. Tidak ada pemotongan stock ulang.",
      data: sale,
    });
  } catch (error: any) {
    console.error(
      "PAY POS ERROR",
      error
    );

    return fail(
      error?.message ||
        "Gagal memproses pembayaran POS.",
      500
    );
  }
}