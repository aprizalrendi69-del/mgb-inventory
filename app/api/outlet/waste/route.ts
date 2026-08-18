import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/*
 * =========================================================
 * CURRENT USER
 *
 * Session hanya dipakai untuk mendapatkan USER ID.
 * Data outlet diambil ulang dari database supaya
 * outletId selalu mengikuti data User terbaru.
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
    const dbSession =
      await prisma.session.findUnique({
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
      if (
        dbSession.expiresAt <
        new Date()
      ) {
        return null;
      }

      userId =
        dbSession.user.id;
    }
  } catch {
    /*
     * Jika session database tidak ditemukan /
     * model session tidak tersedia, lanjut ke
     * session JSON.
     */
  }

  /*
   * =======================================================
   * SESSION JSON
   * =======================================================
   */

  if (!userId) {
    try {
      const data =
        JSON.parse(
          session.value
        );

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
   * AMBIL USER LANGSUNG DARI DATABASE
   *
   * INI YANG MEMASTIKAN outletId TIDAK DIAMBIL
   * DARI COOKIE LAMA.
   * =======================================================
   */

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
 * HELPERS
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

function getMonthRange(
  month: string
) {
  const [
    year,
    monthNumber,
  ] = month
    .split("-")
    .map(Number);

  const start =
    new Date(
      year,
      monthNumber - 1,
      1,
      0,
      0,
      0,
      0
    );

  const end =
    new Date(
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
 *   -> outletId dari query DIABAIKAN
 *
 * Default:
 *   status = APPROVED
 *
 * month:
 *   2026-08
 *   all
 *
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

    const user =
      await getCurrentUser();

    if (!user) {
      return jsonError(
        "Tidak login.",
        401
      );
    }

    const role =
      String(
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
      !allowedRoles.includes(
        role
      )
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

    const {
      searchParams,
    } = new URL(req.url);

    /*
     * =======================================================
     * STATUS
     * =======================================================
     */

    const requestedStatus =
      String(
        searchParams.get(
          "status"
        ) || "APPROVED"
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

    const now =
      new Date();

    const defaultMonth =
      `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}`;

    const month =
      searchParams.get(
        "month"
      ) || defaultMonth;

    const isAllMonth =
      month.toLowerCase() ===
      "all";

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

    let outletId:
      number | null = null;

    if (
      role ===
      "OUTLET_ADMIN"
    ) {
      /*
       * =====================================================
       * OUTLET ADMIN
       *
       * SELALU gunakan outletId dari DATABASE USER.
       * =====================================================
       */

      const sessionOutletId =
        Number(
          user.outletId
        );

      if (
        !Number.isInteger(
          sessionOutletId
        ) ||
        sessionOutletId <= 0
      ) {
        console.error(
          "[OUTLET WASTE] OUTLET_ADMIN TANPA OUTLET",
          {
            userId:
              user.id,
            fullname:
              user.fullname,
            role:
              user.role,
            outletId:
              user.outletId,
          }
        );

        return jsonError(
          "User Outlet Admin belum memiliki outlet.",
          400
        );
      }

      /*
       * Pastikan outlet benar-benar ada
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

      outletId =
        sessionOutletId;
    } else {
      /*
       * =====================================================
       * ADMIN / MANAGER
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
     * =======================================================
     */

    const where: any = {
      status:
        requestedStatus,

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
      } =
        getMonthRange(
          month
        );

      where.trxDate = {
        gte:
          monthStart,

        lt:
          monthEnd,
      };
    }

    /*
     * =======================================================
     * OUTLET FILTER
     * =======================================================
     */

    if (
      outletId !== null
    ) {
      where.outletId =
        outletId;
    }

    /*
     * =======================================================
     * QUERY WASTE
     * =======================================================
     */

    const wastes =
      await prisma.outletStockOut.findMany(
        {
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
              trxDate:
                "asc",
            },

            {
              id:
                "asc",
            },
          ],
        }
      );

    /*
     * =======================================================
     * FORMAT DATA
     * =======================================================
     */

    const data =
      wastes.map(
        (item) => {
          const qtyProcessed =
            Number(
              item.qtyProcessed ||
                0
            );

          const wasteQty =
            Number(
              item.wasteQty ||
                0
            );

          const netQty =
            Number(
              item.netQty ||
                0
            );

          const unitCost =
            Number(
              item.unitCost ||
                0
            );

          const storedTotalCost =
            Number(
              item.totalCost ||
                0
            );

          const totalCost =
            storedTotalCost > 0
              ? storedTotalCost
              : wasteQty *
                unitCost;

          return {
            id:
              item.id,

            number:
              item.number,

            trxDate:
              item.trxDate,

            outletId:
              item.outletId,

            outlet:
              item.outlet,

            barangId:
              item.barangId,

            barang:
              item.barang,

            type:
              item.type,

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
        (
          sum,
          item
        ) =>
          sum +
          item.wasteQty,
        0
      );

    const totalWasteValue =
      data.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.totalCost,
        0
      );

    const totalTransactions =
      data.length;

    /*
     * =======================================================
     * BY OUTLET
     * =======================================================
     */

    const byOutlet =
      new Map<
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
      success:
        true,

      role,

      isOutletAdmin:
        role ===
        "OUTLET_ADMIN",

      outletId,

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
            (
              a,
              b
            ) =>
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
        success:
          false,

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
 * PENDING -> menunggu approval
 *
 * POST INI TIDAK MENGURANGI STOCK.
 * Stock sudah diproses oleh transaksi
 * Barang Keluar Outlet.
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

    const role =
      String(
        user.role || ""
      ).toUpperCase();

    /*
     * =======================================================
     * ROLE
     * =======================================================
     */

    if (
      role !==
      "OUTLET_ADMIN"
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
      Number(
        user.id
      );

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
     * Diambil dari USER DATABASE.
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
        body?.barangId ||
          0
      );

    const qtyProcessed =
      Number(
        body?.qtyProcessed ||
          0
      );

    const wasteQty =
      Number(
        body?.wasteQty ||
          0
      );

    const requestedUnitCost =
      Number(
        body?.unitCost ||
          0
      );

    const type =
      typeof body?.type ===
        "string" &&
      body.type.trim()
        ? body.type.trim()
        : "WASTE";

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
          id:
            barangId,
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

    if (
      !barang.active
    ) {
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
          id:
            outletId,
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

    if (
      !outlet.active
    ) {
      return jsonError(
        "Outlet sudah tidak aktif.",
        400
      );
    }

    /*
     * =======================================================
     * STOCK OUTLET
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
      requestedUnitCost >
      0
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
        wibTime.getUTCMonth() +
          1
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
        async (
          tx
        ) => {
          /*
           * DOCUMENT NUMBER
           */

          let document =
            await tx.documentNumber.findUnique(
              {
                where: {
                  type_period: {
                    type:
                      "WASTE",

                    period:
                      datePart,
                  },
                },
              }
            );

          let sequence =
            1;

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
                    number:
                      "desc",
                  },

                  select: {
                    number:
                      true,
                  },
                }
              );

            if (
              lastWaste?.number
            ) {
              const parsed =
                Number(
                  lastWaste.number
                    .split(
                      "-"
                    )
                    .pop()
                );

              if (
                Number.isInteger(
                  parsed
                ) &&
                parsed >=
                  1
              ) {
                sequence =
                  parsed +
                  1;
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
           * TIDAK MENGURANGI STOCK.
           * =================================================
           */

          return tx.outletStockOut.create(
            {
              data: {
                number,

                outletId,

                barangId,

                userId,

                trxDate:
                  now,

                type,

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
                    category:
                      true,
                    unit: true,
                  },
                },

                user: {
                  select: {
                    id: true,
                    username:
                      true,
                    fullname:
                      true,
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
        success:
          true,

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
            waste.type,

          status:
            waste.status,

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
        status:
          201,
      }
    );
  } catch (
    error: any
  ) {
    console.error(
      "OUTLET WASTE POST ERROR:",
      error
    );

    if (
      error?.code ===
      "P2002"
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Nomor Waste sudah digunakan. Silakan coba lagi.",
        },
        {
          status:
            409,
        }
      );
    }

    return NextResponse.json(
      {
        success:
          false,

        message:
          "Gagal membuat Waste Outlet.",

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status:
          500,
      }
    );
  }
}