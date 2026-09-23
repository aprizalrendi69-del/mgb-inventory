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
// CURRENT USER
// ============================================================
//
// Mendukung:
// 1. Database Session
// 2. JSON session fallback
//
// Cookie:
// - erp-session
// - session
//
// IMPORTANT:
// Customer selalu diambil dari User.customerId.
// Frontend tidak boleh menentukan customer.
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
            customerId: true,
          },
        },
      },
    });

    if (session) {
      // Session expired
      if (session.expiresAt < new Date()) {
        return null;
      }

      // User inactive
      if (!session.user.active) {
        return null;
      }

      console.log("DELIVERY REQUEST CURRENT USER:", {
        id: session.user.id,
        username: session.user.username,
        role: session.user.role,
        outletId: session.user.outletId,
        customerId: session.user.customerId,
      });

      return session.user;
    }
  } catch (error) {
    console.error(
      "DELIVERY REQUEST DATABASE SESSION ERROR:",
      error
    );
  }

  // ==========================================================
  // JSON SESSION FALLBACK
  // ==========================================================

  try {
    const parsed = JSON.parse(sessionCookie.value);

    const userId = Number(
      parsed?.user?.id ??
        parsed?.data?.user?.id ??
        parsed?.data?.id ??
        parsed?.id ??
        0
    );

    if (!Number.isInteger(userId) || userId <= 0) {
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
        customerId: true,
      },
    });

    if (!user || !user.active) {
      return null;
    }

    console.log(
      "DELIVERY REQUEST CURRENT USER FALLBACK:",
      {
        id: user.id,
        username: user.username,
        role: user.role,
        outletId: user.outletId,
        customerId: user.customerId,
      }
    );

    return user;
  } catch (error) {
    console.error(
      "DELIVERY REQUEST JSON SESSION ERROR:",
      error
    );

    return null;
  }
}

// ============================================================
// ROLE NORMALIZER
// ============================================================

function normalizeRole(role: unknown) {
  return String(role ?? "")
    .trim()
    .toUpperCase();
}

// ============================================================
// ACCESS
// ============================================================

function canCreateDeliveryRequest(role: string) {
  return role === "OUTLET_ADMIN";
}

function canViewDeliveryRequest(role: string) {
  return [
    "ADMIN",
    "MANAGER",
    "GUDANG",
    "OUTLET_ADMIN",
  ].includes(role);
}

// ============================================================
// DELETE ACCESS
// ============================================================
//
// ADMIN
// -> boleh hapus semua Delivery Request
//
// OUTLET_ADMIN
// -> hanya boleh hapus Delivery Request
//    dari outlet miliknya sendiri
//
// MANAGER / GUDANG
// -> tidak boleh hapus
//
// ============================================================

function canDeleteDeliveryRequest(role: string) {
  return [
    "ADMIN",
    "OUTLET_ADMIN",
  ].includes(role);
}

// ============================================================
// GENERATE DELIVERY REQUEST NUMBER
// ============================================================
//
// Format:
// DR-00001
// DR-00002
// DR-00003
//
// ============================================================

async function generateDeliveryRequestNumber(
  tx: any
): Promise<string> {
  const latest = await tx.deliveryRequest.findFirst({
    where: {
      number: {
        startsWith: "DR-",
      },
    },

    orderBy: {
      id: "desc",
    },

    select: {
      number: true,
    },
  });

  let nextNumber = 1;

  if (latest?.number) {
    const match = latest.number.match(/^DR-(\d+)$/);

    if (match) {
      nextNumber = Number(match[1]) + 1;
    }
  }

  return `DR-${String(nextNumber).padStart(5, "0")}`;
}

// ============================================================
// UNIQUE ERROR
// ============================================================

function isUniqueError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

// ============================================================
// PARSE DATE ONLY
// ============================================================
//
// Input:
// 2026-09-23
//
// Disimpan UTC siang supaya aman ketika ditampilkan kembali
// menggunakan toISOString().slice(0, 10).
//
// ============================================================

function parseDateOnly(value: unknown): Date | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return null;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      12,
      0,
      0,
      0
    )
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

// ============================================================
// NORMALIZE ITEMS
// ============================================================

