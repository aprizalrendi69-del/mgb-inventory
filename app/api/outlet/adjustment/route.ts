import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ItemInput = {
  barangId: number | string;
  qty: number | string;
  price?: number | string;
  type?: string;
};

type NormalizedItem = {
  barangId: number;
  qty: number;
  price: number;
  type: "IN" | "OUT";
};

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status }
  );
}

/*
|--------------------------------------------------------------------------
| NORMALIZER
|--------------------------------------------------------------------------
*/

function normalizeRole(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function normalizeType(value: unknown): "IN" | "OUT" {
  const type = String(value ?? "")
    .trim()
    .toUpperCase();

  if (
    type === "OUT" ||
    type === "MINUS" ||
    type === "REDUCE"
  ) {
    return "OUT";
  }

  return "IN";
}

function normalizeStatus(value: unknown) {
  const status = String(value ?? "")
    .trim()
    .toUpperCase();

  if (
    status === "DRAFT" ||
    status === "PENDING" ||
    status === "APPROVED" ||
    status === "REJECTED"
  ) {
    return status;
  }

  return "DRAFT";
}

function isAdmin(role: unknown) {
  return normalizeRole(role) === "ADMIN";
}

function isOutletAdmin(role: unknown) {
  return (
    normalizeRole(role) === "OUTLET_ADMIN"
  );
}

function isAllowedRole(role: unknown) {
  const normalized = normalizeRole(role);

  return (
    normalized === "ADMIN" ||
    normalized === "MANAGER" ||
    normalized === "OUTLET_ADMIN"
  );
}

/*
|--------------------------------------------------------------------------
| NUMBER VALIDATION
|--------------------------------------------------------------------------
*/

function positiveNumber(
  value: unknown,
  label: string
) {
  const n = Number(value);

  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(
      `${label} harus lebih besar dari 0`
    );
  }

  return n;
}

function nonNegativeNumber(
  value: unknown,
  label: string
) {
  const n = Number(value);

  if (!Number.isFinite(n) || n < 0) {
    throw new Error(
      `${label} tidak boleh negatif`
    );
  }

  return n;
}

/*
|--------------------------------------------------------------------------
| NUMBER NORMALIZATION
|--------------------------------------------------------------------------
|
| Stock menggunakan Float.
| Kita tetap menjaga nilai sangat kecil agar tidak muncul
| sebagai -0.0000000001 atau sejenisnya.
|
*/

function normalizeStock(value: number) {
  if (
    !Number.isFinite(value) ||
    Math.abs(value) < 0.000001
  ) {
    return 0;
  }

  return value;
}

/*
|--------------------------------------------------------------------------
| GENERATE NUMBER
|--------------------------------------------------------------------------
*/

function generateNumber() {
  const now = new Date();

  const date =
    `${now.getFullYear()}` +
    `${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}` +
    `${String(now.getDate()).padStart(2, "0")}`;

  const time =
    `${String(now.getHours()).padStart(
      2,
      "0"
    )}` +
    `${String(now.getMinutes()).padStart(
      2,
      "0"
    )}` +
    `${String(now.getSeconds()).padStart(
      2,
      "0"
    )}`;

  const random = Math.floor(
    Math.random() * 1000
  )
    .toString()
    .padStart(3, "0");

  return `ADJ-OUT-${date}-${time}-${random}`;
}

/*
|--------------------------------------------------------------------------
| AUTH
|--------------------------------------------------------------------------
|
| Session utama project:
| cookie "erp-session" berisi JSON.
|
| Contoh struktur yang didukung:
|
| {
|   user: {
|     id: 1
|   }
| }
|
| atau:
|
| {
|   id: 1
| }
|
*/

async function getCurrentUser() {
  try {
    const cookieStore =
      await import("next/headers").then(
        ({ cookies }) => cookies()
      );

    const rawSession =
      cookieStore.get("erp-session")?.value;

    if (!rawSession) {
      return null;
    }

    let sessionData: any;

    try {
      sessionData = JSON.parse(
        rawSession
      );
    } catch {
      return null;
    }

    const userId = Number(
      sessionData?.user?.id ??
        sessionData?.id
    );

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return null;
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },

        include: {
          outlet: true,
        },
      });

    return user ?? null;
  } catch (error) {
    console.error(
      "getCurrentUser outlet adjustment error:",
      error
    );

    return null;
  }
}

