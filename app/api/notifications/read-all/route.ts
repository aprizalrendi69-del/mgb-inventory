import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

async function getCurrentUser() {
  try {
    const cookieStore = await cookies();

    const sessionToken =
      cookieStore.get("erp-session")?.value ||
      cookieStore.get("session")?.value;

    if (!sessionToken) {
      return null;
    }

    const session = await prisma.session.findUnique({
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
      if (session.expiresAt <= new Date()) {
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
      const raw = decodeURIComponent(sessionToken);
      const parsed = JSON.parse(raw);

      if (!parsed?.id) {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: {
          id: Number(parsed.id),
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
  } catch {
    return null;
  }
}

export async function POST() {
  try {
    const currentUser = await getCurrentUser();

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

    const result =
      await prisma.purchaseCommentMention.updateMany({
        where: {
          userId: currentUser.id,
          readAt: null,
        },

        data: {
          readAt: new Date(),
        },
      });

    return NextResponse.json({
      success: true,

      updated: result.count,

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