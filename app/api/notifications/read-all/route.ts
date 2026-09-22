// app/api/notifications/read-all/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

// ============================================================
// CURRENT USER
// ============================================================

async function getCurrentUser() {
  try {
    const cookieStore = await cookies();

    const sessionToken =
      cookieStore.get("erp-session")?.value ||
      cookieStore.get("session")?.value;

    if (!sessionToken) {
      return null;
    }

    // =========================================================
    // DATABASE SESSION
    // =========================================================

    const session =
      await prisma.session.findUnique({
        where: {
          token: sessionToken,
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
      if (
        session.expiresAt <=
        new Date()
      ) {
        return null;
      }

      if (!session.user.active) {
        return null;
      }

      return session.user;
    }

    // =========================================================
    // FALLBACK JSON COOKIE
    // =========================================================

    try {
      const raw =
        decodeURIComponent(
          sessionToken
        );

      const parsed =
        JSON.parse(raw);

      const userId = Number(
        parsed?.user?.id ??
          parsed?.id ??
          0
      );

      if (
        !Number.isInteger(
          userId
        ) ||
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

      if (!user?.active) {
        return null;
      }

      return user;
    } catch {
      return null;
    }
  } catch (error) {
    console.error(
      "[getCurrentUser notifications/read-all]",
      error
    );

    return null;
  }
}

// ============================================================
// POST
// ============================================================

export async function POST() {
  try {
    // =========================================================
    // AUTH
    // =========================================================

    const currentUser =
      await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const readAt =
      new Date();

    // =========================================================
    // MARK PURCHASE MENTIONS AS READ
    // =========================================================

    const purchaseResult =
      await prisma.purchaseCommentMention.updateMany({
        where: {
          userId:
            currentUser.id,

          readAt: null,
        },

        data: {
          readAt,
        },
      });

    // =========================================================
    // MARK TRANSFER MENTIONS AS READ
    // =========================================================

    const transferResult =
      await prisma.outletTransferCommentMention.updateMany({
        where: {
          userId:
            currentUser.id,

          readAt: null,
        },

        data: {
          readAt,
        },
      });

    // =========================================================
    // TOTAL
    // =========================================================

    const updated =
      purchaseResult.count +
      transferResult.count;

    // =========================================================
    // RESPONSE
    // =========================================================

    return NextResponse.json({
      success: true,

      updated,

      purchaseUpdated:
        purchaseResult.count,

      transferUpdated:
        transferResult.count,

      message:
        "Semua pemberitahuan telah ditandai sebagai dibaca.",
    });
  } catch (error) {
    console.error(
      "[POST /api/notifications/read-all]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal menandai semua pemberitahuan sebagai dibaca.",
      },
      {
        status: 500,
      }
    );
  }
}