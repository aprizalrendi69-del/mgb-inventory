import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

// =========================================================
// GET DELIVERY ORDER DETAIL
// =========================================================

export async function GET(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    // =======================================================
    // PARAMETER
    // =======================================================

    const { id } = await context.params;

    const deliveryId = Number(id);

    if (
      !Number.isInteger(deliveryId) ||
      deliveryId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID Delivery Order tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =======================================================
    // GET DELIVERY
    // =======================================================

    const delivery =
      await prisma.delivery.findUnique({
        where: {
          id: deliveryId,
        },

        include: {
          customer: true,

          suratJalan: true,

          items: {
            include: {
              barang: {
                include: {
                  priceSummary: true,
                },
              },
            },
          },
        },
      });

    // =======================================================
    // NOT FOUND
    // =======================================================

    if (!delivery) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Delivery Order tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =======================================================
    // FORMAT ITEMS
    // =======================================================

    const items =
      delivery.items.map((item) => {
        const qty =
          Number(item.qty ?? 0);

        const deliveryPrice =
          Number(item.price ?? 0);

        const summaryPrice =
          Number(
            item.barang?.priceSummary
              ?.lastPrice ?? 0
          );

        // ---------------------------------------------------
        // PRIORITAS HARGA
        //
        // 1. Harga pada DeliveryItem
        // 2. PriceSummary
        // ---------------------------------------------------

        const price =
          deliveryPrice > 0
            ? deliveryPrice
            : summaryPrice;

        const subtotal =
          Number(
            item.subtotal ?? 0
          ) > 0
            ? Number(item.subtotal)
            : qty * price;

        // ===================================================
        // PENTING
        //
        // Field VOID sengaja dikirim secara eksplisit.
        // Jangan dihilangkan.
        // ===================================================

        return {
          id: item.id,

          deliveryId:
            item.deliveryId,

          barangId:
            item.barangId,

          qty,

          price,

          subtotal,

          note:
            item.note ?? null,

          // =================================================
          // VOID DATA
          // =================================================

          voided:
            item.voided === true,

          voidedAt:
            item.voidedAt ?? null,

          voidedById:
            item.voidedById ?? null,

          voidReason:
            item.voidReason ?? null,

          // =================================================
          // BARANG
          // =================================================

          barang: item.barang
            ? {
                id:
                  item.barang.id,

                code:
                  item.barang.code,

                name:
                  item.barang.name,

                unit:
                  item.barang.unit,

                sellingPrice:
                  item.barang
                    .sellingPrice,

                purchasePrice:
                  item.barang
                    .purchasePrice,

                minimumStock:
                  item.barang
                    .minimumStock,
              }
            : null,
        };
      });

    // =======================================================
    // TOTAL NILAI
    //
    // Tetap menghitung semua item agar nilai DO historis
    // tidak berubah hanya karena item di-void.
    // =======================================================

    const total =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum +
          Number(
            item.subtotal ?? 0
          ),
        0
      );

    // =======================================================
    // TOTAL QTY AKTIF
    //
    // Item VOID tidak dihitung.
    // =======================================================

    const activeTotalQty =
      items.reduce(
        (
          sum,
          item
        ) =>
          !item.voided
            ? sum +
              Number(
                item.qty ?? 0
              )
            : sum,
        0
      );

    // =======================================================
    // TOTAL QTY VOID
    // =======================================================

    const voidedTotalQty =
      items.reduce(
        (
          sum,
          item
        ) =>
          item.voided
            ? sum +
              Number(
                item.qty ?? 0
              )
            : sum,
        0
      );

    // =======================================================
    // RESPONSE
    // =======================================================

    return NextResponse.json({
      success: true,

      data: {
        id:
          delivery.id,

        number:
          delivery.number,

        customerId:
          delivery.customerId,

        deliveryDate:
          delivery.deliveryDate,

        status:
          delivery.status,

        totalQty:
          activeTotalQty,

        remarks:
          delivery.remarks,

        customer:
          delivery.customer,

        suratJalan:
          delivery.suratJalan,

        items,

        total,

        activeTotalQty,

        voidedTotalQty,
      },
    });
  } catch (error) {
    console.error(
      "GET DELIVERY ORDER DETAIL ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil Delivery Order",
      },
      {
        status: 500,
      }
    );
  }
}

