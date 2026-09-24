// app/api/outlet/barang-masuk/[id]/comments/route.ts

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

import { prisma } from "@/lib/prisma";

// ============================================================
// TYPES
// ============================================================

type SessionUser = {
  id: number;
  username: string;
  fullname: string;
  role: string;
  active: boolean;
  outletId: number | null;
};

type TransactionSource = "PURCHASE" | "TRANSFER";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// ============================================================
// CURRENT USER
// ============================================================

async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();

  const sessionCookie =
    cookieStore.get("erp-session") ??
    cookieStore.get("session");

  if (!sessionCookie?.value) {
    return null;
  }

  // ----------------------------------------------------------
  // DATABASE SESSION
  // ----------------------------------------------------------

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
      if (session.expiresAt < new Date()) {
        return null;
      }

      if (!session.user.active) {
        return null;
      }

      return session.user;
    }
  } catch (error) {
    console.error(
      "BARANG MASUK COMMENTS DATABASE SESSION ERROR:",
      error
    );
  }

  // ----------------------------------------------------------
  // JSON SESSION FALLBACK
  // ----------------------------------------------------------

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
        username: true,
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
      "BARANG MASUK COMMENTS JSON SESSION ERROR:",
      error
    );

    return null;
  }
}

// ============================================================
// ACCESS
// ============================================================

function canAccessComments(role: string) {
  return (
    role === "ADMIN" ||
    role === "MANAGER" ||
    role === "OUTLET_ADMIN"
  );
}

// ============================================================
// ROUTE KEY
// ============================================================

async function getRouteKey(
  context: RouteContext
): Promise<string | null> {
  const params = await context.params;

  const rawId = String(
    params?.id ?? ""
  ).trim();

  if (!rawId) {
    return null;
  }

  return rawId;
}

// ============================================================
// PARSE SOURCE
// ============================================================

function parseSource(
  value: string | null | undefined
): TransactionSource | null {
  const source = String(
    value ?? ""
  )
    .trim()
    .toUpperCase();

  if (source === "PURCHASE") {
    return "PURCHASE";
  }

  if (source === "TRANSFER") {
    return "TRANSFER";
  }

  return null;
}

// ============================================================
// DETECT SOURCE FROM NUMBER
// ============================================================

function detectSourceFromNumber(
  value: string
): TransactionSource | null {
  const normalized = value
    .trim()
    .toUpperCase();

  if (
    normalized.startsWith("TRANSFER-")
  ) {
    return "TRANSFER";
  }

  if (
    normalized.startsWith("PURCHASE-")
  ) {
    return "PURCHASE";
  }

  return null;
}

// ============================================================
// PURCHASE ACCESS
// ============================================================

