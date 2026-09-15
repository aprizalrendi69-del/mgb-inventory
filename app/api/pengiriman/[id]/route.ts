import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await context.params;

    const pengirimanId = Number(id);

    if (!Number.isInteger(pengirimanId) || pengirimanId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "ID pengiriman tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const data = await prisma.delivery.findUnique({
      where: {
        id: pengirimanId,
      },

      include: {
        customer: true,

        outlet: true,

        suratJalan: true,

        items: {
          orderBy: {
            id: "asc",
          },

          include: {
            barang: true,

            voidedBy: {
              select: {
                id: true,
                username: true,
                fullname: true,
              },
            },
          },
        },
      },
    });

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          message: "Data pengiriman tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * ============================================================
     * HITUNG QTY AKTIF DAN QTY VOID
     * ============================================================
     *
     * Item TIDAK dihapus ketika VOID.
     *
     * Contoh:
     *
     * Ayam 10
     * -> void
     *
     * tetap tampil:
     * Ayam 10 | VOID
     *
     * sehingga histori Surat Jalan tetap utuh.
     */

    let totalQtyAktif = 0;
    let totalQtyVoid = 0;

    const items = data.items.map((item) => {
      const qty = Number(item.qty) || 0;

      if (item.voided) {
        totalQtyVoid += qty;
      } else {
        totalQtyAktif += qty;
      }

      return {
        id: item.id,

        deliveryId: item.deliveryId,

        barangId: item.barangId,

        barang: item.barang,

        qty,

        price: Number(item.price) || 0,

        subtotal: Number(item.subtotal) || 0,

        note: item.note,

        /*
         * ========================================================
         * STATUS VOID
         * ========================================================
         */

        voided: Boolean(item.voided),

        voidedAt: item.voidedAt,

        voidedById: item.voidedById,

        voidReason: item.voidReason,

        voidedBy: item.voidedBy
          ? {
              id: item.voidedBy.id,
              username: item.voidedBy.username,
              fullname: item.voidedBy.fullname,
            }
          : null,

        /*
         * ========================================================
         * FIELD FRONTEND
         * ========================================================
         */

        status: item.voided
          ? "VOID"
          : "ACTIVE",

        activeQty: item.voided
          ? 0
          : qty,

        voidedQty: item.voided
          ? qty
          : 0,

        activeSubtotal: item.voided
          ? 0
          : Number(item.subtotal) || 0,

        voidedSubtotal: item.voided
          ? Number(item.subtotal) || 0
          : 0,
      };
    });

    /*
     * ============================================================
     * RESPONSE
     * ============================================================
     */

    return NextResponse.json({
      success: true,

      data: {
        ...data,

        /*
         * Jangan kirim items mentah.
         * Gunakan items yang sudah dinormalisasi
         * agar frontend langsung bisa membedakan
         * ACTIVE / VOID.
         */

        items,

        /*
         * Ringkasan.
         */

        totalQtyAktif,

        totalQtyVoid,

        totalItemsAktif: items.filter(
          (item) => !item.voided
        ).length,

        totalItemsVoid: items.filter(
          (item) => item.voided
        ).length,

        /*
         * Apakah masih ada barang aktif?
         */

        hasActiveItems: items.some(
          (item) => !item.voided
        ),

        /*
         * Apakah semua item sudah VOID?
         */

        allItemsVoided:
          items.length > 0 &&
          items.every(
            (item) => item.voided
          ),
      },
    });
  } catch (error) {
    console.error(
      "DETAIL PENGIRIMAN ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Gagal mengambil detail pengiriman",
      },
      {
        status: 500,
      }
    );
  }
}