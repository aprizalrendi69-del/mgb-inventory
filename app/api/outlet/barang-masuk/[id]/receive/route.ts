import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { OutletTransferStatus } from "@prisma/client";

// =====================================================
// CURRENT LOGIN USER
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
// RESPONSE HELPER
// =====================================================

function unauthorized(
  message = "Tidak login"
) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status: 401,
    }
  );
}

function forbidden(
  message = "Anda tidak memiliki akses"
) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status: 403,
    }
  );
}

// =====================================================
// POST RECEIVE OUTLET TRANSFER
//
// ADMIN
// -> boleh menerima transfer outlet mana pun
//
// OUTLET_ADMIN
// -> HANYA boleh menerima transfer untuk outlet sendiri
//
// TIDAK BOLEH:
// -> menerima transfer outlet lain
// -> mengubah Barang.stock pusat
// -> menerima barang non-CENTRAL
// -> membuat stock untuk barang yang belum terdaftar
//   sebagai OutletBarang
// =====================================================

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
    // ===================================================
    // 1. SESSION
    // ===================================================

    const user =
      await getCurrentUser();

    if (!user) {
      return unauthorized();
    }

    if (!user.active) {
      return forbidden(
        "User tidak aktif"
      );
    }

    // ===================================================
    // 2. ROLE
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
      return forbidden(
        "Anda tidak memiliki akses menerima transfer outlet"
      );
    }

    // ===================================================
    // 3. PARAMETER ID
    // ===================================================

    const { id } =
      await params;

    const rawId = String(id || "")
      .trim();

    // ===================================================
    // Support:
    //
    // TRANSFER-1
    // 1
    // ===================================================

    const transferId = Number(
      rawId
        .replace(
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

    // ===================================================
    // 4. AMBIL TRANSFER
    // ===================================================

    const transfer =
      await prisma.outletTransfer.findUnique(
        {
          where: {
            id: transferId,
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
                barang: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    category: true,
                    unit: true,
                    purchasePrice: true,
                    sellingPrice: true,
                    minimumStock: true,
                    source: true,
                  },
                },
              },
            },
          },
        }
      );

    // ===================================================
    // 5. TRANSFER TIDAK DITEMUKAN
    // ===================================================

    if (!transfer) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Transfer tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // ===================================================
    // 6. SECURITY OUTLET
    //
    // OUTLET_ADMIN:
    //
    // transfer.outletId HARUS SAMA DENGAN
    // user.outletId.
    //
    // Jangan percaya outletId dari transfer saja.
    // ===================================================

    if (role === "OUTLET_ADMIN") {
      if (
        !user.outletId ||
        !Number.isInteger(
          user.outletId
        )
      ) {
        return forbidden(
          "User outlet belum terhubung dengan outlet"
        );
      }

      if (
        transfer.outletId !==
        user.outletId
      ) {
        return forbidden(
          "Anda tidak boleh menerima transfer untuk outlet lain"
        );
      }
    }

    // ===================================================
    // 7. OUTLET TUJUAN HARUS AKTIF
    // ===================================================

    if (!transfer.outlet) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tujuan tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    if (
      !transfer.outlet.active
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

    // ===================================================
    // 8. STATUS
    //
    // Hanya transfer yang belum diterima
    // yang boleh diproses.
    // ===================================================

    if (
      transfer.status ===
      OutletTransferStatus.RECEIVED
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Transfer sudah diterima",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // 9. BARANG HARUS ADA
    // ===================================================

    if (
      !transfer.items.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Transfer tidak memiliki barang",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // 10. TRANSACTION
    // ===================================================

    await prisma.$transaction(
      async (tx) => {
        for (const item of transfer.items) {
          // =============================================
          // VALIDASI BARANG
          // =============================================

          if (!item.barang) {
            throw new Error(
              `Barang transfer ID ${item.barangId} tidak ditemukan`
            );
          }

          // =============================================
          // BARANG HARUS CENTRAL
          //
          // Transfer gudang pusat -> outlet
          // tidak boleh membawa barang outlet sebagai
          // master sumber.
          // =============================================

          if (
            item.barang.source !==
            "CENTRAL"
          ) {
            throw new Error(
              `Barang ${item.barang.name} bukan barang Master Pusat`
            );
          }

          // =============================================
          // VALIDASI QTY
          // =============================================

          const qty =
            Number(item.qty);

          if (
            !Number.isFinite(qty) ||
            qty <= 0
          ) {
            throw new Error(
              `Qty ${item.barang.name} tidak valid`
            );
          }

          // =============================================
          // BARANG HARUS TERDAFTAR DI OUTLET
          // =============================================

          const outletBarang =
            await tx.outletBarang.findUnique(
              {
                where: {
                  outletId_barangId: {
                    outletId:
                      transfer.outletId,

                    barangId:
                      item.barangId,
                  },
                },

                select: {
                  id: true,
                  aktif: true,
                },
              }
            );

          if (!outletBarang) {
            throw new Error(
              `Barang ${item.barang.name} belum terdaftar di Master Barang Outlet`
            );
          }

          // =============================================
          // BARANG OUTLET HARUS AKTIF
          // =============================================

          if (
            !outletBarang.aktif
          ) {
            throw new Error(
              `Barang ${item.barang.name} sedang tidak aktif di outlet`
            );
          }

          // =============================================
          // CARI STOCK OUTLET
          // =============================================

          const stock =
            await tx.outletStock.findUnique(
              {
                where: {
                  outletId_barangId: {
                    outletId:
                      transfer.outletId,

                    barangId:
                      item.barangId,
                  },
                },
              }
            );

          // =============================================
          // STOCK BELUM ADA
          // =============================================

          if (!stock) {
            await tx.outletStock.create(
              {
                data: {
                  outletId:
                    transfer.outletId,

                  barangId:
                    item.barangId,

                  stock: qty,

                  minimumStock:
                    Number(
                      item.barang
                        .minimumStock ??
                        0
                    ),

                  averageCost:
                    Number(
                      item.barang
                        .purchasePrice ??
                        0
                    ),
                },
              }
            );
          }

          // =============================================
          // STOCK SUDAH ADA
          //
          // Tambahkan qty ke stock outlet.
          //
          // Barang.stock TIDAK DISENTUH.
          // =============================================

          else {
            await tx.outletStock.update(
              {
                where: {
                  id: stock.id,
                },

                data: {
                  stock: {
                    increment: qty,
                  },
                },
              }
            );
          }

          // =============================================
          // UPDATE RECEIVED QTY
          // =============================================

          await tx.outletTransferItem.update(
            {
              where: {
                id: item.id,
              },

              data: {
                receivedQty: qty,
              },
            }
          );
        }

        // =============================================
        // SET TRANSFER RECEIVED
        // =============================================

        await tx.outletTransfer.update(
          {
            where: {
              id: transfer.id,
            },

            data: {
              status:
                OutletTransferStatus.RECEIVED,
            },
          }
        );
      }
    );

    // ===================================================
    // 11. RESPONSE
    // ===================================================

    return NextResponse.json({
      success: true,

      message:
        `Transfer ${transfer.number} berhasil diterima`,

      data: {
        transferId:
          transfer.id,

        transferNumber:
          transfer.number,

        outletId:
          transfer.outletId,

        outlet:
          transfer.outlet.name,

        status:
          OutletTransferStatus.RECEIVED,
      },
    });
  } catch (error: any) {
    console.error(
      "RECEIVE OUTLET TRANSFER ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal menerima barang transfer",
      },
      {
        status: 500,
      }
    );
  }
}