import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// =====================================================
// CURRENT LOGIN USER
// =====================================================

async function getCurrentUser() {
  const { cookies } = await import("next/headers");

  const cookieStore = await cookies();

  const session = cookieStore.get("erp-session");

  if (!session) {
    return null;
  }

  let sessionData: any;

  try {
    sessionData = JSON.parse(session.value);
  } catch {
    return null;
  }

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

  return await prisma.user.findUnique({
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
}

// =====================================================
// RESPONSE ERROR
// =====================================================

function jsonError(
  message: string,
  status: number
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

// =====================================================
// NUMBER HELPERS
// =====================================================

function roundMoney(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return (
    Math.round(
      (value + Number.EPSILON) * 100
    ) / 100
  );
}

function roundQty(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return (
    Math.round(
      (value + Number.EPSILON) * 1000000
    ) / 1000000
  );
}

// =====================================================
// PARSE SOURCE KEY
//
// PURCHASE-123
// TRANSFER-28
//
// Backward compatibility:
//
// 123
// 28
//
// Numeric:
// PURCHASE dahulu
// lalu TRANSFER
// =====================================================

function parseSourceKey(rawId: string) {
  const value = String(rawId || "")
    .trim()
    .toUpperCase();

  if (!value) {
    return null;
  }

  // ===================================================
  // PURCHASE-123
  // ===================================================

  if (
    value.startsWith("PURCHASE-")
  ) {
    const idText = value.substring(
      "PURCHASE-".length
    );

    const id = Number(idText);

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return null;
    }

    return {
      source: "PURCHASE" as const,
      id,
      sourceKey: `PURCHASE-${id}`,
    };
  }

  // ===================================================
  // TRANSFER-123
  // ===================================================

  if (
    value.startsWith("TRANSFER-")
  ) {
    const idText = value.substring(
      "TRANSFER-".length
    );

    const id = Number(idText);

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return null;
    }

    return {
      source: "TRANSFER" as const,
      id,
      sourceKey: `TRANSFER-${id}`,
    };
  }

  // ===================================================
  // NUMERIC
  // ===================================================

  const numericId = Number(value);

  if (
    Number.isInteger(numericId) &&
    numericId > 0
  ) {
    return {
      source: "NUMERIC" as const,
      id: numericId,
      sourceKey: String(numericId),
    };
  }

  return null;
}

// =====================================================
// VALIDATE PURCHASE ITEMS
// =====================================================

function validatePurchaseItems(
  items: any[]
) {
  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return "Purchase Order tidak memiliki barang";
  }

  for (const item of items) {
    // =================================================
    // BARANG
    // =================================================

    if (!item.barang) {
      return `Barang ID ${item.barangId} tidak ditemukan`;
    }

    // =================================================
    // MASTER BARANG
    // =================================================

    if (
      item.barang.source !==
      "CENTRAL"
    ) {
      return `Barang ${item.barang.name} bukan berasal dari Master Barang Pusat`;
    }

    // =================================================
    // QTY
    // =================================================

    const qty = Number(
      item.qty ?? 0
    );

    if (
      !Number.isFinite(qty) ||
      qty <= 0
    ) {
      return `Qty barang ${item.barang.name} tidak valid`;
    }

    // =================================================
    // RECEIVED QTY
    // =================================================

    const receivedQty = Number(
      item.receivedQty ?? 0
    );

    if (
      !Number.isFinite(receivedQty) ||
      receivedQty < 0
    ) {
      return `Received qty barang ${item.barang.name} tidak valid`;
    }

    if (
      receivedQty > qty
    ) {
      return `Received qty barang ${item.barang.name} melebihi qty purchase`;
    }
  }

  return null;
}

// =====================================================
// VALIDATE TRANSFER ITEMS
//
// ITEM VOID TETAP DIAMBIL.
// Jangan filter voided:false.
// =====================================================

