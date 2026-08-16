import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();

    const session = cookieStore.get("erp-session");

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        {
          status: 401,
        }
      );
    }

    const sessionData = JSON.parse(session.value);

    const user = await prisma.user.findUnique({
      where: {
        id: sessionData.id,
      },
      select: {
        id: true,
        username: true,
        fullname: true,
        role: true,
        outletId: true,
        active: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "User tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    if (!user.active) {
      return NextResponse.json(
        {
          success: false,
          message: "User tidak aktif",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * =========================================================
     * USER PUSAT
     * =========================================================
     *
     * outletId = null
     *
     * Bisa melihat:
     * - Purchase Pusat
     * - Purchase Outlet 1
     * - Purchase Outlet 2
     * - Purchase Outlet 3
     * - Purchase Outlet 4
     * - Purchase Outlet 5
     */

    if (user.outletId === null) {
      const [
        purchasePusat,
        purchaseOutlet,
      ] = await Promise.all([
        prisma.purchase.findMany({
          include: {
            supplier: true,

            items: {
              include: {
                barang: true,
              },
            },
          },

          orderBy: {
            id: "desc",
          },
        }),

        prisma.outletPurchase.findMany({
          include: {
            outlet: true,

            supplier: true,

            items: {
              include: {
                barang: true,
              },
            },
          },

          orderBy: {
            id: "desc",
          },
        }),
      ]);

      const pusat = purchasePusat.map(
        (item) => ({
          ...item,

          source: "PUSAT",

          destinationType: "PUSAT",

          destinationId: null,

          destinationName:
            "Gudang Pusat",

          destinationCode: null,
        })
      );

      const outlet = purchaseOutlet.map(
        (item) => ({
          ...item,

          source: "OUTLET",

          destinationType: "OUTLET",

          destinationId:
            item.outletId,

          destinationName:
            item.outlet?.name || "-",

          destinationCode:
            item.outlet?.code || "-",
        })
      );

      const data = [
        ...pusat,
        ...outlet,
      ].sort((a, b) => {
        const dateA = new Date(
          a.purchaseDate
        ).getTime();

        const dateB = new Date(
          b.purchaseDate
        ).getTime();

        return dateB - dateA;
      });

      return NextResponse.json({
        success: true,
        data,
      });
    }

    /*
     * =========================================================
     * USER OUTLET
     * =========================================================
     *
     * outletId mempunyai nilai.
     *
     * Hanya boleh melihat Purchase Outlet
     * milik outlet tersebut.
     *
     * Tidak melihat Purchase Pusat.
     */

    const purchaseOutlet =
      await prisma.outletPurchase.findMany({
        where: {
          outletId: user.outletId,
        },

        include: {
          outlet: true,

          supplier: true,

          items: {
            include: {
              barang: true,
            },
          },
        },

        orderBy: {
          id: "desc",
        },
      });

    const data = purchaseOutlet.map(
      (item) => ({
        ...item,

        source: "OUTLET",

        destinationType: "OUTLET",

        destinationId:
          item.outletId,

        destinationName:
          item.outlet?.name || "-",

        destinationCode:
          item.outlet?.code || "-",
      })
    );

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "GET PURCHASE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil data Purchase Order",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  req: NextRequest
) {
  try {
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
          message:
            "Supplier wajib dipilih",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang belum dipilih",
        },
        {
          status: 400,
        }
      );
    }

    const supplier =
      await prisma.supplier.findUnique({
        where: {
          id: Number(supplierId),
        },
      });

    if (!supplier) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Supplier tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    let total = 0;

    for (const item of items) {
      const barangId =
        Number(item.barangId);

      const qty =
        Number(item.qty);

      const price =
        Number(item.price);

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

      const barang =
        await prisma.barang.findUnique({
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

    const lastPurchase =
      await prisma.purchase.findFirst({
        orderBy: {
          id: "desc",
        },

        select: {
          id: true,
        },
      });

    const nextNumber =
      (lastPurchase?.id ?? 0) + 1;

    const number =
      `PO-${String(
        nextNumber
      ).padStart(5, "0")}`;

    const purchase =
      await prisma.purchase.create({
        data: {
          number,

          supplierId:
            Number(supplierId),

          total,

          remarks:
            remarks || null,

          items: {
            create:
              items.map(
                (item: any) => {
                  const qty =
                    Number(item.qty);

                  const price =
                    Number(item.price);

                  return {
                    barangId:
                      Number(
                        item.barangId
                      ),

                    qty,

                    price,

                    subtotal:
                      qty * price,
                  };
                }
              ),
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

    await prisma.history.create({
      data: {
        transactionType:
          "PURCHASE",

        referenceNumber:
          purchase.number,

        description:
          "Membuat Purchase Order " +
          purchase.number,
      },
    });

    return NextResponse.json({
      success: true,

      message:
        "Purchase Order berhasil dibuat",

      data: purchase,
    });
  } catch (error) {
    console.error(
      "POST PURCHASE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Gagal membuat Purchase Order",
      },
      {
        status: 500,
      }
    );
  }
}