import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

import { OutletPurchaseStatus } from "@prisma/client";

import {
  toBaseQty,
  roundQty,
} from "@/lib/unit-conversion";

/*
=============================================================
POST /api/outlet/purchase/[id]/cancel
=============================================================

CANCEL OUTLET PURCHASE

ATURAN FINAL
-------------------------------------------------------------

HANYA ADMIN yang boleh melakukan cancellation.

MANAGER          -> 403
OUTLET_ADMIN     -> 403
GUDANG           -> 403
PURCHASING       -> 403
KASIR            -> 403
STAFF_OUTLET     -> 403

STATUS YANG BOLEH DICANCEL
-------------------------------------------------------------

RECEIVED
    ↓
CANCELLED

CANCELLED
    ↓
DITOLAK

DRAFT / APPROVED
    ↓
DITOLAK

Cancellation pada route ini khusus untuk Purchase yang
sudah RECEIVED karena sudah menyebabkan stock masuk.

=============================================================

RECEIVED CANCELLATION
=============================================================

NORMAL FLOW:

OutletReceiptItem.qty
        ↓
transaction unit
        ↓
toBaseQty()
        ↓
base unit
        ↓
OutletStock.stock dikurangi

LEGACY RECOVERY FLOW:

Jika data lama memiliki:

    PurchaseItem.receivedQty > 0
    ReceiptItem.qty          = 0

maka receivedQty digunakan sebagai fallback reversal.

Tujuannya untuk menangani data lama yang sudah RECEIVED
tetapi ReceiptItem.qty tersimpan 0.

Receipt:
    TIDAK DIHAPUS

ReceiptItem:
    TIDAK DIHAPUS

StockMutation:
    dibuat sebagai reversal

OutletPurchaseItem.receivedQty:
    0

PurchasePayable:
    unpaid  -> CANCELLED
    paid    -> cancellation DITOLAK

Payment:
    TIDAK DIHAPUS
    TIDAK DIRESET

Barang.stock CENTRAL:
    TIDAK DISENTUH

=============================================================

STOCK RULE
=============================================================

OutletStock.stock SELALU BASE UNIT.

OutletReceiptItem.qty SELALU UNIT TRANSAKSI.

Contoh:

    Receipt:
        4.3 jerigen

    Conversion:
        1 jerigen = 13 liter

    Reversal:
        4.3 × 13
        = 55.9 liter

Tidak boleh melakukan conversion kedua terhadap
OutletStock.stock.

=============================================================

DUPLICATE BARANG RULE
=============================================================

Satu barang dapat muncul lebih dari satu:

    Purchase Item
    Receipt
    Receipt Item

Karena itu cancellation TIDAK boleh melakukan:

    stockBefore - receiptItem.qty

per row secara independen.

Semua quantity harus diagregasi terlebih dahulu:

    total transaction qty
        ↓
    satu kali conversion
        ↓
    total base qty
        ↓
    satu kali stock reversal

=============================================================

LEGACY DATA RULE
=============================================================

Data lama mungkin memiliki kondisi:

    PurchaseItem.receivedQty = 4
    ReceiptItem.qty           = 0

Dalam kondisi tersebut:

    receivedQty Purchase
        ↓
    digunakan sebagai fallback reversal

Tetapi fallback HANYA digunakan apabila total Receipt
untuk barang tersebut benar-benar 0.

Jika Receipt qty > 0 tetapi berbeda dengan Purchase
receivedQty, cancellation tetap DITOLAK.

Contoh:

    Purchase received = 4
    Receipt qty       = 3

    -> DITOLAK

Contoh legacy:

    Purchase received = 4
    Receipt qty       = 0

    -> gunakan receivedQty = 4

Dengan demikian data yang benar tidak pernah ditimpa
oleh fallback legacy.

=============================================================

SAFETY
=============================================================

- Tidak delete Purchase.
- Tidak delete Receipt.
- Tidak delete ReceiptItem.
- Tidak delete StockMutation.
- Tidak delete Payment.
- Tidak reset database.
- Tidak menyentuh Barang.stock.
- Tidak menyentuh Purchase pusat.
- Stock tidak boleh menjadi negatif.
- Semua cancellation berada dalam satu transaction.
- Jika satu item gagal, seluruh transaction rollback.
=============================================================
*/

