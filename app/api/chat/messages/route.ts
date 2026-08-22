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
    console.error("CHAT AUTH ERROR:", error);
    return null;
  }
}

export async function GET(
  request: NextRequest,
) {
  try {
    const currentUser =
      await getCurrentUser(request);

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

    const { searchParams } =
      new URL(request.url);

    const conversationId = Number(
      searchParams.get(
        "conversationId",
      ),
    );

    if (
      !Number.isInteger(
        conversationId,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "conversationId tidak valid",
        },
        {
          status: 400,
        },
      );
    }

    const participant =
      await prisma.chatParticipant.findUnique(
        {
          where: {
            conversationId_userId: {
              conversationId,
              userId: currentUser.id,
            },
          },
        },
      );

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

    const messages =
      await prisma.chatMessage.findMany({
        where: {
          conversationId,
        },

        orderBy: {
          createdAt: "asc",
        },

        include: {
          sender: {
            select: {
              id: true,
              username: true,
              fullname: true,
              role: true,
              outletId: true,
            },
          },
        },
      });

    return NextResponse.json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error(
      "GET /api/chat/messages error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Gagal mengambil pesan",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    const currentUser =
      await getCurrentUser(request);

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

    const body =
      await request.json();

    const conversationId = Number(
      body.conversationId,
    );

    const message =
      typeof body.message ===
      "string"
        ? body.message.trim()
        : "";

    if (
      !Number.isInteger(
        conversationId,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "conversationId tidak valid",
        },
        {
          status: 400,
        },
      );
    }

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Pesan tidak boleh kosong",
        },
        {
          status: 400,
        },
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Pesan terlalu panjang",
        },
        {
          status: 400,
        },
      );
    }

    const participant =
      await prisma.chatParticipant.findUnique(
        {
          where: {
            conversationId_userId: {
              conversationId,
              userId: currentUser.id,
            },
          },
        },
      );

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

    const createdMessage =
      await prisma.chatMessage.create({
        data: {
          conversationId,
          senderId: currentUser.id,
          message,
        },

        include: {
          sender: {
            select: {
              id: true,
              username: true,
              fullname: true,
              role: true,
              outletId: true,
            },
          },
        },
      });

    await prisma.chatConversation.update({
      where: {
        id: conversationId,
      },

      data: {
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: createdMessage,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "POST /api/chat/messages error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Gagal mengirim pesan",
      },
      {
        status: 500,
      },
    );
  }
}