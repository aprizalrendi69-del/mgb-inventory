import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/*
 * =========================================================
 * HELPER: AMBIL NOMOR PO TERBESAR YANG PERNAH DIGUNAKAN
 * =========================================================
 *
 * Nomor PO tidak boleh kembali ke nomor lama
 * walaupun PO sebelumnya sudah dihapus.
 *
 * Contoh:
 *
 * PO-00001
 * PO-00002
 * PO-00003
 *
 * PO-00003 dihapus
 *
 * PO berikutnya:
 *
 * PO-00004
 *
 * =========================================================
 */

async function getNextPurchaseNumber(
  tx: typeof prisma
) {
  /*
   * =======================================================
   * PURCHASE YANG MASIH ADA
   * =======================================================
   */

  const purchases =
    await tx.purchase.findMany({
      select: {
        number: true,
      },
    });

  /*
   * =======================================================
   * HISTORY PURCHASE
   * =======================================================
   *
   * History digunakan supaya nomor PO yang sudah dihapus
   * tetap dianggap pernah digunakan.
   */

  const histories =
    await tx.history.findMany({
      where: {
        transactionType: "PURCHASE",
      },

      select: {
        referenceNumber: true,
      },
    });

  let highestNumber = 0;

  /*
   * =======================================================
   * CEK PURCHASE
   * =======================================================
   */

  for (const purchase of purchases) {
    const match =
      purchase.number?.match(
        /^PO-(\d+)$/
      );

    if (!match) {
      continue;
    }

    const number =
      Number(match[1]);

    if (
      Number.isInteger(number) &&
      number > highestNumber
    ) {
      highestNumber = number;
    }
  }

  /*
   * =======================================================
   * CEK HISTORY
   * =======================================================
   */

  for (const history of histories) {
    const match =
      history.referenceNumber?.match(
        /^PO-(\d+)$/
      );

    if (!match) {
      continue;
    }

    const number =
      Number(match[1]);

    if (
      Number.isInteger(number) &&
      number > highestNumber
    ) {
      highestNumber = number;
    }
  }

  /*
   * =======================================================
   * NOMOR BERIKUTNYA
   * =======================================================
   */

  const nextNumber =
    highestNumber + 1;

  return `PO-${String(
    nextNumber
  ).padStart(5, "0")}`;
}

/*
 * =========================================================
 * GET CURRENT USER
 * =========================================================
 */

