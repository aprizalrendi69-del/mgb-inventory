import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

/*
============================================================
GET /api/outlet/laporan/barang-masuk
============================================================

LAPORAN BARANG MASUK OUTLET
------------------------------------------------------------

PRINSIP UTAMA:

Laporan ini HANYA menampilkan barang yang SUDAH DITERIMA
oleh outlet.

TANGGAL TRANSAKSI:
------------------------------------------------------------

Kolom "date" pada laporan SELALU menggunakan tanggal
TRANSAKSI AWAL yang dibuat user.

1. PURCHASE SUPPLIER
   Transaction date:
   Purchase.purchaseDate

   Receiving date:
   OutletReceipt.receiptDate

2. GUDANG / PUSAT -> OUTLET
   Transaction date:
   Delivery.deliveryDate

   Receiving date:
   SuratJalan.receiveDate

3. TRANSFER ANTAR OUTLET
   Transaction date:
   OutletTransfer.transferDate

   OutletTransfer saat ini tidak mempunyai field
   receivedAt khusus, sehingga receivedAt = null.

------------------------------------------------------------

SUMBER:

1. PURCHASE SUPPLIER
   OutletReceipt
   OutletReceiptItem

   OutletReceipt = bukti penerimaan barang.

   PRICE:
   OutletReceiptItem.price

2. GUDANG / PUSAT
   Delivery
   DeliveryItem
   SuratJalan
   StockCard

   HANYA:
   - Delivery status DELIVERED
   - SuratJalan.receiveDate tersedia

   RELEASED belum dianggap diterima.

   PRICE PRIORITY:
   1. StockCard.unitPrice berdasarkan Delivery
   2. Inventory.averageCost
   3. Inventory.lastPurchase
   4. Barang.purchasePrice

3. TRANSFER ANTAR OUTLET
   OutletTransfer
   OutletTransferItem
   OutletStock

   HANYA:
   - receivedQty > 0
   - item tidak void

   PRICE PRIORITY:
   1. OutletStock.averageCost dari outlet sumber
   2. Inventory.averageCost
   3. Inventory.lastPurchase
   4. Barang.purchasePrice

------------------------------------------------------------

AUTHENTICATION

Project MGB menggunakan:

cookie:
erp-session

Isi cookie berupa JSON:

{
  "id": 123,
  ...
}

------------------------------------------------------------

ACCESS CONTROL

ADMIN
MANAGER
- Bisa melihat semua outlet.
- Bisa filter outletId.

OUTLET_ADMIN
ADMIN_OUTLET
- Hanya boleh melihat outlet miliknya.
- outletId dari query tidak boleh digunakan untuk
  melihat outlet lain.

------------------------------------------------------------

QUERY PARAMS

dateFrom=2026-09-01
dateTo=2026-09-30
outletId=1

source:
ALL
PURCHASE_SUPPLIER
WAREHOUSE_TO_OUTLET
OUTLET_TO_OUTLET

status:
ALL
RECEIVED
DELIVERED
PARTIAL

CATATAN:

dateFrom/dateTo difilter berdasarkan:

PURCHASE_SUPPLIER
-> Purchase.purchaseDate

WAREHOUSE_TO_OUTLET
-> Delivery.deliveryDate

OUTLET_TO_OUTLET
-> OutletTransfer.transferDate

Bukan tanggal penerimaan.

Status SENT / RELEASED / DRAFT / APPROVED / VOID
TIDAK menjadi transaksi laporan barang masuk.

============================================================
*/

type SourceType =
  | "PURCHASE_SUPPLIER"
  | "WAREHOUSE_TO_OUTLET"
  | "OUTLET_TO_OUTLET";

type NormalizedItem = {
  barangId: number;

  code: string;

  barcode: string | null;

  name: string;

  category: string | null;

  brand: string | null;

  unit: string;

  baseUnit: string | null;

  conversionRate: number;

  qty: number;

  receivedQty: number;

  price: number;

  subtotal: number;
};

type NormalizedOutlet = {
  id: number;
  code: string;
  name: string;
};

type NormalizedSupplier = {
  id: number;
  code: string;
  name: string;
};

type NormalizedReport = {
  id: string;

  source: SourceType;

  documentNumber: string;

  /*
  ----------------------------------------------------------
  DATE = TANGGAL TRANSAKSI AWAL
  ----------------------------------------------------------
  */

  date: string;

  outletId: number | null;

  outlet: NormalizedOutlet | null;

  sourceOutletId: number | null;

  sourceOutlet: NormalizedOutlet | null;

  supplier: NormalizedSupplier | null;

  invoiceNumber: string | null;

  suratJalanNumber: string | null;

  status: string;

  remarks: string | null;

  /*
  ----------------------------------------------------------
  receivedAt = TANGGAL/WAKTU PENERIMAAN
  ----------------------------------------------------------
  */

  receivedAt: string | null;

  items: NormalizedItem[];

  totalItem: number;

  totalQty: number;

  totalReceivedQty: number;

  totalValue: number;
};

