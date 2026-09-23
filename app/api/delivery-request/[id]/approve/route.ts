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
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// ============================================================
// CURRENT USER
// ============================================================

async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();

  const sessionCookie =
    cookieStore.get("erp-session") ??
    cookieStore.get("session");

  if (!sessionCookie?.value) {
    return null;
  }

  // ==========================================================
  // DATABASE SESSION
  // ==========================================================

  try {
    const session =
      await prisma.session.findUnique({
        where: {
          token: sessionCookie.value,
        },

        select: {
          expiresAt: true,

          user: {
            select: {
              id: true,
              username: true,
              fullname: true,
              role: true,
              active: true,
              outletId: true,
            },
          },
        },
      });

    if (session) {
      if (session.expiresAt < new Date()) {
        return null;
      }

      if (!session.user.active) {
        return null;
      }

      return session.user;
    }
  } catch (error) {
    console.error(
      "DELIVERY REQUEST APPROVE DATABASE SESSION ERROR:",
      error
    );
  }

  // ==========================================================
  // JSON SESSION FALLBACK
  // ==========================================================

  try {
    const parsed = JSON.parse(
      sessionCookie.value
    );

    const userId = Number(
      parsed?.user?.id ??
        parsed?.id ??
        0
    );

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return null;
    }

    const user =
      await prisma.user.findUnique({
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
        },
      });

    if (!user || !user.active) {
      return null;
    }

    return user;
  } catch (error) {
    console.error(
      "DELIVERY REQUEST APPROVE JSON SESSION ERROR:",
      error
    );

    return null;
  }
}

// ============================================================
// ACCESS
// ============================================================
//
// APPROVE hanya dilakukan oleh:
//
// ADMIN
// MANAGER
// GUDANG
//
// OUTLET_ADMIN tidak boleh approve request sendiri.
//
// ============================================================

function canApprove(role: string) {
  return (
    role === "ADMIN" ||
    role === "MANAGER" ||
    role === "GUDANG"
  );
}

// ============================================================
// GET REQUEST ID
// ============================================================

async function getRequestId(
  context: RouteContext
): Promise<number | null> {
  const params =
    await context.params;

  const rawId = String(
    params?.id ?? ""
  ).trim();

  if (!rawId) {
    return null;
  }

  const id = Number(rawId);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return id;
}

// ============================================================
// POST APPROVE
// ============================================================
//
// FLOW:
//
// Delivery Request
// PENDING
//    ↓
// APPROVE
//    ↓
// APPROVED
//    ↓
// PROCESS
//    ↓
// PROCESSING
//    ↓
// Delivery DRAFT
//
// PENTING:
//
// APPROVE:
// - tidak mengurangi Barang.stock
// - tidak menambah OutletStock
// - tidak membuat StockCard
// - tidak membuat StockMutation
// - tidak membuat Delivery
//
// Stock baru bergerak saat RELEASED.
//
// ============================================================

