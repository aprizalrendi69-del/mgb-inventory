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
// PARSE SOURCE KEY
//
// Support:
//
// PURCHASE-123
// TRANSFER-28
//
// Backward compatible:
//
// 123
// 28
//
// Numeric lama akan dianggap PURCHASE.
// =====================================================

function parseSourceKey(
  rawId: string
) {
  const value = String(
    rawId || ""
  )
    .trim()
    .toUpperCase();

  if (!value) {
    return null;
  }

  // ================================================
  // PURCHASE-123
  // ================================================

  if (
    value.startsWith(
      "PURCHASE-"
    )
  ) {
    const idText =
      value.substring(
        "PURCHASE-".length
      );

    const id = Number(
      idText
    );

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

  // ================================================
  // TRANSFER-123
  // ================================================

  if (
    value.startsWith(
      "TRANSFER-"
    )
  ) {
    const idText =
      value.substring(
        "TRANSFER-".length
      );

    const id = Number(
      idText
    );

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

  // ================================================
  // BACKWARD COMPATIBILITY
  //
  // /api/outlet/barang-masuk/28
  //
  // Dulu kemungkinan dianggap Purchase.
  // ================================================

  const numericId =
    Number(value);

  if (
    Number.isInteger(
      numericId
    ) &&
    numericId > 0
  ) {
    return {
      source: "NUMERIC" as const,
      id: numericId,
      sourceKey: String(
        numericId
      ),
    };
  }

  return null;
}

// =====================================================
// GET DETAIL OUTLET BARANG MASUK
//
// Supported:
//
// PURCHASE-{id}
// TRANSFER-{id}
// {id}               -> backward compatibility
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

    const rawId =
      String(
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
      parseSourceKey(
        rawId
      );

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
    // -> hanya outlet miliknya
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

    // =================================================
    // =================================================
    // PURCHASE
    // =================================================
    // =================================================

    if (
      parsed.source ===
        "PURCHASE" ||
      parsed.source ===
        "NUMERIC"
    ) {
      const purchase =
        await prisma.outletPurchase.findFirst(
          {
            where: {
              id: parsed.id,
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

      if (!purchase) {
        return jsonError(
          "Purchase Order tidak ditemukan",
          404
        );
      }

      if (!purchase.outlet) {
        return jsonError(
          "Outlet tujuan tidak ditemukan",
          404
        );
      }

      if (
        !purchase.outlet.active
      ) {
        return jsonError(
          "Outlet tujuan tidak aktif",
          400
        );
      }

      // =================================================
      // VALIDASI ITEM
      // =================================================

      for (
        const item of purchase.items
      ) {
        if (!item.barang) {
          return jsonError(
            `Barang ID ${item.barangId} tidak ditemukan`,
            400
          );
        }

        if (
          item.barang.source !==
          "CENTRAL"
        ) {
          return jsonError(
            `Barang ${item.barang.name} bukan berasal dari Master Barang Pusat`,
            400
          );
        }

        const qty =
          Number(
            item.qty
          );

        if (
          !Number.isFinite(qty) ||
          qty <= 0
        ) {
          return jsonError(
            `Qty barang ${item.barang.name} tidak valid`,
            400
          );
        }

        const receivedQty =
          Number(
            item.receivedQty
          );

        if (
          !Number.isFinite(
            receivedQty
          ) ||
          receivedQty < 0
        ) {
          return jsonError(
            `Received qty barang ${item.barang.name} tidak valid`,
            400
          );
        }
      }

      // =================================================
      // RESPONSE PURCHASE
      // =================================================

      return NextResponse.json({
        success: true,

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
            purchase.remarks ||
            null,

          outlet: {
            id:
              purchase.outlet.id,

            code:
              purchase.outlet.code,

            name:
              purchase.outlet.name,
          },

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

          sourceOutlet:
            null,

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

          transfer:
            null,

          items:
            purchase.items.map(
              (item) => ({
                id:
                  item.id,

                barangId:
                  item.barangId,

                qty:
                  Number(
                    item.qty
                  ),

                receivedQty:
                  Number(
                    item.receivedQty
                  ),

                price:
                  Number(
                    item.price
                  ),

                subtotal:
                  Number(
                    item.subtotal
                  ),

                barang:
                  item.barang,
              })
            ),
        },
      });
    }

    // =================================================
    // =================================================
    // TRANSFER
    // =================================================
    // =================================================

    if (
      parsed.source ===
      "TRANSFER"
    ) {
      const transfer =
        await prisma.outletTransfer.findFirst(
          {
            where: {
              id: parsed.id,

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

              items: {
                include: {
                  barang: true,
                },
              },
            },
          }
        );

      if (!transfer) {
        return jsonError(
          "Data transfer tidak ditemukan",
          404
        );
      }

      // =================================================
      // DESTINATION
      // =================================================

      if (!transfer.outlet) {
        return jsonError(
          "Outlet tujuan tidak ditemukan",
          404
        );
      }

      if (
        !transfer.outlet.active
      ) {
        return jsonError(
          "Outlet tujuan tidak aktif",
          400
        );
      }

      // =================================================
      // SOURCE OUTLET
      //
      // NULL = GUDANG PUSAT
      // =================================================

      if (
        transfer.sourceOutlet &&
        !transfer.sourceOutlet.active
      ) {
        return jsonError(
          "Outlet sumber transfer tidak aktif",
          400
        );
      }

      // =================================================
      // ITEM
      // =================================================

      if (
        !transfer.items ||
        transfer.items.length === 0
      ) {
        return jsonError(
          "Transfer tidak memiliki barang",
          400
        );
      }

      // =================================================
      // VALIDASI ITEM
      // =================================================

      for (
        const item of transfer.items
      ) {
        if (!item.barang) {
          return jsonError(
            `Barang ID ${item.barangId} tidak ditemukan`,
            400
          );
        }

        if (
          item.barang.source !==
          "CENTRAL"
        ) {
          return jsonError(
            `Barang ${item.barang.name} bukan berasal dari Master Barang Pusat`,
            400
          );
        }

        const qty =
          Number(
            item.qty
          );

        if (
          !Number.isFinite(qty) ||
          qty <= 0
        ) {
          return jsonError(
            `Qty barang ${item.barang.name} tidak valid`,
            400
          );
        }

        const receivedQty =
          Number(
            item.receivedQty
          );

        if (
          !Number.isFinite(
            receivedQty
          ) ||
          receivedQty < 0
        ) {
          return jsonError(
            `Received qty barang ${item.barang.name} tidak valid`,
            400
          );
        }

        if (
          receivedQty >
          qty
        ) {
          return jsonError(
            `Received qty barang ${item.barang.name} melebihi qty transfer`,
            400
          );
        }
      }

      // =================================================
      // RESPONSE TRANSFER
      // =================================================

      return NextResponse.json({
        success: true,

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
            transfer.remarks ||
            null,

          // =============================================
          // SOURCE OUTLET
          //
          // NULL = GUDANG PUSAT
          // =============================================

          sourceOutlet:
            transfer.sourceOutlet
              ? {
                  id:
                    transfer
                      .sourceOutlet
                      .id,

                  code:
                    transfer
                      .sourceOutlet
                      .code,

                  name:
                    transfer
                      .sourceOutlet
                      .name,
                }
              : null,

          // =============================================
          // DESTINATION
          // =============================================

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

            sourceOutlet:
              transfer.sourceOutlet
                ? {
                    id:
                      transfer
                        .sourceOutlet
                        .id,

                    code:
                      transfer
                        .sourceOutlet
                        .code,

                    name:
                      transfer
                        .sourceOutlet
                        .name,
                  }
                : null,

            destinationOutlet: {
              id:
                transfer.outlet
                  .id,

              code:
                transfer.outlet
                  .code,

              name:
                transfer.outlet
                  .name,
            },
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
                    item.qty
                  );

                const receivedQty =
                  Number(
                    item.receivedQty
                  );

                return {
                  id:
                    item.id,

                  barangId:
                    item.barangId,

                  qty,

                  receivedQty,

                  price,

                  subtotal:
                    qty * price,

                  barang:
                    item.barang,
                };
              }
            ),
        },
      });
    }

    // =================================================
    // FALLBACK
    // =================================================

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