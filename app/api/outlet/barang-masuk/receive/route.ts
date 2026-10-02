import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

import {
  toBaseQty,
  getBaseUnitCost,
  roundQty,
  roundMoney,
} from "@/lib/unit-conversion";

/*
=============================================================
POST OUTLET BARANG MASUK - RECEIVE PURCHASE
=============================================================

FLOW
-------------------------------------------------------------
OUTLET PURCHASE
    ↓
APPROVED
    ↓
BARANG MASUK
    ↓
RECEIVE
    ↓
OUTLET RECEIPT
    ↓
INVOICE SUPPLIER disimpan di OutletReceipt
    ↓
PURCHASE QTY tetap menggunakan UNIT TRANSAKSI
    ↓
KONVERSI SEKALI SAAT STOCK MASUK
    ↓
OUTLET STOCK disimpan dalam BASE UNIT
    ↓
OUTLET PURCHASE = RECEIVED

=============================================================
UNIT RULE
=============================================================

PURCHASE / RECEIPT:

    item.qty
        = Qty Purchase Order
        = UNIT TRANSAKSI

    receivedQty
        = Qty aktual diterima
        = UNIT TRANSAKSI

Contoh:

    Unit          = jerigen
    Base Unit     = liter
    Conversion    = 13

    PO Qty        = 4.3 jerigen
    Qty Terima    = 4.3 jerigen

Maka:

    OutletReceipt.qty
        = 4.3 jerigen

    OutletPurchaseItem.receivedQty
        = 4.3 jerigen

    Stock:
        4.3 × 13
        = 55.9 liter

    OutletStock.stock
        = 55.9 liter

=============================================================
IMPORTANT STOCK RULE
=============================================================

OutletStock.stock SELALU menggunakan BASE UNIT.

JANGAN:

    OutletStock.stock += receivedQty

Karena receivedQty adalah UNIT TRANSAKSI.

HARUS:

    baseQty = toBaseQty(receivedQty, barang)

    OutletStock.stock += baseQty

=============================================================
AVERAGE COST RULE
=============================================================

Harga Purchase:

    price
        = harga per UNIT TRANSAKSI

Contoh:

    Harga = Rp130.000 / jerigen
    Conversion = 13 liter

Maka:

    baseUnitCost
        = 130.000 / 13
        = Rp10.000 / liter

OutletStock.averageCost menggunakan
harga per BASE UNIT.

=============================================================
IMPORTANT
=============================================================

- Purchase tetap menggunakan unit transaksi.
- Receipt tetap menggunakan unit transaksi.
- receivedQty tetap menggunakan unit transaksi.
- Konversi hanya dilakukan saat stock masuk.
- OutletStock.stock = BASE UNIT.
- Existing OutletStock.stock dianggap sudah BASE UNIT.
- Existing stock TIDAK dikonversi ulang.
- averageCost = cost per BASE UNIT.
- Purchase/Payable amount tetap berdasarkan unit transaksi.
- Invoice Supplier hanya WAJIB untuk TEMPO.
- CASH/COD/CBD/TRANSFER invoice boleh kosong.
- Jika invoice diisi pada non-TEMPO, invoice tetap disimpan.
- TEMPO membuat PurchasePayable jika belum ada.
- TEMPO menggunakan PurchasePayable existing jika sudah ada.
- Tidak membuat payable duplikat.
- Tidak mengubah paidAmount payable existing.
- PurchasePayable adalah source of truth hutang.
- OutletReceipt adalah source of truth dokumen penerimaan
  dan invoice supplier.
- Tidak menghapus data existing.
- Tidak reset database.
=============================================================
*/

/*
=============================================================
CURRENT LOGIN USER
=============================================================
*/

async function getCurrentUser() {
  const cookieStore = await cookies();

  const session = cookieStore.get("erp-session");

  if (!session?.value) {
    return null;
  }

  let sessionData: any;

  try {
    sessionData = JSON.parse(session.value);
  } catch {
    return null;
  }

  const userId = Number(
    sessionData?.user?.id ??
      sessionData?.data?.user?.id ??
      sessionData?.data?.id ??
      sessionData?.id
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

  if (!user || user.active === false) {
    return null;
  }

  return user;
}

/*
=============================================================
NORMALIZE STRING
=============================================================
*/

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

/*
=============================================================
NORMALIZE QTY
=============================================================
*/

function normalizeQty(value: unknown) {
  const qty = Number(value);

  if (!Number.isFinite(qty)) {
    return null;
  }

  if (qty <= 0) {
    return null;
  }

  return qty;
}

/*
=============================================================
ROUND QTY
=============================================================
*/

function safeRoundQty(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return roundQty(value);
}

/*
=============================================================
GET RECEIVED QTY FROM REQUEST ITEM
=============================================================
*/

function getRequestedReceivedQty(
  requestItem: any,
  purchaseItem: any
) {
  const candidateValues = [
    requestItem?.receivedQty,
    requestItem?.qtyDiterima,
    requestItem?.receiveQty,
    requestItem?.qtyTerima,
    requestItem?.received,
    requestItem?.qty,
  ];

  for (const value of candidateValues) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      const qty = normalizeQty(value);

      if (qty !== null) {
        return qty;
      }

      return null;
    }
  }

  /*
   * Backward compatibility:
   *
   * Jika frontend tidak mengirim daftar qty penerimaan,
   * gunakan Qty PO.
   */

  return normalizeQty(purchaseItem.qty);
}

