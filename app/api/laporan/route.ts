import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    // =========================
    // STOCK
    // =========================

    if (type === "stock") {
      const stock = await prisma.inventory.findMany({
        include: {
          barang: true,
        },
      });

      const data = stock.map((item) => ({
        id: item.id,
        number: item.barang?.kodeBarang ?? "-",
        name: item.barang?.name ?? "-",
        qty: item.stock ?? item.balance ?? 0,
        stock: item.stock ?? item.balance ?? 0,
        status: "ACTIVE",
        date: item.createdAt ?? null,
        barang: item.barang,
      }));

      return NextResponse.json({
        success: true,
        data,
      });
    }

    // =========================
    // BARANG MASUK
    // =========================

    if (type === "barang-masuk") {
      const masuk = await prisma.receipt.findMany({
        include: {
          supplier: true,
          items: {
            include: {
              barang: true,
            },
          },
        },
        orderBy: {
          receiptDate: "desc",
        },
      });

      const data = masuk.flatMap((receipt) =>
        receipt.items.map((item) => ({
          id: `${receipt.id}-${item.id}`,

          number:
            receipt.number ??
            receipt.receiptNumber ??
            `RECEIPT-${receipt.id}`,

          name:
            item.barang?.name ??
            item.barang?.namaBarang ??
            "-",

          qty:
            item.qty ??
            item.quantity ??
            item.receivedQty ??
            0,

          status: receipt.status ?? "RECEIVED",

          date: receipt.receiptDate,

          barang: item.barang,

          supplier: receipt.supplier,

          receipt,
          item,
        }))
      );

      return NextResponse.json({
        success: true,
        data,
      });
    }

    // =========================
    // BARANG KELUAR
    // =========================

    if (type === "barang-keluar") {
      const keluar = await prisma.delivery.findMany({
        include: {
          customer: true,
          items: {
            include: {
              barang: true,
            },
          },
        },
        orderBy: {
          deliveryDate: "desc",
        },
      });

      const data = keluar.flatMap((delivery) =>
        delivery.items.map((item) => ({
          id: `${delivery.id}-${item.id}`,

          number:
            delivery.number ??
            delivery.deliveryNumber ??
            `DO-${delivery.id}`,

          name:
            item.barang?.name ??
            item.barang?.namaBarang ??
            "-",

          qty:
            item.qty ??
            item.quantity ??
            0,

          status: delivery.status ?? "COMPLETED",

          date: delivery.deliveryDate,

          barang: item.barang,

          customer: delivery.customer,

          delivery,
          item,
        }))
      );

      return NextResponse.json({
        success: true,
        data,
      });
    }

    // =========================
    // PURCHASE
    // =========================

    if (type === "purchase") {
      const purchase = await prisma.purchase.findMany({
        include: {
          supplier: true,
          items: {
            include: {
              barang: true,
            },
          },
        },
        orderBy: {
          purchaseDate: "desc",
        },
      });

      const data = purchase.flatMap((po) =>
        po.items.map((item) => ({
          id: `${po.id}-${item.id}`,

          number:
            po.number ??
            `PO-${po.id}`,

          name:
            item.barang?.name ??
            item.barang?.namaBarang ??
            "-",

          qty:
            item.qty ??
            item.quantity ??
            0,

          status: po.status ?? "DRAFT",

          date: po.purchaseDate,

          barang: item.barang,

          supplier: po.supplier,

          purchase: po,
          item,
        }))
      );

      return NextResponse.json({
        success: true,
        data,
      });
    }

    // =========================
    // TYPE TIDAK DITEMUKAN
    // =========================

    return NextResponse.json({
      success: false,
      message: "Jenis laporan tidak ditemukan",
    });
  } catch (error) {
    console.error("LAPORAN ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil laporan",
      },
      {
        status: 500,
      }
    );
  }
}