// =========================================================
// DELETE DELIVERY ORDER
// =========================================================
//
// RULE BISNIS TERKUNCI:
//
// 1. Hanya ADMIN PUSAT.
// 2. Hanya Delivery dengan status DRAFT.
// 3. Berlaku untuk:
//      - DO biasa
//      - DO-DR-* dari Delivery Request
// 4. Jika berasal dari Delivery Request:
//      DeliveryRequest dikembalikan menjadi APPROVED.
// 5. Tidak ada perubahan stock.
// 6. DO RELEASED tidak boleh dihapus.
// =========================================================

export async function DELETE(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    // =======================================================
    // PARAMETER
    // =======================================================

    const { id } = await context.params;

    const deliveryId = Number(id);

    if (
      !Number.isInteger(deliveryId) ||
      deliveryId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID Delivery Order tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =======================================================
    // CURRENT USER
    // =======================================================

    const cookieStore =
      await cookies();

    const sessionCookie =
      cookieStore.get(
        "erp-session"
      ) ??
      cookieStore.get(
        "session"
      );

    if (!sessionCookie?.value) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Session tidak ditemukan",
        },
        {
          status: 401,
        }
      );
    }

    let sessionData: any;

    try {
      sessionData =
        JSON.parse(
          sessionCookie.value
        );
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Session tidak valid",
        },
        {
          status: 401,
        }
      );
    }

    const sessionUserId =
      Number(
        sessionData?.id ??
        sessionData?.userId
      );

    if (
      !Number.isInteger(
        sessionUserId
      ) ||
      sessionUserId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User session tidak valid",
        },
        {
          status: 401,
        }
      );
    }

    // =======================================================
    // LOAD USER
    // =======================================================

    const currentUser =
      await prisma.user.findUnique({
        where: {
          id: sessionUserId,
        },

        select: {
          id: true,
          username: true,
          fullname: true,
          role: true,
          active: true,
          outletId: true,
        },
      });

    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User tidak ditemukan",
        },
        {
          status: 401,
        }
      );
    }

    if (!currentUser.active) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User tidak aktif",
        },
        {
          status: 403,
        }
      );
    }

    // =======================================================
    // ONLY ADMIN PUSAT
    // =======================================================

    if (
      currentUser.role !==
      "ADMIN"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Hanya Admin Pusat yang dapat menghapus Delivery Order",
        },
        {
          status: 403,
        }
      );
    }

    // =======================================================
    // LOAD DELIVERY
    // =======================================================

    const delivery =
      await prisma.delivery.findUnique({
        where: {
          id: deliveryId,
        },

        select: {
          id: true,
          number: true,
          status: true,

          // Relasi yang sudah dibuat oleh
          // Delivery Request → Delivery.
          deliveryRequest: {
            select: {
              id: true,
              number: true,
              status: true,
              deliveryId: true,
            },
          },

          suratJalan: {
            select: {
              id: true,
            },
          },

          outletTransfer: {
            select: {
              id: true,
            },
          },
        },
      });

    // =======================================================
    // NOT FOUND
    // =======================================================

    if (!delivery) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Delivery Order tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =======================================================
    // ONLY DRAFT
    // =======================================================

    if (
      delivery.status !==
      "DRAFT"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Delivery Order ${delivery.number} tidak dapat dihapus karena statusnya ${delivery.status}. Hanya Delivery Order DRAFT yang dapat dihapus.`,
        },
        {
          status: 400,
        }
      );
    }

    // =======================================================
    // TRANSACTION
    // =======================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // =================================================
          // RE-CHECK DELIVERY
          //
          // Penting supaya status tidak berubah antara
          // pengecekan awal dan transaction.
          // =================================================

          const currentDelivery =
            await tx.delivery.findUnique({
              where: {
                id: deliveryId,
              },

              select: {
                id: true,
                number: true,
                status: true,
              },
            });

          if (!currentDelivery) {
            throw new Error(
              "Delivery Order tidak ditemukan"
            );
          }

          if (
            currentDelivery.status !==
            "DRAFT"
          ) {
            throw new Error(
              `Delivery Order ${currentDelivery.number} sudah tidak berstatus DRAFT dan tidak dapat dihapus`
            );
          }

          // =================================================
          // CARI DELIVERY REQUEST
          //
          // Tidak hanya berdasarkan prefix DO-DR.
          // Relasi database tetap menjadi sumber kebenaran.
          // =================================================

          const deliveryRequest =
            await tx.deliveryRequest.findFirst({
              where: {
                deliveryId:
                  deliveryId,
              },

              select: {
                id: true,
                number: true,
                status: true,
              },
            });

          // =================================================
          // CARI OUTLET TRANSFER
          // =================================================

          const outletTransfer =
            await tx.outletTransfer.findFirst({
              where: {
                deliveryId:
                  deliveryId,
              },

              select: {
                id: true,
              },
            });

          // =================================================
          // CARI SURAT JALAN
          // =================================================

          const suratJalan =
            await tx.suratJalan.findFirst({
              where: {
                deliveryId:
                  deliveryId,
              },

              select: {
                id: true,
              },
            });

          // =================================================
          // SAFETY CHECK
          //
          // Karena hanya DRAFT yang boleh dihapus,
          // OutletTransfer seharusnya belum menyebabkan
          // pergerakan stock.
          //
          // Jika ternyata sudah ada transfer, tetap kita
          // hapus hanya karena masih bagian dari DO DRAFT.
          // Tidak ada stock rollback karena RELEASE belum
          // pernah dilakukan.
          // =================================================

          // =================================================
          // DELETE OUTLET TRANSFER ITEMS
          // =================================================

          if (
            outletTransfer
          ) {
            await tx.outletTransferItem.deleteMany(
              {
                where: {
                  transferId:
                    outletTransfer.id,
                },
              }
            );

            // -----------------------------------------------
            // DELETE OUTLET TRANSFER
            // -----------------------------------------------

            await tx.outletTransfer.delete({
              where: {
                id:
                  outletTransfer.id,
              },
            });
          }

          // =================================================
          // DELETE SURAT JALAN
          // =================================================

          if (
            suratJalan
          ) {
            await tx.suratJalan.delete({
              where: {
                id:
                  suratJalan.id,
              },
            });
          }

          // =================================================
          // DELETE DELIVERY ITEMS
          // =================================================

          await tx.deliveryItem.deleteMany({
            where: {
              deliveryId:
                deliveryId,
            },
          });

          // =================================================
          // DELETE DELIVERY
          // =================================================

          await tx.delivery.delete({
            where: {
              id:
                deliveryId,
            },
          });

          // =================================================
          // DELIVERY REQUEST
          //
          // Kalau DO berasal dari Delivery Request,
          // request tidak ikut dihapus.
          //
          // Request dikembalikan ke APPROVED supaya dapat
          // PROCESS ulang menjadi Delivery DRAFT baru.
          // =================================================

          if (
            deliveryRequest
          ) {
            await tx.deliveryRequest.update({
              where: {
                id:
                  deliveryRequest.id,
              },

              data: {
                status:
                  "APPROVED",

                deliveryId:
                  null,
              },
            });
          }

          return {
            deliveryId,
            deliveryNumber:
              currentDelivery.number,

            deliveryRequestId:
              deliveryRequest?.id ??
              null,

            deliveryRequestNumber:
              deliveryRequest?.number ??
              null,
          };
        }
      );

    // =======================================================
    // RESPONSE
    // =======================================================

    return NextResponse.json({
      success: true,

      message:
        result.deliveryRequestId
          ? `Delivery Order ${result.deliveryNumber} berhasil dihapus. Delivery Request ${result.deliveryRequestNumber} dikembalikan ke status APPROVED dan dapat diproses kembali.`
          : `Delivery Order ${result.deliveryNumber} berhasil dihapus.`,

      data: {
        deliveryId:
          result.deliveryId,

        deliveryNumber:
          result.deliveryNumber,

        deliveryRequestId:
          result.deliveryRequestId,

        deliveryRequestNumber:
          result.deliveryRequestNumber,

        stockChanged:
          false,
      },
    });
  } catch (error) {
    console.error(
      "DELETE DELIVERY ORDER ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Gagal menghapus Delivery Order";

    // =======================================================
    // BUSINESS ERROR
    // =======================================================

    if (
      message.includes(
        "tidak ditemukan"
      ) ||
      message.includes(
        "sudah tidak berstatus DRAFT"
      )
    ) {
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

    // =======================================================
    // SERVER ERROR
    // =======================================================

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal menghapus Delivery Order",
      },
      {
        status: 500,
      }
    );
  }
}