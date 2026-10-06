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
 * MODE OUTLET:
 *   hanya Barang Central yang sudah terdaftar pada outlet.
 *
 * MODE CENTRAL:
 *   seluruh Barang Central aktif tetap dapat dibaca
 *   untuk modal Hubungkan Barang Central.
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

    /*
     * mode:
     * - outlet  = daftar Master Barang Outlet
     * - central  = daftar seluruh Barang Central aktif
     */
    const mode =
      searchParams
        .get("mode")
        ?.trim()
        .toLowerCase() || "outlet";

    if (
      mode !== "outlet" &&
      mode !== "central"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Parameter mode tidak valid. Gunakan "outlet" atau "central".',
        },
        {
          status: 400,
        }
      );
    }

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
     * =====================================================
     */

    const barangWhere: any = {
      source: "CENTRAL",
      active: true,
    };

    if (mode === "outlet") {
      if (outletId === null) {
        barangWhere.outletBarang = {
          some: {
            aktif: true,
          },
        };
      } else {
        barangWhere.outletBarang = {
          some: {
            outletId,
            aktif: true,
          },
        };
      }
    }

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

          return {
            id: barang.id,

            barangId:
              barang.id,

            outletBarangId:
              currentMapping?.id ??
              null,

            outletId,

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

            harga:
              currentMapping?.harga ??
              0,

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

              unit,

              purchaseUnit:
                unit,

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
             * =================================================
             * STOCK OUTLET
             *
             * STOCK AKTUAL SELALU DARI OutletStock.
             *
             * Tidak pernah mengambil Barang.stock.
             * =================================================
             */

            /*
             * =================================================
             * FIX:
             *
             * Frontend membaca:
             *
             * item.outletStock?.stock
             *
             * Maka API wajib mengirim object outletStock
             * untuk outlet yang sedang dipilih/login.
             *
             * Stock tetap berasal dari OutletStock.
             * Tidak pernah dari Barang.stock.
             * =================================================
             */

            outletStock:
              currentStock
                ? {
                    id:
                      currentStock.id,

                    outletId:
                      currentStock.outletId,

                    barangId:
                      currentStock.barangId,

                    stock:
                      currentStock.stock,

                    minimumStock:
                      currentStock.minimumStock,

                    averageCost:
                      currentStock.averageCost,

                    updatedAt:
                      currentStock.updatedAt,
                  }
                : null,

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

    return NextResponse.json({
      success: true,

      scope: {
        role: user.role,
        outletId,
        mode,
      },

      total:
        formattedData.length,

      data:
        formattedData,

      meta: {
        architecture:
          "Barang Central adalah satu master global. Mode outlet hanya menampilkan Barang Central yang sudah terhubung melalui OutletBarang, sedangkan mode central membaca seluruh Barang Central aktif. OutletStock menyimpan stock aktual per outlet.",

        legacyPolicy:
          "Barang lama dengan source OUTLET tidak dihapus, tidak diubah, dan tetap digunakan oleh transaksi lama.",

        newBarangPolicy:
          "Route outlet tidak membuat Barang baru. Barang baru wajib dibuat melalui Master Barang Central.",

        outletPolicy:
          "Daftar Barang Outlet hanya menampilkan Barang Central yang sudah terhubung ke outlet melalui OutletBarang.",

        stockPolicy:
          "Stock aktual outlet disimpan pada OutletStock berdasarkan kombinasi outletId + barangId. Stock satu outlet tidak pernah dibagikan ke outlet lain.",

        purchaseUnitPolicy:
          "Barang.unit adalah purchase unit. Purchase unit digunakan pada pembelian/penerimaan.",

        baseUnitPolicy:
          "Barang.baseUnit adalah satuan dasar yang digunakan oleh konfigurasi stock lama, BOM, dan Manufacture sesuai alur existing.",

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

        listModePolicy:
          'mode=outlet menampilkan hanya Barang Central yang sudah memiliki OutletBarang aktif pada outlet terkait; mode=central menampilkan seluruh Barang Central aktif untuk proses Hubungkan Barang Central.',
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
 * SUPPORT:
 *
 * 1. HUBUNGKAN BARANG CENTRAL KE OUTLET
 *
 * 2. MANUAL_STOCK_AIR_RO
 *
 * STOCK AIR RO:
 *
 *   Outlet
 *      ↓
 *   OutletStock
 *      ↓
 *   stock lama + qty
 *
 * TIDAK PERNAH:
 *
 *   Barang.stock
 *
 * yang diubah oleh action MANUAL_STOCK_AIR_RO.
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

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login atau session sudah tidak aktif",
        },
        { status: 401 }
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
        { status: 403 }
      );
    }

    /*
     * =====================================================
     * PARSE BODY
     * =====================================================
     */

    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Request tidak valid. Body harus berupa JSON.",
        },
        { status: 400 }
      );
    }

    /*
     * =====================================================
     * ACTION
     *
     * Frontend Air RO mengirim:
     *
     * {
     *   action: "MANUAL_STOCK_AIR_RO",
     *   outletId,
     *   barangId,
     *   qty
     * }
     *
     * Handler dibuat di awal agar tidak masuk ke flow
     * Hubungkan Barang Central biasa.
     * =====================================================
     */

    const action =
      toCleanString(
        body?.action
      ).toUpperCase();

    if (
      action ===
      "MANUAL_STOCK_AIR_RO"
    ) {
      /*
       * ===================================================
       * OUTLET ID
       * ===================================================
       */

      const requestedOutletId =
        body?.outletId ??
        body?.outletID;

      let outletId: number;

      if (
        user.role ===
        "OUTLET_ADMIN"
      ) {
        /*
         * OUTLET ADMIN TIDAK BOLEH MEMILIH OUTLET LAIN.
         * Selalu gunakan outlet dari session.
         */

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
            { status: 400 }
          );
        }

        outletId =
          user.outletId;
      } else {
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
            { status: 400 }
          );
        }
      }

      /*
       * ===================================================
       * BARANG ID
       * ===================================================
       */

      const barangId =
        Number(
          body?.barangId ??
            body?.masterBarangId ??
            body?.centralBarangId ??
            body?.id
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
              "Barang ID tidak valid",
          },
          { status: 400 }
        );
      }

      /*
       * ===================================================
       * QTY
       *
       * Hanya menerima penambahan positif.
       * Tidak boleh 0 atau negatif.
       * ===================================================
       */

      const qty =
        toNumber(
          body?.qty
        );

      if (
        !Number.isFinite(qty) ||
        qty <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Qty stock harus lebih besar dari 0",
            received: {
              qty:
                body?.qty ??
                null,
            },
          },
          { status: 400 }
        );
      }

      /*
       * ===================================================
       * CEK OUTLET + BARANG + MAPPING + STOCK
       *
       * Semuanya dilakukan dalam transaction.
       * ===================================================
       */

      const result =
        await prisma.$transaction(
          async (tx) => {
            const outlet =
              await tx.outlet.findUnique({
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
              throw new Error(
                "Outlet tidak ditemukan."
              );
            }

            if (!outlet.active) {
              throw new Error(
                "Outlet sedang tidak aktif."
              );
            }

            const barang =
              await tx.barang.findFirst({
                where: {
                  id: barangId,
                  source: "CENTRAL",
                  active: true,
                },

                select: {
                  id: true,
                  code: true,
                  name: true,
                  unit: true,
                  baseUnit: true,
                  conversionRate: true,
                  minimumStock: true,
                  purchasePrice: true,
                  active: true,
                  source: true,
                },
              });

            if (!barang) {
              throw new Error(
                "Barang Central tidak ditemukan, tidak aktif, atau bukan Barang Central."
              );
            }

            /*
             * Air RO memang harus merupakan barang Air RO.
             *
             * Kita sengaja menggunakan nama sebagai validasi
             * tambahan karena action ini memang khusus Air RO.
             */

            const normalizedName =
              toCleanString(
                barang.name
              ).toLowerCase();

            if (
              normalizedName !==
              "air ro"
            ) {
              throw new Error(
                "Action MANUAL_STOCK_AIR_RO hanya dapat digunakan untuk Barang Air RO."
              );
            }

            /*
             * =================================================
             * PASTIKAN BARANG SUDAH TERHUBUNG KE OUTLET
             * =================================================
             */

            const existingMapping =
              await tx.outletBarang.findUnique({
                where: {
                  outletId_barangId: {
                    outletId,
                    barangId,
                  },
                },

                select: {
                  id: true,
                  outletId: true,
                  barangId: true,
                  aktif: true,
                  harga: true,
                },
              });

            /*
             * Jangan mengizinkan stock Air RO masuk ke outlet
             * yang belum mempunyai mapping Barang tersebut.
             *
             * User harus menghubungkan barang terlebih dahulu.
             */

            if (
              !existingMapping
            ) {
              throw new Error(
                "Air RO belum terhubung ke outlet ini. Hubungkan Barang Central ke outlet terlebih dahulu."
              );
            }

            if (
              !existingMapping.aktif
            ) {
              throw new Error(
                "Air RO pada outlet ini sedang tidak aktif. Aktifkan kembali Barang tersebut terlebih dahulu."
              );
            }

            /*
             * =================================================
             * AMBIL STOCK EXISTING
             * =================================================
             */

            const existingStock =
              await tx.outletStock.findUnique({
                where: {
                  outletId_barangId: {
                    outletId,
                    barangId,
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
                },
              });

            /*
             * =================================================
             * CREATE ATAU INCREMENT
             *
             * Stock lama TIDAK ditimpa.
             *
             * Contoh:
             *
             * stock lama = 1000
             * qty        = 500
             * hasil      = 1500
             *
             * =================================================
             */

            let outletStock;

            if (
              existingStock
            ) {
              const currentStock =
                Number(
                  existingStock.stock
                );

              const safeCurrentStock =
                Number.isFinite(
                  currentStock
                )
                  ? currentStock
                  : 0;

              const nextStock =
                safeCurrentStock +
                qty;

              outletStock =
                await tx.outletStock.update({
                  where: {
                    id:
                      existingStock.id,
                  },

                  data: {
                    stock:
                      nextStock,
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
                });
            } else {
              outletStock =
                await tx.outletStock.create({
                  data: {
                    outletId,
                    barangId,

                    stock:
                      qty,

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

                  select: {
                    id: true,
                    outletId: true,
                    barangId: true,
                    stock: true,
                    minimumStock: true,
                    averageCost: true,
                    updatedAt: true,
                  },
                });
            }

            return {
              outlet,
              barang,
              outletStock,

              qtyAdded:
                qty,

              previousStock:
                existingStock
                  ? Number(
                      existingStock.stock
                    )
                  : 0,

              newStock:
                Number(
                  outletStock.stock
                ),
            };
          }
        );

      /*
       * ===================================================
       * RESPONSE MANUAL AIR RO
       * ===================================================
       */

      return NextResponse.json(
        {
          success: true,

          message:
            "Stock Air RO berhasil ditambahkan ke outlet.",

          action:
            "MANUAL_STOCK_AIR_RO",

          outlet: {
            id:
              result.outlet.id,
            code:
              result.outlet.code,
            name:
              result.outlet.name,
          },

          barang: {
            id:
              result.barang.id,
            code:
              result.barang.code,
            name:
              result.barang.name,
            unit:
              toCleanString(
                result.barang.baseUnit
              ) ||
              toCleanString(
                result.barang.unit
              ),
            purchaseUnit:
              toCleanString(
                result.barang.unit
              ),
            baseUnit:
              toCleanString(
                result.barang.baseUnit
              ) ||
              toCleanString(
                result.barang.unit
              ),
            conversionRate:
              Number(
                result.barang
                  .conversionRate
              ) > 0
                ? Number(
                    result.barang
                      .conversionRate
                  )
                : 1,
          },

          stock: {
            previous:
              result.previousStock,

            added:
              result.qtyAdded,

            current:
              result.newStock,
          },

          stockPolicy:
            "Stock Air RO disimpan dan ditambahkan pada OutletStock berdasarkan outletId + barangId. Barang.stock tidak diubah.",
        },
        { status: 200 }
      );
    }

    /*
     * =====================================================
     * FLOW NORMAL:
     * DAFTARKAN / AKTIFKAN BARANG CENTRAL KE OUTLET
     * =====================================================
     */

    /*
     * =====================================================
     * OUTLET ID
     * =====================================================
     */

    const requestedOutletId =
      body?.outletId ??
      body?.outletID;

    let outletId: number;

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
          { status: 400 }
        );
      }

      outletId =
        user.outletId;
    } else {
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
          { status: 400 }
        );
      }
    }

    /*
     * =====================================================
     * BARANG CENTRAL
     * =====================================================
     */

    const rawBarangIds: unknown[] = [];

    if (
      Array.isArray(
        body?.barangIds
      )
    ) {
      rawBarangIds.push(
        ...body.barangIds
      );
    }

    const legacyBarangId =
      body?.barangId ??
      body?.masterBarangId ??
      body?.centralBarangId ??
      body?.id;

    if (
      legacyBarangId !==
        undefined &&
      legacyBarangId !==
        null &&
      legacyBarangId !== ""
    ) {
      rawBarangIds.push(
        legacyBarangId
      );
    }

    const barangIds =
      Array.from(
        new Set(
          rawBarangIds
            .map(
              (value) =>
                Number(value)
            )
            .filter(
              (value) =>
                Number.isInteger(
                  value
                ) &&
                value > 0
            )
        )
      );

    if (
      barangIds.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Minimal satu Barang Central wajib dipilih.",
          received: {
            barangIds:
              body?.barangIds ??
              null,
            barangId:
              legacyBarangId ??
              null,
          },
        },
        { status: 400 }
      );
    }

    /*
     * =====================================================
     * HARGA OUTLET
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
        { status: 400 }
      );
    }

    /*
     * =====================================================
     * CEK OUTLET
     * =====================================================
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
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tidak ditemukan",
          outletId,
        },
        { status: 404 }
      );
    }

    if (!outlet.active) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet sedang tidak aktif",
        },
        { status: 400 }
      );
    }

    /*
     * =====================================================
     * TRANSACTION
     * =====================================================
     */

    const results =
      await prisma.$transaction(
        async (tx) => {
          const output: any[] = [];

          for (const barangId of barangIds) {
            const barang =
              await tx.barang.findFirst({
                where: {
                  id: barangId,
                  source: "CENTRAL",
                  active: true,
                },
              });

            if (!barang) {
              throw new Error(
                `Barang Central dengan ID ${barangId} tidak ditemukan, tidak aktif, atau bukan Barang Central.`
              );
            }

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

            const existing =
              await tx.outletBarang.findUnique({
                where: {
                  outletId_barangId: {
                    outletId,
                    barangId:
                      barang.id,
                  },
                },
              });

            /*
             * =================================================
             * ENSURE OUTLET STOCK
             *
             * IMPORTANT:
             *
             * Connect barang ke outlet TIDAK mengisi stock
             * dari Barang.stock.
             *
             * Stock awal tetap 0.
             *
             * Kalau stock sudah ada, TIDAK disentuh.
             * =================================================
             */

            const ensureOutletStock =
              async () => {
                return tx.outletStock.upsert({
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
                });
              };

            let outletBarang: any;
            let mappingCreated =
              false;
            let mappingReactivated =
              false;

            if (existing) {
              outletBarang =
                await tx.outletBarang.update({
                  where: {
                    id:
                      existing.id,
                  },

                  data: {
                    harga,
                    aktif: true,
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
                });

              mappingReactivated =
                !existing.aktif;
            } else {
              outletBarang =
                await tx.outletBarang.create({
                  data: {
                    outletId,
                    barangId:
                      barang.id,
                    harga,
                    aktif: true,
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
                });

              mappingCreated =
                true;
            }

            const outletStock =
              await ensureOutletStock();

            const resultBarang =
              outletBarang.barang;

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
                    resultBaseUnit
              );

            output.push({
              outletBarang,

              outletStock,

              barangCreated:
                false,

              mappingCreated,

              mappingReactivated,

              barang:
                resultBarang,

              unit: {
                unit:
                  resultUnit,

                purchaseUnit:
                  resultUnit,

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
              },
            });
          }

          return output;
        }
      );

    /*
     * =====================================================
     * FORMAT RESULT
     * =====================================================
     */

    const formattedResults =
      results.map(
        (result) => {
          const resultBarang =
            result.barang;

          return {
            ...result.outletBarang,

            outletStock:
              result.outletStock,

            barang: {
              ...resultBarang,

              unit:
                result.unit.unit,

              baseUnit:
                result.unit.baseUnit,

              conversionRate:
                result.unit
                  .conversionRate,

              hasConversion:
                result.unit
                  .hasConversion,

              conversionLabel:
                result.unit
                  .conversionLabel,

              purchaseUnit:
                result.unit
                  .purchaseUnit,

              stockUnit:
                result.unit
                  .stockUnit,

              stockBaseUnit:
                result.unit
                  .stockUnit,

              bomUnit:
                result.unit
                  .bomUnit,

              manufactureUnit:
                result.unit
                  .manufactureUnit,
            },
          };
        }
      );

    const createdCount =
      results.filter(
        (item) =>
          item.mappingCreated
      ).length;

    const reactivatedCount =
      results.filter(
        (item) =>
          item.mappingReactivated
      ).length;

    const updatedCount =
      results.length -
      createdCount -
      reactivatedCount;

    const isBulk =
      barangIds.length > 1 ||
      Array.isArray(
        body?.barangIds
      );

    return NextResponse.json(
      {
        success: true,

        message:
          barangIds.length ===
          1
            ? results[0]
                .mappingCreated
              ? "Barang Master Central berhasil diaktifkan untuk outlet."
              : results[0]
                  .mappingReactivated
                ? "Barang Central sudah terdaftar sebelumnya dan berhasil diaktifkan kembali."
                : "Barang Central sudah terdaftar pada outlet dan pengaturan outlet berhasil diperbarui."
            : `${barangIds.length} Barang Central berhasil dihubungkan ke outlet.`,

        data:
          barangIds.length ===
          1
            ? formattedResults[0]
            : formattedResults,

        items:
          formattedResults,

        count: {
          requested:
            barangIds.length,

          processed:
            results.length,

          created:
            createdCount,

          reactivated:
            reactivatedCount,

          updated:
            updatedCount,
        },

        bulkConnect:
          isBulk,

        barangCreated:
          false,

        mappingCreated:
          barangIds.length ===
          1
            ? results[0]
                .mappingCreated
            : createdCount >
                0,

        mappingReactivated:
          barangIds.length ===
          1
            ? results[0]
                .mappingReactivated
            : reactivatedCount >
                0,

        outlet: {
          id:
            outlet.id,

          code:
            outlet.code,

          name:
            outlet.name,
        },

        unitPolicy:
          "Purchase menggunakan purchase unit. Alur stock existing tetap menggunakan policy yang sudah berjalan.",

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

          airRO:
            "MANUAL_STOCK_AIR_RO menambahkan qty ke OutletStock outlet yang dipilih tanpa mengubah Barang.stock.",

          multiConnect:
            "Satu request dapat menghubungkan beberapa Barang Central sekaligus ke outlet.",

          noDuplicate:
            "Endpoint ini tidak pernah membuat Barang baru untuk outlet.",

          legacy:
            "Barang lama source OUTLET tidak dihapus, tidak diubah, dan tetap dapat digunakan oleh transaksi lama.",

          transactionSafety:
            "Tidak ada penghapusan atau perubahan terhadap transaksi outlet existing. Stock existing tidak ditimpa ketika Barang dihubungkan kembali.",
        },
      },
      {
        status:
          barangIds.length ===
            1 &&
          results[0]
            .mappingCreated
            ? 201
            : 200,
      }
    );
  } catch (error: any) {
    console.error(
      "POST OUTLET MASTER BARANG ERROR:",
      error
    );

    if (
      error?.code ===
      "P2002"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Salah satu Barang Central sudah terdaftar pada outlet tersebut.",
        },
        { status: 409 }
      );
    }

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
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal menghubungkan Barang Central ke outlet.",

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
      { status: 400 }
    );
  }
}