/*
=============================================================
CURRENT LOGIN USER
=============================================================
*/

async function getCurrentUser() {
  const cookieStore = await cookies();

  const session =
    cookieStore.get("erp-session") ||
    cookieStore.get("session");

  if (!session?.value) {
    return null;
  }

  /*
  -------------------------------------------------------------
  DATABASE SESSION
  -------------------------------------------------------------
  */

  try {
    const dbSession =
      await prisma.session.findUnique({
        where: {
          token: session.value,
        },

        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullname: true,
              role: true,
              active: true,
              outletId: true,

              outlet: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  active: true,
                },
              },
            },
          },
        },
      });

    if (dbSession) {
      if (
        dbSession.expiresAt <
        new Date()
      ) {
        return null;
      }

      if (!dbSession.user.active) {
        return null;
      }

      return dbSession.user;
    }
  } catch (error) {
    console.error(
      "DATABASE SESSION CHECK ERROR:",
      error
    );
  }

  /*
  -------------------------------------------------------------
  JSON SESSION FALLBACK
  -------------------------------------------------------------
  */

  let sessionData: any;

  try {
    sessionData =
      JSON.parse(session.value);
  } catch {
    return null;
  }

  const userId = Number(
    sessionData?.user?.id ??
      sessionData?.data?.user?.id ??
      sessionData?.data?.id ??
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

      select: {
        id: true,
        username: true,
        fullname: true,
        role: true,
        active: true,
        outletId: true,

        outlet: {
          select: {
            id: true,
            code: true,
            name: true,
            active: true,
          },
        },
      },
    });

  if (!user || !user.active) {
    return null;
  }

  return user;
}

/*
=============================================================
HELPERS
=============================================================
*/

function errorResponse(
  message: string,
  status = 400
) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
    }
  );
}

function cleanString(
  value: unknown
) {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value.trim();
}

function safeNumber(
  value: unknown
) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : NaN;
}

