import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  PurchaseStatus,
  OutletPurchaseStatus,
  Role,
} from "@prisma/client";
import { cookies } from "next/headers";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/*
 * =========================================================
 * GET CURRENT USER
 * =========================================================
 */

async function getCurrentUser() {
  const cookieStore = await cookies();

  const sessionCookie =
    cookieStore.get("session") ||
    cookieStore.get("erp-session");

  if (!sessionCookie) {
    return null;
  }

  /*
   * =======================================================
   * SESSION DATABASE
   * =======================================================
   */

  try {
    const session = await prisma.session.findUnique({
      where: {
        token: sessionCookie.value,
      },

      select: {
        expiresAt: true,

        user: {
          select: {
            id: true,
            username: true,
            fullname: true,
            role: true,
            active: true,
            outletId: true,
          },
        },
      },
    });

    if (session) {
      if (session.expiresAt < new Date()) {
        return null;
      }

      if (!session.user.active) {
        return null;
      }

      return session.user;
    }
  } catch (error) {
    console.error(
      "DATABASE SESSION CHECK ERROR:",
      error
    );
  }

  /*
   * =======================================================
   * FALLBACK ERP JSON SESSION
   * =======================================================
   */

  try {
    const parsed = JSON.parse(
      sessionCookie.value
    );

    const userId = Number(
      parsed?.user?.id ??
        parsed?.id ??
        0
    );

    if (
      !userId ||
      !Number.isInteger(userId)
    ) {
      return null;
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },

        select: {
          id: true,
          username: true,
          fullname: true,
          role: true,
          active: true,
          outletId: true,
        },
      });

    if (!user || !user.active) {
      return null;
    }

    return user;
  } catch (error) {
    console.error(
      "JSON SESSION CHECK ERROR:",
      error
    );

    return null;
  }
}

/*
 * =========================================================
 * GET PURCHASE DETAIL
 * =========================================================
 *
 * PURCHASE PUSAT
 *
 * =========================================================
 */

