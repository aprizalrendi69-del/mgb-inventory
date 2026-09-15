import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/*
============================================================
ADJUSTMENT STOCK API
============================================================

FLOW FINAL
============================================================

CREATE DRAFT
------------
POST /api/adjustment

{
  type: "PLUS",
  reason: "...",
  remarks: "...",
  warehouse: "MAIN",
  status: "DRAFT",
  items: [...]
}

=> Membuat dokumen adjustment
=> TIDAK mengubah stock


CREATE + APPROVED
-----------------
POST /api/adjustment

{
  type: "PLUS",
  status: "APPROVED",
  items: [...]
}

=> Membuat adjustment
=> Update stock
=> Update inventory
=> Create stock card
=> Semua dalam 1 transaction


APPROVE DRAFT
-------------
PATCH /api/adjustment

{
  id: 123,
  action: "APPROVE"
}

=> Draft menjadi APPROVED
=> Stock diperbarui
=> Inventory diperbarui
=> StockCard dibuat


REJECT DRAFT
------------
PATCH /api/adjustment

{
  id: 123,
  action: "REJECT"
}

=> Draft menjadi REJECTED
=> Tidak mengubah stock


DELETE DRAFT
------------
DELETE /api/adjustment?id=123

=> Hanya DRAFT yang boleh dihapus
=> AdjustmentItem ikut dihapus
=> Tidak mengubah stock
=> Tidak mengubah inventory
=> Tidak mengubah stock card

============================================================
STOCK CENTRAL / MAIN
============================================================

Barang.stock
Inventory.stock
Inventory.availableStock
StockCard

============================================================
TIDAK MENYENTUH
============================================================

OutletStock
OutletBarang
StockMutation outlet

Karena schema Adjustment saat ini belum memiliki outletId.
============================================================
*/

type AdjustmentType = "PLUS" | "MINUS";

type AdjustmentStatus =
  | "DRAFT"
  | "APPROVED"
  | "REJECTED";

type AdjustmentItemInput = {
  barangId: number | string;
  qty: number | string;
  price?: number | string | null;
  type?: string;
};

type AdjustmentBody = {
  type?: string;
  reason?: string | null;
  remarks?: string | null;
  warehouse?: string | null;
  status?: string | null;
  adjustmentDate?: string | null;
  items?: AdjustmentItemInput[];
};

type PatchBody = {
  id?: number | string;
  action?: string;
};

/*
============================================================
HELPERS
============================================================
*/

function normalizeAdjustmentType(
  value: unknown
): AdjustmentType {
  const type = String(value ?? "")
    .trim()
    .toUpperCase();

  if (
    type === "MINUS" ||
    type === "OUT" ||
    type === "REDUCE"
  ) {
    return "MINUS";
  }

  return "PLUS";
}

function normalizeStatus(
  value: unknown
): AdjustmentStatus {
  const status = String(value ?? "")
    .trim()
    .toUpperCase();

  if (status === "APPROVED") {
    return "APPROVED";
  }

  if (status === "REJECTED") {
    return "REJECTED";
  }

  return "DRAFT";
}

function normalizeItemType(
  adjustmentType: AdjustmentType
): "IN" | "OUT" {
  return adjustmentType === "PLUS"
    ? "IN"
    : "OUT";
}

function parsePositiveNumber(
  value: unknown,
  fieldName: string
): number {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    throw new Error(
      `${fieldName} harus lebih besar dari 0`
    );
  }

  return number;
}

function parseNonNegativeNumber(
  value: unknown,
  fieldName: string
): number {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    throw new Error(
      `${fieldName} tidak boleh negatif`
    );
  }

  return number;
}

function normalizeZero(
  value: number
): number {
  if (Math.abs(value) < 0.000001) {
    return 0;
  }

  return value;
}

function generateAdjustmentNumber(): string {
  const timestamp = Date.now();

  const random =
    Math.floor(
      Math.random() * 10000
    )
      .toString()
      .padStart(4, "0");

  return `ADJ-${timestamp}-${random}`;
}

/*
============================================================
GET ADJUSTMENT
============================================================

GET /api/adjustment

Return:
- adjustment
- items
- barang
============================================================
*/

