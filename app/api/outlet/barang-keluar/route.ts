import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const ALLOWED_TYPES = [
  "PEMAKAIAN",
  "WASTE",
  "RUSAK",
  "SAMPLE",
  "LAINNYA",
] as const;

type StockOutType = (typeof ALLOWED_TYPES)[number];

type SessionData = {
  id?: number;
  user?: {
    id?: number;
  };
};

async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get("erp-session");

  if (!session?.value) return null;

  try {
    const sessionData: SessionData = JSON.parse(session.value);

    const userId = Number(
      sessionData?.user?.id ?? sessionData?.id
    );

    if (!Number.isInteger(userId) || userId <= 0) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },

      include: {
        outlet: true,
      },
    });

    if (!user || !user.active) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

function isAllowed(user: any) {
  return (
    user.role === "ADMIN" ||
    user.role === "OUTLET_ADMIN"
  );
}

// =====================================================
// GET
// =====================================================

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    // =================================================
    // AUTH
    // =================================================

    if (!user) {
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

    // =================================================
    // ACCESS
    // =================================================

    if (!isAllowed(user)) {
      return NextResponse.json(
        {
          success: false,
          message: "Akses ditolak",
        },
        {
          status: 403,
        }
      );
    }

    const { searchParams } = new URL(req.url);

    // =================================================
    // REQUEST FILTER
    // =================================================

    const requestedOutletId = Number(
      searchParams.get("outletId")
    );

    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // =================================================
    // OUTLET SCOPE
    // =================================================

    let outletId: number | undefined;

    // -------------------------------------------------
    // OUTLET ADMIN
    // -------------------------------------------------

    if (user.role === "OUTLET_ADMIN") {
      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message: "User belum terhubung ke outlet",
          },
          {
            status: 400,
          }
        );
      }

      // OUTLET_ADMIN selalu menggunakan outlet
      // dari session user.
      outletId = user.outletId;
    }

    // -------------------------------------------------
    // ADMIN PUSAT
    // -------------------------------------------------

    if (user.role === "ADMIN") {
      if (
        Number.isInteger(requestedOutletId) &&
        requestedOutletId > 0
      ) {
        outletId = requestedOutletId;
      }
    }

    // =================================================
    // CURRENT STOCK OUTLET
    // =================================================

    const stocks = await prisma.outletStock.findMany({
      where: {
        ...(outletId
          ? {
              outletId,
            }
          : {}),

        stock: {
          gt: 0,
        },

        barang: {
          active: true,
        },
      },

      include: {
        barang: true,
        outlet: true,
      },

      orderBy: [
        {
          outlet: {
            name: "asc",
          },
        },
        {
          barang: {
            name: "asc",
          },
        },
      ],
    });

    // =================================================
    // HISTORY WHERE
    // =================================================

    const where: any = {
      ...(outletId
        ? {
            outletId,
          }
        : {}),
    };

    // =================================================
    // DATE FILTER
    // =================================================

    if (user.role === "ADMIN") {
      let fromDate: Date | undefined;
      let toDate: Date | undefined;

      if (from) {
        const parsedFrom = new Date(
          `${from}T00:00:00`
        );

        if (!Number.isNaN(parsedFrom.getTime())) {
          fromDate = parsedFrom;
        }
      }

      if (to) {
        const parsedTo = new Date(
          `${to}T23:59:59.999`
        );

        if (!Number.isNaN(parsedTo.getTime())) {
          toDate = parsedTo;
        }
      }

      if (fromDate || toDate) {
        where.trxDate = {};

        if (fromDate) {
          where.trxDate.gte = fromDate;
        }

        if (toDate) {
          where.trxDate.lte = toDate;
        }
      }
    }

    // =================================================
    // ALL HISTORY STOCK OUT
    // =================================================
    //
    // Tidak ada take: 500.
    //
    // Semua history OutletStockOut yang sesuai
    // hak akses dan filter akan diambil.
    // =================================================

    const transactions =
      await prisma.outletStockOut.findMany({
        where,

        include: {
          barang: true,

          outlet: true,

          user: {
            select: {
              id: true,
              fullname: true,
              username: true,
            },
          },
        },

        orderBy: [
          {
            trxDate: "desc",
          },
          {
            id: "desc",
          },
        ],
      });

    // =================================================
    // OUTLET LIST
    // =================================================

    const outlets =
      user.role === "ADMIN"
        ? await prisma.outlet.findMany({
            where: {
              active: true,
            },

            select: {
              id: true,
              code: true,
              name: true,
            },

            orderBy: {
              name: "asc",
            },
          })
        : user.outlet
          ? [
              {
                id: user.outlet.id,
                code: user.outlet.code,
                name: user.outlet.name,
              },
            ]
          : [];

    // =================================================
    // RESPONSE
    // =================================================

    return NextResponse.json({
      success: true,

      role: user.role,

      currentOutlet:
        user.role === "OUTLET_ADMIN" &&
        user.outlet
          ? {
              id: user.outlet.id,
              code: user.outlet.code,
              name: user.outlet.name,
            }
          : null,

      outlets,

      types: ALLOWED_TYPES,

      // =================================================
      // CURRENT STOCK
      // =================================================

      stocks: stocks.map((stock) => ({
        id: stock.id,

        outletId: stock.outletId,

        outlet: stock.outlet.name,

        barangId: stock.barangId,

        code: stock.barang.code,

        name: stock.barang.name,

        unit: stock.barang.unit,

        stock: Number(stock.stock),

        minimumStock: Number(
          stock.minimumStock
        ),

        averageCost: Number(
          stock.averageCost
        ),
      })),

      // =================================================
      // ALL HISTORY
      // =================================================

      transactions: transactions.map(
        (item) => ({
          id: item.id,

          number: item.number,

          outletId: item.outletId,

          outlet: item.outlet.name,

          barangId: item.barangId,

          code: item.barang.code,

          barang: item.barang.name,

          unit: item.barang.unit,

          type: item.type,

          status: item.status,

          qtyProcessed: Number(
            item.qtyProcessed
          ),

          wasteQty: Number(
            item.wasteQty
          ),

          netQty: Number(
            item.netQty
          ),

          unitCost: Number(
            item.unitCost
          ),

          totalCost: Number(
            item.totalCost
          ),

          note: item.note,

          trxDate: item.trxDate,

          approvedBy: item.approvedBy,

          approvedAt: item.approvedAt,

          user: item.user
            ? {
                id: item.user.id,

                fullname:
                  item.user.fullname,

                username:
                  item.user.username,
              }
            : null,
        })
      ),

      // =================================================
      // TOTAL HISTORY
      // =================================================

      totalTransactions:
        transactions.length,
    });
  } catch (error: any) {
    console.error(
      "GET OUTLET BARANG KELUAR ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal mengambil data barang keluar outlet",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// POST
// =====================================================

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
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

    if (!isAllowed(user)) {
      return NextResponse.json(
        {
          success: false,
          message: "Akses ditolak",
        },
        {
          status: 403,
        }
      );
    }

    const body = await req.json();

    const barangId = Number(
      body.barangId
    );

    const type = String(
      body.type || ""
    ).toUpperCase() as StockOutType;

    const note = String(
      body.note || ""
    ).trim();

    // =================================================
    // QTY
    // =================================================

    let qtyProcessed = Number(
      body.qtyProcessed || 0
    );

    let wasteQty = Number(
      body.wasteQty || 0
    );

    if (!Number.isFinite(qtyProcessed)) {
      qtyProcessed = 0;
    }

    if (!Number.isFinite(wasteQty)) {
      wasteQty = 0;
    }

    // =================================================
    // VALIDASI TYPE
    // =================================================

    if (!ALLOWED_TYPES.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          message: "Jenis transaksi tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // WASTE
    // =================================================

    if (type === "WASTE") {
      if (wasteQty <= 0) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Qty waste harus lebih dari 0",
          },
          {
            status: 400,
          }
        );
      }

      qtyProcessed = wasteQty;
    }

    // =================================================
    // NON WASTE
    // =================================================

    else {
      if (qtyProcessed <= 0) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Qty diproses harus lebih dari 0",
          },
          {
            status: 400,
          }
        );
      }

      if (wasteQty < 0) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Qty waste tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      if (wasteQty > qtyProcessed) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Qty waste tidak boleh lebih besar dari qty diproses",
          },
          {
            status: 400,
          }
        );
      }

      if (type !== "PEMAKAIAN") {
        wasteQty = 0;
      }
    }

    // =================================================
    // OUTLET
    // =================================================

    let outletId: number;

    if (user.role === "OUTLET_ADMIN") {
      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User belum terhubung ke outlet",
          },
          {
            status: 400,
          }
        );
      }

      outletId = user.outletId;
    } else {
      const requestedOutletId = Number(
        body.outletId
      );

      if (
        !Number.isInteger(
          requestedOutletId
        ) ||
        requestedOutletId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet wajib dipilih untuk admin pusat",
          },
          {
            status: 400,
          }
        );
      }

      outletId = requestedOutletId;
    }

    // =================================================
    // BARANG
    // =================================================

    if (
      !Number.isInteger(barangId) ||
      barangId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Barang tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // OUTLET VALIDATION
    // =================================================

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

    if (!outlet || !outlet.active) {
      return NextResponse.json(
        {
          success: false,
          message: "Outlet tidak ditemukan",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // TRANSACTION
    // =================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          const stock =
            await tx.outletStock.findUnique({
              where: {
                outletId_barangId: {
                  outletId,
                  barangId,
                },
              },

              include: {
                barang: true,
                outlet: true,
              },
            });

          if (!stock) {
            throw new Error(
              `Barang tidak tersedia di outlet ${outlet.name}`
            );
          }

          const stockBefore =
            Number(stock.stock);

          if (stockBefore <= 0) {
            throw new Error(
              `Stock ${stock.barang.name} di outlet sudah habis`
            );
          }

          if (
            stockBefore <
            qtyProcessed
          ) {
            throw new Error(
              `Stock ${stock.barang.name} tidak cukup. ` +
                `Stock tersedia: ${stockBefore} ${stock.barang.unit}, ` +
                `kebutuhan: ${qtyProcessed} ${stock.barang.unit}`
            );
          }

          // =================================================
          // STOCK AFTER
          // =================================================

          const stockAfter =
            stockBefore -
            qtyProcessed;

          const unitCost =
            Number(
              stock.averageCost || 0
            );

          const totalCost =
            unitCost *
            qtyProcessed;

          await tx.outletStock.update({
            where: {
              id: stock.id,
            },

            data: {
              stock: stockAfter,
            },
          });

          // =================================================
          // DOCUMENT NUMBER
          // =================================================

          const now = new Date();

          const wibTime =
            new Date(
              now.getTime() +
                7 * 60 * 60 * 1000
            );

          const datePart =
            `${wibTime.getUTCFullYear()}` +
            `${String(
              wibTime.getUTCMonth() + 1
            ).padStart(2, "0")}` +
            `${String(
              wibTime.getUTCDate()
            ).padStart(2, "0")}`;

          const prefix =
            `OBK-${datePart}-`;

          let number: string;

          const document =
            await tx.documentNumber.findUnique(
              {
                where: {
                  type_period: {
                    type:
                      "OUTLET_STOCK_OUT",
                    period: datePart,
                  },
                },
              }
            );

          if (!document) {
            const last =
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

            let sequence = 1;

            if (last?.number) {
              const parsed =
                Number(
                  last.number
                    .split("-")
                    .pop()
                );

              if (
                Number.isInteger(
                  parsed
                ) &&
                parsed > 0
              ) {
                sequence =
                  parsed + 1;
              }
            }

            await tx.documentNumber.create({
              data: {
                type:
                  "OUTLET_STOCK_OUT",

                prefix: "OBK",

                period: datePart,

                lastNumber:
                  sequence,
              },
            });

            number =
              `${prefix}${String(
                sequence
              ).padStart(4, "0")}`;
          } else {
            const sequence =
              document.lastNumber +
              1;

            await tx.documentNumber.update(
              {
                where: {
                  id: document.id,
                },

                data: {
                  lastNumber:
                    sequence,
                },
              }
            );

            number =
              `${prefix}${String(
                sequence
              ).padStart(4, "0")}`;
          }

          // =================================================
          // STATUS
          // =================================================

          const initialStatus =
            type === "WASTE"
              ? "PENDING"
              : "APPROVED";

          // =================================================
          // NET
          // =================================================

          const netQty =
            qtyProcessed -
            wasteQty;

          // =================================================
          // CREATE STOCK OUT
          // =================================================

          const stockOut =
            await tx.outletStockOut.create(
              {
                data: {
                  number,

                  outletId,

                  barangId,

                  userId: user.id,

                  trxDate: now,

                  type,

                  status:
                    initialStatus,

                  qtyProcessed,

                  wasteQty,

                  netQty,

                  unitCost,

                  totalCost,

                  note:
                    note || null,
                },

                include: {
                  barang: true,

                  outlet: true,

                  user: {
                    select: {
                      id: true,
                      fullname: true,
                      username: true,
                    },
                  },
                },
              }
            );

          // =================================================
          // STOCK CARD
          // =================================================

          await tx.stockCard.create({
            data: {
              barangId,

              trxDate: now,

              trxType:
                "OUTLET_STOCK_OUT",

              trxNumber: number,

              referenceId:
                stockOut.id,

              warehouse:
                `OUTLET:${stock.outlet.code}`,

              qtyIn: 0,

              qtyOut:
                qtyProcessed,

              balance:
                stockAfter,

              unitPrice:
                unitCost,

              totalValue:
                totalCost,

              note:
                `${type} | ` +
                `Diproses: ${qtyProcessed} ${stock.barang.unit} | ` +
                `Waste: ${wasteQty} ${stock.barang.unit} | ` +
                `Net: ${netQty} ${stock.barang.unit} | ` +
                `Status: ${initialStatus}` +
                (note
                  ? ` | ${note}`
                  : ""),
            },
          });

          // =================================================
          // GLOBAL HISTORY
          // =================================================

          await tx.history.create({
            data: {
              transactionType:
                "STOCK_OUT",

              referenceNumber:
                number,

              userId: user.id,

              description:
                `Barang keluar outlet ${stock.outlet.name}: ` +
                `${stock.barang.name} ` +
                `${qtyProcessed} ${stock.barang.unit}. ` +
                `Jenis: ${type}. ` +
                `Waste: ${wasteQty} ${stock.barang.unit}. ` +
                `Net: ${netQty} ${stock.barang.unit}. ` +
                `Status: ${initialStatus}. ` +
                `Stock: ${stockBefore} → ${stockAfter}.`,
            },
          });

          return {
            stockOut,

            stockBefore,

            stockAfter,
          };
        }
      );

    // =================================================
    // RESPONSE POST
    // =================================================

    return NextResponse.json({
      success: true,

      message:
        type === "WASTE"
          ? `Waste ${result.stockOut.barang.name} berhasil dicatat dan menunggu approval`
          : `Barang ${result.stockOut.barang.name} berhasil diproses`,

      data: {
        id: result.stockOut.id,

        number:
          result.stockOut.number,

        outletId:
          result.stockOut.outletId,

        outlet:
          result.stockOut.outlet.name,

        barangId:
          result.stockOut.barangId,

        barang:
          result.stockOut.barang.name,

        unit:
          result.stockOut.barang.unit,

        type:
          result.stockOut.type,

        status:
          result.stockOut.status,

        qtyProcessed:
          Number(
            result.stockOut.qtyProcessed
          ),

        wasteQty:
          Number(
            result.stockOut.wasteQty
          ),

        netQty:
          Number(
            result.stockOut.netQty
          ),

        stockBefore:
          result.stockBefore,

        stockAfter:
          result.stockAfter,

        unitCost:
          Number(
            result.stockOut.unitCost
          ),

        totalCost:
          Number(
            result.stockOut.totalCost
          ),

        note:
          result.stockOut.note,
      },
    });
  } catch (error: any) {
    console.error(
      "POST OUTLET BARANG KELUAR ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal menyimpan barang keluar outlet",
      },
      {
        status: 500,
      }
    );
  }
}