function validateTransferItems(
  items: any[]
) {
  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return "Kiriman gudang tidak memiliki barang";
  }

  for (const item of items) {
    // =================================================
    // BARANG
    // =================================================

    if (!item.barang) {
      return `Barang ID ${item.barangId} tidak ditemukan`;
    }

    // =================================================
    // MASTER BARANG
    // =================================================

    if (
      item.barang.source !==
      "CENTRAL"
    ) {
      return `Barang ${item.barang.name} bukan berasal dari Master Barang Pusat`;
    }

    // =================================================
    // QTY
    // =================================================

    const qty = Number(
      item.qty ?? 0
    );

    if (
      !Number.isFinite(qty) ||
      qty <= 0
    ) {
      return `Qty barang ${item.barang.name} tidak valid`;
    }

    // =================================================
    // RECEIVED QTY
    // =================================================

    const receivedQty = Number(
      item.receivedQty ?? 0
    );

    if (
      !Number.isFinite(receivedQty) ||
      receivedQty < 0
    ) {
      return `Received qty barang ${item.barang.name} tidak valid`;
    }

    if (
      receivedQty > qty
    ) {
      return `Received qty barang ${item.barang.name} melebihi qty transfer`;
    }
  }

  return null;
}

// =====================================================
// BUILD PURCHASE RESPONSE
// =====================================================

function buildPurchaseItems(
  purchaseItems: any[]
) {
  return purchaseItems.map(
    (item) => {
      const qty = roundQty(
        Number(item.qty ?? 0)
      );

      const receivedQty = roundQty(
        Number(
          item.receivedQty ?? 0
        )
      );

      const price = roundMoney(
        Number(item.price ?? 0)
      );

      const storedSubtotal =
        Number(item.subtotal ?? 0);

      const calculatedSubtotal =
        roundMoney(
          qty * price
        );

      const subtotal =
        Number.isFinite(
          storedSubtotal
        ) &&
        storedSubtotal >= 0
          ? roundMoney(
              storedSubtotal
            )
          : calculatedSubtotal;

      return {
        id: item.id,

        barangId:
          item.barangId,

        qty,

        receivedQty,

        remainingQty:
          roundQty(
            Math.max(
              qty - receivedQty,
              0
            )
          ),

        price,

        subtotal,

        barang:
          item.barang,

        itemStatus:
          receivedQty >= qty
            ? "RECEIVED"
            : receivedQty > 0
              ? "PARTIAL"
              : "PENDING",

        isReceived:
          receivedQty >= qty,

        isPartial:
          receivedQty > 0 &&
          receivedQty < qty,
      };
    }
  );
}

// =====================================================
// BUILD TRANSFER RESPONSE
//
// ITEM VOID TETAP DIKIRIM KE FRONTEND.
// =====================================================

function buildTransferItems(
  transferItems: any[]
) {
  return transferItems.map(
    (item) => {
      const qty = roundQty(
        Number(item.qty ?? 0)
      );

      const receivedQty = roundQty(
        Number(
          item.receivedQty ?? 0
        )
      );

      const price = roundMoney(
        Number(
          item.barang
            ?.purchasePrice ??
            0
        )
      );

      const subtotal = roundMoney(
        qty * price
      );

      const receivedSubtotal =
        roundMoney(
          receivedQty * price
        );

      const voided =
        Boolean(item.voided);

      return {
        id: item.id,

        barangId:
          item.barangId,

        qty,

        receivedQty,

        remainingQty:
          roundQty(
            Math.max(
              qty -
                (
                  voided
                    ? 0
                    : receivedQty
                ),
              0
            )
          ),

        price,

        subtotal,

        receivedSubtotal,

        barang:
          item.barang,

        // =================================================
        // VOID DATA
        // =================================================

        voided,

        isVoided:
          voided,

        voidedAt:
          item.voidedAt ??
          null,

        voidedById:
          item.voidedById ??
          null,

        voidReason:
          item.voidReason ??
          null,

        // =================================================
        // ITEM STATUS
        // =================================================

        itemStatus:
          voided
            ? "VOID"
            : receivedQty >= qty
              ? "RECEIVED"
              : receivedQty > 0
                ? "PARTIAL"
                : "PENDING",

        isReceived:
          !voided &&
          receivedQty >= qty,

        isPartial:
          !voided &&
          receivedQty > 0 &&
          receivedQty < qty,
      };
    }
  );
}

