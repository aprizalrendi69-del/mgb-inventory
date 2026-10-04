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
 * Jadi daftar outlet tidak menampilkan master Central
 * yang belum dihubungkan ke outlet.
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
     *              hanya barang yang sudah terhubung ke outlet.
     * - central  = daftar seluruh Barang Central aktif
     *              untuk modal "Hubungkan Barang Central".
     *
     * Default tetap "outlet" agar halaman daftar barang
     * tidak lagi menampilkan seluruh master Central.
     */
    const mode =
      searchParams
        .get("mode")
        ?.trim()
        .toLowerCase() || "outlet";

    if (mode !== "outlet" && mode !== "central") {
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
     *
     * Filter mengikuti mode GET:
     * - mode=outlet  -> hanya Barang Central yang sudah
     *                   terhubung melalui OutletBarang aktif.
     * - mode=central -> seluruh Barang Central aktif.
     * =====================================================
     */

    const barangWhere: any = {
      source: "CENTRAL",
      active: true,
    };

    /*
     * MODE OUTLET:
     * Hanya Barang Central yang sudah memiliki mapping
     * OutletBarang pada outlet yang sedang dipilih/session.
     *
     * MODE CENTRAL:
     * Tidak memakai filter OutletBarang sehingga seluruh
     * Barang Central aktif tetap tersedia untuk modal connect.
     */
    if (mode === "outlet") {
      if (outletId === null) {
        /*
         * Untuk Admin/Manager/Purchasing tanpa outlet filter,
         * daftar outlet berarti gabungan seluruh master barang
         * yang sudah terhubung minimal ke satu outlet aktif.
         */
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
          "Daftar Barang Outlet hanya menampilkan Barang Central yang sudah terhubung ke outlet melalui OutletBarang. Modal Hubungkan Barang Central menggunakan mode=central agar tetap membaca seluruh Barang Central aktif.",

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
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login atau session sudah tidak aktif",
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
          message: "Request tidak valid. Body harus berupa JSON.",
        },
        { status: 400 }
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

    if (user.role === "OUTLET_ADMIN") {
      if (
        !user.outletId ||
        !Number.isInteger(user.outletId) ||
        user.outletId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "User belum memiliki outlet",
          },
          { status: 400 }
        );
      }

      outletId = user.outletId;
    } else {
      outletId = Number(requestedOutletId);

      if (!Number.isInteger(outletId) || outletId <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Outlet wajib dipilih",
            received: {
              outletId: requestedOutletId ?? null,
            },
          },
          { status: 400 }
        );
      }
    }

    /*
     * =====================================================
     * BARANG CENTRAL
     *
     * Mendukung:
     *   barangId      = legacy / satu barang
     *   barangIds[]   = multi select
     *
     * Jika keduanya dikirim, keduanya digabung lalu
     * dideduplikasi.
     * =====================================================
     */
    const rawBarangIds: unknown[] = [];

    if (Array.isArray(body?.barangIds)) {
      rawBarangIds.push(...body.barangIds);
    }

    const legacyBarangId =
      body?.barangId ??
      body?.masterBarangId ??
      body?.centralBarangId ??
      body?.id;

    if (
      legacyBarangId !== undefined &&
      legacyBarangId !== null &&
      legacyBarangId !== ""
    ) {
      rawBarangIds.push(legacyBarangId);
    }

    const barangIds = Array.from(
      new Set(
        rawBarangIds
          .map((value) => Number(value))
          .filter(
            (value) =>
              Number.isInteger(value) &&
              value > 0
          )
      )
    );

    if (barangIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Minimal satu Barang Central wajib dipilih.",
          received: {
            barangIds: body?.barangIds ?? null,
            barangId: legacyBarangId ?? null,
          },
        },
        { status: 400 }
      );
    }

    /*
     * =====================================================
     * HARGA OUTLET
     *
     * Semua barang yang dipilih menggunakan harga outlet
     * yang sama dari modal.
     * =====================================================
     */
    const rawHarga =
      body?.harga ??
      body?.price ??
      body?.sellingPrice ??
      0;

    const harga = toNumber(rawHarga);

    if (!Number.isFinite(harga) || harga < 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Harga outlet tidak valid",
          received: {
            harga: rawHarga,
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
          message: "Outlet tidak ditemukan",
          outletId,
        },
        { status: 404 }
      );
    }

    if (!outlet.active) {
      return NextResponse.json(
        {
          success: false,
          message: "Outlet sedang tidak aktif",
        },
        { status: 400 }
      );
    }

    /*
     * =====================================================
     * TRANSACTION
     *
     * Semua Barang Central diproses dalam satu transaction.
     * Jika salah satu gagal, seluruh proses dibatalkan.
     *
     * Existing mapping:
     *   -> update harga
     *   -> aktifkan kembali
     *
     * New mapping:
     *   -> create OutletBarang
     *
     * OutletStock:
     *   -> upsert
     *   -> stock existing TIDAK diubah
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
              toCleanString(barang.unit);

            const masterBaseUnit =
              toCleanString(barang.baseUnit) ||
              masterUnit;

            const masterConversionRate =
              toNumber(barang.conversionRate);

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
                    barangId: barang.id,
                  },
                },
              });

            const ensureOutletStock =
              async () => {
                return tx.outletStock.upsert({
                  where: {
                    outletId_barangId: {
                      outletId,
                      barangId: barang.id,
                    },
                  },
                  update: {},
                  create: {
                    outletId,
                    barangId: barang.id,
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
            let mappingCreated = false;
            let mappingReactivated = false;

            if (existing) {
              outletBarang =
                await tx.outletBarang.update({
                  where: {
                    id: existing.id,
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
                    barangId: barang.id,
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

              mappingCreated = true;
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
              ) || resultUnit;

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
                  resultUnit !== resultBaseUnit
              );

            output.push({
              outletBarang,
              outletStock,
              barangCreated: false,
              mappingCreated,
              mappingReactivated,
              barang: resultBarang,
              unit: {
                unit: resultUnit,
                purchaseUnit: resultUnit,
                baseUnit: resultBaseUnit,
                stockUnit: resultBaseUnit,
                bomUnit: resultBaseUnit,
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
      results.map((result) => {
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
              result.unit.conversionRate,
            hasConversion:
              result.unit.hasConversion,
            conversionLabel:
              result.unit.conversionLabel,
            purchaseUnit:
              result.unit.purchaseUnit,
            stockUnit:
              result.unit.stockUnit,
            stockBaseUnit:
              result.unit.stockUnit,
            bomUnit:
              result.unit.bomUnit,
            manufactureUnit:
              result.unit.manufactureUnit,
          },
        };
      });

    const createdCount =
      results.filter(
        (item) => item.mappingCreated
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
      Array.isArray(body?.barangIds);

    return NextResponse.json(
      {
        success: true,

        message:
          barangIds.length === 1
            ? results[0].mappingCreated
              ? "Barang Master Central berhasil diaktifkan untuk outlet."
              : results[0].mappingReactivated
                ? "Barang Central sudah terdaftar sebelumnya dan berhasil diaktifkan kembali."
                : "Barang Central sudah terdaftar pada outlet dan pengaturan outlet berhasil diperbarui."
            : `${barangIds.length} Barang Central berhasil dihubungkan ke outlet.`,

        /*
         * data tetap berupa object untuk request lama
         * dengan satu barang.
         *
         * Untuk multi-select, data berupa array.
         */
        data:
          barangIds.length === 1
            ? formattedResults[0]
            : formattedResults,

        items: formattedResults,

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

        bulkConnect: isBulk,

        barangCreated: false,

        mappingCreated:
          barangIds.length === 1
            ? results[0].mappingCreated
            : createdCount > 0,

        mappingReactivated:
          barangIds.length === 1
            ? results[0].mappingReactivated
            : reactivatedCount > 0,

        outlet: {
          id: outlet.id,
          code: outlet.code,
          name: outlet.name,
        },

        unitPolicy:
          "Purchase menggunakan purchase unit. Saat barang masuk stock, quantity dikonversi ke base unit. Stock, BOM, dan Manufacture menggunakan base unit.",

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

          multiConnect:
            "Satu request dapat menghubungkan beberapa Barang Central sekaligus ke outlet.",

          noDuplicate:
            "Endpoint ini tidak pernah membuat Barang baru untuk outlet.",

          legacy:
            "Barang lama source OUTLET tidak dihapus, tidak diubah, dan tetap dapat digunakan oleh transaksi lama.",

          transactionSafety:
            "Tidak ada penghapusan atau perubahan terhadap transaksi outlet existing. Stock existing juga tidak ditimpa.",
        },
      },
      {
        status:
          barangIds.length === 1 &&
          results[0].mappingCreated
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
      error?.code === "P2002"
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
      error?.code === "P2003"
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