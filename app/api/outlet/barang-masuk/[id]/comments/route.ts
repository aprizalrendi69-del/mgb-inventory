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

type ParsedCommentBody = {
  content: string;
  photo: string | null;
  source: TransactionSource | null;
  mentionUserIds: number[];
  photoFile: File | null;
};

// ============================================================
// COMMENT PHOTO CONFIG
// ============================================================

const COMMENT_PHOTO_MAX_SIZE = 5 * 1024 * 1024;

const COMMENT_PHOTO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const COMMENT_PHOTO_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

// ============================================================
// ERROR RESPONSE
// ============================================================

function errorResponse(
  message: string,
  status = 400
) {
  return NextResponse.json(
    {
      success: false,
      message,
      error: message,
    },
    {
      status,
    }
  );
}

// ============================================================
// PHOTO URL NORMALIZER
// ============================================================
//
// Tujuan:
//
// Database lama mungkin menyimpan:
//
// /uploads/comments/file.jpg
// uploads/comments/file.jpg
// \uploads\comments\file.jpg
// C:\...\public\uploads\comments\file.jpg
// D:\project\public\uploads\comments\file.jpg
// http://localhost:3000/uploads/comments/file.jpg
// https://domain.com/uploads/comments/file.jpg
//
// Browser membutuhkan:
//
// /uploads/comments/file.jpg
//
// Fungsi ini HANYA mengubah nilai yang dikirim ke client.
// Tidak mengubah data database.
// ============================================================

