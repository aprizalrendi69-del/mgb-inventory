import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DeliveryStatus, HistoryType } from "@prisma/client";

export async function GET() {
  try {
    const data = await prisma.delivery.findMany({
      orderBy: {
        deliveryDate: "desc",
      },
      include: {
        customer: true,
        items: {
          include: {
            barang: true,
          },
        },
        suratJalan: true,
      },
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil Delivery Order",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { customerId, items, remarks } = body;

    if (!customerId) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer wajib dipilih",
        },
        {
          status: 400,
        }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Barang belum dipilih",
        },
        {
          status: 400,
        }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: {
        id: Number(customerId),
      },
    });

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    let totalQty = 0;

    for (const item of items) {
      const barang = await prisma.barang.findUnique({
        where: {
          id: Number(item.barangId),
        },
      });

      if (!barang) {
        return NextResponse.json(
          {
            success: false,
            message: `Barang ID ${item.barangId} tidak ditemukan`,
          },
          {
            status: 404,
          }
        );
      }

      if (Number(item.qty) <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Qty harus lebih dari 0",
          },
          {
            status: 400,
          }
        );
      }

      totalQty += Number(item.qty);
    }

    const total = await prisma.delivery.count();

    const number =
      "DO-" +
      String(total + 1).padStart(5, "0");

    const delivery = await prisma.$transaction(async (tx) => {
      const result = await tx.delivery.create({
        data: {
          number,
          customerId: Number(customerId),
          remarks,
          totalQty,
          status: DeliveryStatus.DRAFT,

          items: {
            create: items.map((item: any) => ({
              barangId: Number(item.barangId),
              qty: Number(item.qty),
              note: item.note ?? null,
            })),
          },
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

      await tx.history.create({
        data: {
          transactionType: HistoryType.DELIVERY,
          referenceNumber: result.number,
          description: `Membuat Delivery Order ${result.number}`,
        },
      });

      return result;
    });

    return NextResponse.json({
      success: true,
      message: "Delivery Order berhasil dibuat",
      data: delivery,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal membuat Delivery Order",
      },
      {
        status: 500,
      }
    );
  }
}