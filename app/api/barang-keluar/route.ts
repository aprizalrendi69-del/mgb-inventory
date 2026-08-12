import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      customerId,
      note,
      items,
    } = body;

    // =====================================================
    // VALIDASI
    // =====================================================

    if (
      !customerId ||
      !items ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Data tidak lengkap",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // TRANSACTION
    // =====================================================

    const result = await prisma.$transaction(async (tx) => {
      // ===================================================
      // NOMOR DELIVERY
      // ===================================================

      const count = await tx.delivery.count();

      const number =
        `DO-${String(count + 1).padStart(5, "0")}`;

      let totalQty = 0;

      // ===================================================
      // CREATE DELIVERY
      // ===================================================

      const delivery = await tx.delivery.create({
        data: {
          number,
          customerId: Number(customerId),

          // PENTING:
          // Saat pertama disimpan masih DRAFT.
          // Belum ada transaksi stock.
          status: "DRAFT",

          remarks: note || null,
          totalQty: 0,
        },
      });

      // ===================================================
      // PROCESS ITEMS
      // ===================================================

      for (const item of items) {
        const barangId = Number(item.barangId);
        const keluarQty = Number(item.qty);

        if (
          !barangId ||
          !keluarQty ||
          keluarQty <= 0
        ) {
          throw new Error(
            "Data barang keluar tidak valid"
          );
        }

        // =================================================
        // AMBIL BARANG
        // =================================================

        const barang = await tx.barang.findUnique({
          where: {
            id: barangId,
          },
        });

        if (!barang) {
          throw new Error(
            `Barang dengan ID ${barangId} tidak ditemukan`
          );
        }

        // =================================================
        // VALIDASI STOCK
        //
        // HANYA CEK.
        // TIDAK MENGURANGI STOCK.
        // =================================================

        if (Number(barang.stock) < keluarQty) {
          throw new Error(
            `Stock ${barang.name} tidak cukup. Stock tersedia: ${barang.stock}`
          );
        }

        // =================================================
        // HARGA TRANSAKSI
        //
        // Harga disimpan di DeliveryItem supaya:
        // - tetap tersedia saat print Surat Jalan
        // - tidak berubah kalau harga master berubah
        // =================================================

        const price = Number(barang.sellingPrice ?? 0);

        const subtotal = price * keluarQty;

        // =================================================
        // CREATE DELIVERY ITEM
        //
        // HANYA MENYIMPAN DATA TRANSAKSI.
        //
        // TIDAK:
        // - FEFO
        // - Kurangi BatchStock
        // - Kurangi Barang.stock
        // - Inventory
        // - StockCard
        // - StockMutation
        // =================================================

        await tx.deliveryItem.create({
          data: {
            deliveryId: delivery.id,
            barangId: barang.id,
            qty: keluarQty,
            price,
            subtotal,
          },
        });

        totalQty += keluarQty;
      }

      // ===================================================
      // UPDATE TOTAL DELIVERY
      // ===================================================

      await tx.delivery.update({
        where: {
          id: delivery.id,
        },
        data: {
          totalQty,
        },
      });

      // ===================================================
      // JANGAN BUAT STOCK HISTORY DI SINI
      //
      // History transaksi stock baru dibuat saat RELEASE.
      // ===================================================

      return await tx.delivery.findUnique({
        where: {
          id: delivery.id,
        },
        include: {
          customer: true,
          items: {
            include: {
              barang: true,
            },
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Barang keluar berhasil disimpan sebagai DRAFT",
      data: result,
    });
  } catch (error: any) {
    console.error(
      "BARANG KELUAR DRAFT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal menyimpan barang keluar",
      },
      {
        status: 500,
      }
    );
  }
}