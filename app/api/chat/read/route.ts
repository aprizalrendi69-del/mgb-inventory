import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function getCurrentUser(request: NextRequest) {
  try {
    const cookie = request.cookies.get("erp-session");

    if (!cookie?.value) {
      return null;
    }

    const sessionData = JSON.parse(cookie.value);

    if (!sessionData?.id) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: Number(sessionData.id),
      },
    });

    if (!user) {
      return null;
    }

    if (!user.active) {
      return null;
    }

    return user;
  } catch (error) {
    console.error("CHAT READ AUTH ERROR:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);

    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const body = await request.json();

    const conversationId = Number(
      body.conversationId,
    );

    if (!Number.isInteger(conversationId)) {
      return NextResponse.json(
        {
          success: false,
          error: "conversationId tidak valid",
        },
        {
          status: 400,
        },
      );
    }

    const participant =
      await prisma.chatParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId: currentUser.id,
          },
        },
      });

    if (!participant) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Anda bukan peserta percakapan ini",
        },
        {
          status: 403,
        },
      );
    }

    const now = new Date();

    await prisma.chatParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: currentUser.id,
        },
      },
      data: {
        lastReadAt: now,
      },
    });

    await prisma.chatMessage.updateMany({
      where: {
        conversationId,
        senderId: {
          not: currentUser.id,
        },
        readAt: null,
      },
      data: {
        readAt: now,
      },
    });

    return NextResponse.json({
      success: true,
      readAt: now,
    });
  } catch (error) {
    console.error(
      "POST /api/chat/read error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Gagal menandai pesan sebagai dibaca",
      },
      {
        status: 500,
      },
    );
  }
}