function normalizeCommentPhoto(
  value: unknown
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  let raw =
    value.trim();

  if (!raw) {
    return null;
  }

  // ----------------------------------------------------------
  // Decode URL bila pernah tersimpan encoded
  // ----------------------------------------------------------

  try {
    raw =
      decodeURIComponent(raw);
  } catch {
    // Biarkan nilai asli jika bukan encoded URL yang valid.
  }

  // ----------------------------------------------------------
  // Normalisasi slash Windows
  // ----------------------------------------------------------

  raw =
    raw.replace(/\\/g, "/");

  // ----------------------------------------------------------
  // Trim quote yang mungkin tersimpan dari marker lama
  // ----------------------------------------------------------

  raw =
    raw.replace(/^["']+|["']+$/g, "")
      .trim();

  if (!raw) {
    return null;
  }

  // ----------------------------------------------------------
  // Absolute URL
  //
  // http://domain/uploads/comments/a.jpg
  // https://domain/uploads/comments/a.jpg
  //
  // Kita tetap mengembalikan URL absolut jika memang berasal
  // dari URL web yang valid dan memiliki /uploads/comments/.
  // ----------------------------------------------------------

  try {
    const parsedUrl =
      new URL(raw);

    const pathname =
      parsedUrl.pathname.replace(
        /\/+/g,
        "/"
      );

    const uploadIndex =
      pathname
        .toLowerCase()
        .indexOf(
          "/uploads/comments/"
        );

    if (
      uploadIndex >= 0
    ) {
      return `${pathname.slice(
        uploadIndex
      )}${parsedUrl.search}${parsedUrl.hash}`;
    }

    // URL external bukan path foto komentar lokal.
    // Jangan dipaksakan menjadi /uploads.
    return null;
  } catch {
    // Bukan URL absolute.
  }

  // ----------------------------------------------------------
  // Data URI lama
  //
  // Tidak dipakai sebagai source foto komentar karena browser
  // tidak perlu dan sistem komentar kita menggunakan upload
  // lokal.
  // ----------------------------------------------------------

  if (
    raw
      .toLowerCase()
      .startsWith("data:image/")
  ) {
    return null;
  }

  // ----------------------------------------------------------
  // Cari marker /uploads/comments/
  //
  // Ini menangani:
  //
  // uploads/comments/file.jpg
  // /uploads/comments/file.jpg
  // C:/project/public/uploads/comments/file.jpg
  // C:/project/public/uploads/comments/file.jpg?x
  // ----------------------------------------------------------

  const normalizedLower =
    raw.toLowerCase();

  const marker =
    "/uploads/comments/";

  const markerIndex =
    normalizedLower.indexOf(
      marker
    );

  if (
    markerIndex >= 0
  ) {
    let result =
      raw.slice(
        markerIndex
      );

    result =
      result.replace(
        /\/+/g,
        "/"
      );

    if (
      !result.startsWith(
        "/"
      )
    ) {
      result =
        `/${result}`;
    }

    return result;
  }

  // ----------------------------------------------------------
  // Handle tanpa slash awal
  // ----------------------------------------------------------

  const markerWithoutSlash =
    "uploads/comments/";

  const markerWithoutSlashIndex =
    normalizedLower.indexOf(
      markerWithoutSlash
    );

  if (
    markerWithoutSlashIndex >= 0
  ) {
    let result =
      raw.slice(
        markerWithoutSlashIndex
      );

    result =
      result.replace(
        /\/+/g,
        "/"
      );

    return `/${result}`;
  }

  // ----------------------------------------------------------
  // Legacy marker kemungkinan:
  //
  // comments/xxx.jpg
  // comment-xxx.jpg
  //
  // Hanya ambil jika nama file memang terlihat seperti file
  // komentar. Jangan mengubah sembarang string menjadi URL.
  // ----------------------------------------------------------

  const basename =
    path
      .basename(raw)
      .replace(
        /\\/g,
        "/"
      );

  const safeBasename =
    basename
      .split("?")[0]
      .split("#")[0]
      .trim();

  if (
    /^comment-\d+-[a-f0-9]+\.(jpg|jpeg|png|webp|gif)$/i.test(
      safeBasename
    )
  ) {
    return `/uploads/comments/${safeBasename}`;
  }

  // ----------------------------------------------------------
  // Jika value sudah berupa relative /uploads path tetapi
  // formatnya sedikit berbeda.
  // ----------------------------------------------------------

  if (
    normalizedLower.startsWith(
      "uploads/"
    )
  ) {
    const relative =
      raw.replace(
        /^\/+/,
        ""
      );

    if (
      relative
        .toLowerCase()
        .startsWith(
          "uploads/comments/"
        )
    ) {
      return `/${relative}`;
    }
  }

  return null;
}

// ============================================================
// SAVE COMMENT PHOTO
// ============================================================

async function saveCommentPhoto(
  file: File
): Promise<string> {
  if (!(file instanceof File)) {
    throw new Error(
      "File foto komentar tidak valid."
    );
  }

  if (file.size <= 0) {
    throw new Error(
      "Foto komentar kosong."
    );
  }

  if (
    file.size >
    COMMENT_PHOTO_MAX_SIZE
  ) {
    throw new Error(
      "Ukuran foto komentar maksimal 5 MB."
    );
  }

  const mimeType =
    String(file.type ?? "")
      .trim()
      .toLowerCase()
      .split(";")[0]
      .trim();

  if (
    !COMMENT_PHOTO_MIME_TYPES.has(
      mimeType
    )
  ) {
    throw new Error(
      "Format foto tidak didukung. Gunakan JPG, PNG, WebP, atau GIF."
    );
  }

  const extension =
    COMMENT_PHOTO_EXTENSIONS[
      mimeType
    ];

  if (!extension) {
    throw new Error(
      "Extension foto tidak valid."
    );
  }

  const uploadDirectory =
    path.join(
      process.cwd(),
      "public",
      "uploads",
      "comments"
    );

  await mkdir(
    uploadDirectory,
    {
      recursive: true,
    }
  );

  const filename =
    `comment-${Date.now()}-${crypto
      .randomBytes(8)
      .toString("hex")}${extension}`;

  const filePath =
    path.join(
      uploadDirectory,
      filename
    );

  const arrayBuffer =
    await file.arrayBuffer();

  const buffer =
    Buffer.from(arrayBuffer);

  await writeFile(
    filePath,
    buffer
  );

  return `/uploads/comments/${filename}`;
}

// ============================================================
// CURRENT USER
// ============================================================

async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore =
    await cookies();

  const sessionCookie =
    cookieStore.get(
      "erp-session"
    );

  if (!sessionCookie?.value) {
    return null;
  }

  try {
    const parsed =
      JSON.parse(
        sessionCookie.value
      );

    const userId =
      Number(
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

    if (
      !user ||
      !user.active
    ) {
      return null;
    }

    return user;
  } catch (error) {
    console.error(
      "BARANG MASUK COMMENTS SESSION ERROR:",
      error
    );

    return null;
  }
}

// ============================================================
// ACCESS
// ============================================================

function canAccessComments(
  role: string
) {
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
  const params =
    await context.params;

  const rawId =
    String(
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
  value:
    | string
    | null
    | undefined
): TransactionSource | null {
  const source =
    String(value ?? "")
      .trim()
      .toUpperCase();

  if (
    source === "PURCHASE"
  ) {
    return "PURCHASE";
  }

  if (
    source === "TRANSFER"
  ) {
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
  const normalized =
    value
      .trim()
      .toUpperCase();

  if (
    normalized.startsWith(
      "TRANSFER-"
    )
  ) {
    return "TRANSFER";
  }

  if (
    normalized.startsWith(
      "PURCHASE-"
    )
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
  const normalizedKey =
    String(
      transactionKey ?? ""
    ).trim();

  let purchaseId:
    | number
    | null = null;

  const purchaseMatch =
    normalizedKey.match(
      /^PURCHASE-(\d+)$/i
    );

  if (purchaseMatch) {
    const parsedId =
      Number(
        purchaseMatch[1]
      );

    if (
      Number.isInteger(
        parsedId
      ) &&
      parsedId > 0
    ) {
      purchaseId =
        parsedId;
    }
  }

  if (!purchaseId) {
    const parsedId =
      Number(
        normalizedKey
      );

    if (
      Number.isInteger(
        parsedId
      ) &&
      parsedId > 0
    ) {
      purchaseId =
        parsedId;
    }
  }

  let purchase =
    purchaseId
      ? await prisma.outletPurchase.findUnique(
          {
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
          }
        )
      : null;

  if (!purchase) {
    try {
      purchase =
        await prisma.outletPurchase.findUnique(
          {
            where: {
              number:
                normalizedKey,
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
          }
        );
    } catch (error) {
      console.error(
        "PURCHASE NUMBER LOOKUP ERROR:",
        error
      );
    }
  }

  if (!purchase) {
    return null;
  }

  if (
    user.role ===
      "OUTLET_ADMIN" &&
    purchase.outletId !==
      user.outletId
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
  const normalizedKey =
    String(
      transactionKey ?? ""
    ).trim();

  let transferId:
    | number
    | null = null;

  const transferMatch =
    normalizedKey.match(
      /^TRANSFER-(\d+)$/i
    );

  if (transferMatch) {
    const parsedId =
      Number(
        transferMatch[1]
      );

    if (
      Number.isInteger(
        parsedId
      ) &&
      parsedId > 0
    ) {
      transferId =
        parsedId;
    }
  }

  if (!transferId) {
    const parsedId =
      Number(
        normalizedKey
      );

    if (
      Number.isInteger(
        parsedId
      ) &&
      parsedId > 0
    ) {
      transferId =
        parsedId;
    }
  }

  let transfer =
    transferId
      ? await prisma.outletTransfer.findUnique(
          {
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
          }
        )
      : null;

  if (!transfer) {
    try {
      transfer =
        await prisma.outletTransfer.findUnique(
          {
            where: {
              number:
                normalizedKey,
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
          }
        );
    } catch (error) {
      console.error(
        "TRANSFER NUMBER LOOKUP ERROR:",
        error
      );
    }
  }

  if (!transfer) {
    return null;
  }

  if (
    user.role ===
      "OUTLET_ADMIN" &&
    transfer.outletId !==
      user.outletId
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
  source:
    | TransactionSource
    | null,
  user: SessionUser
) {
  if (
    source === "TRANSFER"
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
      source:
        "TRANSFER" as const,
      transaction:
        transfer,
    };
  }

  if (
    source === "PURCHASE"
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
      source:
        "PURCHASE" as const,
      transaction:
        purchase,
    };
  }

  const detectedSource =
    detectSourceFromNumber(
      transactionKey
    );

  if (
    detectedSource ===
    "TRANSFER"
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
      source:
        "TRANSFER" as const,
      transaction:
        transfer,
    };
  }

  if (
    detectedSource ===
    "PURCHASE"
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
      source:
        "PURCHASE" as const,
      transaction:
        purchase,
    };
  }

  const purchase =
    await getOutletPurchaseForUser(
      transactionKey,
      user
    );

  if (purchase) {
    return {
      source:
        "PURCHASE" as const,
      transaction:
        purchase,
    };
  }

  const transfer =
    await getOutletTransferForUser(
      transactionKey,
      user
    );

  if (transfer) {
    return {
      source:
        "TRANSFER" as const,
      transaction:
        transfer,
    };
  }

  return null;
}

// ============================================================
// NORMALIZE PURCHASE COMMENT
// ============================================================

function normalizePurchaseComment(
  comment: any
) {
  return {
    id:
      comment.id,

    content:
      comment.comment,

    // IMPORTANT:
    // Selalu kirim URL browser yang sudah dinormalisasi.
    photo:
      normalizeCommentPhoto(
        comment.photo
      ),

    // Alias imageUrl agar frontend lama maupun baru
    // sama-sama bisa membaca foto.
    imageUrl:
      normalizeCommentPhoto(
        comment.photo
      ),

    createdAt:
      comment.createdAt,

    updatedAt:
      null,

    user:
      comment.user
        ? {
            id:
              comment.user.id,

            name:
              comment.user
                .fullname ??
              comment.user
                .username,

            username:
              comment.user
                .username,

            role:
              comment.user
                .role,
          }
        : null,

    mentions:
      Array.isArray(
        comment.mentions
      )
        ? comment.mentions
            .map(
              (
                mention: any
              ) =>
                mention.user
            )
            .filter(Boolean)
            .map(
              (
                mentionUser: any
              ) => ({
                id:
                  mentionUser.id,

                name:
                  mentionUser
                    .fullname ??
                  mentionUser
                    .username,

                username:
                  mentionUser
                    .username,

                role:
                  mentionUser
                    .role,
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
    id:
      comment.id,

    content:
      comment.comment,

    photo:
      normalizeCommentPhoto(
        comment.photo
      ),

    imageUrl:
      normalizeCommentPhoto(
        comment.photo
      ),

    createdAt:
      comment.createdAt,

    updatedAt:
      null,

    user:
      comment.user
        ? {
            id:
              comment.user.id,

            name:
              comment.user
                .fullname ??
              comment.user
                .username,

            username:
              comment.user
                .username,

            role:
              comment.user
                .role,
          }
        : null,

    mentions:
      Array.isArray(
        comment.mentions
      )
        ? comment.mentions
            .map(
              (
                mention: any
              ) =>
                mention.user
            )
            .filter(Boolean)
            .map(
              (
                mentionUser: any
              ) => ({
                id:
                  mentionUser.id,

                name:
                  mentionUser
                    .fullname ??
                  mentionUser
                    .username,

                username:
                  mentionUser
                    .username,

                role:
                  mentionUser
                    .role,
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
// PARSE MENTION IDS
// ============================================================

function parseMentionUserIds(
  value: unknown
): number[] {
  if (
    Array.isArray(value)
  ) {
    return Array.from(
      new Set(
        value
          .map(
            (
              item: unknown
            ) =>
              Number(item)
          )
          .filter(
            (
              item: number
            ) =>
              Number.isInteger(
                item
              ) &&
              item > 0
          )
      )
    );
  }

  if (
    typeof value !==
    "string"
  ) {
    return [];
  }

  const trimmed =
    value.trim();

  if (!trimmed) {
    return [];
  }

  try {
    const parsed =
      JSON.parse(
        trimmed
      );

    if (
      !Array.isArray(
        parsed
      )
    ) {
      return [];
    }

    return Array.from(
      new Set(
        parsed
          .map(
            (
              item: unknown
            ) =>
              Number(item)
          )
          .filter(
            (
              item: number
            ) =>
              Number.isInteger(
                item
              ) &&
              item > 0
          )
      )
    );
  } catch {
    return [];
  }
}

// ============================================================
// PARSE COMMENT BODY
// ============================================================

async function parseCommentBody(
  request: NextRequest
): Promise<ParsedCommentBody> {
  const contentType =
    String(
      request.headers.get(
        "content-type"
      ) ?? ""
    ).toLowerCase();

  // ==========================================================
  // JSON
  // ==========================================================

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    let body: any;

    try {
      body =
        await request.json();
    } catch {
      throw new Error(
        "Body JSON tidak valid."
      );
    }

    const content =
      typeof body?.content ===
      "string"
        ? body.content.trim()
        : "";

    const rawPhoto =
      typeof body?.photo ===
        "string" &&
      body.photo.trim()
        ? body.photo.trim()
        : typeof body?.image ===
            "string" &&
          body.image.trim()
        ? body.image.trim()
        : typeof body?.imageUrl ===
            "string" &&
          body.imageUrl.trim()
        ? body.imageUrl.trim()
        : null;

    const photo =
      normalizeCommentPhoto(
        rawPhoto
      );

    const source =
      parseSource(
        typeof body?.source ===
          "string"
          ? body.source
          : null
      );

    const mentionUserIds =
      parseMentionUserIds(
        body?.mentionUserIds
      );

    return {
      content,
      photo,
      source,
      mentionUserIds,
      photoFile: null,
    };
  }

  // ==========================================================
  // FORM DATA
  // ==========================================================

  if (
    contentType.includes(
      "multipart/form-data"
    ) ||
    contentType.includes(
      "application/x-www-form-urlencoded"
    )
  ) {
    let formData: FormData;

    try {
      formData =
        await request.formData();
    } catch {
      throw new Error(
        "Body FormData tidak valid."
      );
    }

    const contentValue =
      formData.get("content");

    const content =
      typeof contentValue ===
      "string"
        ? contentValue.trim()
        : "";

    const photoValue =
      formData.get("photo") ??
      formData.get("image");

    const photoFile =
      photoValue instanceof File &&
      photoValue.size > 0
        ? photoValue
        : null;

    const photoUrl =
      typeof photoValue ===
        "string" &&
      photoValue.trim()
        ? normalizeCommentPhoto(
            photoValue
          )
        : null;

    const imageUrlValue =
      formData.get(
        "imageUrl"
      );

    const imageUrl =
      typeof imageUrlValue ===
        "string" &&
      imageUrlValue.trim()
        ? normalizeCommentPhoto(
            imageUrlValue
          )
        : null;

    const sourceValue =
      formData.get(
        "source"
      );

    const source =
      parseSource(
        typeof sourceValue ===
          "string"
          ? sourceValue
          : null
      );

    const mentionUserIds =
      parseMentionUserIds(
        formData.get(
          "mentionUserIds"
        )
      );

    return {
      content,

      photo:
        photoUrl ??
        imageUrl,

      source,

      mentionUserIds,

      photoFile,
    };
  }

  throw new Error(
    `Content-Type request tidak didukung: ${
      contentType ||
      "tidak ada"
    }`
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
      return errorResponse(
        "Tidak login atau session tidak valid.",
        401
      );
    }

    if (
      !canAccessComments(
        user.role
      )
    ) {
      return errorResponse(
        "Anda tidak memiliki akses ke diskusi Barang Masuk outlet.",
        403
      );
    }

    const transactionKey =
      await getRouteKey(
        context
      );

    if (!transactionKey) {
      return errorResponse(
        "Nomor transaksi tidak valid.",
        400
      );
    }

    const source =
      parseSource(
        request.nextUrl
          .searchParams
          .get("source")
      );

    const resolved =
      await resolveTransaction(
        transactionKey,
        source,
        user
      );

    if (!resolved) {
      return errorResponse(
        "Transaksi tidak ditemukan atau Anda tidak memiliki akses.",
        404
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
          id:
            purchase.id,

          number:
            purchase.number,

          outlet:
            purchase.outlet,

          supplier:
            purchase.supplier,
        },
      });
    }

    // ========================================================
    // TRANSFER
    // ========================================================

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
        id:
          transfer.id,

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

    return errorResponse(
      error?.message ||
        "Gagal memuat diskusi Barang Masuk.",
      500
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
  let savedPhotoPath:
    | string
    | null = null;

  try {
    // --------------------------------------------------------
    // AUTH
    // --------------------------------------------------------

    const user =
      await getCurrentUser();

    if (!user) {
      return errorResponse(
        "Tidak login atau session tidak valid.",
        401
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
      return errorResponse(
        "Anda tidak memiliki akses untuk menambahkan diskusi.",
        403
      );
    }

    // --------------------------------------------------------
    // TRANSACTION KEY
    // --------------------------------------------------------

    const transactionKey =
      await getRouteKey(
        context
      );

    if (!transactionKey) {
      return errorResponse(
        "Nomor transaksi tidak valid.",
        400
      );
    }

    // --------------------------------------------------------
    // BODY
    // --------------------------------------------------------

    let parsedBody: ParsedCommentBody;

    try {
      parsedBody =
        await parseCommentBody(
          request
        );
    } catch (error: any) {
      console.error(
        "BARANG MASUK COMMENTS BODY PARSE ERROR:",
        error
      );

      return errorResponse(
        error?.message ||
          "Body request tidak valid.",
        400
      );
    }

    const {
      content,
      photo,
      source,
      mentionUserIds,
      photoFile,
    } = parsedBody;

    // --------------------------------------------------------
    // CONTENT LENGTH
    // --------------------------------------------------------

    if (
      content.length >
      5000
    ) {
      return errorResponse(
        "Komentar terlalu panjang. Maksimal 5.000 karakter.",
        400
      );
    }

    // --------------------------------------------------------
    // PHOTO
    // --------------------------------------------------------

    if (photoFile) {
      try {
        savedPhotoPath =
          await saveCommentPhoto(
            photoFile
          );
      } catch (error: any) {
        return errorResponse(
          error?.message ||
            "Gagal menyimpan foto komentar.",
          400
        );
      }
    } else if (
      typeof photo ===
        "string" &&
      photo.trim()
    ) {
      /**
       * IMPORTANT:
       *
       * photo sudah dinormalisasi oleh parseCommentBody().
       *
       * Jadi data lama seperti:
       *
       * C:\project\public\uploads\comments\a.jpg
       *
       * akan menjadi:
       *
       * /uploads/comments/a.jpg
       *
       * tanpa mengubah database lama.
       */
      savedPhotoPath =
        normalizeCommentPhoto(
          photo
        );
    }

    // --------------------------------------------------------
    // TEXT + PHOTO EMPTY CHECK
    // --------------------------------------------------------

    if (
      !content &&
      !savedPhotoPath
    ) {
      return errorResponse(
        "Komentar atau foto wajib diisi.",
        400
      );
    }

    // --------------------------------------------------------
    // VALIDATE PHOTO URL
    // --------------------------------------------------------

    if (
      savedPhotoPath &&
      !savedPhotoPath.startsWith(
        "/uploads/comments/"
      )
    ) {
      return errorResponse(
        "Path foto komentar tidak valid.",
        400
      );
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
        return errorResponse(
          "Salah satu user yang di-mention tidak valid atau sudah tidak aktif.",
          400
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
      return errorResponse(
        "Transaksi tidak ditemukan atau Anda tidak memiliki akses.",
        404
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
        await prisma.purchaseComment.create(
          {
            data: {
              outletPurchaseId:
                purchase.id,

              userId:
                user.id,

              comment:
                content,

              photo:
                savedPhotoPath,

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
          }
        );

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
      await prisma.outletTransferComment.create(
        {
          data: {
            transferId:
              transfer.id,

            userId:
              user.id,

            comment:
              content,

            photo:
              savedPhotoPath,

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
        }
      );

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

    return errorResponse(
      error?.message ||
        "Gagal menyimpan komentar Barang Masuk.",
      500
    );
  }
}