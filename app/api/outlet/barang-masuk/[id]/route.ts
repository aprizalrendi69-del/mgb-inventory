import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// =====================================================
// CURRENT LOGIN USER
// =====================================================

async function getCurrentUser() {
  // ---------------------------------------------------
  // Ambil cookie session
  // ---------------------------------------------------

  const { cookies } = await import("next/headers");

  const cookieStore = await cookies();

  const session =
    cookieStore.get("erp-session");

  if (!session) {
    return null;
  }

  // ---------------------------------------------------
  // Parse session
  // ---------------------------------------------------

  let sessionData: any;

  try {
    sessionData = JSON.parse(
      session.value
    );
  } catch {
    return null;
  }

  // ---------------------------------------------------
  // Support beberapa bentuk session
  // ---------------------------------------------------

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

  // ---------------------------------------------------
  // Ambil user langsung dari database
  // ---------------------------------------------------

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
// GET DETAIL OUTLET BARANG MASUK
//
// Sumber:
//
// PURCHASE-xxx
// -> Purchase Supplier Outlet
//
// TRANSFER-xxx
// -> Transfer Gudang Pusat -> Outlet
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
// TIDAK ADA perubahan stock di endpoint ini.
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
    // 2. USER HARUS AKTIF
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
            "Tidak memiliki akses",
        },
        {
          status: 403,
        }
      );
    }

    // ===================================================
    // 4. PARAMETER
    // ===================================================

    const { id } =
      await context.params;

    const sourceId =
      String(id || "").trim();

    if (!sourceId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID barang masuk tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // 5. FILTER OUTLET
    //
    // ADMIN / MANAGER
    // -> tidak dibatasi outlet
    //
    // OUTLET_ADMIN
    // -> HANYA outlet dari user
    //
    // Penting:
    // outletId tidak pernah dipercaya dari frontend.
    // ===================================================

    let outletFilter:
      | { outletId: number }
      | Record<string, never> = {};

    if (role === "OUTLET_ADMIN") {
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
    // 6. PURCHASE SUPPLIER
    // ===================================================

    if (
      sourceId.toUpperCase().startsWith(
        "PURCHASE-"
      )
    ) {
      // -------------------------------------------------
      // Ambil ID
      // -------------------------------------------------

      const purchaseId =
        Number(
          sourceId.replace(
            /^PURCHASE-/i,
            ""
          )
        );

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
              "ID purchase tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      // -------------------------------------------------
      // Ambil Purchase
      //
      // SECURITY:
      // OUTLET_ADMIN hanya bisa mendapatkan
      // purchase dari outlet miliknya.
      // -------------------------------------------------

      const purchase =
        await prisma.outletPurchase.findFirst(
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
                },
              },

              items: {
                include: {
                  barang: true,
                },
              },
            },
          }
        );

      // -------------------------------------------------
      // Tidak ditemukan
      // -------------------------------------------------

      if (!purchase) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Purchase Order tidak ditemukan",
          },
          {
            status: 404,
          }
        );
      }

      // -------------------------------------------------
      // Outlet harus aktif
      // -------------------------------------------------

      if (
        !purchase.outlet?.active
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet tujuan tidak aktif",
          },
          {
            status: 400,
          }
        );
      }

      // -------------------------------------------------
      // SECURITY BARANG
      //
      // Semua barang Purchase Outlet harus berasal
      // dari Master Barang Central.
      // -------------------------------------------------

      for (
        const item of purchase.items
      ) {
        if (!item.barang) {
          return NextResponse.json(
            {
              success: false,
              message:
                `Barang ID ${item.barangId} tidak ditemukan`,
            },
            {
              status: 400,
            }
          );
        }

        if (
          item.barang.source !==
          "CENTRAL"
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                `Barang ${item.barang.name} bukan berasal dari Master Barang Pusat`,
            },
            {
              status: 400,
            }
          );
        }
      }

      // -------------------------------------------------
      // RESPONSE
      //
      // Struktur dipertahankan agar frontend
      // yang sekarang tidak perlu diubah.
      // -------------------------------------------------

      return NextResponse.json({
        success: true,

        data: {
          id: purchase.id,

          sourceId:
            purchase.id,

          sumber:
            "PURCHASE",

          nomor:
            purchase.number,

          tanggal:
            purchase.purchaseDate,

          status:
            purchase.status,

          remarks:
            purchase.remarks ||
            null,

          outlet:
            purchase.outlet
              ? {
                  id:
                    purchase.outlet
                      .id,

                  code:
                    purchase.outlet
                      .code,

                  name:
                    purchase.outlet
                      .name,
                }
              : null,

          supplier:
            purchase.supplier
              ? {
                  id:
                    purchase.supplier
                      .id,

                  code:
                    purchase.supplier
                      .code,

                  name:
                    purchase.supplier
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
                  item.qty,

                receivedQty:
                  item.receivedQty,

                price:
                  item.price,

                subtotal:
                  item.subtotal,

                barang:
                  item.barang,
              })
            ),
        },
      });
    }

    // ===================================================
    // 7. TRANSFER GUDANG PUSAT
    // ===================================================

    if (
      sourceId.toUpperCase().startsWith(
        "TRANSFER-"
      )
    ) {
      // -------------------------------------------------
      // Ambil ID
      // -------------------------------------------------

      const transferId =
        Number(
          sourceId.replace(
            /^TRANSFER-/i,
            ""
          )
        );

      if (
        !Number.isInteger(
          transferId
        ) ||
        transferId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "ID transfer tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      // -------------------------------------------------
      // Ambil transfer
      //
      // OUTLET_ADMIN hanya bisa mendapatkan
      // transfer ke outlet miliknya.
      // -------------------------------------------------

      const transfer =
        await prisma.outletTransfer.findFirst(
          {
            where: {
              id: transferId,

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
          }
        );

      // -------------------------------------------------
      // Tidak ditemukan
      // -------------------------------------------------

      if (!transfer) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Data transfer tidak ditemukan",
          },
          {
            status: 404,
          }
        );
      }

      // -------------------------------------------------
      // Outlet harus aktif
      // -------------------------------------------------

      if (
        !transfer.outlet?.active
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet tujuan tidak aktif",
          },
          {
            status: 400,
          }
        );
      }

      // -------------------------------------------------
      // SECURITY BARANG
      // -------------------------------------------------

      for (
        const item of transfer.items
      ) {
        if (!item.barang) {
          return NextResponse.json(
            {
              success: false,
              message:
                `Barang ID ${item.barangId} tidak ditemukan`,
            },
            {
              status: 400,
            }
          );
        }

        if (
          item.barang.source !==
          "CENTRAL"
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                `Barang ${item.barang.name} bukan berasal dari Master Barang Pusat`,
            },
            {
              status: 400,
            }
          );
        }
      }

      // -------------------------------------------------
      // RESPONSE
      // -------------------------------------------------

      return NextResponse.json({
        success: true,

        data: {
          id:
            transfer.id,

          sourceId:
            transfer.id,

          sumber:
            "TRANSFER",

          nomor:
            transfer.number,

          tanggal:
            transfer.transferDate,

          status:
            transfer.status,

          remarks:
            null,

          outlet:
            transfer.outlet
              ? {
                  id:
                    transfer.outlet
                      .id,

                  code:
                    transfer.outlet
                      .code,

                  name:
                    transfer.outlet
                      .name,
                }
              : null,

          supplier:
            null,

          purchase:
            null,

          items:
            transfer.items.map(
              (item) => {
                const price =
                  item.barang
                    ?.purchasePrice ??
                  0;

                return {
                  id:
                    item.id,

                  barangId:
                    item.barangId,

                  qty:
                    item.qty,

                  receivedQty:
                    item.receivedQty,

                  price,

                  subtotal:
                    Number(
                      item.qty
                    ) *
                    Number(price),

                  barang:
                    item.barang,
                };
              }
            ),
        },
      });
    }

    // ===================================================
    // 8. SOURCE TIDAK DIKENALI
    // ===================================================

    return NextResponse.json(
      {
        success: false,
        message:
          "Sumber barang masuk tidak dikenali",
      },
      {
        status: 400,
      }
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