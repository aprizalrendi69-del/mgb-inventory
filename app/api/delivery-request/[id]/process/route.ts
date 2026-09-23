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

  // ----------------------------------------------------------
  // DATABASE SESSION
  // ----------------------------------------------------------

  try {
    const session = await prisma.session.findUnique({
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
      "DELIVERY REQUEST PROCESS DATABASE SESSION ERROR:",
      error
    );
  }

  // ----------------------------------------------------------
  // JSON SESSION FALLBACK
  // ----------------------------------------------------------

  try {
    const parsed = JSON.parse(sessionCookie.value);

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

    const user = await prisma.user.findUnique({
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
      "DELIVERY REQUEST PROCESS JSON SESSION ERROR:",
      error
    );

    return null;
  }
}

// ============================================================
// ACCESS
// ============================================================
//
// PROCESS DELIVERY REQUEST dilakukan oleh:
//
// ADMIN
// MANAGER
// GUDANG
//
// OUTLET_ADMIN tidak boleh memproses request menjadi
// Delivery pusat.
//
// ============================================================

function canProcess(role: string) {
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
  const params = await context.params;

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
// POST PROCESS
// ============================================================
//
// FLOW:
//
// Delivery Request
// PENDING
//    ↓ APPROVE
// APPROVED
//    ↓ PROCESS
// PROCESSING
//    ↓
// Delivery DRAFT
//
// PENTING:
//
// - TIDAK mengurangi Barang.stock
// - TIDAK menambah OutletStock
// - TIDAK membuat StockCard OUT
// - TIDAK membuat StockMutation
//
// Stock baru bergerak ketika Delivery benar-benar RELEASED.
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

    const user = await getCurrentUser();

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

    if (!canProcess(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses untuk memproses Delivery Request",
        },
        {
          status: 403,
        }
      );
    }

    // ========================================================
    // 3. REQUEST ID
    // ========================================================

    const id = await getRequestId(context);

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

    const result = await prisma.$transaction(
      async (tx) => {
        // ====================================================
        // LOAD DELIVERY REQUEST
        // ====================================================

        const request =
          await tx.deliveryRequest.findUnique({
            where: {
              id,
            },

            include: {
              // ------------------------------------------------
              // OUTLET
              // ------------------------------------------------

              outlet: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  active: true,
                },
              },

              // ------------------------------------------------
              // CUSTOMER
              // ------------------------------------------------
              //
              // Customer harus berasal dari Delivery Request.
              //
              // ------------------------------------------------

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

              // ------------------------------------------------
              // CREATED BY
              // ------------------------------------------------

              createdBy: {
                select: {
                  id: true,
                  username: true,
                  fullname: true,
                },
              },

              // ------------------------------------------------
              // ITEMS
              // ------------------------------------------------

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
                      purchasePrice: true,
                      active: true,
                    },
                  },
                },
              },

              // ------------------------------------------------
              // DELIVERY
              // ------------------------------------------------

              delivery: {
                select: {
                  id: true,
                  number: true,
                  status: true,
                },
              },
            },
          });

        // ====================================================
        // REQUEST NOT FOUND
        // ====================================================

        if (!request) {
          throw new Error(
            "Delivery Request tidak ditemukan"
          );
        }

        // ====================================================
        // VALIDASI REQUEST DATE
        // ====================================================
        //
        // Tanggal Delivery WAJIB berasal dari:
        //
        // DeliveryRequest.requestDate
        //
        // BUKAN dari new Date().
        //
        // Ini memastikan tanggal yang dipilih Admin Outlet
        // tetap menjadi tanggal transaksi delivery.
        //
        // ====================================================

        if (!request.requestDate) {
          throw new Error(
            `Delivery Request ${request.number} belum memiliki tanggal delivery`
          );
        }

        // ====================================================
        // REQUEST HARUS APPROVED
        // ====================================================

        if (request.status !== "APPROVED") {
          throw new Error(
            `Delivery Request ${request.number} tidak dapat diproses karena status saat ini ${request.status}`
          );
        }

        // ====================================================
        // JANGAN BUAT DELIVERY DUA KALI
        // ====================================================

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

        // ====================================================
        // REQUEST HARUS PUNYA ITEM
        // ====================================================

        if (
          !request.items ||
          request.items.length === 0
        ) {
          throw new Error(
            "Delivery Request tidak memiliki barang"
          );
        }

        // ====================================================
        // CUSTOMER WAJIB ADA
        // ====================================================
        //
        // Sumber customer:
        //
        // DeliveryRequest.customerId
        //
        // BUKAN customer milik Admin Pusat.
        //
        // ====================================================

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

        // ====================================================
        // OUTLET WAJIB ADA
        // ====================================================

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

        // ====================================================
        // OUTLET HARUS AKTIF
        // ====================================================

        if (!request.outlet.active) {
          throw new Error(
            "Outlet tujuan sudah tidak aktif"
          );
        }

        // ====================================================
        // DEBUG RELATION
        // ====================================================

        console.log(
          "PROCESS DELIVERY REQUEST RELATION:",
          {
            requestId: request.id,

            requestNumber:
              request.number,

            requestDate:
              request.requestDate,

            deliveryDate:
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
          }
        );

        // ====================================================
        // VALIDASI ITEM
        // ====================================================

        let totalQty = 0;

        for (const item of request.items) {
          const qty = Number(item.qty);

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

          // --------------------------------------------------
          // VALIDASI STOCK
          // --------------------------------------------------
          //
          // Hanya validasi.
          //
          // Stock BELUM dikurangi.
          //
          // --------------------------------------------------

          const currentStock =
            Number(
              item.barang.stock ?? 0
            );

          if (currentStock < qty) {
            throw new Error(
              `Stock ${item.barang.code} - ${item.barang.name} tidak mencukupi. Stock pusat: ${currentStock}, request: ${qty}`
            );
          }

          totalQty += qty;
        }

        // ====================================================
        // GENERATE DELIVERY NUMBER
        // ====================================================
        //
        // Contoh:
        //
        // DR-00002
        //     ↓
        // DO-DR-00002
        //
        // ====================================================

        const deliveryNumber =
          `DO-${request.number}`;

        // ====================================================
        // CEK NOMOR DELIVERY
        // ====================================================

        const existingDelivery =
          await tx.delivery.findUnique({
            where: {
              number:
                deliveryNumber,
            },

            select: {
              id: true,
              number: true,
            },
          });

        if (existingDelivery) {
          throw new Error(
            `Nomor Delivery ${deliveryNumber} sudah digunakan`
          );
        }

        // ====================================================
        // CREATE DELIVERY DRAFT
        // ====================================================
        //
        // PENTING:
        //
        // customerId = request.customerId
        // outletId   = request.outletId
        //
        // deliveryDate = request.requestDate
        //
        // Jadi tanggal yang dipilih saat membuat Delivery
        // Request diteruskan otomatis ke Delivery.
        //
        // ====================================================

        const delivery =
          await tx.delivery.create({
            data: {
              number:
                deliveryNumber,

              // ------------------------------------------------
              // CUSTOMER
              // ------------------------------------------------

              customerId:
                request.customerId,

              // ------------------------------------------------
              // OUTLET
              // ------------------------------------------------

              outletId:
                request.outletId,

              // ------------------------------------------------
              // DELIVERY DATE
              // ------------------------------------------------
              //
              // JANGAN menggunakan new Date().
              //
              // Gunakan tanggal yang sudah ditetapkan pada
              // Delivery Request.
              //
              // ------------------------------------------------

              deliveryDate:
                request.requestDate,

              // ------------------------------------------------
              // STATUS
              // ------------------------------------------------

              status:
                "DRAFT",

              // ------------------------------------------------
              // REMARKS
              // ------------------------------------------------

              remarks:
                request.remarks
                  ? `Delivery Request ${request.number} - ${request.remarks}`
                  : `Delivery Request ${request.number}`,

              // ------------------------------------------------
              // TOTAL QTY
              // ------------------------------------------------

              totalQty,

              // ------------------------------------------------
              // ITEMS
              // ------------------------------------------------

              items: {
                create:
                  request.items.map(
                    (item) => ({
                      barangId:
                        item.barangId,

                      qty:
                        Number(
                          item.qty
                        ),

                      // Harga hanya referensi nilai.
                      // Tidak mengurangi stock.

                      price:
                        Number(
                          item.barang
                            .purchasePrice ??
                            0
                        ),

                      subtotal:
                        Number(
                          item.qty
                        ) *
                        Number(
                          item.barang
                            .purchasePrice ??
                            0
                        ),

                      note:
                        item.note ??
                        null,
                    })
                  ),
              },
            },

            include: {
              // ------------------------------------------------
              // CUSTOMER
              // ------------------------------------------------

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

              // ------------------------------------------------
              // OUTLET
              // ------------------------------------------------

              outlet: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  address: true,
                  city: true,
                  phone: true,
                },
              },

              // ------------------------------------------------
              // ITEMS
              // ------------------------------------------------

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
                      purchasePrice: true,
                    },
                  },
                },
              },
            },
          });

        // ====================================================
        // UPDATE DELIVERY REQUEST
        // ====================================================
        //
        // APPROVED
        //    ↓
        // PROCESSING
        //
        // deliveryId disimpan supaya:
        //
        // DeliveryRequest
        //       ↕
        // Delivery
        //
        // selalu terhubung.
        //
        // ====================================================

        const updatedRequest =
          await tx.deliveryRequest.update({
            where: {
              id:
                request.id,
            },

            data: {
              status:
                "PROCESSING",

              delivery: {
                connect: {
                  id:
                    delivery.id,
                },
              },
            },

            include: {
              // ------------------------------------------------
              // CUSTOMER
              // ------------------------------------------------

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

              // ------------------------------------------------
              // OUTLET
              // ------------------------------------------------

              outlet: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },

              // ------------------------------------------------
              // CREATED BY
              // ------------------------------------------------

              createdBy: {
                select: {
                  id: true,
                  username: true,
                  fullname: true,
                },
              },

              // ------------------------------------------------
              // ITEMS
              // ------------------------------------------------

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
                      purchasePrice: true,
                    },
                  },
                },
              },

              // ------------------------------------------------
              // DELIVERY
              // ------------------------------------------------

              delivery: {
                select: {
                  id: true,
                  number: true,
                  status: true,

                  // PENTING:
                  // Customer dan Outlet sekarang bisa diverifikasi
                  // langsung dari response.

                  customerId: true,
                  outletId: true,

                  // =================================================
                  // TANGGAL DELIVERY
                  // =================================================
                  //
                  // Harus sama dengan DeliveryRequest.requestDate.
                  //
                  deliveryDate: true,

                  totalQty: true,
                },
              },
            },
          });

        // ====================================================
        // RETURN
        // ====================================================

        return {
          request:
            updatedRequest,

          delivery,
        };
      }
    );

    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json(
      {
        success: true,

        message:
          "Delivery Request berhasil diproses menjadi Delivery DRAFT",

        data: result,
      },
      {
        status: 200,
      }
    );
  } catch (error: any) {
    console.error(
      "PROCESS DELIVERY REQUEST ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal memproses Delivery Request",
      },
      {
        status: 500,
      }
    );
  }
}