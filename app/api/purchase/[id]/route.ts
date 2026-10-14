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
    const parsed = JSON.parse(sessionCookie.value);

    const userId = Number(
      parsed?.user?.id ??
        parsed?.id ??
        0
    );

    if (
      !userId ||
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return null;
    }

    const user = await prisma.user.findUnique({
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
 * PARSE PURCHASE DATE
 * =========================================================
 *
 * IMPORTANT
 *
 * Jangan menggunakan:
 *
 * new Date("YYYY-MM-DD")
 *
 * secara langsung untuk kebutuhan tanggal PO,
 * karena JavaScript dapat memperlakukannya sebagai
 * UTC dan tanggal dapat bergeser ketika ditampilkan
 * pada timezone Indonesia.
 *
 * Untuk input HTML:
 *
 * YYYY-MM-DD
 *
 * kita simpan sebagai:
 *
 * YYYY-MM-DDT00:00:00
 *
 * pada local/server timezone.
 *
 * =========================================================
 */

function parsePurchaseDate(
  value: unknown
): Date | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const raw = value.trim();

  if (!raw) {
    return null;
  }

  /*
   * =======================================================
   * FORMAT UTAMA HTML DATE
   * =======================================================
   *
   * YYYY-MM-DD
   *
   * =======================================================
   */

  const dateOnlyMatch =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);

  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);

    /*
     * Validasi range dasar.
     */

    if (
      year < 1900 ||
      year > 9999 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return null;
    }

    /*
     * Buat tanggal local.
     *
     * Month pada JavaScript dimulai dari 0.
     */

    const date = new Date(
      year,
      month - 1,
      day,
      0,
      0,
      0,
      0
    );

    /*
     * Validasi tanggal sebenarnya.
     *
     * Contoh:
     * 2026-02-31
     *
     * harus ditolak, bukan diubah otomatis
     * menjadi tanggal Maret.
     */

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  /*
   * =======================================================
   * FORMAT DATETIME
   * =======================================================
   *
   * Tetap mendukung frontend yang mengirim ISO string,
   * misalnya:
   *
   * 2026-10-07T00:00:00.000Z
   *
   * atau:
   *
   * 2026-10-07T00:00:00
   *
   * =======================================================
   */

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
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
  _req: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    const purchaseId = Number(id);

    /*
     * =====================================================
     * VALIDASI ID
     * =====================================================
     */

    if (
      !Number.isInteger(purchaseId) ||
      purchaseId <= 0
    ) {
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

    /*
     * =====================================================
     * GET PURCHASE
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
     */

    const payable = purchase.payable
      ? {
          id: purchase.payable.id,

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
            purchase.payable.invoiceNumber,

          invoiceDate:
            purchase.payable.invoiceDate,

          dueDate:
            purchase.payable.dueDate,

          /*
           * =================================================
           * NOMINAL
           * =================================================
           */

          amount: Number(
            purchase.payable.amount ?? 0
          ),

          paidAmount: Number(
            purchase.payable.paidAmount ?? 0
          ),

          outstanding: Number(
            purchase.payable.outstanding ?? 0
          ),

          status:
            purchase.payable.status,

          /*
           * =================================================
           * PAYMENT HISTORY
           * =================================================
           */

          payments:
            purchase.payable.payments.map(
              (payment) => ({
                id: payment.id,

                number: payment.number,

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

                amount: Number(
                  payment.amount ?? 0
                ),

                method: payment.method,

                status: payment.status,

                referenceNumber:
                  payment.referenceNumber,

                note: payment.note,

                remarks: payment.note,

                account:
                  payment.account
                    ? {
                        id:
                          payment.account.id,

                        code:
                          payment.account.code,

                        name:
                          payment.account.name,

                        type:
                          payment.account.type,
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
     * purchase.purchaseDate berasal langsung dari DB.
     *
     * Jadi setelah frontend menyimpan tanggal baru,
     * GET berikutnya akan selalu membaca tanggal PO
     * yang benar-benar tersimpan.
     *
     * =====================================================
     */

    return NextResponse.json({
      success: true,

      data: {
        ...purchase,

        purchaseDate:
          purchase.purchaseDate,

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

    /*
     * =====================================================
     * VALIDASI ID
     * =====================================================
     */

    if (
      !Number.isInteger(purchaseId) ||
      purchaseId <= 0
    ) {
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

    /*
     * =====================================================
     * BODY
     * =====================================================
     */

    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Body request tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const {
      supplierId,
      purchaseDate,
      paymentMethod,
      description,
      remarks,
      items,
    } = body ?? {};

    /*
     * =====================================================
     * VALIDASI SUPPLIER ID
     * =====================================================
     */

    const parsedSupplierId = Number(
      supplierId
    );

    if (
      !Number.isInteger(
        parsedSupplierId
      ) ||
      parsedSupplierId <= 0
    ) {
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
          message: "Item Purchase kosong",
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

    const selectedPaymentMethod = String(
      paymentMethod || ""
    )
      .trim()
      .toUpperCase();

    const allowedPaymentMethods =
      Object.values(PaymentMethod);

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
     * CARI PURCHASE
     * =====================================================
     *
     * Purchase harus dicari SEBELUM menentukan
     * tanggal final karena apabila purchaseDate
     * tidak dikirim, kita harus mempertahankan
     * tanggal PO yang sudah tersimpan.
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
     * VALIDASI TANGGAL PO
     * =====================================================
     *
     * Ada 3 kondisi:
     *
     * 1. purchaseDate tidak ada di body
     *    -> pertahankan tanggal lama.
     *
     * 2. purchaseDate ada dan valid
     *    -> simpan tanggal baru.
     *
     * 3. purchaseDate ada tetapi kosong/tidak valid
     *    -> tolak request.
     *
     * Tidak boleh menggunakan new Date() sebagai fallback
     * karena itu dapat mengubah tanggal PO secara tidak
     * sengaja menjadi tanggal hari ini.
     *
     * =====================================================
     */

    const hasPurchaseDateField =
      Object.prototype.hasOwnProperty.call(
        body,
        "purchaseDate"
      );

    let finalPurchaseDate =
      purchase.purchaseDate;

    if (hasPurchaseDateField) {
      const parsedPurchaseDate =
        parsePurchaseDate(
          purchaseDate
        );

      if (!parsedPurchaseDate) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Tanggal Purchase Order tidak valid. Gunakan format YYYY-MM-DD.",
          },
          {
            status: 400,
          }
        );
      }

      finalPurchaseDate =
        parsedPurchaseDate;
    }

    /*
     * =====================================================
     * CEK SUPPLIER
     * =====================================================
     */

    const supplier =
      await prisma.supplier.findUnique({
        where: {
          id: parsedSupplierId,
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

    const validatedItems: Array<{
      barangId: number;
      qty: number;
      price: number;
      subtotal: number;
    }> = [];

    for (const item of items) {
      const barangId = Number(
        item?.barangId
      );

      const qty = Number(
        item?.qty
      );

      const price = Number(
        item?.price
      );

      /*
       * ===================================================
       * VALIDASI ANGKA
       * ===================================================
       */

      if (
        !Number.isInteger(barangId) ||
        barangId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Barang tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      if (
        !Number.isFinite(qty) ||
        qty <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Qty harus berupa angka lebih dari 0",
          },
          {
            status: 400,
          }
        );
      }

      if (
        !Number.isFinite(price) ||
        price <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Harga harus berupa angka lebih dari 0",
          },
          {
            status: 400,
          }
        );
      }

      /*
       * ===================================================
       * CEK BARANG
       * ===================================================
       */

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

      const subtotal =
        qty * price;

      if (
        !Number.isFinite(subtotal)
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Subtotal item tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      total += subtotal;

      validatedItems.push({
        barangId,
        qty,
        price,
        subtotal,
      });
    }

    /*
     * =====================================================
     * VALIDASI TOTAL
     * =====================================================
     */

    if (
      !Number.isFinite(total) ||
      total <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Total Purchase Order tidak valid",
        },
        {
          status: 400,
        }
      );
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
                  parsedSupplierId,

                /*
                 * =================================================
                 * TANGGAL PO
                 * =================================================
                 *
                 * finalPurchaseDate selalu berasal dari:
                 *
                 * - tanggal baru yang sudah divalidasi, atau
                 * - tanggal lama dari database.
                 *
                 * Tidak pernah menggunakan new Date()
                 * sebagai fallback.
                 *
                 * =================================================
                 */

                purchaseDate:
                  finalPurchaseDate,

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
                    validatedItems.map(
                      (item) => ({
                        barangId:
                          item.barangId,

                        qty:
                          item.qty,

                        price:
                          item.price,

                        subtotal:
                          item.subtotal,
                      })
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
     *
     * purchaseDate di sini adalah nilai hasil UPDATE
     * yang sudah dibaca kembali dari database.
     * =====================================================
     */

    return NextResponse.json({
      success: true,

      message:
        "Purchase Order berhasil diubah",

      data: {
        ...result,

        purchaseDate:
          result.purchaseDate,
      },
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
        ?.trim()
        .toUpperCase();

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
             * =================================================
             * HAPUS ITEM
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
             * HAPUS PURCHASE
             * =================================================
             */

            await tx.purchase.delete({
              where: {
                id: purchase.id,
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
           * =================================================
           * HAPUS ITEM OUTLET
           * =================================================
           */

          await tx.outletPurchaseItem.deleteMany({
            where: {
              purchaseId:
                outletPurchase.id,
            },
          });

          /*
           * =================================================
           * HAPUS PURCHASE OUTLET
           * =================================================
           */

          await tx.outletPurchase.delete({
            where: {
              id: outletPurchase.id,
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