async function getOutletPurchaseForUser(
  transactionKey: string,
  user: SessionUser
) {
  const normalizedKey = String(
    transactionKey ?? ""
  ).trim();

  let purchaseId: number | null = null;

  // PURCHASE-36
  const purchaseMatch =
    normalizedKey.match(
      /^PURCHASE-(\d+)$/i
    );

  if (purchaseMatch) {
    const parsedId = Number(
      purchaseMatch[1]
    );

    if (
      Number.isInteger(parsedId) &&
      parsedId > 0
    ) {
      purchaseId = parsedId;
    }
  }

  // Plain numeric ID
  if (!purchaseId) {
    const parsedId = Number(
      normalizedKey
    );

    if (
      Number.isInteger(parsedId) &&
      parsedId > 0
    ) {
      purchaseId = parsedId;
    }
  }

  // Find purchase
  const purchase = purchaseId
    ? await prisma.outletPurchase.findUnique({
        where: {
          id: purchaseId,
        },
        select: {
          id: true,
          number: true,
          outletId: true,

          supplier: {
            select: {
              id: true,
              name: true,
            },
          },

          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      })
    : await prisma.outletPurchase.findUnique({
        where: {
          number: normalizedKey,
        },
        select: {
          id: true,
          number: true,
          outletId: true,

          supplier: {
            select: {
              id: true,
              name: true,
            },
          },

          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });

  if (!purchase) {
    return null;
  }

  // Outlet admin hanya boleh outlet sendiri
  if (
    user.role === "OUTLET_ADMIN" &&
    purchase.outletId !== user.outletId
  ) {
    return null;
  }

  return purchase;
}

// ============================================================
// TRANSFER ACCESS
// ============================================================

async function getOutletTransferForUser(
  transactionKey: string,
  user: SessionUser
) {
  const normalizedKey = String(
    transactionKey ?? ""
  ).trim();

  let transferId: number | null = null;

  // TRANSFER-147
  const transferMatch =
    normalizedKey.match(
      /^TRANSFER-(\d+)$/i
    );

  if (transferMatch) {
    const parsedId = Number(
      transferMatch[1]
    );

    if (
      Number.isInteger(parsedId) &&
      parsedId > 0
    ) {
      transferId = parsedId;
    }
  }

  // Plain numeric ID
  if (!transferId) {
    const parsedId = Number(
      normalizedKey
    );

    if (
      Number.isInteger(parsedId) &&
      parsedId > 0
    ) {
      transferId = parsedId;
    }
  }

  // Find transfer
  const transfer = transferId
    ? await prisma.outletTransfer.findUnique({
        where: {
          id: transferId,
        },
        select: {
          id: true,
          number: true,
          sourceOutletId: true,
          outletId: true,
          transferDate: true,
          status: true,
          remarks: true,

          sourceOutlet: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },

          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      })
    : await prisma.outletTransfer.findUnique({
        where: {
          number: normalizedKey,
        },
        select: {
          id: true,
          number: true,
          sourceOutletId: true,
          outletId: true,
          transferDate: true,
          status: true,
          remarks: true,

          sourceOutlet: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },

          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });

  if (!transfer) {
    return null;
  }

  // Outlet admin hanya boleh outlet tujuan sendiri
  if (
    user.role === "OUTLET_ADMIN" &&
    transfer.outletId !== user.outletId
  ) {
    return null;
  }

  return transfer;
}

// ============================================================
// RESOLVE TRANSACTION
// ============================================================

async function resolveTransaction(
  transactionKey: string,
  source: TransactionSource | null,
  user: SessionUser
) {
  // Explicit transfer
  if (source === "TRANSFER") {
    const transfer =
      await getOutletTransferForUser(
        transactionKey,
        user
      );

    if (!transfer) {
      return null;
    }

    return {
      source: "TRANSFER" as const,
      transaction: transfer,
    };
  }

  // Explicit purchase
  if (source === "PURCHASE") {
    const purchase =
      await getOutletPurchaseForUser(
        transactionKey,
        user
      );

    if (!purchase) {
      return null;
    }

    return {
      source: "PURCHASE" as const,
      transaction: purchase,
    };
  }

  // Auto detect
  const detectedSource =
    detectSourceFromNumber(
      transactionKey
    );

  if (
    detectedSource === "TRANSFER"
  ) {
    const transfer =
      await getOutletTransferForUser(
        transactionKey,
        user
      );

    if (!transfer) {
      return null;
    }

    return {
      source: "TRANSFER" as const,
      transaction: transfer,
    };
  }

  if (
    detectedSource === "PURCHASE"
  ) {
    const purchase =
      await getOutletPurchaseForUser(
        transactionKey,
        user
      );

    if (!purchase) {
      return null;
    }

    return {
      source: "PURCHASE" as const,
      transaction: purchase,
    };
  }

  // Try purchase
  const purchase =
    await getOutletPurchaseForUser(
      transactionKey,
      user
    );

  if (purchase) {
    return {
      source: "PURCHASE" as const,
      transaction: purchase,
    };
  }

  // Fallback transfer
  const transfer =
    await getOutletTransferForUser(
      transactionKey,
      user
    );

  if (transfer) {
    return {
      source: "TRANSFER" as const,
      transaction: transfer,
    };
  }

  return null;
}

// ============================================================
// SAVE COMMENT PHOTO
// ============================================================

async function saveCommentPhoto(
  file: File
): Promise<string> {
  const MAX_SIZE =
    5 * 1024 * 1024;

  if (file.size <= 0) {
    throw new Error(
      "File foto kosong."
    );
  }

  if (file.size > MAX_SIZE) {
    throw new Error(
      "Ukuran foto maksimal 5 MB."
    );
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];

  if (
    !allowedTypes.includes(
      file.type
    )
  ) {
    throw new Error(
      "Format foto tidak didukung. Gunakan JPG, PNG, WEBP, atau GIF."
    );
  }

  const extensionMap: Record<
    string,
    string
  > = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };

  const extension =
    extensionMap[file.type] ??
    "jpg";

  const filename = `${Date.now()}-${crypto
    .randomBytes(8)
    .toString("hex")}.${extension}`;

  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "comments"
  );

  await mkdir(uploadDir, {
    recursive: true,
  });

  const filePath = path.join(
    uploadDir,
    filename
  );

  const arrayBuffer =
    await file.arrayBuffer();

  const buffer = Buffer.from(
    arrayBuffer
  );

  await writeFile(
    filePath,
    buffer
  );

  return `/uploads/comments/${filename}`;
}