/*
============================================================
HELPERS
============================================================
*/

function jsonError(
  message: string,
  status = 400,
  extra: Record<string, unknown> = {},
) {
  return NextResponse.json(
    {
      success: false,
      message,
      ...extra,
    },
    {
      status,
    },
  );
}

function parseDateStart(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function parseDateEnd(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T23:59:59.999`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function numberValue(value: unknown) {
  const n = Number(value);

  return Number.isFinite(n) ? n : 0;
}

function roundMoney(value: number) {
  return (
    Math.round(
      (value + Number.EPSILON) * 100,
    ) / 100
  );
}

function normalizeStatus(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function normalizeRole(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function isAllowedSource(
  value: string,
): value is SourceType {
  return (
    value === "PURCHASE_SUPPLIER" ||
    value === "WAREHOUSE_TO_OUTLET" ||
    value === "OUTLET_TO_OUTLET"
  );
}

/*
============================================================
CURRENT USER
============================================================
*/

async function getCurrentUser() {
  try {
    const cookieStore = await cookies();

    const sessionCookie =
      cookieStore.get("erp-session");

    if (!sessionCookie) {
      return null;
    }

    let sessionData: any;

    try {
      sessionData = JSON.parse(
        sessionCookie.value,
      );
    } catch {
      console.error(
        "ERP SESSION JSON INVALID",
      );

      return null;
    }

    if (!sessionData?.id) {
      return null;
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: Number(sessionData.id),
        },

        include: {
          outlet: true,
        },
      });

    return user;
  } catch (error) {
    console.error(
      "GET CURRENT USER ERROR:",
      error,
    );

    return null;
  }
}

/*
============================================================
HISTORICAL COST GUDANG -> OUTLET
============================================================

Sumber utama:

StockCard

Saat Release Delivery:

StockCard dibuat dengan:

referenceId = delivery.id
trxNumber   = surat jalan number
barangId    = barang.id
unitPrice   = DeliveryItem.price

Karena OutletTransferItem tidak mempunyai field price,
jangan membaca harga dari OutletTransferItem.

Untuk mencari Delivery yang menjadi sumber transfer,
kita menggunakan remarks yang dibuat oleh release route:

Pengiriman dari gudang - ${delivery.number}

PRICE PRIORITY:

1. StockCard.unitPrice berdasarkan delivery
2. StockCard.unitPrice berdasarkan surat jalan
3. Inventory.averageCost
4. Inventory.lastPurchase
5. Barang.purchasePrice

TIDAK PERNAH menggunakan sellingPrice.
============================================================
*/

async function getWarehouseHistoricalPrice(
  transfer: {
    outletId: number;
    remarks: string | null;
  },
  barangId: number,
) {
  /*
  ----------------------------------------------------------
  1. CARI DELIVERY DARI REMARKS TRANSFER
  ----------------------------------------------------------
  */

  let deliveryId: number | null =
    null;

  let suratJalanNumber:
    | string
    | null = null;

  const remarks =
    String(
      transfer.remarks ?? "",
    ).trim();

  const deliveryNumberMatch =
    remarks.match(
      /Pengiriman dari gudang\s*-\s*(.+)$/i,
    );

  if (
    deliveryNumberMatch?.[1]
  ) {
    const deliveryNumber =
      deliveryNumberMatch[1].trim();

    const delivery =
      await prisma.delivery.findFirst({
        where: {
          number:
            deliveryNumber,

          outletId:
            transfer.outletId,
        },

        select: {
          id: true,

          suratJalan: {
            select: {
              number: true,
            },
          },
        },
      });

    if (delivery) {
      deliveryId =
        delivery.id;

      suratJalanNumber =
        delivery.suratJalan?.number ??
        null;
    }
  }

  /*
  ----------------------------------------------------------
  2. STOCK CARD BERDASARKAN DELIVERY ID
  ----------------------------------------------------------
  */

  if (deliveryId) {
    const stockCard =
      await prisma.stockCard.findFirst({
        where: {
          barangId,

          referenceId:
            deliveryId,

          qtyOut: {
            gt: 0,
          },

          unitPrice: {
            gt: 0,
          },
        },

        orderBy: [
          {
            trxDate:
              "desc",
          },
          {
            id:
              "desc",
          },
        ],
      });

    if (
      stockCard &&
      numberValue(
        stockCard.unitPrice,
      ) > 0
    ) {
      return roundMoney(
        numberValue(
          stockCard.unitPrice,
        ),
      );
    }
  }

  /*
  ----------------------------------------------------------
  3. STOCK CARD BERDASARKAN SURAT JALAN
  ----------------------------------------------------------
  */

  if (suratJalanNumber) {
    const stockCard =
      await prisma.stockCard.findFirst({
        where: {
          barangId,

          trxNumber:
            suratJalanNumber,

          qtyOut: {
            gt: 0,
          },

          unitPrice: {
            gt: 0,
          },
        },

        orderBy: [
          {
            trxDate:
              "desc",
          },
          {
            id:
              "desc",
          },
        ],
      });

    if (
      stockCard &&
      numberValue(
        stockCard.unitPrice,
      ) > 0
    ) {
      return roundMoney(
        numberValue(
          stockCard.unitPrice,
        ),
      );
    }
  }

  /*
  ----------------------------------------------------------
  4. FALLBACK INVENTORY AVERAGE COST
  ----------------------------------------------------------
  */

  const inventory =
    await prisma.inventory.findUnique({
      where: {
        barangId,
      },

      select: {
        averageCost: true,
        lastPurchase: true,
      },
    });

  if (
    inventory &&
    numberValue(
      inventory.averageCost,
    ) > 0
  ) {
    return roundMoney(
      numberValue(
        inventory.averageCost,
      ),
    );
  }

  /*
  ----------------------------------------------------------
  5. FALLBACK LAST PURCHASE
  ----------------------------------------------------------
  */

  if (
    inventory &&
    numberValue(
      inventory.lastPurchase,
    ) > 0
  ) {
    return roundMoney(
      numberValue(
        inventory.lastPurchase,
      ),
    );
  }

  /*
  ----------------------------------------------------------
  6. FALLBACK BARANG PURCHASE PRICE
  ----------------------------------------------------------
  */

  const barang =
    await prisma.barang.findUnique({
      where: {
        id: barangId,
      },

      select: {
        purchasePrice: true,
      },
    });

  return roundMoney(
    numberValue(
      barang?.purchasePrice,
    ),
  );
}

/*
============================================================
HISTORICAL COST TRANSFER ANTAR OUTLET
============================================================

OutletTransferItem tidak mempunyai historical price.

Untuk transfer antar outlet, gunakan:

1. OutletStock.averageCost outlet sumber
2. Inventory.averageCost
3. Inventory.lastPurchase
4. Barang.purchasePrice

Tidak menggunakan sellingPrice.
============================================================
*/

async function getOutletTransferPrice(
  sourceOutletId: number | null,
  barangId: number,
) {
  /*
  ----------------------------------------------------------
  1. SOURCE OUTLET AVERAGE COST
  ----------------------------------------------------------
  */

  if (sourceOutletId) {
    const sourceStock =
      await prisma.outletStock.findUnique({
        where: {
          outletId_barangId: {
            outletId:
              sourceOutletId,

            barangId,
          },
        },

        select: {
          averageCost: true,
        },
      });

    if (
      sourceStock &&
      numberValue(
        sourceStock.averageCost,
      ) > 0
    ) {
      return roundMoney(
        numberValue(
          sourceStock.averageCost,
        ),
      );
    }
  }

  /*
  ----------------------------------------------------------
  2. CENTRAL INVENTORY AVERAGE COST
  ----------------------------------------------------------
  */

  const inventory =
    await prisma.inventory.findUnique({
      where: {
        barangId,
      },

      select: {
        averageCost: true,
        lastPurchase: true,
      },
    });

  if (
    inventory &&
    numberValue(
      inventory.averageCost,
    ) > 0
  ) {
    return roundMoney(
      numberValue(
        inventory.averageCost,
      ),
    );
  }

  /*
  ----------------------------------------------------------
  3. LAST PURCHASE
  ----------------------------------------------------------
  */

  if (
    inventory &&
    numberValue(
      inventory.lastPurchase,
    ) > 0
  ) {
    return roundMoney(
      numberValue(
        inventory.lastPurchase,
      ),
    );
  }

  /*
  ----------------------------------------------------------
  4. BARANG PURCHASE PRICE
  ----------------------------------------------------------
  */

  const barang =
    await prisma.barang.findUnique({
      where: {
        id: barangId,
      },

      select: {
        purchasePrice: true,
      },
    });

  return roundMoney(
    numberValue(
      barang?.purchasePrice,
    ),
  );
}

/*
============================================================
GET
============================================================
*/

export async function GET(
  request: NextRequest,
) {
  try {
    /*
    ========================================================
    1. CURRENT USER
    ========================================================
    */

    const user =
      await getCurrentUser();

    if (!user) {
      return jsonError(
        "Anda harus login",
        401,
      );
    }

    /*
    ========================================================
    2. ACTIVE USER
    ========================================================
    */

    if (user.active === false) {
      return jsonError(
        "User tidak aktif",
        403,
      );
    }

    /*
    ========================================================
    3. ROLE
    ========================================================
    */

    const role =
      normalizeRole(
        user.role,
      );

    const isAdminPusat =
      role === "ADMIN" ||
      role === "MANAGER";

    const isOutletAdmin =
      role === "OUTLET_ADMIN" ||
      role === "ADMIN_OUTLET";

    if (
      !isAdminPusat &&
      !isOutletAdmin
    ) {
      return jsonError(
        "Anda tidak memiliki akses ke laporan barang masuk outlet",
        403,
      );
    }

    /*
    ========================================================
    4. QUERY PARAMS
    ========================================================
    */

    const { searchParams } =
      new URL(request.url);

    const dateFromParam =
      searchParams
        .get("dateFrom")
        ?.trim() || "";

    const dateToParam =
      searchParams
        .get("dateTo")
        ?.trim() || "";

    const outletIdParam =
      searchParams
        .get("outletId")
        ?.trim() || "";

    const sourceParam =
      searchParams
        .get("source")
        ?.trim()
        .toUpperCase() || "ALL";

    const statusParam =
      searchParams
        .get("status")
        ?.trim()
        .toUpperCase() || "ALL";

    /*
    ========================================================
    5. VALIDATE DATE
    ========================================================
    */

    let dateFrom:
      | Date
      | null = null;

    let dateTo:
      | Date
      | null = null;

    if (dateFromParam) {
      dateFrom =
        parseDateStart(
          dateFromParam,
        );

      if (!dateFrom) {
        return jsonError(
          "Format dateFrom tidak valid. Gunakan YYYY-MM-DD",
          400,
        );
      }
    }

    if (dateToParam) {
      dateTo =
        parseDateEnd(
          dateToParam,
        );

      if (!dateTo) {
        return jsonError(
          "Format dateTo tidak valid. Gunakan YYYY-MM-DD",
          400,
        );
      }
    }

    if (
      dateFrom &&
      dateTo &&
      dateFrom > dateTo
    ) {
      return jsonError(
        "dateFrom tidak boleh lebih besar dari dateTo",
        400,
      );
    }

    /*
    ========================================================
    6. VALIDATE SOURCE
    ========================================================
    */

    if (
      sourceParam !== "ALL" &&
      !isAllowedSource(
        sourceParam,
      )
    ) {
      return jsonError(
        "Source tidak valid",
        400,
        {
          allowedSources: [
            "ALL",
            "PURCHASE_SUPPLIER",
            "WAREHOUSE_TO_OUTLET",
            "OUTLET_TO_OUTLET",
          ],
        },
      );
    }

    /*
    ========================================================
    7. VALIDATE STATUS
    ========================================================
    */

    const allowedStatuses =
      new Set([
        "ALL",
        "RECEIVED",
        "DELIVERED",
        "PARTIAL",
      ]);

    if (
      !allowedStatuses.has(
        statusParam,
      )
    ) {
      return jsonError(
        "Status tidak valid. Laporan hanya menerima status RECEIVED, DELIVERED, atau PARTIAL.",
        400,
        {
          allowedStatuses:
            Array.from(
              allowedStatuses,
            ),
        },
      );
    }

    /*
    ========================================================
    8. OUTLET FILTER
    ========================================================
    */

    let requestedOutletId:
      | number
      | null = null;

    if (outletIdParam) {
      const parsed =
        Number(
          outletIdParam,
        );

      if (
        !Number.isInteger(parsed) ||
        parsed <= 0
      ) {
        return jsonError(
          "outletId tidak valid",
          400,
        );
      }

      requestedOutletId =
        parsed;
    }

    /*
    ========================================================
    9. OUTLET ADMIN SECURITY
    ========================================================
    */

    if (isOutletAdmin) {
      if (
        user.outletId === null ||
        user.outletId === undefined
      ) {
        return jsonError(
          "User outlet belum memiliki outlet",
          403,
        );
      }

      if (
        requestedOutletId !== null &&
        requestedOutletId !==
          user.outletId
      ) {
        return jsonError(
          "Anda tidak boleh melihat laporan outlet lain",
          403,
        );
      }

      requestedOutletId =
        user.outletId;
    }

    /*
    ========================================================
    RESULT
    ========================================================
    */

    const result:
      NormalizedReport[] = [];

    /*
    ========================================================
    10. PURCHASE SUPPLIER
    ========================================================

    PENTING:

    FILTER DATE MENGGUNAKAN:

    Purchase.purchaseDate

    BUKAN:

    OutletReceipt.receiptDate

    Karena tanggal laporan harus menunjukkan tanggal
    transaksi Purchase New yang dibuat user.
    ========================================================
    */

    const shouldLoadPurchase =
      sourceParam === "ALL" ||
      sourceParam ===
        "PURCHASE_SUPPLIER";

    if (shouldLoadPurchase) {
      const purchaseReceipts =
        await prisma.outletReceipt.findMany(
          {
            where: {
              ...(requestedOutletId !==
              null
                ? {
                    outletId:
                      requestedOutletId,
                  }
                : {}),

              /*
              ------------------------------------------------
              DATE FILTER TRANSAKSI PURCHASE
              ------------------------------------------------
              */

              ...(dateFrom ||
              dateTo
                ? {
                    purchase: {
                      purchaseDate: {
                        gte:
                          dateFrom ??
                          undefined,

                        lte:
                          dateTo ??
                          undefined,
                      },
                    },
                  }
                : {}),
            },

            include: {
              supplier: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },

              outlet: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },

              purchase: {
                select: {
                  id: true,
                  number: true,
                  status: true,
                  total: true,
                  purchaseDate:
                    true,
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
                      category: true,
                      brand: true,
                      unit: true,
                      baseUnit: true,
                      conversionRate:
                        true,
                    },
                  },
                },
              },
            },

            orderBy: [
              {
                receiptDate:
                  "desc",
              },
              {
                id:
                  "desc",
              },
            ],
          },
        );

      for (
        const receipt of purchaseReceipts
      ) {
        const items:
          NormalizedItem[] =
          receipt.items
            .map((item) => {
              const qty =
                numberValue(
                  item.qty,
                );

              const price =
                numberValue(
                  item.price,
                );

              const subtotal =
                roundMoney(
                  numberValue(
                    item.subtotal,
                  ) ||
                    qty * price,
                );

              return {
                barangId:
                  item.barang.id,

                code:
                  item.barang.code,

                barcode:
                  item.barang
                    .barcode,

                name:
                  item.barang.name,

                category:
                  item.barang
                    .category,

                brand:
                  item.barang.brand,

                unit:
                  item.barang.unit,

                baseUnit:
                  item.barang
                    .baseUnit,

                conversionRate:
                  numberValue(
                    item.barang
                      .conversionRate,
                  ) || 1,

                qty,

                receivedQty:
                  qty,

                price,

                subtotal,
              };
            })
            .filter(
              (item) =>
                item.receivedQty >
                0,
            );

        if (items.length === 0) {
          continue;
        }

        const totalQty =
          items.reduce(
            (sum, item) =>
              sum + item.qty,
            0,
          );

        const totalReceivedQty =
          items.reduce(
            (sum, item) =>
              sum +
              item.receivedQty,
            0,
          );

        const totalValue =
          items.reduce(
            (sum, item) =>
              sum +
              item.subtotal,
            0,
          );

        /*
        ------------------------------------------------------
        TANGGAL TRANSAKSI PURCHASE
        ------------------------------------------------------

        Prioritas:

        1. Purchase.purchaseDate
        2. receipt.receiptDate sebagai fallback

        Normalnya Purchase.purchaseDate selalu tersedia.
        ------------------------------------------------------
        */

        const transactionDate =
          receipt.purchase
            ?.purchaseDate ??
          receipt.receiptDate;

        result.push({
          id:
            `PURCHASE-${receipt.id}`,

          source:
            "PURCHASE_SUPPLIER",

          documentNumber:
            receipt.number,

          /*
          DATE = PURCHASE NEW DATE
          */

          date:
            transactionDate.toISOString(),

          outletId:
            receipt.outletId,

          outlet:
            receipt.outlet,

          sourceOutletId:
            null,

          sourceOutlet:
            null,

          supplier:
            receipt.supplier,

          invoiceNumber:
            receipt.invoiceNumber,

          suratJalanNumber:
            null,

          status:
            "RECEIVED",

          remarks:
            receipt.remarks,

          /*
          RECEIVED AT = TANGGAL PENERIMAAN
          */

          receivedAt:
            receipt.receiptDate.toISOString(),

          items,

          totalItem:
            items.length,

          totalQty,

          totalReceivedQty,

          totalValue:
            roundMoney(
              totalValue,
            ),
        });
      }
    }

    /*
    ========================================================
    11. DELIVERY GUDANG -> OUTLET
    ========================================================

    DATE:
    Delivery.deliveryDate

    RECEIVED AT:
    SuratJalan.receiveDate

    FILTER DATE:
    Delivery.deliveryDate
    ========================================================
    */

    const shouldLoadWarehouse =
      sourceParam === "ALL" ||
      sourceParam ===
        "WAREHOUSE_TO_OUTLET";

    if (shouldLoadWarehouse) {
      const deliveries =
        await prisma.delivery.findMany(
          {
            where: {
              outletId: {
                not: null,
              },

              status:
                "DELIVERED",

              ...(requestedOutletId !==
              null
                ? {
                    outletId:
                      requestedOutletId,
                  }
                : {}),

              ...(dateFrom ||
              dateTo
                ? {
                    deliveryDate: {
                      gte:
                        dateFrom ??
                        undefined,

                      lte:
                        dateTo ??
                        undefined,
                    },
                  }
                : {}),
            },

            include: {
              outlet: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },

              suratJalan: {
                select: {
                  id: true,
                  number: true,
                  receiveDate:
                    true,
                  receiver:
                    true,
                  driver:
                    true,
                  vehicleNumber:
                    true,
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
                      category: true,
                      brand: true,
                      unit: true,
                      baseUnit: true,
                      conversionRate:
                        true,
                    },
                  },
                },
              },
            },

            orderBy: [
              {
                deliveryDate:
                  "desc",
              },
              {
                id:
                  "desc",
              },
            ],
          },
        );

      for (
        const delivery of deliveries
      ) {
        /*
        ------------------------------------------------------
        WAJIB ADA RECEIVE DATE
        ------------------------------------------------------
        */

        if (
          !delivery.suratJalan
            ?.receiveDate
        ) {
          continue;
        }

        if (
          delivery.outletId ===
          null
        ) {
          continue;
        }

        const items:
          NormalizedItem[] =
          delivery.items
            .map((item) => {
              const qty =
                numberValue(
                  item.qty,
                );

              const price =
                numberValue(
                  item.price,
                );

              const subtotal =
                roundMoney(
                  numberValue(
                    item.subtotal,
                  ) ||
                    qty * price,
                );

              return {
                barangId:
                  item.barang.id,

                code:
                  item.barang.code,

                barcode:
                  item.barang
                    .barcode,

                name:
                  item.barang.name,

                category:
                  item.barang
                    .category,

                brand:
                  item.barang.brand,

                unit:
                  item.barang.unit,

                baseUnit:
                  item.barang
                    .baseUnit,

                conversionRate:
                  numberValue(
                    item.barang
                      .conversionRate,
                  ) || 1,

                qty,

                receivedQty:
                  qty,

                price,

                subtotal,
              };
            })
            .filter(
              (item) =>
                item.receivedQty >
                0,
            );

        if (items.length === 0) {
          continue;
        }

        const totalQty =
          items.reduce(
            (sum, item) =>
              sum + item.qty,
            0,
          );

        const totalReceivedQty =
          items.reduce(
            (sum, item) =>
              sum +
              item.receivedQty,
            0,
          );

        const totalValue =
          items.reduce(
            (sum, item) =>
              sum +
              item.subtotal,
            0,
          );

        result.push({
          id:
            `DELIVERY-${delivery.id}`,

          source:
            "WAREHOUSE_TO_OUTLET",

          documentNumber:
            delivery.number,

          /*
          DATE = DELIVERY TRANSACTION DATE
          */

          date:
            delivery.deliveryDate.toISOString(),

          outletId:
            delivery.outletId,

          outlet:
            delivery.outlet,

          sourceOutletId:
            null,

          sourceOutlet:
            null,

          supplier:
            null,

          invoiceNumber:
            null,

          suratJalanNumber:
            delivery.suratJalan
              ?.number ?? null,

          status:
            "DELIVERED",

          remarks:
            delivery.remarks,

          /*
          RECEIVED AT = RECEIVE DATE
          */

          receivedAt:
            delivery.suratJalan
              ?.receiveDate
              ? delivery.suratJalan.receiveDate.toISOString()
              : null,

          items,

          totalItem:
            items.length,

          totalQty,

          totalReceivedQty,

          totalValue:
            roundMoney(
              totalValue,
            ),
        });
      }
    }

    /*
    ========================================================
    12. OUTLET TRANSFER
    ========================================================

    DATE:
    OutletTransfer.transferDate

    FILTER DATE:
    OutletTransfer.transferDate
    ========================================================
    */

    const shouldLoadTransfer =
      sourceParam === "ALL" ||
      sourceParam ===
        "WAREHOUSE_TO_OUTLET" ||
      sourceParam ===
        "OUTLET_TO_OUTLET";

    if (shouldLoadTransfer) {
      const transferWhere: any =
        {
          ...(requestedOutletId !==
          null
            ? {
                outletId:
                  requestedOutletId,
              }
            : {}),

          /*
          --------------------------------------------------
          DATE FILTER TRANSAKSI TRANSFER
          --------------------------------------------------
          */

          ...(dateFrom ||
          dateTo
            ? {
                transferDate: {
                  gte:
                    dateFrom ??
                    undefined,

                  lte:
                    dateTo ??
                    undefined,
                },
              }
            : {}),
        };

      /*
      ------------------------------------------------------
      SOURCE FILTER
      ------------------------------------------------------
      */

      if (
        sourceParam ===
        "OUTLET_TO_OUTLET"
      ) {
        transferWhere.sourceOutletId =
          {
            not: null,
          };
      }

      if (
        sourceParam ===
        "WAREHOUSE_TO_OUTLET"
      ) {
        transferWhere.sourceOutletId =
          null;
      }

      const outletTransfers =
        await prisma.outletTransfer.findMany(
          {
            where:
              transferWhere,

            include: {
              outlet: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },

              sourceOutlet: {
                select: {
                  id: true,
                  code: true,
                  name: true,
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
                      category: true,
                      brand: true,
                      unit: true,
                      baseUnit: true,
                      conversionRate:
                        true,
                    },
                  },
                },
              },
            },

            orderBy: [
              {
                transferDate:
                  "desc",
              },
              {
                id:
                  "desc",
              },
            ],
          },
        );

      for (
        const transfer of outletTransfers
      ) {
        /*
        ------------------------------------------------------
        TENTUKAN SOURCE
        ------------------------------------------------------
        */

        const normalizedSource:
          SourceType =
          transfer.sourceOutletId !==
          null
            ? "OUTLET_TO_OUTLET"
            : "WAREHOUSE_TO_OUTLET";

        if (
          sourceParam !==
            "ALL" &&
          normalizedSource !==
            sourceParam
        ) {
          continue;
        }

        /*
        ------------------------------------------------------
        FILTER ITEM SUDAH DITERIMA
        ------------------------------------------------------

        Hanya receivedQty > 0.

        Item void tidak masuk laporan.
        ------------------------------------------------------
        */

        const receivedItems =
          transfer.items.filter(
            (item) =>
              item.voided !==
                true &&
              numberValue(
                item.receivedQty,
              ) > 0,
          );

        if (
          receivedItems.length ===
          0
        ) {
          continue;
        }

        /*
        ------------------------------------------------------
        MAP ITEM
        ------------------------------------------------------
        */

        const items:
          NormalizedItem[] = [];

        for (const item of receivedItems) {
          const receivedQty =
            numberValue(
              item.receivedQty,
            );

          /*
          Laporan barang masuk:
          qty = qty yang benar-benar diterima.
          */

          const qty =
            receivedQty;

          /*
          ----------------------------------------------------
          HARGA TRANSFER
          ----------------------------------------------------

          WAREHOUSE_TO_OUTLET:
          historical cost dari StockCard.

          OUTLET_TO_OUTLET:
          average cost outlet sumber.

          Fallback tetap menggunakan purchase cost,
          bukan selling price.
          ----------------------------------------------------
          */

          let price = 0;

          if (
            normalizedSource ===
            "WAREHOUSE_TO_OUTLET"
          ) {
            price =
              await getWarehouseHistoricalPrice(
                {
                  outletId:
                    transfer.outletId,

                  remarks:
                    transfer.remarks,
                },

                item.barangId,
              );
          } else {
            price =
              await getOutletTransferPrice(
                transfer.sourceOutletId,

                item.barangId,
              );
          }

          const subtotal =
            roundMoney(
              qty * price,
            );

          items.push({
            barangId:
              item.barang.id,

            code:
              item.barang.code,

            barcode:
              item.barang
                .barcode,

            name:
              item.barang.name,

            category:
              item.barang
                .category,

            brand:
              item.barang.brand,

            unit:
              item.barang.unit,

            baseUnit:
              item.barang
                .baseUnit,

            conversionRate:
              numberValue(
                item.barang
                  .conversionRate,
              ) || 1,

            qty,

            receivedQty,

            price,

            subtotal,
          });
        }

        /*
        ------------------------------------------------------
        TOTAL
        ------------------------------------------------------
        */

        const totalQty =
          items.reduce(
            (sum, item) =>
              sum + item.qty,
            0,
          );

        const totalReceivedQty =
          items.reduce(
            (sum, item) =>
              sum +
              item.receivedQty,
            0,
          );

        const totalValue =
          items.reduce(
            (sum, item) =>
              sum +
              item.subtotal,
            0,
          );

        /*
        ------------------------------------------------------
        ORIGINAL TRANSFER QTY
        ------------------------------------------------------
        */

        const originalTotalQty =
          transfer.items.reduce(
            (sum, item) => {
              if (
                item.voided ===
                true
              ) {
                return sum;
              }

              return (
                sum +
                numberValue(
                  item.qty,
                )
              );
            },
            0,
          );

        const originalReceivedQty =
          transfer.items.reduce(
            (sum, item) => {
              if (
                item.voided ===
                true
              ) {
                return sum;
              }

              return (
                sum +
                numberValue(
                  item.receivedQty,
                )
              );
            },
            0,
          );

        /*
        ------------------------------------------------------
        STATUS
        ------------------------------------------------------
        */

        let normalizedStatus =
          "RECEIVED";

        if (
          originalTotalQty > 0 &&
          originalReceivedQty <
            originalTotalQty
        ) {
          normalizedStatus =
            "PARTIAL";
        }

        result.push({
          id:
            `TRANSFER-${transfer.id}`,

          source:
            normalizedSource,

          documentNumber:
            transfer.number,

          /*
          DATE = TANGGAL TRANSAKSI TRANSFER
          */

          date:
            transfer.transferDate.toISOString(),

          outletId:
            transfer.outletId,

          outlet:
            transfer.outlet,

          sourceOutletId:
            transfer.sourceOutletId,

          sourceOutlet:
            transfer.sourceOutlet,

          supplier:
            null,

          invoiceNumber:
            null,

          suratJalanNumber:
            null,

          status:
            normalizedStatus,

          remarks:
            transfer.remarks,

          /*
          OutletTransfer belum mempunyai
          receivedAt khusus.
          */

          receivedAt:
            null,

          items,

          totalItem:
            items.length,

          totalQty,

          totalReceivedQty,

          totalValue:
            roundMoney(
              totalValue,
            ),
        });
      }
    }

    /*
    ========================================================
    13. DEDUPLIKASI DOKUMEN
    ========================================================
    */

    const uniqueMap =
      new Map<
        string,
        NormalizedReport
      >();

    for (const row of result) {
      if (
        !uniqueMap.has(row.id)
      ) {
        uniqueMap.set(
          row.id,
          row,
        );
      }
    }

    let filteredResult =
      Array.from(
        uniqueMap.values(),
      );

    /*
    ========================================================
    14. STATUS FILTER
    ========================================================
    */

    if (
      statusParam !== "ALL"
    ) {
      filteredResult =
        filteredResult.filter(
          (row) =>
            normalizeStatus(
              row.status,
            ) ===
            statusParam,
        );
    }

    /*
    ========================================================
    15. GLOBAL SORT
    ========================================================

    Urut berdasarkan TANGGAL TRANSAKSI,
    bukan tanggal penerimaan.
    ========================================================
    */

    filteredResult.sort(
      (a, b) => {
        const dateA =
          new Date(
            a.date,
          ).getTime();

        const dateB =
          new Date(
            b.date,
          ).getTime();

        if (
          dateB !== dateA
        ) {
          return (
            dateB - dateA
          );
        }

        return a.documentNumber.localeCompare(
          b.documentNumber,
        );
      },
    );

    /*
    ========================================================
    16. SUMMARY
    ========================================================
    */

    const summary = {
      totalTransaction:
        filteredResult.length,

      totalItem:
        filteredResult.reduce(
          (sum, row) =>
            sum +
            row.totalItem,
          0,
        ),

      totalQty:
        filteredResult.reduce(
          (sum, row) =>
            sum +
            row.totalQty,
          0,
        ),

      totalReceivedQty:
        filteredResult.reduce(
          (sum, row) =>
            sum +
            row.totalReceivedQty,
          0,
        ),

      totalValue:
        roundMoney(
          filteredResult.reduce(
            (sum, row) =>
              sum +
              row.totalValue,
            0,
          ),
        ),

      purchaseSupplier:
        filteredResult.filter(
          (row) =>
            row.source ===
            "PURCHASE_SUPPLIER",
        ).length,

      warehouseToOutlet:
        filteredResult.filter(
          (row) =>
            row.source ===
            "WAREHOUSE_TO_OUTLET",
        ).length,

      outletToOutlet:
        filteredResult.filter(
          (row) =>
            row.source ===
            "OUTLET_TO_OUTLET",
        ).length,

      received:
        filteredResult.filter(
          (row) =>
            row.status ===
            "RECEIVED",
        ).length,

      partial:
        filteredResult.filter(
          (row) =>
            row.status ===
            "PARTIAL",
        ).length,

      waiting: 0,

      void: 0,
    };

    /*
    ========================================================
    17. RESPONSE
    ========================================================
    */

    return NextResponse.json({
      success: true,

      filters: {
        /*
        ------------------------------------------------------
        DATE FILTER SEKARANG BERARTI:
        TANGGAL TRANSAKSI
        ------------------------------------------------------
        */

        dateFrom:
          dateFromParam ||
          null,

        dateTo:
          dateToParam ||
          null,

        outletId:
          requestedOutletId,

        source:
          sourceParam,

        status:
          statusParam,
      },

      summary,

      data:
        filteredResult,

      meta: {
        total:
          filteredResult.length,

        generatedAt:
          new Date().toISOString(),

        role,

        outletId:
          user.outletId ??
          null,

        onlyReceived: true,

        /*
        Informasi eksplisit agar frontend
        mengetahui arti field date.
        */

        dateMeaning:
          "Tanggal transaksi awal",

        receivedAtMeaning:
          "Tanggal/waktu penerimaan barang",
      },
    });
  } catch (error) {
    console.error(
      "GET /api/outlet/laporan/barang-masuk ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Gagal mengambil laporan barang masuk outlet",

        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      {
        status: 500,
      },
    );
  }
}