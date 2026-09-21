import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

type CurrentUser = {
  id: number;
  username?: string | null;
  fullname?: string | null;
  role?: string | null;
  outletId?: number | null;
};

async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();

  const sessionToken =
    cookieStore.get("erp-session")?.value ??
    cookieStore.get("session")?.value;

  if (!sessionToken) {
    return null;
  }

  // =========================================================
  // SESSION MODEL
  // =========================================================

  try {
    const session = await prisma.session.findUnique({
      where: {
        token: sessionToken,
      },
      include: {
        user: true,
      },
    });

    if (session?.user) {
      return {
        id: session.user.id,
        username: session.user.username,
        fullname: session.user.fullname,
        role: session.user.role,
        outletId: session.user.outletId,
      };
    }
  } catch {
    // Fallback ke cookie JSON.
  }

  // =========================================================
  // FALLBACK COOKIE JSON
  // =========================================================

  try {
    const parsed = JSON.parse(sessionToken);

    const userId = Number(
      parsed?.userId ??
        parsed?.id ??
        parsed?.user?.id
    );

    if (!Number.isFinite(userId) || userId <= 0) {
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
        outletId: true,
      },
    });

    if (!user) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

function formatNotificationMessage(comment: string) {
  const clean = String(comment ?? "").trim();

  if (!clean) {
    return "Anda disebut dalam komentar purchase.";
  }

  return clean;
}