function safeRoundQty(
  value: number
) {
  if (
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return roundQty(value);
}

/*
=============================================================
CONVERT RECEIPT QTY → BASE UNIT
=============================================================

ReceiptItem.qty = transaction unit.

OutletStock.stock = base unit.

Jika:

    unit      = jerigen
    baseUnit  = liter
    rate      = 13

maka:

    4.3 jerigen
        ↓
    55.9 liter

Tetapi jika:

    unit      = liter
    baseUnit  = liter

maka:

    4.3 liter
        ↓
    4.3 liter

JANGAN mengalikan conversionRate ketika unit dan
baseUnit sama.
=============================================================
*/

function convertReceiptQtyToBase(
  transactionQty: number,
  barang: any
) {
  const unit =
    cleanString(
      barang?.unit
    );

  const baseUnit =
    cleanString(
      barang?.baseUnit
    );

  const conversionRate =
    safeNumber(
      barang?.conversionRate ?? 1
    );

  if (!unit) {
    throw new Error(
      `Unit barang "${barang?.name ?? barang?.id}" tidak tersedia.`
    );
  }

  if (!baseUnit) {
    throw new Error(
      `Base Unit barang "${barang?.name ?? barang?.id}" tidak tersedia.`
    );
  }

  if (
    !Number.isFinite(
      conversionRate
    ) ||
    conversionRate <= 0
  ) {
    throw new Error(
      `Conversion Rate barang "${barang?.name ?? barang?.id}" tidak valid.`
    );
  }

  if (
    unit.trim().toLowerCase() ===
    baseUnit.trim().toLowerCase()
  ) {
    return {
      baseQty:
        safeRoundQty(
          transactionQty
        ),

      unit,

      baseUnit,

      conversionRate: 1,

      converted: false,
    };
  }

  let baseQty: number;

  try {
    baseQty =
      toBaseQty(
        transactionQty,
        barang
      );
  } catch {
    throw new Error(
      `Qty Receipt barang "${barang?.name ?? barang?.id}" tidak dapat dikonversi dari ${unit} ke ${baseUnit}.`
    );
  }

  if (
    !Number.isFinite(
      baseQty
    ) ||
    baseQty <= 0
  ) {
    throw new Error(
      `Hasil konversi reversal barang "${barang?.name ?? barang?.id}" tidak valid.`
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
POST CANCEL
=============================================================
*/

export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    /*
    =========================================================
    1. CURRENT USER
    =========================================================
    */

    const user =
      await getCurrentUser();

    if (!user) {
      return errorResponse(
        "Belum login.",
        401
      );
    }

    if (!user.active) {
      return errorResponse(
        "User tidak aktif.",
        403
      );
    }

    /*
    =========================================================
    2. ROLE
    =========================================================
    */

    const role =
      String(
        user.role ?? ""
      )
        .trim()
        .toUpperCase();

    if (role !== "ADMIN") {
      return errorResponse(
        "Hanya ADMIN yang dapat membatalkan Purchase Outlet.",
        403
      );
    }

    /*
    =========================================================
    3. PARAMETER
    =========================================================
    */

    const { id } =
      await params;

    const rawId =
      String(id ?? "")
        .trim()
        .replace(
          /^PURCHASE-/i,
          ""
        );

    const purchaseId =
      Number(rawId);

    if (
      !Number.isInteger(
        purchaseId
      ) ||
      purchaseId <= 0
    ) {
      return errorResponse(
        "Purchase ID tidak valid.",
        400
      );
    }

    /*
    =========================================================
    4. OPTIONAL BODY
    =========================================================
    */

    let body: any = {};

    try {
      body =
        await req.json();
    } catch {
      body = {};
    }

    const cancelReason =
      cleanString(
        body?.reason ??
          body?.remarks ??
          body?.cancelReason
      );

    /*
    =========================================================
    5. TRANSACTION
    =========================================================
    */

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
          ===================================================
          LOAD PURCHASE
          ===================================================
          */

          const purchase =
            await tx.outletPurchase.findUnique(
              {
                where: {
                  id: purchaseId,
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

                  receipts: {
                    include: {
                      items: {
                        include: {
                          barang: true,
                        },

                        orderBy: {
                          id: "asc",
                        },
                      },
                    },

                    orderBy: {
                      id: "asc",
                    },
                  },

                  payable: true,
                },
              }
            );

          if (!purchase) {
            throw new Error(
              "Purchase Outlet tidak ditemukan."
            );
          }

          /*
          ===================================================
          6. OUTLET CHECK
          ===================================================
          */

          if (!purchase.outlet) {
            throw new Error(
              "Outlet Purchase tidak ditemukan."
            );
          }

          /*
          ===================================================
          7. STATUS CHECK
          ===================================================
          */

          const currentStatus =
            purchase.status;

          if (
            currentStatus ===
            OutletPurchaseStatus.CANCELLED
          ) {
            throw new Error(
              "Purchase Outlet ini sudah dibatalkan."
            );
          }

          if (
            currentStatus !==
            OutletPurchaseStatus.RECEIVED
          ) {
            throw new Error(
              `Purchase Outlet dengan status ${currentStatus} tidak dapat dibatalkan. Hanya Purchase RECEIVED yang dapat dibatalkan melalui proses ini.`
            );
          }

          /*
          ===================================================
          8. RECEIPT CHECK
          ===================================================
          */

          if (
            !purchase.receipts ||
            purchase.receipts.length === 0
          ) {
            throw new Error(
              "Purchase berstatus RECEIVED tetapi tidak memiliki Outlet Receipt. Cancellation dibatalkan demi keamanan."
            );
          }

          /*
          ===================================================
          9. PAYABLE CHECK
          ===================================================
          */

          const payable =
            purchase.payable;

          if (payable) {
            const paidAmount =
              safeNumber(
                payable.paidAmount
              );

            const amount =
              safeNumber(
                payable.amount
              );

            if (
              !Number.isFinite(
                paidAmount
              ) ||
              paidAmount < 0
            ) {
              throw new Error(
                "Paid Amount Purchase Payable tidak valid. Cancellation dibatalkan demi keamanan."
              );
            }

            if (
              !Number.isFinite(
                amount
              ) ||
              amount < 0
            ) {
              throw new Error(
                "Amount Purchase Payable tidak valid. Cancellation dibatalkan demi keamanan."
              );
            }

            if (
              paidAmount >
              0.01
            ) {
              throw new Error(
                `Purchase Outlet tidak dapat dibatalkan karena Purchase Payable sudah memiliki pembayaran sebesar Rp${paidAmount.toLocaleString(
                  "id-ID"
                )}. Lakukan reversal pembayaran terlebih dahulu.`
              );
            }
          }

          /*
          ===================================================
          10. FLATTEN RECEIPT ITEMS
          ===================================================
          */

          const receiptItems =
            purchase.receipts.flatMap(
              (receipt) =>
                receipt.items.map(
                  (item) => ({
                    receipt,
                    item,
                  })
                )
            );

          if (
            receiptItems.length === 0
          ) {
            throw new Error(
              "Outlet Receipt tidak memiliki item. Cancellation dibatalkan demi keamanan."
            );
          }

          /*
          ===================================================
          11. VALIDATE RECEIPT ITEMS
          ===================================================
          */

          const receiptQtyByBarang =
            new Map<
              number,
              number
            >();

          const receiptItemDetailsByBarang =
            new Map<
              number,
              {
                barang: any;
                transactionQty: number;
                receiptIds: number[];
                receiptNumbers: string[];
              }
            >();

          for (
            const {
              receipt,
              item,
            } of receiptItems
          ) {
            if (!item.barang) {
              throw new Error(
                `Barang ID ${item.barangId} pada Receipt ${receipt.number} tidak ditemukan.`
              );
            }

            /*
            -------------------------------------------------
            SOURCE MUST BE CENTRAL
            -------------------------------------------------
            */

            const source =
              String(
                item.barang.source ??
                  ""
              )
                .trim()
                .toUpperCase();

            if (
              source !==
              "CENTRAL"
            ) {
              throw new Error(
                `Barang "${item.barang.name}" bukan Barang Central. Cancellation dibatalkan demi keamanan.`
              );
            }

            /*
            -------------------------------------------------
            QTY
            -------------------------------------------------

            Untuk legacy data, qty 0 diperbolehkan masuk
            ke proses pembacaan.

            Jika seluruh Receipt qty 0, nanti quantity
            akan diambil dari PurchaseItem.receivedQty.
            -------------------------------------------------
            */

            const transactionQty =
              safeNumber(
                item.qty
              );

            if (
              !Number.isFinite(
                transactionQty
              ) ||
              transactionQty < 0
            ) {
              throw new Error(
                `Qty Receipt ${receipt.number} untuk barang "${item.barang.name}" tidak valid.`
              );
            }

            /*
            -------------------------------------------------
            BARANG UNIT VALIDATION
            -------------------------------------------------
            */

            const unit =
              cleanString(
                item.barang.unit
              );

            const baseUnit =
              cleanString(
                item.barang.baseUnit
              );

            const conversionRate =
              safeNumber(
                item.barang
                  .conversionRate ??
                  1
              );

            if (!unit) {
              throw new Error(
                `Unit barang "${item.barang.name}" tidak tersedia.`
              );
            }

            if (!baseUnit) {
              throw new Error(
                `Base Unit barang "${item.barang.name}" tidak tersedia. Cancellation stock dibatalkan demi keamanan.`
              );
            }

            if (
              !Number.isFinite(
                conversionRate
              ) ||
              conversionRate <= 0
            ) {
              throw new Error(
                `Conversion Rate barang "${item.barang.name}" tidak valid. Cancellation stock dibatalkan demi keamanan.`
              );
            }

            /*
            -------------------------------------------------
            AGGREGATE TRANSACTION QTY
            -------------------------------------------------
            */

            const currentQty =
              receiptQtyByBarang.get(
                item.barangId
              ) ?? 0;

            receiptQtyByBarang.set(
              item.barangId,
              currentQty +
                transactionQty
            );

            /*
            -------------------------------------------------
            TRACK RECEIPT SOURCES
            -------------------------------------------------
            */

            const existingDetail =
              receiptItemDetailsByBarang.get(
                item.barangId
              );

            if (
              existingDetail
            ) {
              existingDetail.transactionQty +=
                transactionQty;

              if (
                !existingDetail.receiptIds.includes(
                  receipt.id
                )
              ) {
                existingDetail.receiptIds.push(
                  receipt.id
                );
              }

              if (
                !existingDetail.receiptNumbers.includes(
                  receipt.number
                )
              ) {
                existingDetail.receiptNumbers.push(
                  receipt.number
                );
              }
            } else {
              receiptItemDetailsByBarang.set(
                item.barangId,
                {
                  barang:
                    item.barang,

                  transactionQty,

                  receiptIds: [
                    receipt.id,
                  ],

                  receiptNumbers: [
                    receipt.number,
                  ],
                }
              );
            }
          }

          /*
          ===================================================
          12. PURCHASE RECEIVED QTY
          ===================================================
          */

          const purchaseReceivedQtyByBarang =
            new Map<
              number,
              number
            >();

          const purchaseBarangById =
            new Map<
              number,
              any
            >();

          for (
            const purchaseItem of
              purchase.items
          ) {
            const receivedQty =
              safeNumber(
                purchaseItem.receivedQty
              );

            if (
              !Number.isFinite(
                receivedQty
              ) ||
              receivedQty < 0
            ) {
              throw new Error(
                `Received Qty Purchase Item ID ${purchaseItem.id} tidak valid.`
              );
            }

            purchaseBarangById.set(
              purchaseItem.barangId,
              purchaseItem.barang
            );

            const current =
              purchaseReceivedQtyByBarang.get(
                purchaseItem.barangId
              ) ?? 0;

            purchaseReceivedQtyByBarang.set(
              purchaseItem.barangId,
              current +
                receivedQty
            );
          }

          /*
          ===================================================
          13. DETERMINE REVERSAL QTY
          ===================================================

          NORMAL:

              Purchase received = 4
              Receipt qty       = 4

              reversal = 4

          LEGACY:

              Purchase received = 4
              Receipt qty       = 0

              reversal = 4

          INVALID:

              Purchase received = 4
              Receipt qty       = 3

              DITOLAK

          Jadi fallback legacy hanya aktif jika Receipt
          benar-benar tidak mencatat quantity.
          ===================================================
          */

          const reversalQtyByBarang =
            new Map<
              number,
              number
            >();

          const legacyRecoveryBarangIds =
            new Set<number>();

          const allBarangIds =
            new Set<number>([
              ...purchaseReceivedQtyByBarang.keys(),
              ...receiptQtyByBarang.keys(),
            ]);

          for (
            const barangId of
              allBarangIds
          ) {
            const purchaseReceivedQty =
              safeRoundQty(
                purchaseReceivedQtyByBarang.get(
                  barangId
                ) ?? 0
              );

            const receiptQty =
              safeRoundQty(
                receiptQtyByBarang.get(
                  barangId
                ) ?? 0
              );

            /*
            -------------------------------------------------
            RECEIPT QTY = 0, PURCHASE RECEIVED > 0
            -------------------------------------------------

            Ini adalah legacy recovery case.
            -------------------------------------------------
            */

            if (
              receiptQty <=
                0.000001 &&
              purchaseReceivedQty >
                0.000001
            ) {
              const barang =
                purchaseBarangById.get(
                  barangId
                );

              if (!barang) {
                throw new Error(
                  `Barang ID ${barangId} pada Purchase tidak ditemukan.`
                );
              }

              const source =
                String(
                  barang.source ??
                    ""
                )
                  .trim()
                  .toUpperCase();

              if (
                source !==
                "CENTRAL"
              ) {
                throw new Error(
                  `Barang "${barang.name}" bukan Barang Central. Cancellation dibatalkan demi keamanan.`
                );
              }

              reversalQtyByBarang.set(
                barangId,
                purchaseReceivedQty
              );

              legacyRecoveryBarangIds.add(
                barangId
              );

              continue;
            }

            /*
            -------------------------------------------------
            RECEIPT QTY > 0
            -------------------------------------------------
            */

            const difference =
              Math.abs(
                purchaseReceivedQty -
                  receiptQty
              );

            if (
              difference >
              0.000001
            ) {
              const barang =
                purchaseBarangById.get(
                  barangId
                ) ??
                receiptItemDetailsByBarang.get(
                  barangId
                )?.barang;

              throw new Error(
                `Data Purchase tidak konsisten untuk barang "${barang?.name ?? barangId}". Received Qty = ${purchaseReceivedQty}, sedangkan total Receipt Qty = ${receiptQty}. Cancellation dibatalkan demi keamanan.`
              );
            }

            if (
              receiptQty >
              0.000001
            ) {
              reversalQtyByBarang.set(
                barangId,
                receiptQty
              );
            }
          }

          /*
          ===================================================
          14. RECEIPT BARANG MUST EXIST IN PURCHASE
          ===================================================
          */

          const purchaseBarangIds =
            new Set(
              purchase.items.map(
                (item) =>
                  item.barangId
              )
            );

          for (
            const {
              receipt,
              item,
            } of receiptItems
          ) {
            if (
              !purchaseBarangIds.has(
                item.barangId
              )
            ) {
              throw new Error(
                `Barang "${item.barang?.name ?? item.barangId}" pada Receipt ${receipt.number} tidak terdapat pada Purchase Item. Cancellation dibatalkan demi keamanan.`
              );
            }
          }

          /*
          ===================================================
          15. PREPARE STOCK REVERSAL
          ===================================================
          */

          const reversedItems: Array<{
            barangId: number;
            barang: string;
            transactionQty: number;
            unit: string;
            baseUnit: string;
            conversionRate: number;
            reversedBaseQty: number;
            stockBefore: number;
            stockAfter: number;
            receiptNumbers: string[];
            legacyRecovery: boolean;
          }> = [];

          let totalReversedBaseQty =
            0;

          /*
          ---------------------------------------------------
          PROCESS UNIQUE BARANG
          ---------------------------------------------------
          */

          for (
            const barangId of
              reversalQtyByBarang.keys()
          ) {
            const transactionQty =
              safeRoundQty(
                reversalQtyByBarang.get(
                  barangId
                ) ?? 0
              );

            if (
              !Number.isFinite(
                transactionQty
              ) ||
              transactionQty <=
                0
            ) {
              continue;
            }

            const detail =
              receiptItemDetailsByBarang.get(
                barangId
              );

            const purchaseBarang =
              purchaseBarangById.get(
                barangId
              );

            const barang =
              detail?.barang ??
              purchaseBarang;

            if (!barang) {
              throw new Error(
                `Barang ID ${barangId} tidak ditemukan untuk proses reversal.`
              );
            }

            /*
            ===============================================
            CONVERT TRANSACTION UNIT → BASE UNIT
            ===============================================
            */

            const conversion =
              convertReceiptQtyToBase(
                transactionQty,
                barang
              );

            const baseQty =
              conversion.baseQty;

            if (
              !Number.isFinite(
                baseQty
              ) ||
              baseQty <= 0
            ) {
              throw new Error(
                `Hasil konversi reversal barang "${barang.name}" tidak valid.`
              );
            }

            /*
            ===============================================
            FIND OUTLET STOCK
            ===============================================
            */

            const outletStock =
              await tx.outletStock.findUnique(
                {
                  where: {
                    outletId_barangId: {
                      outletId:
                        purchase.outletId,

                      barangId,
                    },
                  },
                }
              );

            if (!outletStock) {
              throw new Error(
                `Stock outlet untuk barang "${barang.name}" tidak ditemukan. Cancellation dibatalkan agar stock tidak menjadi tidak konsisten.`
              );
            }

            /*
            ===============================================
            STOCK BEFORE
            ===============================================
            */

            const stockBefore =
              safeRoundQty(
                safeNumber(
                  outletStock.stock
                )
              );

            if (
              !Number.isFinite(
                stockBefore
              ) ||
              stockBefore < 0
            ) {
              throw new Error(
                `Stock outlet barang "${barang.name}" tidak valid.`
              );
            }

            /*
            ===============================================
            STOCK AFTER
            ===============================================
            */

            const rawStockAfter =
              stockBefore -
              baseQty;

            if (
              rawStockAfter <
              -0.000001
            ) {
              throw new Error(
                `Stock outlet barang "${barang.name}" tidak mencukupi untuk reversal. Stock saat ini ${stockBefore} ${conversion.baseUnit}, sedangkan reversal membutuhkan ${baseQty} ${conversion.baseUnit}. Cancellation dibatalkan dan tidak ada perubahan data.`
              );
            }

            const stockAfter =
              safeRoundQty(
                rawStockAfter < 0
                  ? 0
                  : rawStockAfter
              );

            /*
            ===============================================
            TRACK
            ===============================================
            */

            totalReversedBaseQty +=
              baseQty;

            reversedItems.push({
              barangId,

              barang:
                barang.name,

              transactionQty,

              unit:
                conversion.unit,

              baseUnit:
                conversion.baseUnit,

              conversionRate:
                conversion.conversionRate,

              reversedBaseQty:
                baseQty,

              stockBefore,

              stockAfter,

              receiptNumbers:
                detail?.receiptNumbers ??
                purchase.receipts.map(
                  (receipt) =>
                    receipt.number
                ),

              legacyRecovery:
                legacyRecoveryBarangIds.has(
                  barangId
                ),
            });
          }

          /*
          ===================================================
          16. STOCK UPDATE
          ===================================================
          */

          for (
            const item of
              reversedItems
          ) {
            const currentStock =
              await tx.outletStock.findUnique(
                {
                  where: {
                    outletId_barangId: {
                      outletId:
                        purchase.outletId,

                      barangId:
                        item.barangId,
                    },
                  },

                  select: {
                    id: true,
                    stock: true,
                  },
                }
              );

            if (!currentStock) {
              throw new Error(
                `Stock outlet untuk barang "${item.barang}" tidak ditemukan saat proses reversal.`
              );
            }

            const latestStock =
              safeRoundQty(
                safeNumber(
                  currentStock.stock
                )
              );

            if (
              !Number.isFinite(
                latestStock
              ) ||
              latestStock < 0
            ) {
              throw new Error(
                `Stock outlet barang "${item.barang}" tidak valid saat reversal.`
              );
            }

            if (
              latestStock <
              item.reversedBaseQty -
                0.000001
            ) {
              throw new Error(
                `Stock outlet barang "${item.barang}" berubah dan tidak lagi mencukupi untuk reversal. Cancellation dibatalkan.`
              );
            }

            const finalStockAfter =
              safeRoundQty(
                Math.max(
                  0,
                  latestStock -
                    item.reversedBaseQty
                )
              );

            await tx.outletStock.update(
              {
                where: {
                  id:
                    currentStock.id,
                },

                data: {
                  stock:
                    finalStockAfter,

                  ...(finalStockAfter <=
                  0.000001
                    ? {
                        averageCost: 0,
                      }
                    : {}),
                },
              }
            );

            /*
            ===============================================
            STOCK MUTATION
            ===============================================
            */

            const mutationDescription =
              item.legacyRecovery
                ? `Pembatalan Purchase Outlet ${purchase.number}. Legacy recovery: ReceiptItem qty tidak tercatat, sehingga reversal menggunakan Purchase receivedQty ${item.transactionQty} ${item.unit}. Reversal ${item.reversedBaseQty} ${item.baseUnit}.`
                : `Pembatalan penerimaan Purchase Outlet ${purchase.number}. Receipt: ${item.receiptNumbers.join(
                    ", "
                  )}. Reversal ${item.reversedBaseQty} ${item.baseUnit} dari ${item.transactionQty} ${item.unit}.`;

            await tx.stockMutation.create(
              {
                data: {
                  outletId:
                    purchase.outletId,

                  barangId:
                    item.barangId,

                  type:
                    "OUTLET_RECEIPT_CANCEL",

                  qty:
                    item.reversedBaseQty,

                  stockBefore:
                    latestStock,

                  stockAfter:
                    finalStockAfter,

                  reference:
                    item.receiptNumbers.join(
                      ", "
                    ),

                  description:
                    mutationDescription,
                },
              }
            );

            item.stockBefore =
              latestStock;

            item.stockAfter =
              finalStockAfter;
          }

          /*
          ===================================================
          17. RESET RECEIVED QTY
          ===================================================
          */

          for (
            const item of
              purchase.items
          ) {
            const currentReceived =
              safeNumber(
                item.receivedQty
              );

            if (
              !Number.isFinite(
                currentReceived
              ) ||
              currentReceived < 0
            ) {
              throw new Error(
                `Received Qty Purchase Item ID ${item.id} tidak valid.`
              );
            }

            if (
              Math.abs(
                currentReceived
              ) >
              0.000001
            ) {
              await tx.outletPurchaseItem.update(
                {
                  where: {
                    id:
                      item.id,
                  },

                  data: {
                    receivedQty:
                      0,
                  },
                }
              );
            }
          }

          /*
          ===================================================
          18. CANCEL PAYABLE
          ===================================================
          */

          let cancelledPayable =
            null;

          if (payable) {
            const paidAmount =
              safeNumber(
                payable.paidAmount
              );

            if (
              !Number.isFinite(
                paidAmount
              ) ||
              paidAmount < 0
            ) {
              throw new Error(
                "Paid Amount Purchase Payable tidak valid."
              );
            }

            if (
              paidAmount >
              0.01
            ) {
              throw new Error(
                "Purchase Payable sudah memiliki pembayaran. Cancellation tidak dapat dilanjutkan."
              );
            }

            cancelledPayable =
              await tx.purchasePayable.update(
                {
                  where: {
                    id:
                      payable.id,
                  },

                  data: {
                    outstanding:
                      0,

                    status:
                      "CANCELLED",

                    paidAmount:
                      paidAmount,
                  },
                }
              );
          }

          /*
          ===================================================
          19. UPDATE PURCHASE STATUS
          ===================================================
          */

          const updatedPurchase =
            await tx.outletPurchase.update(
              {
                where: {
                  id:
                    purchase.id,
                },

                data: {
                  status:
                    OutletPurchaseStatus.CANCELLED,
                },
              }
            );

          /*
          ===================================================
          20. HISTORY
          ===================================================
          */

          const receiptNumbers =
            purchase.receipts.map(
              (receipt) =>
                receipt.number
            );

          const receiptText =
            receiptNumbers.join(
              ", "
            );

          const legacyItems =
            reversedItems.filter(
              (item) =>
                item.legacyRecovery
            );

          const legacyText =
            legacyItems.length > 0
              ? ` Legacy recovery digunakan untuk ${legacyItems
                  .map(
                    (item) =>
                      `${item.barang} (${item.transactionQty} ${item.unit})`
                  )
                  .join(", ")} karena ReceiptItem qty tersimpan 0.`
              : "";

          const reasonText =
            cancelReason
              ? ` Alasan: ${cancelReason}`
              : "";

          await tx.history.create({
            data: {
              transactionType:
                "PURCHASE_CANCEL",

              referenceNumber:
                purchase.number,

              description:
                `Membatalkan Purchase Outlet ${purchase.number} yang sebelumnya RECEIVED. Receipt: ${receiptText}. Total reversal stock ${safeRoundQty(
                  totalReversedBaseQty
                )} Base Unit.${legacyText}${reasonText}`,

              userId:
                user.id,
            },
          });

          /*
          ===================================================
          21. RETURN
          ===================================================
          */

          return {
            purchase:
              updatedPurchase,

            wasReceived:
              true,

            reversedItems,

            totalReversedBaseQty:
              safeRoundQty(
                totalReversedBaseQty
              ),

            payable:
              cancelledPayable,

            receiptNumbers,

            reason:
              cancelReason ||
              null,

            legacyRecoveryUsed:
              legacyItems.length >
              0,
          };
        },
        {
          maxWait: 10000,
          timeout: 30000,
        }
      );

    /*
    =========================================================
    SUCCESS RESPONSE
    =========================================================
    */

    return NextResponse.json({
      success: true,

      message:
        result.legacyRecoveryUsed
          ? "Purchase Outlet berhasil dibatalkan dan stock outlet berhasil direversal menggunakan recovery data penerimaan lama."
          : "Purchase Outlet berhasil dibatalkan dan stock outlet berhasil direversal.",

      data: {
        purchase:
          result.purchase,

        wasReceived:
          result.wasReceived,

        receiptNumbers:
          result.receiptNumbers,

        reversedItems:
          result.reversedItems,

        totalReversedBaseQty:
          result.totalReversedBaseQty,

        payable:
          result.payable,

        reason:
          result.reason,

        legacyRecoveryUsed:
          result.legacyRecoveryUsed,
      },
    });
  } catch (error: any) {
    /*
    =========================================================
    ERROR LOG
    =========================================================
    */

    console.error(
      "CANCEL OUTLET PURCHASE ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Gagal membatalkan Purchase Outlet.";

    /*
    =========================================================
    STATUS RESPONSE
    =========================================================
    */

    let status = 400;

    if (
      message.includes(
        "tidak ditemukan"
      )
    ) {
      status = 404;
    }

    if (
      message.includes(
        "Hanya ADMIN"
      ) ||
      message.includes(
        "tidak memiliki akses"
      ) ||
      message.includes(
        "User tidak aktif"
      )
    ) {
      status = 403;
    }

    if (
      message.includes(
        "Belum login"
      )
    ) {
      status = 401;
    }

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status,
      }
    );
  }
}