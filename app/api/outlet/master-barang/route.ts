import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/*
 * =========================================================
 * CURRENT USER
 * =========================================================
 */

async function getCurrentUser() {
  const cookieStore = await cookies();

  const session = cookieStore.get("erp-session");

  if (!session) {
    return null;
  }

  try {
    const sessionData = JSON.parse(session.value);

    const userId = Number(
      sessionData?.id ??
        sessionData?.user?.id
    );

    if (
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
        role: true,
        outletId: true,
        active: true,
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

/*
 * =========================================================
 * ROLE
 * =========================================================
 */

function isCenterUser(role: string) {
  return (
    role === "ADMIN" ||
    role === "MANAGER"
  );
}

function isAllowedRole(role: string) {
  return (
    role === "ADMIN" ||
    role === "MANAGER" ||
    role === "OUTLET_ADMIN" ||
    role === "PURCHASING"
  );
}

/*
 * =========================================================
 * NUMBER HELPER
 * =========================================================
 */

function toNumber(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : NaN;
}

/*
 * =========================================================
 * STRING HELPER
 * =========================================================
 */

function toCleanString(value: unknown) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

/*
 * =========================================================
 * GET MASTER BARANG OUTLET
 *
 * ACCESS:
 *
 * ADMIN / MANAGER / PURCHASING
 * -> semua outlet
 * -> bisa filter outlet
 *
 * OUTLET_ADMIN
 * -> hanya outlet sendiri
 *
 * BARANG
 * -> hanya BARANG CENTRAL
 *
 * SATUAN
 * -> mengikuti Master Barang Central
 *
 * =========================================================
 *
 * HARGA PEMBELIAN
 *
 * PRIORITAS:
 *
 * 1. OutletReceiptItem.price
 *    dari Barang Masuk / Receipt terbaru
 *
 * 2. OutletPurchaseItem.price
 *    dari Purchase APPROVED / RECEIVED terbaru
 *
 * 3. Barang.purchasePrice
 *    dari Master Barang Central
 *
 * 4. 0
 *
 * PENTING:
 *
 * OutletBarang.harga TIDAK dipakai sebagai
 * fallback harga pembelian.
 *
 * OutletBarang.harga tetap merupakan
 * harga master outlet.
 *
 * =========================================================
 */

export async function GET(
  req: NextRequest
) {
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
          message:
            "Tidak login atau session sudah tidak aktif",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * =====================================================
     * ROLE
     * =====================================================
     */

    if (!isAllowedRole(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak memiliki akses",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * =====================================================
     * QUERY PARAMETER
     * =====================================================
     */

    const { searchParams } =
      new URL(req.url);

    const search =
      searchParams
        .get("search")
        ?.trim() || "";

    const requestedOutletId =
      searchParams.get("outletId");

    let outletId:
      | number
      | null = null;

    /*
     * =====================================================
     * OUTLET ADMIN
     *
     * Selalu outlet dari session.
     * =====================================================
     */

    if (
      user.role ===
      "OUTLET_ADMIN"
    ) {
      if (
        !user.outletId ||
        !Number.isInteger(
          user.outletId
        ) ||
        user.outletId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet belum memiliki outlet",
          },
          {
            status: 400,
          }
        );
      }

      outletId =
        user.outletId;
    }

    /*
     * =====================================================
     * ADMIN / MANAGER / PURCHASING
     *
     * Bisa melihat semua outlet.
     * =====================================================
     */

    if (
      isCenterUser(user.role) ||
      user.role === "PURCHASING"
    ) {
      if (
        requestedOutletId !==
        null
      ) {
        const parsed =
          Number(
            requestedOutletId
          );

        if (
          !Number.isInteger(
            parsed
          ) ||
          parsed <= 0
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Outlet ID tidak valid",
            },
            {
              status: 400,
            }
          );
        }

        outletId =
          parsed;
      }
    }

    /*
     * =====================================================
     * WHERE
     * =====================================================
     */

    const where: any = {
      barang: {
        source: "CENTRAL",
      },
    };

    if (
      outletId !== null
    ) {
      where.outletId =
        outletId;
    }

    /*
     * =====================================================
     * SEARCH
     * =====================================================
     */

    if (search) {
      where.barang = {
        source: "CENTRAL",

        OR: [
          {
            code: {
              contains: search,
            },
          },
          {
            name: {
              contains: search,
            },
          },
          {
            barcode: {
              contains: search,
            },
          },
        ],
      };
    }

    /*
     * =====================================================
     * GET OUTLET BARANG
     * =====================================================
     */

    const data =
      await prisma.outletBarang.findMany(
        {
          where,

          select: {
            id: true,
            outletId: true,
            barangId: true,
            harga: true,
            aktif: true,
            createdAt: true,
            updatedAt: true,

            outlet: {
              select: {
                id: true,
                code: true,
                name: true,
                active: true,
              },
            },

            barang: {
              select: {
                id: true,
                code: true,
                barcode: true,
                name: true,
                category: true,
                brand: true,

                unit: true,
                baseUnit: true,
                conversionRate: true,

                source: true,
                active: true,

                minimumStock: true,

                /*
                 * FALLBACK TERAKHIR
                 * HARGA PEMBELIAN CENTRAL.
                 */
                purchasePrice: true,

                sellingPrice: true,

                outletStocks: {
                  where:
                    outletId !== null
                      ? {
                          outletId,
                        }
                      : undefined,

                  select: {
                    id: true,
                    stock: true,
                    minimumStock: true,
                    averageCost: true,
                    updatedAt: true,
                  },

                  take: 1,
                },
              },
            },
          },

          orderBy: {
            id: "desc",
          },
        }
      );

    /*
     * =====================================================
     * AMBIL ID OUTLET & BARANG
     * =====================================================
     */

    const outletIds =
      Array.from(
        new Set(
          data.map(
            (item) =>
              item.outletId
          )
        )
      );

    const barangIds =
      Array.from(
        new Set(
          data.map(
            (item) =>
              item.barangId
          )
        )
      );

    /*
     * =====================================================
     * MAP HARGA RECEIPT TERAKHIR
     *
     * SUMBER:
     * OutletReceiptItem.price
     *
     * Ini adalah harga pada saat barang benar-benar
     * diterima / Barang Masuk.
     *
     * PRIORITAS TERTINGGI.
     * =====================================================
     */

    const latestReceiptPriceMap =
      new Map<
        string,
        {
          price: number;
          receiptDate: Date;
          receiptId: number;
          receiptNumber: string;
          invoiceNumber: string | null;
          purchaseId: number;
          purchaseNumber: string;
        }
      >();

    if (
      outletIds.length > 0 &&
      barangIds.length > 0
    ) {
      const receipts =
        await prisma.outletReceipt.findMany(
          {
            where: {
              outletId: {
                in: outletIds,
              },

              items: {
                some: {
                  barangId: {
                    in: barangIds,
                  },
                },
              },
            },

            select: {
              id: true,
              number: true,
              outletId: true,
              purchaseId: true,
              invoiceNumber: true,
              receiptDate: true,

              purchase: {
                select: {
                  number: true,
                },
              },

              items: {
                where: {
                  barangId: {
                    in: barangIds,
                  },
                },

                select: {
                  barangId: true,
                  price: true,
                },
              },
            },

            /*
             * Barang Masuk terbaru menjadi
             * prioritas harga aktual.
             */
            orderBy: [
              {
                receiptDate:
                  "desc",
              },
              {
                id: "desc",
              },
            ],
          }
        );

      for (
        const receipt of receipts
      ) {
        for (
          const item of
            receipt.items
        ) {
          const price =
            Number(
              item.price
            );

          /*
           * Harga 0 / invalid tidak dianggap
           * sebagai harga aktual.
           */
          if (
            !Number.isFinite(
              price
            ) ||
            price <= 0
          ) {
            continue;
          }

          const key =
            `${receipt.outletId}:${item.barangId}`;

          /*
           * Receipt sudah diurutkan:
           *
           * terbaru -> terlama
           *
           * Jadi harga pertama adalah harga
           * Barang Masuk terakhir.
           */
          if (
            !latestReceiptPriceMap.has(
              key
            )
          ) {
            latestReceiptPriceMap.set(
              key,
              {
                price,

                receiptDate:
                  receipt.receiptDate,

                receiptId:
                  receipt.id,

                receiptNumber:
                  receipt.number,

                invoiceNumber:
                  receipt.invoiceNumber,

                purchaseId:
                  receipt.purchaseId,

                purchaseNumber:
                  receipt.purchase
                    .number,
              }
            );
          }
        }
      }
    }

    /*
     * =====================================================
     * MAP HARGA PURCHASE TERAKHIR
     *
     * SUMBER:
     * OutletPurchaseItem.price
     *
     * PRIORITAS KEDUA.
     *
     * Dipakai apabila belum ada harga valid
     * dari Barang Masuk.
     * =====================================================
     */

    const latestPurchasePriceMap =
      new Map<
        string,
        {
          price: number;
          purchaseDate: Date;
          purchaseId: number;
          purchaseNumber: string;
        }
      >();

    if (
      outletIds.length > 0 &&
      barangIds.length > 0
    ) {
      const purchases =
        await prisma.outletPurchase.findMany(
          {
            where: {
              outletId: {
                in: outletIds,
              },

              status: {
                in: [
                  "APPROVED",
                  "RECEIVED",
                ],
              },

              items: {
                some: {
                  barangId: {
                    in: barangIds,
                  },
                },
              },
            },

            select: {
              id: true,
              number: true,
              outletId: true,
              purchaseDate: true,

              items: {
                where: {
                  barangId: {
                    in: barangIds,
                  },
                },

                select: {
                  barangId: true,
                  price: true,
                },
              },
            },

            orderBy: [
              {
                purchaseDate:
                  "desc",
              },
              {
                id: "desc",
              },
            ],
          }
        );

      for (
        const purchase of purchases
      ) {
        for (
          const item of
            purchase.items
        ) {
          const price =
            Number(
              item.price
            );

          if (
            !Number.isFinite(
              price
            ) ||
            price <= 0
          ) {
            continue;
          }

          const key =
            `${purchase.outletId}:${item.barangId}`;

          if (
            !latestPurchasePriceMap.has(
              key
            )
          ) {
            latestPurchasePriceMap.set(
              key,
              {
                price,

                purchaseDate:
                  purchase.purchaseDate,

                purchaseId:
                  purchase.id,

                purchaseNumber:
                  purchase.number,
              }
            );
          }
        }
      }
    }

    /*
     * =====================================================
     * FORMAT RESPONSE
     * =====================================================
     */

    const formattedData =
      data.map(
        (item) => {
          /*
           * =================================================
           * SATUAN
           * =================================================
           */

          const conversionRate =
            Number(
              item.barang
                .conversionRate
            ) > 0
              ? Number(
                  item.barang
                    .conversionRate
                )
              : 1;

          const unit =
            item.barang.unit ||
            "";

          const baseUnit =
            item.barang.baseUnit ||
            unit;

          const hasConversion =
            Boolean(
              unit &&
                baseUnit &&
                unit !==
                  baseUnit &&
                conversionRate > 1
            );

          /*
           * =================================================
           * KEY HARGA
           * =================================================
           */

          const priceKey =
            `${item.outletId}:${item.barangId}`;

          /*
           * =================================================
           * HARGA RECEIPT TERAKHIR
           * =================================================
           */

          const latestReceiptPrice =
            latestReceiptPriceMap.get(
              priceKey
            );

          const hargaReceiptTerakhir =
            latestReceiptPrice &&
            Number.isFinite(
              latestReceiptPrice.price
            ) &&
            latestReceiptPrice.price > 0
              ? latestReceiptPrice.price
              : null;

          /*
           * =================================================
           * HARGA PURCHASE TERAKHIR
           * =================================================
           */

          const latestPurchasePrice =
            latestPurchasePriceMap.get(
              priceKey
            );

          const hargaPurchaseTerakhir =
            latestPurchasePrice &&
            Number.isFinite(
              latestPurchasePrice.price
            ) &&
            latestPurchasePrice.price > 0
              ? latestPurchasePrice.price
              : null;

          /*
           * =================================================
           * HARGA MASTER CENTRAL
           * =================================================
           */

          const centralPurchasePrice =
            Number(
              item.barang
                .purchasePrice
            );

          const masterPurchasePrice =
            Number.isFinite(
              centralPurchasePrice
            ) &&
            centralPurchasePrice > 0
              ? centralPurchasePrice
              : 0;

          /*
           * =================================================
           * HARGA PEMBELIAN FINAL
           *
           * PRIORITAS:
           *
           * 1 Receipt
           * 2 Purchase
           * 3 Central Master
           * 4 0
           * =================================================
           */

          const hargaPembelian =
            hargaReceiptTerakhir !== null
              ? hargaReceiptTerakhir
              : hargaPurchaseTerakhir !== null
              ? hargaPurchaseTerakhir
              : masterPurchasePrice;

          /*
           * =================================================
           * SOURCE HARGA
           * =================================================
           */

          const hargaSource =
            hargaReceiptTerakhir !== null
              ? "OUTLET_RECEIPT_TERAKHIR"
              : hargaPurchaseTerakhir !== null
              ? "OUTLET_PURCHASE_TERAKHIR"
              : masterPurchasePrice > 0
              ? "CENTRAL_MASTER_PURCHASE_PRICE"
              : "NONE";

          /*
           * =================================================
           * TANGGAL HARGA TERAKHIR
           * =================================================
           */

          const hargaTerakhirTanggal =
            hargaReceiptTerakhir !== null
              ? latestReceiptPrice
                  ?.receiptDate
                  ?.toISOString() ??
                null
              : hargaPurchaseTerakhir !== null
              ? latestPurchasePrice
                  ?.purchaseDate
                  ?.toISOString() ??
                null
              : null;

          /*
           * =================================================
           * NOMOR TRANSAKSI HARGA TERAKHIR
           * =================================================
           */

          const hargaTerakhirPurchase =
            hargaReceiptTerakhir !== null
              ? latestReceiptPrice
                  ?.purchaseNumber ??
                null
              : hargaPurchaseTerakhir !== null
              ? latestPurchasePrice
                  ?.purchaseNumber ??
                null
              : null;

          /*
           * =================================================
           * PURCHASE ID HARGA TERAKHIR
           * =================================================
           */

          const hargaTerakhirPurchaseId =
            hargaReceiptTerakhir !== null
              ? latestReceiptPrice
                  ?.purchaseId ??
                null
              : hargaPurchaseTerakhir !== null
              ? latestPurchasePrice
                  ?.purchaseId ??
                null
              : null;

          /*
           * =================================================
           * RESPONSE
           * =================================================
           */

          return {
            ...item,

            /*
             * Field lama.
             *
             * TETAP OutletBarang.harga.
             */
            harga:
              item.harga,

            /*
             * Harga aktual terakhir.
             *
             * Receipt menjadi prioritas.
             */
            hargaTerakhir:
              hargaPembelian > 0
                ? hargaPembelian
                : null,

            /*
             * Harga yang digunakan frontend.
             */
            hargaDefault:
              hargaPembelian,

            /*
             * Alias eksplisit.
             */
            hargaPembelian,

            /*
             * Sumber harga.
             */
            hargaSource,

            /*
             * Tanggal transaksi harga terakhir.
             */
            hargaTerakhirTanggal,

            /*
             * Nomor purchase terkait.
             */
            hargaTerakhirPurchase,

            /*
             * ID purchase terkait.
             */
            hargaTerakhirPurchaseId,

            /*
             * =================================================
             * DETAIL HARGA RECEIPT
             * =================================================
             */

            hargaReceiptTerakhir:
              hargaReceiptTerakhir,

            hargaReceiptTanggal:
              latestReceiptPrice
                ?.receiptDate
                ?.toISOString() ??
              null,

            hargaReceiptNumber:
              latestReceiptPrice
                ?.receiptNumber ??
              null,

            hargaReceiptInvoice:
              latestReceiptPrice
                ?.invoiceNumber ??
              null,

            hargaReceiptId:
              latestReceiptPrice
                ?.receiptId ??
              null,

            /*
             * =================================================
             * DETAIL HARGA PURCHASE
             * =================================================
             */

            hargaPurchaseTerakhir:
              hargaPurchaseTerakhir,

            hargaPurchaseTanggal:
              latestPurchasePrice
                ?.purchaseDate
                ?.toISOString() ??
              null,

            hargaPurchaseNumber:
              latestPurchasePrice
                ?.purchaseNumber ??
              null,

            hargaPurchaseId:
              latestPurchasePrice
                ?.purchaseId ??
              null,

            /*
             * =================================================
             * PRICE INFO
             * =================================================
             */

            priceInfo: {
              /*
               * Harga final yang harus dipakai.
               */
              purchasePrice:
                hargaPembelian,

              /*
               * Harga transaksi aktual terakhir.
               */
              lastPurchasePrice:
                hargaPembelian > 0
                  ? hargaPembelian
                  : null,

              /*
               * Harga dari Receipt terakhir.
               */
              lastReceiptPrice:
                hargaReceiptTerakhir,

              /*
               * Harga dari Purchase terakhir.
               */
              purchaseOrderPrice:
                hargaPurchaseTerakhir,

              /*
               * Harga Master Central.
               */
              masterPurchasePrice:
                masterPurchasePrice,

              /*
               * Source final.
               */
              source:
                hargaSource,

              /*
               * Receipt terakhir.
               */
              lastReceiptDate:
                latestReceiptPrice
                  ?.receiptDate
                  ?.toISOString() ??
                null,

              lastReceiptNumber:
                latestReceiptPrice
                  ?.receiptNumber ??
                null,

              lastReceiptInvoice:
                latestReceiptPrice
                  ?.invoiceNumber ??
                null,

              lastReceiptId:
                latestReceiptPrice
                  ?.receiptId ??
                null,

              /*
               * Purchase terakhir.
               */
              lastPurchaseDate:
                latestPurchasePrice
                  ?.purchaseDate
                  ?.toISOString() ??
                null,

              lastPurchaseNumber:
                latestPurchasePrice
                  ?.purchaseNumber ??
                null,

              lastPurchaseId:
                latestPurchasePrice
                  ?.purchaseId ??
                null,
            },

            /*
             * =================================================
             * BARANG
             * =================================================
             */

            barang: {
              ...item.barang,

              unit,

              baseUnit,

              conversionRate,

              hasConversion,

              conversionLabel:
                hasConversion
                  ? `1 ${unit} = ${conversionRate} ${baseUnit}`
                  : `1 ${unit}`,

              stockUnit:
                unit,

              stockBaseUnit:
                hasConversion
                  ? baseUnit
                  : unit,
            },
          };
        }
      );

    /*
     * =====================================================
     * RESPONSE
     * =====================================================
     */

    return NextResponse.json({
      success: true,

      scope: {
        role: user.role,
        outletId,
      },

      total:
        formattedData.length,

      data:
        formattedData,

      meta: {
        pricePolicy:
          "Harga pembelian menggunakan harga Barang Masuk / OutletReceiptItem.price terbaru. Jika belum ada harga valid dari Receipt, menggunakan OutletPurchaseItem.price terbaru dari Purchase APPROVED atau RECEIVED. Jika belum ada, menggunakan Barang.purchasePrice dari Master Barang Central.",

        priceOrder:
          "OutletReceiptItem.price terbaru -> OutletPurchaseItem.price terbaru APPROVED/RECEIVED -> Barang.purchasePrice -> 0.",

        receiptPricePolicy:
          "Harga Receipt / Barang Masuk menjadi sumber utama karena merupakan harga aktual saat barang diterima outlet.",

        purchasePricePolicy:
          "Harga Purchase digunakan sebagai fallback apabila belum ada harga valid pada Barang Masuk.",

        outletMasterPricePolicy:
          "OutletBarang.harga tidak digunakan sebagai harga pembelian.",

        stockUnitPolicy:
          "OutletStock disimpan menggunakan satuan utama Barang.unit.",

        conversionPolicy:
          "Konversi mengikuti Barang.baseUnit dan Barang.conversionRate dari Master Barang Central.",

        example:
          "Jika unit = DUS, baseUnit = PCS, conversionRate = 24, maka 1 DUS = 24 PCS.",
      },
    });
  } catch (error: any) {
    console.error(
      "GET OUTLET MASTER BARANG ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil master barang outlet",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * =========================================================
 * POST
 *
 * REGISTER / CREATE BARANG OUTLET
 *
 * HARGA OUTLET:
 * -> tetap disimpan di OutletBarang.harga
 *
 * HARGA PEMBELIAN:
 * -> TIDAK disimpan ke OutletBarang.harga.
 *
 * GET membaca:
 *
 * OutletReceiptItem.price
 * -> OutletPurchaseItem.price
 * -> Barang.purchasePrice
 * =========================================================
 */

export async function POST(
  req: NextRequest
) {
  try {
    /*
     * =====================================================
     * CURRENT USER
     * =====================================================
     */

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login atau session sudah tidak aktif",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * =====================================================
     * ROLE
     * =====================================================
     */

    if (
      !isAllowedRole(
        user.role
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak memiliki akses",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * =====================================================
     * PARSE BODY
     * =====================================================
     */

    let body: any;

    try {
      body =
        await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Request tidak valid. Body harus berupa JSON.",
        },
        {
          status: 400,
        }
      );
    }

    console.log(
      "POST /api/outlet/master-barang BODY:",
      body
    );

    /*
     * =====================================================
     * OUTLET ID
     * =====================================================
     */

    const requestedOutletId =
      body?.outletId ??
      body?.outletID;

    let outletId: number;

    /*
     * OUTLET ADMIN
     *
     * Selalu outlet dari session.
     */

    if (
      user.role ===
      "OUTLET_ADMIN"
    ) {
      if (
        !user.outletId ||
        !Number.isInteger(
          user.outletId
        ) ||
        user.outletId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User belum memiliki outlet",
          },
          {
            status: 400,
          }
        );
      }

      outletId =
        user.outletId;
    } else {
      /*
       * ADMIN / MANAGER / PURCHASING
       */

      outletId =
        Number(
          requestedOutletId
        );

      if (
        !Number.isInteger(
          outletId
        ) ||
        outletId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet wajib dipilih",

            received: {
              outletId:
                requestedOutletId ??
                null,
            },
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
     * =====================================================
     * INPUT BARANG
     * =====================================================
     */

    const rawBarangId =
      body?.barangId ??
      body?.masterBarangId ??
      body?.id;

    const parsedBarangId =
      Number(
        rawBarangId
      );

    const hasBarangId =
      Number.isInteger(
        parsedBarangId
      ) &&
      parsedBarangId > 0;

    const code =
      toCleanString(
        body?.code
      );

    const barcode =
      toCleanString(
        body?.barcode
      );

    const name =
      toCleanString(
        body?.name
      );

    const category =
      toCleanString(
        body?.category
      );

    const brand =
      toCleanString(
        body?.brand ??
          body?.manufacture
      );

    const requestedUnit =
      toCleanString(
        body?.unit
      );

    const requestedBaseUnit =
      toCleanString(
        body?.baseUnit
      );

    const requestedConversionRate =
      toNumber(
        body?.conversionRate ??
          1
      );

    const requestedMinimumStock =
      toNumber(
        body?.minimumStock ??
          0
      );

    /*
     * =====================================================
     * HARGA OUTLET
     *
     * Ini tetap OutletBarang.harga.
     *
     * Tidak sama dengan harga pembelian.
     * =====================================================
     */

    const rawHarga =
      body?.harga ??
      body?.price ??
      body?.sellingPrice ??
      0;

    const harga =
      toNumber(
        rawHarga
      );

    if (
      !Number.isFinite(
        harga
      ) ||
      harga < 0
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Harga outlet tidak valid",

          received: {
            harga:
              rawHarga,
          },
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * VALIDASI INPUT BARU
     * =====================================================
     */

    if (!hasBarangId) {
      if (!code) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Kode barang wajib diisi",
          },
          {
            status: 400,
          }
        );
      }

      if (!name) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Nama barang wajib diisi",
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
     * =====================================================
     * VALIDASI MINIMUM STOCK
     * =====================================================
     */

    if (
      !Number.isFinite(
        requestedMinimumStock
      ) ||
      requestedMinimumStock < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Minimum stock tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * VALIDASI CONVERSION
     * =====================================================
     */

    if (
      !Number.isFinite(
        requestedConversionRate
      ) ||
      requestedConversionRate <=
        0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Conversion rate harus lebih besar dari 0",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * CEK OUTLET
     * =====================================================
     */

    const outlet =
      await prisma.outlet.findUnique(
        {
          where: {
            id: outletId,
          },

          select: {
            id: true,
            code: true,
            name: true,
            active: true,
          },
        }
      );

    if (!outlet) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tidak ditemukan",
          outletId,
        },
        {
          status: 404,
        }
      );
    }

    if (
      !outlet.active
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet sedang tidak aktif",
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
           * CARI BARANG CENTRAL
           * =================================================
           */

          let barang =
            null as any;

          /*
           * PRIORITAS 1:
           * barangId
           */

          if (hasBarangId) {
            barang =
              await tx.barang.findFirst(
                {
                  where: {
                    id:
                      parsedBarangId,

                    source:
                      "CENTRAL",

                    active:
                      true,
                  },
                }
              );
          }

          /*
           * PRIORITAS 2:
           * CODE
           */

          if (
            !barang &&
            code
          ) {
            barang =
              await tx.barang.findFirst(
                {
                  where: {
                    source:
                      "CENTRAL",

                    active:
                      true,

                    code,
                  },
                }
              );
          }

          /*
           * PRIORITAS 3:
           * BARCODE
           */

          if (
            !barang &&
            barcode
          ) {
            barang =
              await tx.barang.findFirst(
                {
                  where: {
                    source:
                      "CENTRAL",

                    active:
                      true,

                    barcode,
                  },
                }
              );
          }

          /*
           * =================================================
           * KALAU BELUM ADA:
           * BUAT MASTER BARANG CENTRAL
           * =================================================
           */

          if (!barang) {
            if (!requestedUnit) {
              throw new Error(
                "Satuan utama barang wajib diisi"
              );
            }

            const baseUnit =
              requestedBaseUnit ||
              requestedUnit;

            /*
             * CEK CODE DUPLICATE
             */

            const existingByCode =
              await tx.barang.findFirst(
                {
                  where: {
                    code,
                  },
                }
              );

            if (
              existingByCode
            ) {
              throw new Error(
                `Kode barang ${code} sudah digunakan oleh barang lain`
              );
            }

            /*
             * CEK BARCODE DUPLICATE
             */

            if (barcode) {
              const existingByBarcode =
                await tx.barang.findFirst(
                  {
                    where: {
                      barcode,
                    },
                  }
                );

              if (
                existingByBarcode
              ) {
                throw new Error(
                  `Barcode ${barcode} sudah digunakan oleh barang lain`
                );
              }
            }

            /*
             * CREATE MASTER CENTRAL
             */

            barang =
              await tx.barang.create(
                {
                  data: {
                    code,

                    barcode:
                      barcode ||
                      null,

                    name,

                    category:
                      category ||
                      null,

                    brand:
                      brand ||
                      null,

                    unit:
                      requestedUnit,

                    baseUnit,

                    conversionRate:
                      requestedConversionRate,

                    source:
                      "CENTRAL",

                    active:
                      true,

                    minimumStock:
                      requestedMinimumStock,

                    purchasePrice:
                      0,

                    sellingPrice:
                      0,
                  },
                }
              );

            console.log(
              "MASTER CENTRAL BARANG CREATED:",
              {
                id:
                  barang.id,

                code:
                  barang.code,

                name:
                  barang.name,
              }
            );
          }

          /*
           * =================================================
           * VALIDASI BARANG CENTRAL
           * =================================================
           */

          if (
            barang.source !==
            "CENTRAL"
          ) {
            throw new Error(
              "Barang bukan berasal dari Master Barang Central"
            );
          }

          /*
           * =================================================
           * SATUAN MASTER CENTRAL
           * =================================================
           */

          const masterUnit =
            toCleanString(
              barang.unit
            );

          const masterBaseUnit =
            toCleanString(
              barang.baseUnit
            ) ||
            masterUnit;

          const masterConversionRate =
            toNumber(
              barang.conversionRate
            );

          if (!masterUnit) {
            throw new Error(
              `Satuan utama barang ${barang.code} belum diatur di Master Barang Central`
            );
          }

          if (
            !Number.isFinite(
              masterConversionRate
            ) ||
            masterConversionRate <=
              0
          ) {
            throw new Error(
              `Conversion rate barang ${barang.code} tidak valid`
            );
          }

          /*
           * =================================================
           * CEK OUTLET BARANG
           * =================================================
           */

          const existing =
            await tx.outletBarang.findUnique(
              {
                where: {
                  outletId_barangId: {
                    outletId,
                    barangId:
                      barang.id,
                  },
                },
              }
            );

          /*
           * =================================================
           * JIKA SUDAH ADA
           * =================================================
           */

          if (existing) {
            const updated =
              await tx.outletBarang.update(
                {
                  where: {
                    id:
                      existing.id,
                  },

                  data: {
                    harga,

                    aktif:
                      true,
                  },

                  include: {
                    outlet: true,
                    barang: true,
                  },
                }
              );

            /*
             * Pastikan OutletStock tersedia.
             */

            await tx.outletStock.upsert(
              {
                where: {
                  outletId_barangId: {
                    outletId,
                    barangId:
                      barang.id,
                  },
                },

                update: {},

                create: {
                  outletId,

                  barangId:
                    barang.id,

                  stock: 0,

                  minimumStock:
                    barang.minimumStock ||
                    0,

                  averageCost:
                    barang.purchasePrice ||
                    0,
                },
              }
            );

            return {
              outletBarang:
                updated,

              barangCreated:
                false,

              barang:
                updated.barang,
            };
          }

          /*
           * =================================================
           * CREATE OUTLET BARANG
           * =================================================
           */

          const outletBarang =
            await tx.outletBarang.create(
              {
                data: {
                  outletId,

                  barangId:
                    barang.id,

                  harga,

                  aktif:
                    true,
                },

                include: {
                  outlet: true,
                  barang: true,
                },
              }
            );

          /*
           * =================================================
           * CREATE OUTLET STOCK
           * =================================================
           */

          await tx.outletStock.upsert(
            {
              where: {
                outletId_barangId: {
                  outletId,

                  barangId:
                    barang.id,
                },
              },

              update: {},

              create: {
                outletId,

                barangId:
                  barang.id,

                stock: 0,

                minimumStock:
                  barang.minimumStock ||
                  0,

                averageCost:
                  barang.purchasePrice ||
                  0,
              },
            }
          );

          return {
            outletBarang,

            barangCreated:
              true,

            barang:
              outletBarang.barang,
          };
        }
      );

    /*
     * =====================================================
     * RESULT
     * =====================================================
     */

    const resultBarang =
      result.barang;

    const resultUnit =
      toCleanString(
        resultBarang.unit
      );

    const resultBaseUnit =
      toCleanString(
        resultBarang.baseUnit
      ) ||
      resultUnit;

    const resultConversionRate =
      Number(
        resultBarang
          .conversionRate
      ) > 0
        ? Number(
            resultBarang
              .conversionRate
          )
        : 1;

    const hasConversion =
      Boolean(
        resultUnit &&
          resultBaseUnit &&
          resultUnit !==
            resultBaseUnit &&
          resultConversionRate >
            1
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
          result.barangCreated
            ? "Barang berhasil dibuat di Master Central dan didaftarkan ke outlet"
            : "Barang berhasil didaftarkan ke Master Barang Outlet",

        data: {
          ...result.outletBarang,

          barang: {
            ...resultBarang,

            unit:
              resultUnit,

            baseUnit:
              resultBaseUnit,

            conversionRate:
              resultConversionRate,

            hasConversion,

            conversionLabel:
              hasConversion
                ? `1 ${resultUnit} = ${resultConversionRate} ${resultBaseUnit}`
                : `1 ${resultUnit}`,

            stockUnit:
              resultUnit,

            stockBaseUnit:
              hasConversion
                ? resultBaseUnit
                : resultUnit,
          },
        },

        barangCreated:
          result.barangCreated,

        outlet: {
          id:
            outlet.id,

          code:
            outlet.code,

          name:
            outlet.name,
        },

        unit: {
          unit:
            resultUnit,

          baseUnit:
            resultBaseUnit,

          conversionRate:
            resultConversionRate,

          hasConversion,

          conversionLabel:
            hasConversion
              ? `1 ${resultUnit} = ${resultConversionRate} ${resultBaseUnit}`
              : `1 ${resultUnit}`,

          policy:
            "Satuan outlet mengikuti Master Barang Central.",
        },

        price: {
          harga,

          policy:
            "OutletBarang.harga adalah harga master outlet. Harga pembelian menggunakan harga Barang Masuk terbaru, kemudian histori OutletPurchaseItem, kemudian Barang.purchasePrice.",
        },
      },
      {
        status: 201,
      }
    );
  } catch (error: any) {
    console.error(
      "POST OUTLET MASTER BARANG ERROR:",
      error
    );

    /*
     * =====================================================
     * PRISMA UNIQUE
     * =====================================================
     */

    if (
      error?.code ===
      "P2002"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Data barang sudah terdaftar atau terdapat kode/barcode yang duplicate.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =====================================================
     * PRISMA FOREIGN KEY
     * =====================================================
     */

    if (
      error?.code ===
      "P2003"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Data outlet atau barang tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * ERROR VALIDASI / BUSINESS RULE
     * =====================================================
     */

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal mendaftarkan barang ke outlet",

        detail:
          process.env.NODE_ENV !==
          "production"
            ? {
                name:
                  error?.name,

                code:
                  error?.code,
              }
            : undefined,
      },
      {
        status: 400,
      }
    );
  }
}