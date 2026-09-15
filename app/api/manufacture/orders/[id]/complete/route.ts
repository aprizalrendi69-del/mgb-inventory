import {
  NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { toBaseQty, baseToMainQty, getConversionRate } from "@/lib/base-unit";

export const dynamic = "force-dynamic";

/*
 * ============================================================
 * COMPLETE MANUFACTURE ORDER
 * ============================================================
 *
 * FINAL STOCK POLICY:
 *
 * Manufacture hanya bekerja pada STOCK OUTLET.
 *
 * BAHAN:
 *   OutletStock.stock -= plannedQty
 *
 * HASIL:
 *   OutletStock.stock += producedQty
 *
 * TIDAK BOLEH:
 *   - mengurangi Barang.stock pusat
 *   - menambah Barang.stock pusat
 *   - mengubah Inventory pusat
 *
 * Semua saldo yang dipakai sebagai sumber kebenaran
 * untuk Manufacture adalah OutletStock.
 *
 * Outlet berasal dari ManufactureOrder.outletId.
 *
 * SECURITY:
 *
 * OUTLET_ADMIN:
 *   hanya boleh complete MO milik outlet sendiri.
 *
 * GUDANG:
 *   hanya boleh complete MO milik outlet sendiri.
 *
 * ADMIN / MANAGER:
 *   boleh complete MO outlet mana pun.
 *
 * CREATE MO tidak mengubah stock.
 *
 * COMPLETE MO:
 *   1. Validasi order
 *   2. Validasi outlet
 *   3. Validasi bahan pada OutletStock
 *   4. Kurangi OutletStock bahan
 *   5. Tambah OutletStock output
 *   6. Catat StockCard
 *   7. Catat StockMutation
 *   8. Update actualQty
 *   9. Set order COMPLETED
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
 * Admin / Manager:
 *   boleh semua outlet.
 *
 * Outlet Admin / Gudang:
 *   hanya outlet sendiri.
 * ============================================================
 */

function validateOrderOutletAccess(
  user: SessionUser,
  orderOutletId: number,
) {
  const role =
    normalizeRole(user.role);

  if (
    role === "ADMIN" ||
    role === "MANAGER"
  ) {
    return null;
  }

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
 * NUMBER
 * ============================================================
 */

function finiteNumber(
  value: unknown,
): number {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return 0;
  }

  return number;
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
           * OUTLET
           * ==================================================
           */

          if (!order.outletId) {
            throw new Error(
              "Manufacture Order belum memiliki outlet.",
            );
          }

          if (
            !order.outlet
          ) {
            throw new Error(
              "Outlet Manufacture tidak ditemukan.",
            );
          }

          if (
            !order.outlet.active
          ) {
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
           * OUTPUT
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
           * plannedQty pada MO adalah jumlah hasil
           * yang akan diproduksi.
           *
           * outputQty hanya digunakan sebagai informasi
           * BOM dan validasi.
           * ==================================================
           */

          const qtyProduced =
            finiteNumber(
              order.plannedQty,
            );

          if (
            qtyProduced <= 0
          ) {
            throw new Error(
              "Qty produksi tidak valid.",
            );
          }

          const outputQty =
            finiteNumber(
              order.recipe
                .outputQty,
            ) || 1;

          if (
            outputQty <= 0
          ) {
            throw new Error(
              "Qty output BOM tidak valid.",
            );
          }

          /*
           * ==================================================
           * LOAD OUTPUT OUTLET STOCK
           * ==================================================
           *
           * PENTING:
           *
           * Kita TIDAK menggunakan:
           *
           *   output.stock
           *
           * Kita menggunakan:
           *
           *   OutletStock.stock
           *
           * dengan:
           *
           *   outletId = order.outletId
           *   barangId = output.id
           *
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
           * CURRENT OUTPUT STOCK
           * ==================================================
           */

          const beforeOutput =
            finiteNumber(
              outputStock.stock,
            );

          if (
            beforeOutput < 0
          ) {
            throw new Error(
              `Stock outlet ${output.name} tidak valid.`,
            );
          }

          /*
           * ==================================================
           * TIME
           * ==================================================
           */

          const now =
            new Date();

          /*
           * ==================================================
           * CONSUME MATERIAL
           * ==================================================
           *
           * ManufactureOrderItem.plannedQty sudah disimpan
           * dalam satuan yang digunakan OutletStock.
           *
           * JANGAN melakukan konversi ulang di sini.
           *
           * Contoh:
           *
           * OutletStock minyak = 10.000 ml
           * MO item            = 500 ml
           *
           * after = 9.500 ml
           *
           * ==================================================
           */

          for (
            const item of order.items
          ) {
            const qty =
              finiteNumber(
                item.plannedQty,
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
             * LOAD OUTLET STOCK BAHAN
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
                `Bahan ${
                  item.barang?.name ||
                  item.barangId
                } belum terdaftar pada stock outlet ${order.outlet.name}.`,
              );
            }

            /*
             * ------------------------------------------------
             * BARANG AKTIF
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
             * STOCK BEFORE
             * ------------------------------------------------
             */

            const before = finiteNumber(outletStock.stock);

            if (before < 0) {
              throw new Error(`Stock outlet ${outletStock.barang.name} tidak valid.`);
            }

            // ManufactureOrderItem.plannedQty disimpan dalam BASE UNIT.
            const availableBase = toBaseQty(
              before,
              outletStock.barang.unit,
              outletStock.barang,
            );

            if (availableBase + 1e-9 < qty) {
              const baseUnit = String(
                outletStock.barang.baseUnit || outletStock.barang.unit || "",
              ).trim();
              throw new Error(
                `Stock bahan ${outletStock.barang.name} di outlet ${order.outlet.name} tidak cukup. Dibutuhkan ${qty} ${baseUnit}, tersedia ${availableBase} ${baseUnit}.`,
              );
            }

            const qtyOutMain = baseToMainQty(qty, outletStock.barang);
            const after = normalizeStock(before - qtyOutMain);

            /*
             * ------------------------------------------------
             * UPDATE OUTLET STOCK
             * ------------------------------------------------
             *
             * INILAH SATU-SATUNYA STOCK YANG DIUBAH.
             *
             * TIDAK ADA:
             *
             * tx.barang.update()
             *
             * TIDAK ADA:
             *
             * tx.inventory.update()
             * ------------------------------------------------
             */

            await tx.outletStock.update(
              {
                where: {
                  id:
                    outletStock.id,
                },

                data: {
                  stock: after,
                },
              },
            );

            /*
             * ------------------------------------------------
             * ACTUAL QTY
             * ------------------------------------------------
             */

            await tx.manufactureOrderItem.update(
              {
                where: {
                  id: item.id,
                },

                data: {
                  actualQty: qty,
                },
              },
            );

            /*
             * ------------------------------------------------
             * UNIT PRICE
             * ------------------------------------------------
             *
             * Prioritas:
             *
             * 1. averageCost outlet
             * 2. purchasePrice barang
             * 3. 0
             * ------------------------------------------------
             */

            const unitPrice =
              finiteNumber(outletStock.averageCost) ||
              finiteNumber(outletStock.barang.purchasePrice) ||
              0;
            const conversionRate = getConversionRate(outletStock.barang);
            const unitCostBase = conversionRate > 0 ? unitPrice / conversionRate : unitPrice;

            /*
             * ------------------------------------------------
             * STOCK CARD
             * ------------------------------------------------
             */

            await tx.stockCard.create(
              {
                data: {
                  barangId:
                    outletStock.barangId,

                  trxDate: now,

                  trxType:
                    "MANUFACTURE_CONSUME",

                  trxNumber:
                    order.number,

                  referenceId:
                    order.id,

                  warehouse:
                    `OUTLET:${order.outlet.code}`,

                  qtyIn: 0,

                  qtyOut: qtyOutMain,

                  balance: after,

                  unitPrice,

                  totalValue: qtyOutMain * unitPrice,

                  note:
                    `Konsumsi Manufacture ${order.number} • Outlet ${order.outlet.name} • ${qty} ${outletStock.barang.baseUnit || outletStock.barang.unit || ""}`,
                },
              },
            );

            /*
             * ------------------------------------------------
             * STOCK MUTATION
             * ------------------------------------------------
             */

            await tx.stockMutation.create({
              data: {
                outletId: order.outletId,
                barangId: outletStock.barangId,
                type: "MANUFACTURE_CONSUME",
                qty: qtyOutMain,
                stockBefore: before,
                stockAfter: after,
                reference: order.number,
                description: `Konsumsi bahan Manufacture ${order.number} • Outlet ${order.outlet.name} • ${qty} ${outletStock.barang.baseUnit || outletStock.barang.unit || ""}`,
              },
            });
          }

          /*
           * ==================================================
           * OUTPUT STOCK
           * ==================================================
           *
           * PENTING:
           *
           * Output juga masuk ke OutletStock.
           *
           * BUKAN:
           *
           * Barang.stock
           *
           * BUKAN:
           *
           * Inventory.stock
           * ==================================================
           */

          const afterOutput =
            beforeOutput +
            qtyProduced;

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
                  afterOutput,
              },
            },
          );

          /*
           * ------------------------------------------------
           * OUTPUT COST
           * ------------------------------------------------
           *
           * Manufacture output menggunakan averageCost
           * outlet yang sudah ada.
           *
           * Kalau belum ada, fallback purchasePrice.
           * ------------------------------------------------
           */

          const outputUnitPrice =
            finiteNumber(
              outputStock.averageCost,
            ) ||
            finiteNumber(
              outputStock.barang
                .purchasePrice,
            ) ||
            0;

          const outputBaseUnit =
            String(
              outputStock.barang
                .baseUnit ||
                outputStock.barang
                  .unit ||
                "",
            ).trim();

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

                trxDate: now,

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

                qtyOut: 0,

                balance:
                  afterOutput,

                unitPrice:
                  outputUnitPrice,

                totalValue:
                  qtyProduced *
                  outputUnitPrice,

                note:
                  `Hasil Manufacture ${order.number} • Outlet ${order.outlet.name} • ${qtyProduced} ${outputBaseUnit}`,
              },
            },
          );

          /*
           * ------------------------------------------------
           * STOCK MUTATION OUTPUT
           * ------------------------------------------------
           */

          await tx.stockMutation.create(
            {
              data: {
                outletId: order.outletId,
                barangId: outputStock.barangId,
                type: "MANUFACTURE_OUTPUT",

                qty:
                  qtyProduced,

                stockBefore:
                  beforeOutput,

                stockAfter:
                  afterOutput,

                reference:
                  order.number,

                description:
                  `Output Manufacture ${order.number} • Outlet ${order.outlet.name} • ${qtyProduced} ${outputBaseUnit}`,
              },
            },
          );

          /*
           * ==================================================
           * COMPLETE ORDER
           * ==================================================
           */

          const completedOrder =
            await tx.manufactureOrder.update(
              {
                where: {
                  id: order.id,
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
                beforeOutput,

              produced:
                qtyProduced,

              stockAfter:
                afterOutput,

              unit:
                outputBaseUnit,
            },
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
        type: "OUTLET",

        outletId:
          result.outlet.id,

        outlet:
          result.outlet.name,

        source:
          "OutletStock",

        centralStockChanged:
          false,

        centralBarangStockChanged:
          false,

        centralInventoryChanged:
          false,

        outputStock:
          result.output,
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