export async function GET() {
  try {
    const data =
      await prisma.adjustment.findMany({
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
          adjustmentDate: "desc",
        },
      });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "GET /api/adjustment error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil data adjustment",
      },
      {
        status: 500,
      }
    );
  }
}

/*
============================================================
POST ADJUSTMENT
============================================================

POST /api/adjustment

Contoh PLUS:

{
  "type": "PLUS",
  "reason": "Koreksi stock opname",
  "remarks": "Barang ditemukan lebih",
  "warehouse": "MAIN",
  "status": "DRAFT",
  "items": [
    {
      "barangId": 1,
      "qty": 5,
      "price": 10000
    }
  ]
}


Contoh MINUS:

{
  "type": "MINUS",
  "reason": "Koreksi stock opname",
  "warehouse": "MAIN",
  "status": "APPROVED",
  "items": [
    {
      "barangId": 1,
      "qty": 2,
      "price": 10000
    }
  ]
}

============================================================
*/

export async function POST(
  req: NextRequest
) {
  try {
    const body =
      (await req.json()) as AdjustmentBody;

    /*
    ========================================================
    BASIC VALIDATION
    ========================================================
    */

    if (
      !body ||
      typeof body !== "object"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Request tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Array.isArray(body.items) ||
      body.items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Minimal harus ada 1 barang adjustment",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    TYPE
    ========================================================
    */

    const adjustmentType =
      normalizeAdjustmentType(
        body.type
      );

    /*
    ========================================================
    STATUS
    ========================================================
    */

    const status =
      normalizeStatus(
        body.status
      );

    /*
    ========================================================
    WAREHOUSE
    ========================================================
    */

    const warehouse =
      String(
        body.warehouse ?? "MAIN"
      ).trim() || "MAIN";

    /*
    ========================================================
    REASON
    ========================================================
    */

    const reason =
      body.reason !== undefined &&
      body.reason !== null
        ? String(body.reason).trim() || null
        : null;

    /*
    ========================================================
    REMARKS
    ========================================================
    */

    const remarks =
      body.remarks !== undefined &&
      body.remarks !== null
        ? String(body.remarks).trim() || null
        : null;

    /*
    ========================================================
    ADJUSTMENT DATE
    ========================================================
    */

    let adjustmentDate =
      new Date();

    if (
      body.adjustmentDate
    ) {
      const parsedDate =
        new Date(
          body.adjustmentDate
        );

      if (
        Number.isNaN(
          parsedDate.getTime()
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Tanggal adjustment tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      adjustmentDate =
        parsedDate;
    }

    /*
    ========================================================
    NORMALIZE ITEM
    ========================================================

    Adjustment hanya mempunyai 1 type:

    PLUS
    ↓
    IN

    MINUS
    ↓
    OUT

    Kita tidak mengizinkan 1 adjustment berisi
    PLUS dan MINUS sekaligus.
    ========================================================
    */

    const itemType =
      normalizeItemType(
        adjustmentType
      );

    const normalizedItems =
      body.items.map(
        (
          item,
          index
        ) => {
          const barangId =
            Number(item.barangId);

          if (
            !Number.isInteger(barangId) ||
            barangId <= 0
          ) {
            throw new Error(
              `Barang item ke-${index + 1} tidak valid`
            );
          }

          const qty =
            parsePositiveNumber(
              item.qty,
              `Qty item ke-${index + 1}`
            );

          const price =
            item.price === undefined ||
            item.price === null ||
            item.price === ""
              ? 0
              : parseNonNegativeNumber(
                  item.price,
                  `Harga item ke-${index + 1}`
                );

          /*
          Jika frontend mengirim type item,
          harus konsisten dengan type utama.
          */

          if (
            item.type !== undefined &&
            item.type !== null &&
            String(item.type).trim() !== ""
          ) {
            const suppliedItemType =
              normalizeAdjustmentType(
                item.type
              );

            if (
              suppliedItemType !==
              adjustmentType
            ) {
              throw new Error(
                `Type item ke-${index + 1} tidak sesuai dengan type adjustment`
              );
            }
          }

          return {
            barangId,
            qty,
            price,
            type: itemType,
          };
        }
      );

    /*
    ========================================================
    MERGE DUPLICATE BARANG
    ========================================================

    Contoh:

    Barang A + 5
    Barang A + 3

    menjadi:

    Barang A + 8

    Ini mencegah satu adjustment menghasilkan
    beberapa baris barang yang sama.
    ========================================================
    */

    const mergedMap =
      new Map<
        number,
        {
          barangId: number;
          qty: number;
          price: number;
          type: "IN" | "OUT";
        }
      >();

    for (
      const item of normalizedItems
    ) {
      const existing =
        mergedMap.get(
          item.barangId
        );

      if (existing) {
        existing.qty += item.qty;

        if (item.price > 0) {
          existing.price =
            item.price;
        }
      } else {
        mergedMap.set(
          item.barangId,
          {
            barangId:
              item.barangId,

            qty:
              item.qty,

            price:
              item.price,

            type:
              item.type,
          }
        );
      }
    }

    const items =
      Array.from(
        mergedMap.values()
      );

    /*
    ========================================================
    TRANSACTION
    ========================================================
    */

    const adjustment =
      await prisma.$transaction(
        async (tx) => {
          /*
          ==================================================
          FIND BARANG
          ==================================================
          */

          const barangIds =
            items.map(
              (item) =>
                item.barangId
            );

          const barangs =
            await tx.barang.findMany({
              where: {
                id: {
                  in: barangIds,
                },
              },

              include: {
                inventory: true,
              },
            });

          const barangMap =
            new Map(
              barangs.map(
                (barang) => [
                  barang.id,
                  barang,
                ]
              )
            );

          /*
          ==================================================
          VALIDATE BARANG
          ==================================================
          */

          for (
            const item of items
          ) {
            const barang =
              barangMap.get(
                item.barangId
              );

            if (!barang) {
              throw new Error(
                `Barang ID ${item.barangId} tidak ditemukan`
              );
            }

            if (!barang.active) {
              throw new Error(
                `Barang "${barang.name}" sudah tidak aktif`
              );
            }
          }

          /*
          ==================================================
          VALIDATE STOCK
          ==================================================

          HANYA dilakukan jika langsung APPROVED.

          DRAFT:
          tidak perlu cek stock.
          */

          if (
            status === "APPROVED" &&
            adjustmentType === "MINUS"
          ) {
            for (
              const item of items
            ) {
              const barang =
                barangMap.get(
                  item.barangId
                );

              if (!barang) {
                throw new Error(
                  `Barang ${item.barangId} tidak ditemukan`
                );
              }

              const currentStock =
                Number(
                  barang.stock ?? 0
                );

              if (
                currentStock <
                item.qty - 0.000001
              ) {
                throw new Error(
                  `Stock "${barang.name}" tidak mencukupi. ` +
                    `Stock tersedia: ${currentStock}, ` +
                    `Adjustment: ${item.qty}`
                );
              }
            }
          }

          /*
          ==================================================
          CREATE ADJUSTMENT
          ==================================================
          */

          const created =
            await tx.adjustment.create({
              data: {
                number:
                  generateAdjustmentNumber(),

                adjustmentDate,

                warehouse,

                type:
                  adjustmentType,

                reason,

                remarks,

                status,

                items: {
                  create:
                    items.map(
                      (item) => ({
                        barangId:
                          item.barangId,

                        qty:
                          item.qty,

                        price:
                          item.price,

                        type:
                          item.type,
                      })
                    ),
                },
              },

              include: {
                items: {
                  include: {
                    barang: true,
                  },
                },
              },
            });

          /*
          ==================================================
          JIKA BUKAN APPROVED
          ==================================================

          DRAFT / REJECTED

          Tidak menyentuh stock.
          */

          if (
            status !== "APPROVED"
          ) {
            return created;
          }

          /*
          ==================================================
          APPLY STOCK
          ==================================================
          */

          for (
            const item of items
          ) {
            const barang =
              barangMap.get(
                item.barangId
              );

            if (!barang) {
              throw new Error(
                `Barang ID ${item.barangId} tidak ditemukan`
              );
            }

            /*
            ================================================
            STOCK SEBELUM
            ================================================
            */

            const stockBefore =
              Number(
                barang.stock ?? 0
              );

            /*
            ================================================
            STOCK SESUDAH
            ================================================
            */

            let stockAfter =
              stockBefore;

            if (
              item.type === "IN"
            ) {
              stockAfter =
                stockBefore +
                item.qty;
            } else {
              stockAfter =
                stockBefore -
                item.qty;
            }

            stockAfter =
              normalizeZero(
                stockAfter
              );

            /*
            ================================================
            FINAL SAFETY
            ================================================
            */

            if (
              stockAfter <
              -0.000001
            ) {
              throw new Error(
                `Stock "${barang.name}" tidak boleh negatif`
              );
            }

            /*
            ================================================
            UPDATE BARANG.STOCK
            ================================================
            */

            await tx.barang.update({
              where: {
                id:
                  item.barangId,
              },

              data: {
                stock:
                  stockAfter,
              },
            });

            /*
            ================================================
            UPDATE / CREATE INVENTORY
            ================================================
            */

            const reservedStock =
              Number(
                barang.inventory
                  ?.reservedStock ?? 0
              );

            const availableStock =
              Math.max(
                0,
                stockAfter -
                  reservedStock
              );

            if (
              barang.inventory
            ) {
              await tx.inventory.update({
                where: {
                  barangId:
                    item.barangId,
                },

                data: {
                  stock:
                    stockAfter,

                  availableStock:
                    availableStock,
                },
              });
            } else {
              await tx.inventory.create({
                data: {
                  barangId:
                    item.barangId,

                  warehouse:
                    warehouse,

                  stock:
                    stockAfter,

                  reservedStock:
                    0,

                  availableStock:
                    stockAfter,

                  minimumStock:
                    Number(
                      barang.minimumStock ??
                        0
                    ),

                  averageCost:
                    item.price > 0
                      ? item.price
                      : Number(
                          barang.purchasePrice ??
                            0
                        ),
                },
              });
            }

            /*
            ================================================
            STOCK CARD
            ================================================
            */

            const unitPrice =
              item.price > 0
                ? item.price
                : Number(
                    barang.purchasePrice ??
                      0
                  );

            const qtyIn =
              item.type === "IN"
                ? item.qty
                : 0;

            const qtyOut =
              item.type === "OUT"
                ? item.qty
                : 0;

            const totalValue =
              item.qty *
              unitPrice;

            await tx.stockCard.create({
              data: {
                barangId:
                  item.barangId,

                trxDate:
                  new Date(),

                trxType:
                  "ADJUSTMENT",

                trxNumber:
                  created.number,

                referenceId:
                  created.id,

                warehouse:
                  warehouse,

                qtyIn,

                qtyOut,

                balance:
                  stockAfter,

                unitPrice,

                totalValue,

                note:
                  reason ||
                  remarks ||
                  "Stock adjustment",
              },
            });
          }

          /*
          ==================================================
          RETURN APPROVED
          ==================================================
          */

          return created;
        }
      );

    /*
    ========================================================
    RESPONSE
    ========================================================
    */

    return NextResponse.json(
      {
        success: true,

        data: adjustment,

        message:
          status === "APPROVED"
            ? "Adjustment berhasil dibuat dan stock telah diperbarui"
            : status === "REJECTED"
              ? "Adjustment berhasil dibuat sebagai REJECTED"
              : "Adjustment berhasil dibuat sebagai DRAFT",
      },
      {
        status: 201,
      }
    );
  } catch (error: unknown) {
    console.error(
      "POST /api/adjustment error:",
      error
    );

    /*
    ========================================================
    ERROR MESSAGE
    ========================================================
    */

    const message =
      error instanceof Error
        ? error.message
        : "Gagal membuat adjustment";

    /*
    ========================================================
    PRISMA ERROR
    ========================================================
    */

    if (
      error instanceof Prisma.PrismaClientKnownRequestError
    ) {
      if (
        error.code === "P2002"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Nomor adjustment sudah digunakan. Silakan coba lagi.",
          },
          {
            status: 409,
          }
        );
      }

      if (
        error.code === "P2025"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Data yang diproses tidak ditemukan.",
          },
          {
            status: 404,
          }
        );
      }
    }

    /*
    ========================================================
    VALIDATION ERROR
    ========================================================
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

/*
============================================================
PATCH
============================================================

Digunakan untuk:

APPROVE DRAFT
-------------
{
  "id": 123,
  "action": "APPROVE"
}


REJECT DRAFT
------------
{
  "id": 123,
  "action": "REJECT"
}

============================================================
*/

export async function PATCH(
  req: NextRequest
) {
  try {
    const body =
      (await req.json()) as PatchBody;

    /*
    ========================================================
    VALIDATE ID
    ========================================================
    */

    const id =
      Number(body.id);

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID adjustment tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    ACTION
    ========================================================
    */

    const action =
      String(
        body.action ?? "APPROVE"
      )
        .trim()
        .toUpperCase();

    if (
      action !== "APPROVE" &&
      action !== "REJECT"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Action harus APPROVE atau REJECT",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    REJECT
    ========================================================
    */

    if (
      action === "REJECT"
    ) {
      const rejected =
        await prisma.adjustment.updateMany({
          where: {
            id,
            status: "DRAFT",
          },

          data: {
            status:
              "REJECTED",
          },
        });

      if (
        rejected.count === 0
      ) {
        const existing =
          await prisma.adjustment.findUnique({
            where: {
              id,
            },
            select: {
              id: true,
              status: true,
            },
          });

        if (!existing) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Adjustment tidak ditemukan",
            },
            {
              status: 404,
            }
          );
        }

        return NextResponse.json(
          {
            success: false,
            message:
              `Adjustment tidak dapat di-reject karena status saat ini ${existing.status}`,
          },
          {
            status: 409,
          }
        );
      }

      const data =
        await prisma.adjustment.findUnique({
          where: {
            id,
          },

          include: {
            items: {
              include: {
                barang: true,
              },
            },
          },
        });

      return NextResponse.json({
        success: true,
        data,
        message:
          "Adjustment berhasil ditolak",
      });
    }

    /*
    ========================================================
    APPROVE
    ========================================================
    */

    const approved =
      await prisma.$transaction(
        async (tx) => {
          /*
          ================================================
          GET DRAFT
          ================================================
          */

          const adjustment =
            await tx.adjustment.findUnique({
              where: {
                id,
              },

              include: {
                items: {
                  include: {
                    barang: {
                      include: {
                        inventory: true,
                      },
                    },
                  },
                },
              },
            });

          if (!adjustment) {
            throw new Error(
              "Adjustment tidak ditemukan"
            );
          }

          /*
          ================================================
          HANYA DRAFT BOLEH APPROVE
          ================================================
          */

          if (
            adjustment.status !==
            "DRAFT"
          ) {
            throw new Error(
              `Adjustment tidak dapat di-approve karena status saat ini ${adjustment.status}`
            );
          }

          /*
          ================================================
          NORMALIZE TYPE
          ================================================
          */

          const adjustmentType =
            normalizeAdjustmentType(
              adjustment.type
            );

          const itemType =
            normalizeItemType(
              adjustmentType
            );

          /*
          ================================================
          VALIDATE BARANG
          ================================================
          */

          for (
            const item of adjustment.items
          ) {
            if (
              !item.barang
            ) {
              throw new Error(
                `Barang ID ${item.barangId} tidak ditemukan`
              );
            }

            if (
              !item.barang.active
            ) {
              throw new Error(
                `Barang "${item.barang.name}" sudah tidak aktif`
              );
            }
          }

          /*
          ================================================
          VALIDATE STOCK
          ================================================
          */

          if (
            adjustmentType ===
            "MINUS"
          ) {
            for (
              const item of adjustment.items
            ) {
              const barang =
                item.barang;

              if (!barang) {
                continue;
              }

              const stockBefore =
                Number(
                  barang.stock ?? 0
                );

              const qty =
                Number(
                  item.qty ?? 0
                );

              if (
                stockBefore <
                qty - 0.000001
              ) {
                throw new Error(
                  `Stock "${barang.name}" tidak mencukupi. ` +
                    `Stock tersedia: ${stockBefore}, ` +
                    `Adjustment: ${qty}`
                );
              }
            }
          }

          /*
          ================================================
          APPLY EACH ITEM
          ================================================
          */

          for (
            const item of adjustment.items
          ) {
            const barang =
              item.barang;

            if (!barang) {
              throw new Error(
                `Barang ID ${item.barangId} tidak ditemukan`
              );
            }

            /*
            ----------------------------------------------
            STOCK BEFORE
            ----------------------------------------------
            */

            const stockBefore =
              Number(
                barang.stock ?? 0
              );

            /*
            ----------------------------------------------
            STOCK AFTER
            ----------------------------------------------
            */

            const qty =
              Number(
                item.qty ?? 0
              );

            let stockAfter =
              stockBefore;

            if (
              itemType === "IN"
            ) {
              stockAfter =
                stockBefore +
                qty;
            } else {
              stockAfter =
                stockBefore -
                qty;
            }

            stockAfter =
              normalizeZero(
                stockAfter
              );

            /*
            ----------------------------------------------
            FINAL SAFETY
            ----------------------------------------------
            */

            if (
              stockAfter <
              -0.000001
            ) {
              throw new Error(
                `Stock "${barang.name}" tidak boleh negatif`
              );
            }

            /*
            ----------------------------------------------
            UPDATE BARANG
            ----------------------------------------------
            */

            await tx.barang.update({
              where: {
                id:
                  barang.id,
              },

              data: {
                stock:
                  stockAfter,
              },
            });

            /*
            ----------------------------------------------
            INVENTORY
            ----------------------------------------------
            */

            const reservedStock =
              Number(
                barang.inventory
                  ?.reservedStock ?? 0
              );

            const availableStock =
              Math.max(
                0,
                stockAfter -
                  reservedStock
              );

            if (
              barang.inventory
            ) {
              await tx.inventory.update({
                where: {
                  barangId:
                    barang.id,
                },

                data: {
                  stock:
                    stockAfter,

                  availableStock:
                    availableStock,
                },
              });
            } else {
              await tx.inventory.create({
                data: {
                  barangId:
                    barang.id,

                  warehouse:
                    adjustment.warehouse ||
                    "MAIN",

                  stock:
                    stockAfter,

                  reservedStock:
                    0,

                  availableStock:
                    stockAfter,

                  minimumStock:
                    Number(
                      barang.minimumStock ??
                        0
                    ),

                  averageCost:
                    Number(
                      item.price ??
                        barang.purchasePrice ??
                        0
                    ),
                },
              });
            }

            /*
            ----------------------------------------------
            STOCK CARD
            ----------------------------------------------
            */

            const unitPrice =
              Number(
                item.price ??
                  barang.purchasePrice ??
                  0
              );

            const qtyIn =
              itemType === "IN"
                ? qty
                : 0;

            const qtyOut =
              itemType === "OUT"
                ? qty
                : 0;

            const totalValue =
              qty *
              unitPrice;

            await tx.stockCard.create({
              data: {
                barangId:
                  barang.id,

                trxDate:
                  new Date(),

                trxType:
                  "ADJUSTMENT",

                trxNumber:
                  adjustment.number,

                referenceId:
                  adjustment.id,

                warehouse:
                  adjustment.warehouse ||
                  "MAIN",

                qtyIn,

                qtyOut,

                balance:
                  stockAfter,

                unitPrice,

                totalValue,

                note:
                  adjustment.reason ||
                  adjustment.remarks ||
                  "Stock adjustment",
              },
            });
          }

          /*
          ================================================
          UPDATE STATUS
          ================================================
          */

          const updated =
            await tx.adjustment.update({
              where: {
                id:
                  adjustment.id,
              },

              data: {
                status:
                  "APPROVED",
              },

              include: {
                items: {
                  include: {
                    barang: true,
                  },
                },
              },
            });

          return updated;
        }
      );

    /*
    ========================================================
    RESPONSE
    ========================================================
    */

    return NextResponse.json({
      success: true,
      data: approved,
      message:
        "Adjustment berhasil di-approve dan stock telah diperbarui",
    });
  } catch (error: unknown) {
    console.error(
      "PATCH /api/adjustment error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Gagal memproses adjustment";

    /*
    ========================================================
    PRISMA ERROR
    ========================================================
    */

    if (
      error instanceof Prisma.PrismaClientKnownRequestError
    ) {
      if (
        error.code === "P2025"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Adjustment tidak ditemukan",
          },
          {
            status: 404,
          }
        );
      }

      if (
        error.code === "P2002"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Data adjustment mengalami konflik unique constraint",
          },
          {
            status: 409,
          }
        );
      }
    }

    /*
    ========================================================
    BUSINESS ERROR
    ========================================================
    */

    if (
      message.includes(
        "tidak ditemukan"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message,
        },
        {
          status: 404,
        }
      );
    }

    if (
      message.includes(
        "tidak dapat"
      ) ||
      message.includes(
        "tidak mencukupi"
      ) ||
      message.includes(
        "tidak boleh negatif"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message,
        },
        {
          status: 409,
        }
      );
    }

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

