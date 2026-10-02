import {
  NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import {
  normalizeBaseQty,
  calculateStockAfter,
  assertEnoughStock,
  roundQty,
  roundMoney,
} from "@/lib/unit-conversion";

export const dynamic = "force-dynamic";

/*
 * ============================================================
 * COMPLETE MANUFACTURE ORDER
 * ============================================================
 *
 * FINAL STOCK POLICY
 * ============================================================
 *
 * Manufacture pada route ini bekerja HANYA terhadap:
 *
 *   OutletStock
 *
 * BUKAN:
 *
 *   Barang.stock
 *   Inventory.stock
 *
 * ------------------------------------------------------------
 * STOCK UNIT POLICY
 * ------------------------------------------------------------
 *
 * PENTING:
 *
 * OutletStock.stock menggunakan UNIT BARANG.
 *
 * Contoh:
 *
 *   unit           = botol
 *   baseUnit       = ml
 *   conversionRate = 650
 *
 * Maka:
 *
 *   OutletStock.stock = 3
 *
 * berarti:
 *
 *   3 botol
 *   = 3 × 650 ml
 *   = 1.950 ml
 *
 * ------------------------------------------------------------
 * MANUFACTURE / BOM
 * ------------------------------------------------------------
 *
 * BOM dan ManufactureOrderItem.plannedQty menggunakan
 * BASE UNIT.
 *
 * Contoh:
 *
 *   BOM = 30 ml
 *
 * Maka kebutuhan bahan adalah:
 *
 *   30 ml
 *
 * BUKAN:
 *
 *   30 botol
 *
 * ------------------------------------------------------------
 * SAAT CONSUME
 * ------------------------------------------------------------
 *
 * OutletStock:
 *
 *   stock = 3 botol
 *   conversionRate = 650 ml / botol
 *
 * maka:
 *
 *   stockBase = 3 × 650
 *             = 1.950 ml
 *
 * Jika BOM:
 *
 *   qtyOut = 30 ml
 *
 * maka:
 *
 *   remainingBase = 1.950 - 30
 *                 = 1.920 ml
 *
 * lalu OutletStock dikembalikan ke unit barang:
 *
 *   stockAfter = 1.920 / 650
 *              = 2,953846 botol
 *
 * Jadi TIDAK BOLEH:
 *
 *   30 ml → 30 botol
 *
 * dan TIDAK BOLEH:
 *
 *   30 ml → 1 botol
 *
 * karena conversion harus mempertahankan quantity sebenarnya.
 *
 * ------------------------------------------------------------
 * STOCK CARD / STOCK MUTATION
 * ------------------------------------------------------------
 *
 * StockCard dan StockMutation tetap menggunakan BASE UNIT
 * untuk transaksi manufacture.
 *
 * Contoh:
 *
 *   stockBefore = 1.950 ml
 *   qtyOut      = 30 ml
 *   stockAfter  = 1.920 ml
 *
 * Sedangkan OutletStock menyimpan:
 *
 *   stock = 2,953846 botol
 *
 * ------------------------------------------------------------
 * CREATE MO
 * ------------------------------------------------------------
 *
 * CREATE MO tidak mengubah stock.
 *
 * ------------------------------------------------------------
 * COMPLETE MO
 * ------------------------------------------------------------
 *
 * 1. Validasi order
 * 2. Validasi outlet
 * 3. Validasi status
 * 4. Validasi output
 * 5. Validasi semua bahan
 * 6. Konversi OutletStock UNIT → BASE UNIT
 * 7. Kurangi bahan dalam BASE UNIT
 * 8. Konversi hasil kembali BASE UNIT → UNIT
 * 9. Catat StockCard bahan
 * 10. Catat StockMutation bahan
 * 11. Update actualQty
 * 12. Tambah output dalam BASE UNIT
 * 13. Konversi output kembali ke UNIT
 * 14. Catat StockCard output
 * 15. Catat StockMutation output
 * 16. Set order COMPLETED
 *
 * ============================================================
 */

const ALLOWED_ROLES = [
  "ADMIN",
  "MANAGER",
  "GUDANG",
  "OUTLET_ADMIN",
] as const;

type AllowedRole = (typeof ALLOWED_ROLES)[number];

type SessionUser = {
  id: number;
  role: string;
  outletId: number | null;
  active: boolean;
};

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function normalizeRole(
  value: unknown,
): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function isAllowedRole(
  role: string,
): role is AllowedRole {
  return (
    ALLOWED_ROLES as readonly string[]
  ).includes(role);
}

function fail(
  message: string,
  status = 400,
) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
    },
  );
}

