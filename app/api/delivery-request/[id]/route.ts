import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

// ============================================================
// TYPES
// ============================================================

type SessionUser = {
  id: number;
  username: string;
  fullname: string;
  role: string;
  active: boolean;
  outletId: number | null;
  customerId: number | null;
};

// ============================================================
// HELPERS
// ============================================================

async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("erp-session");

    if (!sessionCookie?.value) {
      return null;
    }

    let sessionData: { id?: number };

    try {
      sessionData = JSON.parse(sessionCookie.value);
    } catch (error) {
      console.error(
        "[DELIVERY REQUEST] INVALID ERP SESSION:",
        error
      );

      return null;
    }

    if (
      !sessionData?.id ||
      !Number.isInteger(Number(sessionData.id)) ||
      Number(sessionData.id) <= 0
    ) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: Number(sessionData.id),
      },
      select: {
        id: true,
        username: true,
        fullname: true,
        role: true,
        active: true,
        outletId: true,
        customerId: true,
      },
    });

    if (!user) {
      return null;
    }

    if (!user.active) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      fullname: user.fullname,
      role: user.role,
      active: user.active,
      outletId: user.outletId,
      customerId: user.customerId,
    };
  } catch (error) {
    console.error(
      "[DELIVERY REQUEST] GET CURRENT USER ERROR:",
      error
    );

    return null;
  }
}

function errorResponse(
  message: string,
  status = 400,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      success: false,
      message,
      ...(extra || {}),
    },
    { status }
  );
}

function successResponse(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(
    {
      success: true,
      ...data,
    },
    { status }
  );
}

