import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PurchaseStatus } from "@prisma/client";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  req: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    const purchaseId = Number(id);

    if (!Number.isInteger(purchaseId)) {
      return NextResponse.json(
        {
          success: false,
          message: "ID Purchase tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const purchase = await prisma.purchase.findUnique({
      where: {
        id: purchaseId,
      },

      include: {
        supplier: true,

        items: {
          include: {
            barang: true,
          },
        },
      },
    });

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase Order tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,
      data: purchase,
    });
  } catch (error) {
    console.error("GET PURCHASE DETAIL ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil data Purchase Order",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    const purchaseId = Number(id);

    if (!Number.isInteger(purchaseId)) {
      return NextResponse.json(
        {
          success: false,
          message: "ID Purchase tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const body = await req.json();

    const {
      supplierId,
      remarks,
      items,
    } = body;

    if (!supplierId) {
      return NextResponse.json(
        {
          success: false,
          message: "Supplier wajib dipilih",
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
          message: "Item Purchase kosong",
        },
        {
          status: 400,
        }
      );
    }

    const purchase = await prisma.purchase.findUnique({
      where: {
        id: purchaseId,
      },
    });

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase Order tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    if (purchase.status !== PurchaseStatus.DRAFT) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Order yang sudah APPROVED tidak boleh diubah",
        },
        {
          status: 400,
        }
      );
    }

    const supplier = await prisma.supplier.findUnique({
      where: {
        id: Number(supplierId),
      },
    });

    if (!supplier) {
      return NextResponse.json(
        {
          success: false,
          message: "Supplier tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    let total = 0;

    for (const item of items) {
      const barangId = Number(item.barangId);
      const qty = Number(item.qty);
      const price = Number(item.price);

      if (
        !barangId ||
        qty <= 0 ||
        price <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Barang, Qty, dan Harga harus valid",
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

      total += qty * price;
    }

    const result = await prisma.$transaction(
      async (tx) => {
        await tx.purchaseItem.deleteMany({
          where: {
            purchaseId: purchase.id,
          },
        });

        const update = await tx.purchase.update({
          where: {
            id: purchase.id,
          },

          data: {
            supplierId: Number(supplierId),
            remarks: remarks || null,
            total,

            items: {
              create: items.map((item: any) => {
                const qty = Number(item.qty);
                const price = Number(item.price);

                return {
                  barangId: Number(item.barangId),
                  qty,
                  price,
                  subtotal: qty * price,
                };
              }),
            },
          },

          include: {
            supplier: true,

            items: {
              include: {
                barang: true,
              },
            },
          },
        });

        await tx.history.create({
          data: {
            transactionType: "PURCHASE",
            referenceNumber: update.number,
            description:
              "Edit Purchase Order " +
              update.number,
          },
        });

        return update;
      }
    );

    return NextResponse.json({
      success: true,
      message: "Purchase Order berhasil diubah",
      data: result,
    });
  } catch (error) {
    console.error("PUT PURCHASE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengubah Purchase Order",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    const purchaseId = Number(id);

    if (!Number.isInteger(purchaseId)) {
      return NextResponse.json(
        {
          success: false,
          message: "ID Purchase tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const purchase = await prisma.purchase.findUnique({
      where: {
        id: purchaseId,
      },
    });

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase Order tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    if (purchase.status !== PurchaseStatus.DRAFT) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Order yang sudah diapprove tidak boleh dihapus",
        },
        {
          status: 400,
        }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.purchaseItem.deleteMany({
        where: {
          purchaseId: purchase.id,
        },
      });

      await tx.purchase.delete({
        where: {
          id: purchase.id,
        },
      });

      await tx.history.create({
        data: {
          transactionType: "PURCHASE",
          referenceNumber: purchase.number,
          description:
            "Hapus Purchase Order " +
            purchase.number,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Purchase Order berhasil dihapus",
    });
  } catch (error) {
    console.error("DELETE PURCHASE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal menghapus Purchase Order",
      },
      {
        status: 500,
      }
    );
  }
}