function finiteNumber(
  value: unknown,
): number {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return number;
}

/*
 * ============================================================
 * UNIT HELPERS
 * ============================================================
 *
 * OutletStock.stock:
 *
 *   UNIT BARANG
 *
 * Manufacture:
 *
 *   BASE UNIT
 *
 * ============================================================
 */

/**
 * Mengambil conversion rate yang aman.
 *
 * Jika unit dan baseUnit sama:
 *
 *   rate = 1
 *
 * Jika unit berbeda:
 *
 *   conversionRate wajib > 0
 */
function getConversionRate(
  unit: unknown,
  baseUnit: unknown,
  conversionRate: unknown,
  barangName: string,
): number {
  const normalizedUnit =
    String(unit ?? "")
      .trim()
      .toLowerCase();

  const normalizedBaseUnit =
    String(baseUnit ?? "")
      .trim()
      .toLowerCase();

  /*
   * Kalau unit dan baseUnit sama,
   * tidak membutuhkan conversion.
   */

  if (
    normalizedUnit &&
    normalizedBaseUnit &&
    normalizedUnit ===
      normalizedBaseUnit
  ) {
    return 1;
  }

  const rate =
    finiteNumber(
      conversionRate,
    );

  if (
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    throw new Error(
      `Barang ${barangName} memiliki Unit "${String(
        unit ?? "",
      )}" dan Base Unit "${String(
        baseUnit ?? "",
      )}", tetapi Conversion Rate belum valid.`,
    );
  }

  return rate;
}

/**
 * OutletStock UNIT → BASE UNIT
 *
 * Contoh:
 *
 *   3 botol × 650 = 1.950 ml
 */
function stockUnitToBase(
  stockUnit: number,
  conversionRate: number,
): number {
  return normalizeBaseQty(
    stockUnit * conversionRate,
  );
}

/**
 * BASE UNIT → OutletStock UNIT
 *
 * Contoh:
 *
 *   1.920 ml ÷ 650 = 2,953846 botol
 */
function baseToStockUnit(
  baseQty: number,
  conversionRate: number,
): number {
  if (
    conversionRate <= 0
  ) {
    throw new Error(
      "Conversion Rate tidak valid.",
    );
  }

  return roundQty(
    baseQty /
      conversionRate,
  );
}

/**
 * Cost per OutletStock UNIT → cost per BASE UNIT.
 *
 * Contoh:
 *
 *   averageCost = Rp65.000 / botol
 *   conversion  = 650 ml
 *
 * maka:
 *
 *   Rp65.000 / 650
 *   = Rp100 / ml
 *
 * Jika unit dan baseUnit sama:
 *
 *   cost tetap.
 */
function stockUnitCostToBaseCost(
  costPerUnit: number,
  conversionRate: number,
): number {
  if (
    conversionRate <= 0
  ) {
    return 0;
  }

  return roundMoney(
    costPerUnit /
      conversionRate,
  );
}

/*
 * ============================================================
 * SESSION
 * ============================================================
 */

async function getUser(): Promise<SessionUser | null> {
  const cookieStore =
    await cookies();

  const sessionCookie =
    cookieStore.get("erp-session") ||
    cookieStore.get("session");

  if (!sessionCookie) {
    return null;
  }

  let userId = 0;

  /*
   * ----------------------------------------------------------
   * SESSION DATABASE
   * ----------------------------------------------------------
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
            },
          },
        },
      });

    if (
      session &&
      session.expiresAt > new Date()
    ) {
      userId =
        session.user.id;
    }
  } catch {
    /*
     * Fallback ke session lama.
     */
  }

  /*
   * ----------------------------------------------------------
   * SESSION LAMA
   * ----------------------------------------------------------
   */

  if (!userId) {
    try {
      const parsed =
        JSON.parse(
          sessionCookie.value,
        );

      userId = Number(
        parsed?.user?.id ??
          parsed?.id ??
          0,
      );
    } catch {
      // ignore
    }
  }

  if (!userId) {
    return null;
  }

  /*
   * ----------------------------------------------------------
   * LOAD USER
   * ----------------------------------------------------------
   */

  const user =
    await prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        role: true,
        outletId: true,
        active: true,
      },
    });

  if (!user?.active) {
    return null;
  }

  return user;
}