// ============================================================
// NORMALIZE PURCHASE COMMENT
// ============================================================

function normalizePurchaseComment(
  comment: any
) {
  return {
    id: comment.id,

    content:
      comment.comment,

    photo:
      comment.photo ?? null,

    createdAt:
      comment.createdAt,

    updatedAt: null,

    user: comment.user
      ? {
          id: comment.user.id,

          name:
            comment.user.fullname ??
            comment.user.username,

          username:
            comment.user.username,

          role:
            comment.user.role,
        }
      : null,

    mentions:
      Array.isArray(comment.mentions)
        ? comment.mentions
            .map(
              (mention: any) =>
                mention.user
            )
            .filter(Boolean)
            .map(
              (mentionUser: any) => ({
                id: mentionUser.id,

                name:
                  mentionUser.fullname ??
                  mentionUser.username,

                username:
                  mentionUser.username,

                role:
                  mentionUser.role,
              })
            )
        : [],
  };
}

// ============================================================
// NORMALIZE TRANSFER COMMENT
// ============================================================

function normalizeTransferComment(
  comment: any
) {
  return {
    id: comment.id,

    content:
      comment.comment,

    photo:
      comment.photo ?? null,

    createdAt:
      comment.createdAt,

    updatedAt: null,

    user: comment.user
      ? {
          id: comment.user.id,

          name:
            comment.user.fullname ??
            comment.user.username,

          username:
            comment.user.username,

          role:
            comment.user.role,
        }
      : null,

    mentions:
      Array.isArray(comment.mentions)
        ? comment.mentions
            .map(
              (mention: any) =>
                mention.user
            )
            .filter(Boolean)
            .map(
              (mentionUser: any) => ({
                id: mentionUser.id,

                name:
                  mentionUser.fullname ??
                  mentionUser.username,

                username:
                  mentionUser.username,

                role:
                  mentionUser.role,
              })
            )
        : [],
  };
}

// ============================================================
// PURCHASE COMMENT SELECT
// ============================================================

const purchaseCommentSelect = {
  id: true,
  comment: true,
  photo: true,
  createdAt: true,

  user: {
    select: {
      id: true,
      username: true,
      fullname: true,
      role: true,
    },
  },

  mentions: {
    select: {
      id: true,

      user: {
        select: {
          id: true,
          username: true,
          fullname: true,
          role: true,
        },
      },
    },
  },
} as const;

// ============================================================
// TRANSFER COMMENT SELECT
// ============================================================

const transferCommentSelect = {
  id: true,
  comment: true,
  photo: true,
  createdAt: true,

  user: {
    select: {
      id: true,
      username: true,
      fullname: true,
      role: true,
    },
  },

  mentions: {
    select: {
      id: true,

      user: {
        select: {
          id: true,
          username: true,
          fullname: true,
          role: true,
        },
      },
    },
  },
} as const;

// ============================================================
// LOAD PURCHASE COMMENTS
// ============================================================

async function loadPurchaseComments(
  purchaseId: number
) {
  const comments =
    await prisma.purchaseComment.findMany({
      where: {
        outletPurchaseId:
          purchaseId,
      },

      orderBy: {
        createdAt: "asc",
      },

      select:
        purchaseCommentSelect,
    });

  return comments.map(
    normalizePurchaseComment
  );
}

// ============================================================
// LOAD TRANSFER COMMENTS
// ============================================================

