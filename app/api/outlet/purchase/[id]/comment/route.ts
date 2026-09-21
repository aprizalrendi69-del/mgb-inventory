import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// =====================================================
// CURRENT USER
// =====================================================

async function getCurrentUser() {
  const cookieStore = await cookies();

  const sessionCookie =
    cookieStore.get("session") ||
    cookieStore.get("erp-session");

  if (!sessionCookie) {
    return null;
  }

  // ===================================================
  // DATABASE SESSION
  // ===================================================

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
      "DATABASE SESSION CHECK ERROR:",
      error
    );
  }

  // ===================================================
  // FALLBACK JSON SESSION
  // ===================================================

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
      "JSON SESSION CHECK ERROR:",
      error
    );

    return null;
  }
}

// =====================================================
// ACCESS
// =====================================================

function canAccessOutletPurchase(role: Role) {
  return (
    role === Role.ADMIN ||
    role === Role.MANAGER ||
    role === Role.PURCHASING ||
    role === Role.OUTLET_ADMIN
  );
}

// =====================================================
// ID
// =====================================================

function getPurchaseId(value: string) {
  const id = Number(value);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return id;
}

// =====================================================
// NORMALIZE MENTION IDS
// =====================================================

function normalizeMentionIds(
  value: unknown
): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const ids = value
    .map((item) => Number(item))
    .filter(
      (id) =>
        Number.isInteger(id) &&
        id > 0
    );

  return Array.from(new Set(ids));
}

// =====================================================
// CHECK PURCHASE ACCESS
// =====================================================
//
// OUTLET_ADMIN:
// -> HANYA purchase outlet milik outlet sendiri.
//
// ADMIN / MANAGER / PURCHASING:
// -> Bisa mengakses semua Purchase Outlet.
//
// Tidak pernah percaya outletId dari frontend.
// Scope selalu berdasarkan session user.
//

async function getAccessiblePurchase(
  purchaseId: number,
  user: {
    role: Role;
    outletId: number | null;
  }
) {
  // ---------------------------------------------------
  // OUTLET ADMIN
  // ---------------------------------------------------

  if (user.role === Role.OUTLET_ADMIN) {
    if (user.outletId === null) {
      return null;
    }

    return prisma.outletPurchase.findFirst({
      where: {
        id: purchaseId,
        outletId: user.outletId,
      },

      select: {
        id: true,
        number: true,
        outletId: true,
      },
    });
  }

  // ---------------------------------------------------
  // ADMIN / MANAGER / PURCHASING
  // ---------------------------------------------------

  return prisma.outletPurchase.findUnique({
    where: {
      id: purchaseId,
    },

    select: {
      id: true,
      number: true,
      outletId: true,
    },
  });
}