// ============================================================
// GET DELIVERY REQUEST DETAIL
// ============================================================

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse(
        "Unauthorized. Silakan login kembali.",
        401
      );
    }

    const { id: idParam } = await context.params;
    const id = Number(idParam);

    if (!Number.isInteger(id) || id <= 0) {
      return errorResponse(
        "ID Delivery Request tidak valid.",
        400
      );
    }

    const deliveryRequest =
      await prisma.deliveryRequest.findUnique({
        where: {
          id,
        },
        include: {
          outlet: true,

          createdBy: {
            select: {
              id: true,
              username: true,
              fullname: true,
              role: true,
              outletId: true,
            },
          },

          customer: true,

          delivery: {
            include: {
              items: {
                include: {
                  barang: true,
                },
              },
            },
          },

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

    if (!deliveryRequest) {
      return errorResponse(
        "Delivery Request tidak ditemukan.",
        404
      );
    }

    // ========================================================
    // ACCESS CONTROL
    // ========================================================

    if (
      user.role === "OUTLET_ADMIN" &&
      user.outletId !== deliveryRequest.outletId
    ) {
      return errorResponse(
        "Anda tidak memiliki akses ke Delivery Request outlet ini.",
        403
      );
    }

    return successResponse({
      data: deliveryRequest,
    });
  } catch (error) {
    console.error(
      "[DELIVERY REQUEST] GET ERROR:",
      error
    );

    return errorResponse(
      "Gagal mengambil detail Delivery Request.",
      500
    );
  }
}

// ============================================================
// UPDATE DELIVERY REQUEST
// ============================================================
//
// EDIT HANYA BOLEH SAAT:
//
// PENDING = Menunggu Approval
//
// Tidak boleh:
//
// APPROVED
// PROCESSING
// COMPLETED
//
// Dan tidak boleh jika sudah punya Delivery.
//
// ============================================================
//
// PAYLOAD:
//
// {
//   items: [
//     {
//       id: number | null,
//       barangId: number,
//       qty: number,
//       note: string | null
//     }
//   ]
// }
//
// id:
// - number = update item lama
// - null   = item baru
//
// ============================================================
//
// IMPORTANT BUSINESS RULE:
//
// STOCK TIDAK DIVALIDASI PADA SAAT EDIT DELIVERY REQUEST.
//
// Artinya:
//
// Barang stock 100 -> BOLEH
// Barang stock 10  -> BOLEH
// Barang stock 0   -> BOLEH
// Barang baru stock 0 -> BOLEH
//
// Validasi stock dilakukan pada tahap PROCESS DELIVERY.
//
// ============================================================

export async function PUT(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    // ========================================================
    // SESSION
    // ========================================================

    const user = await getCurrentUser();

    if (!user) {
      return errorResponse(
        "Unauthorized. Silakan login kembali.",
        401
      );
    }

    // ========================================================
    // ID
    // ========================================================

    const { id: idParam } = await context.params;
    const id = Number(idParam);

    if (!Number.isInteger(id) || id <= 0) {
      return errorResponse(
        "ID Delivery Request tidak valid.",
        400
      );
    }

    // ========================================================
    // GET EXISTING REQUEST
    // ========================================================

    const existingRequest =
      await prisma.deliveryRequest.findUnique({
        where: {
          id,
        },
        include: {
          items: {
            orderBy: {
              id: "asc",
            },
          },
          outlet: true,
          delivery: true,
        },
      });

    if (!existingRequest) {
      return errorResponse(
        "Delivery Request tidak ditemukan.",
        404
      );
    }

    // ========================================================
    // ACCESS CONTROL
    // ========================================================

    if (
      user.role === "OUTLET_ADMIN" &&
      user.outletId !== existingRequest.outletId
    ) {
      return errorResponse(
        "Anda tidak memiliki akses untuk mengubah Delivery Request outlet ini.",
        403
      );
    }

    // ========================================================
    // STATUS LOCK
    // ========================================================
    //
    // EDIT HANYA MENUNGGU APPROVAL
    //
    // PENDING = Menunggu Approval
    //
    // APPROVED sudah LOCK.
    // PROCESSING sudah LOCK.
    // COMPLETED sudah LOCK.
    //
    // ========================================================

    if (existingRequest.status !== "PENDING") {
      return errorResponse(
        `Delivery Request dengan status ${existingRequest.status} sudah tidak dapat diedit. Edit hanya diperbolehkan saat status Menunggu Approval.`,
        400
      );
    }

    // ========================================================
    // DELIVERY LOCK
    // ========================================================

    if (existingRequest.deliveryId) {
      return errorResponse(
        "Delivery Request sudah terhubung dengan Delivery sehingga tidak dapat diubah lagi.",
        400
      );
    }

    // ========================================================
    // READ BODY
    // ========================================================

    let body: any;

    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "Body request tidak valid.",
        400
      );
    }

    // ========================================================
    // ITEMS
    // ========================================================

    const rawItems = Array.isArray(body?.items)
      ? body.items
      : null;

    if (!rawItems) {
      return errorResponse(
        "Data items wajib berupa array.",
        400
      );
    }

    // ========================================================
    // MINIMUM ONE ITEM
    // ========================================================

    if (rawItems.length === 0) {
      return errorResponse(
        "Delivery Request harus memiliki minimal satu barang.",
        400
      );
    }

    // ========================================================
    // NORMALIZE ITEMS
    // ========================================================

    const items = rawItems.map((item: any) => {
      let itemId: number | null = null;

      if (
        item?.id !== null &&
        item?.id !== undefined &&
        item?.id !== ""
      ) {
        itemId = Number(item.id);
      }

      const barangId = Number(item?.barangId);
      const qty = Number(item?.qty);

      const note =
        item?.note === null ||
        item?.note === undefined
          ? null
          : String(item.note).trim();

      return {
        id: itemId,
        barangId,
        qty,
        note,
      };
    });

    // ========================================================
    // BASIC ITEM VALIDATION
    // ========================================================

    for (const item of items) {
      // ------------------------------------------------------
      // ITEM ID
      // ------------------------------------------------------

      if (
        item.id !== null &&
        (!Number.isInteger(item.id) || item.id <= 0)
      ) {
        return errorResponse(
          "ID item Delivery Request tidak valid.",
          400
        );
      }

      // ------------------------------------------------------
      // BARANG ID
      // ------------------------------------------------------

      if (
        !Number.isInteger(item.barangId) ||
        item.barangId <= 0
      ) {
        return errorResponse(
          "Barang pada Delivery Request tidak valid.",
          400
        );
      }

      // ------------------------------------------------------
      // QTY
      // ------------------------------------------------------
      //
      // Qty <= 0 tetap DITOLAK.
      //
      // Stock tidak berhubungan dengan validasi ini.
      //
      // ------------------------------------------------------

      if (
        !Number.isFinite(item.qty) ||
        item.qty <= 0
      ) {
        return errorResponse(
          "Qty setiap barang harus lebih dari 0.",
          400
        );
      }
    }

    // ========================================================
    // DUPLICATE BARANG CHECK
    // ========================================================
    //
    // Barang yang sama TIDAK BOLEH ada dua kali.
    //
    // Contoh:
    //
    // Barang A
    // Barang B
    // Barang A  <-- ditolak
    //
    // ========================================================

    const barangIds = items.map(
      (item) => item.barangId
    );

    const uniqueBarangIds =
      new Set(barangIds);

    if (
      uniqueBarangIds.size !==
      barangIds.length
    ) {
      return errorResponse(
        "Barang yang sama tidak boleh muncul lebih dari satu kali dalam Delivery Request.",
        400
      );
    }

    // ========================================================
    // EXISTING ITEM MAP
    // ========================================================

    const existingItemMap =
      new Map(
        existingRequest.items.map(
          (item) => [item.id, item]
        )
      );

    // ========================================================
    // VALIDATE ITEM IDS
    // ========================================================
    //
    // id dari frontend:
    //
    // null = item baru
    //
    // number = harus benar-benar milik request ini
    //
    // ========================================================

    for (const item of items) {
      if (item.id === null) {
        continue;
      }

      if (!existingItemMap.has(item.id)) {
        return errorResponse(
          `Item Delivery Request #${item.id} tidak ditemukan pada request ini.`,
          400
        );
      }
    }

    // ========================================================
    // GET BARANG
    // ========================================================
    //
    // Tetap dilakukan untuk memastikan:
    //
    // 1. barang benar-benar ada
    // 2. barang masih aktif
    //
    // TIDAK digunakan untuk validasi stock.
    //
    // ========================================================

    const barangList =
      await prisma.barang.findMany({
        where: {
          id: {
            in: Array.from(
              uniqueBarangIds
            ),
          },
          active: true,
        },
        select: {
          id: true,
          code: true,
          name: true,
          stock: true,
          unit: true,
          baseUnit: true,
          conversionRate: true,
        },
      });

    // ========================================================
    // BARANG NOT FOUND
    // ========================================================

    if (
      barangList.length !==
      uniqueBarangIds.size
    ) {
      const foundIds =
        new Set(
          barangList.map(
            (barang) => barang.id
          )
        );

      const missingBarang =
        items
          .filter(
            (item) =>
              !foundIds.has(
                item.barangId
              )
          )
          .map(
            (item) => item.barangId
          );

      return errorResponse(
        `Barang tidak ditemukan atau tidak aktif: ${missingBarang.join(", ")}.`,
        400
      );
    }

    // ========================================================
    // NO STOCK VALIDATION HERE
    // ========================================================
    //
    // PENTING:
    //
    // JANGAN melakukan:
    //
    // if (item.qty > barang.stock)
    //
    // pada endpoint PUT ini.
    //
    // Delivery Request adalah dokumen KEBUTUHAN.
    //
    // Jadi request boleh dibuat/edit walaupun:
    //
    // stock = 0
    // stock < qty
    //
    // Validasi ketersediaan stock dilakukan ketika
    // Delivery benar-benar di-PROCESS.
    //
    // ========================================================

    // ========================================================
    // TRANSACTION
    // ========================================================

    const updatedRequest =
      await prisma.$transaction(
        async (tx) => {
          // ==================================================
          // 1. DELETE REMOVED ITEMS
          // ==================================================
          //
          // Semua item lama yang tidak ada
          // di payload final akan dihapus.
          //
          // ==================================================

          const submittedExistingIds =
            items
              .filter(
                (item) =>
                  item.id !== null
              )
              .map(
                (item) =>
                  item.id as number
              );

          const itemIdsToDelete =
            existingRequest.items
              .map(
                (item) => item.id
              )
              .filter(
                (itemId) =>
                  !submittedExistingIds.includes(
                    itemId
                  )
              );

          if (
            itemIdsToDelete.length > 0
          ) {
            await tx.deliveryRequestItem.deleteMany(
              {
                where: {
                  deliveryRequestId:
                    id,
                  id: {
                    in:
                      itemIdsToDelete,
                  },
                },
              }
            );
          }

          // ==================================================
          // 2. UPDATE / CREATE ITEMS
          // ==================================================

          for (const item of items) {
            if (item.id !== null) {
              // ----------------------------------------------
              // UPDATE ITEM LAMA
              // ----------------------------------------------

              await tx.deliveryRequestItem.update(
                {
                  where: {
                    id: item.id,
                  },
                  data: {
                    barangId:
                      item.barangId,
                    qty: item.qty,
                    note: item.note,
                  },
                }
              );
            } else {
              // ----------------------------------------------
              // CREATE ITEM BARU
              // ----------------------------------------------

              await tx.deliveryRequestItem.create(
                {
                  data: {
                    deliveryRequestId:
                      id,
                    barangId:
                      item.barangId,
                    qty: item.qty,
                    note: item.note,
                  },
                }
              );
            }
          }

          // ==================================================
          // 3. UPDATE REQUEST TIMESTAMP
          // ==================================================

          return tx.deliveryRequest.update(
            {
              where: {
                id,
              },
              data: {
                updatedAt:
                  new Date(),
              },
              include: {
                outlet: true,

                createdBy: {
                  select: {
                    id: true,
                    username: true,
                    fullname: true,
                    role: true,
                    outletId: true,
                  },
                },

                customer: true,

                delivery: {
                  include: {
                    items: {
                      include: {
                        barang: true,
                      },
                    },
                  },
                },

                items: {
                  include: {
                    barang: true,
                  },
                  orderBy: {
                    id: "asc",
                  },
                },
              },
            }
          );
        }
      );

    // ========================================================
    // SUCCESS
    // ========================================================

    return successResponse({
      message:
        "Delivery Request berhasil diperbarui.",
      data: updatedRequest,
    });
  } catch (error) {
    console.error(
      "[DELIVERY REQUEST] PUT ERROR:",
      error
    );

    return errorResponse(
      "Gagal memperbarui Delivery Request.",
      500
    );
  }
}