// =====================================================
// GET DETAIL OUTLET BARANG MASUK
//
// Supported:
//
// PURCHASE-{id}
// TRANSFER-{id}
// {id}
//
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
    // 1. CURRENT USER
    // =================================================

    const user =
      await getCurrentUser();

    if (!user) {
      return jsonError(
        "Tidak login",
        401
      );
    }

    // =================================================
    // 2. USER ACTIVE
    // =================================================

    if (!user.active) {
      return jsonError(
        "User tidak aktif",
        403
      );
    }

    // =================================================
    // 3. ROLE
    // =================================================

    const role =
      String(
        user.role || ""
      ).toUpperCase();

    if (
      role !== "ADMIN" &&
      role !== "MANAGER" &&
      role !== "OUTLET_ADMIN"
    ) {
      return jsonError(
        "Tidak memiliki akses melihat detail barang masuk outlet",
        403
      );
    }

    // =================================================
    // 4. PARAMETER
    // =================================================

    const params =
      await context.params;

    const rawId = String(
      params?.id || ""
    ).trim();

    if (!rawId) {
      return jsonError(
        "ID barang masuk tidak valid",
        400
      );
    }

    // =================================================
    // 5. PARSE SOURCE KEY
    // =================================================

    const parsed =
      parseSourceKey(rawId);

    if (!parsed) {
      return jsonError(
        "ID barang masuk tidak valid",
        400
      );
    }

    // =================================================
    // 6. SECURITY OUTLET
    //
    // ADMIN / MANAGER
    // -> semua outlet
    //
    // OUTLET_ADMIN
    // -> outlet sendiri
    // =================================================

    let outletFilter:
      | {
          outletId: number;
        }
      | Record<string, never> = {};

    if (
      role ===
      "OUTLET_ADMIN"
    ) {
      if (
        !user.outletId ||
        !Number.isInteger(
          user.outletId
        ) ||
        user.outletId <= 0
      ) {
        return jsonError(
          "User outlet belum terhubung dengan outlet",
          400
        );
      }

      outletFilter = {
        outletId:
          user.outletId,
      };
    }

    // =====================================================
    // INTERNAL FUNCTION:
    // GET PURCHASE
    // =====================================================

    async function getPurchase(
      purchaseId: number
    ) {
      return await prisma.outletPurchase.findFirst(
        {
          where: {
            id: purchaseId,
            ...outletFilter,
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

            supplier: {
              select: {
                id: true,
                code: true,
                name: true,
                tempoDays: true,
              },
            },

            items: {
              include: {
                barang: true,
              },
            },

            // =================================================
            // PENTING:
            // Payable hanya dibaca.
            //
            // Tidak membuat / mengubah hutang di GET.
            // =================================================

            payable: true,

            // =================================================
            // RECEIPT
            //
            // invoiceNumber WAJIB ikut diambil.
            //
            // Invoice supplier disimpan di:
            // OutletReceipt.invoiceNumber
            //
            // BUKAN:
            // OutletReceipt.number
            // =================================================

            receipts: {
              select: {
                id: true,
                number: true,
                receiptDate: true,

                // =============================================
                // INVOICE SUPPLIER
                // =============================================

                invoiceNumber: true,

                remarks: true,
                createdAt: true,
              },

              orderBy: {
                receiptDate: "desc",
              },
            },
          },
        }
      );
    }

    // =====================================================
    // INTERNAL FUNCTION:
    // GET TRANSFER
    // =====================================================

    async function getTransfer(
      transferId: number
    ) {
      return await prisma.outletTransfer.findFirst(
        {
          where: {
            id: transferId,
            ...outletFilter,
          },

          include: {
            sourceOutlet: {
              select: {
                id: true,
                code: true,
                name: true,
                active: true,
              },
            },

            outlet: {
              select: {
                id: true,
                code: true,
                name: true,
                active: true,
              },
            },

            // =================================================
            // JANGAN FILTER voided:false
            //
            // ITEM VOID HARUS TETAP TERLIHAT
            // =================================================

            items: {
              include: {
                barang: true,
              },
            },
          },
        }
      );
    }

    // =====================================================
    // INTERNAL FUNCTION:
    // BUILD PURCHASE RESPONSE
    // =====================================================

    function createPurchaseResponse(
      purchase: any
    ) {
      if (!purchase.outlet) {
        return {
          error: jsonError(
            "Outlet tujuan tidak ditemukan",
            404
          ),
        };
      }

      if (
        !purchase.outlet.active
      ) {
        return {
          error: jsonError(
            "Outlet tujuan tidak aktif",
            400
          ),
        };
      }

      const validationError =
        validatePurchaseItems(
          purchase.items
        );

      if (validationError) {
        return {
          error: jsonError(
            validationError,
            400
          ),
        };
      }

      const items =
        buildPurchaseItems(
          purchase.items
        );

      // =================================================
      // TOTAL QTY
      // =================================================

      const totalQty =
        roundQty(
          items.reduce(
            (
              total,
              item
            ) =>
              total +
              item.qty,
            0
          )
        );

      // =================================================
      // TOTAL RECEIVED
      // =================================================

      const totalReceivedQty =
        roundQty(
          items.reduce(
            (
              total,
              item
            ) =>
              total +
              item.receivedQty,
            0
          )
        );

      // =================================================
      // TOTAL REMAINING
      // =================================================

      const totalRemainingQty =
        roundQty(
          Math.max(
            totalQty -
              totalReceivedQty,
            0
          )
        );

      // =================================================
      // TOTAL VALUE
      // =================================================

      const totalValue =
        roundMoney(
          items.reduce(
            (
              total,
              item
            ) =>
              total +
              item.subtotal,
            0
          )
        );

      // =================================================
      // PAYMENT METHOD
      // =================================================

      const paymentMethod =
        String(
          purchase.paymentMethod ||
            "CASH"
        ).toUpperCase();

      const isTempo =
        paymentMethod ===
        "TEMPO";

      // =================================================
      // PAYABLE
      //
      // Hanya informasi hutang.
      //
      // Tidak semua metode pembayaran memiliki payable.
      // =================================================

      const payable =
        purchase.payable
          ? {
              id:
                purchase.payable.id,

              invoiceNumber:
                purchase.payable
                  .invoiceNumber,

              invoiceDate:
                purchase.payable
                  .invoiceDate,

              dueDate:
                purchase.payable
                  .dueDate ??
                null,

              amount:
                roundMoney(
                  Number(
                    purchase.payable
                      .amount ?? 0
                  )
                ),

              paidAmount:
                roundMoney(
                  Number(
                    purchase.payable
                      .paidAmount ??
                      0
                  )
                ),

              outstanding:
                roundMoney(
                  Number(
                    purchase.payable
                      .outstanding ??
                      0
                  )
                ),

              status:
                purchase.payable
                  .status,

              supplierId:
                purchase.payable
                  .supplierId,

              outletId:
                purchase.payable
                  .outletId ??
                null,
            }
          : null;

      // =================================================
      // RECEIPTS
      //
      // invoiceNumber sekarang ikut dikirim.
      //
      // Receipt number berbeda dengan invoice supplier.
      // =================================================

      const receipts =
        Array.isArray(
          purchase.receipts
        )
          ? purchase.receipts.map(
              (receipt: any) => ({
                id:
                  receipt.id,

                number:
                  receipt.number,

                receiptDate:
                  receipt.receiptDate,

                // ===========================================
                // INVOICE SUPPLIER
                // ===========================================

                invoiceNumber:
                  receipt.invoiceNumber ??
                  null,

                remarks:
                  receipt.remarks ??
                  null,

                createdAt:
                  receipt.createdAt,
              })
            )
          : [];

      // =================================================
      // CARI RECEIPT TERBARU YANG MEMILIKI INVOICE
      //
      // Diprioritaskan daripada payable karena invoice
      // transaksi penerimaan memang disimpan di receipt.
      // =================================================

      const invoiceReceipt =
        receipts.find(
          (receipt: any) =>
            String(
              receipt.invoiceNumber ??
                ""
            ).trim() !== ""
        ) ?? null;

      // =================================================
      // NORMALIZE INVOICE NUMBER
      // =================================================

      const receiptInvoiceNumber =
        invoiceReceipt?.invoiceNumber
          ? String(
              invoiceReceipt.invoiceNumber
            ).trim()
          : null;

      const payableInvoiceNumber =
        payable?.invoiceNumber
          ? String(
              payable.invoiceNumber
            ).trim()
          : null;

      // =================================================
      // INVOICE NUMBER
      //
      // PRIORITY:
      //
      // 1. OutletReceipt.invoiceNumber
      // 2. PurchasePayable.invoiceNumber
      //
      // Fallback payable penting untuk transaksi lama.
      // =================================================

      const invoiceNumber =
        receiptInvoiceNumber ||
        payableInvoiceNumber ||
        null;

      // =================================================
      // SUPPLIER INVOICE
      //
      // SEMUA PAYMENT METHOD:
      //
      // CASH
      // TRANSFER
      // COD
      // CBD
      // TEMPO
      //
      // Invoice optional di level GET.
      //
      // Validasi WAJIB untuk TEMPO dilakukan di API
      // yang melakukan proses penerimaan.
      // =================================================

      const supplierInvoice =
        invoiceNumber
          ? {
              invoiceNumber,

              // =============================================
              // INVOICE DATE
              //
              // OutletReceipt belum memiliki invoiceDate.
              //
              // Jadi:
              // - jika invoice berasal dari payable,
              //   gunakan payable.invoiceDate
              // - jika hanya berasal dari receipt,
              //   null
              // =============================================

              invoiceDate:
                payableInvoiceNumber ===
                invoiceNumber
                  ? payable?.invoiceDate ??
                    null
                  : null,

              // =============================================
              // DUE DATE
              //
              // Hanya relevan untuk TEMPO.
              // =============================================

              dueDate:
                isTempo
                  ? payable?.dueDate ??
                    null
                  : null,

              // =============================================
              // TEMPO DAYS
              // =============================================

              tempoDays:
                isTempo
                  ? (
                      purchase
                        .supplier
                        ?.tempoDays ??
                      null
                    )
                  : null,

              // =============================================
              // FINANCIAL
              //
              // Hanya ada jika payable tersedia.
              // =============================================

              amount:
                isTempo &&
                payable
                  ? payable.amount
                  : null,

              paidAmount:
                isTempo &&
                payable
                  ? payable.paidAmount
                  : null,

              outstanding:
                isTempo &&
                payable
                  ? payable.outstanding
                  : null,

              status:
                isTempo &&
                payable
                  ? payable.status
                  : null,

              // =============================================
              // RECEIPT REFERENCE
              // =============================================

              receiptId:
                invoiceReceipt?.id ??
                null,

              receiptNumber:
                invoiceReceipt?.number ??
                null,

              receiptDate:
                invoiceReceipt?.receiptDate ??
                null,
            }
          : null;

      // =================================================
      // ALREADY RECEIVED
      // =================================================

      const alreadyReceived =
        totalReceivedQty > 0 ||
        purchase.status ===
          "RECEIVED";

      // =================================================
      // RESPONSE
      // =================================================

      return {
        data: {
          id:
            purchase.id,

          sourceId:
            purchase.id,

          sourceKey:
            `PURCHASE-${purchase.id}`,

          sumber:
            "PURCHASE",

          nomor:
            purchase.number,

          tanggal:
            purchase.purchaseDate,

          status:
            purchase.status,

          remarks:
            purchase.remarks ??
            null,

          // =================================================
          // OUTLET
          // =================================================

          outlet: {
            id:
              purchase.outlet.id,

            code:
              purchase.outlet.code,

            name:
              purchase.outlet.name,
          },

          // =================================================
          // SUPPLIER
          // =================================================

          supplier:
            purchase.supplier
              ? {
                  id:
                    purchase
                      .supplier.id,

                  code:
                    purchase
                      .supplier.code,

                  name:
                    purchase
                      .supplier.name,

                  tempoDays:
                    purchase
                      .supplier
                      .tempoDays ??
                    null,
                }
              : null,

          sourceOutlet:
            null,

          // =================================================
          // PURCHASE DETAIL
          // =================================================

          purchase: {
            id:
              purchase.id,

            number:
              purchase.number,

            status:
              purchase.status,

            purchaseDate:
              purchase.purchaseDate,

            remarks:
              purchase.remarks ??
              null,

            paymentMethod,

            isTempo,

            alreadyReceived,

            // ===============================================
            // SUPPLIER INVOICE
            // ===============================================

            invoiceNumber,

            invoiceDate:
              supplierInvoice
                ?.invoiceDate ??
              null,

            dueDate:
              supplierInvoice
                ?.dueDate ??
              null,

            tempoDays:
              supplierInvoice
                ?.tempoDays ??
              (
                isTempo
                  ? (
                      purchase
                        .supplier
                        ?.tempoDays ??
                      null
                    )
                  : null
              ),

            // ===============================================
            // PAYABLE
            // ===============================================

            payable,

            supplierInvoice,

            // ===============================================
            // RECEIPTS
            // ===============================================

            receipts,

            receiptCount:
              receipts.length,
          },

          transfer:
            null,

          // =================================================
          // ITEMS
          // =================================================

          items,

          // =================================================
          // TOTAL
          // =================================================

          totalQty,

          totalReceivedQty,

          totalRemainingQty,

          totalValue,

          // =================================================
          // STATUS FLAGS
          // =================================================

          isFullyReceived:
            totalReceivedQty >=
              totalQty &&
            totalQty > 0,

          isPartiallyReceived:
            totalReceivedQty > 0 &&
            totalReceivedQty <
              totalQty,

          isPending:
            totalReceivedQty ===
            0,

          // =================================================
          // FINANCIAL
          // =================================================

          paymentMethod,

          isTempo,

          payable,

          supplierInvoice,

          // =================================================
          // RECEIVING
          // =================================================

          receiving: {
            alreadyReceived,

            receiptCount:
              receipts.length,

            lastReceipt:
              receipts.length > 0
                ? receipts[0]
                : null,

            // =============================================
            // INVOICE TERAKHIR
            // =============================================

            invoiceNumber,

            invoiceReceipt:
              invoiceReceipt
                ? {
                    id:
                      invoiceReceipt.id,

                    number:
                      invoiceReceipt.number,

                    invoiceNumber:
                      invoiceReceipt
                        .invoiceNumber,

                    receiptDate:
                      invoiceReceipt
                        .receiptDate,

                    remarks:
                      invoiceReceipt
                        .remarks ??
                      null,

                    createdAt:
                      invoiceReceipt
                        .createdAt,
                  }
                : null,
          },
        },
      };
    }

    // =====================================================
    // INTERNAL FUNCTION:
    // BUILD TRANSFER RESPONSE
    // =====================================================

    function createTransferResponse(
      transfer: any
    ) {
      if (!transfer.outlet) {
        return {
          error: jsonError(
            "Outlet tujuan tidak ditemukan",
            404
          ),
        };
      }

      if (
        !transfer.outlet.active
      ) {
        return {
          error: jsonError(
            "Outlet tujuan tidak aktif",
            400
          ),
        };
      }

      if (
        transfer.sourceOutlet &&
        !transfer.sourceOutlet.active
      ) {
        return {
          error: jsonError(
            "Outlet sumber kiriman tidak aktif",
            400
          ),
        };
      }

      const validationError =
        validateTransferItems(
          transfer.items
        );

      if (validationError) {
        return {
          error: jsonError(
            validationError,
            400
          ),
        };
      }

      const items =
        buildTransferItems(
          transfer.items
        );

      // =================================================
      // TOTAL QTY DOKUMEN
      //
      // SEMUA ITEM.
      // TERMASUK VOID.
      // =================================================

      const totalQty =
        roundQty(
          items.reduce(
            (
              total,
              item
            ) =>
              total +
              item.qty,
            0
          )
        );

      // =================================================
      // TOTAL RECEIVED
      //
      // VOID = 0
      // =================================================

      const totalReceivedQty =
        roundQty(
          items.reduce(
            (
              total,
              item
            ) =>
              total +
              (
                item.voided
                  ? 0
                  : item.receivedQty
              ),
            0
          )
        );

      // =================================================
      // TOTAL REMAINING
      //
      // VOID TIDAK MENJADI REMAINING.
      // =================================================

      const totalRemainingQty =
        roundQty(
          items.reduce(
            (
              total,
              item
            ) =>
              total +
              (
                item.voided
                  ? 0
                  : Math.max(
                      item.qty -
                        item.receivedQty,
                      0
                    )
              ),
            0
          )
        );

      // =================================================
      // TOTAL VALUE
      //
      // SEMUA ITEM.
      // =================================================

      const totalValue =
        roundMoney(
          items.reduce(
            (
              total,
              item
            ) =>
              total +
              item.subtotal,
            0
          )
        );

      // =================================================
      // TOTAL RECEIVED VALUE
      //
      // VOID = 0
      // =================================================

      const totalReceivedValue =
        roundMoney(
          items.reduce(
            (
              total,
              item
            ) =>
              total +
              (
                item.voided
                  ? 0
                  : item.receivedSubtotal
              ),
            0
          )
        );

      // =================================================
      // VOID
      // =================================================

      const totalVoidedItems =
        items.filter(
          (item) =>
            item.voided
        ).length;

      const totalVoidedQty =
        roundQty(
          items.reduce(
            (
              total,
              item
            ) =>
              total +
              (
                item.voided
                  ? item.qty
                  : 0
              ),
            0
          )
        );

      const activeItems =
        items.filter(
          (item) =>
            !item.voided
        );

      const fullyReceived =
        activeItems.length >
          0 &&
        activeItems.every(
          (item) =>
            item.receivedQty >=
            item.qty
        );

      const partiallyReceived =
        activeItems.some(
          (item) =>
            item.receivedQty > 0
        ) &&
        !fullyReceived;

      const pending =
        activeItems.length >
          0 &&
        activeItems.every(
          (item) =>
            item.receivedQty ===
            0
        );

      return {
        data: {
          id:
            transfer.id,

          sourceId:
            transfer.id,

          sourceKey:
            `TRANSFER-${transfer.id}`,

          sumber:
            "TRANSFER",

          nomor:
            transfer.number,

          tanggal:
            transfer.transferDate,

          status:
            transfer.status,

          remarks:
            transfer.remarks ??
            null,

          // =================================================
          // SOURCE OUTLET
          // =================================================

          sourceOutlet:
            transfer.sourceOutlet
              ? {
                  id:
                    transfer
                      .sourceOutlet.id,

                  code:
                    transfer
                      .sourceOutlet.code,

                  name:
                    transfer
                      .sourceOutlet.name,
                }
              : null,

          // =================================================
          // DESTINATION
          // =================================================

          outlet: {
            id:
              transfer.outlet.id,

            code:
              transfer.outlet.code,

            name:
              transfer.outlet.name,
          },

          supplier:
            null,

          purchase:
            null,

          // =================================================
          // TRANSFER DETAIL
          // =================================================

          transfer: {
            id:
              transfer.id,

            number:
              transfer.number,

            status:
              transfer.status,

            transferDate:
              transfer.transferDate,

            remarks:
              transfer.remarks ??
              null,

            sourceOutlet:
              transfer.sourceOutlet
                ? {
                    id:
                      transfer
                        .sourceOutlet.id,

                    code:
                      transfer
                        .sourceOutlet.code,

                    name:
                      transfer
                        .sourceOutlet.name,
                  }
                : null,

            destinationOutlet: {
              id:
                transfer.outlet.id,

              code:
                transfer.outlet.code,

              name:
                transfer.outlet.name,
            },

            hasVoidedItems:
              totalVoidedItems >
              0,

            totalVoidedItems,

            totalVoidedQty,

            // ===============================================
            // TRANSFER TIDAK PUNYA INVOICE SUPPLIER
            // ===============================================

            paymentMethod:
              null,

            isTempo:
              false,

            payable:
              null,

            supplierInvoice:
              null,
          },

          // =================================================
          // ITEMS
          //
          // SEMUA ITEM TERMASUK VOID
          // =================================================

          items,

          // =================================================
          // TOTAL
          // =================================================

          totalQty,

          totalReceivedQty,

          totalRemainingQty,

          totalValue,

          totalReceivedValue,

          totalVoidedItems,

          totalVoidedQty,

          // =================================================
          // STATUS FLAGS
          // =================================================

          isFullyReceived:
            fullyReceived,

          isPartiallyReceived:
            partiallyReceived,

          isPending:
            pending,

          // =================================================
          // FINANCIAL
          //
          // Transfer bukan transaksi supplier.
          // =================================================

          paymentMethod:
            null,

          isTempo:
            false,

          payable:
            null,

          supplierInvoice:
            null,

          // =================================================
          // RECEIVING
          // =================================================

          receiving: {
            alreadyReceived:
              totalReceivedQty >
              0,

            fullyReceived,

            partiallyReceived,

            pending,
          },
        },
      };
    }

    // =====================================================
    // =====================================================
    // EXPLICIT PURCHASE
    // =====================================================
    // =====================================================

    if (
      parsed.source ===
      "PURCHASE"
    ) {
      const purchase =
        await getPurchase(
          parsed.id
        );

      if (!purchase) {
        return jsonError(
          "Purchase Order tidak ditemukan",
          404
        );
      }

      const result =
        createPurchaseResponse(
          purchase
        );

      if (result.error) {
        return result.error;
      }

      return NextResponse.json({
        success: true,
        data: result.data,
      });
    }

    // =====================================================
    // =====================================================
    // EXPLICIT TRANSFER
    // =====================================================
    // =====================================================

    if (
      parsed.source ===
      "TRANSFER"
    ) {
      const transfer =
        await getTransfer(
          parsed.id
        );

      if (!transfer) {
        return jsonError(
          "Data kiriman gudang tidak ditemukan",
          404
        );
      }

      const result =
        createTransferResponse(
          transfer
        );

      if (result.error) {
        return result.error;
      }

      return NextResponse.json({
        success: true,
        data: result.data,
      });
    }

    // =====================================================
    // =====================================================
    // NUMERIC ID
    // =====================================================
    //
    // Backward compatibility:
    //
    // 123
    //
    // PURCHASE dahulu.
    // Jika tidak ada -> TRANSFER.
    // =====================================================

    if (
      parsed.source ===
      "NUMERIC"
    ) {
      // =================================================
      // COBA PURCHASE
      // =================================================

      const purchase =
        await getPurchase(
          parsed.id
        );

      if (purchase) {
        const result =
          createPurchaseResponse(
            purchase
          );

        if (result.error) {
          return result.error;
        }

        return NextResponse.json({
          success: true,
          data: result.data,
        });
      }

      // =================================================
      // COBA TRANSFER
      // =================================================

      const transfer =
        await getTransfer(
          parsed.id
        );

      if (transfer) {
        const result =
          createTransferResponse(
            transfer
          );

        if (result.error) {
          return result.error;
        }

        return NextResponse.json({
          success: true,
          data: result.data,
        });
      }

      return jsonError(
        "Purchase Order atau Kiriman Gudang tidak ditemukan",
        404
      );
    }

    // =====================================================
    // FALLBACK
    // =====================================================

    return jsonError(
      "Sumber barang masuk tidak dikenali",
      400
    );
  } catch (error: any) {
    console.error(
      "GET DETAIL OUTLET BARANG MASUK ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil detail barang masuk outlet",
      },
      {
        status: 500,
      }
    );
  }
}