function normalizeItems(items: unknown) {
  if (!Array.isArray(items)) {
    return null;
  }

  const normalized: Array<{
    barangId: number;
    qty: number;
    note: string | null;
  }> = [];

  for (const rawItem of items) {
    const item = rawItem as any;

    const barangId = Number(item?.barangId);
    const qty = Number(item?.qty);

    const noteRaw = item?.note;

    // Barang ID harus valid
    if (
      !Number.isInteger(barangId) ||
      barangId <= 0
    ) {
      return null;
    }

    // Qty harus > 0
    if (!Number.isFinite(qty) || qty <= 0) {
      return null;
    }

    const note =
      typeof noteRaw === "string" &&
      noteRaw.trim()
        ? noteRaw.trim()
        : null;

    normalized.push({
      barangId,
      qty,
      note,
    });
  }

  if (normalized.length === 0) {
    return null;
  }

  // ==========================================================
  // MERGE BARANG YANG SAMA
  // ==========================================================

  const merged = new Map<
    number,
    {
      barangId: number;
      qty: number;
      note: string | null;
    }
  >();

  for (const item of normalized) {
    const existing = merged.get(item.barangId);

    if (existing) {
      existing.qty += item.qty;

      if (!existing.note && item.note) {
        existing.note = item.note;
      }
    } else {
      merged.set(item.barangId, {
        ...item,
      });
    }
  }

  return Array.from(merged.values());
}

// ============================================================
// GET DELIVERY REQUEST
// ============================================================
//
// ADMIN / MANAGER / GUDANG
// -> dapat melihat semua request
//
// OUTLET_ADMIN
// -> hanya request outlet sendiri
//
// Query:
// ?status=PENDING
// ?outletId=1
//
// IMPORTANT:
// OUTLET_ADMIN tidak boleh menentukan outlet lewat query.
// Outlet selalu mengikuti user login.
//
// ============================================================

export async function GET(req: NextRequest) {
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
    // 2. ROLE
    // ========================================================

    const role = normalizeRole(user.role);

    if (!canViewDeliveryRequest(role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses Delivery Request",
        },
        {
          status: 403,
        }
      );
    }

    // ========================================================
    // 3. QUERY
    // ========================================================

    const { searchParams } = new URL(req.url);

    const statusParam =
      searchParams.get("status");

    const outletIdParam =
      searchParams.get("outletId");

    // ========================================================
    // 4. FILTER
    // ========================================================

    const where: any = {};

    // ========================================================
    // OUTLET ADMIN
    // ========================================================

    if (role === "OUTLET_ADMIN") {
      if (
        !user.outletId ||
        !Number.isInteger(user.outletId)
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet belum memiliki outlet",
          },
          {
            status: 400,
          }
        );
      }

      // Security:
      // outletId dari frontend DIABAIKAN.
      where.outletId = user.outletId;
    }

    // ========================================================
    // PUSAT
    // ========================================================

    else if (outletIdParam) {
      const outletId = Number(outletIdParam);

      if (
        Number.isInteger(outletId) &&
        outletId > 0
      ) {
        where.outletId = outletId;
      }
    }

    // ========================================================
    // STATUS
    // ========================================================

    const validStatuses = [
      "PENDING",
      "APPROVED",
      "REJECTED",
      "PROCESSING",
      "COMPLETED",
      "CANCELLED",
    ];

    if (
      statusParam &&
      validStatuses.includes(statusParam)
    ) {
      where.status = statusParam;
    }

    // ========================================================
    // 5. GET DATA
    // ========================================================

    const data =
      await prisma.deliveryRequest.findMany({
        where,

        include: {
          // ==================================================
          // OUTLET
          // ==================================================

          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
              active: true,
            },
          },

          // ==================================================
          // USER PEMBUAT
          // ==================================================

          createdBy: {
            select: {
              id: true,
              username: true,
              fullname: true,
              role: true,

              // Customer user pembuat
              customerId: true,

              customer: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },

          // ==================================================
          // CUSTOMER DELIVERY REQUEST
          // ==================================================

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

          // ==================================================
          // DELIVERY
          // ==================================================

          delivery: {
            select: {
              id: true,
              number: true,
              status: true,
              deliveryDate: true,
              totalQty: true,

              customer: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },

          // ==================================================
          // ITEMS
          // ==================================================

          items: {
            include: {
              barang: {
                select: {
                  id: true,
                  code: true,
                  name: true,

                  // =================================================
                  // SATUAN TRANSAKSI
                  // =================================================
                  //
                  // Delivery Request menggunakan `unit`,
                  // BUKAN baseUnit.
                  //
                  unit: true,

                  stock: true,
                },
              },
            },
          },
        },

        orderBy: {
          id: "desc",
        },
      });

    // ========================================================
    // 6. RESPONSE
    // ========================================================

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "GET DELIVERY REQUEST ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil Delivery Request",
      },
      {
        status: 500,
      }
    );
  }
}

