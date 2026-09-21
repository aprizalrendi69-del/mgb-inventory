import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function getCurrentUser() {
  const cookieStore = await cookies();

  const sessionCookie =
    cookieStore.get("session") ||
    cookieStore.get("erp-session");

  if (!sessionCookie) {
    return null;
  }

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
    console.error("DATABASE SESSION CHECK ERROR:", error);
  }

  /*
   * Fallback untuk session cookie berbentuk JSON.
   */
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
    console.error("JSON SESSION CHECK ERROR:", error);
    return null;
  }
}

function canAccessCentralPurchase(role: Role) {
  return (
    role === Role.ADMIN ||
    role === Role.MANAGER ||
    role === Role.PURCHASING
  );
}

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

function normalizeMentionIds(
  value: unknown
): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter(
          (id) =>
            Number.isInteger(id) &&
            id > 0
        )
    )
  );
}

// =========================================================
// GET
// =========================================================

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        { status: 401 }
      );
    }

    if (!canAccessCentralPurchase(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses komentar Purchase Pusat",
        },
        { status: 403 }
      );
    }

    if (user.outletId !== null) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User outlet tidak dapat mengakses komentar Purchase Pusat",
        },
        { status: 403 }
      );
    }

    const { id } = await params;

    const purchaseId = getPurchaseId(id);

    if (!purchaseId) {
      return NextResponse.json(
        {
          success: false,
          message: "ID Purchase tidak valid",
        },
        { status: 400 }
      );
    }

    const purchase =
      await prisma.purchase.findUnique({
        where: {
          id: purchaseId,
        },
        select: {
          id: true,
        },
      });

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Order tidak ditemukan",
        },
        { status: 404 }
      );
    }

    const comments =
      await prisma.purchaseComment.findMany({
        where: {
          purchaseId,
        },
        include: {
          user: {
            select: {
              id: true,
              fullname: true,
              role: true,
              outletId: true,
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

    return NextResponse.json({
      success: true,
      data: comments,
    });
  } catch (error) {
    console.error(
      "GET PURCHASE COMMENTS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil komentar Purchase Order",
      },
      { status: 500 }
    );
  }
}

// =========================================================
// POST
// =========================================================

export async function POST(
  req: NextRequest,
  { params }: RouteContext
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        { status: 401 }
      );
    }

    if (!canAccessCentralPurchase(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses komentar Purchase Pusat",
        },
        { status: 403 }
      );
    }

    if (user.outletId !== null) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User outlet tidak dapat memberikan komentar pada Purchase Pusat",
        },
        { status: 403 }
      );
    }

    const { id } = await params;

    const purchaseId = getPurchaseId(id);

    if (!purchaseId) {
      return NextResponse.json(
        {
          success: false,
          message: "ID Purchase tidak valid",
        },
        { status: 400 }
      );
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Body request tidak valid",
        },
        { status: 400 }
      );
    }

    const comment =
      typeof (body as { comment?: unknown })?.comment ===
      "string"
        ? (body as { comment: string }).comment.trim()
        : "";

    if (!comment) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Komentar tidak boleh kosong",
        },
        { status: 400 }
      );
    }

    if (comment.length > 2000) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Komentar maksimal 2000 karakter",
        },
        { status: 400 }
      );
    }

    const mentionedUserIds =
      normalizeMentionIds(
        (body as { mentionedUserIds?: unknown })
          ?.mentionedUserIds
      );

    const purchase =
      await prisma.purchase.findUnique({
        where: {
          id: purchaseId,
        },
        select: {
          id: true,
        },
      });

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Order tidak ditemukan",
        },
        { status: 404 }
      );
    }

    // =====================================================
    // VALIDATE MENTION USERS
    // =====================================================

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
            invalidUserIds: invalidIds,
          },
          { status: 400 }
        );
      }
    }

    // =====================================================
    // CREATE COMMENT
    // =====================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          const created =
            await tx.purchaseComment.create({
              data: {
                purchaseId,
                userId: user.id,
                comment,
                mentions:
                  mentionedUserIds.length > 0
                    ? {
                        create:
                          mentionedUserIds.map(
                            (mentionedUserId) => ({
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

          await tx.history.create({
            data: {
              transactionType: "PURCHASE",
              referenceNumber: String(purchase.id),
              description:
                `Menambahkan komentar pada Purchase Order #${purchase.id}`,
              userId: user.id,
            },
          });

          return created;
        }
      );

    return NextResponse.json({
      success: true,
      message:
        "Komentar berhasil ditambahkan",
      data: result,
    });
  } catch (error) {
    console.error(
      "POST PURCHASE COMMENT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal menambahkan komentar",
      },
      { status: 500 }
    );
  }
}