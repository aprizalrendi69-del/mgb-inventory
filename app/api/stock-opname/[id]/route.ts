import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// =================================
// GET DETAIL STOCK OPNAME
// =================================

export async function GET(
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
    const { id } = await params;

    const opnameId = Number(id);

    if (!Number.isInteger(opnameId) || opnameId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "ID tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const opname =
      await prisma.stockOpname.findUnique({
        where: {
          id: opnameId,
        },

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
      });

    if (!opname) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock Opname tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,

      data: {
        ...opname,

        items: opname.items.map((item) => ({
          ...item,

          difference:
            item.physicalQty -
            item.systemQty,
        })),
      },
    });
  } catch (error) {
    console.error(
      "GET STOCK OPNAME DETAIL ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil detail",
      },
      {
        status: 500,
      }
    );
  }
}

// =================================
// UPDATE QTY FISIK
// =================================

export async function PATCH(
  req: NextRequest
) {
  try {
    const body = await req.json();

    const itemId = Number(
      body.itemId
    );

    const physicalQty = Number(
      body.physicalQty
    );

    if (
      !Number.isInteger(itemId) ||
      itemId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Item ID tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(
        physicalQty
      ) ||
      physicalQty < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Physical Qty tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const item =
      await prisma.stockOpnameItem.findUnique(
        {
          where: {
            id: itemId,
          },

          include: {
            opname: true,
          },
        }
      );

    if (!item) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Item tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =================================
    // TIDAK BOLEH EDIT SETELAH APPROVED
    // =================================

    if (
      item.opname.status ===
      "APPROVED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock Opname sudah disahkan dan tidak dapat diubah",
        },
        {
          status: 400,
        }
      );
    }

    const difference =
      physicalQty -
      item.systemQty;

    await prisma.stockOpnameItem.update(
      {
        where: {
          id: itemId,
        },

        data: {
          physicalQty,
          difference,
        },
      }
    );

    return NextResponse.json({
      success: true,
      message:
        "Qty berhasil disimpan",
    });
  } catch (error) {
    console.error(
      "UPDATE STOCK OPNAME ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Update qty gagal",
      },
      {
        status: 500,
      }
    );
  }
}

// =================================
// APPROVE STOCK OPNAME
// =================================

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
    const { id } = await params;

    const opnameId = Number(id);

    if (
      !Number.isInteger(opnameId) ||
      opnameId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "ID tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const opname =
      await prisma.stockOpname.findUnique(
        {
          where: {
            id: opnameId,
          },

          include: {
            items: true,
          },
        }
      );

    if (!opname) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock Opname tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =================================
    // JANGAN APPROVE DUA KALI
    // =================================

    if (
      opname.status ===
      "APPROVED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock Opname sudah approve",
        },
        {
          status: 400,
        }
      );
    }

    // =================================
    // PASTIKAN ADA ITEM
    // =================================

    if (
      opname.items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock Opname tidak memiliki item",
        },
        {
          status: 400,
        }
      );
    }

    await prisma.$transaction(
      async (tx) => {
        for (
          const item of opname.items
        ) {
          const difference =
            item.physicalQty -
            item.systemQty;

          // =================================
          // 1. UPDATE BARANG.STOCK
          // =================================

          await tx.barang.update({
            where: {
              id: item.barangId,
            },

            data: {
              stock:
                item.physicalQty,
            },
          });

          // =================================
          // 2. UPDATE / CREATE INVENTORY
          // =================================

          const inventory =
            await tx.inventory.findUnique(
              {
                where: {
                  barangId:
                    item.barangId,
                },
              }
            );

          if (inventory) {
            const availableStock =
              Math.max(
                item.physicalQty -
                  inventory.reservedStock,
                0
              );

            await tx.inventory.update(
              {
                where: {
                  barangId:
                    item.barangId,
                },

                data: {
                  stock:
                    item.physicalQty,

                  availableStock,
                },
              }
            );
          } else {
            await tx.inventory.create({
              data: {
                barangId:
                  item.barangId,

                warehouse:
                  "MAIN",

                stock:
                  item.physicalQty,

                reservedStock:
                  0,

                availableStock:
                  item.physicalQty,

                minimumStock:
                  0,

                maximumStock:
                  0,

                lastPurchase:
                  0,

                averageCost:
                  0,
              },
            });
          }

          // =================================
          // 3. STOCK CARD
          // =================================

          if (
            difference !== 0
          ) {
            await tx.stockCard.create(
              {
                data: {
                  barangId:
                    item.barangId,

                  trxType:
                    "STOCK_OPNAME",

                  trxNumber:
                    opname.code,

                  qtyIn:
                    difference > 0
                      ? difference
                      : 0,

                  qtyOut:
                    difference < 0
                      ? Math.abs(
                          difference
                        )
                      : 0,

                  balance:
                    item.physicalQty,

                  note:
                    `Penyesuaian Stock Opname ${opname.code}`,
                },
              }
            );

            // =================================
            // 4. STOCK OPNAME HISTORY
            // =================================

            await tx.stockOpnameHistory.create(
              {
                data: {
                  opnameId:
                    opname.id,

                  barangId:
                    item.barangId,

                  systemQty:
                    item.systemQty,

                  physicalQty:
                    item.physicalQty,

                  difference,

                  createdBy: 1,
                },
              }
            );
          }
        }

        // =================================
        // 5. UPDATE STATUS OPNAME
        // =================================

        await tx.stockOpname.update({
          where: {
            id: opnameId,
          },

          data: {
            status:
              "APPROVED",

            approvedBy: 1,
          },
        });

        // =================================
        // 6. HISTORY GLOBAL ERP
        // =================================

        await tx.history.create({
          data: {
            transactionType:
              "STOCK_OPNAME",

            referenceNumber:
              opname.code,

            description:
              `Approve Stock Opname ${opname.code}`,

            userId: 1,
          },
        });
      }
    );

    return NextResponse.json({
      success: true,

      message:
        "Stock Opname berhasil approve",
    });
  } catch (error) {
    console.error(
      "APPROVE STOCK OPNAME ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Approve gagal",
      },
      {
        status: 500,
      }
    );
  }
}

// =================================
// DELETE STOCK OPNAME
// =================================

export async function DELETE(
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
    const { id } = await params;

    const opnameId = Number(id);

    if (
      !Number.isInteger(opnameId) ||
      opnameId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "ID tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =================================
    // CARI STOCK OPNAME
    // =================================

    const opname =
      await prisma.stockOpname.findUnique(
        {
          where: {
            id: opnameId,
          },
        }
      );

    if (!opname) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock Opname tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =================================
    // OPNAME YANG SUDAH APPROVED
    // TIDAK BOLEH DIHAPUS
    // =================================

    if (
      opname.status ===
      "APPROVED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock Opname yang sudah APPROVED tidak dapat dihapus",
        },
        {
          status: 400,
        }
      );
    }

    // =================================
    // HANYA COUNTING YANG BOLEH DIHAPUS
    // =================================

    await prisma.stockOpname.delete({
      where: {
        id: opnameId,
      },
    });

    return NextResponse.json({
      success: true,

      message:
        "Stock Opname berhasil dihapus",
    });
  } catch (error) {
    console.error(
      "DELETE STOCK OPNAME ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal menghapus Stock Opname",
      },
      {
        status: 500,
      }
    );
  }
}