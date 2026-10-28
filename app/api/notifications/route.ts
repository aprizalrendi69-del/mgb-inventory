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

  if (!sessionToken) return null;

  // SESSION MODEL
  try {
    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: { user: true },
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

  // FALLBACK COOKIE JSON
  try {
    const parsed = JSON.parse(sessionToken);

    const userId = Number(
      parsed?.userId ?? parsed?.id ?? parsed?.user?.id
    );

    if (!Number.isFinite(userId) || userId <= 0) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullname: true,
        role: true,
        outletId: true,
      },
    });

    return user ?? null;
  } catch {
    return null;
  }
}

// =========================================================
// HELPERS
// =========================================================

function formatNotificationMessage(
  comment: string,
  fallback = "Anda disebut dalam komentar."
) {
  const clean = String(comment ?? "").trim();
  return clean || fallback;
}

// =========================================================
// GET NOTIFICATIONS
// Menggabungkan seluruh:
// 1. PurchaseCommentMention
// 2. OutletTransferCommentMention
// 3. PayableReminderLog
//
// Tidak menggunakan batas jumlah notifikasi.
// =========================================================

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const [
      purchaseMentions,
      transferMentions,
      payableReminders,
    ] = await Promise.all([
      // PURCHASE COMMENT MENTIONS
      prisma.purchaseCommentMention.findMany({
        where: {
          userId: currentUser.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        // Tidak ada take: 50.
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
              purchase: {
                select: {
                  id: true,
                  purchaseDate: true,
                  status: true,
                  paymentMethod: true,
                  total: true,
                },
              },
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
      }),

      // OUTLET TRANSFER COMMENT MENTIONS
      prisma.outletTransferCommentMention.findMany({
        where: {
          userId: currentUser.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        // Tidak ada take: 50.
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
              transferId: true,
              transfer: {
                select: {
                  id: true,
                  number: true,
                  transferDate: true,
                  status: true,
                  sourceOutlet: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
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
      }),

      // PAYABLE REMINDERS
      prisma.payableReminderLog.findMany({
        where: {
          userId: currentUser.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        // Tidak ada take: 50.
        select: {
          id: true,
          stage: true,
          supplierName: true,
          invoiceNumber: true,
          outstanding: true,
          dueDate: true,
          source: true,
          message: true,
          createdAt: true,
          readAt: true,
          whatsappStatus: true,
        },
      }),
    ]);

    // =======================================================
    // TRANSFORM PURCHASE NOTIFICATIONS
    // =======================================================

    const purchaseNotifications = purchaseMentions.map((mention) => {
      const comment = mention.comment;

      const actorName =
        comment.user?.fullname ||
        comment.user?.username ||
        "User";

      const isOutletPurchase = Boolean(comment.outletPurchaseId);
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

      let link = "/purchase";

      if (outletPurchase?.id) {
        link = `/outlet/purchase/${outletPurchase.id}`;
      } else if (purchase?.id) {
        link = `/purchase/${purchase.id}`;
      }

      return {
        id: `purchase-comment-mention-${mention.id}`,
        mentionId: mention.id,
        type: "PURCHASE_COMMENT_MENTION",
        title: `${actorName} menyebut Anda`,
        message: formatNotificationMessage(
          comment.comment,
          "Anda disebut dalam komentar purchase."
        ),
        description: context,
        createdAt: mention.createdAt,
        read: Boolean(mention.readAt),
        readAt: mention.readAt,
        commentId: comment.id,
        purchaseId: comment.purchaseId,
        outletPurchaseId: comment.outletPurchaseId,
        link,
        actor: {
          id: comment.user?.id ?? comment.userId,
          fullname: comment.user?.fullname ?? null,
          username: comment.user?.username ?? null,
        },
        purchase: purchase
          ? {
              id: purchase.id,
              purchaseDate: purchase.purchaseDate,
              status: purchase.status,
              paymentMethod: purchase.paymentMethod,
              total: purchase.total,
            }
          : null,
        outletPurchase: outletPurchase
          ? {
              id: outletPurchase.id,
              outlet: outletPurchase.outlet,
            }
          : null,
        meta: {
          context,
          source: "PURCHASE_COMMENT_MENTION",
        },
      };
    });

    // =======================================================
    // TRANSFORM TRANSFER NOTIFICATIONS
    // =======================================================

    const transferNotifications = transferMentions.map((mention) => {
      const comment = mention.comment;
      const transfer = comment.transfer;

      const actorName =
        comment.user?.fullname ||
        comment.user?.username ||
        "User";

      const transferNumber =
        transfer?.number || `TRANSFER-${comment.transferId}`;

      let context = `Transfer • ${transferNumber}`;

      if (transfer?.sourceOutlet?.name && transfer?.outlet?.name) {
        context =
          `Transfer • ${transferNumber} • ${transfer.sourceOutlet.name} → ${transfer.outlet.name}`;
      } else if (transfer?.outlet?.name) {
        context = `Transfer • ${transferNumber} • ${transfer.outlet.name}`;
      }

      const link = `/outlet/barang-masuk/TRANSFER-${comment.transferId}`;

      return {
        id: `transfer-comment-mention-${mention.id}`,
        mentionId: mention.id,
        type: "TRANSFER_COMMENT_MENTION",
        title: `${actorName} menyebut Anda`,
        message: formatNotificationMessage(
          comment.comment,
          "Anda disebut dalam komentar transfer."
        ),
        description: context,
        createdAt: mention.createdAt,
        read: Boolean(mention.readAt),
        readAt: mention.readAt,
        commentId: comment.id,
        transferId: comment.transferId,
        transferNumber,
        link,
        actor: {
          id: comment.user?.id ?? comment.userId,
          fullname: comment.user?.fullname ?? null,
          username: comment.user?.username ?? null,
        },
        transfer: transfer
          ? {
              id: transfer.id,
              number: transfer.number,
              transferDate: transfer.transferDate,
              status: transfer.status,
            }
          : {
              id: comment.transferId,
              number: transferNumber,
              transferDate: null,
              status: null,
            },
        meta: {
          context,
          source: "OUTLET_TRANSFER_COMMENT_MENTION",
          sourceOutlet: transfer?.sourceOutlet
            ? {
                id: transfer.sourceOutlet.id,
                name: transfer.sourceOutlet.name,
              }
            : null,
          destinationOutlet: transfer?.outlet
            ? {
                id: transfer.outlet.id,
                name: transfer.outlet.name,
              }
            : null,
        },
      };
    });

    // =======================================================
    // TRANSFORM PAYABLE REMINDERS
    // =======================================================

    const payableReminderNotifications = payableReminders.map(
      (reminder) => ({
        id: `payable-reminder-${reminder.id}`,
        mentionId: reminder.id,
        type: "PAYABLE_REMINDER",
        title:
          reminder.stage === "OVERDUE"
            ? "Hutang terlambat dibayar"
            : reminder.stage === "DUE"
              ? "Hutang jatuh tempo hari ini"
              : `Pengingat pembayaran hutang ${reminder.stage}`,
        message: reminder.message,
        description: `${reminder.supplierName} • ${reminder.invoiceNumber}`,
        createdAt: reminder.createdAt,
        read: Boolean(reminder.readAt),
        readAt: reminder.readAt,
        link: "/purchase-payable",
        meta: {
          source: "PAYABLE_REMINDER",
          payableId: reminder.id,
          stage: reminder.stage,
          outstanding: reminder.outstanding,
          dueDate: reminder.dueDate,
          outletOrSource: reminder.source,
          whatsappStatus: reminder.whatsappStatus,
        },
      })
    );

    // =======================================================
    // MERGE ALL NOTIFICATIONS
    // Tidak ada .slice(0, 50).
    // Semua hasil dari ketiga sumber dipertahankan.
    // =======================================================

    const notifications = [
      ...purchaseNotifications,
      ...transferNotifications,
      ...payableReminderNotifications,
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    );

    // =======================================================
    // UNREAD COUNT
    // =======================================================

    const [
      unreadPurchaseCount,
      unreadTransferCount,
      unreadPayableCount,
    ] = await Promise.all([
      prisma.purchaseCommentMention.count({
        where: {
          userId: currentUser.id,
          readAt: null,
        },
      }),
      prisma.outletTransferCommentMention.count({
        where: {
          userId: currentUser.id,
          readAt: null,
        },
      }),
      prisma.payableReminderLog.count({
        where: {
          userId: currentUser.id,
          readAt: null,
        },
      }),
    ]);

    const unreadCount =
      unreadPurchaseCount +
      unreadTransferCount +
      unreadPayableCount;

    return NextResponse.json({
      ok: true,
      notifications,
      unreadCount,
      total: notifications.length,
    });
  } catch (error) {
    console.error("[GET /api/notifications] Error:", error);

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
      { status: 500 }
    );
  }
}

// =========================================================
// POST - MARK ONE NOTIFICATION AS READ
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
        { status: 401 }
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
        { status: 400 }
      );
    }

    let mentionIdValue = body.mentionId ?? body.notificationId;

    let notificationType: "PURCHASE" | "TRANSFER" | null = null;

    // PURCHASE PREFIX
    if (
      typeof mentionIdValue === "string" &&
      mentionIdValue.startsWith("purchase-comment-mention-")
    ) {
      notificationType = "PURCHASE";
      mentionIdValue = mentionIdValue.replace(
        "purchase-comment-mention-",
        ""
      );
    }
    // TRANSFER PREFIX
    else if (
      typeof mentionIdValue === "string" &&
      mentionIdValue.startsWith("transfer-comment-mention-")
    ) {
      notificationType = "TRANSFER";
      mentionIdValue = mentionIdValue.replace(
        "transfer-comment-mention-",
        ""
      );
    }

    // PAYABLE REMINDER
    if (
      typeof mentionIdValue === "string" &&
      mentionIdValue.startsWith("payable-reminder-")
    ) {
      const reminderId = Number(
        mentionIdValue.replace("payable-reminder-", "")
      );

      if (!Number.isInteger(reminderId) || reminderId <= 0) {
        return NextResponse.json(
          {
            ok: false,
            message: "ID pengingat tidak valid.",
          },
          { status: 400 }
        );
      }

      const updated = await prisma.payableReminderLog.updateMany({
        where: {
          id: reminderId,
          userId: currentUser.id,
          readAt: null,
        },
        data: {
          readAt: new Date(),
        },
      });

      const [
        unreadPurchaseCount,
        unreadTransferCount,
        unreadPayableCount,
      ] = await Promise.all([
        prisma.purchaseCommentMention.count({
          where: { userId: currentUser.id, readAt: null },
        }),
        prisma.outletTransferCommentMention.count({
          where: { userId: currentUser.id, readAt: null },
        }),
        prisma.payableReminderLog.count({
          where: { userId: currentUser.id, readAt: null },
        }),
      ]);

      return NextResponse.json({
        ok: true,
        alreadyRead: updated.count === 0,
        notificationType: "PAYABLE_REMINDER",
        unreadCount:
          unreadPurchaseCount +
          unreadTransferCount +
          unreadPayableCount,
      });
    }

    // VALIDATE MENTION ID
    const mentionId = Number(mentionIdValue);

    if (!Number.isInteger(mentionId) || mentionId <= 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "mentionId notification tidak valid.",
        },
        { status: 400 }
      );
    }

    // =======================================================
    // TRANSFER NOTIFICATION
    // =======================================================

    if (notificationType === "TRANSFER") {
      const mention =
        await prisma.outletTransferCommentMention.findFirst({
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
            message: "Notification transfer tidak ditemukan.",
          },
          { status: 404 }
        );
      }

      if (mention.readAt) {
        const [
          unreadPurchaseCount,
          unreadTransferCount,
          unreadPayableCount,
        ] = await Promise.all([
          prisma.purchaseCommentMention.count({
            where: { userId: currentUser.id, readAt: null },
          }),
          prisma.outletTransferCommentMention.count({
            where: { userId: currentUser.id, readAt: null },
          }),
          prisma.payableReminderLog.count({
            where: { userId: currentUser.id, readAt: null },
          }),
        ]);

        return NextResponse.json({
          ok: true,
          alreadyRead: true,
          readAt: mention.readAt,
          mentionId: mention.id,
          notificationType: "TRANSFER",
          unreadCount:
            unreadPurchaseCount +
            unreadTransferCount +
            unreadPayableCount,
        });
      }

      const readAt = new Date();

      const updated =
        await prisma.outletTransferCommentMention.update({
          where: { id: mention.id },
          data: { readAt },
          select: {
            id: true,
            userId: true,
            readAt: true,
          },
        });

      const [
        unreadPurchaseCount,
        unreadTransferCount,
        unreadPayableCount,
      ] = await Promise.all([
        prisma.purchaseCommentMention.count({
          where: { userId: currentUser.id, readAt: null },
        }),
        prisma.outletTransferCommentMention.count({
          where: { userId: currentUser.id, readAt: null },
        }),
        prisma.payableReminderLog.count({
          where: { userId: currentUser.id, readAt: null },
        }),
      ]);

      return NextResponse.json({
        ok: true,
        alreadyRead: false,
        mentionId: updated.id,
        readAt: updated.readAt,
        notificationType: "TRANSFER",
        unreadCount:
          unreadPurchaseCount +
          unreadTransferCount +
          unreadPayableCount,
      });
    }

    // =======================================================
    // PURCHASE NOTIFICATION
    // ID tanpa prefix tetap dianggap Purchase
    // untuk kompatibilitas dengan frontend lama.
    // =======================================================

    const mention = await prisma.purchaseCommentMention.findFirst({
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
          message: "Notification tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    if (mention.readAt) {
      const [
        unreadPurchaseCount,
        unreadTransferCount,
        unreadPayableCount,
      ] = await Promise.all([
        prisma.purchaseCommentMention.count({
          where: { userId: currentUser.id, readAt: null },
        }),
        prisma.outletTransferCommentMention.count({
          where: { userId: currentUser.id, readAt: null },
        }),
        prisma.payableReminderLog.count({
          where: { userId: currentUser.id, readAt: null },
        }),
      ]);

      return NextResponse.json({
        ok: true,
        alreadyRead: true,
        readAt: mention.readAt,
        mentionId: mention.id,
        notificationType: "PURCHASE",
        unreadCount:
          unreadPurchaseCount +
          unreadTransferCount +
          unreadPayableCount,
      });
    }

    const readAt = new Date();

    const updated = await prisma.purchaseCommentMention.update({
      where: { id: mention.id },
      data: { readAt },
      select: {
        id: true,
        userId: true,
        readAt: true,
      },
    });

    const [
      unreadPurchaseCount,
      unreadTransferCount,
      unreadPayableCount,
    ] = await Promise.all([
      prisma.purchaseCommentMention.count({
        where: { userId: currentUser.id, readAt: null },
      }),
      prisma.outletTransferCommentMention.count({
        where: { userId: currentUser.id, readAt: null },
      }),
      prisma.payableReminderLog.count({
        where: { userId: currentUser.id, readAt: null },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      alreadyRead: false,
      mentionId: updated.id,
      readAt: updated.readAt,
      notificationType: "PURCHASE",
      unreadCount:
        unreadPurchaseCount +
        unreadTransferCount +
        unreadPayableCount,
    });
  } catch (error) {
    console.error("[POST /api/notifications] Error:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Gagal menandai notification sebagai dibaca.",
      },
      { status: 500 }
    );
  }
}