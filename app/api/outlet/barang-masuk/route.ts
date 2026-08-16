import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// =====================================================
// CURRENT USER
// =====================================================

async function getCurrentUser() {
  const cookieStore = await cookies();

  const session =
    cookieStore.get("erp-session");

  if (!session) {
    return null;
  }

  let sessionData: any;

  try {
    sessionData = JSON.parse(
      session.value
    );
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
// GET OUTLET BARANG MASUK
//
// SUMBER:
//
// 1. PURCHASE
//    Supplier -> Outlet
//
// 2. TRANSFER
//    Gudang Pusat -> Outlet
//
// SECURITY:
//
// ADMIN
// -> semua outlet
//
// MANAGER
// -> semua outlet
//
// OUTLET_ADMIN
// -> hanya outlet sendiri
//
// Tidak menerima outletId dari frontend.
// =====================================================

export async function GET() {
  try {
    // ===================================================
    // 1. SESSION
    // ===================================================

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        {
          status: 401,
        }
      );
    }

    // ===================================================
    // 2. USER AKTIF
    // ===================================================

    if (!user.active) {
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

    // ===================================================
    // 3. ROLE
    // ===================================================

    const role =
      String(
        user.role || ""
      ).toUpperCase();

    if (
      role !== "ADMIN" &&
      role !== "MANAGER" &&
      role !== "OUTLET_ADMIN"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak memiliki akses barang masuk outlet",
        },
        {
          status: 403,
        }
      );
    }

    // ===================================================
    // 4. FILTER OUTLET
    //
    // ADMIN / MANAGER
    // -> semua outlet
    //
    // OUTLET_ADMIN
    // -> outlet miliknya saja
    //
    // TIDAK ADA outletId dari query.
    // ===================================================

    let outletFilter: any = {};

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
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet belum terhubung dengan outlet",
          },
          {
            status: 400,
          }
        );
      }

      outletFilter = {
        outletId:
          user.outletId,
      };
    }

    // ===================================================
    // 5. PURCHASE OUTLET
    // ===================================================

    const purchases =
      await prisma.outletPurchase.findMany(
        {
          where: {
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
              },
            },

            items: {
              include: {
                barang: true,
              },
            },
          },

          orderBy: {
            purchaseDate:
              "desc",
          },
        }
      );

    // ===================================================
    // 6. VALIDASI PURCHASE
    //
    // Jangan tampilkan data yang outlet-nya tidak aktif.
    // Jangan tampilkan barang non-CENTRAL.
    // ===================================================

    const validPurchases =
      purchases.filter(
        (purchase) => {
          // ---------------------------------------------
          // Outlet harus ada dan aktif
          // ---------------------------------------------

          if (
            !purchase.outlet ||
            !purchase.outlet.active
          ) {
            return false;
          }

          // ---------------------------------------------
          // Semua barang harus CENTRAL
          // ---------------------------------------------

          return purchase.items.every(
            (item) =>
              item.barang &&
              item.barang.source ===
                "CENTRAL"
          );
        }
      );

    // ===================================================
    // 7. MAP PURCHASE
    // ===================================================

    const purchaseData =
      validPurchases.map(
        (purchase) => {
          const totalItem =
            purchase.items.reduce(
              (
                total,
                item
              ) =>
                total +
                Number(
                  item.qty ??
                    0
                ),
              0
            );

          const totalReceived =
            purchase.items.reduce(
              (
                total,
                item
              ) =>
                total +
                Number(
                  item.receivedQty ??
                    0
                ),
              0
            );

          // ---------------------------------------------
          // STATUS
          // ---------------------------------------------

          let status =
            String(
              purchase.status
            );

          if (
            totalReceived >
              0 &&
            totalReceived <
              totalItem
          ) {
            status =
              "PARTIAL";
          }

          if (
            totalItem >
              0 &&
            totalReceived >=
              totalItem
          ) {
            status =
              "RECEIVED";
          }

          return {
            id: `PURCHASE-${purchase.id}`,

            sourceId:
              purchase.id,

            sumber:
              "PURCHASE" as const,

            nomor:
              purchase.number,

            tanggal:
              purchase.purchaseDate,

            status,

            totalItem,

            totalReceived,

            outlet:
              purchase.outlet
                ? {
                    id:
                      purchase
                        .outlet
                        .id,

                    code:
                      purchase
                        .outlet
                        .code,

                    name:
                      purchase
                        .outlet
                        .name,
                  }
                : null,

            supplier:
              purchase.supplier
                ? {
                    id:
                      purchase
                        .supplier
                        .id,

                    code:
                      purchase
                        .supplier
                        .code,

                    name:
                      purchase
                        .supplier
                        .name,
                  }
                : null,

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
                purchase.remarks,
            },

            items:
              purchase.items.map(
                (item) => ({
                  id:
                    item.id,

                  barangId:
                    item.barangId,

                  qty:
                    Number(
                      item.qty ??
                        0
                    ),

                  receivedQty:
                    Number(
                      item.receivedQty ??
                        0
                    ),

                  price:
                    Number(
                      item.price ??
                        0
                    ),

                  subtotal:
                    Number(
                      item.subtotal ??
                        0
                    ),

                  barang:
                    item.barang,
                })
              ),
          };
        }
      );

    // ===================================================
    // 8. TRANSFER GUDANG PUSAT -> OUTLET
    // ===================================================

    const transfers =
      await prisma.outletTransfer.findMany(
        {
          where: {
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

            items: {
              include: {
                barang: true,
              },
            },
          },

          orderBy: {
            transferDate:
              "desc",
          },
        }
      );

    // ===================================================
    // 9. VALIDASI TRANSFER
    // ===================================================

    const validTransfers =
      transfers.filter(
        (transfer) => {
          // ---------------------------------------------
          // Outlet harus ada dan aktif
          // ---------------------------------------------

          if (
            !transfer.outlet ||
            !transfer.outlet.active
          ) {
            return false;
          }

          // ---------------------------------------------
          // Semua barang harus CENTRAL
          // ---------------------------------------------

          return transfer.items.every(
            (item) =>
              item.barang &&
              item.barang.source ===
                "CENTRAL"
          );
        }
      );

    // ===================================================
    // 10. MAP TRANSFER
    // ===================================================

    const transferData =
      validTransfers.map(
        (transfer) => {
          const totalItem =
            transfer.items.reduce(
              (
                total,
                item
              ) =>
                total +
                Number(
                  item.qty ??
                    0
                ),
              0
            );

          const totalReceived =
            transfer.items.reduce(
              (
                total,
                item
              ) =>
                total +
                Number(
                  item.receivedQty ??
                    0
                ),
              0
            );

          // ---------------------------------------------
          // STATUS
          // ---------------------------------------------

          let status =
            String(
              transfer.status
            );

          if (
            totalReceived >
              0 &&
            totalReceived <
              totalItem
          ) {
            status =
              "PARTIAL";
          }

          if (
            totalItem >
              0 &&
            totalReceived >=
              totalItem
          ) {
            status =
              "RECEIVED";
          }

          return {
            id: `TRANSFER-${transfer.id}`,

            sourceId:
              transfer.id,

            sumber:
              "TRANSFER" as const,

            nomor:
              transfer.number,

            tanggal:
              transfer.transferDate,

            status,

            totalItem,

            totalReceived,

            outlet:
              transfer.outlet
                ? {
                    id:
                      transfer
                        .outlet
                        .id,

                    code:
                      transfer
                        .outlet
                        .code,

                    name:
                      transfer
                        .outlet
                        .name,
                  }
                : null,

            supplier:
              null,

            purchase:
              null,

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
                transfer.remarks,
            },

            items:
              transfer.items.map(
                (item) => {
                  const price =
                    Number(
                      item.barang
                        ?.purchasePrice ??
                        0
                    );

                  const qty =
                    Number(
                      item.qty ??
                        0
                    );

                  return {
                    id:
                      item.id,

                    barangId:
                      item.barangId,

                    qty,

                    receivedQty:
                      Number(
                        item.receivedQty ??
                          0
                      ),

                    price,

                    subtotal:
                      qty * price,

                    barang:
                      item.barang,
                  };
                }
              ),
          };
        }
      );

    // ===================================================
    // 11. GABUNGKAN
    // ===================================================

    const data = [
      ...purchaseData,
      ...transferData,
    ].sort(
      (a, b) =>
        new Date(
          b.tanggal
        ).getTime() -
        new Date(
          a.tanggal
        ).getTime()
    );

    // ===================================================
    // 12. RESPONSE
    // ===================================================

    return NextResponse.json({
      success: true,

      user: {
        id:
          user.id,

        fullname:
          user.fullname,

        role:
          user.role,

        outletId:
          user.outletId,
      },

      data,
    });
  } catch (error: any) {
    console.error(
      "GET OUTLET BARANG MASUK ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal mengambil data barang masuk outlet",
      },
      {
        status: 500,
      }
    );
  }
}