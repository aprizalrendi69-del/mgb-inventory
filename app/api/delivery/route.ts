import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DeliveryStatus, HistoryType } from "@prisma/client";
import { cookies } from "next/headers";

// =====================================================
// GET
// =====================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const outletIdParam = searchParams.get("outletId");

    const where: any = {};

    if (outletIdParam) {
      where.outletId = Number(outletIdParam);
    }

    const data = await prisma.delivery.findMany({
      where,

      orderBy: {
        deliveryDate: "desc",
      },

      include: {
        customer: true,

        outlet: true,

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
  } catch (error: any) {
    console.error("GET DELIVERY ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil Delivery Order",
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
      customerId,
      outletId,
      items,
      remarks,
    } = body;

    // ===================================================
    // VALIDASI CUSTOMER
    // ===================================================

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

    // ===================================================
    // VALIDASI BARANG
    // ===================================================

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

    // ===================================================
    // CEK CUSTOMER
    // ===================================================

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

    // ===================================================
    // CEK OUTLET
    // ===================================================

    let outlet: any = null;

    if (outletId) {
      outlet = await prisma.outlet.findUnique({
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
    }

    // ===================================================
    // GENERATE NUMBER
    // ===================================================

    const totalDelivery = await prisma.delivery.count();

    const number =
      "DO-" +
      String(totalDelivery + 1).padStart(5, "0");

    // ===================================================
    // HITUNG BARANG + HARGA
    // ===================================================

    let totalQty = 0;
    let grandTotal = 0;

    const deliveryItems: {
      barangId: number;
      qty: number;
      price: number;
      subtotal: number;
      note: string | null;
    }[] = [];

    for (const item of items) {
      const barangId = Number(item.barangId);
      const qty = Number(item.qty);

      if (!Number.isFinite(barangId)) {
        return NextResponse.json(
          {
            success: false,
            message: "Barang tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      if (!Number.isFinite(qty) || qty <= 0) {
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

      const barang = await prisma.barang.findUnique({
        where: {
          id: barangId,
        },
      });

      if (!barang) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang ID ${barangId} tidak ditemukan`,
          },
          {
            status: 404,
          }
        );
      }

      // =================================================
      // HARGA
      // Prioritas:
      // 1. harga yang dikirim dari form
      // 2. sellingPrice barang
      // 3. purchasePrice barang
      // =================================================

      let price = Number(item.price);

      if (!Number.isFinite(price) || price <= 0) {
        price = Number(barang.sellingPrice ?? 0);
      }

      if (!Number.isFinite(price) || price <= 0) {
        price = Number(barang.purchasePrice ?? 0);
      }

      const subtotal = qty * price;

      totalQty += qty;
      grandTotal += subtotal;

      deliveryItems.push({
        barangId,
        qty,
        price,
        subtotal,
        note: item.note ?? null,
      });
    }

    // ===================================================
    // TRANSACTION
    // ===================================================

    const delivery = await prisma.$transaction(
      async (tx) => {
        const result =
          await tx.delivery.create({
            data: {
              number,

              customerId:
                Number(customerId),

              outletId: outletId
                ? Number(outletId)
                : null,

              remarks,

              totalQty,

              status:
                DeliveryStatus.DRAFT,

              items: {
                create:
                  deliveryItems.map(
                    (item) => ({
                      barangId:
                        item.barangId,

                      qty:
                        item.qty,

                      price:
                        item.price,

                      subtotal:
                        item.subtotal,

                      note:
                        item.note,
                    })
                  ),
              },
            },

            include: {
              customer: true,

              outlet: true,

              items: {
                include: {
                  barang: true,
                },
              },
            },
          });

        // =================================================
        // HISTORY
        // =================================================

        let userId: number | null = null;

        try {
          const cookieStore =
            await cookies();

          const session =
            cookieStore.get(
              "erp-session"
            );

          if (session) {
            const sessionData =
              JSON.parse(
                session.value
              );

            userId =
              Number(
                sessionData.id
              );
          }
        } catch {}

        await tx.history.create({
          data: {
            transactionType:
              HistoryType.DELIVERY,

            referenceNumber:
              result.number,

            description:
              `Membuat Delivery Order ${result.number}`,

            userId,
          },
        });

        return result;
      }
    );

    return NextResponse.json({
      success: true,

      message:
        "Delivery Order berhasil dibuat",

      data: delivery,
    });
  } catch (error: any) {
    console.error(
      "POST DELIVERY ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal membuat Delivery Order",
      },
      {
        status: 500,
      }
    );
  }
}