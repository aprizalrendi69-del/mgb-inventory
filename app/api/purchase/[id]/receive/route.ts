import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Normalisasi hasil scan batch.
 *
 * Scanner bisa mengirim:
 *
 * 1. Batch biasa:
 *    BVG049
 *
 * 2. QR JSON:
 *    {
 *      type: "MGB-BATCH",
 *      barangId: 235,
 *      batchNumber: "BVG049",
 *      expiredDate: "2027-02-25"
 *    }
 *
 * 3. QR text:
 *    MGB|235|BVG049|GR-1786285055548|2027-02-25T00:00:00.000Z
 *
 * Yang disimpan ke database:
 *
 * batchNumber = BVG049
 */
function parseBatchValue(
  value: unknown
): {
  batchNumber: string;
  expiredDate: string | null;
  barangId: number | null;
} {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return {
      batchNumber: "",
      expiredDate: null,
      barangId: null,
    };
  }

  // =====================================================
  // JSON QR
  // =====================================================

  try {
    const parsed = JSON.parse(raw);

    if (
      parsed &&
      typeof parsed === "object"
    ) {
      const batchNumber = String(
        parsed.batchNumber ??
          parsed.batch ??
          ""
      ).trim();

      const expiredDate = parsed.expiredDate
        ? String(parsed.expiredDate).substring(
            0,
            10
          )
        : null;

      const barangId =
        parsed.barangId !== undefined &&
        parsed.barangId !== null
          ? Number(parsed.barangId)
          : null;

      return {
        batchNumber,
        expiredDate,
        barangId:
          Number.isInteger(barangId)
            ? barangId
            : null,
      };
    }
  } catch {
    // Bukan JSON.
  }

  // =====================================================
  // FORMAT QR TEXT MGB
  //
  // MGB|235|BVG049|GR-1786285055548|2027-02-25T00:00:00.000Z
  //
  // index:
  //
  // 0 = MGB
  // 1 = barangId
  // 2 = batchNumber
  // 3 = GR / reference
  // 4 = expiredDate
  // =====================================================

  if (raw.startsWith("MGB|")) {
    const parts = raw.split("|");

    if (parts.length >= 3) {
      const barangId = Number(parts[1]);

      const batchNumber = String(
        parts[2] ?? ""
      ).trim();

      const expiredDate =
        parts[4]
          ? String(parts[4]).substring(
              0,
              10
            )
          : null;

      return {
        batchNumber,
        expiredDate,
        barangId:
          Number.isInteger(barangId)
            ? barangId
            : null,
      };
    }
  }

  // =====================================================
  // BARCODE BATCH BIASA
  // =====================================================

  return {
    batchNumber: raw,
    expiredDate: null,
    barangId: null,
  };
}