/*
|--------------------------------------------------------------------------
| OUTLET RESOLUTION
|--------------------------------------------------------------------------
*/

async function resolveOutletId(
  user: any,
  requestedOutletId: unknown
) {
  const role = normalizeRole(
    user?.role
  );

  /*
   * OUTLET_ADMIN selalu menggunakan outlet sendiri.
   * Tidak boleh menerima outletId dari frontend.
   */
  if (role === "OUTLET_ADMIN") {
    const ownOutletId = Number(
      user?.outletId ?? 0
    );

    if (
      !Number.isInteger(
        ownOutletId
      ) ||
      ownOutletId <= 0
    ) {
      throw new Error(
        "User Outlet Admin belum memiliki outlet"
      );
    }

    return ownOutletId;
  }

  /*
   * ADMIN / MANAGER wajib memilih outlet.
   */
  const outletId = Number(
    requestedOutletId ?? 0
  );

  if (
    !Number.isInteger(outletId) ||
    outletId <= 0
  ) {
    throw new Error(
      "Outlet wajib dipilih"
    );
  }

  return outletId;
}

/*
|--------------------------------------------------------------------------
| GET
|--------------------------------------------------------------------------
|
| GET /api/outlet/adjustment
| GET /api/outlet/adjustment?outletId=1
|
*/

export async function GET(
  req: NextRequest
) {
  try {
    const user =
      await getCurrentUser();

    if (!user) {
      return errorResponse(
        "Tidak login atau session tidak valid",
        401
      );
    }

    if (!user.active) {
      return errorResponse(
        "User tidak aktif",
        403
      );
    }

    if (
      !isAllowedRole(user.role)
    ) {
      return errorResponse(
        "Anda tidak memiliki akses Adjustment Outlet",
        403
      );
    }

    const { searchParams } =
      new URL(req.url);

    let outletId:
      | number
      | undefined;

    /*
     * OUTLET_ADMIN hanya outlet sendiri.
     */
    if (
      isOutletAdmin(user.role)
    ) {
      outletId =
        await resolveOutletId(
          user,
          null
        );
    } else {
      const requested =
        Number(
          searchParams.get(
            "outletId"
          ) ?? 0
        );

      /*
       * Kalau outletId dikirim,
       * filter outlet tersebut.
       *
       * Kalau tidak dikirim,
       * ADMIN/MANAGER melihat semua outlet.
       */
      if (requested > 0) {
        outletId = requested;
      }
    }

    const data =
      await prisma.outletAdjustment.findMany(
        {
          where: outletId
            ? {
                outletId,
              }
            : undefined,

          include: {
            outlet: {
              select: {
                id: true,
                code: true,
                name: true,
                active: true,
              },
            },

            items: {
              include: {
                barang: {
                  select: {
                    id: true,
                    code: true,
                    barcode: true,
                    name: true,
                    unit: true,
                    baseUnit: true,
                    conversionRate: true,
                    purchasePrice: true,
                    sellingPrice: true,
                    active: true,
                  },
                },
              },

              orderBy: {
                id: "asc",
              },
            },
          },

          orderBy: {
            adjustmentDate: "desc",
          },
        }
      );

    return NextResponse.json({
      success: true,

      user: {
        id: user.id,
        fullname: user.fullname,
        role: user.role,
        outletId:
          user.outletId ?? null,
      },

      data,
    });
  } catch (error: any) {
    console.error(
      "GET /api/outlet/adjustment error:",
      error
    );

    return errorResponse(
      error?.message ||
        "Gagal mengambil adjustment outlet",
      500
    );
  }
}

/*
|--------------------------------------------------------------------------
| POST
|--------------------------------------------------------------------------
|
| POST hanya membuat DRAFT.
|
| PENTING:
| Client tidak boleh membuat adjustment langsung APPROVED.
|
| Approval harus melalui PATCH APPROVE
| dan hanya ADMIN pusat yang boleh melakukan approval.
|
*/