// =====================================================
// GET COMMENTS
// =====================================================

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
) {
  try {
    const user = await getCurrentUser();

    // =================================================
    // AUTH
    // =================================================

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

    // =================================================
    // ROLE ACCESS
    // =================================================

    if (!canAccessOutletPurchase(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses Purchase Outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // OUTLET ADMIN MUST HAVE OUTLET
    // =================================================

    if (
      user.role === Role.OUTLET_ADMIN &&
      user.outletId === null
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User Outlet Admin belum terhubung dengan outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // PURCHASE ID
    // =================================================

    const { id } = await params;

    const purchaseId = getPurchaseId(id);

    if (!purchaseId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID Purchase Outlet tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // CHECK PURCHASE ACCESS
    // =================================================

    const purchase =
      await getAccessiblePurchase(
        purchaseId,
        user
      );

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet tidak ditemukan atau Anda tidak memiliki akses",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // GET COMMENTS
    // =================================================

    const comments =
      await prisma.purchaseComment.findMany({
        where: {
          outletPurchaseId: purchaseId,
        },

        include: {
          user: {
            select: {
              id: true,
              fullname: true,
              role: true,
              outletId: true,
              active: true,
            },
          },

          mentions: {
            orderBy: {
              createdAt: "asc",
            },

            include: {
              user: {
                select: {
                  id: true,
                  fullname: true,
                  role: true,
                  outletId: true,
                  active: true,
                },
              },
            },
          },
        },

        orderBy: {
          createdAt: "asc",
        },
      });

    // =================================================
    // UI HELPER
    // =================================================
    //
    // canDelete HANYA untuk membantu frontend.
    //
    // Security DELETE tetap dilakukan di:
    // [commentId]/route.ts
    //
    // Jangan pernah percaya nilai canDelete dari client.
    //

    const data = comments.map((item) => ({
      ...item,

      canDelete:
        item.user.id === user.id,
    }));

    // =================================================
    // RESPONSE
    // =================================================

    return NextResponse.json({
      success: true,

      currentUserId: user.id,

      data,
    });
  } catch (error) {
    console.error(
      "GET OUTLET PURCHASE COMMENTS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil komentar Purchase Outlet",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// POST COMMENT
// =====================================================

export async function POST(
  req: NextRequest,
  { params }: RouteContext
) {
  try {
    const user = await getCurrentUser();

    // =================================================
    // AUTH
    // =================================================

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

    // =================================================
    // ROLE ACCESS
    // =================================================

    if (!canAccessOutletPurchase(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses memberikan komentar Purchase Outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // OUTLET ADMIN MUST HAVE OUTLET
    // =================================================

    if (
      user.role === Role.OUTLET_ADMIN &&
      user.outletId === null
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User Outlet Admin belum terhubung dengan outlet",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // PURCHASE ID
    // =================================================

    const { id } = await params;

    const purchaseId = getPurchaseId(id);

    if (!purchaseId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID Purchase Outlet tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // PARSE BODY
    // =================================================

    let body: unknown;

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

    // =================================================
    // COMMENT
    // =================================================

    const comment =
      typeof (body as {
        comment?: unknown;
      })?.comment === "string"
        ? (
            body as {
              comment: string;
            }
          ).comment.trim()
        : "";

    if (!comment) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Komentar tidak boleh kosong",
        },
        {
          status: 400,
        }
      );
    }

    if (comment.length > 2000) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Komentar maksimal 2000 karakter",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // MENTION IDS
    // =================================================

    const mentionedUserIds =
      normalizeMentionIds(
        (body as {
          mentionedUserIds?: unknown;
        })?.mentionedUserIds
      );

    // =================================================
    // CHECK PURCHASE ACCESS
    // =================================================

    const purchase =
      await getAccessiblePurchase(
        purchaseId,
        user
      );

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet tidak ditemukan atau Anda tidak memiliki akses",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // VALIDATE MENTION USERS
    // =================================================

    if (mentionedUserIds.length > 0) {
      const mentionUsers =
        await prisma.user.findMany({
          where: {
            id: {
              in: mentionedUserIds,
            },

            active: true,
          },

          select: {
            id: true,
          },
        });

      const foundIds = new Set(
        mentionUsers.map(
          (item) => item.id
        )
      );

      const invalidIds =
        mentionedUserIds.filter(
          (mentionId) =>
            !foundIds.has(mentionId)
        );

      if (invalidIds.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Salah satu user yang di-mention tidak ditemukan atau sudah tidak aktif",

            invalidUserIds:
              invalidIds,
          },
          {
            status: 400,
          }
        );
      }
    }

    // =================================================
    // CREATE COMMENT
    // + MENTIONS
    // + HISTORY
    // =================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          const created =
            await tx.purchaseComment.create({
              data: {
                outletPurchaseId:
                  purchaseId,

                userId:
                  user.id,

                comment,

                mentions:
                  mentionedUserIds.length > 0
                    ? {
                        create:
                          mentionedUserIds.map(
                            (
                              mentionedUserId
                            ) => ({
                              userId:
                                mentionedUserId,
                            })
                          ),
                      }
                    : undefined,
              },

              include: {
                user: {
                  select: {
                    id: true,
                    fullname: true,
                    role: true,
                    outletId: true,
                    active: true,
                  },
                },

                mentions: {
                  orderBy: {
                    createdAt: "asc",
                  },

                  include: {
                    user: {
                      select: {
                        id: true,
                        fullname: true,
                        role: true,
                        outletId: true,
                        active: true,
                      },
                    },
                  },
                },
              },
            });

          // ===========================================
          // HISTORY
          // ===========================================

          await tx.history.create({
            data: {
              transactionType:
                "PURCHASE",

              referenceNumber:
                purchase.number,

              description:
                `Menambahkan komentar pada Purchase Order Outlet ${purchase.number}`,

              userId:
                user.id,
            },
          });

          return created;
        }
      );

    // =================================================
    // RESPONSE
    // =================================================

    return NextResponse.json({
      success: true,

      message:
        "Komentar berhasil ditambahkan",

      currentUserId: user.id,

      data: {
        ...result,

        // UI helper saja.
        // Backend DELETE tetap melakukan
        // pengecekan ownership.
        canDelete: true,
      },
    });
  } catch (error) {
    console.error(
      "POST OUTLET PURCHASE COMMENT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal menambahkan komentar",
      },
      {
        status: 500,
      }
    );
  }
}