async function loadTransferComments(
  transferId: number
) {
  const comments =
    await prisma.outletTransferComment.findMany({
      where: {
        transferId,
      },

      orderBy: {
        createdAt: "asc",
      },

      select:
        transferCommentSelect,
    });

  return comments.map(
    normalizeTransferComment
  );
}

// ============================================================
// GET
// ============================================================

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login atau session tidak valid.",
        },
        {
          status: 401,
        }
      );
    }

    if (
      !canAccessComments(
        user.role
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses ke diskusi Barang Masuk outlet.",
        },
        {
          status: 403,
        }
      );
    }

    const transactionKey =
      await getRouteKey(context);

    if (!transactionKey) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Nomor transaksi tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    const source =
      parseSource(
        request.nextUrl.searchParams.get(
          "source"
        )
      );

    const resolved =
      await resolveTransaction(
        transactionKey,
        source,
        user
      );

    if (!resolved) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Transaksi tidak ditemukan atau Anda tidak memiliki akses.",
        },
        {
          status: 404,
        }
      );
    }

    // --------------------------------------------------------
    // PURCHASE
    // --------------------------------------------------------

    if (
      resolved.source ===
      "PURCHASE"
    ) {
      const purchase =
        resolved.transaction;

      const comments =
        await loadPurchaseComments(
          purchase.id
        );

      return NextResponse.json({
        success: true,

        currentUserId:
          user.id,

        source:
          "PURCHASE",

        comments,

        data:
          comments,

        transaction: {
          id: purchase.id,

          number:
            purchase.number,

          outlet:
            purchase.outlet,

          supplier:
            purchase.supplier,
        },
      });
    }

    // --------------------------------------------------------
    // TRANSFER
    // --------------------------------------------------------

    const transfer =
      resolved.transaction;

    const comments =
      await loadTransferComments(
        transfer.id
      );

    return NextResponse.json({
      success: true,

      currentUserId:
        user.id,

      source:
        "TRANSFER",

      comments,

      data:
        comments,

      transaction: {
        id: transfer.id,

        number:
          transfer.number,

        sourceOutlet:
          transfer.sourceOutlet,

        outlet:
          transfer.outlet,

        transferDate:
          transfer.transferDate,

        status:
          transfer.status,

        remarks:
          transfer.remarks,
      },
    });
  } catch (error: any) {
    console.error(
      "GET BARANG MASUK COMMENTS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal memuat diskusi Barang Masuk.",
      },
      {
        status: 500,
      }
    );
  }
}