export async function POST(
  req: NextRequest
) {
  try {
    const user =
      await getCurrentUser();

    if (!user) {
      return errorResponse(
        "Tidak login atau session tidak valid",
        401
      );
    }

    if (!user.active) {
      return errorResponse(
        "User tidak aktif",
        403
      );
    }

    if (
      !isAllowedRole(user.role)
    ) {
      return errorResponse(
        "Anda tidak memiliki akses Adjustment Outlet",
        403
      );
    }

    const body =
      await req.json();

    /*
     * Resolve outlet berdasarkan role.
     */
    const outletId =
      await resolveOutletId(
        user,
        body.outletId
      );

    /*
     * Pastikan outlet valid.
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
      return errorResponse(
        "Outlet tidak ditemukan",
        404
      );
    }

    if (!outlet.active) {
      return errorResponse(
        "Outlet tidak aktif",
        400
      );
    }

    /*
     * Items wajib ada.
     */
    if (
      !Array.isArray(
        body.items
      ) ||
      body.items.length === 0
    ) {
      return errorResponse(
        "Minimal harus ada 1 barang"
      );
    }

    /*
     * Tanggal adjustment.
     */
    const adjustmentDate =
      body.adjustmentDate
        ? new Date(
            body.adjustmentDate
          )
        : new Date();

    if (
      Number.isNaN(
        adjustmentDate.getTime()
      )
    ) {
      return errorResponse(
        "Tanggal adjustment tidak valid"
      );
    }

    const adjustmentType =
      normalizeType(
        body.type
      );

    const reason =
      body.reason
        ?.toString()
        .trim() || null;

    const remarks =
      body.remarks
        ?.toString()
        .trim() || null;

    /*
     * PENTING:
     *
     * Apapun status yang dikirim client,
     * POST selalu membuat DRAFT.
     *
     * Ini mencegah user melakukan:
     *
     * POST { status: "APPROVED" }
     *
     * dan langsung mengubah stock.
     */
    const status = "DRAFT";

    /*
     * Normalize items.
     */
    const items: NormalizedItem[] =
      body.items.map(
        (
          item: ItemInput,
          index: number
        ) => {
          const barangId =
            Number(
              item.barangId
            );

          if (
            !Number.isInteger(
              barangId
            ) ||
            barangId <= 0
          ) {
            throw new Error(
              `Barang item ke-${
                index + 1
              } tidak valid`
            );
          }

          const qty =
            positiveNumber(
              item.qty,
              `Qty item ke-${
                index + 1
              }`
            );

          const price =
            item.price ===
              undefined ||
            item.price === null ||
            item.price === ""
              ? 0
              : nonNegativeNumber(
                  item.price,
                  `Harga item ke-${
                    index + 1
                  }`
                );

          const type =
            normalizeType(
              item.type ??
                adjustmentType
            );

          return {
            barangId,
            qty,
            price,
            type,
          };
        }
      );

    /*
     * Cegah duplicate barang
     * dalam satu adjustment.
     *
     * Karena satu adjustment seharusnya
     * tidak mempunyai dua baris yang sama.
     */
    const seenBarangIds =
      new Set<number>();

    for (const item of items) {
      if (
        seenBarangIds.has(
          item.barangId
        )
      ) {
        throw new Error(
          "Barang yang sama tidak boleh dimasukkan lebih dari satu kali dalam satu adjustment"
        );
      }

      seenBarangIds.add(
        item.barangId
      );
    }

    /*
     * Ambil master barang.
     */
    const barangIds = [
      ...seenBarangIds,
    ];

    const barangs =
      await prisma.barang.findMany({
        where: {
          id: {
            in: barangIds,
          },

          active: true,
        },

        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          baseUnit: true,
          conversionRate: true,
          purchasePrice: true,
          sellingPrice: true,
          active: true,
        },
      });

    const barangMap =
      new Map(
        barangs.map(
          (barang) => [
            barang.id,
            barang,
          ]
        )
      );

    /*
     * Pastikan semua barang masih aktif.
     */
    for (const item of items) {
      if (
        !barangMap.has(
          item.barangId
        )
      ) {
        throw new Error(
          `Barang ID ${
            item.barangId
          } tidak ditemukan atau tidak aktif`
        );
      }
    }

    /*
     * Semua qty sudah dianggap BASE UNIT.
     *
     * Jangan kalikan conversionRate.
     */
    const created =
      await prisma.$transaction(
        async (tx) => {
          let number =
            generateNumber();

          /*
           * Sangat kecil kemungkinan collision,
           * tapi tetap dicek.
           */
          for (
            let attempt = 0;
            attempt < 5;
            attempt++
          ) {
            const existing =
              await tx.outletAdjustment.findUnique(
                {
                  where: {
                    number,
                  },
                  select: {
                    id: true,
                  },
                }
              );

            if (!existing) {
              break;
            }

            number =
              generateNumber();
          }

          const adjustment =
            await tx.outletAdjustment.create(
              {
                data: {
                  number,

                  outletId,

                  adjustmentDate,

                  type:
                    adjustmentType,

                  reason,

                  remarks,

                  /*
                   * Selalu DRAFT.
                   */
                  status,

                  items: {
                    create:
                      items.map(
                        (
                          item
                        ) => ({
                          barangId:
                            item.barangId,

                          qty:
                            item.qty,

                          price:
                            item.price,

                          type:
                            item.type,
                        })
                      ),
                  },
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

                  items: {
                    include: {
                      barang: {
                        select: {
                          id: true,
                          code: true,
                          barcode: true,
                          name: true,
                          unit: true,
                          baseUnit: true,
                          conversionRate:
                            true,
                          purchasePrice:
                            true,
                          sellingPrice:
                            true,
                          active: true,
                        },
                      },
                    },

                    orderBy: {
                      id: "asc",
                    },
                  },
                },
              }
            );

          return adjustment;
        }
      );

    return NextResponse.json(
      {
        success: true,

        message:
          "Adjustment outlet berhasil disimpan sebagai DRAFT dan menunggu APPROVE ADMIN pusat",

        data: created,
      },
      {
        status: 201,
      }
    );
  } catch (error: any) {
    console.error(
      "POST /api/outlet/adjustment error:",
      error
    );

    if (
      error?.code === "P2002"
    ) {
      return errorResponse(
        "Nomor adjustment outlet sudah digunakan. Silakan coba lagi.",
        409
      );
    }

    return errorResponse(
      error?.message ||
        "Gagal membuat adjustment outlet"
    );
  }
}

