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

    if (!Number.isInteger(userId) || userId <= 0) {
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
 * GET
 *
 * KONSEP:
 *
 * Barang
 *   = MASTER GLOBAL CENTRAL
 *
 * OutletBarang
 *   = MAPPING / SETTING OUTLET
 *
 * OutletStock
 *   = STOCK AKTUAL PER OUTLET
 *
 * PENTING:
 *
 * Barang CENTRAL tetap ditampilkan walaupun belum
 * memiliki OutletBarang.
 *
 * Jadi outlet tidak perlu membuat Barang baru.
 *
 * Barang lama source=OUTLET:
 *   - tetap ada
 *   - tidak dihapus
 *   - tidak diubah
 *   - transaksi lama tetap menggunakannya
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
          message: "Tidak memiliki akses",
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

    let outletId: number | null = null;

    /*
     * =====================================================
     * OUTLET ADMIN
     *
     * WAJIB MENGGUNAKAN OUTLET SESSION
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

      outletId = user.outletId;
    }

    /*
     * =====================================================
     * CENTER / PURCHASING
     *
     * Bisa memilih outlet.
     * Jika kosong = semua outlet.
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

        outletId = parsed;
      }
    }

    /*
     * =====================================================
     * QUERY BARANG CENTRAL
     *
     * INI SENGAJA TIDAK MENGGUNAKAN OutletBarang
     * SEBAGAI FILTER UTAMA.
     *
     * Artinya:
     *
     * Barang Central baru
     * tetap muncul di outlet walaupun
     * belum dibuatkan OutletBarang.
     * =====================================================
     */

    const barangWhere: any = {
      source: "CENTRAL",
      active: true,
    };

    if (search) {
      barangWhere.OR = [
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
        {
          category: {
            contains: search,
          },
        },
        {
          brand: {
            contains: search,
          },
        },
      ];
    }

    const barangData =
      await prisma.barang.findMany({
        where: barangWhere,

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
          sourceOutletId: true,
          active: true,

          minimumStock: true,

          purchasePrice: true,
          sellingPrice: true,

          createdAt: true,
          updatedAt: true,

          /*
           * Mapping outlet tertentu.
           */
          outletBarang:
            outletId !== null
              ? {
                  where: {
                    outletId,
                  },

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
                  },

                  take: 1,
                }
              : true,

          /*
           * Stock outlet tertentu.
           */
          outletStocks:
            outletId !== null
              ? {
                  where: {
                    outletId,
                  },

                  select: {
                    id: true,
                    outletId: true,
                    barangId: true,
                    stock: true,
                    minimumStock: true,
                    averageCost: true,
                    updatedAt: true,
                  },

                  take: 1,
                }
              : true,
        },

        orderBy: [
          {
            active: "desc",
          },
          {
            name: "asc",
          },
          {
            id: "asc",
          },
        ],
      });

    /*
     * =====================================================
     * BARANG IDS
     * =====================================================
     */

    const barangIds =
      barangData.map(
        (item) => item.id
      );

    /*
     * =====================================================
     * AMBIL MAPPING SEMUA OUTLET
     *
     * Hanya digunakan jika filter outlet kosong.
     * =====================================================
     */

    let allOutletMappings =
      new Map<
        string,
        any[]
      >();

    let allOutletStocks =
      new Map<
        string,
        any[]
      >();

    if (
      outletId === null &&
      barangIds.length > 0
    ) {
      const mappings =
        await prisma.outletBarang.findMany(
          {
            where: {
              barangId: {
                in: barangIds,
              },
            },

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
            },
          }
        );

      for (const mapping of mappings) {
        const key =
          String(
            mapping.barangId
          );

        const current =
          allOutletMappings.get(
            key
          ) || [];

        current.push(mapping);

        allOutletMappings.set(
          key,
          current
        );
      }

      const stocks =
        await prisma.outletStock.findMany(
          {
            where: {
              barangId: {
                in: barangIds,
              },
            },

            select: {
              id: true,
              outletId: true,
              barangId: true,
              stock: true,
              minimumStock: true,
              averageCost: true,
              updatedAt: true,

              outlet: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  active: true,
                },
              },
            },
          }
        );

      for (const stock of stocks) {
        const key =
          String(
            stock.barangId
          );

        const current =
          allOutletStocks.get(
            key
          ) || [];

        current.push(stock);

        allOutletStocks.set(
          key,
          current
        );
      }
    }

    /*
     * =====================================================
     * OUTLET IDS
     *
     * Digunakan untuk mencari harga pembelian
     * jika Admin melihat semua outlet.
     * =====================================================
     */

    const outletIds = Array.from(
      new Set(
        Array.from(
          allOutletMappings.values()
        )
          .flat()
          .map(
            (item) =>
              Number(
                item.outletId
              )
          )
          .filter(
            (id) =>
              Number.isInteger(
                id
              ) &&
              id > 0
          )
      )
    );

    /*
     * =====================================================
     * MAP HARGA RECEIPT TERAKHIR
     *
     * Receipt adalah harga aktual barang masuk.
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
      barangIds.length > 0
    ) {
      const receiptWhere: any = {
        items: {
          some: {
            barangId: {
              in: barangIds,
            },
          },
        },
      };

      if (outletId !== null) {
        receiptWhere.outletId =
          outletId;
      } else if (
        outletIds.length > 0
      ) {
        receiptWhere.outletId = {
          in: outletIds,
        };
      }

      const receipts =
        await prisma.outletReceipt.findMany(
          {
            where:
              receiptWhere,

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

      for (const receipt of receipts) {
        for (const item of receipt.items) {
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
            `${receipt.outletId}:${item.barangId}`;

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
      barangIds.length > 0
    ) {
      const purchaseWhere: any = {
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
      };

      if (outletId !== null) {
        purchaseWhere.outletId =
          outletId;
      } else if (
        outletIds.length > 0
      ) {
        purchaseWhere.outletId = {
          in: outletIds,
        };
      }

      const purchases =
        await prisma.outletPurchase.findMany(
          {
            where:
              purchaseWhere,

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

      for (const purchase of purchases) {
        for (const item of purchase.items) {
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
      barangData.map(
        (barang) => {
          /*
           * =================================================
           * UNIT
           *
           * unit      = purchase unit
           * baseUnit  = stock/BOM/Manufacture unit
           * =================================================
           */

          const conversionRate =
            Number(
              barang.conversionRate
            ) > 0
              ? Number(
                  barang.conversionRate
                )
              : 1;

          const unit =
            toCleanString(
              barang.unit
            );

          const baseUnit =
            toCleanString(
              barang.baseUnit
            ) ||
            unit;

          const hasConversion =
            Boolean(
              unit &&
                baseUnit &&
                unit !==
                  baseUnit &&
                conversionRate > 0
            );

          /*
           * =================================================
           * MAPPING
           * =================================================
           */

          let mappings: any[] = [];

          if (
            outletId !== null
          ) {
            mappings =
              Array.isArray(
                barang.outletBarang
              )
                ? barang.outletBarang
                : [];
          } else {
            mappings =
              allOutletMappings.get(
                String(
                  barang.id
                )
              ) || [];
          }

          /*
           * =================================================
           * STOCK
           * =================================================
           */

          let stocks: any[] = [];

          if (
            outletId !== null
          ) {
            stocks =
              Array.isArray(
                barang.outletStocks
              )
                ? barang.outletStocks
                : [];
          } else {
            stocks =
              allOutletStocks.get(
                String(
                  barang.id
                )
              ) || [];
          }

          const currentMapping =
            outletId !== null
              ? mappings[0] ??
                null
              : null;

          const currentStock =
            outletId !== null
              ? stocks[0] ??
                null
              : null;

          /*
           * =================================================
           * HARGA
           *
           * Receipt
           *   ↓
           * Purchase
           *   ↓
           * Central Purchase Price
           * =================================================
           */

          let hargaReceiptTerakhir:
            number | null = null;

          let hargaPurchaseTerakhir:
            number | null = null;

          let hargaPembelian = 0;

          let hargaSource =
            "NONE";

          let hargaTerakhirTanggal:
            string | null = null;

          let hargaTerakhirPurchase:
            string | null = null;

          let hargaTerakhirPurchaseId:
            number | null = null;

          let latestReceiptPrice:
            | {
                price: number;
                receiptDate: Date;
                receiptId: number;
                receiptNumber: string;
                invoiceNumber: string | null;
                purchaseId: number;
                purchaseNumber: string;
              }
            | undefined;

          let latestPurchasePrice:
            | {
                price: number;
                purchaseDate: Date;
                purchaseId: number;
                purchaseNumber: string;
              }
            | undefined;

          if (
            outletId !== null
          ) {
            const priceKey =
              `${outletId}:${barang.id}`;

            latestReceiptPrice =
              latestReceiptPriceMap.get(
                priceKey
              );

            latestPurchasePrice =
              latestPurchasePriceMap.get(
                priceKey
              );

            hargaReceiptTerakhir =
              latestReceiptPrice &&
              Number.isFinite(
                latestReceiptPrice.price
              ) &&
              latestReceiptPrice.price > 0
                ? latestReceiptPrice.price
                : null;

            hargaPurchaseTerakhir =
              latestPurchasePrice &&
              Number.isFinite(
                latestPurchasePrice.price
              ) &&
              latestPurchasePrice.price > 0
                ? latestPurchasePrice.price
                : null;

            const centralPurchasePrice =
              Number(
                barang.purchasePrice
              );

            const masterPurchasePrice =
              Number.isFinite(
                centralPurchasePrice
              ) &&
              centralPurchasePrice > 0
                ? centralPurchasePrice
                : 0;

            hargaPembelian =
              hargaReceiptTerakhir !==
              null
                ? hargaReceiptTerakhir
                : hargaPurchaseTerakhir !==
                  null
                ? hargaPurchaseTerakhir
                : masterPurchasePrice;

            hargaSource =
              hargaReceiptTerakhir !==
              null
                ? "OUTLET_RECEIPT_TERAKHIR"
                : hargaPurchaseTerakhir !==
                  null
                ? "OUTLET_PURCHASE_TERAKHIR"
                : masterPurchasePrice >
                  0
                ? "CENTRAL_MASTER_PURCHASE_PRICE"
                : "NONE";

            hargaTerakhirTanggal =
              hargaReceiptTerakhir !==
              null
                ? latestReceiptPrice
                    ?.receiptDate
                    ?.toISOString() ??
                  null
                : hargaPurchaseTerakhir !==
                  null
                ? latestPurchasePrice
                    ?.purchaseDate
                    ?.toISOString() ??
                  null
                : null;

            hargaTerakhirPurchase =
              hargaReceiptTerakhir !==
              null
                ? latestReceiptPrice
                    ?.purchaseNumber ??
                  null
                : hargaPurchaseTerakhir !==
                  null
                ? latestPurchasePrice
                    ?.purchaseNumber ??
                  null
                : null;

            hargaTerakhirPurchaseId =
              hargaReceiptTerakhir !==
              null
                ? latestReceiptPrice
                    ?.purchaseId ??
                  null
                : hargaPurchaseTerakhir !==
                  null
                ? latestPurchasePrice
                    ?.purchaseId ??
                  null
                : null;
          }

          /*
           * =================================================
           * CENTRAL PURCHASE PRICE
           * =================================================
           */

          const centralPurchasePrice =
            Number(
              barang.purchasePrice
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
           * RESPONSE
           * =================================================
           */

          return {
            /*
             * GLOBAL BARANG ID
             */
            id: barang.id,

            barangId:
              barang.id,

            /*
             * MAPPING ID
             *
             * NULL = barang Central belum
             * diaktifkan/didaftarkan ke outlet.
             */
            outletBarangId:
              currentMapping?.id ??
              null,

            outletId,

            /*
             * STATUS OUTLET
             */
            terdaftarDiOutlet:
              Boolean(
                currentMapping
              ),

            aktifDiOutlet:
              currentMapping
                ? Boolean(
                    currentMapping.aktif
                  )
                : false,

            /*
             * HARGA MASTER OUTLET
             */
            harga:
              currentMapping?.harga ??
              0,

            /*
             * HARGA PEMBELIAN TERAKHIR
             */
            hargaTerakhir:
              hargaPembelian > 0
                ? hargaPembelian
                : null,

            hargaDefault:
              hargaPembelian,

            hargaPembelian,

            hargaSource,

            hargaTerakhirTanggal,

            hargaTerakhirPurchase,

            hargaTerakhirPurchaseId,

            /*
             * DETAIL RECEIPT
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
             * DETAIL PURCHASE
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
             * PRICE INFO
             */
            priceInfo: {
              purchasePrice:
                hargaPembelian,

              lastPurchasePrice:
                hargaPembelian > 0
                  ? hargaPembelian
                  : null,

              lastReceiptPrice:
                hargaReceiptTerakhir,

              purchaseOrderPrice:
                hargaPurchaseTerakhir,

              masterPurchasePrice,

              source:
                hargaSource,

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
             * BARANG CENTRAL
             */
            barang: {
              id: barang.id,

              code:
                barang.code,

              barcode:
                barang.barcode,

              name:
                barang.name,

              category:
                barang.category,

              brand:
                barang.brand,

              /*
               * PURCHASE UNIT
               */
              unit,

              purchaseUnit:
                unit,

              /*
               * BASE UNIT
               */
              baseUnit,

              stockUnit:
                baseUnit,

              stockBaseUnit:
                baseUnit,

              bomUnit:
                baseUnit,

              manufactureUnit:
                baseUnit,

              conversionRate,

              conversionLabel:
                unit &&
                baseUnit &&
                unit !==
                  baseUnit
                  ? `1 ${unit} = ${conversionRate} ${baseUnit}`
                  : `1 ${unit}`,

              hasConversion,

              source:
                barang.source,

              sourceOutletId:
                barang.sourceOutletId,

              active:
                barang.active,

              minimumStock:
                barang.minimumStock,

              purchasePrice:
                barang.purchasePrice,

              sellingPrice:
                barang.sellingPrice,
            },

            /*
             * STOCK OUTLET
             *
             * Catatan:
             * nilai stock berasal dari OutletStock.
             * Route ini tidak mengubah nilai stock.
             */
            stock:
              currentStock?.stock ??
              0,

            minimumStock:
              currentStock
                ?.minimumStock ??
              barang.minimumStock ??
              0,

            averageCost:
              currentStock
                ?.averageCost ??
              barang.purchasePrice ??
              0,

            stockUpdatedAt:
              currentStock
                ?.updatedAt ??
              null,

            /*
             * MAPPING SEMUA OUTLET
             */
            outletMappings:
              outletId === null
                ? mappings
                : undefined,

            outletStocks:
              outletId === null
                ? stocks
                : undefined,
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
        architecture:
          "Barang Central adalah satu master global. OutletBarang hanya mapping/aktivasi. OutletStock menyimpan stock aktual per outlet.",

        legacyPolicy:
          "Barang lama dengan source OUTLET tidak dihapus, tidak diubah, dan tetap digunakan oleh transaksi lama.",

        newBarangPolicy:
          "Route outlet tidak membuat Barang baru. Barang baru wajib dibuat melalui Master Barang Central.",

        outletPolicy:
          "Outlet menggunakan Barang Central yang sama. OutletBarang hanya menyimpan konfigurasi outlet seperti harga dan status aktif.",

        stockPolicy:
          "Stock aktual outlet disimpan pada OutletStock berdasarkan kombinasi outletId + barangId.",

        purchaseUnitPolicy:
          "Barang.unit adalah purchase unit. Purchase unit digunakan pada pembelian/penerimaan.",

        baseUnitPolicy:
          "Barang.baseUnit adalah satuan dasar untuk stock, BOM, Manufacture, dan konsumsi bahan.",

        conversionPolicy:
          "Purchase unit dikonversi menjadi base unit ketika barang masuk ke stock.",

        example:
          "Jika 1 DUS = 24 PCS, maka penerimaan 2 DUS menghasilkan 48 PCS stock.",

        pricePolicy:
          "Harga pembelian menggunakan harga Receipt terbaru. Jika belum ada, menggunakan Purchase APPROVED/RECEIVED terbaru. Jika belum ada, menggunakan Barang.purchasePrice.",

        outletMasterPricePolicy:
          "OutletBarang.harga adalah harga master outlet dan tidak menggantikan harga pembelian aktual.",

        noDuplicatePolicy:
          "Satu Barang Central dapat digunakan oleh banyak outlet tanpa membuat Barang baru untuk setiap outlet.",
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
 * DAFTARKAN / AKTIFKAN BARANG CENTRAL KE OUTLET
 *
 * POST INI:
 *
 * Barang Central
 *       ↓
 * OutletBarang
 *       ↓
 * OutletStock
 *
 * POST INI TIDAK PERNAH:
 *
 * Barang Central
 *       ↓
 * Barang baru source OUTLET
 *
 * Jadi tidak ada duplicate master barang.
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
     * Tidak boleh memilih outlet lain.
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
     * BARANG CENTRAL ID
     *
     * WAJIB.
     *
     * Tidak menerima lagi:
     *
     * code + name + unit
     *
     * untuk membuat Barang baru.
     * =====================================================
     */

    const rawBarangId =
      body?.barangId ??
      body?.masterBarangId ??
      body?.centralBarangId ??
      body?.id;

    const barangId =
      Number(
        rawBarangId
      );

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
            "Barang Central wajib dipilih. Barang baru tidak dapat dibuat dari Master Barang Outlet.",
          received: {
            barangId:
              rawBarangId ??
              null,
          },
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * HARGA OUTLET
     *
     * OutletBarang.harga
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

    if (!outlet.active) {
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
           *
           * HANYA source=CENTRAL.
           * =================================================
           */

          const barang =
            await tx.barang.findFirst(
              {
                where: {
                  id:
                    barangId,

                  source:
                    "CENTRAL",

                  active:
                    true,
                },
              }
            );

          if (!barang) {
            throw new Error(
              "Barang tidak ditemukan di Master Barang Central atau barang sudah tidak aktif."
            );
          }

          /*
           * =================================================
           * VALIDASI MASTER UNIT
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
              `Satuan purchase barang ${barang.code} belum diatur di Master Barang Central.`
            );
          }

          if (!masterBaseUnit) {
            throw new Error(
              `Base unit barang ${barang.code} belum diatur di Master Barang Central.`
            );
          }

          if (
            !Number.isFinite(
              masterConversionRate
            ) ||
            masterConversionRate <= 0
          ) {
            throw new Error(
              `Conversion rate barang ${barang.code} tidak valid.`
            );
          }

          /*
           * =================================================
           * CARI MAPPING EXISTING
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
           * ENSURE OUTLET STOCK
           *
           * TIDAK MENGUBAH STOCK EXISTING.
           *
           * Jika stock sudah ada, update={} sehingga
           * stock, averageCost dan minimumStock tetap aman.
           * =================================================
           */

          const ensureOutletStock =
            async () => {
              return tx.outletStock.upsert(
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

                    /*
                     * Stock baru dimulai 0.
                     *
                     * Stock existing tidak pernah
                     * ditimpa.
                     */
                    stock: 0,

                    minimumStock:
                      Number(
                        barang.minimumStock
                      ) >= 0
                        ? Number(
                            barang.minimumStock
                          )
                        : 0,

                    averageCost:
                      Number(
                        barang.purchasePrice
                      ) >= 0
                        ? Number(
                            barang.purchasePrice
                          )
                        : 0,
                  },
                }
              );
            };

          /*
           * =================================================
           * MAPPING SUDAH ADA
           *
           * Jangan membuat record baru.
           * Aktifkan kembali mapping.
           *
           * Stock existing tetap dipertahankan.
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
                    outlet: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                        active: true,
                      },
                    },

                    barang: true,
                  },
                }
              );

            const outletStock =
              await ensureOutletStock();

            return {
              outletBarang:
                updated,

              outletStock,

              barangCreated:
                false,

              mappingCreated:
                false,

              mappingReactivated:
                !existing.aktif,

              barang:
                updated.barang,
            };
          }

          /*
           * =================================================
           * CREATE OUTLET MAPPING
           *
           * HANYA OutletBarang.
           *
           * Barang Central tetap satu.
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
                  outlet: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      active: true,
                    },
                  },

                  barang: true,
                },
              }
            );

          /*
           * =================================================
           * CREATE / ENSURE STOCK
           * =================================================
           */

          const outletStock =
            await ensureOutletStock();

          return {
            outletBarang,

            outletStock,

            barangCreated:
              false,

            mappingCreated:
              true,

            mappingReactivated:
              false,

            barang:
              outletBarang.barang,
          };
        }
      );

    /*
     * =====================================================
     * FORMAT RESULT
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
        resultBarang.conversionRate
      ) > 0
        ? Number(
            resultBarang.conversionRate
          )
        : 1;

    const hasConversion =
      Boolean(
        resultUnit &&
          resultBaseUnit &&
          resultUnit !==
            resultBaseUnit
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
          result.mappingCreated
            ? "Barang Master Central berhasil diaktifkan untuk outlet."
            : result.mappingReactivated
            ? "Barang Central sudah terdaftar sebelumnya dan berhasil diaktifkan kembali."
            : "Barang Central sudah terdaftar pada outlet dan pengaturan outlet berhasil diperbarui.",

        data: {
          ...result.outletBarang,

          outletStock:
            result.outletStock,

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

            /*
             * PURCHASE
             */
            purchaseUnit:
              resultUnit,

            /*
             * STOCK
             */
            stockUnit:
              resultBaseUnit,

            stockBaseUnit:
              resultBaseUnit,

            /*
             * BOM
             */
            bomUnit:
              resultBaseUnit,

            /*
             * MANUFACTURE
             */
            manufactureUnit:
              resultBaseUnit,
          },
        },

        barangCreated:
          false,

        mappingCreated:
          result.mappingCreated,

        mappingReactivated:
          result.mappingReactivated,

        outlet: {
          id:
            outlet.id,

          code:
            outlet.code,

          name:
            outlet.name,
        },

        unit: {
          /*
           * Purchase
           */
          unit:
            resultUnit,

          purchaseUnit:
            resultUnit,

          /*
           * Base
           */
          baseUnit:
            resultBaseUnit,

          stockUnit:
            resultBaseUnit,

          bomUnit:
            resultBaseUnit,

          manufactureUnit:
            resultBaseUnit,

          conversionRate:
            resultConversionRate,

          hasConversion,

          conversionLabel:
            hasConversion
              ? `1 ${resultUnit} = ${resultConversionRate} ${resultBaseUnit}`
              : `1 ${resultUnit}`,

          policy:
            "Purchase menggunakan purchase unit. Saat barang masuk stock, quantity dikonversi ke base unit. Stock, BOM, dan Manufacture menggunakan base unit.",
        },

        price: {
          harga,

          policy:
            "OutletBarang.harga adalah harga master outlet. Harga pembelian aktual tetap berasal dari proses Purchase/Receipt.",
        },

        architecture: {
          barang:
            "Satu Barang Central dapat digunakan oleh banyak outlet.",

          outletBarang:
            "OutletBarang hanya merupakan mapping dan konfigurasi outlet terhadap Barang Central.",

          outletStock:
            "OutletStock menyimpan stock aktual berdasarkan outletId + barangId.",

          noDuplicate:
            "Endpoint ini tidak pernah membuat Barang baru untuk outlet.",

          legacy:
            "Barang lama source OUTLET tidak dihapus, tidak diubah, dan tetap dapat digunakan oleh transaksi lama.",

          transactionSafety:
            "Tidak ada penghapusan atau perubahan terhadap transaksi outlet existing.",
        },
      },
      {
        status:
          result.mappingCreated
            ? 201
            : 200,
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
            "Barang Central sudah terdaftar pada outlet tersebut.",
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
            "Data outlet atau Barang Central tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * ERROR BUSINESS RULE
     * =====================================================
     */

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal mengaktifkan Barang Central untuk outlet.",

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