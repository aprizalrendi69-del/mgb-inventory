import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, message, error: message }, { status });
}

async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session") || cookieStore.get("erp-session");
  if (!sessionCookie) return null;

  try {
    const session = await prisma.session.findUnique({
      where: { token: sessionCookie.value },
      select: {
        expiresAt: true,
        user: { select: { id: true, fullname: true, username: true, role: true, active: true, outletId: true } },
      },
    });
    if (session) {
      if (session.expiresAt < new Date() || !session.user.active) return null;
      return session.user;
    }
  } catch (error) {
    console.error("DATABASE SESSION CHECK ERROR:", error);
  }

  try {
    const parsed = JSON.parse(sessionCookie.value);
    const userId = Number(parsed?.user?.id ?? parsed?.id ?? 0);
    if (!Number.isInteger(userId) || userId <= 0) return null;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullname: true, username: true, role: true, active: true, outletId: true },
    });
    return user?.active ? user : null;
  } catch (error) {
    console.error("JSON SESSION CHECK ERROR:", error);
    return null;
  }
}

function canAccessOutletPurchase(role: Role) {
  return [Role.ADMIN, Role.MANAGER, Role.PURCHASING, Role.OUTLET_ADMIN].includes(role);
}

function isFileLike(value: FormDataEntryValue | null): value is File {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { arrayBuffer?: unknown; size?: unknown };
  return typeof candidate.arrayBuffer === "function" && typeof candidate.size === "number";
}

function getImageExtension(file: File) {
  const mime = String(file.type ?? "").toLowerCase().split(";")[0].trim();
  if (IMAGE_EXTENSIONS[mime]) return IMAGE_EXTENSIONS[mime];
  const filename = String(file.name ?? "").toLowerCase();
  const match = filename.match(/\.(jpe?g|png|webp|gif)$/);
  if (!match) return null;
  return match[1] === "jpeg" ? "jpg" : match[1];
}

async function saveCommentPhoto(file: File) {
  const extension = getImageExtension(file);
  if (!extension) throw new Error("Foto tidak didukung. Gunakan JPG, PNG, WEBP, atau GIF.");
  if (file.size <= 0) throw new Error("File foto kosong.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Ukuran foto maksimal 5 MB.");

  const uploadDirectory = path.join(process.cwd(), "public", "uploads", "comments");
  await mkdir(uploadDirectory, { recursive: true });

  const filename = `comment-${Date.now()}-${crypto.randomBytes(16).toString("hex")}.${extension}`;
  const absolutePath = path.join(uploadDirectory, filename);
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));
  return `/uploads/comments/${filename}`;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return errorResponse("Unauthorized. Session login tidak ditemukan.", 401);
    if (!canAccessOutletPurchase(user.role)) {
      return errorResponse("Anda tidak memiliki akses untuk upload foto komentar.", 403);
    }
    if (user.role === Role.OUTLET_ADMIN && user.outletId === null) {
      return errorResponse("User Outlet Admin belum terhubung dengan outlet.", 403);
    }

    const { id } = await context.params;
    const purchaseId = Number(id);
    if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
      return errorResponse("ID Purchase Outlet tidak valid.", 400);
    }

    // Pastikan user memang boleh mengakses Purchase Outlet ini sebelum menerima file.
    const purchase = user.role === Role.OUTLET_ADMIN
      ? await prisma.outletPurchase.findFirst({
          where: { id: purchaseId, outletId: user.outletId! },
          select: { id: true, number: true },
        })
      : await prisma.outletPurchase.findUnique({
          where: { id: purchaseId },
          select: { id: true, number: true },
        });
    if (!purchase) return errorResponse("Purchase Outlet tidak ditemukan atau Anda tidak memiliki akses.", 404);

    const formData = await request.formData();
    const rawPhoto = formData.get("photo") ?? formData.get("image") ?? formData.get("file");
    if (!isFileLike(rawPhoto)) return errorResponse("Foto wajib diisi.", 400);

    const imageUrl = await saveCommentPhoto(rawPhoto);
    return NextResponse.json({
      success: true,
      message: "Foto komentar berhasil di-upload.",
      photo: imageUrl,
      photoUrl: imageUrl,
      url: imageUrl,
      path: imageUrl,
      imageUrl,
      image: imageUrl,
      data: { photo: imageUrl, photoUrl: imageUrl, url: imageUrl, path: imageUrl, imageUrl, image: imageUrl },
      transaction: { key: String(purchase.id), number: purchase.number },
      uploadedBy: { id: user.id, username: user.username, fullname: user.fullname },
    }, { status: 201 });
  } catch (error) {
    console.error("COMMENT IMAGE UPLOAD ERROR:", error);
    const message = error instanceof Error ? error.message : "Gagal meng-upload foto komentar.";
    return errorResponse(message, 500);
  }
}
