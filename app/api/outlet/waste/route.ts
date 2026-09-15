import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/*
 * =========================================================
 * CURRENT USER
 *
 * Session hanya dipakai untuk mendapatkan USER ID.
 * Data user + outlet selalu diambil ulang dari database.
 * =========================================================
 */

async function getCurrentUser() {
  const cookieStore = await cookies();

  const session =
    cookieStore.get("erp-session") ||
    cookieStore.get("session");

  if (!session) {
    return null;
  }

  let userId: number | null = null;

  /*
   * =======================================================
   * COBA SESSION DATABASE
   * =======================================================
   */

  try {
    const dbSession = await prisma.session.findUnique({
      where: {
        token: session.value,
      },
      select: {
        expiresAt: true,
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (dbSession) {
      if (dbSession.expiresAt < new Date()) {
        return null;
      }

      userId = dbSession.user.id;
    }
  } catch {
    /*
     * Jika model Session tidak tersedia / token tidak
     * ditemukan, lanjut ke session JSON.
     */
  }

  /*
   * =======================================================
   * SESSION JSON
   * =======================================================
   */

  if (!userId) {
    try {
      const data = JSON.parse(session.value);

      userId = Number(
        data?.user?.id ??
          data?.id ??
          0
      );
    } catch {
      return null;
    }
  }

  if (
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    return null;
  }

  /*
   * =======================================================
   * AMBIL USER DARI DATABASE
   *
   * outletId TIDAK PERNAH DIAMBIL DARI COOKIE.
   * =======================================================
   */

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

      outlet: {
        select: {
          id: true,
          code: true,
          name: true,
          active: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  if (!user.active) {
    return null;
  }

  return user;
}

/*
 * =========================================================
 * JSON ERROR
 * =========================================================
 */

function jsonError(
  message: string,
  status = 400
) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
    }
  );
}

/*
 * =========================================================
 * MONTH RANGE
 * =========================================================
 */

function getMonthRange(month: string) {
  const [
    year,
    monthNumber,
  ] = month.split("-").map(Number);

  const start = new Date(
    year,
    monthNumber - 1,
    1,
    0,
    0,
    0,
    0
  );

  const end = new Date(
    year,
    monthNumber,
    1,
    0,
    0,
    0,
    0
  );

  return {
    start,
    end,
  };
}

/*
 * =========================================================
 * GET WASTE OUTLET
 *
 * ADMIN
 * MANAGER
 *   -> semua outlet
 *   -> bisa filter outletId
 *
 * OUTLET_ADMIN
 *   -> hanya outlet sendiri
 *   -> query outletId DIABAIKAN
 *
 * DEFAULT:
 *   status = APPROVED
 *
 * month:
 *   YYYY-MM
 *   all
 *
 * IMPORTANT:
 *   Endpoint ini HANYA mengambil type = WASTE.
 * =========================================================
 */

export async function GET(
  req: NextRequest
) {
  try {
    /*
     * =======================================================
     * CURRENT USER
     * =======================================================
     */

    const user = await getCurrentUser();

    if (!user) {
      return jsonError(
        "Tidak login.",
        401
      );
    }

    const role = String(
      user.role || ""
    ).toUpperCase();

    /*
     * =======================================================
     * ROLE ACCESS
     * =======================================================
     */

    const allowedRoles = [
      "ADMIN",
      "MANAGER",
      "OUTLET_ADMIN",
    ];

    if (
      !allowedRoles.includes(role)
    ) {
      return jsonError(
        "Anda tidak memiliki akses ke Waste Outlet.",
        403
      );
    }

    /*
     * =======================================================
     * QUERY PARAMETER
     * =======================================================
     */

    const { searchParams } =
      new URL(req.url);

    /*
     * =======================================================
     * STATUS
     * =======================================================
     */

    const requestedStatus = String(
      searchParams.get("status") ||
        "APPROVED"
    ).toUpperCase();

    const allowedStatuses = [
      "PENDING",
      "APPROVED",
      "REJECTED",
    ];

    if (
      !allowedStatuses.includes(
        requestedStatus
      )
    ) {
      return jsonError(
        "Status Waste tidak valid.",
        400
      );
    }

    /*
     * =======================================================
     * MONTH
     * =======================================================
     */

    const now = new Date();

    const defaultMonth =
      `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}`;

    const month =
      searchParams.get("month") ||
      defaultMonth;

    const isAllMonth =
      month.toLowerCase() === "all";

    if (
      !isAllMonth &&
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(
        month
      )
    ) {
      return jsonError(
        "Format periode tidak valid. Gunakan YYYY-MM atau all.",
        400
      );
    }

    /*
     * =======================================================
     * OUTLET ACCESS
     * =======================================================
     */

    let outletId: number | null = null;

    if (role === "OUTLET_ADMIN") {
      /*
       * =====================================================
       * OUTLET ADMIN
       *
       * SELALU ambil outlet dari DATABASE USER.
       * Query outletId dari client tidak dipercaya.
       * =====================================================
       */

      const userOutletId = Number(
        user.outletId
      );

      if (
        !Number.isInteger(
          userOutletId
        ) ||
        userOutletId <= 0
      ) {
        console.error(
          "[OUTLET WASTE GET] OUTLET_ADMIN TANPA OUTLET",
          {
            userId: user.id,
            fullname: user.fullname,
            role: user.role,
            outletId: user.outletId,
          }
        );

        return jsonError(
          "User Outlet Admin belum memiliki outlet.",
          400
        );
      }

      /*
       * Pastikan outlet user masih ada
       * dan masih aktif.
       */

      if (
        !user.outlet ||
        !user.outlet.active
      ) {
        return jsonError(
          "Outlet user tidak ditemukan atau sudah tidak aktif.",
          400
        );
      }

      outletId = userOutletId;
    } else {
      /*
       * =====================================================
       * ADMIN / MANAGER
       *
       * Bisa melihat semua outlet.
       * Bisa menggunakan ?outletId=...
       * =====================================================
       */

      const requestedOutletId =
        Number(
          searchParams.get(
            "outletId"
          ) || 0
        );

      if (
        Number.isInteger(
          requestedOutletId
        ) &&
        requestedOutletId > 0
      ) {
        outletId =
          requestedOutletId;
      }
    }

    /*
     * =======================================================
     * WHERE
     *
     * IMPORTANT:
     * type SELALU WASTE.
     * =======================================================
     */

    const where: any = {
      type: "WASTE",

      status: requestedStatus,

      wasteQty: {
        gt: 0,
      },
    };

    /*
     * =======================================================
     * MONTH FILTER
     * =======================================================
     */

    if (!isAllMonth) {
      const {
        start: monthStart,
        end: monthEnd,
      } = getMonthRange(month);

      where.trxDate = {
        gte: monthStart,
        lt: monthEnd,
      };
    }

    /*
     * =======================================================
     * OUTLET FILTER
     * =======================================================
     */

    if (outletId !== null) {
      where.outletId = outletId;
    }

    /*
     * =======================================================
     * QUERY
     * =======================================================
     */

    const wastes =
      await prisma.outletStockOut.findMany({
        where,

        include: {
          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },

          barang: {
            select: {
              id: true,
              code: true,
              name: true,
              category: true,
              unit: true,
            },
          },

          user: {
            select: {
              id: true,
              username: true,
              fullname: true,
            },
          },
        },

        orderBy: [
          {
            trxDate: "asc",
          },
          {
            id: "asc",
          },
        ],
      });

    /*
     * =======================================================
     * FORMAT DATA
     * =======================================================
     */

    const data = wastes.map(
      (item) => {
        const qtyProcessed =
          Number(
            item.qtyProcessed || 0
          );

        const wasteQty =
          Number(
            item.wasteQty || 0
          );

        const netQty =
          Number(
            item.netQty || 0
          );

        const unitCost =
          Number(
            item.unitCost || 0
          );

        const storedTotalCost =
          Number(
            item.totalCost || 0
          );

        const totalCost =
          storedTotalCost > 0
            ? storedTotalCost
            : wasteQty * unitCost;

        return {
          id: item.id,

          number: item.number,

          trxDate: item.trxDate,

          outletId:
            item.outletId,

          outlet:
            item.outlet,

          barangId:
            item.barangId,

          barang:
            item.barang,

          type: "WASTE",

          status:
            item.status,

          qtyProcessed,

          wasteQty,

          netQty,

          unitCost,

          totalCost,

          note:
            item.note,

          approvedBy:
            item.approvedBy,

          approvedAt:
            item.approvedAt,

          user:
            item.user,
        };
      }
    );

    /*
     * =======================================================
     * SUMMARY
     * =======================================================
     */

    const totalWasteQty =
      data.reduce(
        (sum, item) =>
          sum + item.wasteQty,
        0
      );

    const totalWasteValue =
      data.reduce(
        (sum, item) =>
          sum + item.totalCost,
        0
      );

    const totalTransactions =
      data.length;

    /*
     * =======================================================
     * BY OUTLET
     * =======================================================
     */

    const byOutlet = new Map<
      number,
      {
        outletId: number;
        outletName: string;
        wasteQty: number;
        wasteValue: number;
      }
    >();

    for (
      const item of data
    ) {
      const existing =
        byOutlet.get(
          item.outletId
        );

      if (existing) {
        existing.wasteQty +=
          item.wasteQty;

        existing.wasteValue +=
          item.totalCost;
      } else {
        byOutlet.set(
          item.outletId,
          {
            outletId:
              item.outletId,

            outletName:
              item.outlet?.name ||
              "-",

            wasteQty:
              item.wasteQty,

            wasteValue:
              item.totalCost,
          }
        );
      }
    }

    /*
     * =======================================================
     * RESPONSE
     * =======================================================
     */

    return NextResponse.json({
      success: true,

      role,

      isOutletAdmin:
        role === "OUTLET_ADMIN",

      outletId,

      type: "WASTE",

      status:
        requestedStatus,

      data,

      summary: {
        month,

        totalTransactions,

        totalWasteQty,

        totalWasteValue,

        byOutlet:
          Array.from(
            byOutlet.values()
          ).sort(
            (a, b) =>
              a.outletName.localeCompare(
                b.outletName
              )
          ),
      },
    });
  } catch (error) {
    console.error(
      "OUTLET WASTE GET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Gagal mengambil data Waste Outlet.",

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * =========================================================
 * POST WASTE OUTLET
 *
 * HANYA OUTLET_ADMIN
 *
 * Flow:
 *
 * POST
 *   ↓
 * type = WASTE
 * status = PENDING
 *   ↓
 * menunggu approval
 *
 * IMPORTANT:
 *
 * POST INI TIDAK:
 * - mengurangi OutletStock
 * - membuat StockCard
 * - membuat StockMutation
 * - membuat transaksi Barang Keluar
 *
 * Stock sudah diproses oleh transaksi Barang Keluar Outlet.
 * =========================================================
 */

export async function POST(
  req: NextRequest
) {
  try {
    /*
     * =======================================================
     * CURRENT USER
     * =======================================================
     */

    const user =
      await getCurrentUser();

    if (!user) {
      return jsonError(
        "Tidak login.",
        401
      );
    }

    const role = String(
      user.role || ""
    ).toUpperCase();

    /*
     * =======================================================
     * ROLE
     * =======================================================
     */

    if (
      role !== "OUTLET_ADMIN"
    ) {
      return jsonError(
        "Hanya Admin Outlet yang dapat membuat Waste.",
        403
      );
    }

    /*
     * =======================================================
     * USER ID
     * =======================================================
     */

    const userId =
      Number(user.id);

    if (
      !Number.isInteger(
        userId
      ) ||
      userId <= 0
    ) {
      return jsonError(
        "User session tidak valid.",
        401
      );
    }

    /*
     * =======================================================
     * OUTLET ID
     *
     * WAJIB dari DATABASE USER.
     * Tidak menerima outletId dari body.
     * =======================================================
     */

    const outletId =
      Number(
        user.outletId
      );

    if (
      !Number.isInteger(
        outletId
      ) ||
      outletId <= 0
    ) {
      return jsonError(
        "User belum memiliki outlet.",
        400
      );
    }

    /*
     * Pastikan relasi outlet user
     * sesuai dengan outletId database.
     */

    if (
      !user.outlet ||
      user.outlet.id !==
        outletId ||
      !user.outlet.active
    ) {
      return jsonError(
        "Outlet user tidak ditemukan atau sudah tidak aktif.",
        400
      );
    }

    /*
     * =======================================================
     * BODY
     * =======================================================
     */

    let body: any;

    try {
      body =
        await req.json();
    } catch {
      return jsonError(
        "Body request tidak valid.",
        400
      );
    }

    /*
     * =======================================================
     * BASIC DATA
     * =======================================================
     */

    const barangId =
      Number(
        body?.barangId || 0
      );

    const qtyProcessed =
      Number(
        body?.qtyProcessed || 0
      );

    const wasteQty =
      Number(
        body?.wasteQty || 0
      );

    const requestedUnitCost =
      Number(
        body?.unitCost || 0
      );

    /*
     * =======================================================
     * TYPE DIKUNCI
     *
     * Tidak lagi menerima body.type.
     * Endpoint ini khusus WASTE.
     * =======================================================
     */

    const type = "WASTE";

    const note =
      typeof body?.note ===
        "string" &&
      body.note.trim()
        ? body.note.trim()
        : null;

    /*
     * =======================================================
     * VALIDASI BARANG
     * =======================================================
     */

    if (
      !Number.isInteger(
        barangId
      ) ||
      barangId <= 0
    ) {
      return jsonError(
        "Barang wajib dipilih.",
        400
      );
    }

    /*
     * =======================================================
     * VALIDASI QTY PROSES
     * =======================================================
     */

    if (
      !Number.isFinite(
        qtyProcessed
      ) ||
      qtyProcessed <= 0
    ) {
      return jsonError(
        "Qty proses harus lebih besar dari 0.",
        400
      );
    }

    /*
     * =======================================================
     * VALIDASI WASTE
     * =======================================================
     */

    if (
      !Number.isFinite(
        wasteQty
      ) ||
      wasteQty <= 0
    ) {
      return jsonError(
        "Qty Waste harus lebih besar dari 0.",
        400
      );
    }

    if (
      wasteQty >
      qtyProcessed
    ) {
      return jsonError(
        "Qty Waste tidak boleh lebih besar dari Qty Proses.",
        400
      );
    }

    /*
     * =======================================================
     * VALIDASI UNIT COST
     * =======================================================
     */

    if (
      !Number.isFinite(
        requestedUnitCost
      ) ||
      requestedUnitCost < 0
    ) {
      return jsonError(
        "Unit Cost tidak valid.",
        400
      );
    }

    /*
     * =======================================================
     * CEK BARANG
     * =======================================================
     */

    const barang =
      await prisma.barang.findUnique({
        where: {
          id: barangId,
        },

        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          unit: true,
          active: true,
        },
      });

    if (!barang) {
      return jsonError(
        "Barang tidak ditemukan.",
        404
      );
    }

    if (!barang.active) {
      return jsonError(
        "Barang sudah tidak aktif.",
        400
      );
    }

    /*
     * =======================================================
     * CEK OUTLET
     * =======================================================
     */

    const outlet =
      await prisma.outlet.findUnique({
        where: {
          id: outletId,
        },

        select: {
          id: true,
          code: true,
          name: true,
          active: true,
        },
      });

    if (!outlet) {
      return jsonError(
        "Outlet tidak ditemukan.",
        404
      );
    }

    if (!outlet.active) {
      return jsonError(
        "Outlet sudah tidak aktif.",
        400
      );
    }

    /*
     * =======================================================
     * STOCK OUTLET
     *
     * Hanya digunakan untuk mengambil averageCost.
     *
     * STOCK TIDAK DIUBAH.
     * =======================================================
     */

    const outletStock =
      await prisma.outletStock.findUnique({
        where: {
          outletId_barangId: {
            outletId,
            barangId,
          },
        },

        select: {
          stock: true,
          averageCost: true,
        },
      });

    if (!outletStock) {
      return jsonError(
        "Barang belum terdaftar pada stock outlet.",
        400
      );
    }

    /*
     * =======================================================
     * UNIT COST
     * =======================================================
     */

    const unitCost =
      requestedUnitCost > 0
        ? requestedUnitCost
        : Number(
            outletStock.averageCost ||
              0
          );

    /*
     * =======================================================
     * CALCULATION
     * =======================================================
     */

    const netQty =
      qtyProcessed -
      wasteQty;

    const totalCost =
      wasteQty *
      unitCost;

    /*
     * =======================================================
     * GENERATE NUMBER
     *
     * WST-YYYYMMDD-0001
     * =======================================================
     */

    const now =
      new Date();

    /*
     * WIB date untuk nomor dokumen.
     */

    const wibTime =
      new Date(
        now.getTime() +
          7 *
            60 *
            60 *
            1000
      );

    const datePart =
      `${wibTime.getUTCFullYear()}${String(
        wibTime.getUTCMonth() + 1
      ).padStart(
        2,
        "0"
      )}${String(
        wibTime.getUTCDate()
      ).padStart(
        2,
        "0"
      )}`;

    const prefix =
      `WST-${datePart}-`;

    /*
     * =======================================================
     * TRANSACTION
     * =======================================================
     */

    const waste =
      await prisma.$transaction(
        async (tx) => {
          /*
           * =================================================
           * DOCUMENT NUMBER
           * =================================================
           */

          let document =
            await tx.documentNumber.findUnique(
              {
                where: {
                  type_period: {
                    type: "WASTE",
                    period: datePart,
                  },
                },
              }
            );

          let sequence = 1;

          /*
           * =================================================
           * DOCUMENT BELUM ADA
           * =================================================
           */

          if (!document) {
            const lastWaste =
              await tx.outletStockOut.findFirst(
                {
                  where: {
                    number: {
                      startsWith:
                        prefix,
                    },
                  },

                  orderBy: {
                    number: "desc",
                  },

                  select: {
                    number: true,
                  },
                }
              );

            if (
              lastWaste?.number
            ) {
              const parsed =
                Number(
                  lastWaste.number
                    .split("-")
                    .pop()
                );

              if (
                Number.isInteger(
                  parsed
                ) &&
                parsed >= 1
              ) {
                sequence =
                  parsed + 1;
              }
            }

            document =
              await tx.documentNumber.create(
                {
                  data: {
                    type:
                      "WASTE",

                    prefix:
                      "WST",

                    period:
                      datePart,

                    lastNumber:
                      sequence,
                  },
                }
              );
          } else {
            sequence =
              document.lastNumber +
              1;

            document =
              await tx.documentNumber.update(
                {
                  where: {
                    id:
                      document.id,
                  },

                  data: {
                    lastNumber:
                      sequence,
                  },
                }
              );
          }

          const number =
            `${prefix}${String(
              sequence
            ).padStart(
              4,
              "0"
            )}`;

          /*
           * =================================================
           * CREATE WASTE
           *
           * PENTING:
           *
           * HANYA CREATE RECORD.
           *
           * TIDAK:
           * - update OutletStock
           * - create StockCard
           * - create StockMutation
           * - create Barang Keluar
           * =================================================
           */

          return tx.outletStockOut.create(
            {
              data: {
                number,

                outletId,

                barangId,

                userId,

                trxDate: now,

                type: "WASTE",

                status:
                  "PENDING",

                qtyProcessed,

                wasteQty,

                netQty,

                unitCost,

                totalCost,

                note,
              },

              include: {
                outlet: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },

                barang: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    category: true,
                    unit: true,
                  },
                },

                user: {
                  select: {
                    id: true,
                    username: true,
                    fullname: true,
                  },
                },
              },
            }
          );
        }
      );

    /*
     * =======================================================
     * RESPONSE
     * =======================================================
     */

    return NextResponse.json(
      {
        success: true,

        message:
          "Waste berhasil dibuat dan menunggu approval.",

        data: {
          id:
            waste.id,

          number:
            waste.number,

          trxDate:
            waste.trxDate,

          outletId:
            waste.outletId,

          outlet:
            waste.outlet,

          barangId:
            waste.barangId,

          barang:
            waste.barang,

          type:
            "WASTE",

          status:
            "PENDING",

          qtyProcessed:
            Number(
              waste.qtyProcessed ||
                0
            ),

          wasteQty:
            Number(
              waste.wasteQty ||
                0
            ),

          netQty:
            Number(
              waste.netQty ||
                0
            ),

          unitCost:
            Number(
              waste.unitCost ||
                0
            ),

          totalCost:
            Number(
              waste.totalCost ||
                0
            ),

          note:
            waste.note,

          user:
            waste.user,
        },
      },
      {
        status: 201,
      }
    );
  } catch (
    error: any
  ) {
    console.error(
      "OUTLET WASTE POST ERROR:",
      error
    );

    /*
     * =======================================================
     * UNIQUE DOCUMENT NUMBER
     * =======================================================
     */

    if (
      error?.code ===
      "P2002"
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Nomor Waste sudah digunakan. Silakan coba lagi.",
        },
        {
          status: 409,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,

        message:
          "Gagal membuat Waste Outlet.",

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}