// =========================================================
// GET NOTIFICATIONS
// =========================================================

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        {
          ok: false,
          message: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    // =======================================================
    // PURCHASE COMMENT MENTIONS
    // =======================================================

    const mentions =
      await prisma.purchaseCommentMention.findMany({
        where: {
          userId: currentUser.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
        select: {
          id: true,
          userId: true,
          createdAt: true,
          readAt: true,

          comment: {
            select: {
              id: true,
              comment: true,
              createdAt: true,
              userId: true,

              user: {
                select: {
                  id: true,
                  fullname: true,
                  username: true,
                },
              },

              purchaseId: true,
              outletPurchaseId: true,

              // -------------------------------------------------
              // PURCHASE PUSAT
              // -------------------------------------------------

              purchase: {
                select: {
                  id: true,
                  purchaseDate: true,
                  status: true,
                  paymentMethod: true,
                  total: true,
                },
              },

              // -------------------------------------------------
              // PURCHASE OUTLET
              // -------------------------------------------------

              outletPurchase: {
                select: {
                  id: true,
                  outlet: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

    // =======================================================
    // TRANSFORM NOTIFICATIONS
    // =======================================================

    const notifications = mentions.map((mention) => {
      const comment = mention.comment;

      const actorName =
        comment.user?.fullname ||
        comment.user?.username ||
        "User";

      const isOutletPurchase =
        Boolean(comment.outletPurchaseId);

      const purchase = comment.purchase;
      const outletPurchase = comment.outletPurchase;

      let context = "Purchase";

      if (isOutletPurchase) {
        context = outletPurchase?.outlet?.name
          ? `Purchase Outlet • ${outletPurchase.outlet.name}`
          : "Purchase Outlet";
      } else if (purchase) {
        context = "Purchase Pusat";
      }

      // -----------------------------------------------------
      // LINK
      // -----------------------------------------------------

      let link = "/purchase";

      if (outletPurchase?.id) {
        link = `/outlet/purchase/${outletPurchase.id}`;
      } else if (purchase?.id) {
        link = `/purchase/${purchase.id}`;
      }

      return {
        id: `purchase-comment-mention-${mention.id}`,

        // ID asli supaya frontend mudah mengirim ke POST.
        mentionId: mention.id,

        type: "PURCHASE_COMMENT_MENTION",

        title: `${actorName} menyebut Anda`,

        message: formatNotificationMessage(
          comment.comment
        ),

        description: context,

        createdAt: mention.createdAt,

        read: Boolean(mention.readAt),

        readAt: mention.readAt,

        commentId: comment.id,

        purchaseId: comment.purchaseId,

        outletPurchaseId:
          comment.outletPurchaseId,

        link,

        actor: {
          id:
            comment.user?.id ??
            comment.userId,

          fullname:
            comment.user?.fullname ??
            null,

          username:
            comment.user?.username ??
            null,
        },

        purchase: purchase
          ? {
              id: purchase.id,
              purchaseDate:
                purchase.purchaseDate,
              status: purchase.status,
              paymentMethod:
                purchase.paymentMethod,
              total: purchase.total,
            }
          : null,

        outletPurchase: outletPurchase
          ? {
              id: outletPurchase.id,
              outlet:
                outletPurchase.outlet,
            }
          : null,

        meta: {
          context,
        },
      };
    });

    // =======================================================
    // UNREAD COUNT
    // =======================================================

    const unreadCount =
      await prisma.purchaseCommentMention.count({
        where: {
          userId: currentUser.id,
          readAt: null,
        },
      });

    return NextResponse.json({
      ok: true,
      notifications,
      unreadCount,
      total: notifications.length,
    });
  } catch (error) {
    console.error(
      "[GET /api/notifications] Error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Gagal mengambil pemberitahuan.",
        notifications: [],
        unreadCount: 0,
      },
      {
        status: 500,
      }
    );
  }
}

// =========================================================
// POST - MARK ONE NOTIFICATION AS READ
// =========================================================
//
// Body:
// {
//   mentionId: 123
// }
//
// Saat notification diklik:
// purchaseCommentMention.readAt = sekarang
//
// Hanya user pemilik mention yang boleh mengubahnya.
// =========================================================

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        {
          ok: false,
          message: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    let body: {
      mentionId?: number | string;
      notificationId?: number | string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          message: "Body request tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    // Bisa menerima mentionId langsung.
    // notificationId juga didukung untuk fleksibilitas frontend.
    let mentionIdValue =
      body.mentionId ??
      body.notificationId;

    // Kalau frontend mengirim:
    // purchase-comment-mention-123
    // ambil angka 123.
    if (
      typeof mentionIdValue === "string" &&
      mentionIdValue.startsWith(
        "purchase-comment-mention-"
      )
    ) {
      mentionIdValue =
        mentionIdValue.replace(
          "purchase-comment-mention-",
          ""
        );
    }

    const mentionId = Number(
      mentionIdValue
    );

    if (
      !Number.isInteger(mentionId) ||
      mentionId <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "mentionId notification tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    // =======================================================
    // CARI NOTIFICATION MILIK USER
    // =======================================================

    const mention =
      await prisma.purchaseCommentMention.findFirst({
        where: {
          id: mentionId,
          userId: currentUser.id,
        },
        select: {
          id: true,
          userId: true,
          readAt: true,
        },
      });

    if (!mention) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Notification tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    // =======================================================
    // SUDAH TERBACA
    // =======================================================

    if (mention.readAt) {
      return NextResponse.json({
        ok: true,
        alreadyRead: true,
        readAt: mention.readAt,
        mentionId: mention.id,
      });
    }

    // =======================================================
    // MARK AS READ
    // =======================================================

    const readAt = new Date();

    const updated =
      await prisma.purchaseCommentMention.update({
        where: {
          id: mention.id,
        },
        data: {
          readAt,
        },
        select: {
          id: true,
          userId: true,
          readAt: true,
        },
      });

    // =======================================================
    // HITUNG ULANG UNREAD
    // =======================================================

    const unreadCount =
      await prisma.purchaseCommentMention.count({
        where: {
          userId: currentUser.id,
          readAt: null,
        },
      });

    return NextResponse.json({
      ok: true,
      alreadyRead: false,
      mentionId: updated.id,
      readAt: updated.readAt,
      unreadCount,
    });
  } catch (error) {
    console.error(
      "[POST /api/notifications] Error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Gagal menandai notification sebagai dibaca.",
      },
      {
        status: 500,
      }
    );
  }
}