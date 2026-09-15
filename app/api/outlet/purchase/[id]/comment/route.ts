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
              fullname: true,
              role: true,
              active: true,
              outletId: true,
            },
          },
        },
      });

    if (session) {
      if (
        session.expiresAt < new Date()
      ) {
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

function canAccessOutletPurchase(
  role: Role
) {
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

function getPurchaseId(
  value: string
) {
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
// CHECK PURCHASE ACCESS
// =====================================================

async function getAccessiblePurchase(
  purchaseId: number,
  user: {
    role: Role;
    outletId: number | null;
  }
) {
  if (
    user.role ===
    Role.OUTLET_ADMIN
  ) {
    if (!user.outletId) {
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
  req: NextRequest,
  { params }: RouteContext
) {
  try {
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

    if (
      !canAccessOutletPurchase(
        user.role
      )
    ) {
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

    if (
      user.role ===
        Role.OUTLET_ADMIN &&
      !user.outletId
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

    const { id } =
      await params;

    const purchaseId =
      getPurchaseId(id);

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
            "Purchase Outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    const comments =
      await prisma.purchaseComment.findMany({
        where: {
          outletPurchaseId:
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
        },

        orderBy: {
          createdAt: "asc",
        },
      });

    return NextResponse.json({
      success: true,

      data: comments,
    });
  } catch (error: any) {
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

    if (
      !canAccessOutletPurchase(
        user.role
      )
    ) {
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

    if (
      user.role ===
        Role.OUTLET_ADMIN &&
      !user.outletId
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

    const { id } =
      await params;

    const purchaseId =
      getPurchaseId(id);

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

    const comment =
      typeof body?.comment ===
      "string"
        ? body.comment.trim()
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
            "Purchase Outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

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
              },
            });

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

    return NextResponse.json({
      success: true,

      message:
        "Komentar berhasil ditambahkan",

      data: result,
    });
  } catch (error: any) {
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