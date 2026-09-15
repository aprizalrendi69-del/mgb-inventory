import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: "File foto tidak ditemukan.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          success: false,
          message: "Format foto harus JPG, PNG, atau WEBP.",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: "Ukuran foto maksimal 5 MB.",
        },
        { status: 400 }
      );
    }

    const extension = ALLOWED_TYPES.get(file.type);

    if (!extension) {
      return NextResponse.json(
        {
          success: false,
          message: "Format file tidak valid.",
        },
        { status: 400 }
      );
    }

    const filename = `profile-${crypto.randomUUID()}${extension}`;

    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "profiles"
    );

    await mkdir(uploadDir, {
      recursive: true,
    });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await writeFile(
      path.join(uploadDir, filename),
      buffer
    );

    const photoUrl = `/uploads/profiles/${filename}`;

    return NextResponse.json({
      success: true,
      photo: photoUrl,
      url: photoUrl,
    });
  } catch (error) {
    console.error("PROFILE_UPLOAD_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengupload foto profil.",
      },
      { status: 500 }
    );
  }
}