/*
|--------------------------------------------------------------------------
| PATCH
|--------------------------------------------------------------------------
|
| PATCH /api/outlet/adjustment
|
| body:
|
| {
|   "id": 1,
|   "action": "APPROVE"
| }
|
| atau:
|
| {
|   "id": 1,
|   "action": "REJECT"
| }
|
|--------------------------------------------------------------------------
| PERMISSION
|--------------------------------------------------------------------------
|
| APPROVE
| -> HANYA ADMIN PUSAT
|
| REJECT
| -> ADMIN
| -> MANAGER
| -> OUTLET_ADMIN milik outlet tersebut
|
|--------------------------------------------------------------------------
*/

export async function PATCH(
  req: NextRequest
) {
  try {
    const user =
      await getCurrentUser();

    if (!user) {
      return errorResponse(
        "Tidak login atau session tidak valid",
        401
      );
    }

    if (!user.active) {
      return errorResponse(
        "User tidak aktif",
        403
      );
    }

    if (
      !isAllowedRole(user.role)
    ) {
      return errorResponse(
        "Anda tidak memiliki akses Adjustment Outlet",
        403
      );
    }

    const body =
      await req.json();

    const id =
      Number(body.id);

    const action =
      String(
        body.action ?? ""
      )
        .trim()
        .toUpperCase();

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return errorResponse(
        "ID adjustment tidak valid"
      );
    }

    if (
      action !== "APPROVE" &&
      action !== "REJECT"
    ) {
      return errorResponse(
        "Action harus APPROVE atau REJECT"
      );
    }

    /*
     * ============================================================
     * SECURITY CHECK PALING PENTING
     * ============================================================
     *
     * APPROVE hanya boleh ADMIN pusat.
     *
     * Jangan hanya mengandalkan frontend.
     * API wajib melakukan validasi ini.
     */
    if (
      action === "APPROVE" &&
      !isAdmin(user.role)
    ) {
      return errorResponse(
        "Hanya ADMIN pusat yang boleh melakukan APPROVE adjustment outlet",
        403
      );
    }

    /*
     * Transaction:
     *
     * - Ambil adjustment
     * - Lock secara logical dengan pengecekan status
     * - Validasi permission outlet
     * - APPROVE:
     *      OutletStock
     *      StockMutation
     *      status APPROVED
     *
     * - REJECT:
     *      status REJECTED
     */
    const result =
      await prisma.$transaction(
        async (tx) => {
          const adjustment =
            await tx.outletAdjustment.findUnique(
              {
                where: {
                  id,
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

                  items: {
                    include: {
                      barang: {
                        select: {
                          id: true,
                          code: true,
                          barcode: true,
                          name: true,
                          unit: true,
                          baseUnit: true,
                          conversionRate:
                            true,
                          purchasePrice:
                            true,
                          sellingPrice:
                            true,
                          active: true,
                        },
                      },
                    },

                    orderBy: {
                      id: "asc",
                    },
                  },
                },
              }
            );

          if (!adjustment) {
            throw new Error(
              "Adjustment outlet tidak ditemukan"
            );
          }

          /*
           * Outlet harus masih aktif.
           */
          if (
            !adjustment.outlet
              .active
          ) {
            throw new Error(
              "Outlet adjustment sudah tidak aktif"
            );
          }

          /*
           * OUTLET_ADMIN hanya boleh memproses
           * outlet miliknya sendiri.
           *
           * Untuk APPROVE sebenarnya sudah ditolak
           * di atas karena bukan ADMIN, tetapi
           * pengecekan ini tetap dipertahankan
           * sebagai defense in depth.
           */
          if (
            isOutletAdmin(
              user.role
            )
          ) {
            if (
              Number(
                user.outletId
              ) !==
              Number(
                adjustment.outletId
              )
            ) {
              throw new Error(
                "Anda tidak boleh memproses adjustment outlet lain"
              );
            }
          }

          /*
           * Hanya DRAFT/PENDING yang boleh diproses.
           */
          const currentStatus =
            normalizeStatus(
              adjustment.status
            );

          if (
            currentStatus ===
            "APPROVED"
          ) {
            throw new Error(
              "Adjustment sudah APPROVED dan tidak boleh diproses ulang"
            );
          }

          if (
            currentStatus ===
            "REJECTED"
          ) {
            throw new Error(
              "Adjustment sudah REJECTED dan tidak boleh diproses ulang"
            );
          }

          /*
           * Adjustment harus memiliki item.
           */
          if (
            !adjustment.items ||
            adjustment.items.length ===
              0
          ) {
            throw new Error(
              "Adjustment tidak memiliki item barang"
            );
          }

          /*
           * ======================================================
           * REJECT
           * ======================================================
           *
           * Tidak mengubah stock.
           */
          if (
            action === "REJECT"
          ) {
            return tx.outletAdjustment.update(
              {
                where: {
                  id,
                },

                data: {
                  status:
                    "REJECTED",
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

                  items: {
                    include: {
                      barang: {
                        select: {
                          id: true,
                          code: true,
                          barcode: true,
                          name: true,
                          unit: true,
                          baseUnit:
                            true,
                          conversionRate:
                            true,
                          purchasePrice:
                            true,
                          sellingPrice:
                            true,
                          active: true,
                        },
                      },
                    },

                    orderBy: {
                      id: "asc",
                    },
                  },
                },
              }
            );
          }

          /*
           * ======================================================
           * APPROVE
           * ======================================================
           *
           * Sampai titik ini:
           *
           * action === APPROVE
           * dan user.role === ADMIN
           *
           * Jadi approval sudah tervalidasi server-side.
           */

          for (
            const item of
              adjustment.items
          ) {
            const current =
              await tx.outletStock.findUnique(
                {
                  where: {
                    outletId_barangId: {
                      outletId:
                        adjustment.outletId,

                      barangId:
                        item.barangId,
                    },
                  },
                }
              );

            const stockBefore =
              Number(
                current?.stock ?? 0
              );

            const qty =
              Number(item.qty);

            if (
              !Number.isFinite(
                qty
              ) ||
              qty <= 0
            ) {
              throw new Error(
                `Qty barang "${item.barang.name}" tidak valid`
              );
            }

            const type =
              normalizeType(
                item.type
              );

            /*
             * ====================================================
             * OUT / MINUS
             * ====================================================
             */
            if (
              type === "OUT" &&
              qty >
                stockBefore +
                  0.000001
            ) {
              throw new Error(
                `Stock outlet "${item.barang.name}" tidak mencukupi. ` +
                  `Tersedia ${stockBefore}, adjustment ${qty}`
              );
            }

            /*
             * Hitung stock baru.
             */
            const stockAfterRaw =
              type === "IN"
                ? stockBefore +
                  qty
                : stockBefore -
                  qty;

            /*
             * Stock tidak boleh negatif.
             */
            if (
              stockAfterRaw <
              -0.000001
            ) {
              throw new Error(
                `Stock outlet "${item.barang.name}" tidak boleh negatif`
              );
            }

            const stockAfter =
              normalizeStock(
                stockAfterRaw
              );

            /*
             * ====================================================
             * COST
             * ====================================================
             *
             * Kalau price adjustment > 0:
             * gunakan price adjustment.
             *
             * Kalau tidak:
             * gunakan averageCost existing.
             *
             * Fallback:
             * purchasePrice barang.
             */
            const unitCost =
              Number(item.price) >
              0
                ? Number(
                    item.price
                  )
                : Number(
                    current?.averageCost ??
                      item.barang
                        .purchasePrice ??
                      0
                  );

            let averageCost =
              Number(
                current?.averageCost ??
                  0
              );

            /*
             * ====================================================
             * PLUS / IN
             * ====================================================
             *
             * Weighted average:
             *
             * ((stock lama × avg lama)
             *  + (qty baru × harga baru))
             * / stock baru
             */
            if (
              type === "IN"
            ) {
              const oldValue =
                stockBefore *
                averageCost;

              const newValue =
                qty * unitCost;

              averageCost =
                stockAfter > 0
                  ? (oldValue +
                      newValue) /
                    stockAfter
                  : unitCost;
            }

            /*
             * ====================================================
             * MINUS / OUT
             * ====================================================
             *
             * Average cost tidak berubah.
             */
            if (
              type === "OUT" &&
              stockAfter <= 0
            ) {
              /*
               * Kalau stock habis,
               * averageCost tetap dipertahankan
               * agar histori biaya tidak hilang.
               *
               * Ini sengaja tidak diubah ke 0.
               */
            }

            /*
             * ====================================================
             * UPDATE / CREATE OUTLET STOCK
             * ====================================================
             */
            if (current) {
              await tx.outletStock.update(
                {
                  where: {
                    id: current.id,
                  },

                  data: {
                    stock:
                      stockAfter,

                    averageCost,
                  },
                }
              );
            } else {
              /*
               * Secara normal:
               *
               * - IN -> create stock
               * - OUT -> akan gagal karena stockBefore = 0
               *
               * Jadi branch OUT di sini hanya
               * defensive programming.
               */
              await tx.outletStock.create(
                {
                  data: {
                    outletId:
                      adjustment.outletId,

                    barangId:
                      item.barangId,

                    stock:
                      stockAfter,

                    minimumStock: 0,

                    averageCost:
                      type === "IN"
                        ? unitCost
                        : 0,
                  },
                }
              );
            }

            /*
             * ====================================================
             * STOCK MUTATION
             * ====================================================
             *
             * HANYA outlet.
             *
             * Tidak menyentuh:
             *
             * - Barang.stock
             * - Inventory.stock
             * - StockCard
             */
            await tx.stockMutation.create(
              {
                data: {
                  outletId:
                    adjustment.outletId,

                  barangId:
                    item.barangId,

                  type:
                    type === "IN"
                      ? "ADJUSTMENT_IN"
                      : "ADJUSTMENT_OUT",

                  qty,

                  stockBefore,

                  stockAfter,

                  reference:
                    adjustment.number,

                  description:
                    adjustment.reason ||
                    adjustment.remarks ||
                    `Adjustment Outlet ${
                      type === "IN"
                        ? "PLUS"
                        : "MINUS"
                    }`,
                },
              }
            );
          }

          /*
           * Setelah seluruh item berhasil:
           *
           * baru status menjadi APPROVED.
           */
          return tx.outletAdjustment.update(
            {
              where: {
                id,
              },

              data: {
                status:
                  "APPROVED",
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

                items: {
                  include: {
                    barang: {
                      select: {
                        id: true,
                        code: true,
                        barcode: true,
                        name: true,
                        unit: true,
                        baseUnit: true,
                        conversionRate:
                          true,
                        purchasePrice:
                          true,
                        sellingPrice:
                          true,
                        active: true,
                      },
                    },
                  },

                  orderBy: {
                    id: "asc",
                  },
                },
              },
            }
          );
        }
      );

    return NextResponse.json({
      success: true,

      message:
        action === "APPROVE"
          ? "Adjustment outlet berhasil di-approve oleh ADMIN pusat dan stock outlet diperbarui"
          : "Adjustment outlet berhasil ditolak",

      data: result,
    });
  } catch (error: any) {
    console.error(
      "PATCH /api/outlet/adjustment error:",
      error
    );

    return errorResponse(
      error?.message ||
        "Gagal memproses adjustment outlet"
    );
  }
}