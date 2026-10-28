import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// =====================================================
// CHAT AUTHENTICATION
// =====================================================

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

    if (!user || !user.active) {
      return null;
    }

    return user;
  } catch (error) {
    console.error("CHAT AUTH ERROR:", error);
    return null;
  }
}

async function verifyConversationParticipant(
  conversationId: number,
  userId: number,
) {
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    return false;
  }

  const participant = await prisma.chatParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
  });

  return Boolean(participant);
}

// =====================================================
// GET /api/chat/messages?conversationId=123
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);

    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const rawConversationId = searchParams.get("conversationId");
    const conversationId = Number(rawConversationId);

    if (
      !rawConversationId ||
      !Number.isInteger(conversationId) ||
      conversationId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "conversationId tidak valid",
        },
        { status: 400 },
      );
    }

    const isParticipant = await verifyConversationParticipant(
      conversationId,
      currentUser.id,
    );

    if (!isParticipant) {
      return NextResponse.json(
        {
          success: false,
          error: "Anda bukan peserta percakapan ini",
        },
        { status: 403 },
      );
    }

    const messages = await prisma.chatMessage.findMany({
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
    console.error("GET /api/chat/messages error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengambil pesan",
      },
      { status: 500 },
    );
  }
}

// =====================================================
// POST /api/chat/messages
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);

    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    let body: {
      conversationId?: unknown;
      message?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Body JSON tidak valid",
        },
        { status: 400 },
      );
    }

    const conversationId = Number(body.conversationId);
    const message =
      typeof body.message === "string" ? body.message.trim() : "";

    if (
      !Number.isInteger(conversationId) ||
      conversationId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "conversationId tidak valid",
        },
        { status: 400 },
      );
    }

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error: "Pesan tidak boleh kosong",
        },
        { status: 400 },
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        {
          success: false,
          error: "Pesan terlalu panjang",
        },
        { status: 400 },
      );
    }

    const isParticipant = await verifyConversationParticipant(
      conversationId,
      currentUser.id,
    );

    if (!isParticipant) {
      return NextResponse.json(
        {
          success: false,
          error: "Anda bukan peserta percakapan ini",
        },
        { status: 403 },
      );
    }

    const createdMessage = await prisma.chatMessage.create({
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
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/chat/messages error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengirim pesan",
      },
      { status: 500 },
    );
  }
}

// =====================================================
// DELETE /api/chat/messages
//
// Delete one message:
//   ?messageId=123&conversationId=456
//
// Clear a conversation:
//   ?conversationId=456&clear=true
//
// Security:
// - The requester must be an active user and a conversation participant.
// - A single message can only be deleted by its sender.
// - clear=true removes all messages in the selected conversation.
// =====================================================

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);

    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const rawConversationId = searchParams.get("conversationId");
    const rawMessageId = searchParams.get("messageId");
    const shouldClearConversation =
      searchParams.get("clear") === "true";

    const conversationId = Number(rawConversationId);

    if (
      !rawConversationId ||
      !Number.isInteger(conversationId) ||
      conversationId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "conversationId tidak valid",
        },
        { status: 400 },
      );
    }

    const isParticipant = await verifyConversationParticipant(
      conversationId,
      currentUser.id,
    );

    if (!isParticipant) {
      return NextResponse.json(
        {
          success: false,
          error: "Anda bukan peserta percakapan ini",
        },
        { status: 403 },
      );
    }

    // Clear all messages in this conversation.
    if (shouldClearConversation) {
      const result = await prisma.$transaction(async (tx) => {
        const deleted = await tx.chatMessage.deleteMany({
          where: {
            conversationId,
          },
        });

        await tx.chatConversation.update({
          where: {
            id: conversationId,
          },
          data: {
            updatedAt: new Date(),
          },
        });

        return deleted;
      });

      return NextResponse.json({
        success: true,
        message: "Percakapan berhasil dibersihkan",
        deletedCount: result.count,
      });
    }

    // Delete one message, only if the current user sent it.
    const messageId = Number(rawMessageId);

    if (
      !rawMessageId ||
      !Number.isInteger(messageId) ||
      messageId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "messageId tidak valid",
        },
        { status: 400 },
      );
    }

    const targetMessage = await prisma.chatMessage.findUnique({
      where: {
        id: messageId,
      },
      select: {
        id: true,
        conversationId: true,
        senderId: true,
      },
    });

    if (
      !targetMessage ||
      targetMessage.conversationId !== conversationId
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Pesan tidak ditemukan",
        },
        { status: 404 },
      );
    }

    if (targetMessage.senderId !== currentUser.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Anda hanya dapat menghapus pesan yang Anda kirim",
        },
        { status: 403 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.chatMessage.delete({
        where: {
          id: messageId,
        },
      });

      await tx.chatConversation.update({
        where: {
          id: conversationId,
        },
        data: {
          updatedAt: new Date(),
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Pesan berhasil dihapus",
      deletedMessageId: messageId,
    });
  } catch (error) {
    console.error("DELETE /api/chat/messages error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Gagal menghapus pesan",
      },
      { status: 500 },
    );
  }
}