// ============================================================
// POST DELIVERY REQUEST
// ============================================================
//
// HANYA OUTLET_ADMIN.
//
// Frontend boleh mengirim:
//
// {
//   outletId,
//   notes,
//   requestDate,
//   items
// }
//
// Tetapi:
//
// outletId:
// -> DIABAIKAN
// -> menggunakan user.outletId
//
// customerId:
// -> DIABAIKAN
// -> menggunakan user.customerId
//
// ============================================================

export async function POST(req: NextRequest) {
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
    // 2. ROLE
    // ========================================================

    const role = normalizeRole(user.role);

    if (!canCreateDeliveryRequest(role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Hanya Admin Outlet yang dapat membuat Delivery Request",
        },
        {
          status: 403,
        }
      );
    }

    // ========================================================
    // 3. USER OUTLET
    // ========================================================

    if (
      !user.outletId ||
      !Number.isInteger(user.outletId)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User outlet belum memiliki outlet",
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // 4. USER CUSTOMER
    // ========================================================
    //
    // Customer WAJIB berasal dari User.customerId.
    //
    // Tidak menerima customerId dari frontend.
    //
    // ========================================================

    if (
      !user.customerId ||
      !Number.isInteger(user.customerId)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User belum memiliki Customer. Hubungkan User dengan Customer terlebih dahulu.",
        },
        {
          status: 400,
        }
      );
    }

    const outletId = user.outletId;
    const customerId = user.customerId;

    // ========================================================
    // DEBUG
    // ========================================================

    console.log(
      "CREATE DELIVERY REQUEST:",
      {
        userId: user.id,
        username: user.username,
        role,
        outletId,
        customerId,
      }
    );

    // ========================================================
    // 5. BODY
    // ========================================================

    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Body request tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // 6. REMARKS / NOTES
    // ========================================================

    const remarksSource =
      typeof body?.notes === "string"
        ? body.notes
        : body?.remarks;

    const remarks =
      typeof remarksSource === "string" &&
      remarksSource.trim()
        ? remarksSource.trim()
        : null;

    // ========================================================
    // 7. REQUEST DATE
    // ========================================================

    let requestDate = new Date();

    if (body?.requestDate) {
      const parsedDate =
        parseDateOnly(body.requestDate);

      if (!parsedDate) {
        return NextResponse.json(
          {
            success: false,
            message:
              "requestDate harus menggunakan format YYYY-MM-DD yang valid",
          },
          {
            status: 400,
          }
        );
      }

      requestDate = parsedDate;
    }

    // ========================================================
    // 8. ITEMS
    // ========================================================

    const items =
      normalizeItems(body?.items);

    if (!items) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Minimal 1 barang dengan qty lebih dari 0 wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // 9. CEK OUTLET
    // ========================================================

    const outlet =
      await prisma.outlet.findUnique({
        where: {
          id: outletId,
        },

        select: {
          id: true,
          code: true,
          name: true,
          active: true,
        },
      });

    if (!outlet) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    if (!outlet.active) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tidak aktif",
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // 10. CEK CUSTOMER
    // ========================================================
    //
    // Customer diambil berdasarkan customerId milik User.
    //
    // BUKAN dari frontend.
    //
    // ========================================================

    const customer =
      await prisma.customer.findUnique({
        where: {
          id: customerId,
        },

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
      });

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Customer ID ${customerId} yang terhubung ke User tidak ditemukan`,
        },
        {
          status: 404,
        }
      );
    }

    // ========================================================
    // 11. CEK BARANG MASTER PUSAT
    // ========================================================
    //
    // TIDAK mengecek stock di tahap request.
    //
    // Stock dicek saat PROCESS / RELEASE.
    //
    // ========================================================

    const barangIds =
      items.map(
        (item) => item.barangId
      );

    const barangList =
      await prisma.barang.findMany({
        where: {
          id: {
            in: barangIds,
          },

          active: true,

          source: "CENTRAL",
        },

        select: {
          id: true,
          code: true,
          name: true,

          // Satuan transaksi
          unit: true,

          stock: true,
          active: true,
          source: true,
        },
      });

    // ========================================================
    // 12. CEK JUMLAH BARANG
    // ========================================================

    if (
      barangList.length !==
      barangIds.length
    ) {
      const foundIds =
        new Set(
          barangList.map(
            (item) => item.id
          )
        );

      const missing =
        barangIds.filter(
          (id) => !foundIds.has(id)
        );

      return NextResponse.json(
        {
          success: false,

          message:
            "Ada barang yang tidak ditemukan, tidak aktif, atau bukan Master Barang Pusat",

          missingBarangIds:
            missing,
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // 13. CREATE DELIVERY REQUEST
    // ========================================================

    let createdRequest: any = null;

    for (
      let attempt = 1;
      attempt <= 5;
      attempt++
    ) {
      try {
        createdRequest =
          await prisma.$transaction(
            async (tx) => {
              // =================================================
              // GENERATE NOMOR
              // =================================================

              const number =
                await generateDeliveryRequestNumber(
                  tx
                );

              // =================================================
              // CREATE REQUEST
              // =================================================

              const request =
                await tx.deliveryRequest.create({
                  data: {
                    // =================================================
                    // NOMOR
                    // =================================================

                    number,

                    // =================================================
                    // OUTLET
                    // =================================================
                    // WAJIB DARI USER LOGIN
                    // =================================================

                    outletId,

                    // =================================================
                    // USER PEMBUAT
                    // =================================================

                    createdById:
                      user.id,

                    // =================================================
                    // CUSTOMER
                    // =================================================
                    // WAJIB DARI USER LOGIN
                    // BUKAN DARI FRONTEND
                    // =================================================

                    customerId,

                    // =================================================
                    // REQUEST DATE
                    // =================================================

                    requestDate,

                    // =================================================
                    // STATUS
                    // =================================================
                    // Request baru selalu PENDING
                    // =================================================

                    status: "PENDING",

                    // =================================================
                    // REMARKS
                    // =================================================

                    remarks,

                    // =================================================
                    // ITEMS
                    // =================================================

                    items: {
                      create:
                        items.map(
                          (item) => ({
                            barangId:
                              item.barangId,

                            qty:
                              item.qty,

                            note:
                              item.note,
                          })
                        ),
                    },
                  },

                  // =================================================
                  // RETURN DATA
                  // =================================================

                  include: {
                    // =============================================
                    // OUTLET
                    // =============================================

                    outlet: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                      },
                    },

                    // =============================================
                    // USER
                    // =============================================

                    createdBy: {
                      select: {
                        id: true,
                        username: true,
                        fullname: true,
                        role: true,
                        customerId: true,

                        customer: {
                          select: {
                            id: true,
                            code: true,
                            name: true,
                          },
                        },
                      },
                    },

                    // =============================================
                    // CUSTOMER
                    // =============================================

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

                    // =============================================
                    // ITEMS
                    // =============================================

                    items: {
                      include: {
                        barang: {
                          select: {
                            id: true,
                            code: true,
                            name: true,

                            // ======================================
                            // SATUAN TRANSAKSI
                            // ======================================
                            //
                            // PENTING:
                            // Gunakan `unit`, bukan `baseUnit`.
                            //
                            unit: true,

                            stock: true,
                          },
                        },
                      },
                    },
                  },
                });

              return request;
            }
          );

        // Berhasil
        break;
      } catch (error) {
        // ======================================================
        // RETRY JIKA NOMOR DUPLIKAT
        // ======================================================

        if (
          isUniqueError(error) &&
          attempt < 5
        ) {
          console.warn(
            `DELIVERY REQUEST NUMBER COLLISION. RETRY ${attempt}/5`
          );

          continue;
        }

        throw error;
      }
    }

    // ========================================================
    // 14. SAFETY
    // ========================================================

    if (!createdRequest) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Gagal membuat nomor Delivery Request",
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // 15. RESPONSE
    // ========================================================

    return NextResponse.json(
      {
        success: true,

        message:
          "Delivery Request berhasil dibuat dan menunggu approval",

        data: createdRequest,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "POST DELIVERY REQUEST ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Gagal membuat Delivery Request";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: 500,
      }
    );
  }
}

// ============================================================
// DELETE DELIVERY REQUEST
// ============================================================
//
// ADMIN
// -> boleh menghapus semua Delivery Request
//
// OUTLET_ADMIN
// -> hanya boleh menghapus Delivery Request
//    dari outlet miliknya sendiri
//
// MANAGER / GUDANG
// -> tidak boleh menghapus
//
// Yang dihapus:
// 1. DeliveryRequestItem
// 2. DeliveryRequest
//
// TIDAK mengubah:
// - Barang.stock
// - OutletStock
// - StockMutation
// - StockCard
//
// Karena Delivery Request sendiri belum merupakan
// transaksi pergerakan stock.
//
// Request yang sudah PROCESSING / COMPLETED tidak boleh dihapus.
//
// Request yang sudah memiliki Delivery juga tidak boleh dihapus.
//
// ============================================================

export async function DELETE(req: NextRequest) {
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
    // 2. ROLE
    // ========================================================

    const role = normalizeRole(user.role);

    if (!canDeleteDeliveryRequest(role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses untuk menghapus Delivery Request",
        },
        {
          status: 403,
        }
      );
    }

    // ========================================================
    // 3. GET ID
    // ========================================================
    //
    // DELETE:
    //
    // /api/delivery-request?id=1
    //
    // ========================================================

    const { searchParams } =
      new URL(req.url);

    const idParam =
      searchParams.get("id");

    const id = Number(idParam);

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
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
    // 4. CARI DELIVERY REQUEST
    // ========================================================

    const deliveryRequest =
      await prisma.deliveryRequest.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          number: true,
          outletId: true,
          createdById: true,
          status: true,

          // ==================================================
          // DELIVERY
          // ==================================================

          delivery: {
            select: {
              id: true,
              number: true,
              status: true,
            },
          },
        },
      });

    // ========================================================
    // 5. NOT FOUND
    // ========================================================

    if (!deliveryRequest) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Delivery Request tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // ========================================================
    // 6. SECURITY OUTLET ADMIN
    // ========================================================
    //
    // OUTLET_ADMIN hanya boleh menghapus request
    // milik outlet sendiri.
    //
    // outletId diambil dari session.
    //
    // ========================================================

    if (role === "OUTLET_ADMIN") {
      if (
        !user.outletId ||
        !Number.isInteger(user.outletId)
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet belum memiliki outlet",
          },
          {
            status: 400,
          }
        );
      }

      if (
        deliveryRequest.outletId !==
        user.outletId
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Anda hanya dapat menghapus Delivery Request dari outlet Anda sendiri",
          },
          {
            status: 403,
          }
        );
      }
    }

    // ========================================================
    // 7. CEK STATUS
    // ========================================================
    //
    // PROCESSING / COMPLETED sudah masuk proses
    // pergerakan barang sehingga tidak boleh dihapus.
    //
    // ========================================================

    const protectedStatuses = [
      "PROCESSING",
      "COMPLETED",
    ];

    if (
      protectedStatuses.includes(
        String(
          deliveryRequest.status
        ).toUpperCase()
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Delivery Request ${deliveryRequest.number} sudah berstatus ${deliveryRequest.status} dan tidak dapat dihapus`,
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // 8. CEK DELIVERY
    // ========================================================
    //
    // Kalau request sudah memiliki Delivery,
    // jangan hapus karena sudah masuk transaksi lanjutan.
    //
    // ========================================================

    if (deliveryRequest.delivery) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Delivery Request ${deliveryRequest.number} sudah memiliki Delivery ${deliveryRequest.delivery.number} dan tidak dapat dihapus`,
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // 9. DELETE TRANSACTION
    // ========================================================
    //
    // Hapus item terlebih dahulu.
    // Kemudian hapus header.
    //
    // Semua dalam satu Prisma transaction.
    //
    // ========================================================

    await prisma.$transaction(
      async (tx) => {
        // ====================================================
        // DELETE ITEMS
        // ====================================================

        await tx.deliveryRequestItem.deleteMany({
          where: {
            deliveryRequestId: id,
          },
        });

        // ====================================================
        // DELETE HEADER
        // ====================================================

        await tx.deliveryRequest.delete({
          where: {
            id,
          },
        });
      }
    );

    // ========================================================
    // 10. RESPONSE
    // ========================================================

    return NextResponse.json({
      success: true,

      message:
        `Delivery Request ${deliveryRequest.number} berhasil dihapus`,

      data: {
        id: deliveryRequest.id,
        number: deliveryRequest.number,
      },
    });
  } catch (error) {
    console.error(
      "DELETE DELIVERY REQUEST ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Gagal menghapus Delivery Request",
      },
      {
        status: 500,
      }
    );
  }
}