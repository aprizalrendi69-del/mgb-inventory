import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OutletPurchaseStatus, Role } from "@prisma/client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const purchaseId = Number(id);

    if (!purchaseId) {
      return NextResponse.json(
        {
          success: false,
          message: "ID Purchase Outlet tidak valid",
        },
        { status: 400 }
      );
    }

    // =========================
    // SESSION
    // =========================

    const cookieHeader = req.headers.get("cookie");

    if (!cookieHeader) {
      return NextResponse.json(
        {
          success: false,
          message: "Belum login",
        },
        { status: 401 }
      );
    }

    const token = cookieHeader
      .split(";")
      .find((item) =>
        item.trim().startsWith("session=")
      )
      ?.split("=")[1];

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Session tidak ditemukan",
        },
        { status: 401 }
      );
    }

    const session = await prisma.session.findUnique({
      where: {
        token,
      },
      include: {
        user: true,
      },
    });

    if (
      !session ||
      session.expiresAt < new Date()
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Session tidak valid",
        },
        { status: 401 }
      );
    }

    // =========================
    // ROLE
    // =========================

    if (session.user.role !== Role.OUTLET_ADMIN) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Hanya Admin Outlet yang boleh menerima Purchase Outlet",
        },
        { status: 403 }
      );
    }

    if (!session.user.outletId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User belum terhubung dengan outlet",
        },
        { status: 400 }
      );
    }

    // =========================
    // PURCHASE
    // =========================

    const purchase =
      await prisma.outletPurchase.findUnique({
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
          },
        },
      });

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Order Outlet tidak ditemukan",
        },
        { status: 404 }
      );
    }

    // =========================
    // CEK OUTLET
    // =========================

    if (
      purchase.outletId !==
      session.user.outletId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Order ini bukan milik outlet Anda",
        },
        { status: 403 }
      );
    }

    // =========================
    // HARUS APPROVED
    // =========================

    if (
      purchase.status !==
      OutletPurchaseStatus.APPROVED
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Order Outlet harus APPROVED sebelum diterima",
        },
        { status: 400 }
      );
    }

    if (purchase.items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Order Outlet tidak memiliki barang",
        },
        { status: 400 }
      );
    }

    // =========================
    // CEGAH RECEIVE ULANG
    // =========================

    const existingReceipt =
      await prisma.outletReceipt.findFirst({
        where: {
          purchaseId: purchase.id,
        },
        select: {
          id: true,
          number: true,
        },
      });

    if (existingReceipt) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Purchase Order sudah diterima dengan nomor ${existingReceipt.number}`,
        },
        { status: 400 }
      );
    }

    // =========================
    // TRANSACTION
    // =========================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // =========================
          // NOMOR RECEIPT
          // =========================

          const lastReceipt =
            await tx.outletReceipt.findFirst({
              orderBy: {
                id: "desc",
              },
              select: {
                id: true,
              },
            });

          const nextNumber =
            (lastReceipt?.id ?? 0) + 1;

          const receiptNumber =
            `OR-${String(
              nextNumber
            ).padStart(5, "0")}`;

          // =========================
          // CREATE RECEIPT
          // =========================

          const receipt =
            await tx.outletReceipt.create({
              data: {
                number: receiptNumber,
                purchaseId: purchase.id,
                outletId: purchase.outletId,
                supplierId: purchase.supplierId,
                remarks:
                  `Penerimaan ${purchase.number}`,

                items: {
                  create:
                    purchase.items.map(
                      (item) => ({
                        barangId:
                          item.barangId,
                        qty: item.qty,
                        price: item.price,
                        subtotal:
                          item.subtotal,
                      })
                    ),
                },
              },

              include: {
                outlet: true,
                supplier: true,
                items: {
                  include: {
                    barang: true,
                  },
                },
              },
            });

          // =========================
          // UPDATE OUTLET STOCK
          // =========================

          for (const item of purchase.items) {
            const existingStock =
              await tx.outletStock.findUnique({
                where: {
                  outletId_barangId: {
                    outletId:
                      purchase.outletId,
                    barangId:
                      item.barangId,
                  },
                },
              });

            if (existingStock) {
              const oldStock =
                Number(
                  existingStock.stock
                );

              const oldAverage =
                Number(
                  existingStock.averageCost
                );

              const qty =
                Number(item.qty);

              const price =
                Number(item.price);

              const newStock =
                oldStock + qty;

              const newAverage =
                newStock > 0
                  ? (
                      oldStock *
                        oldAverage +
                      qty * price
                    ) / newStock
                  : price;

              await tx.outletStock.update({
                where: {
                  id: existingStock.id,
                },

                data: {
                  stock: newStock,
                  averageCost:
                    newAverage,
                },
              });
            } else {
              await tx.outletStock.create({
                data: {
                  outletId:
                    purchase.outletId,

                  barangId:
                    item.barangId,

                  stock:
                    Number(item.qty),

                  minimumStock:
                    Number(
                      item.barang.minimumStock
                    ),

                  averageCost:
                    Number(item.price),
                },
              });
            }

            // =========================
            // RECEIVED QTY
            // =========================

            await tx.outletPurchaseItem.update({
              where: {
                id: item.id,
              },

              data: {
                receivedQty:
                  item.qty,
              },
            });
          }

          // =========================
          // PURCHASE -> RECEIVED
          // =========================

          const updatedPurchase =
            await tx.outletPurchase.update({
              where: {
                id: purchase.id,
              },

              data: {
                status:
                  OutletPurchaseStatus.RECEIVED,
              },

              include: {
                outlet: true,
                supplier: true,
                items: {
                  include: {
                    barang: true,
                  },
                },
              },
            });

          // =========================
          // HISTORY
          // =========================

          await tx.history.create({
            data: {
              transactionType:
                "RECEIPT",

              referenceNumber:
                receipt.number,

              description:
                `Menerima Purchase Outlet ${purchase.number} untuk outlet ${purchase.outlet.name}`,

              userId:
                session.user.id,
            },
          });

          return {
            receipt,
            purchase:
              updatedPurchase,
          };
        }
      );

    return NextResponse.json({
      success: true,
      message:
        "Barang berhasil diterima dan stok outlet bertambah",
      data: result,
    });
  } catch (error) {
    console.error(
      "RECEIVE OUTLET PURCHASE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal menerima Purchase Order Outlet",
      },
      { status: 500 }
    );
  }
}