// ============================================================
// POST
// ============================================================

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // --------------------------------------------------------
    // AUTH
    // --------------------------------------------------------

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login atau session tidak valid.",
        },
        {
          status: 401,
        }
      );
    }

    // --------------------------------------------------------
    // ROLE
    // --------------------------------------------------------

    if (
      !canAccessComments(
        user.role
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses untuk menambahkan diskusi.",
        },
        {
          status: 403,
        }
      );
    }

    // --------------------------------------------------------
    // TRANSACTION KEY
    // --------------------------------------------------------

    const transactionKey =
      await getRouteKey(context);

    if (!transactionKey) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Nomor transaksi tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------------
    // FORM DATA
    // --------------------------------------------------------

    const formData =
      await request.formData();

    const rawContent =
      formData.get("content");

    const content =
      typeof rawContent ===
      "string"
        ? rawContent.trim()
        : "";

    // --------------------------------------------------------
    // SOURCE
    // --------------------------------------------------------

    const rawSource =
      formData.get("source");

    const source =
      parseSource(
        typeof rawSource ===
          "string"
          ? rawSource
          : request.nextUrl.searchParams.get(
              "source"
            )
      );

    // --------------------------------------------------------
    // PHOTO
    // --------------------------------------------------------

    const rawPhoto =
      formData.get("photo");

    let photoPath:
      | string
      | null = null;

    if (
      rawPhoto instanceof File &&
      rawPhoto.size > 0
    ) {
      photoPath =
        await saveCommentPhoto(
          rawPhoto
        );
    }

    // --------------------------------------------------------
    // COMMENT + PHOTO
    // --------------------------------------------------------

    if (
      !content &&
      !photoPath
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Komentar atau foto wajib diisi.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      content.length > 5000
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Komentar terlalu panjang. Maksimal 5.000 karakter.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------------
    // MENTION IDS
    // --------------------------------------------------------

    let mentionUserIds: number[] =
      [];

    const rawMentionUserIds =
      formData.get(
        "mentionUserIds"
      );

    if (
      typeof rawMentionUserIds ===
      "string"
    ) {
      try {
        const parsed =
          JSON.parse(
            rawMentionUserIds
          );

        if (
          Array.isArray(parsed)
        ) {
          mentionUserIds =
            Array.from(
              new Set(
                parsed
                  .map(
                    (
                      value: unknown
                    ) =>
                      Number(value)
                  )
                  .filter(
                    (
                      value: number
                    ) =>
                      Number.isInteger(
                        value
                      ) &&
                      value > 0
                  )
              )
            );
        }
      } catch {
        return NextResponse.json(
          {
            success: false,
            message:
              "Format mentionUserIds tidak valid.",
          },
          {
            status: 400,
          }
        );
      }
    }

    // --------------------------------------------------------
    // VALIDATE MENTION USERS
    // --------------------------------------------------------

    let validMentionUsers: {
      id: number;
      username: string;
      fullname: string;
      role: any;
      active: boolean;
    }[] = [];

    if (
      mentionUserIds.length >
      0
    ) {
      validMentionUsers =
        await prisma.user.findMany({
          where: {
            id: {
              in: mentionUserIds,
            },

            active: true,
          },

          select: {
            id: true,
            username: true,
            fullname: true,
            role: true,
            active: true,
          },
        });

      if (
        validMentionUsers.length !==
        mentionUserIds.length
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Salah satu user yang di-mention tidak valid atau sudah tidak aktif.",
          },
          {
            status: 400,
          }
        );
      }
    }

    // --------------------------------------------------------
    // RESOLVE TRANSACTION
    // --------------------------------------------------------

    const resolved =
      await resolveTransaction(
        transactionKey,
        source,
        user
      );

    if (!resolved) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Transaksi tidak ditemukan atau Anda tidak memiliki akses.",
        },
        {
          status: 404,
        }
      );
    }

    // ========================================================
    // PURCHASE
    // ========================================================

    if (
      resolved.source ===
      "PURCHASE"
    ) {
      const purchase =
        resolved.transaction;

      const createdComment =
        await prisma.purchaseComment.create({
          data: {
            outletPurchaseId:
              purchase.id,

            userId:
              user.id,

            comment:
              content,

            photo:
              photoPath,

            mentions:
              validMentionUsers.length >
              0
                ? {
                    create:
                      validMentionUsers.map(
                        (
                          mentionedUser
                        ) => ({
                          userId:
                            mentionedUser.id,
                        })
                      ),
                  }
                : undefined,
          },

          select:
            purchaseCommentSelect,
        });

      const normalizedComment =
        normalizePurchaseComment(
          createdComment
        );

      return NextResponse.json(
        {
          success: true,

          message:
            "Komentar berhasil ditambahkan.",

          currentUserId:
            user.id,

          source:
            "PURCHASE",

          comment:
            normalizedComment,

          data:
            normalizedComment,
        },
        {
          status: 201,
        }
      );
    }

    // ========================================================
    // TRANSFER
    // ========================================================

    const transfer =
      resolved.transaction;

    const createdComment =
      await prisma.outletTransferComment.create({
        data: {
          transferId:
            transfer.id,

          userId:
            user.id,

          comment:
            content,

          photo:
            photoPath,

          mentions:
            validMentionUsers.length >
            0
              ? {
                  create:
                    validMentionUsers.map(
                      (
                        mentionedUser
                      ) => ({
                        userId:
                          mentionedUser.id,
                      })
                    ),
                }
              : undefined,
        },

        select:
          transferCommentSelect,
      });

    const normalizedComment =
      normalizeTransferComment(
        createdComment
      );

    return NextResponse.json(
      {
        success: true,

        message:
          "Komentar transfer berhasil ditambahkan.",

        currentUserId:
          user.id,

        source:
          "TRANSFER",

        comment:
          normalizedComment,

        data:
          normalizedComment,
      },
      {
        status: 201,
      }
    );
  } catch (error: any) {
    console.error(
      "POST BARANG MASUK COMMENTS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal menyimpan komentar Barang Masuk.",
      },
      {
        status: 500,
      }
    );
  }
}