export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await params;

    const purchaseId = Number(id);

    if (!Number.isInteger(purchaseId)) {
      return NextResponse.json(
        {
          success: false,
          message: "ID Purchase tidak valid",
        },
        { status: 400 }
      );
    }

    const body = await req.json();

    const receiveItems = body.items;

    if (
      !Array.isArray(receiveItems) ||
      receiveItems.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Item receive kosong",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // AMBIL PURCHASE
    // =====================================================

    const purchase =
      await prisma.purchase.findUnique({
        where: {
          id: purchaseId,
        },
        include: {
          supplier: true,
          items: {
            include: {
              barang: true,
            },
          },
        },
      });

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase tidak ditemukan",
        },
        { status: 404 }
      );
    }

    // =====================================================
    // CEK STATUS
    // =====================================================

    if (purchase.status === "RECEIVED") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase sudah selesai diterima",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // NORMALISASI ITEM RECEIVE
    // =====================================================

    const normalizedItems =
      receiveItems.map(
        (item: any) => {
          const parsedBatch =
            parseBatchValue(
              item.batchNumber
            );

          let expiredDate =
            item.expiredDate
              ? String(
                  item.expiredDate
                ).substring(0, 10)
              : "";

          /*
           * Kalau expired dari frontend kosong,
           * tetapi QR punya expired date,
           * gunakan expired dari QR.
           */
          if (
            !expiredDate &&
            parsedBatch.expiredDate
          ) {
            expiredDate =
              parsedBatch.expiredDate;
          }

          return {
            ...item,

            barangId:
              Number(item.barangId),

            qty:
              Number(item.qty),

            price:
              Number(item.price ?? 0),

            batchNumber:
              parsedBatch.batchNumber,

            expiredDate,

            scannedBarangId:
              parsedBatch.barangId,
          };
        }
      );

    // =====================================================
    // VALIDASI ITEM
    // =====================================================

    for (const item of normalizedItems) {
      if (
        !Number.isInteger(
          item.barangId
        )
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

      if (
        !Number.isFinite(item.qty) ||
        item.qty <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Qty receive harus lebih dari 0",
          },
          { status: 400 }
        );
      }
    }

    // =====================================================
    // VALIDASI BARCODE / QR BARANG
    // =====================================================

    for (const item of normalizedItems) {
      if (
        item.scannedBarangId !== null &&
        item.scannedBarangId !==
          item.barangId
      ) {
        const purchaseItem =
          purchase.items.find(
            (poItem) =>
              Number(
                poItem.barangId
              ) ===
              item.barangId
          );

        return NextResponse.json(
          {
            success: false,
            message:
              `QR Batch bukan untuk barang ${
                purchaseItem?.barang
                  ?.name ?? ""
              }.`,
          },
          { status: 400 }
        );
      }
    }

    // =====================================================
    // HITUNG TOTAL RECEIVE PER BARANG
    // =====================================================

    const receiveByBarang =
      new Map<number, number>();

    for (const item of normalizedItems) {
      receiveByBarang.set(
        item.barangId,
        (receiveByBarang.get(
          item.barangId
        ) || 0) + item.qty
      );
    }

    // =====================================================
    // VALIDASI TOTAL RECEIVE PER BARANG
    // =====================================================

    for (const [
      barangId,
      totalReceive,
    ] of receiveByBarang) {
      const purchaseItem =
        purchase.items.find(
          (poItem) =>
            Number(
              poItem.barangId
            ) === barangId
        );

      if (!purchaseItem) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang ID ${barangId} tidak terdapat dalam Purchase Order`,
          },
          { status: 400 }
        );
      }

      const sisaPO =
        Number(purchaseItem.qty) -
        Number(
          purchaseItem.receivedQty || 0
        );

      if (
        totalReceive > sisaPO
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Total qty ${purchaseItem.barang.name} melebihi sisa PO.\n\n` +
              `Sisa PO: ${sisaPO}\n` +
              `Total diterima: ${totalReceive}`,
          },
          { status: 400 }
        );
      }
    }

    // =====================================================
    // VALIDASI BATCH
    // =====================================================

    for (const item of normalizedItems) {
      const purchaseItem =
        purchase.items.find(
          (poItem) =>
            Number(
              poItem.barangId
            ) === item.barangId
        );

      if (!purchaseItem) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang ID ${item.barangId} tidak terdapat dalam PO`,
          },
          { status: 400 }
        );
      }

      const barang =
        purchaseItem.barang;

      // ===================================================
      // BARANG EXPIRED
      // ===================================================

      if (barang.hasExpired) {
        const batchNumber =
          String(
            item.batchNumber || ""
          ).trim();

        if (!batchNumber) {
          return NextResponse.json(
            {
              success: false,
              message:
                `Batch Number wajib diisi untuk ${barang.name}`,
            },
            { status: 400 }
          );
        }

        if (!item.expiredDate) {
          return NextResponse.json(
            {
              success: false,
              message:
                `Expired Date wajib diisi untuk batch ${batchNumber}`,
            },
            { status: 400 }
          );
        }

        const expiredDate =
          new Date(
            item.expiredDate
          );

        if (
          Number.isNaN(
            expiredDate.getTime()
          )
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                `Expired Date untuk ${barang.name} tidak valid`,
            },
            { status: 400 }
          );
        }
      }

      // ===================================================
      // NON EXPIRED
      // ===================================================

      if (!barang.hasExpired) {
        item.batchNumber = "";
        item.expiredDate = "";
      }
    }

    // =====================================================
    // TRANSACTION
    // =====================================================

    const receipt =
      await prisma.$transaction(
        async (tx) => {
          const receiptNumber =
            "RC-" + Date.now();

          // =================================================
          // RECEIPT HEADER
          // =================================================

          const newReceipt =
            await tx.receipt.create({
              data: {
                number:
                  receiptNumber,

                receiptDate:
                  new Date(),

                purchaseId:
                  purchase.id,

                supplierId:
                  purchase.supplierId,

                remarks:
                  "Receive Purchase " +
                  purchase.number,
              },
            });

          // =================================================
          // PROSES RECEIVE
          // =================================================

          for (const item of normalizedItems) {
            const barangId =
              item.barangId;

            const qty =
              item.qty;

            const barang =
              await tx.barang.findUnique({
                where: {
                  id: barangId,
                },
              });

            if (!barang) {
              throw new Error(
                `Barang tidak ditemukan ID: ${barangId}`
              );
            }

            const purchaseItem =
              purchase.items.find(
                (poItem) =>
                  Number(
                    poItem.barangId
                  ) === barangId
              );

            if (!purchaseItem) {
              throw new Error(
                `Barang ${barang.name} tidak terdapat dalam PO`
              );
            }

            // =============================================
            // STOCK SEBELUM
            // =============================================

            const stockBefore =
              Number(
                barang.stock || 0
              );

            // =============================================
            // UPDATE STOCK
            // =============================================

            const updatedBarang =
              await tx.barang.update({
                where: {
                  id: barangId,
                },

                data: {
                  stock: {
                    increment: qty,
                  },
                },
              });

            // =============================================
            // STOCK MUTATION
            // =============================================

            await tx.stockMutation.create({
              data: {
                barangId,

                type: "MASUK",

                qty,

                stockBefore,

                stockAfter:
                  Number(
                    updatedBarang.stock
                  ),

                reference:
                  receiptNumber,

                description:
                  "Receive Purchase " +
                  purchase.number,
              },
            });

            // =============================================
            // RECEIPT ITEM
            // =============================================

            const price =
              Number(
                purchaseItem.price ||
                  barang.purchasePrice ||
                  0
              );

            await tx.receiptItem.create({
              data: {
                receiptId:
                  newReceipt.id,

                barangId,

                qty,

                price,

                subtotal:
                  qty * price,
              },
            });

            // =============================================
            // UPDATE PO RECEIVED QTY
            // =============================================

            await tx.purchaseItem.update({
              where: {
                id:
                  purchaseItem.id,
              },

              data: {
                receivedQty: {
                  increment:
                    qty,
                },
              },
            });

            // =============================================
            // BATCH STOCK
            // =============================================

            if (barang.hasExpired) {
              const batchNumber =
                String(
                  item.batchNumber || ""
                ).trim();

              const expiredDate =
                new Date(
                  item.expiredDate
                );

              // ===========================================
              // CARI BATCH
              //
              // Batch dianggap sama berdasarkan:
              // barangId + batchNumber
              //
              // Jadi:
              //
              // BVG049
              //
              // tetap BVG049.
              //
              // BUKAN:
              //
              // MGB|235|BVG049|GR-...
              // ===========================================

              const existingBatch =
                await tx.batchStock.findFirst({
                  where: {
                    barangId,

                    batchNumber,
                  },
                });

              if (existingBatch) {
                /*
                 * Kalau batch sudah ada tetapi
                 * expired date berbeda, jangan
                 * diam-diam mengganti tanggal.
                 *
                 * Kita pertahankan tanggal batch
                 * yang sudah tersimpan.
                 */

                await tx.batchStock.update({
                  where: {
                    id:
                      existingBatch.id,
                  },

                  data: {
                    qty: {
                      increment:
                        qty,
                    },
                  },
                });
              } else {
                await tx.batchStock.create({
                  data: {
                    barangId,

                    batchNumber,

                    expiredDate,

                    qty,
                  },
                });
              }
            }
          }

          // =================================================
          // CEK STATUS PO
          // =================================================

          const updatedPurchase =
            await tx.purchase.findUnique({
              where: {
                id:
                  purchase.id,
              },

              include: {
                items: true,
              },
            });

          if (!updatedPurchase) {
            throw new Error(
              "Purchase gagal dibaca setelah receive"
            );
          }

          const allReceived =
            updatedPurchase.items.every(
              (item) =>
                Number(
                  item.receivedQty || 0
                ) >=
                Number(
                  item.qty || 0
                )
            );

          if (allReceived) {
            await tx.purchase.update({
              where: {
                id:
                  purchase.id,
              },

              data: {
                status:
                  "RECEIVED",
              },
            });
          }

          return newReceipt;
        }
      );

    // =====================================================
    // SUCCESS
    // =====================================================

    return NextResponse.json(
      {
        success: true,

        message:
          "Barang berhasil diterima",

        data: receipt,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "RECEIVE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Receive gagal",
      },
      {
        status: 500,
      }
    );
  }
}