/*
 * ============================================================
 * OUTLET ACCESS
 * ============================================================
 *
 * ADMIN / MANAGER
 *   → boleh semua outlet.
 *
 * OUTLET_ADMIN / GUDANG
 *   → hanya outlet sendiri.
 *
 * ============================================================
 */

function validateOrderOutletAccess(
  user: SessionUser,
  orderOutletId: number,
) {
  const role =
    normalizeRole(user.role);

  /*
   * ADMIN dan MANAGER dapat mengakses semua outlet.
   */

  if (
    role === "ADMIN" ||
    role === "MANAGER"
  ) {
    return null;
  }

  /*
   * OUTLET_ADMIN dan GUDANG harus
   * memiliki outlet sendiri.
   */

  if (
    role === "OUTLET_ADMIN" ||
    role === "GUDANG"
  ) {
    const userOutletId =
      Number(
        user.outletId ?? 0,
      );

    if (
      !Number.isInteger(
        userOutletId,
      ) ||
      userOutletId <= 0
    ) {
      return "User belum memiliki outlet.";
    }

    if (
      userOutletId !==
      orderOutletId
    ) {
      return "Anda tidak memiliki akses ke Manufacture outlet ini.";
    }
  }

  return null;
}

/*
 * ============================================================
 * POST
 * ============================================================
 */