/*
============================================================
DELETE ADJUSTMENT DRAFT
============================================================

DELETE /api/adjustment?id=123

ATURAN:
- ID harus valid
- Adjustment harus ada
- HANYA status DRAFT yang boleh dihapus
- AdjustmentItem ikut dihapus
- Tidak menyentuh Barang.stock
- Tidak menyentuh Inventory
- Tidak membuat / menghapus StockCard
- Semua dilakukan dalam transaction

PENTING:
Backend tetap melakukan validasi status meskipun frontend
hanya menampilkan tombol hapus untuk DRAFT.

Jadi APPROVED / REJECTED tetap aman walaupun seseorang
memanggil API DELETE secara manual.
============================================================
*/

export async function DELETE(
  req: NextRequest
) {
  try {
    /*
    ========================================================
    GET ID
    ========================================================
    */

    const { searchParams } =
      new URL(req.url);

    const id =
      Number(
        searchParams.get("id")
      );

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID adjustment tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    DELETE TRANSACTION
    ========================================================
    */

    const deleted =
      await prisma.$transaction(
        async (tx) => {
          /*
          ================================================
          FIND ADJUSTMENT
          ================================================
          */

          const adjustment =
            await tx.adjustment.findUnique({
              where: {
                id,
              },

              select: {
                id: true,
                number: true,
                status: true,
              },
            });

          /*
          ================================================
          NOT FOUND
          ================================================
          */

          if (!adjustment) {
            throw new Error(
              "Adjustment tidak ditemukan"
            );
          }

          /*
          ================================================
          ONLY DRAFT
          ================================================
          */

          if (
            adjustment.status !==
            "DRAFT"
          ) {
            throw new Error(
              `Adjustment ${adjustment.number} tidak dapat dihapus karena status saat ini ${adjustment.status}`
            );
          }

          /*
          ================================================
          DELETE ADJUSTMENT
          ================================================

          Jika schema Prisma memiliki relation
          onDelete: Cascade pada AdjustmentItem,
          item akan ikut terhapus.

          Jika belum cascade, kita hapus item
          secara eksplisit terlebih dahulu.
          ================================================
          */

          await tx.adjustmentItem.deleteMany({
            where: {
              adjustmentId: id,
            },
          });

          /*
          ================================================
          DELETE HEADER
          ================================================
          */

          const result =
            await tx.adjustment.delete({
              where: {
                id,
              },
              select: {
                id: true,
                number: true,
                status: true,
              },
            });

          return result;
        }
      );

    /*
    ========================================================
    SUCCESS
    ========================================================
    */

    return NextResponse.json({
      success: true,
      data: deleted,
      message:
        `Draft adjustment ${deleted.number} berhasil dihapus`,
    });
  } catch (error: unknown) {
    console.error(
      "DELETE /api/adjustment error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Gagal menghapus adjustment";

    /*
    ========================================================
    PRISMA ERROR
    ========================================================
    */

    if (
      error instanceof Prisma.PrismaClientKnownRequestError
    ) {
      /*
      P2025:
      Record yang ingin dihapus tidak ditemukan.
      */

      if (
        error.code === "P2025"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Adjustment tidak ditemukan atau sudah dihapus",
          },
          {
            status: 404,
          }
        );
      }

      /*
      P2003:
      Foreign key constraint.
      */

      if (
        error.code === "P2003"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Adjustment tidak dapat dihapus karena masih memiliki relasi data",
          },
          {
            status: 409,
          }
        );
      }
    }

    /*
    ========================================================
    BUSINESS ERROR
    ========================================================
    */

    if (
      message ===
      "Adjustment tidak ditemukan"
    ) {
      return NextResponse.json(
        {
          success: false,
          message,
        },
        {
          status: 404,
        }
      );
    }

    /*
    APPROVED / REJECTED
    */

    if (
      message.includes(
        "tidak dapat dihapus"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message,
        },
        {
          status: 409,
        }
      );
    }

    /*
    ========================================================
    GENERIC ERROR
    ========================================================
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