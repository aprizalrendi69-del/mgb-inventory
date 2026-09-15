import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * ============================================================
 * PARSE DATE ONLY
 * ============================================================
 */
function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const valueTrimmed = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(valueTrimmed)) {
    return null;
  }

  const [year, month, day] = valueTrimmed
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      12,
      0,
      0,
      0
    )
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await params;
    const deliveryId = Number(id);

    if (!Number.isInteger(deliveryId)) {
      return NextResponse.json(
        {
          success: false,
          message: "ID Delivery tidak valid",
        },
        { status: 400 }
      );
    }

    const delivery = await prisma.delivery.findUnique({
      where: {
        id: deliveryId,
      },

      include: {
        customer: true,

        outlet: true,

        items: {
          include: {
            barang: {
              include: {
                priceSummary: true,
              },
            },
          },

          orderBy: {
            id: "asc",
          },
        },
      },
    });

    if (!delivery) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Data barang keluar tidak ditemukan",
        },
        { status: 404 }
      );
    }

    // =====================================================
    // NORMALISASI HARGA
    // =====================================================

    const normalizedItems = delivery.items.map(
      (item) => {
        const qty = Number(item.qty ?? 0);

        const deliveryPrice =
          Number(item.price ?? 0);

        const summaryPrice = Number(
          item.barang?.priceSummary?.lastPrice ?? 0
        );

        const sellingPrice = Number(
          item.barang?.sellingPrice ?? 0
        );

        let price = 0;

        if (deliveryPrice > 0) {
          price = deliveryPrice;
        } else if (summaryPrice > 0) {
          price = summaryPrice;
        } else if (sellingPrice > 0) {
          price = sellingPrice;
        }

        const subtotal = qty * price;

        return {
          ...item,

          price,

          subtotal,

          barang: {
            ...item.barang,

            priceSummary: undefined,
          },
        };
      }
    );

    return NextResponse.json({
      success: true,

      data: {
        ...delivery,

        items: normalizedItems,
      },
    });
  } catch (error: any) {
    console.error(
      "GET BARANG KELUAR ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil data barang keluar",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await params;
    const deliveryId = Number(id);

    if (!Number.isInteger(deliveryId)) {
      return NextResponse.json(
        {
          success: false,
          message: "ID Delivery tidak valid",
        },
        { status: 400 }
      );
    }

    const body = await req.json();

    const existingDelivery =
      await prisma.delivery.findUnique({
        where: {
          id: deliveryId,
        },

        include: {
          items: true,
        },
      });

    if (!existingDelivery) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Data barang keluar tidak ditemukan",
        },
        { status: 404 }
      );
    }

    if (existingDelivery.status !== "DRAFT") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Delivery Order yang sudah RELEASED tidak dapat diedit",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // CUSTOMER
    // =====================================================

    const rawCustomerId =
      body.customerId ??
      body.customerID ??
      body.customer?.id ??
      existingDelivery.customerId;

    let customerId: number | null = null;

    if (
      rawCustomerId !== null &&
      rawCustomerId !== undefined &&
      rawCustomerId !== ""
    ) {
      customerId = Number(rawCustomerId);

      if (!customerId) {
        return NextResponse.json(
          {
            success: false,
            message: "Customer tidak valid",
          },
          { status: 400 }
        );
      }

      const customer =
        await prisma.customer.findUnique({
          where: {
            id: customerId,
          },
        });

      if (!customer) {
        return NextResponse.json(
          {
            success: false,
            message: "Customer tidak ditemukan",
          },
          { status: 400 }
        );
      }
    }

    // =====================================================
    // TANGGAL DELIVERY
    // =====================================================
    //
    // Jika frontend mengirim tanggal baru:
    //     update.
    //
    // Jika tidak:
    //     pertahankan tanggal lama.
    // =====================================================

    let deliveryDate =
      existingDelivery.deliveryDate;

    if (
      body.deliveryDate !== undefined &&
      body.deliveryDate !== null &&
      body.deliveryDate !== ""
    ) {
      const parsedDeliveryDate =
        parseDateOnly(body.deliveryDate);

      if (!parsedDeliveryDate) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Tanggal barang keluar tidak valid",
          },
          { status: 400 }
        );
      }

      deliveryDate = parsedDeliveryDate;
    }

    // =====================================================
    // REMARKS
    // =====================================================

    const remarks =
      body.remarks ??
      body.note ??
      body.keterangan ??
      existingDelivery.remarks ??
      null;

    // =====================================================
    // ITEMS
    // =====================================================

    const items =
      body.items ??
      body.detail ??
      body.details ??
      [];

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Minimal harus ada 1 barang",
        },
        { status: 400 }
      );
    }

    const normalizedItems: {
      barangId: number;
      qty: number;
      price: number;
      subtotal: number;
    }[] = [];

    let totalQty = 0;

    for (const item of items) {
      const barangId = Number(
        item.barangId ??
          item.barang?.id ??
          item.idBarang
      );

      const qty = Number(
        item.qty ??
          item.quantity ??
          item.jumlah
      );

      if (!barangId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Barang pada item tidak valid",
          },
          { status: 400 }
        );
      }

      if (!qty || qty <= 0) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Qty barang harus lebih dari 0",
          },
          { status: 400 }
        );
      }

      const barang =
        await prisma.barang.findUnique({
          where: {
            id: barangId,
          },

          include: {
            priceSummary: true,
          },
        });

      if (!barang) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang dengan ID ${barangId} tidak ditemukan`,
          },
          { status: 400 }
        );
      }

      // ===================================================
      // STOCK BELUM DIKURANGI
      // ===================================================

      if (Number(barang.stock) < qty) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Stock ${barang.name} tidak cukup. Stock tersedia: ${barang.stock}`,
          },
          { status: 400 }
        );
      }

      // ===================================================
      // ITEM LAMA
      // ===================================================

      const oldItem =
        existingDelivery.items.find(
          (old) =>
            old.barangId === barangId
        );

      // ===================================================
      // PRIORITAS HARGA
      // ===================================================

      const incomingPrice = Number(
        item.price ?? 0
      );

      const oldPrice = Number(
        oldItem?.price ?? 0
      );

      const summaryPrice = Number(
        barang.priceSummary?.lastPrice ?? 0
      );

      const sellingPrice = Number(
        barang.sellingPrice ?? 0
      );

      let price = 0;

      if (incomingPrice > 0) {
        price = incomingPrice;
      } else if (oldPrice > 0) {
        price = oldPrice;
      } else if (summaryPrice > 0) {
        price = summaryPrice;
      } else if (sellingPrice > 0) {
        price = sellingPrice;
      }

      const subtotal = qty * price;

      normalizedItems.push({
        barangId,
        qty,
        price,
        subtotal,
      });

      totalQty += qty;
    }

    // =====================================================
    // SIMPAN
    // =====================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          await tx.deliveryItem.deleteMany({
            where: {
              deliveryId,
            },
          });

          for (const item of normalizedItems) {
            await tx.deliveryItem.create({
              data: {
                deliveryId,
                barangId: item.barangId,
                qty: item.qty,
                price: item.price,
                subtotal: item.subtotal,
              },
            });
          }

          return await tx.delivery.update({
            where: {
              id: deliveryId,
            },

            data: {
              customerId,
              deliveryDate,
              remarks,
              totalQty,
              status: "DRAFT",
            },

            include: {
              customer: true,
              outlet: true,

              items: {
                include: {
                  barang: true,
                },

                orderBy: {
                  id: "asc",
                },
              },
            },
          });
        }
      );

    return NextResponse.json({
      success: true,

      message:
        "Barang keluar berhasil disimpan",

      data: result,
    });
  } catch (error: any) {
    console.error(
      "PUT BARANG KELUAR ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal menyimpan perubahan",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await params;
    const deliveryId = Number(id);

    if (!Number.isInteger(deliveryId)) {
      return NextResponse.json(
        {
          success: false,
          message: "ID Delivery tidak valid",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      async (tx) => {
        const delivery =
          await tx.delivery.findUnique({
            where: {
              id: deliveryId,
            },
          });

        if (!delivery) {
          throw new Error(
            "Data barang keluar tidak ditemukan"
          );
        }

        if (delivery.status !== "DRAFT") {
          throw new Error(
            "Delivery Order yang sudah RELEASED tidak dapat dihapus"
          );
        }

        await tx.deliveryItem.deleteMany({
          where: {
            deliveryId,
          },
        });

        await tx.suratJalan.deleteMany({
          where: {
            deliveryId,
          },
        });

        await tx.delivery.delete({
          where: {
            id: deliveryId,
          },
        });
      }
    );

    return NextResponse.json({
      success: true,

      message:
        "Draft barang keluar berhasil dihapus",
    });
  } catch (error: any) {
    console.error(
      "DELETE BARANG KELUAR ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal menghapus draft barang keluar",
      },
      { status: 500 }
    );
  }
}