export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    /*
     * ========================================================
     * AUTH
     * ========================================================
     */

    const user =
      await getUser();

    if (!user) {
      return fail(
        "Tidak login.",
        401,
      );
    }

    const role =
      normalizeRole(
        user.role,
      );

    if (
      !isAllowedRole(role)
    ) {
      return fail(
        "Tidak memiliki akses.",
        403,
      );
    }

    /*
     * ========================================================
     * ID
     * ========================================================
     */

    const resolvedParams =
      await params;

    const orderId =
      Number(
        resolvedParams.id,
      );

    if (
      !Number.isInteger(
        orderId,
      ) ||
      orderId <= 0
    ) {
      return fail(
        "ID order tidak valid.",
      );
    }

    /*
     * ========================================================
     * TRANSACTION
     * ========================================================
     */

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
           * ==================================================
           * LOAD MANUFACTURE ORDER
           * ==================================================
           */

          const order =
            await tx.manufactureOrder.findUnique(
              {
                where: {
                  id: orderId,
                },

                include: {
                  outlet: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      active: true,
                    },
                  },

                  recipe: {
                    include: {
                      productCk: {
                        include: {
                          outputBarang:
                            true,
                        },
                      },

                      outputBarang:
                        true,

                      menu: true,

                      items: {
                        include: {
                          barang: true,
                        },

                        orderBy: {
                          id: "asc",
                        },
                      },
                    },
                  },

                  items: {
                    include: {
                      barang: true,
                    },

                    orderBy: {
                      id: "asc",
                    },
                  },
                },
              },
            );

          if (!order) {
            throw new Error(
              "Order produksi tidak ditemukan.",
            );
          }

          /*
           * ==================================================
           * OUTLET VALIDATION
           * ==================================================
           */

          if (!order.outletId) {
            throw new Error(
              "Manufacture Order belum memiliki outlet.",
            );
          }

          if (!order.outlet) {
            throw new Error(
              "Outlet Manufacture tidak ditemukan.",
            );
          }

          if (!order.outlet.active) {
            throw new Error(
              `Outlet ${order.outlet.name} sedang tidak aktif.`,
            );
          }

          /*
           * ==================================================
           * SECURITY OUTLET
           * ==================================================
           */

          const accessError =
            validateOrderOutletAccess(
              user,
              order.outletId,
            );

          if (accessError) {
            throw new Error(
              accessError,
            );
          }

          /*
           * ==================================================
           * STATUS
           * ==================================================
           */

          if (
            order.status ===
            "COMPLETED"
          ) {
            throw new Error(
              "Order produksi sudah selesai.",
            );
          }

          if (
            order.status ===
              "CANCELLED" ||
            order.status ===
              "VOID"
          ) {
            throw new Error(
              "Order produksi sudah dibatalkan dan tidak dapat diselesaikan.",
            );
          }

          /*
           * ==================================================
           * RECIPE VALIDATION
           * ==================================================
           */

          if (
            order.recipe.menuId
          ) {
            throw new Error(
              "Recipe Menu POS tidak dapat diproses sebagai Manufacture.",
            );
          }

          /*
           * ==================================================
           * OUTPUT BARANG
           * ==================================================
           *
           * Prioritas:
           *
           * 1. ProductCK.outputBarang
           * 2. Recipe.outputBarang
           *
           * Output harus merupakan Barang inventory.
           * ==================================================
           */

          const output =
            order.recipe
              .productCk
              ?.outputBarang ||
            order.recipe
              .outputBarang;

          if (!output) {
            throw new Error(
              "Produk hasil Manufacture tidak ditemukan.",
            );
          }

          /*
           * ==================================================
           * QTY PRODUKSI
           * ==================================================
           *
           * plannedQty pada ManufactureOrder
           * dianggap BASE UNIT.
           *
           * Jadi:
           *
           *   plannedQty = 650 ml
           *
           * tidak dikalikan conversionRate lagi.
           * ==================================================
           */

          const qtyProduced =
            normalizeBaseQty(
              finiteNumber(
                order.plannedQty,
              ),
            );

          if (
            qtyProduced <= 0
          ) {
            throw new Error(
              "Qty produksi tidak valid.",
            );
          }

          /*
           * ==================================================
           * OUTPUT QTY BOM
           * ==================================================
           */

          const outputQtyBom =
            normalizeBaseQty(
              finiteNumber(
                order.recipe
                  .outputQty,
              ),
            );

          if (
            outputQtyBom <= 0
          ) {
            throw new Error(
              "Qty output BOM tidak valid.",
            );
          }

          /*
           * ==================================================
           * VALIDATE MATERIAL ITEMS
           * ==================================================
           *
           * ManufactureOrderItem.plannedQty
           * = BASE UNIT.
           *
           * OutletStock.stock
           * = UNIT BARANG.
           *
           * Karena itu stock harus dikonversi:
           *
           *   stockUnit × conversionRate
           *
           * sebelum dibandingkan dengan qty BOM.
           * ==================================================
           */

          if (
            !order.items ||
            order.items.length === 0
          ) {
            throw new Error(
              "Manufacture Order belum memiliki bahan produksi.",
            );
          }

          /*
           * ==================================================
           * LOAD OUTPUT OUTLET STOCK
           * ==================================================
           */

          const outputStock =
            await tx.outletStock.findFirst(
              {
                where: {
                  outletId:
                    order.outletId,

                  barangId:
                    output.id,
                },

                select: {
                  id: true,
                  outletId: true,
                  barangId: true,
                  stock: true,
                  averageCost: true,
                  minimumStock: true,

                  barang: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      unit: true,
                      baseUnit: true,
                      conversionRate: true,
                      active: true,
                      purchasePrice: true,
                    },
                  },
                },
              },
            );

          if (!outputStock) {
            throw new Error(
              `Barang hasil ${output.name} belum terdaftar pada stock outlet ${order.outlet.name}.`,
            );
          }

          if (
            !outputStock.barang.active
          ) {
            throw new Error(
              `Barang hasil ${output.name} sedang tidak aktif.`,
            );
          }

          /*
           * ==================================================
           * OUTPUT UNIT
           * ==================================================
           */

          const outputUnit =
            String(
              outputStock.barang
                .unit ||
                "",
            ).trim();

          const outputBaseUnit =
            String(
              outputStock.barang
                .baseUnit ||
                outputStock.barang
                  .unit ||
                "",
            ).trim();

          if (!outputUnit) {
            throw new Error(
              `Barang hasil ${output.name} belum memiliki Unit.`,
            );
          }

          if (!outputBaseUnit) {
            throw new Error(
              `Barang hasil ${output.name} belum memiliki Base Unit.`,
            );
          }

          /*
           * ==================================================
           * OUTPUT CONVERSION RATE
           * ==================================================
           */

          const outputConversionRate =
            getConversionRate(
              outputUnit,
              outputBaseUnit,
              outputStock.barang
                .conversionRate,
              output.name,
            );

          /*
           * ==================================================
           * OUTPUT STOCK BEFORE
           * ==================================================
           *
           * OutletStock.stock = UNIT BARANG.
           *
           * Jadi nilai database tidak boleh langsung
           * dianggap sebagai BASE UNIT.
           */

          const beforeOutputUnit =
            roundQty(
              finiteNumber(
                outputStock.stock,
              ),
            );

          if (
            beforeOutputUnit < 0
          ) {
            throw new Error(
              `Stock outlet ${output.name} tidak valid.`,
            );
          }

          /*
           * Konversi ke BASE UNIT hanya untuk kalkulasi.
           */

          const beforeOutputBase =
            stockUnitToBase(
              beforeOutputUnit,
              outputConversionRate,
            );

          /*
           * ==================================================
           * TIME
           * ==================================================
           */

          const now =
            new Date();

          /*
           * ==================================================
           * PRE-VALIDATE ALL MATERIAL STOCK
           * ==================================================
           *
           * Semua stock dicek dahulu.
           *
           * OutletStock:
           *
           *   UNIT
           *
           * BOM:
           *
           *   BASE UNIT
           *
           * Perbandingan:
           *
           *   stockUnit × conversionRate >= qtyBase
           * ==================================================
           */

          const materialChecks: Array<{
            itemId: number;
            barangId: number;
            barangName: string;
            stockId: number;

            stockBeforeUnit: number;
            stockBeforeBase: number;

            qtyOut: number;

            stockAfterBase: number;
            stockAfterUnit: number;

            unit: string;
            baseUnit: string;
            conversionRate: number;

            unitPrice: number;
            baseUnitPrice: number;
          }> = [];

          for (
            const item of order.items
          ) {
            /*
             * ------------------------------------------------
             * QTY BOM
             * ------------------------------------------------
             *
             * plannedQty = BASE UNIT.
             */

            const qty =
              normalizeBaseQty(
                finiteNumber(
                  item.plannedQty,
                ),
              );

            if (
              qty <= 0
            ) {
              throw new Error(
                `Qty bahan ${
                  item.barang?.name ||
                  item.barangId
                } tidak valid.`,
              );
            }

            /*
             * ------------------------------------------------
             * BARANG
             * ------------------------------------------------
             */

            if (!item.barang) {
              throw new Error(
                `Barang bahan ${item.barangId} tidak ditemukan.`,
              );
            }

            /*
             * ------------------------------------------------
             * LOAD OUTLET STOCK
             * ------------------------------------------------
             */

            const outletStock =
              await tx.outletStock.findFirst(
                {
                  where: {
                    outletId:
                      order.outletId,

                    barangId:
                      item.barangId,
                  },

                  select: {
                    id: true,
                    outletId: true,
                    barangId: true,
                    stock: true,
                    averageCost: true,
                    minimumStock: true,

                    barang: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                        unit: true,
                        baseUnit: true,
                        conversionRate: true,
                        active: true,
                        purchasePrice: true,
                      },
                    },
                  },
                },
              );

            if (!outletStock) {
              throw new Error(
                `Bahan ${item.barang.name} belum terdaftar pada stock outlet ${order.outlet.name}.`,
              );
            }

            /*
             * ------------------------------------------------
             * ACTIVE
             * ------------------------------------------------
             */

            if (
              !outletStock.barang.active
            ) {
              throw new Error(
                `Bahan ${outletStock.barang.name} sedang tidak aktif.`,
              );
            }

            /*
             * ------------------------------------------------
             * UNIT
             * ------------------------------------------------
             */

            const unit =
              String(
                outletStock.barang
                  .unit ||
                  "",
              ).trim();

            const baseUnit =
              String(
                outletStock.barang
                  .baseUnit ||
                  outletStock.barang
                    .unit ||
                  "",
              ).trim();

            if (!unit) {
              throw new Error(
                `Bahan ${outletStock.barang.name} belum memiliki Unit.`,
              );
            }

            if (!baseUnit) {
              throw new Error(
                `Bahan ${outletStock.barang.name} belum memiliki Base Unit.`,
              );
            }

            /*
             * ------------------------------------------------
             * CONVERSION RATE
             * ------------------------------------------------
             */

            const conversionRate =
              getConversionRate(
                unit,
                baseUnit,
                outletStock.barang
                  .conversionRate,
                outletStock.barang
                  .name,
              );

            /*
             * ------------------------------------------------
             * STOCK BEFORE
             * ------------------------------------------------
             *
             * DATABASE:
             *
             *   OutletStock.stock = UNIT
             *
             * Contoh:
             *
             *   3 botol
             */

            const beforeUnit =
              roundQty(
                finiteNumber(
                  outletStock.stock,
                ),
              );

            if (
              beforeUnit < 0
            ) {
              throw new Error(
                `Stock outlet ${outletStock.barang.name} tidak valid.`,
              );
            }

            /*
             * ------------------------------------------------
             * STOCK UNIT → BASE
             * ------------------------------------------------
             *
             * Contoh:
             *
             *   3 botol × 650
             *   = 1.950 ml
             */

            const beforeBase =
              stockUnitToBase(
                beforeUnit,
                conversionRate,
              );

            /*
             * ------------------------------------------------
             * STOCK VALIDATION
             * ------------------------------------------------
             *
             * qty = BASE UNIT
             */

            assertEnoughStock(
              beforeBase,
              qty,
              `${outletStock.barang.name} di outlet ${order.outlet.name}`,
            );

            /*
             * ------------------------------------------------
             * STOCK AFTER BASE
             * ------------------------------------------------
             *
             * Contoh:
             *
             *   1.950 ml - 30 ml
             *   = 1.920 ml
             */

            const stockResult =
              calculateStockAfter({
                stockBefore:
                  beforeBase,

                qtyIn:
                  0,

                qtyOut:
                  qty,
              });

            const afterBase =
              normalizeBaseQty(
                stockResult.stockAfter,
              );

            /*
             * ------------------------------------------------
             * STOCK BASE → UNIT
             * ------------------------------------------------
             *
             * Contoh:
             *
             *   1.920 / 650
             *   = 2,953846 botol
             */

            const afterUnit =
              baseToStockUnit(
                afterBase,
                conversionRate,
              );

            /*
             * ------------------------------------------------
             * UNIT PRICE
             * ------------------------------------------------
             *
             * averageCost pada OutletStock dianggap
             * sebagai cost per UNIT STOCK.
             *
             * Contoh:
             *
             *   Rp65.000 / botol
             *
             * Maka cost per ml:
             *
             *   Rp65.000 / 650
             *   = Rp100 / ml
             */

            const unitPrice =
              roundMoney(
                finiteNumber(
                  outletStock.averageCost,
                ) ||
                  finiteNumber(
                    outletStock
                      .barang
                      .purchasePrice,
                  ) ||
                  0,
              );

            const baseUnitPrice =
              stockUnitCostToBaseCost(
                unitPrice,
                conversionRate,
              );

            materialChecks.push({
              itemId:
                item.id,

              barangId:
                outletStock.barangId,

              barangName:
                outletStock.barang.name,

              stockId:
                outletStock.id,

              stockBeforeUnit:
                beforeUnit,

              stockBeforeBase:
                beforeBase,

              qtyOut:
                qty,

              stockAfterBase:
                afterBase,

              stockAfterUnit:
                afterUnit,

              unit,

              baseUnit,

              conversionRate,

              unitPrice,

              baseUnitPrice,
            });
          }

          /*
           * ==================================================
           * CONSUME MATERIAL
           * ==================================================
           *
           * OutletStock disimpan kembali dalam UNIT.
           *
           * StockCard / StockMutation:
           *
           *   BASE UNIT.
           * ==================================================
           */

          for (
            const material of
              materialChecks
          ) {
            /*
             * ------------------------------------------------
             * UPDATE OUTLET STOCK
             * ------------------------------------------------
             */

            await tx.outletStock.update(
              {
                where: {
                  id:
                    material.stockId,
                },

                data: {
                  stock:
                    material.stockAfterUnit,
                },
              },
            );

            /*
             * ------------------------------------------------
             * UPDATE ACTUAL QTY
             * ------------------------------------------------
             *
             * actualQty tetap BASE UNIT karena merupakan
             * quantity consumption manufacture.
             */

            await tx.manufactureOrderItem.update(
              {
                where: {
                  id:
                    material.itemId,
                },

                data: {
                  actualQty:
                    material.qtyOut,
                },
              },
            );

            /*
             * ------------------------------------------------
             * STOCK CARD
             * ------------------------------------------------
             *
             * Semua quantity transaksi manufacture
             * dicatat dalam BASE UNIT.
             */

            await tx.stockCard.create(
              {
                data: {
                  barangId:
                    material.barangId,

                  trxDate:
                    now,

                  trxType:
                    "MANUFACTURE_CONSUME",

                  trxNumber:
                    order.number,

                  referenceId:
                    order.id,

                  warehouse:
                    `OUTLET:${order.outlet.code}`,

                  qtyIn:
                    0,

                  qtyOut:
                    material.qtyOut,

                  balance:
                    material.stockAfterBase,

                  unitPrice:
                    material.baseUnitPrice,

                  totalValue:
                    roundMoney(
                      material.qtyOut *
                        material.baseUnitPrice,
                    ),

                  note:
                    `Konsumsi Manufacture ${order.number} • Outlet ${order.outlet.name} • ${material.qtyOut} ${material.baseUnit} • Stock ${material.stockBeforeUnit} ${material.unit} → ${material.stockAfterUnit} ${material.unit}`,
                },
              },
            );

            /*
             * ------------------------------------------------
             * STOCK MUTATION
             * ------------------------------------------------
             *
             * qty / before / after = BASE UNIT.
             */

            await tx.stockMutation.create({
              data: {
                outletId:
                  order.outletId,

                barangId:
                  material.barangId,

                type:
                  "MANUFACTURE_CONSUME",

                qty:
                  material.qtyOut,

                stockBefore:
                  material.stockBeforeBase,

                stockAfter:
                  material.stockAfterBase,

                reference:
                  order.number,

                description:
                  `Konsumsi bahan Manufacture ${order.number} • Outlet ${order.outlet.name} • ${material.qtyOut} ${material.baseUnit} • Stock ${material.stockBeforeUnit} ${material.unit} → ${material.stockAfterUnit} ${material.unit}`,
              },
            });
          }

          /*
           * ==================================================
           * OUTPUT STOCK
           * ==================================================
           *
           * qtyProduced = BASE UNIT.
           *
           * OutletStock = UNIT BARANG.
           *
           * Jadi:
           *
           *   beforeOutputBase
           *   +
           *   qtyProduced
           *
           * lalu hasil dikonversi kembali ke UNIT.
           * ==================================================
           */

          const outputStockResult =
            calculateStockAfter({
              stockBefore:
                beforeOutputBase,

              qtyIn:
                qtyProduced,

              qtyOut:
                0,
            });

          const afterOutputBase =
            normalizeBaseQty(
              outputStockResult.stockAfter,
            );

          /*
           * BASE → UNIT
           */

          const afterOutputUnit =
            baseToStockUnit(
              afterOutputBase,
              outputConversionRate,
            );

          /*
           * ------------------------------------------------
           * UPDATE OUTPUT OUTLET STOCK
           * ------------------------------------------------
           */

          await tx.outletStock.update(
            {
              where: {
                id:
                  outputStock.id,
              },

              data: {
                stock:
                  afterOutputUnit,
              },
            },
          );

          /*
           * ------------------------------------------------
           * OUTPUT COST
           * ------------------------------------------------
           *
           * averageCost dianggap cost per UNIT stock.
           *
           * Untuk StockCard BASE UNIT, konversikan ke
           * cost per BASE UNIT.
           */

          const outputUnitPrice =
            roundMoney(
              finiteNumber(
                outputStock.averageCost,
              ) ||
                finiteNumber(
                  outputStock
                    .barang
                    .purchasePrice,
                ) ||
                0,
            );

          const outputBaseUnitPrice =
            stockUnitCostToBaseCost(
              outputUnitPrice,
              outputConversionRate,
            );

          /*
           * ------------------------------------------------
           * STOCK CARD OUTPUT
           * ------------------------------------------------
           */

          await tx.stockCard.create(
            {
              data: {
                barangId:
                  outputStock.barangId,

                trxDate:
                  now,

                trxType:
                  "MANUFACTURE_OUTPUT",

                trxNumber:
                  order.number,

                referenceId:
                  order.id,

                warehouse:
                  `OUTLET:${order.outlet.code}`,

                qtyIn:
                  qtyProduced,

                qtyOut:
                  0,

                balance:
                  afterOutputBase,

                unitPrice:
                  outputBaseUnitPrice,

                totalValue:
                  roundMoney(
                    qtyProduced *
                      outputBaseUnitPrice,
                  ),

                note:
                  `Hasil Manufacture ${order.number} • Outlet ${order.outlet.name} • ${qtyProduced} ${outputBaseUnit} • Stock ${beforeOutputUnit} ${outputUnit} → ${afterOutputUnit} ${outputUnit}`,
              },
            },
          );

          /*
           * ------------------------------------------------
           * STOCK MUTATION OUTPUT
           * ------------------------------------------------
           *
           * BASE UNIT.
           */

          await tx.stockMutation.create({
            data: {
              outletId:
                order.outletId,

              barangId:
                outputStock.barangId,

              type:
                "MANUFACTURE_OUTPUT",

              qty:
                qtyProduced,

              stockBefore:
                beforeOutputBase,

              stockAfter:
                afterOutputBase,

              reference:
                order.number,

              description:
                `Output Manufacture ${order.number} • Outlet ${order.outlet.name} • ${qtyProduced} ${outputBaseUnit} • Stock ${beforeOutputUnit} ${outputUnit} → ${afterOutputUnit} ${outputUnit}`,
            },
          });

          /*
           * ==================================================
           * COMPLETE ORDER
           * ==================================================
           */

          const completedOrder =
            await tx.manufactureOrder.update(
              {
                where: {
                  id:
                    order.id,
                },

                data: {
                  producedQty:
                    qtyProduced,

                  status:
                    "COMPLETED",
                },

                include: {
                  outlet: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                    },
                  },

                  recipe: {
                    include: {
                      productCk: {
                        include: {
                          outputBarang:
                            true,
                        },
                      },

                      outputBarang:
                        true,

                      menu: true,
                    },
                  },

                  items: {
                    include: {
                      barang: true,
                    },

                    orderBy: {
                      id: "asc",
                    },
                  },
                },
              },
            );

          /*
           * ==================================================
           * RETURN RESULT
           * ==================================================
           */

          return {
            order:
              completedOrder,

            outlet: {
              id:
                order.outlet.id,

              code:
                order.outlet.code,

              name:
                order.outlet.name,
            },

            output: {
              barangId:
                outputStock.barangId,

              name:
                outputStock.barang.name,

              stockBefore:
                beforeOutputUnit,

              stockBeforeBase:
                beforeOutputBase,

              produced:
                qtyProduced,

              producedUnit:
                outputBaseUnit,

              stockAfter:
                afterOutputUnit,

              stockAfterBase:
                afterOutputBase,

              unit:
                outputUnit,

              baseUnit:
                outputBaseUnit,

              conversionRate:
                outputConversionRate,
            },

            materials:
              materialChecks.map(
                (material) => ({
                  barangId:
                    material.barangId,

                  name:
                    material.barangName,

                  stockBefore:
                    material.stockBeforeUnit,

                  stockBeforeBase:
                    material.stockBeforeBase,

                  qtyOut:
                    material.qtyOut,

                  stockAfter:
                    material.stockAfterUnit,

                  stockAfterBase:
                    material.stockAfterBase,

                  unit:
                    material.unit,

                  baseUnit:
                    material.baseUnit,

                  conversionRate:
                    material.conversionRate,
                }),
              ),
          };
        },
      );

    /*
     * ========================================================
     * SUCCESS
     * ========================================================
     */

    return NextResponse.json({
      success: true,

      message:
        `Manufacture ${result.order.number} selesai. Stock outlet ${result.outlet.name} berhasil diperbarui.`,

      data:
        result.order,

      stockPolicy: {
        type:
          "OUTLET",

        outletId:
          result.outlet.id,

        outlet:
          result.outlet.name,

        source:
          "OutletStock",

        /*
         * PENTING:
         *
         * OutletStock menggunakan UNIT BARANG.
         *
         * Transaction log menggunakan BASE UNIT.
         */

        unitPolicy:
          "OUTLET_STOCK_UNIT_TRANSACTION_BASE_UNIT",

        outletStockUnit:
          "BARANG_UNIT",

        transactionUnit:
          "BASE_UNIT",

        centralStockChanged:
          false,

        centralBarangStockChanged:
          false,

        centralInventoryChanged:
          false,

        outputStock:
          result.output,

        materials:
          result.materials,
      },
    });
  } catch (error: any) {
    console.error(
      "POST /api/manufacture/orders/[id]/complete ERROR:",
      error,
    );

    return fail(
      error?.message ||
        "Gagal menyelesaikan Manufacture.",
      500,
    );
  }
}