async function getCurrentUser() {
  const cookieStore =
    await cookies();

  const sessionCookie =
    cookieStore.get("session") ||
    cookieStore.get("erp-session");

  if (!sessionCookie) {
    return null;
  }

  /*
   * =======================================================
   * COBA SESSION DATABASE
   * =======================================================
   */

  try {
    const session =
      await prisma.session.findUnique({
        where: {
          token:
            sessionCookie.value,
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
   * FALLBACK JSON SESSION
   * =======================================================
   */

  try {
    const parsed =
      JSON.parse(
        sessionCookie.value
      );

    const userId =
      Number(
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
 * GET PURCHASE ORDER
 * =========================================================
 *
 * USER PUSAT:
 * -> Purchase Pusat
 * -> Purchase Outlet
 *
 * USER OUTLET:
 * -> Hanya Purchase Outlet miliknya
 *
 * =========================================================
 */

export async function GET() {
  try {
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
     * =====================================================
     * USER PUSAT
     * =====================================================
     */

    if (user.outletId === null) {
      const [
        purchasePusat,
        purchaseOutlet,
      ] = await Promise.all([
        /*
         * -----------------------------------------------
         * PURCHASE PUSAT
         * -----------------------------------------------
         */

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

        /*
         * -----------------------------------------------
         * PURCHASE OUTLET
         * -----------------------------------------------
         */

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

      /*
       * =================================================
       * FORMAT PURCHASE PUSAT
       * =================================================
       */

      const pusat =
        purchasePusat.map(
          (item) => ({
            ...item,

            source: "PUSAT",

            destinationType:
              "PUSAT",

            destinationId:
              null,

            destinationName:
              "Gudang Pusat",

            destinationCode:
              null,
          })
        );

      /*
       * =================================================
       * FORMAT PURCHASE OUTLET
       * =================================================
       */

      const outlet =
        purchaseOutlet.map(
          (item) => ({
            ...item,

            source: "OUTLET",

            destinationType:
              "OUTLET",

            destinationId:
              item.outletId,

            destinationName:
              item.outlet?.name ||
              "-",

            destinationCode:
              item.outlet?.code ||
              "-",
          })
        );

      /*
       * =================================================
       * GABUNGKAN
       * =================================================
       */

      const data = [
        ...pusat,
        ...outlet,
      ].sort((a, b) => {
        const dateA =
          new Date(
            a.purchaseDate
          ).getTime();

        const dateB =
          new Date(
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
     * =====================================================
     * USER OUTLET
     * =====================================================
     */

    const purchaseOutlet =
      await prisma.outletPurchase.findMany({
        where: {
          outletId:
            user.outletId,
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

    const data =
      purchaseOutlet.map(
        (item) => ({
          ...item,

          source: "OUTLET",

          destinationType:
            "OUTLET",

          destinationId:
            item.outletId,

          destinationName:
            item.outlet?.name ||
            "-",

          destinationCode:
            item.outlet?.code ||
            "-",
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

/*
 * =========================================================
 * CREATE PURCHASE ORDER PUSAT
 * =========================================================
 *
 * PAYMENT METHOD:
 *
 * CASH
 * TRANSFER
 * COD
 * CBD
 * TEMPO
 *
 * =========================================================
 */

export async function POST(
  req: NextRequest
) {
  try {
    /*
     * =====================================================
     * CEK USER
     * =====================================================
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
     * =====================================================
     * CREATE PURCHASE INI ADALAH PURCHASE PUSAT
     * =====================================================
     *
     * Outlet Purchase mempunyai endpoint/alur sendiri.
     *
     * Jadi endpoint /api/purchase POST membuat:
     *
     * Purchase Pusat
     *
     * =====================================================
     */

    if (user.outletId !== null) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User Outlet tidak dapat membuat Purchase Order Pusat",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      await req.json();

    /*
     * =====================================================
     * DATA FRONTEND
     * =====================================================
     */

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
     * VALIDASI SUPPLIER ID
     * =====================================================
     */

    const numericSupplierId =
      Number(supplierId);

    if (
      !Number.isInteger(
        numericSupplierId
      ) ||
      numericSupplierId <= 0
    ) {
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
            "Barang belum dipilih",
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
     *
     * PILIHAN RESMI:
     *
     * CASH
     * TRANSFER
     * COD
     * CBD
     * TEMPO
     *
     * =====================================================
     */

    const allowedPaymentMethods = [
      "CASH",
      "TRANSFER",
      "COD",
      "CBD",
      "TEMPO",
    ];

    const selectedPaymentMethod =
      String(
        paymentMethod || ""
      )
        .trim()
        .toUpperCase();

    if (
      !selectedPaymentMethod ||
      !allowedPaymentMethods.includes(
        selectedPaymentMethod
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
     * VALIDASI TANGGAL PURCHASE
     * =====================================================
     */

    let finalPurchaseDate =
      new Date();

    if (purchaseDate) {
      /*
       * Frontend mengirim:
       *
       * YYYY-MM-DD
       *
       * Kita validasi terlebih dahulu.
       */

      const parsedDate =
        new Date(
          `${purchaseDate}T00:00:00`
        );

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
    }

    /*
     * =====================================================
     * CEK SUPPLIER
     * =====================================================
     */

    const supplier =
      await prisma.supplier.findUnique({
        where: {
          id: numericSupplierId,
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
     * VALIDASI ITEM + HITUNG TOTAL
     * =====================================================
     */

    let total = 0;

    const validatedItems: Array<{
      barangId: number;
      qty: number;
      price: number;
      subtotal: number;
    }> = [];

    for (
      const item of items
    ) {
      const barangId =
        Number(
          item?.barangId
        );

      const qty =
        Number(
          item?.qty
        );

      const price =
        Number(
          item?.price
        );

      /*
       * VALIDASI ANGKA
       */

      if (
        !Number.isInteger(
          barangId
        ) ||
        barangId <= 0 ||
        !Number.isFinite(qty) ||
        qty <= 0 ||
        !Number.isFinite(price) ||
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

      /*
       * CEK BARANG
       */

      const barang =
        await prisma.barang.findUnique({
          where: {
            id: barangId,
          },

          select: {
            id: true,
            name: true,
            active: true,
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

      /*
       * BARANG NONAKTIF TIDAK BOLEH
       * DIPAKAI DALAM PO BARU.
       */

      if (!barang.active) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang "${barang.name}" sudah tidak aktif`,
          },
          {
            status: 400,
          }
        );
      }

      const subtotal =
        qty * price;

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
     * CREATE PURCHASE + HISTORY
     * =====================================================
     */

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
           * =================================================
           * GENERATE NOMOR PO
           * =================================================
           */

          const number =
            await getNextPurchaseNumber(
              tx
            );

          /*
           * =================================================
           * CEK DUPLICATE
           * =================================================
           */

          const existing =
            await tx.purchase.findUnique({
              where: {
                number,
              },

              select: {
                id: true,
              },
            });

          if (existing) {
            throw new Error(
              `Nomor Purchase Order ${number} sudah digunakan. Silakan coba lagi.`
            );
          }

          /*
           * =================================================
           * CREATE PURCHASE
           * =================================================
           */

          const purchase =
            await tx.purchase.create({
              data: {
                number,

                supplierId:
                  numericSupplierId,

                purchaseDate:
                  finalPurchaseDate,

                /*
                 * =================================================
                 * PAYMENT METHOD
                 * =================================================
                 *
                 * CASH
                 * TRANSFER
                 * COD
                 * CBD
                 * TEMPO
                 *
                 * =================================================
                 */

                paymentMethod:
                  selectedPaymentMethod as
                    | "CASH"
                    | "TRANSFER"
                    | "COD"
                    | "CBD"
                    | "TEMPO",

                total,

                /*
                 * =================================================
                 * KETERANGAN
                 * =================================================
                 *
                 * Frontend:
                 * description
                 *
                 * Database:
                 * remarks
                 *
                 * =================================================
                 */

                remarks:
                  description?.trim() ||
                  remarks?.trim() ||
                  null,

                /*
                 * =================================================
                 * ITEMS
                 * =================================================
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
                purchase.number,

              description:
                `Membuat Purchase Order ${purchase.number}`,

              userId:
                user.id,
            },
          });

          return purchase;
        }
      );

    /*
     * =====================================================
     * RESPONSE
     * =====================================================
     */

    return NextResponse.json(
      {
        success: true,

        message:
          "Purchase Order berhasil dibuat",

        data: result,
      },
      {
        status: 201,
      }
    );
  } catch (error: any) {
    console.error(
      "POST PURCHASE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal membuat Purchase Order",
      },
      {
        status: 500,
      }
    );
  }
}