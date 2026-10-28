import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionCookie =
    cookieStore.get("session") || cookieStore.get("erp-session");

  if (!sessionCookie) return null;

  try {
    const session = await prisma.session.findUnique({
      where: { token: sessionCookie.value },
      select: {
        expiresAt: true,
        user: {
          select: {
            id: true,
            fullname: true,
            role: true,
            active: true,
            outletId: true,
          },
        },
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
      select: {
        id: true,
        fullname: true,
        role: true,
        active: true,
        outletId: true,
      },
    });

    if (!user || !user.active) return null;
    return user;
  } catch (error) {
    console.error("JSON SESSION CHECK ERROR:", error);
    return null;
  }
}

function canAccessOutletPurchase(role: Role) {
  return [Role.ADMIN, Role.MANAGER, Role.PURCHASING, Role.OUTLET_ADMIN].includes(role);
}

function getPurchaseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeMentionIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );
}

async function getAccessiblePurchase(
  purchaseId: number,
  user: { role: Role; outletId: number | null },
) {
  if (user.role === Role.OUTLET_ADMIN) {
    if (user.outletId === null) return null;
    return prisma.outletPurchase.findFirst({
      where: { id: purchaseId, outletId: user.outletId },
      select: { id: true, number: true, outletId: true },
    });
  }

  return prisma.outletPurchase.findUnique({
    where: { id: purchaseId },
    select: { id: true, number: true, outletId: true },
  });
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Tidak login", 401);
    if (!canAccessOutletPurchase(user.role)) {
      return jsonError("Anda tidak memiliki akses Purchase Outlet", 403);
    }
    if (user.role === Role.OUTLET_ADMIN && user.outletId === null) {
      return jsonError("User Outlet Admin belum terhubung dengan outlet", 403);
    }

    const { id } = await params;
    const purchaseId = getPurchaseId(id);
    if (!purchaseId) return jsonError("ID Purchase Outlet tidak valid", 400);

    const purchase = await getAccessiblePurchase(purchaseId, user);
    if (!purchase) {
      return jsonError("Purchase Outlet tidak ditemukan atau Anda tidak memiliki akses", 404);
    }

    const comments = await prisma.purchaseComment.findMany({
      where: { outletPurchaseId: purchaseId },
      include: {
        user: {
          select: { id: true, fullname: true, role: true, outletId: true, active: true },
        },
        mentions: {
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: { id: true, fullname: true, role: true, outletId: true, active: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const data = comments.map((item) => ({
      ...item,
      photoUrl: item.photo,
      imageUrl: item.photo,
      canDelete: item.user.id === user.id,
    }));

    return NextResponse.json({ success: true, currentUserId: user.id, data });
  } catch (error) {
    console.error("GET OUTLET PURCHASE COMMENTS ERROR:", error);
    return jsonError("Gagal mengambil komentar Purchase Outlet", 500);
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Tidak login", 401);
    if (!canAccessOutletPurchase(user.role)) {
      return jsonError("Anda tidak memiliki akses memberikan komentar Purchase Outlet", 403);
    }
    if (user.role === Role.OUTLET_ADMIN && user.outletId === null) {
      return jsonError("User Outlet Admin belum terhubung dengan outlet", 403);
    }

    const { id } = await params;
    const purchaseId = getPurchaseId(id);
    if (!purchaseId) return jsonError("ID Purchase Outlet tidak valid", 400);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("Body request tidak valid", 400);
    }

    const payload = body as {
      comment?: unknown;
      photo?: unknown;
      photoUrl?: unknown;
      imageUrl?: unknown;
      mentionedUserIds?: unknown;
    };

    const comment = typeof payload?.comment === "string" ? payload.comment.trim() : "";
    const rawPhoto = payload?.photoUrl ?? payload?.photo ?? payload?.imageUrl ?? null;
    const photo = typeof rawPhoto === "string" ? rawPhoto.trim() : "";

    // Komentar boleh berupa teks, foto, atau kombinasi keduanya.
    if (!comment && !photo) {
      return jsonError("Komentar atau foto wajib diisi", 400);
    }
    if (comment.length > 2000) {
      return jsonError("Komentar maksimal 2000 karakter", 400);
    }
    if (photo && (photo.length > 1000 || !photo.startsWith("/uploads/comments/"))) {
      return jsonError("URL foto komentar tidak valid", 400);
    }

    const mentionedUserIds = normalizeMentionIds(payload?.mentionedUserIds);
    const purchase = await getAccessiblePurchase(purchaseId, user);
    if (!purchase) {
      return jsonError("Purchase Outlet tidak ditemukan atau Anda tidak memiliki akses", 404);
    }

    if (mentionedUserIds.length > 0) {
      const mentionUsers = await prisma.user.findMany({
        where: { id: { in: mentionedUserIds }, active: true },
        select: { id: true },
      });
      const foundIds = new Set(mentionUsers.map((item) => item.id));
      const invalidIds = mentionedUserIds.filter((mentionId) => !foundIds.has(mentionId));
      if (invalidIds.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Salah satu user yang di-mention tidak ditemukan atau sudah tidak aktif",
            invalidUserIds: invalidIds,
          },
          { status: 400 },
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.purchaseComment.create({
        data: {
          outletPurchaseId: purchaseId,
          userId: user.id,
          comment,
          photo: photo || null,
          mentions: mentionedUserIds.length
            ? { create: mentionedUserIds.map((mentionedUserId) => ({ userId: mentionedUserId })) }
            : undefined,
        },
        include: {
          user: {
            select: { id: true, fullname: true, role: true, outletId: true, active: true },
          },
          mentions: {
            orderBy: { createdAt: "asc" },
            include: {
              user: {
                select: { id: true, fullname: true, role: true, outletId: true, active: true },
              },
            },
          },
        },
      });

      await tx.history.create({
        data: {
          transactionType: "PURCHASE",
          referenceNumber: purchase.number,
          description: `Menambahkan komentar pada Purchase Order Outlet ${purchase.number}`,
          userId: user.id,
        },
      });

      return created;
    });

    return NextResponse.json({
      success: true,
      message: "Komentar berhasil ditambahkan",
      currentUserId: user.id,
      data: {
        ...result,
        photoUrl: result.photo,
        imageUrl: result.photo,
        canDelete: true,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("POST OUTLET PURCHASE COMMENT ERROR:", error);
    return jsonError("Gagal menambahkan komentar", 500);
  }
}
