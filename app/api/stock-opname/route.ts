import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/*
 * =========================================================
 * CURRENT USER
 * =========================================================
 */

async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("erp-session");

    if (!session) {
      return null;
    }

    let sessionData: any;

    try {
      sessionData = JSON.parse(session.value);
    } catch {
      return null;
    }

    if (!sessionData?.id) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: Number(sessionData.id),
      },
    });

    return user;
  } catch (error) {
    console.error("GET CURRENT USER ERROR:", error);
    return null;
  }
}

/*
 * =========================================================
 * VALIDATE PUSAT USER
 * =========================================================
 *
 * Stock Opname Pusat hanya boleh digunakan oleh user Pusat.
 *
 * User yang mempunyai outletId berarti merupakan user outlet
 * dan tidak boleh membaca / membuat Stock Opname Pusat.
 *
 * =========================================================
 */

function isPusatUser(user: any) {
  if (!user) {
    return false;
  }

  return user.outletId === null || user.outletId === undefined;
}

/*
 * =========================================================
 * GENERATE STOCK OPNAME CODE
 * =========================================================
 *
 * Format:
 *
 * SO-2026-0001
 * SO-2026-0002
 * SO-2026-0003
 *
 * Generator hanya mengambil nomor dari tahun berjalan.
 *
 * Prefix:
 *
 * SO-YYYY-
 *
 * =========================================================
 */

async function generateStockOpnameCode(tx: any) {
  const year = new Date().getFullYear();

  const prefix = `SO-${year}-`;

  /*
   * Ambil semua code tahun berjalan.
   *
   * Tidak menggunakan orderBy id terakhir karena:
   *
   * 1. Data Outlet dan Pusat bisa bercampur.
   * 2. ID terbesar belum tentu mempunyai format code
   *    yang sesuai.
   * 3. Data lama mungkin mempunyai format berbeda.
   */

  const existing = await tx.stockOpname.findMany({
    where: {
      code: {
        startsWith: prefix,
      },
    },

    select: {
      code: true,
    },
  });

  let nomor = 1;

  for (const item of existing) {
    const match = item.code.match(
      new RegExp(`^SO-${year}-(\\d+)$`)
    );

    if (!match) {
      continue;
    }

    const currentNumber = Number(match[1]);

    if (
      Number.isFinite(currentNumber) &&
      currentNumber >= nomor
    ) {
      nomor = currentNumber + 1;
    }
  }

  return `${prefix}${String(nomor).padStart(4, "0")}`;
}

/*
 * =========================================================
 * GET - STOCK OPNAME PUSAT
 * =========================================================
 *
 * STOCK OPNAME PUSAT:
 *
 * StockOpname.outletId = null
 *
 * Hanya mengambil opname pusat.
 * Stock Opname Outlet tidak ikut tampil.
 *
 * API juga dikunci untuk user Pusat.
 *
 * =========================================================
 */