export async function POST(
  _req: NextRequest,
  context: RouteContext
) {
  try {
    // ========================================================
    // 1. SESSION
    // ========================================================

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login atau session tidak valid",
        },
        {
          status: 401,
        }
      );
    }

    // ========================================================
    // 2. ACCESS
    // ========================================================

    if (!canApprove(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses untuk approve Delivery Request",
        },
        {
          status: 403,
        }
      );
    }

    // ========================================================
    // 3. REQUEST ID
    // ========================================================

    const id =
      await getRequestId(context);

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID Delivery Request tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // 4. TRANSACTION
    // ========================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // ==================================================
          // LOAD DELIVERY REQUEST
          // ==================================================

          const request =
            await tx.deliveryRequest.findUnique({
              where: {
                id,
              },

              include: {
                // ==============================================
                // OUTLET
                // ==============================================

                outlet: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    active: true,
                  },
                },

                // ==============================================
                // CUSTOMER
                // ==============================================
                //
                // Customer harus berasal dari DeliveryRequest.
                //
                // ==============================================

                customer: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    address: true,
                    city: true,
                    phone: true,
                    email: true,
                    contactPerson: true,
                  },
                },

                // ==============================================
                // CREATED BY
                // ==============================================

                createdBy: {
                  select: {
                    id: true,
                    username: true,
                    fullname: true,
                  },
                },

                // ==============================================
                // ITEMS
                // ==============================================

                items: {
                  include: {
                    barang: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                        baseUnit: true,
                        unit: true,
                        stock: true,
                        active: true,
                      },
                    },
                  },
                },

                // ==============================================
                // DELIVERY
                // ==============================================

                delivery: {
                  select: {
                    id: true,
                    number: true,
                    status: true,
                    customerId: true,
                    outletId: true,
                  },
                },
              },
            });

          // ==================================================
          // REQUEST NOT FOUND
          // ==================================================

          if (!request) {
            throw new Error(
              "Delivery Request tidak ditemukan"
            );
          }

          // ==================================================
          // VALIDASI TANGGAL DELIVERY
          // ==================================================
          //
          // Tanggal sudah ditentukan ketika Admin Outlet
          // membuat Delivery Request.
          //
          // APPROVE TIDAK BOLEH mengganti tanggal tersebut.
          //
          // request.requestDate akan diteruskan nanti ketika
          // Delivery Request diproses menjadi Delivery.
          //
          // ==================================================

          if (!request.requestDate) {
            throw new Error(
              `Delivery Request ${request.number} belum memiliki tanggal delivery`
            );
          }

          // ==================================================
          // REQUEST HARUS PENDING
          // ==================================================

          if (
            request.status !== "PENDING"
          ) {
            throw new Error(
              `Delivery Request ${request.number} tidak dapat di-approve karena status saat ini ${request.status}`
            );
          }

          // ==================================================
          // JANGAN APPROVE ULANG
          // ==================================================

          if (request.deliveryId) {
            throw new Error(
              `Delivery Request ${request.number} sudah memiliki Delivery`
            );
          }

          if (request.delivery) {
            throw new Error(
              `Delivery Request ${request.number} sudah terhubung dengan Delivery ${request.delivery.number}`
            );
          }

          // ==================================================
          // REQUEST HARUS PUNYA ITEM
          // ==================================================

          if (
            !request.items ||
            request.items.length === 0
          ) {
            throw new Error(
              "Delivery Request tidak memiliki barang"
            );
          }

          // ==================================================
          // CUSTOMER WAJIB ADA
          // ==================================================

          if (!request.customerId) {
            throw new Error(
              `Delivery Request ${request.number} belum memiliki Customer`
            );
          }

          if (!request.customer) {
            throw new Error(
              `Customer untuk Delivery Request ${request.number} tidak ditemukan`
            );
          }

          // ==================================================
          // OUTLET WAJIB ADA
          // ==================================================

          if (!request.outletId) {
            throw new Error(
              `Delivery Request ${request.number} belum memiliki Outlet`
            );
          }

          if (!request.outlet) {
            throw new Error(
              `Outlet untuk Delivery Request ${request.number} tidak ditemukan`
            );
          }

          // ==================================================
          // OUTLET HARUS AKTIF
          // ==================================================

          if (!request.outlet.active) {
            throw new Error(
              "Outlet tujuan sudah tidak aktif"
            );
          }

          // ==================================================
          // VALIDASI ITEM
          // ==================================================

          for (const item of request.items) {
            const qty =
              Number(item.qty);

            if (
              !Number.isFinite(qty) ||
              qty <= 0
            ) {
              throw new Error(
                `Qty barang ${item.barang.name} tidak valid`
              );
            }

            if (!item.barang.active) {
              throw new Error(
                `Barang ${item.barang.code} - ${item.barang.name} sudah tidak aktif`
              );
            }

            // ----------------------------------------------
            // STOCK HANYA DIVALIDASI
            // ----------------------------------------------

            const currentStock =
              Number(
                item.barang.stock ?? 0
              );

            if (
              currentStock < qty
            ) {
              throw new Error(
                `Stock ${item.barang.code} - ${item.barang.name} tidak mencukupi. Stock pusat: ${currentStock}, request: ${qty}`
              );
            }
          }

          // ==================================================
          // DEBUG
          // ==================================================

          console.log(
            "APPROVE DELIVERY REQUEST RELATION:",
            {
              requestId:
                request.id,

              requestNumber:
                request.number,

              // =================================================
              // TANGGAL TRANSAKSI DELIVERY
              // =================================================
              //
              // Tanggal ini tidak diubah saat APPROVE.
              //
              requestDate:
                request.requestDate,

              customerId:
                request.customerId,

              customerCode:
                request.customer?.code ??
                null,

              customerName:
                request.customer?.name ??
                null,

              outletId:
                request.outletId,

              outletCode:
                request.outlet?.code ??
                null,

              outletName:
                request.outlet?.name ??
                null,

              approvedBy:
                user.username,

              approvedByRole:
                user.role,
            }
          );

          // ==================================================
          // APPROVE
          // ==================================================
          //
          // HANYA mengubah status.
          //
          // requestDate TIDAK diubah.
          //
          // ==================================================

          const updated =
            await tx.deliveryRequest.update({
              where: {
                id:
                  request.id,
              },

              data: {
                status:
                  "APPROVED",
              },

              include: {
                // ============================================
                // CUSTOMER
                // ============================================

                customer: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    address: true,
                    city: true,
                    phone: true,
                    email: true,
                    contactPerson: true,
                  },
                },

                // ============================================
                // OUTLET
                // ============================================

                outlet: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },

                // ============================================
                // CREATED BY
                // ============================================

                createdBy: {
                  select: {
                    id: true,
                    username: true,
                    fullname: true,
                  },
                },

                // ============================================
                // ITEMS
                // ============================================

                items: {
                  include: {
                    barang: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                        baseUnit: true,
                        unit: true,
                        stock: true,
                      },
                    },
                  },
                },

                // ============================================
                // DELIVERY
                // ============================================

                delivery: {
                  select: {
                    id: true,
                    number: true,
                    status: true,
                    customerId: true,
                    outletId: true,
                  },
                },
              },
            });

          return updated;
        }
      );

    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json(
      {
        success: true,

        message:
          "Delivery Request berhasil di-approve",

        data: result,
      },
      {
        status: 200,
      }
    );
  } catch (error: any) {
    console.error(
      "APPROVE DELIVERY REQUEST ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal approve Delivery Request",
      },
      {
        status: 500,
      }
    );
  }
}