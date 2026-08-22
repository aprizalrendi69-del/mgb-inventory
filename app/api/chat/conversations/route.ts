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

export async function GET(request: NextRequest) {
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

    const conversations =
      await prisma.chatConversation.findMany({
        where: {
          participants: {
            some: {
              userId: currentUser.id,
            },
          },
        },

        orderBy: {
          updatedAt: "desc",
        },

        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  fullname: true,
                  role: true,
                  outletId: true,
                  lastSeen: true,

                  outlet: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },

          messages: {
            orderBy: {
              createdAt: "desc",
            },

            take: 1,

            include: {
              sender: {
                select: {
                  id: true,
                  fullname: true,
                },
              },
            },
          },
        },
      });

    const now = Date.now();

    const result = conversations.map(
      (conversation) => {
        const me =
          conversation.participants.find(
            (participant) =>
              participant.userId ===
              currentUser.id,
          );

        const otherParticipants =
          conversation.participants.filter(
            (participant) =>
              participant.userId !==
              currentUser.id,
          );

        const otherUsers =
          otherParticipants.map(
            (participant) => {
              const lastSeen =
                participant.user.lastSeen
                  ?.getTime() ?? 0;

              return {
                ...participant.user,

                online:
                  lastSeen > 0 &&
                  now - lastSeen <=
                    60 * 1000,

                lastReadAt:
                  participant.lastReadAt,
              };
            },
          );

        const lastMessage =
          conversation.messages[0] ?? null;

        return {
          id: conversation.id,

          createdAt:
            conversation.createdAt,

          updatedAt:
            conversation.updatedAt,

          participants:
            otherUsers,

          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                message:
                  lastMessage.message,
                createdAt:
                  lastMessage.createdAt,
                readAt:
                  lastMessage.readAt,
                senderId:
                  lastMessage.senderId,
                senderName:
                  lastMessage.sender
                    .fullname,
              }
            : null,

          lastReadAt:
            me?.lastReadAt ?? null,
        };
      },
    );

    return NextResponse.json({
      success: true,
      conversations: result,
    });
  } catch (error) {
    console.error(
      "GET /api/chat/conversations error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Gagal mengambil percakapan",
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

    const body = await request.json();

    const targetUserId = Number(
      body.userId,
    );

    if (!Number.isInteger(targetUserId)) {
      return NextResponse.json(
        {
          success: false,
          error: "userId tidak valid",
        },
        {
          status: 400,
        },
      );
    }

    if (
      targetUserId ===
      currentUser.id
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Tidak dapat membuat chat dengan diri sendiri",
        },
        {
          status: 400,
        },
      );
    }

    const targetUser =
      await prisma.user.findFirst({
        where: {
          id: targetUserId,
          active: true,
        },
      });

    if (!targetUser) {
      return NextResponse.json(
        {
          success: false,
          error: "User tidak ditemukan",
        },
        {
          status: 404,
        },
      );
    }

    const existing =
      await prisma.chatConversation.findFirst(
        {
          where: {
            participants: {
              every: {
                userId: {
                  in: [
                    currentUser.id,
                    targetUserId,
                  ],
                },
              },
            },

            AND: [
              {
                participants: {
                  some: {
                    userId:
                      currentUser.id,
                  },
                },
              },

              {
                participants: {
                  some: {
                    userId:
                      targetUserId,
                  },
                },
              },
            ],
          },

          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    fullname: true,
                    role: true,
                    outletId: true,
                    lastSeen: true,

                    outlet: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      );

    if (existing) {
      return NextResponse.json({
        success: true,
        conversation: existing,
      });
    }

    const conversation =
      await prisma.chatConversation.create({
        data: {
          participants: {
            create: [
              {
                userId:
                  currentUser.id,
              },
              {
                userId:
                  targetUserId,
              },
            ],
          },
        },

        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  fullname: true,
                  role: true,
                  outletId: true,
                  lastSeen: true,

                  outlet: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

    return NextResponse.json(
      {
        success: true,
        conversation,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "POST /api/chat/conversations error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Gagal membuat percakapan",
      },
      {
        status: 500,
      },
    );
  }
}