// ============================================================
// DELETE DELIVERY REQUEST
// ============================================================
//
// DELETE HANYA BOLEH:
//
// PENDING
//
// APPROVED / PROCESSING / COMPLETED
// tidak dapat dihapus.
//
// ============================================================

export async function DELETE(
  _request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse(
        "Unauthorized. Silakan login kembali.",
        401
      );
    }

    const { id: idParam } =
      await context.params;

    const id = Number(idParam);

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return errorResponse(
        "ID Delivery Request tidak valid.",
        400
      );
    }

    // ========================================================
    // FIND REQUEST
    // ========================================================

    const existingRequest =
      await prisma.deliveryRequest.findUnique(
        {
          where: {
            id,
          },
          include: {
            items: true,
            outlet: true,
            delivery: true,
          },
        }
      );

    if (!existingRequest) {
      return errorResponse(
        "Delivery Request tidak ditemukan.",
        404
      );
    }

    // ========================================================
    // ACCESS CONTROL
    // ========================================================

    if (
      user.role === "OUTLET_ADMIN" &&
      user.outletId !==
        existingRequest.outletId
    ) {
      return errorResponse(
        "Anda tidak memiliki akses untuk menghapus Delivery Request outlet ini.",
        403
      );
    }

    // ========================================================
    // STATUS LOCK
    // ========================================================

    if (
      existingRequest.status !==
      "PENDING"
    ) {
      return errorResponse(
        `Delivery Request dengan status ${existingRequest.status} tidak dapat dihapus.`,
        400
      );
    }

    // ========================================================
    // DELIVERY LOCK
    // ========================================================

    if (existingRequest.deliveryId) {
      return errorResponse(
        "Delivery Request sudah terhubung dengan Delivery sehingga tidak dapat dihapus.",
        400
      );
    }

    // ========================================================
    // DELETE
    // ========================================================

    await prisma.$transaction(
      async (tx) => {
        await tx.deliveryRequestItem.deleteMany(
          {
            where: {
              deliveryRequestId: id,
            },
          }
        );

        await tx.deliveryRequest.delete(
          {
            where: {
              id,
            },
          }
        );
      }
    );

    return successResponse({
      message:
        "Delivery Request berhasil dihapus.",
      id,
    });
  } catch (error) {
    console.error(
      "[DELIVERY REQUEST] DELETE ERROR:",
      error
    );

    return errorResponse(
      "Gagal menghapus Delivery Request.",
      500
    );
  }
}