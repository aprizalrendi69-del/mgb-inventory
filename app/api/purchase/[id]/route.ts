import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  PaymentMethod,
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
    const session =
      await prisma.session.findUnique({
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
      if (
        session.expiresAt <
        new Date()
      ) {
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
    const parsed =
      JSON.parse(
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
 * IMPORTANT:
 *
 * Untuk Purchase TEMPO, invoice supplier dibuat
 * ketika Goods Receipt / Barang Masuk.
 *
 * Sumber data invoice supplier:
 *
 * PurchasePayable.invoiceNumber
 *
 * BUKAN:
 *
 * Purchase.invoiceNumber
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

    /*
     * =====================================================
     * GET PURCHASE
     * =====================================================
     *
     * PAYABLE WAJIB DI-INCLUDE
     *
     * Supaya halaman:
     *
     * /purchase/[id]/payment
     *
     * dapat membaca:
     *
     * payable.invoiceNumber
     * payable.invoiceDate
     * payable.dueDate
     * payable.amount
     * payable.paidAmount
     * payable.outstanding
     * payable.status
     * payable.payments
     *
     * =====================================================
     */

    const purchase =
      await prisma.purchase.findUnique({
        where: {
          id: purchaseId,
        },

        include: {
          /*
           * =================================================
           * SUPPLIER
           * =================================================
           */

          supplier: true,

          /*
           * =================================================
           * ITEMS
           * =================================================
           */

          items: {
            include: {
              barang: true,
            },
          },

          /*
           * =================================================
           * PURCHASE PAYABLE
           * =================================================
           *
           * Untuk TEMPO, payable dibuat pada saat
           * Goods Receipt / Barang Masuk.
           *
           * Jangan membuat payable di sini.
           *
           * Hanya READ.
           *
           * =================================================
           */

          payable: {
            include: {
              payments: {
                orderBy: {
                  paymentDate: "desc",
                },

                include: {
                  account: true,
                },
              },
            },
          },
        },
      });

    /*
     * =====================================================
     * PURCHASE NOT FOUND
     * =====================================================
     */

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

    /*
     * =====================================================
     * NORMALIZE PAYABLE
     * =====================================================
     *
     * Kita kirim payable secara eksplisit agar frontend
     * mendapatkan struktur yang stabil.
     *
     * Jika belum ada payable:
     *
     * payable = null
     *
     * =====================================================
     */

    const payable =
      purchase.payable
        ? {
            id:
              purchase.payable.id,

            purchaseId:
              purchase.payable.purchaseId,

            supplierId:
              purchase.payable.supplierId,

            outletId:
              purchase.payable.outletId,

            /*
             * =================================================
             * INVOICE SUPPLIER
             * =================================================
             */

            invoiceNumber:
              purchase.payable
                .invoiceNumber,

            invoiceDate:
              purchase.payable
                .invoiceDate,

            dueDate:
              purchase.payable
                .dueDate,

            /*
             * =================================================
             * NOMINAL
             * =================================================
             */

            amount:
              Number(
                purchase.payable
                  .amount ?? 0
              ),

            paidAmount:
              Number(
                purchase.payable
                  .paidAmount ?? 0
              ),

            outstanding:
              Number(
                purchase.payable
                  .outstanding ?? 0
              ),

            status:
              purchase.payable.status,

            /*
             * =================================================
             * PAYMENT HISTORY
             * =================================================
             */

            payments:
              purchase.payable
                .payments.map(
                  (payment) => ({
                    id:
                      payment.id,

                    number:
                      payment.number,

                    payableId:
                      payment.payableId,

                    purchaseId:
                      payment.purchaseId,

                    outletPurchaseId:
                      payment.outletPurchaseId,

                    accountId:
                      payment.accountId,

                    paymentDate:
                      payment.paymentDate,

                    amount:
                      Number(
                        payment.amount ??
                          0
                      ),

                    method:
                      payment.method,

                    status:
                      payment.status,

                    referenceNumber:
                      payment.referenceNumber,

                    note:
                      payment.note,

                    remarks:
                      payment.note,

                    account:
                      payment.account
                        ? {
                            id:
                              payment
                                .account
                                .id,

                            code:
                              payment
                                .account
                                .code,

                            name:
                              payment
                                .account
                                .name,

                            type:
                              payment
                                .account
                                .type,
                          }
                        : null,
                  })
                ),
          }
        : null;

    /*
     * =====================================================
     * RESPONSE
     * =====================================================
     *
     * Purchase tetap dikembalikan dengan struktur utama
     * yang sama.
     *
     * payable ditambahkan secara eksplisit.
     *
     * =====================================================
     */

    return NextResponse.json({
      success: true,

      data: {
        ...purchase,

        payable,
      },
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
 * PAYMENT METHOD:
 *
 * CASH
 * TRANSFER
 * COD
 * CBD
 * TEMPO
 *
 * IMPORTANT:
 *
 * PUT TIDAK MEMBUAT PAYABLE.
 *
 * Payable TEMPO dibuat ketika Goods Receipt.
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

    /*
     * =====================================================
     * BODY
     * =====================================================
     */

    const body = await req.json();

    const {
      supplierId,
      purchaseDate,
      paymentMethod,
      description,
      remarks,
      items,
    } = body;

    /*
     * =====================================================
     * VALIDASI SUPPLIER
     * =====================================================
     */

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

    /*
     * =====================================================
     * VALIDASI ITEM
     * =====================================================
     */

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

    /*
     * =====================================================
     * VALIDASI PAYMENT METHOD
     * =====================================================
     */

    const selectedPaymentMethod =
      String(
        paymentMethod || ""
      )
        .trim()
        .toUpperCase();

    const allowedPaymentMethods =
      Object.values(
        PaymentMethod
      );

    if (
      !selectedPaymentMethod ||
      !allowedPaymentMethods.includes(
        selectedPaymentMethod as PaymentMethod
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Metode pembayaran wajib dipilih. Pilihan: Cash, Transfer, COD, CBD, atau Tempo.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * VALIDASI TANGGAL
     * =====================================================
     */

    let finalPurchaseDate: Date;

    if (purchaseDate) {
      const parsedDate =
        new Date(purchaseDate);

      if (
        Number.isNaN(
          parsedDate.getTime()
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Tanggal Purchase Order tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      finalPurchaseDate =
        parsedDate;
    } else {
      finalPurchaseDate =
        new Date();
    }

    /*
     * =====================================================
     * CARI PURCHASE
     * =====================================================
     */

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

    /*
     * =====================================================
     * HANYA DRAFT
     * =====================================================
     */

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

    /*
     * =====================================================
     * CEK SUPPLIER
     * =====================================================
     */

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

    /*
     * =====================================================
     * VALIDASI ITEM + TOTAL
     * =====================================================
     */

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

      total +=
        qty * price;
    }

    /*
     * =====================================================
     * TRANSACTION
     * =====================================================
     */

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
           * =================================================
           * HAPUS ITEM LAMA
           * =================================================
           */

          await tx.purchaseItem.deleteMany({
            where: {
              purchaseId:
                purchase.id,
            },
          });

          /*
           * =================================================
           * UPDATE PURCHASE
           * =================================================
           */

          const update =
            await tx.purchase.update({
              where: {
                id: purchase.id,
              },

              data: {
                supplierId:
                  Number(supplierId),

                /*
                 * TANGGAL PO
                 */

                purchaseDate:
                  purchaseDate
                    ? finalPurchaseDate
                    : purchase.purchaseDate,

                /*
                 * PAYMENT METHOD
                 */

                paymentMethod:
                  selectedPaymentMethod as PaymentMethod,

                /*
                 * KETERANGAN
                 */

                remarks:
                  description ||
                  remarks ||
                  null,

                /*
                 * TOTAL
                 */

                total,

                /*
                 * ITEMS
                 */

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
           * =================================================
           * HISTORY
           * =================================================
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

    /*
     * =====================================================
     * RESPONSE
     * =====================================================
     */

    return NextResponse.json({
      success: true,

      message:
        "Purchase Order berhasil diubah",

      data: result,
    });
  } catch (error: any) {
    console.error(
      "PUT PURCHASE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
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