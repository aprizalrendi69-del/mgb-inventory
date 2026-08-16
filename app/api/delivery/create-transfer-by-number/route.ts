import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const number = String(body.number || "").trim();

    if (!number) {
      return NextResponse.json(
        {
          success: false,
          message: "Nomor Delivery wajib diisi",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // CARI DELIVERY
    // =====================================================

    const delivery = await prisma.delivery.findUnique({
      where: {
        number,
      },
      include: {
        customer: true,
        items: true,
      },
    });

    if (!delivery) {
      return NextResponse.json(
        {
          success: false,
          message: `Delivery ${number} tidak ditemukan`,
        },
        { status: 404 }
      );
    }

    // =====================================================
    // DELIVERY HARUS SUDAH RELEASED
    // =====================================================

    if (delivery.status !== "RELEASED") {
      return NextResponse.json(
        {
          success: false,
          message: `Delivery ${number} belum RELEASED`,
        },
        { status: 400 }
      );
    }

    if (!delivery.items.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Delivery tidak memiliki item",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // CARI OUTLET BERDASARKAN CUSTOMER
    //
    // Customer yang sekarang dipakai sebagai outlet.
    // Prioritas:
    // 1. customer.code = outlet.code
    // 2. customer.name = outlet.name
    // =====================================================

    let outlet = null;

    if (delivery.customer?.code) {
      outlet = await prisma.outlet.findUnique({
        where: {
          code: delivery.customer.code,
        },
      });
    }

    if (!outlet && delivery.customer?.name) {
      outlet = await prisma.outlet.findFirst({
        where: {
          name: delivery.customer.name,
        },
      });
    }

    if (!outlet) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Customer "${delivery.customer?.name || "-"}" belum terhubung dengan Outlet. ` +
            `Pastikan Code Customer sama dengan Code Outlet.`,
        },
        { status: 400 }
      );
    }

    // =====================================================
    // CEK TRANSFER SUDAH ADA
    // =====================================================

    const existingTransfer =
      await prisma.outletTransfer.findFirst({
        where: {
          outletId: outlet.id,
          remarks: {
            contains: delivery.number,
          },
        },
        include: {
          items: true,
          outlet: true,
        },
      });

    if (existingTransfer) {
      return NextResponse.json({
        success: true,
        message: "Outlet Transfer sudah dibuat sebelumnya",
        data: existingTransfer,
      });
    }

    // =====================================================
    // BUAT TRANSFER
    // =====================================================

    const transferNumber =
      "TRF-" +
      new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "") +
      "-" +
      delivery.id;

    const transfer = await prisma.outletTransfer.create({
      data: {
        number: transferNumber,
        outletId: outlet.id,
        status: "SENT",
        remarks:
          `Pengiriman ${delivery.number} dari gudang`,
        items: {
          create: delivery.items.map((item) => ({
            barangId: item.barangId,
            qty: Number(item.qty),
            receivedQty: 0,
          })),
        },
      },

      include: {
        outlet: true,
        items: {
          include: {
            barang: true,
          },
        },
      },
    });

    // =====================================================
    // UPDATE DELIVERY.OUTLETID
    // =====================================================

    await prisma.delivery.update({
      where: {
        id: delivery.id,
      },
      data: {
        outletId: outlet.id,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        `Transfer ${transfer.number} berhasil dibuat untuk outlet ${outlet.name}`,
      data: transfer,
    });
  } catch (error: any) {
    console.error(
      "CREATE OUTLET TRANSFER ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal membuat transfer outlet",
      },
      { status: 500 }
    );
  }
}