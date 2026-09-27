import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type SessionData = {
  id?: number | string;
};

type CurrentUser = {
  id: number;
  username: string;
  fullname: string;
  role: string;
  active: boolean;
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

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

/**
 * =========================================================
 * GET CURRENT USER
 * =========================================================
 *
 * Mengikuti mekanisme login aplikasi:
 *
 * erp-session
 * {
 *   id: number
 * }
 *
 * Tidak menggunakan prisma.session.
 */
async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();

  const session = cookieStore.get("erp-session");

  if (!session) {
    return null;
  }

  let sessionData: SessionData;

  try {
    sessionData = JSON.parse(session.value);
  } catch {
    return null;
  }

  if (!sessionData?.id) {
    return null;
  }

  const userId = Number(sessionData.id);

  if (
    !Number.isSafeInteger(userId) ||
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
    },
  });

  if (!user) {
    return null;
  }

  if (!user.active) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    fullname: user.fullname,
    role: String(user.role),
    active: user.active,
  };
}

/**
 * =========================================================
 * ACCESS CHECK
 * =========================================================
 *
 * Upload foto mengikuti akses halaman komentar.
 */
function canUploadCommentImage(
  user: CurrentUser
) {
  return [
    "ADMIN",
    "MANAGER",
    "OUTLET_ADMIN",
  ].includes(user.role);
}

/**
 * =========================================================
 * FILE CHECK
 * =========================================================
 */
function isFileLike(
  value: FormDataEntryValue | null
): value is File {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    arrayBuffer?: unknown;
    size?: unknown;
  };

  return (
    typeof candidate.arrayBuffer === "function" &&
    typeof candidate.size === "number"
  );
}

/**
 * =========================================================
 * IMAGE EXTENSION
 * =========================================================
 */
function getImageExtension(file: File) {
  const mime = String(file.type ?? "")
    .toLowerCase()
    .split(";")[0]
    .trim();

  /**
   * Normal MIME.
   */
  if (IMAGE_EXTENSIONS[mime]) {
    return IMAGE_EXTENSIONS[mime];
  }

  /**
   * Fallback berdasarkan nama file.
   *
   * Berguna apabila browser tidak mengirim
   * MIME type dengan benar.
   */
  const filename = String(file.name ?? "")
    .toLowerCase();

  const match = filename.match(
    /\.(jpe?g|png|webp|gif)$/
  );

  if (!match) {
    return null;
  }

  if (match[1] === "jpeg") {
    return "jpg";
  }

  return match[1];
}

/**
 * =========================================================
 * SAVE IMAGE
 * =========================================================
 */
async function saveCommentPhoto(
  file: File
) {
  const extension =
    getImageExtension(file);

  if (!extension) {
    throw new Error(
      "Foto tidak didukung. Gunakan JPG, PNG, WEBP, atau GIF."
    );
  }

  if (file.size <= 0) {
    throw new Error(
      "File foto kosong."
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      "Ukuran foto maksimal 5 MB."
    );
  }

  /**
   * Folder:
   *
   * public/uploads/comments
   */
  const uploadDirectory = path.join(
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

  /**
   * Generate nama file unik.
   */
  const randomName =
    crypto
      .randomBytes(16)
      .toString("hex");

  const filename =
    `comment-${Date.now()}-${randomName}.${extension}`;

  const absolutePath =
    path.join(
      uploadDirectory,
      filename
    );

  const buffer =
    Buffer.from(
      await file.arrayBuffer()
    );

  await writeFile(
    absolutePath,
    buffer
  );

  /**
   * URL yang dapat dipakai browser.
   */
  return `/uploads/comments/${filename}`;
}

/**
 * =========================================================
 * POST
 * =========================================================
 *
 * Endpoint ini KHUSUS untuk upload foto.
 *
 * PENTING:
 *
 * - Tidak mencari OutletPurchase
 * - Tidak mencari OutletTransfer
 * - Tidak membuat PurchaseComment
 * - Tidak membutuhkan comment text
 * - Tidak UPDATE database
 * - Tidak DELETE database
 *
 * Jadi:
 *
 * foto saja       -> BOLEH
 * teks saja       -> bukan endpoint ini
 * foto + teks     -> foto tetap BOLEH
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    /**
     * -----------------------------------------------------
     * AUTH
     * -----------------------------------------------------
     */
    const user =
      await getCurrentUser();

    if (!user) {
      return errorResponse(
        "Unauthorized. Session login tidak ditemukan.",
        401
      );
    }

    /**
     * -----------------------------------------------------
     * ROLE
     * -----------------------------------------------------
     */
    if (
      !canUploadCommentImage(user)
    ) {
      return errorResponse(
        "Anda tidak memiliki akses untuk upload foto komentar.",
        403
      );
    }

    /**
     * -----------------------------------------------------
     * ROUTE ID
     * -----------------------------------------------------
     *
     * Kita tetap membaca [id] untuk memastikan
     * route valid, tetapi TIDAK melakukan query
     * transaksi.
     */
    const params =
      await context.params;

    const transactionKey =
      String(params.id ?? "").trim();

    if (!transactionKey) {
      return errorResponse(
        "ID transaksi tidak ditemukan.",
        400
      );
    }

    /**
     * -----------------------------------------------------
     * FORM DATA
     * -----------------------------------------------------
     *
     * Terima ketiga nama field:
     *
     * photo
     * image
     * file
     */
    const formData =
      await request.formData();

    const rawPhoto =
      formData.get("photo") ??
      formData.get("image") ??
      formData.get("file");

    if (
      !isFileLike(rawPhoto)
    ) {
      return errorResponse(
        "Foto wajib diisi.",
        400
      );
    }

    /**
     * -----------------------------------------------------
     * SAVE
     * -----------------------------------------------------
     */
    const imageUrl =
      await saveCommentPhoto(
        rawPhoto
      );

    /**
     * -----------------------------------------------------
     * RESPONSE
     * -----------------------------------------------------
     *
     * Return beberapa alias supaya kompatibel
     * dengan frontend yang mungkin membaca
     * photo/url/path/imageUrl/image.
     */
    return NextResponse.json(
      {
        success: true,

        message:
          "Foto komentar berhasil di-upload.",

        photo: imageUrl,

        url: imageUrl,

        path: imageUrl,

        imageUrl: imageUrl,

        image: imageUrl,

        data: {
          photo: imageUrl,
          url: imageUrl,
          path: imageUrl,
          imageUrl: imageUrl,
          image: imageUrl,
        },

        transaction: {
          key: transactionKey,
        },

        uploadedBy: {
          id: user.id,
          username: user.username,
          fullname: user.fullname,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "COMMENT IMAGE UPLOAD ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Gagal meng-upload foto komentar.";

    return errorResponse(
      message,
      500
    );
  }
}