export async function GET(
  req: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    const purchaseId = Number(id);

    if (
      !Number.isInteger(purchaseId) ||
      purchaseId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID Purchase tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const purchase =
      await prisma.purchase.findUnique({
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
          message:
            "Purchase Order tidak ditemukan",
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
    console.error(
      "GET PURCHASE DETAIL ERROR:",
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

/*
 * =========================================================
 * PUT EDIT PURCHASE
 * =========================================================
 *
 * PURCHASE PUSAT
 *
 * HANYA DRAFT
 *
 * =========================================================
 */

export async function PUT(
  req: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    const purchaseId = Number(id);

    if (
      !Number.isInteger(purchaseId) ||
      purchaseId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID Purchase tidak valid",
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
            "Item Purchase kosong",
        },
        {
          status: 400,
        }
      );
    }

    const purchase =
      await prisma.purchase.findUnique({
        where: {
          id: purchaseId,
        },
      });

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Order tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    if (
      purchase.status !==
      PurchaseStatus.DRAFT
    ) {
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

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
           * HAPUS ITEM LAMA
           */

          await tx.purchaseItem.deleteMany({
            where: {
              purchaseId:
                purchase.id,
            },
          });

          /*
           * UPDATE PURCHASE
           */

          const update =
            await tx.purchase.update({
              where: {
                id: purchase.id,
              },

              data: {
                supplierId:
                  Number(supplierId),

                remarks:
                  remarks || null,

                total,

                items: {
                  create:
                    items.map(
                      (item: any) => {
                        const qty =
                          Number(
                            item.qty
                          );

                        const price =
                          Number(
                            item.price
                          );

                        return {
                          barangId:
                            Number(
                              item.barangId
                            ),

                          qty,

                          price,

                          subtotal:
                            qty *
                            price,
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

          /*
           * HISTORY
           */

          await tx.history.create({
            data: {
              transactionType:
                "PURCHASE",

              referenceNumber:
                update.number,

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
      message:
        "Purchase Order berhasil diubah",
      data: result,
    });
  } catch (error) {
    console.error(
      "PUT PURCHASE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengubah Purchase Order",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * =========================================================
 * DELETE PURCHASE
 * =========================================================
 *
 * HANYA ADMIN PUSAT
 *
 * Bisa menghapus:
 *
 * 1. Purchase Pusat
 *    -> Purchase
 *
 * 2. Purchase Outlet
 *    -> OutletPurchase
 *
 * SYARAT:
 *
 * - User login
 * - User aktif
 * - Role ADMIN
 * - outletId NULL
 * - Status DRAFT
 *
 * =========================================================
 */

export async function DELETE(
  req: NextRequest,
  { params }: RouteContext
) {
  try {
    /*
     * =======================================================
     * PARAMETER
     * =======================================================
     */

    const { id } = await params;

    const purchaseId = Number(id);

    if (
      !Number.isInteger(purchaseId) ||
      purchaseId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID Purchase tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =======================================================
     * CEK USER
     * =======================================================
     */

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Session tidak valid atau user tidak aktif",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * =======================================================
     * SECURITY
     *
     * HANYA ADMIN PUSAT
     * =======================================================
     */

    if (
      user.role !== Role.ADMIN ||
      user.outletId !== null
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Hanya Admin Pusat yang dapat menghapus Purchase Order",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * =======================================================
     * SOURCE OPTIONAL
     *
     * Frontend lama:
     *
     * DELETE /api/purchase/8
     *
     * Tetap diterima.
     *
     * Jika source dikirim:
     *
     * ?source=PUSAT
     * ?source=OUTLET
     *
     * akan dipakai sebagai petunjuk.
     * =======================================================
     */

    const requestedSource =
      req.nextUrl.searchParams
        .get("source")
        ?.toUpperCase();

    if (
      requestedSource &&
      requestedSource !== "PUSAT" &&
      requestedSource !== "OUTLET"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Source Purchase tidak valid. Gunakan PUSAT atau OUTLET.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =======================================================
     * CARI PURCHASE PUSAT
     * =======================================================
     *
     * Kalau source PUSAT atau tidak dikirim,
     * cek tabel Purchase.
     * =======================================================
     */

    if (
      !requestedSource ||
      requestedSource === "PUSAT"
    ) {
      const purchase =
        await prisma.purchase.findUnique({
          where: {
            id: purchaseId,
          },

          include: {
            supplier: true,

            items: {
              select: {
                id: true,
                barangId: true,
                qty: true,
                price: true,
                subtotal: true,
              },
            },
          },
        });

      if (purchase) {
        /*
         * HANYA DRAFT
         */

        if (
          purchase.status !==
          PurchaseStatus.DRAFT
        ) {
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

        /*
         * DELETE TRANSACTION
         */

        await prisma.$transaction(
          async (tx) => {
            /*
             * HAPUS ITEM
             *
             * PurchaseItem.purchaseId
             */

            await tx.purchaseItem.deleteMany({
              where: {
                purchaseId:
                  purchase.id,
              },
            });

            /*
             * HAPUS PURCHASE
             */

            await tx.purchase.delete({
              where: {
                id: purchase.id,
              },
            });

            /*
             * HISTORY
             */

            await tx.history.create({
              data: {
                transactionType:
                  "PURCHASE",

                referenceNumber:
                  purchase.number,

                description:
                  `Hapus Purchase Order Pusat ${purchase.number}`,

                userId:
                  user.id,
              },
            });
          }
        );

        return NextResponse.json({
          success: true,
          message:
            "Purchase Order Pusat berhasil dihapus",
        });
      }

      /*
       * Kalau user secara eksplisit meminta PUSAT
       * tetapi data tidak ada.
       */

      if (
        requestedSource === "PUSAT"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Purchase Order Pusat tidak ditemukan",
          },
          {
            status: 404,
          }
        );
      }
    }

    /*
     * =======================================================
     * CARI PURCHASE OUTLET
     * =======================================================
     *
     * OutletPurchase memiliki ID sendiri.
     *
     * Schema:
     *
     * OutletPurchaseItem.purchaseId
     *
     * BUKAN outletPurchaseId.
     * =======================================================
     */

    if (
      !requestedSource ||
      requestedSource === "OUTLET"
    ) {
      const outletPurchase =
        await prisma.outletPurchase.findUnique({
          where: {
            id: purchaseId,
          },

          include: {
            supplier: true,

            outlet: true,

            items: {
              select: {
                id: true,
                purchaseId: true,
                barangId: true,
                qty: true,
                price: true,
                subtotal: true,
              },
            },
          },
        });

      if (!outletPurchase) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Purchase Order Outlet tidak ditemukan",
          },
          {
            status: 404,
          }
        );
      }

      /*
       * HANYA DRAFT
       */

      if (
        outletPurchase.status !==
        OutletPurchaseStatus.DRAFT
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Purchase Order Outlet yang sudah diapprove tidak boleh dihapus",
          },
          {
            status: 400,
          }
        );
      }

      /*
       * DELETE TRANSACTION OUTLET
       */

      await prisma.$transaction(
        async (tx) => {
          /*
           * HAPUS ITEM OUTLET
           *
           * Field schema:
           * OutletPurchaseItem.purchaseId
           */

          await tx.outletPurchaseItem.deleteMany({
            where: {
              purchaseId:
                outletPurchase.id,
            },
          });

          /*
           * HAPUS PURCHASE OUTLET
           */

          await tx.outletPurchase.delete({
            where: {
              id: outletPurchase.id,
            },
          });

          /*
           * HISTORY
           */

          await tx.history.create({
            data: {
              transactionType:
                "PURCHASE",

              referenceNumber:
                outletPurchase.number,

              description:
                `Hapus Purchase Order Outlet ${outletPurchase.number}`,

              userId:
                user.id,
            },
          });
        }
      );

      return NextResponse.json({
        success: true,
        message:
          "Purchase Order Outlet berhasil dihapus",
      });
    }

    /*
     * =======================================================
     * FALLBACK
     * =======================================================
     */

    return NextResponse.json(
      {
        success: false,
        message:
          "Purchase Order tidak ditemukan",
      },
      {
        status: 404,
      }
    );
  } catch (error: any) {
    console.error(
      "DELETE PURCHASE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal menghapus Purchase Order",
      },
      {
        status: 500,
      }
    );
  }
}