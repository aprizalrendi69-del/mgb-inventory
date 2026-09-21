import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";

// =====================================================
// CURRENT USER
// =====================================================

async function getCurrentUser() {
  const cookieStore = await cookies();

  const sessionCookie =
    cookieStore.get("session") ||
    cookieStore.get("erp-session");

  if (!sessionCookie) {
    return null;
  }

  let userId: number | null = null;

  // ===================================================
  // DATABASE SESSION
  // ===================================================

  const dbSession = await prisma.session.findUnique({
    where: {
      token: sessionCookie.value,
    },

    include: {
      user: {
        select: {
          id: true,
          fullname: true,
          role: true,
          active: true,
          outletId: true,

          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (dbSession) {
    if (dbSession.expiresAt < new Date()) {
      return null;
    }

    if (!dbSession.user.active) {
      return null;
    }

    userId = dbSession.user.id;
  } else {
    // =================================================
    // JSON SESSION
    // =================================================

    try {
      const parsed = JSON.parse(sessionCookie.value);

      userId = Number(
        parsed?.user?.id ??
          parsed?.id ??
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

  // ===================================================
  // USER
  // ===================================================

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      id: true,
      fullname: true,
      role: true,
      active: true,
      outletId: true,

      outlet: {
        select: {
          id: true,
          code: true,
          name: true,
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

// =====================================================
// ROLE ACCESS
// =====================================================

function canAccessPurchase(role: Role) {
  return (
    role === Role.ADMIN ||
    role === Role.MANAGER ||
    role === Role.PURCHASING ||
    role === Role.OUTLET_ADMIN
  );
}

// =====================================================
// CENTRAL ROLE
// =====================================================

function isCentralPurchaseRole(role: Role) {
  return (
    role === Role.ADMIN ||
    role === Role.MANAGER ||
    role === Role.PURCHASING
  );
}

// =====================================================
// BUILD OUTLET FILTER
// =====================================================

function getOutletFilter(user: {
  role: Role;
  outletId: number | null;
}) {
  if (user.role === Role.OUTLET_ADMIN) {
    if (!user.outletId) {
      return null;
    }

    return {
      outletId: user.outletId,
    };
  }

  return {};
}

// =====================================================
// VALIDATE PURCHASE ID
// =====================================================

function getPurchaseId(value: string) {
  const id = Number(value);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return id;
}

// =====================================================
// VALIDATE OUTLET
// =====================================================

async function validateOutlet(outletId: number) {
  if (
    !Number.isInteger(outletId) ||
    outletId <= 0
  ) {
    return null;
  }

  const outlet = await prisma.outlet.findUnique({
    where: {
      id: outletId,
    },

    select: {
      id: true,
      code: true,
      name: true,
    },
  });

  return outlet;
}

// =====================================================
// GET LAST PURCHASE PRICE
// =====================================================
//
// Mencari harga pembelian terakhir untuk:
//
// outletId + barangId
//
// Tidak mengambil Purchase saat ini.
//
// Hanya:
//
// APPROVED
// RECEIVED
//
// Harga harus > 0.
//
// Digunakan untuk:
// - informasi perubahan harga
// - fallback effective price
//
// =====================================================

async function getLastPurchasePrice(
  outletId: number,
  barangId: number,
  excludePurchaseId: number
) {
  const purchases =
    await prisma.outletPurchase.findMany({
      where: {
        outletId,

        id: {
          not: excludePurchaseId,
        },

        status: {
          in: [
            "APPROVED",
            "RECEIVED",
          ],
        },

        items: {
          some: {
            barangId,
          },
        },
      },

      select: {
        id: true,
        number: true,
        purchaseDate: true,

        items: {
          where: {
            barangId,
          },

          select: {
            barangId: true,
            price: true,
          },
        },
      },

      orderBy: [
        {
          purchaseDate: "desc",
        },
        {
          id: "desc",
        },
      ],

      /*
       * Ambil beberapa transaksi terakhir.
       * Kita tetap melakukan validasi harga > 0
       * sebelum menentukan histori yang digunakan.
       */
      take: 20,
    });

  for (const purchase of purchases) {
    for (const item of purchase.items) {
      const price = Number(item.price);

      if (
        Number.isFinite(price) &&
        price > 0
      ) {
        return {
          price,

          purchaseId:
            purchase.id,

          purchaseNumber:
            purchase.number,

          purchaseDate:
            purchase.purchaseDate,
        };
      }
    }
  }

  return null;
}

// =====================================================
// PRICE CHANGE CALCULATION
// =====================================================

function calculatePriceChange(
  currentPrice: number,
  lastPurchasePrice: number | null
) {
  const current =
    Number(currentPrice);

  const previous =
    lastPurchasePrice === null
      ? null
      : Number(lastPurchasePrice);

  if (
    !Number.isFinite(current) ||
    current <= 0
  ) {
    return {
      hasPriceChange: false,

      priceChange: null,

      priceChangePercent: null,

      priceChangeDirection:
        "NO_CURRENT_PRICE" as const,
    };
  }

  if (
    previous === null ||
    !Number.isFinite(previous) ||
    previous <= 0
  ) {
    return {
      hasPriceChange: false,

      priceChange: null,

      priceChangePercent: null,

      priceChangeDirection:
        "NO_HISTORY" as const,
    };
  }

  const difference =
    current - previous;

  const percentage =
    (difference / previous) *
    100;

  if (difference > 0) {
    return {
      hasPriceChange: true,

      priceChange: difference,

      priceChangePercent:
        percentage,

      priceChangeDirection:
        "INCREASE" as const,
    };
  }

  if (difference < 0) {
    return {
      hasPriceChange: true,

      priceChange: difference,

      priceChangePercent:
        percentage,

      priceChangeDirection:
        "DECREASE" as const,
    };
  }

  return {
    hasPriceChange: false,

    priceChange: 0,

    priceChangePercent: 0,

    priceChangeDirection:
      "UNCHANGED" as const,
  };
}

// =====================================================
// GET DETAIL PURCHASE OUTLET
// =====================================================

export async function GET(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    // =================================================
    // USER
    // =================================================

    const user =
      await getCurrentUser();

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
    // ROLE
    // =================================================

    if (
      !canAccessPurchase(
        user.role
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses Purchase Outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // OUTLET ADMIN HARUS TERHUBUNG OUTLET
    // =================================================

    if (
      user.role ===
        Role.OUTLET_ADMIN &&
      !user.outletId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User Outlet Admin belum terhubung dengan outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // ID
    // =================================================

    const { id } =
      await context.params;

    const purchaseId =
      getPurchaseId(id);

    if (!purchaseId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID Purchase Outlet tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // FILTER OUTLET
    // =================================================

    const outletFilter =
      getOutletFilter(user);

    if (
      outletFilter === null
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User tidak memiliki outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // PURCHASE
    // =================================================

    const purchase =
      await prisma.outletPurchase.findFirst({
        where: {
          id: purchaseId,
          ...outletFilter,
        },

        include: {
          outlet: true,

          supplier: true,

          items: {
            include: {
              barang: true,
            },

            orderBy: {
              id: "asc",
            },
          },
        },
      });

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // HITUNG HARGA
    // =================================================
    //
    // PENTING:
    //
    // Harga histori sekarang SELALU dicari.
    //
    // Sebelumnya histori hanya dicari kalau
    // current price kosong/0.
    //
    // Sekarang histori digunakan juga untuk:
    //
    // - deteksi harga naik
    // - deteksi harga turun
    // - menampilkan harga terakhir
    // - menghitung persentase perubahan
    //
    // Tetapi price database TIDAK diubah.
    //
    // =================================================

    const formattedItems =
      await Promise.all(
        purchase.items.map(
          async (item) => {
            const currentPrice =
              Number(
                item.price
              );

            const validCurrentPrice =
              Number.isFinite(
                currentPrice
              ) &&
              currentPrice > 0;

            // =========================================
            // HARGA HISTORI
            // =========================================

            const lastPurchase =
              await getLastPurchasePrice(
                purchase.outletId,
                item.barangId,
                purchase.id
              );

            // =========================================
            // HARGA MASTER CENTRAL
            // =========================================

            const masterPurchasePrice =
              Number(
                item.barang
                  ?.purchasePrice
              );

            const validMasterPrice =
              Number.isFinite(
                masterPurchasePrice
              ) &&
              masterPurchasePrice >
                0;

            // =========================================
            // HARGA EFEKTIF
            // =========================================

            let effectivePrice = 0;

            let priceSource =
              "NONE";

            if (
              validCurrentPrice
            ) {
              effectivePrice =
                currentPrice;

              priceSource =
                "CURRENT_PURCHASE";
            } else if (
              lastPurchase
            ) {
              effectivePrice =
                lastPurchase.price;

              priceSource =
                "LAST_OUTLET_PURCHASE";
            } else if (
              validMasterPrice
            ) {
              effectivePrice =
                masterPurchasePrice;

              priceSource =
                "CENTRAL_MASTER_PURCHASE_PRICE";
            }

            // =========================================
            // PRICE CHANGE
            // =========================================

            const priceChange =
              calculatePriceChange(
                currentPrice,
                lastPurchase?.price ??
                  null
              );

            // =========================================
            // QTY
            // =========================================

            const qty =
              Number(
                item.qty
              );

            const validQty =
              Number.isFinite(
                qty
              ) &&
              qty >= 0;

            // =========================================
            // SUBTOTAL
            // =========================================

            const effectiveSubtotal =
              validQty
                ? qty *
                  effectivePrice
                : 0;

            // =========================================
            // RETURN
            // =========================================

            return {
              ...item,

              /*
               * Harga yang disimpan pada
               * Purchase Outlet tetap menjadi
               * harga utama.
               *
               * Kalau harga PO 0/kosong,
               * frontend lama tetap mendapatkan
               * harga efektif sebagai fallback.
               */
              price:
                effectivePrice,

              /*
               * Harga asli yang tersimpan
               * di database.
               */
              originalPrice:
                Number.isFinite(
                  currentPrice
                )
                  ? currentPrice
                  : 0,

              /*
               * Harga efektif.
               */
              effectivePrice,

              /*
               * Source harga efektif.
               */
              priceSource,

              /*
               * Histori harga outlet.
               */
              lastPurchasePrice:
                lastPurchase?.price ??
                null,

              lastPurchaseDate:
                lastPurchase
                  ?.purchaseDate
                  ?.toISOString() ??
                null,

              lastPurchaseNumber:
                lastPurchase
                  ?.purchaseNumber ??
                null,

              lastPurchaseId:
                lastPurchase
                  ?.purchaseId ??
                null,

              /*
               * Informasi perubahan harga.
               */
              hasPriceChange:
                priceChange.hasPriceChange,

              priceChange:
                priceChange.priceChange,

              priceChangePercent:
                priceChange.priceChangePercent,

              priceChangeDirection:
                priceChange.priceChangeDirection,

              /*
               * Harga master central.
               */
              masterPurchasePrice:
                validMasterPrice
                  ? masterPurchasePrice
                  : 0,

              /*
               * Subtotal efektif.
               */
              effectiveSubtotal,

              /*
               * Barang tetap lengkap.
               */
              barang: {
                ...item.barang,

                /*
                 * Harga master central.
                 */
                purchasePrice:
                  validMasterPrice
                    ? masterPurchasePrice
                    : item.barang
                        ?.purchasePrice ??
                      0,

                /*
                 * Alias harga efektif.
                 */
                hargaPembelian:
                  effectivePrice,

                /*
                 * Harga histori.
                 */
                lastPurchasePrice:
                  lastPurchase?.price ??
                  null,

                /*
                 * Informasi perubahan
                 * pada object barang juga,
                 * agar frontend yang membaca
                 * item.barang tetap bisa
                 * menggunakan data ini.
                 */
                priceChange:
                  priceChange.priceChange,

                priceChangePercent:
                  priceChange.priceChangePercent,

                priceChangeDirection:
                  priceChange.priceChangeDirection,

                hasPriceChange:
                  priceChange.hasPriceChange,
              },
            };
          }
        )
      );

    // =================================================
    // TOTAL EFEKTIF
    // =================================================

    const effectiveTotal =
      formattedItems.reduce(
        (sum, item) => {
          const subtotal =
            Number(
              item.effectiveSubtotal
            );

          return (
            sum +
            (Number.isFinite(
              subtotal
            )
              ? subtotal
              : 0)
          );
        },
        0
      );

    // =================================================
    // PRICE CHANGE SUMMARY
    // =================================================

    const priceChangeSummary =
      formattedItems.reduce(
        (
          summary,
          item
        ) => {
          const direction =
            item.priceChangeDirection;

          if (
            direction ===
            "INCREASE"
          ) {
            summary.increaseCount +=
              1;

            summary.increaseAmount +=
              Math.abs(
                Number(
                  item.priceChange ??
                    0
                )
              );
          }

          if (
            direction ===
            "DECREASE"
          ) {
            summary.decreaseCount +=
              1;

            summary.decreaseAmount +=
              Math.abs(
                Number(
                  item.priceChange ??
                    0
                )
              );
          }

          return summary;
        },
        {
          increaseCount: 0,
          decreaseCount: 0,
          increaseAmount: 0,
          decreaseAmount: 0,
        }
      );

    const changedCount =
      priceChangeSummary.increaseCount +
      priceChangeSummary.decreaseCount;

    // =================================================
    // RESPONSE
    // =================================================

    return NextResponse.json({
      success: true,

      data: {
        ...purchase,

        /*
         * Items diperkaya.
         */
        items:
          formattedItems,

        /*
         * Total asli database.
         *
         * TIDAK DIUBAH.
         */
        originalTotal:
          Number(
            purchase.total
          ),

        /*
         * Total efektif.
         */
        effectiveTotal,

        /*
         * Ringkasan perubahan harga.
         */
        priceChangeSummary: {
          changedCount,

          increaseCount:
            priceChangeSummary.increaseCount,

          decreaseCount:
            priceChangeSummary.decreaseCount,

          increaseAmount:
            priceChangeSummary.increaseAmount,

          decreaseAmount:
            priceChangeSummary.decreaseAmount,
        },
      },

      access: {
        role:
          user.role,

        outletId:
          user.outletId,

        isCentral:
          isCentralPurchaseRole(
            user.role
          ),
      },

      pricePolicy: {
        priority: [
          "CURRENT_PURCHASE",
          "LAST_OUTLET_PURCHASE",
          "CENTRAL_MASTER_PURCHASE_PRICE",
          "NONE",
        ],

        description:
          "Harga Purchase saat ini digunakan sebagai harga utama. Histori Purchase Outlet APPROVED/RECEIVED terbaru digunakan sebagai pembanding perubahan harga. Jika harga Purchase kosong/0, histori digunakan sebagai fallback. Jika histori tidak tersedia, Barang.purchasePrice dari Master Barang Central digunakan sebagai fallback.",

        currentPurchase:
          "OutletPurchaseItem.price",

        lastOutletPurchase:
          "OutletPurchaseItem.price pada OutletPurchase APPROVED atau RECEIVED terbaru untuk outlet dan barang yang sama.",

        masterPurchase:
          "Barang.purchasePrice",

        priceChange:
          "currentPurchase - lastOutletPurchase",

        priceChangePercent:
          "((currentPurchase - lastOutletPurchase) / lastOutletPurchase) * 100",

        directions: {
          INCREASE:
            "Harga Purchase saat ini lebih tinggi dari harga Purchase Outlet sebelumnya.",

          DECREASE:
            "Harga Purchase saat ini lebih rendah dari harga Purchase Outlet sebelumnya.",

          UNCHANGED:
            "Harga Purchase saat ini sama dengan harga Purchase Outlet sebelumnya.",

          NO_HISTORY:
            "Belum tersedia histori Purchase Outlet yang dapat digunakan sebagai pembanding.",

          NO_CURRENT_PRICE:
            "Harga Purchase saat ini kosong atau tidak valid.",
        },
      },
    });
  } catch (error: any) {
    console.error(
      "GET OUTLET PURCHASE DETAIL ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil detail Purchase Outlet",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// PATCH PURCHASE OUTLET
// =====================================================

export async function PATCH(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    // =================================================
    // USER
    // =================================================

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login",
        },
        {
          status: 401,
        }
      );
    }

    // =================================================
    // ROLE
    // =================================================

    if (
      !canAccessPurchase(
        user.role
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses mengubah Purchase Outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // OUTLET ADMIN
    // =================================================

    if (
      user.role ===
        Role.OUTLET_ADMIN &&
      !user.outletId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User Outlet Admin belum terhubung dengan outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // ID
    // =================================================

    const { id } =
      await context.params;

    const purchaseId =
      getPurchaseId(id);

    if (!purchaseId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID Purchase Outlet tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // BODY
    // =================================================

    let body: any;

    try {
      body =
        await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Body request tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // OUTLET
    // =================================================

    const requestedOutletId =
      Number(
        body?.outletId
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
            "Outlet wajib dipilih",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // SUPPLIER
    // =================================================

    const supplierId =
      Number(
        body?.supplierId
      );

    // =================================================
    // REMARKS
    // =================================================

    const remarks =
      typeof body?.remarks ===
      "string"
        ? body.remarks.trim()
        : null;

    // =================================================
    // ITEMS
    // =================================================

    const items =
      Array.isArray(
        body?.items
      )
        ? body.items
        : [];

    // =================================================
    // VALIDASI SUPPLIER
    // =================================================

    if (
      !Number.isInteger(
        supplierId
      ) ||
      supplierId <= 0
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

    // =================================================
    // VALIDASI ITEMS
    // =================================================

    if (
      items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Minimal harus ada 1 barang",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // FILTER OUTLET
    // =================================================

    const outletFilter =
      getOutletFilter(user);

    if (
      outletFilter === null
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User tidak memiliki outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // AMBIL PURCHASE
    // =================================================

    const existing =
      await prisma.outletPurchase.findFirst({
        where: {
          id: purchaseId,
          ...outletFilter,
        },

        include: {
          outlet: true,

          supplier: true,

          items: true,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // HANYA DRAFT
    // =================================================

    if (
      existing.status !==
      "DRAFT"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet hanya dapat diedit jika status masih DRAFT",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // OUTLET ADMIN
    // =================================================

    if (
      user.role ===
        Role.OUTLET_ADMIN &&
      requestedOutletId !==
        user.outletId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet Admin hanya dapat mengubah Purchase Outlet milik outlet sendiri",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // VALIDASI OUTLET
    // =================================================

    const outlet =
      await validateOutlet(
        requestedOutletId
      );

    if (!outlet) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // VALIDASI SUPPLIER
    // =================================================

    const supplier =
      await prisma.supplier.findUnique({
        where: {
          id: supplierId,
        },

        select: {
          id: true,
          name: true,
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

    // =================================================
    // VALIDASI ITEM
    // =================================================

    const normalizedItems: Array<{
      barangId: number;
      qty: number;
      price: number;
      subtotal: number;
    }> = [];

    const barangIds =
      new Set<number>();

    let total = 0;

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

      // ===============================================
      // ID
      // ===============================================

      if (
        !Number.isInteger(
          barangId
        ) ||
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

      // ===============================================
      // DUPLIKAT
      // ===============================================

      if (
        barangIds.has(
          barangId
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang ID ${barangId} tidak boleh muncul lebih dari satu kali`,
          },
          {
            status: 400,
          }
        );
      }

      barangIds.add(
        barangId
      );

      // ===============================================
      // QTY
      // ===============================================

      if (
        !Number.isFinite(
          qty
        ) ||
        qty <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Qty barang ID ${barangId} tidak valid`,
          },
          {
            status: 400,
          }
        );
      }

      // ===============================================
      // PRICE
      // ===============================================

      if (
        !Number.isFinite(
          price
        ) ||
        price < 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Harga barang ID ${barangId} tidak valid`,
          },
          {
            status: 400,
          }
        );
      }

      // ===============================================
      // BARANG
      // ===============================================

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

      if (
        barang.active ===
        false
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang ${barang.name} sudah tidak aktif`,
          },
          {
            status: 400,
          }
        );
      }

      // ===============================================
      // SUBTOTAL
      // ===============================================

      const subtotal =
        qty * price;

      if (
        !Number.isFinite(
          subtotal
        ) ||
        subtotal < 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Subtotal barang ${barang.name} tidak valid`,
          },
          {
            status: 400,
          }
        );
      }

      total +=
        subtotal;

      normalizedItems.push({
        barangId,
        qty,
        price,
        subtotal,
      });
    }

    // =================================================
    // VALIDASI TOTAL
    // =================================================

    if (
      !Number.isFinite(
        total
      ) ||
      total < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Total Purchase Outlet tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // TRANSACTION
    // =================================================

    const purchase =
      await prisma.$transaction(
        async (tx) => {
          // ===========================================
          // CEK ULANG PURCHASE
          // ===========================================

          const current =
            await tx.outletPurchase.findUnique({
              where: {
                id: purchaseId,
              },

              select: {
                id: true,
                number: true,
                outletId: true,
                status: true,
              },
            });

          if (!current) {
            throw new Error(
              "Purchase Outlet tidak ditemukan"
            );
          }

          // ===========================================
          // SECURITY OUTLET
          // ===========================================

          if (
            user.role ===
              Role.OUTLET_ADMIN &&
            current.outletId !==
              user.outletId
          ) {
            throw new Error(
              "Purchase Outlet bukan milik outlet Anda"
            );
          }

          // ===========================================
          // STATUS
          // ===========================================

          if (
            current.status !==
            "DRAFT"
          ) {
            throw new Error(
              "Purchase Outlet sudah diproses dan tidak dapat diedit"
            );
          }

          // ===========================================
          // OUTLET FINAL
          // ===========================================

          const finalOutletId =
            user.role ===
              Role.OUTLET_ADMIN
              ? user.outletId
              : requestedOutletId;

          if (
            !finalOutletId
          ) {
            throw new Error(
              "Outlet tidak valid"
            );
          }

          // ===========================================
          // DELETE ITEM LAMA
          // ===========================================
          //
          // Hanya item dari Purchase DRAFT ini.
          // Tidak menyentuh stok, batch, history,
          // atau Purchase lain.
          //
          // ===========================================

          await tx.outletPurchaseItem.deleteMany({
            where: {
              purchaseId,
            },
          });

          // ===========================================
          // UPDATE PURCHASE
          // ===========================================

          const updated =
            await tx.outletPurchase.update({
              where: {
                id: purchaseId,
              },

              data: {
                outletId:
                  finalOutletId,

                supplierId,

                remarks:
                  remarks || null,

                total,

                items: {
                  create:
                    normalizedItems,
                },
              },

              include: {
                outlet: true,

                supplier: true,

                items: {
                  include: {
                    barang: true,
                  },

                  orderBy: {
                    id: "asc",
                  },
                },
              },
            });

          // ===========================================
          // HISTORY
          // ===========================================

          await tx.history.create({
            data: {
              transactionType:
                "PURCHASE",

              referenceNumber:
                updated.number,

              description:
                `Mengubah Purchase Order Outlet ${updated.number}`,

              userId:
                user.id,
            },
          });

          return updated;
        }
      );

    // =================================================
    // RESPONSE
    // =================================================

    return NextResponse.json({
      success: true,

      message:
        "Purchase Outlet berhasil diubah",

      data:
        purchase,
    });
  } catch (error: any) {
    console.error(
      "PATCH OUTLET PURCHASE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal mengubah Purchase Outlet",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// DELETE PURCHASE OUTLET
// =====================================================

export async function DELETE(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    // =================================================
    // USER
    // =================================================

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login",
        },
        {
          status: 401,
        }
      );
    }

    // =================================================
    // ROLE
    // =================================================

    if (
      !canAccessPurchase(
        user.role
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses menghapus Purchase Outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // OUTLET ADMIN
    // =================================================

    if (
      user.role ===
        Role.OUTLET_ADMIN &&
      !user.outletId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User Outlet Admin belum terhubung dengan outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // ID
    // =================================================

    const { id } =
      await context.params;

    const purchaseId =
      getPurchaseId(id);

    if (!purchaseId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID Purchase Outlet tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // FILTER OUTLET
    // =================================================

    const outletFilter =
      getOutletFilter(user);

    if (
      outletFilter === null
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User tidak memiliki outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // CEK PURCHASE
    // =================================================

    const existing =
      await prisma.outletPurchase.findFirst({
        where: {
          id: purchaseId,
          ...outletFilter,
        },

        include: {
          outlet: true,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // HANYA DRAFT
    // =================================================

    if (
      existing.status !==
      "DRAFT"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet hanya dapat dihapus jika status masih DRAFT",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // TRANSACTION
    // =================================================

    await prisma.$transaction(
      async (tx) => {
        // =============================================
        // CEK ULANG
        // =============================================

        const current =
          await tx.outletPurchase.findUnique({
            where: {
              id: purchaseId,
            },

            select: {
              id: true,
              number: true,
              outletId: true,
              status: true,
            },
          });

        if (!current) {
          throw new Error(
            "Purchase Outlet tidak ditemukan"
          );
        }

        // =============================================
        // SECURITY OUTLET
        // =============================================

        if (
          user.role ===
            Role.OUTLET_ADMIN &&
          current.outletId !==
            user.outletId
        ) {
          throw new Error(
            "Purchase Outlet bukan milik outlet Anda"
          );
        }

        // =============================================
        // STATUS
        // =============================================

        if (
          current.status !==
          "DRAFT"
        ) {
          throw new Error(
            "Purchase Outlet sudah diproses dan tidak dapat dihapus"
          );
        }

        // =============================================
        // HAPUS ITEM
        // =============================================
        //
        // Hanya item milik Purchase DRAFT.
        //
        // Tidak menyentuh:
        // - stok
        // - batch
        // - kartu stok
        // - Purchase lain
        // - history
        //
        // =============================================

        await tx.outletPurchaseItem.deleteMany({
          where: {
            purchaseId,
          },
        });

        // =============================================
        // HISTORY SEBELUM DELETE
        // =============================================

        await tx.history.create({
          data: {
            transactionType:
              "PURCHASE",

            referenceNumber:
              current.number,

            description:
              `Menghapus Purchase Order Outlet ${current.number}`,

            userId:
              user.id,
          },
        });

        // =============================================
        // DELETE PURCHASE
        // =============================================

        await tx.outletPurchase.delete({
          where: {
            id: purchaseId,
          },
        });
      }
    );

    // =================================================
    // RESPONSE
    // =================================================

    return NextResponse.json({
      success: true,

      message:
        "Purchase Outlet berhasil dihapus",
    });
  } catch (error: any) {
    console.error(
      "DELETE OUTLET PURCHASE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal menghapus Purchase Outlet",
      },
      {
        status: 500,
      }
    );
  }
}