/*
=============================================================
GET REQUEST ITEM ID
=============================================================
*/

function getRequestItemId(requestItem: any) {
  const rawId =
    requestItem?.itemId ??
    requestItem?.purchaseItemId ??
    requestItem?.id;

  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

/*
=============================================================
BUILD RECEIVED QTY MAP
=============================================================
*/

function buildReceivedQtyMap(
  body: any,
  purchaseItems: any[]
) {
  const rawItems =
    Array.isArray(body?.items)
      ? body.items
      : Array.isArray(body?.receivedItems)
        ? body.receivedItems
        : Array.isArray(body?.itemQuantities)
          ? body.itemQuantities
          : null;

  const receivedQtyMap = new Map<
    number,
    number
  >();

  if (rawItems) {
    for (const requestItem of rawItems) {
      const itemId =
        getRequestItemId(requestItem);

      if (!itemId) {
        continue;
      }

      const purchaseItem =
        purchaseItems.find(
          (item) => item.id === itemId
        );

      if (!purchaseItem) {
        continue;
      }

      const receivedQty =
        getRequestedReceivedQty(
          requestItem,
          purchaseItem
        );

      if (receivedQty === null) {
        receivedQtyMap.set(
          itemId,
          Number.NaN
        );
      } else {
        receivedQtyMap.set(
          itemId,
          receivedQty
        );
      }
    }
  }

  /*
   * Fallback item yang tidak dikirim frontend:
   * gunakan Qty PO.
   */

  for (const purchaseItem of purchaseItems) {
    if (
      !receivedQtyMap.has(
        purchaseItem.id
      )
    ) {
      const fallbackQty =
        normalizeQty(
          purchaseItem.qty
        );

      receivedQtyMap.set(
        purchaseItem.id,
        fallbackQty ?? Number.NaN
      );
    }
  }

  return receivedQtyMap;
}

/*
=============================================================
VALIDATE BARANG CONVERSION
=============================================================

Semua barang yang masuk stock harus mempunyai baseUnit
dan conversionRate yang valid.

Jika:

    unit      = jerigen
    baseUnit  = liter
    rate      = 13

maka:

    4.3 jerigen
        →
    55.9 liter
=============================================================
*/

function convertReceivedQtyToBase(
  receivedQty: number,
  barang: any
) {
  const unit =
    cleanString(barang?.unit);

  const baseUnit =
    cleanString(barang?.baseUnit);

  const conversionRate =
    Number(
      barang?.conversionRate ?? 1
    );

  if (!baseUnit) {
    throw new Error(
      `Barang "${barang?.name ?? barang?.id}" belum memiliki Base Unit. Stock tidak dapat dikonversi dengan aman.`
    );
  }

  if (
    !Number.isFinite(
      conversionRate
    ) ||
    conversionRate <= 0
  ) {
    throw new Error(
      `Barang "${barang?.name ?? barang?.id}" memiliki Conversion Rate tidak valid.`
    );
  }

  /*
   * Jika unit transaksi sama dengan baseUnit,
   * tidak ada perkalian tambahan.
   *
   * Contoh:
   *
   * unit     = liter
   * baseUnit = liter
   * qty      = 10
   *
   * hasil    = 10 liter
   */

  if (
    unit &&
    unit.trim().toLowerCase() ===
      baseUnit.trim().toLowerCase()
  ) {
    return {
      baseQty:
        safeRoundQty(
          receivedQty
        ),

      unit,

      baseUnit,

      conversionRate: 1,

      converted: false,
    };
  }

  /*
   * Jika unit transaksi berbeda dengan baseUnit,
   * gunakan conversion helper.
   */

  const baseQty =
    toBaseQty(
      receivedQty,
      barang
    );

  if (
    !Number.isFinite(
      baseQty
    ) ||
    baseQty <= 0
  ) {
    throw new Error(
      `Konversi Qty barang "${barang?.name ?? barang?.id}" tidak menghasilkan nilai Base Unit yang valid.`
    );
  }

  return {
    baseQty:
      safeRoundQty(
        baseQty
      ),

    unit,

    baseUnit,

    conversionRate,

    converted: true,
  };
}

/*
=============================================================
CALCULATE BASE UNIT COST
=============================================================

price:
    harga per UNIT TRANSAKSI

hasil:
    harga per BASE UNIT
=============================================================
*/

function calculateBaseUnitCost(
  price: number,
  barang: any
) {
  const baseUnitCost =
    getBaseUnitCost(
      price,
      barang
    );

  if (
    !Number.isFinite(
      baseUnitCost
    ) ||
    baseUnitCost < 0
  ) {
    throw new Error(
      `Harga Base Unit barang "${barang?.name ?? barang?.id}" tidak valid.`
    );
  }

  return roundMoney(
    baseUnitCost
  );
}

/*
=============================================================
POST
=============================================================
*/

export async function POST(
  req: NextRequest
) {
  try {
    /*
    =========================================================
    AUTH
    =========================================================
    */

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    /*
    =========================================================
    ROLE
    =========================================================
    */

    const allowedRoles = [
      "ADMIN",
      "MANAGER",
      "OUTLET_ADMIN",
    ];

    if (
      !allowedRoles.includes(
        String(user.role)
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses untuk menerima barang.",
        },
        {
          status: 403,
        }
      );
    }

    /*
    =========================================================
    BODY
    =========================================================
    */

    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Request body tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    const purchaseId =
      Number(
        body?.purchaseId
      );

    /*
    =========================================================
    INVOICE SUPPLIER
    =========================================================
    */

    const invoiceNumber =
      cleanString(
        body?.invoiceNumber
      );

    const remarksRaw =
      cleanString(
        body?.remarks
      );

    const remarks =
      remarksRaw || null;

    /*
    =========================================================
    VALIDATE PURCHASE ID
    =========================================================
    */

    if (
      !Number.isInteger(
        purchaseId
      ) ||
      purchaseId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase ID tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    =========================================================
    FIND PURCHASE
    =========================================================
    */

    const purchaseWhere: any = {
      id: purchaseId,
    };

    if (
      String(user.role) ===
      "OUTLET_ADMIN"
    ) {
      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet tidak memiliki outlet.",
          },
          {
            status: 403,
          }
        );
      }

      purchaseWhere.outletId =
        user.outletId;
    }

    const purchase =
      await prisma.outletPurchase.findFirst(
        {
          where:
            purchaseWhere,

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
        }
      );

    /*
    =========================================================
    PURCHASE NOT FOUND
    =========================================================
    */

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    /*
    =========================================================
    SECURITY
    =========================================================
    */

    if (
      String(user.role) ===
        "OUTLET_ADMIN" &&
      purchase.outletId !==
        user.outletId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses ke Purchase Outlet ini.",
        },
        {
          status: 403,
        }
      );
    }

    /*
    =========================================================
    OUTLET CHECK
    =========================================================
    */

    if (
      !purchase.outlet?.active
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tujuan tidak aktif.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    =========================================================
    STATUS CHECK
    =========================================================
    */

    if (
      purchase.status !==
      "APPROVED"
    ) {
      if (
        purchase.status ===
        "RECEIVED"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Purchase Outlet ini sudah pernah diterima.",
          },
          {
            status: 400,
          }
        );
      }

      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet harus berstatus APPROVED sebelum menerima barang.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    =========================================================
    SUPPLIER CHECK
    =========================================================
    */

    if (!purchase.supplier) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Supplier Purchase Outlet tidak ditemukan.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    =========================================================
    ITEM CHECK
    =========================================================
    */

    if (
      !purchase.items ||
      purchase.items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet tidak memiliki item yang dapat diterima.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    =========================================================
    BUILD RECEIVED QTY MAP
    =========================================================
    */

    const receivedQtyMap =
      buildReceivedQtyMap(
        body,
        purchase.items
      );

    /*
    =========================================================
    PAYMENT METHOD
    =========================================================
    */

    const paymentMethod =
      String(
        purchase.paymentMethod
      )
        .trim()
        .toUpperCase();

    const supportedPaymentMethods = [
      "CASH",
      "TRANSFER",
      "COD",
      "CBD",
      "TEMPO",
    ];

    if (
      !supportedPaymentMethods.includes(
        paymentMethod
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Payment Method "${paymentMethod}" tidak didukung untuk proses penerimaan barang.`,
        },
        {
          status: 400,
        }
      );
    }

    const isTempo =
      paymentMethod ===
      "TEMPO";

    /*
    =========================================================
    INVOICE VALIDATION
    =========================================================
    */

    if (
      isTempo &&
      !invoiceNumber
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No. Invoice Supplier wajib diisi untuk Purchase dengan pembayaran TEMPO.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    =========================================================
    VALIDATE ITEMS
    =========================================================
    */

    for (
      const item of
      purchase.items
    ) {
      /*
      -------------------------------------------------------
      BARANG
      -------------------------------------------------------
      */

      if (!item.barang) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang pada item Purchase ID ${item.id} tidak ditemukan.`,
          },
          {
            status: 400,
          }
        );
      }

      /*
      -------------------------------------------------------
      CENTRAL ITEM
      -------------------------------------------------------
      */

      if (
        item.barang.source !==
        "CENTRAL"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang "${item.barang.name}" bukan Barang Central. Purchase supplier outlet hanya boleh menggunakan Barang Central.`,
          },
          {
            status: 400,
          }
        );
      }

      /*
      -------------------------------------------------------
      UNIT / BASE UNIT CHECK
      -------------------------------------------------------
      */

      const purchaseUnit =
        cleanString(
          item.barang.unit
        );

      const baseUnit =
        cleanString(
          item.barang.baseUnit
        );

      const conversionRate =
        Number(
          item.barang
            .conversionRate ?? 1
        );

      if (!baseUnit) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang "${item.barang.name}" belum memiliki Base Unit. Lengkapi Base Unit sebelum menerima barang.`,
          },
          {
            status: 400,
          }
        );
      }

      if (
        !Number.isFinite(
          conversionRate
        ) ||
        conversionRate <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Conversion Rate barang "${item.barang.name}" tidak valid.`,
          },
          {
            status: 400,
          }
        );
      }

      if (!purchaseUnit) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Unit transaksi barang "${item.barang.name}" belum diatur.`,
          },
          {
            status: 400,
          }
        );
      }

      /*
      -------------------------------------------------------
      PO QTY
      -------------------------------------------------------
      */

      const poQty =
        Number(item.qty);

      if (
        !Number.isFinite(
          poQty
        ) ||
        poQty <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Qty Purchase Order barang "${item.barang.name}" tidak valid.`,
          },
          {
            status: 400,
          }
        );
      }

      /*
      -------------------------------------------------------
      RECEIVED QTY
      -------------------------------------------------------
      */

      const receivedQty =
        receivedQtyMap.get(
          item.id
        );

      if (
        receivedQty === undefined ||
        !Number.isFinite(
          receivedQty
        ) ||
        receivedQty <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Qty diterima barang "${item.barang.name}" tidak valid.`,
          },
          {
            status: 400,
          }
        );
      }

      /*
      -------------------------------------------------------
      PRICE
      -------------------------------------------------------
      */

      const price =
        Number(item.price);

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
              `Harga barang "${item.barang.name}" tidak valid.`,
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
    =========================================================
    RECEIVE DATE
    =========================================================
    */

    const receiptDate =
      new Date();

    /*
    =========================================================
    CALCULATE RECEIVED TOTAL
    =========================================================

    IMPORTANT:

    Total transaksi tetap memakai:

        receivedQty × purchase price

    karena keduanya masih menggunakan
    UNIT TRANSAKSI.

    Contoh:

        4.3 jerigen
        × Rp130.000 / jerigen

        = Rp559.000

    BUKAN:

        55.9 liter × Rp130.000
    */

    const receivedTotalRaw =
      purchase.items.reduce(
        (
          sum,
          item
        ) => {
          const receivedQty =
            receivedQtyMap.get(
              item.id
            );

          const price =
            Number(item.price);

          if (
            !Number.isFinite(
              receivedQty
            ) ||
            !Number.isFinite(
              price
            )
          ) {
            return sum;
          }

          return (
            sum +
            receivedQty *
              price
          );
        },
        0
      );

    const receivedTotal =
      roundMoney(
        receivedTotalRaw
      );

    if (
      !Number.isFinite(
        receivedTotal
      ) ||
      receivedTotal < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Total nilai barang yang diterima tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    =========================================================
    DUE DATE
    =========================================================
    */

    let dueDate:
      | Date
      | null = null;

    if (isTempo) {
      const tempoDays =
        Number(
          purchase.supplier
            .tempoDays ?? 0
        );

      if (
        !Number.isInteger(
          tempoDays
        ) ||
        tempoDays < 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Tempo Days supplier tidak valid.",
          },
          {
            status: 400,
          }
        );
      }

      dueDate =
        new Date(
          receiptDate
        );

      dueDate.setDate(
        dueDate.getDate() +
          tempoDays
      );
    }

    /*
    =========================================================
    TRANSACTION
    =========================================================
    */

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
          ===================================================
          RELOAD PURCHASE
          ===================================================
          */

          const currentPurchase =
            await tx.outletPurchase.findUnique(
              {
                where: {
                  id:
                    purchase.id,
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
              }
            );

          if (!currentPurchase) {
            throw new Error(
              "Purchase Outlet tidak ditemukan."
            );
          }

          /*
          ===================================================
          STATUS RECHECK
          ===================================================
          */

          if (
            currentPurchase.status !==
            "APPROVED"
          ) {
            throw new Error(
              currentPurchase.status ===
                "RECEIVED"
                ? "Purchase Outlet ini sudah pernah diterima."
                : "Purchase Outlet tidak lagi berstatus APPROVED."
            );
          }

          /*
          ===================================================
          OUTLET RECHECK
          ===================================================
          */

          if (
            String(user.role) ===
              "OUTLET_ADMIN" &&
            currentPurchase.outletId !==
              user.outletId
          ) {
            throw new Error(
              "Anda tidak memiliki akses ke Purchase Outlet ini."
            );
          }

          /*
          ===================================================
          ITEM RECHECK
          ===================================================
          */

          if (
            !currentPurchase.items ||
            currentPurchase.items.length ===
              0
          ) {
            throw new Error(
              "Purchase Outlet tidak memiliki item."
            );
          }

          /*
          ===================================================
          PAYMENT METHOD RECHECK
          ===================================================
          */

          const currentPaymentMethod =
            String(
              currentPurchase.paymentMethod
            )
              .trim()
              .toUpperCase();

          const currentIsTempo =
            currentPaymentMethod ===
            "TEMPO";

          /*
          ===================================================
          INVOICE RECHECK
          ===================================================
          */

          if (
            currentIsTempo &&
            !invoiceNumber
          ) {
            throw new Error(
              "No. Invoice Supplier wajib diisi untuk Purchase dengan pembayaran TEMPO."
            );
          }

          /*
          ===================================================
          EXISTING RECEIPT CHECK
          ===================================================
          */

          const existingReceipt =
            await tx.outletReceipt.findFirst(
              {
                where: {
                  purchaseId:
                    currentPurchase.id,
                },

                select: {
                  id: true,
                  number: true,
                },
              }
            );

          if (existingReceipt) {
            throw new Error(
              `Purchase Outlet ini sudah memiliki dokumen penerimaan ${existingReceipt.number}.`
            );
          }

          /*
          ===================================================
          DUPLICATE INVOICE CHECK
          ===================================================
          */

          if (invoiceNumber) {
            const duplicateReceipt =
              await tx.outletReceipt.findFirst(
                {
                  where: {
                    supplierId:
                      currentPurchase.supplierId,

                    invoiceNumber:
                      invoiceNumber,
                  },

                  select: {
                    id: true,
                    number: true,
                    purchaseId:
                      true,
                  },
                }
              );

            if (
              duplicateReceipt &&
              duplicateReceipt.purchaseId !==
                currentPurchase.id
            ) {
              throw new Error(
                `Invoice supplier "${invoiceNumber}" sudah digunakan pada penerimaan lain untuk supplier ini.`
              );
            }

            if (currentIsTempo) {
              const duplicatePayable =
                await tx.purchasePayable.findFirst(
                  {
                    where: {
                      supplierId:
                        currentPurchase.supplierId,

                      invoiceNumber:
                        invoiceNumber,
                    },

                    select: {
                      id: true,

                      outletPurchaseId:
                        true,
                    },
                  }
                );

              if (
                duplicatePayable &&
                duplicatePayable.outletPurchaseId !==
                  currentPurchase.id
              ) {
                throw new Error(
                  `Invoice supplier "${invoiceNumber}" sudah digunakan pada Purchase Payable lain untuk supplier ini.`
                );
              }
            }
          }

          /*
          ===================================================
          RECEIPT NUMBER
          ===================================================
          */

          const receiptNumber =
            `OR-${Date.now()}-${currentPurchase.id}`;

          /*
          ===================================================
          RECEIPT TOTAL RECHECK
          ===================================================
          */

          let currentReceivedTotalRaw =
            0;

          for (
            const item of
            currentPurchase.items
          ) {
            const receivedQty =
              receivedQtyMap.get(
                item.id
              );

            const price =
              Number(item.price);

            const finalReceivedQty =
              receivedQty ??
              normalizeQty(
                item.qty
              );

            if (
              !Number.isFinite(
                finalReceivedQty
              ) ||
              finalReceivedQty <= 0
            ) {
              throw new Error(
                `Qty diterima barang "${item.barang?.name ?? item.barangId}" tidak valid.`
              );
            }

            if (
              !Number.isFinite(
                price
              ) ||
              price < 0
            ) {
              throw new Error(
                `Harga barang "${item.barang?.name ?? item.barangId}" tidak valid.`
              );
            }

            currentReceivedTotalRaw +=
              finalReceivedQty *
              price;
          }

          const currentReceivedTotal =
            roundMoney(
              currentReceivedTotalRaw
            );

          if (
            !Number.isFinite(
              currentReceivedTotal
            ) ||
            currentReceivedTotal < 0
          ) {
            throw new Error(
              "Total nilai barang yang diterima tidak valid."
            );
          }

          /*
          ===================================================
          CREATE OUTLET RECEIPT
          ===================================================

          Receipt tetap menyimpan QTY TRANSAKSI.

          Contoh:

              4.3 jerigen

          Bukan:

              55.9 liter
          */

          const receipt =
            await tx.outletReceipt.create(
              {
                data: {
                  number:
                    receiptNumber,

                  purchaseId:
                    currentPurchase.id,

                  outletId:
                    currentPurchase.outletId,

                  supplierId:
                    currentPurchase.supplierId,

                  invoiceNumber:
                    invoiceNumber ||
                    null,

                  receiptDate,

                  remarks:
                    remarks ||
                    currentPurchase.remarks ||
                    null,

                  items: {
                    create:
                      currentPurchase.items.map(
                        (item) => {
                          const receivedQty =
                            receivedQtyMap.get(
                              item.id
                            );

                          const qty =
                            receivedQty ??
                            normalizeQty(
                              item.qty
                            );

                          if (
                            !Number.isFinite(
                              qty
                            ) ||
                            qty <= 0
                          ) {
                            throw new Error(
                              `Qty diterima barang "${item.barang?.name ?? item.barangId}" tidak valid.`
                            );
                          }

                          const price =
                            Number(
                              item.price
                            );

                          const subtotal =
                            roundMoney(
                              qty *
                                price
                            );

                          return {
                            barangId:
                              item.barangId,

                            /*
                             * TETAP UNIT TRANSAKSI
                             */
                            qty,

                            price,

                            subtotal,
                          };
                        }
                      ),
                  },
                },

                include: {
                  items: true,
                },
              }
            );

          /*
          ===================================================
          UPDATE OUTLET STOCK
          ===================================================

          IMPORTANT:

          receivedQty = UNIT TRANSAKSI

          OutletStock.stock = BASE UNIT

          Jadi:

              receivedQty
                  ↓
              toBaseQty()
                  ↓
              baseQty
                  ↓
              OutletStock.stock

          KONVERSI HANYA SEKALI DI SINI.
          ===================================================
          */

          for (
            const item of
            currentPurchase.items
          ) {
            const requestedReceivedQty =
              receivedQtyMap.get(
                item.id
              );

            const qty =
              requestedReceivedQty ??
              normalizeQty(
                item.qty
              );

            const price =
              Number(item.price);

            if (
              !Number.isFinite(
                qty
              ) ||
              qty <= 0
            ) {
              throw new Error(
                `Qty barang "${item.barang?.name ?? item.barangId}" tidak valid.`
              );
            }

            if (
              !Number.isFinite(
                price
              ) ||
              price < 0
            ) {
              throw new Error(
                `Harga barang "${item.barang?.name ?? item.barangId}" tidak valid.`
              );
            }

            if (!item.barang) {
              throw new Error(
                `Barang pada item Purchase ID ${item.id} tidak ditemukan.`
              );
            }

            /*
            -------------------------------------------------
            CONVERT PURCHASE UNIT → BASE UNIT
            -------------------------------------------------
            */

            const conversion =
              convertReceivedQtyToBase(
                qty,
                item.barang
              );

            const baseQty =
              conversion.baseQty;

            /*
            -------------------------------------------------
            BASE UNIT COST
            -------------------------------------------------

            price:
                harga / purchase unit

            baseUnitCost:
                harga / base unit
            */

            const baseUnitCost =
              calculateBaseUnitCost(
                price,
                item.barang
              );

            /*
            -------------------------------------------------
            FIND OUTLET STOCK
            -------------------------------------------------
            */

            const existingStock =
              await tx.outletStock.findUnique(
                {
                  where: {
                    outletId_barangId: {
                      outletId:
                        currentPurchase.outletId,

                      barangId:
                        item.barangId,
                    },
                  },
                }
              );

            /*
            -------------------------------------------------
            CREATE STOCK
            -------------------------------------------------
            */

            if (!existingStock) {
              await tx.outletStock.create(
                {
                  data: {
                    outletId:
                      currentPurchase.outletId,

                    barangId:
                      item.barangId,

                    /*
                    * STOCK SELALU BASE UNIT.
                    *
                    * Contoh:
                    *
                    * 4.3 jerigen
                    * × 13
                    * = 55.9 liter
                    */

                    stock:
                      baseQty,

                    minimumStock:
                      Number(
                        item.barang
                          .minimumStock ??
                          0
                      ),

                    /*
                    * averageCost = harga per BASE UNIT.
                    */

                    averageCost:
                      baseUnitCost,
                  },
                }
              );
            }

            /*
            -------------------------------------------------
            UPDATE EXISTING STOCK
            -------------------------------------------------
            */

            else {
              /*
              * IMPORTANT:
              *
              * existingStock.stock DIANGGAP SUDAH BASE UNIT.
              *
              * JANGAN:
              *
              * toBaseQty(existingStock.stock, barang)
              *
              * karena akan menyebabkan double conversion.
              */

              const oldStock =
                Number(
                  existingStock.stock
                ) || 0;

              const oldAverageCost =
                Number(
                  existingStock.averageCost
                ) || 0;

              if (
                !Number.isFinite(
                  oldStock
                ) ||
                oldStock < 0
              ) {
                throw new Error(
                  `Stock existing barang "${item.barang.name}" tidak valid.`
                );
              }

              if (
                !Number.isFinite(
                  oldAverageCost
                ) ||
                oldAverageCost < 0
              ) {
                throw new Error(
                  `Average cost existing barang "${item.barang.name}" tidak valid.`
                );
              }

              /*
              * Stock lama:
              *
              * BASE UNIT
              *
              * Stock baru:
              *
              * BASE UNIT
              */

              const newStock =
                safeRoundQty(
                  oldStock +
                    baseQty
                );

              /*
              * Weighted average cost
              * semuanya sudah menggunakan BASE UNIT.
              */

              const newAverageCost =
                newStock > 0
                  ? (
                      oldStock *
                        oldAverageCost +
                      baseQty *
                        baseUnitCost
                    ) /
                    newStock
                  : baseUnitCost;

              await tx.outletStock.update(
                {
                  where: {
                    id:
                      existingStock.id,
                  },

                  data: {
                    stock:
                      newStock,

                    averageCost:
                      roundMoney(
                        newAverageCost
                      ),
                  },
                }
              );
            }

            /*
            -------------------------------------------------
            UPDATE RECEIVED QTY
            -------------------------------------------------

            receivedQty tetap menyimpan
            UNIT TRANSAKSI.

            Contoh:

                4.3 jerigen

            BUKAN:

                55.9 liter
            */

            await tx.outletPurchaseItem.update(
              {
                where: {
                  id:
                    item.id,
                },

                data: {
                  receivedQty:
                    qty,
                },
              }
            );
          }

          /*
          ===================================================
          PURCHASE PAYABLE - TEMPO ONLY
          ===================================================
          */

          let payable =
            null;

          if (currentIsTempo) {
            /*
            =================================================
            FIND EXISTING PAYABLE
            =================================================
            */

            const existingPayable =
              await tx.purchasePayable.findUnique(
                {
                  where: {
                    outletPurchaseId:
                      currentPurchase.id,
                  },
                }
              );

            /*
            =================================================
            EXISTING PAYABLE
            =================================================
            */

            if (existingPayable) {
              if (
                existingPayable.supplierId !==
                currentPurchase.supplierId
              ) {
                throw new Error(
                  "Purchase Payable existing tidak sesuai dengan supplier Purchase Outlet ini."
                );
              }

              if (
                existingPayable.outletId !==
                currentPurchase.outletId
              ) {
                throw new Error(
                  "Purchase Payable existing tidak sesuai dengan outlet Purchase Outlet ini."
                );
              }

              const existingInvoice =
                cleanString(
                  existingPayable.invoiceNumber
                );

              if (
                existingInvoice &&
                invoiceNumber &&
                existingInvoice !==
                  invoiceNumber
              ) {
                throw new Error(
                  `Purchase Payable sudah menggunakan Invoice Supplier "${existingInvoice}", sedangkan invoice penerimaan adalah "${invoiceNumber}".`
                );
              }

              const finalInvoiceNumber =
                existingInvoice ||
                invoiceNumber;

              if (
                !finalInvoiceNumber
              ) {
                throw new Error(
                  "Purchase Payable TEMPO tidak memiliki Invoice Supplier."
                );
              }

              const existingAmount =
                roundMoney(
                  Number(
                    existingPayable.amount
                  )
                );

              const existingPaidAmount =
                roundMoney(
                  Number(
                    existingPayable.paidAmount
                  )
                );

              if (
                !Number.isFinite(
                  existingAmount
                ) ||
                existingAmount < 0
              ) {
                throw new Error(
                  "Nilai Purchase Payable existing tidak valid."
                );
              }

              if (
                !Number.isFinite(
                  existingPaidAmount
                ) ||
                existingPaidAmount < 0
              ) {
                throw new Error(
                  "Nilai pembayaran Purchase Payable existing tidak valid."
                );
              }

              /*
              * Payable menggunakan nilai transaksi:
              *
              * receivedQty × purchase price
              *
              * Bukan baseQty × purchase price.
              */

              const amountDifference =
                Math.abs(
                  existingAmount -
                    currentReceivedTotal
                );

              if (
                amountDifference >
                0.01
              ) {
                throw new Error(
                  `Purchase Payable sudah ada dengan nilai Rp${existingAmount.toLocaleString(
                    "id-ID"
                  )}, sedangkan nilai penerimaan adalah Rp${currentReceivedTotal.toLocaleString(
                    "id-ID"
                  )}. Silakan periksa Purchase Payable sebelum menerima barang.`
                );
              }

              const calculatedOutstanding =
                Math.max(
                  0,
                  roundMoney(
                    existingAmount -
                      existingPaidAmount
                  )
                );

              const payableStatus =
                calculatedOutstanding <=
                0.01
                  ? "PAID"
                  : "OUTSTANDING";

              payable =
                await tx.purchasePayable.update(
                  {
                    where: {
                      id:
                        existingPayable.id,
                    },

                    data: {
                      invoiceNumber:
                        finalInvoiceNumber,

                      invoiceDate:
                        existingPayable.invoiceDate ??
                        receiptDate,

                      dueDate:
                        existingPayable.dueDate ??
                        dueDate,

                      amount:
                        existingPayable.amount,

                      /*
                      * paidAmount TIDAK DIUBAH.
                      */

                      paidAmount:
                        existingPaidAmount,

                      outstanding:
                        calculatedOutstanding,

                      status:
                        payableStatus,
                    },
                  }
                );
            }

            /*
            =================================================
            CREATE PAYABLE BARU
            =================================================
            */

            else {
              payable =
                await tx.purchasePayable.create(
                  {
                    data: {
                      outletPurchaseId:
                        currentPurchase.id,

                      supplierId:
                        currentPurchase.supplierId,

                      outletId:
                        currentPurchase.outletId,

                      invoiceNumber:
                        invoiceNumber,

                      invoiceDate:
                        receiptDate,

                      dueDate,

                      /*
                      * Tetap nilai transaksi Purchase:
                      *
                      * receivedQty × purchase price
                      */

                      amount:
                        currentReceivedTotal,

                      paidAmount:
                        0,

                      outstanding:
                        currentReceivedTotal,

                      status:
                        "OUTSTANDING",
                    },
                  }
                );
            }
          }

          /*
          ===================================================
          UPDATE PURCHASE STATUS
          ===================================================
          */

          const updatedPurchase =
            await tx.outletPurchase.update(
              {
                where: {
                  id:
                    currentPurchase.id,
                },

                data: {
                  status:
                    "RECEIVED",
                },
              }
            );

          /*
          ===================================================
          RETURN TRANSACTION
          ===================================================
          */

          return {
            receipt,

            payable,

            purchase:
              updatedPurchase,

            paymentMethod:
              currentPaymentMethod,

            invoiceNumber:
              invoiceNumber ||
              null,

            receivedTotal:
              currentReceivedTotal,
          };
        }
      );

    /*
    =========================================================
    SUCCESS MESSAGE
    =========================================================
    */

    let successMessage =
      "Barang berhasil diterima.";

    if (result.payable) {
      successMessage =
        "Barang berhasil diterima dan Purchase Payable TEMPO berhasil dibuat.";
    } else if (
      result.invoiceNumber
    ) {
      successMessage =
        "Barang berhasil diterima dan Invoice Supplier berhasil disimpan.";
    }

    /*
    =========================================================
    SUCCESS RESPONSE
    =========================================================
    */

    return NextResponse.json({
      success: true,

      message:
        successMessage,

      data: {
        receipt:
          result.receipt,

        payable:
          result.payable,

        purchase:
          result.purchase,

        paymentMethod:
          result.paymentMethod,

        invoiceNumber:
          result.invoiceNumber,

        receivedTotal:
          result.receivedTotal,
      },
    });
  } catch (error: any) {
    /*
    =========================================================
    ERROR LOG
    =========================================================
    */

    console.error(
      "OUTLET BARANG MASUK RECEIVE ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat menerima barang.";

    /*
    =========================================================
    RESPONSE
    =========================================================
    */

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: 400,
      }
    );
  }
}