export async function GET() {
  try {
    /*
     * =====================================================
     * CURRENT USER
     * =====================================================
     */

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Session user tidak ditemukan",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * =====================================================
     * PUSAT ONLY
     * =====================================================
     *
     * User yang mempunyai outletId tidak boleh mengakses
     * Stock Opname Pusat.
     *
     * =====================================================
     */

    if (!isPusatUser(user)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock Opname Pusat hanya dapat diakses oleh user Pusat",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * =====================================================
     * GET DATA
     * =====================================================
     */

    const data = await prisma.stockOpname.findMany({
      where: {
        outletId: null,
      },

      include: {
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

    const result = data.map((item) => ({
      id: item.id,

      code: item.code,

      date: item.date,

      type: item.type,

      status: item.status,

      outletId: null,

      totalItem: item.items.length,

      totalDifference: item.items.reduce(
        (total, detail) =>
          total + Number(detail.difference || 0),
        0
      ),

      items: item.items.map((detail) => ({
        id: detail.id,

        barangId: detail.barangId,

        code: detail.barang.code,

        barcode: detail.barang.barcode,

        name: detail.barang.name,

        unit: detail.barang.unit,

        systemQty: detail.systemQty,

        physicalQty: detail.physicalQty,

        difference: detail.difference,

        note: detail.note,
      })),
    }));

    return NextResponse.json({
      success: true,

      data: result,

      meta: {
        warehouse: "MAIN",

        outletId: null,

        scope: "PUSAT",

        total: result.length,
      },
    });
  } catch (error) {
    console.error(
      "GET STOCK OPNAME PUSAT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil Stock Opname Pusat",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * =========================================================
 * POST - CREATE STOCK OPNAME PUSAT
 * =========================================================
 *
 * SUMBER STOCK:
 *
 * Barang.stock
 *
 * Hanya:
 *
 * Barang.source = CENTRAL
 *
 * DAN
 *
 * Barang memiliki transaksi pada:
 *
 * StockCard.warehouse = MAIN
 *
 * outletId selalu NULL.
 *
 * =========================================================
 */

export async function POST(req: NextRequest) {
  try {
    /*
     * =====================================================
     * CURRENT USER
     * =====================================================
     */

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Session user tidak ditemukan",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * =====================================================
     * PUSAT ONLY
     * =====================================================
     *
     * User outlet tidak boleh membuat Stock Opname Pusat.
     *
     * =====================================================
     */

    if (!isPusatUser(user)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock Opname Pusat hanya dapat dibuat oleh user Pusat",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * =====================================================
     * BODY
     * =====================================================
     */

    let body: any = {};

    try {
      body = await req.json();
    } catch {
      body = {};
    }

    /*
     * =====================================================
     * SCOPE VALIDATION
     * =====================================================
     *
     * API ini khusus Pusat.
     *
     * Jadi apabila frontend mengirim scope selain PUSAT,
     * request ditolak.
     *
     * =====================================================
     */

    const scope = String(
      body?.scope || ""
    ).toUpperCase();

    if (scope !== "PUSAT") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock Opname API ini khusus untuk scope PUSAT",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * ONLY WITH TRANSACTIONS
     * =====================================================
     *
     * Ini merupakan BUSINESS RULE.
     *
     * Stock Opname Pusat hanya boleh dibuat dari barang
     * yang mempunyai transaksi Pusat.
     *
     * Frontend wajib mengirim:
     *
     * onlyWithTransactions: true
     *
     * API juga memvalidasi parameter ini agar frontend tidak
     * dapat membuat opname dari seluruh master Barang.
     *
     * =====================================================
     */

    if (body?.onlyWithTransactions !== true) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock Opname Pusat wajib menggunakan barang yang memiliki transaksi Pusat",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * TYPE
     * =====================================================
     */

    const requestedType =
      String(body?.type || "WEEKLY").toUpperCase();

    const type =
      requestedType === "MONTHLY"
        ? "MONTHLY"
        : "WEEKLY";

    /*
     * =====================================================
     * CREATE STOCK OPNAME + ITEMS
     * =====================================================
     *
     * Seluruh proses dilakukan dalam transaction.
     *
     * Barang yang digunakan:
     *
     * 1. source = CENTRAL
     * 2. active = true
     * 3. memiliki StockCard
     * 4. StockCard.warehouse = MAIN
     *
     * Dengan demikian:
     *
     * Barang yang hanya ada di Master Barang tetapi belum
     * pernah mempunyai transaksi Pusat tidak akan masuk.
     *
     * =====================================================
     */

    const MAX_RETRY = 5;

    let opname: any = null;

    for (
      let attempt = 1;
      attempt <= MAX_RETRY;
      attempt++
    ) {
      try {
        opname = await prisma.$transaction(
          async (tx) => {
            /*
             * -------------------------------------------------
             * GENERATE CODE DI DALAM TRANSACTION
             * -------------------------------------------------
             */

            const code =
              await generateStockOpnameCode(tx);

            /*
             * -------------------------------------------------
             * CARI BARANG YANG MEMILIKI TRANSAKSI PUSAT
             * -------------------------------------------------
             *
             * StockCard adalah history transaksi stok Pusat.
             *
             * Warehouse MAIN = Gudang Pusat.
             *
             * Kita mengambil barangId yang pernah mempunyai
             * transaksi pada warehouse MAIN.
             *
             * -------------------------------------------------
             */

            const centralTransactions =
              await tx.stockCard.findMany({
                where: {
                  warehouse: "MAIN",
                },

                select: {
                  barangId: true,
                },

                distinct: ["barangId"],
              });

            /*
             * -------------------------------------------------
             * BARANG ID DARI TRANSAKSI PUSAT
             * -------------------------------------------------
             */

            const transactionBarangIds =
              centralTransactions
                .map(
                  (transaction) =>
                    transaction.barangId
                )
                .filter(
                  (barangId) =>
                    barangId !== null &&
                    barangId !== undefined
                );

            /*
             * -------------------------------------------------
             * VALIDASI TRANSAKSI
             * -------------------------------------------------
             */

            if (
              transactionBarangIds.length === 0
            ) {
              throw new Error(
                "Belum ada transaksi barang di Pusat. Stock Opname tidak dapat dibuat."
              );
            }

            /*
             * -------------------------------------------------
             * BARANG PUSAT
             * -------------------------------------------------
             *
             * Hanya barang:
             *
             * source = CENTRAL
             * active = true
             * memiliki transaksi StockCard MAIN
             *
             * -------------------------------------------------
             */

            const barang =
              await tx.barang.findMany({
                where: {
                  source: "CENTRAL",

                  active: true,

                  id: {
                    in: transactionBarangIds,
                  },
                },

                orderBy: {
                  name: "asc",
                },
              });

            /*
             * -------------------------------------------------
             * SAFETY CHECK
             * -------------------------------------------------
             */

            if (barang.length === 0) {
              throw new Error(
                "Tidak ditemukan barang Pusat yang memiliki transaksi."
              );
            }

            /*
             * -------------------------------------------------
             * CREATE HEADER
             * -------------------------------------------------
             *
             * outletId sengaja NULL.
             *
             * outletId = NULL
             * berarti Stock Opname Pusat.
             *
             * -------------------------------------------------
             */

            const created =
              await tx.stockOpname.create({
                data: {
                  code,

                  date: new Date(),

                  type,

                  status: "COUNTING",

                  createdBy: user.id,

                  outletId: null,
                },
              });

            /*
             * -------------------------------------------------
             * CREATE ITEMS
             * -------------------------------------------------
             *
             * systemQty berasal dari Barang.stock.
             *
             * physicalQty awal = systemQty.
             *
             * difference awal = 0.
             *
             * Hanya barang yang sudah lolos:
             *
             * CENTRAL
             * ACTIVE
             * TRANSAKSI MAIN
             *
             * yang dibuat menjadi StockOpnameItem.
             *
             * -------------------------------------------------
             */

            await tx.stockOpnameItem.createMany({
              data: barang.map((b) => ({
                opnameId: created.id,

                barangId: b.id,

                systemQty: Number(
                  b.stock || 0
                ),

                physicalQty: Number(
                  b.stock || 0
                ),

                difference: 0,
              })),
            });

            /*
             * -------------------------------------------------
             * GET DETAIL
             * -------------------------------------------------
             */

            return tx.stockOpname.findUnique({
              where: {
                id: created.id,
              },

              include: {
                items: {
                  include: {
                    barang: true,
                  },
                },
              },
            });
          }
        );

        /*
         * Transaction berhasil.
         * Keluar dari retry loop.
         */

        break;
      } catch (error: any) {
        /*
         * =====================================================
         * PRISMA UNIQUE CONSTRAINT
         * =====================================================
         *
         * P2002 = duplicate unique field.
         *
         * Kita hanya retry untuk collision code.
         * Error lainnya langsung dilempar.
         *
         * =====================================================
         */

        const isCodeCollision =
          error?.code === "P2002" &&
          Array.isArray(error?.meta?.target) &&
          error.meta.target.includes("code");

        if (
          !isCodeCollision ||
          attempt === MAX_RETRY
        ) {
          throw error;
        }

        console.warn(
          `Stock Opname code collision. Retry ${attempt}/${MAX_RETRY}`
        );

        /*
         * Beri sedikit jeda sebelum retry agar request
         * concurrent mempunyai kesempatan menyelesaikan
         * transaction sebelumnya.
         */

        await new Promise((resolve) =>
          setTimeout(resolve, 50 * attempt)
        );
      }
    }

    /*
     * =========================================================
     * SAFETY CHECK
     * =========================================================
     */

    if (!opname) {
      throw new Error(
        "Stock Opname gagal dibuat setelah beberapa percobaan"
      );
    }

    /*
     * =========================================================
     * RESPONSE
     * =========================================================
     */

    return NextResponse.json({
      success: true,

      message:
        "Stock Opname Pusat berhasil dibuat dari barang yang memiliki transaksi Pusat",

      data: {
        ...opname,

        warehouse: "MAIN",

        scope: "PUSAT",

        outletId: null,

        onlyWithTransactions: true,

        totalItem:
          Array.isArray(opname.items)
            ? opname.items.length
            : 0,
      },
    });
  } catch (error: any) {
    console.error(
      "CREATE STOCK OPNAME PUSAT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal membuat Stock Opname Pusat",
      },
      {
        status: 500,
      }
    );
  }
}