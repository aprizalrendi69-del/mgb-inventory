
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const MAX_PHOTO_LENGTH = 1_400_000;

function validatePhoto(value: unknown): {
  valid: boolean;
  photo?: string | null;
  message?: string;
} {
  // null atau string kosong berarti menghapus foto secara eksplisit.
  if (value === null) {
    return { valid: true, photo: null };
  }

  if (typeof value !== "string") {
    return {
      valid: false,
      message: "Format foto profil tidak valid.",
    };
  }

  const photo = value.trim();

  if (!photo) {
    return { valid: true, photo: null };
  }

  if (photo.length > MAX_PHOTO_LENGTH) {
    return {
      valid: false,
      message: "Ukuran foto terlalu besar. Maksimal sekitar 1 MB.",
    };
  }

  // Izinkan data URL gambar raster yang didukung.
  const dataUrlPattern =
    /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/i;

  // Izinkan path lokal aplikasi atau URL HTTP/HTTPS.
  const isDataUrl = dataUrlPattern.test(photo);
  const isLocalPath =
    photo.startsWith("/") &&
    !photo.startsWith("//") &&
    !photo.includes("\\") &&
    !/[\u0000-\u001f]/.test(photo);

  let isHttpUrl = false;

  try {
    const url = new URL(photo);
    isHttpUrl =
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname);
  } catch {
    isHttpUrl = false;
  }

  if (!isDataUrl && !isLocalPath && !isHttpUrl) {
    return {
      valid: false,
      message:
        "Foto harus berupa gambar PNG, JPEG, WEBP, GIF, path lokal, atau URL HTTP/HTTPS yang valid.",
    };
  }

  return { valid: true, photo };
}

export async function PATCH(req: NextRequest) {
  try {
    // 1. Validasi sesi pengguna.
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("erp-session");

    if (!sessionCookie?.value) {
      return NextResponse.json(
        {
          success: false,
          message: "Session tidak ditemukan.",
        },
        { status: 401 }
      );
    }

    let session: { id?: number };

    try {
      session = JSON.parse(sessionCookie.value);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Session tidak valid.",
        },
        { status: 401 }
      );
    }

    const userId = Number(session.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "User tidak valid.",
        },
        { status: 401 }
      );
    }

    // 2. Validasi body request.
    let body: Record<string, unknown>;

    try {
      const parsed: unknown = await req.json();

      if (
        parsed === null ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Format data tidak valid.",
          },
          { status: 400 }
        );
      }

      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Body JSON tidak valid.",
        },
        { status: 400 }
      );
    }

    // 3. Validasi nama lengkap jika dikirim.
    let fullname: string | undefined;

    if (Object.prototype.hasOwnProperty.call(body, "fullname")) {
      if (typeof body.fullname !== "string") {
        return NextResponse.json(
          {
            success: false,
            message: "Nama lengkap harus berupa teks.",
          },
          { status: 400 }
        );
      }

      fullname = body.fullname.trim();

      if (!fullname) {
        return NextResponse.json(
          {
            success: false,
            message: "Nama lengkap tidak boleh kosong.",
          },
          { status: 400 }
        );
      }

      if (fullname.length > 150) {
        return NextResponse.json(
          {
            success: false,
            message: "Nama lengkap maksimal 150 karakter.",
          },
          { status: 400 }
        );
      }
    }

    // 4. Validasi foto hanya jika properti photo dikirim.
    // Jika photo tidak dikirim, foto lama tetap dipertahankan.
    let photo: string | null | undefined;

    if (Object.prototype.hasOwnProperty.call(body, "photo")) {
      const result = validatePhoto(body.photo);

      if (!result.valid) {
        return NextResponse.json(
          {
            success: false,
            message: result.message,
          },
          { status: 400 }
        );
      }

      photo = result.photo;
    }

    if (fullname === undefined && photo === undefined) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak ada perubahan data yang dikirim.",
        },
        { status: 400 }
      );
    }

    // 5. Siapkan data update hanya dari field yang dikirim.
    const updateData: {
      fullname?: string;
      photo?: string | null;
    } = {};

    if (fullname !== undefined) {
      updateData.fullname = fullname;
    }

    if (photo !== undefined) {
      updateData.photo = photo;
    }

    // 6. Update pengguna.
    const user = await prisma.user.update({
      where: {
        id: userId,
      },
      data: updateData,
      select: {
        id: true,
        username: true,
        fullname: true,
        photo: true,
        role: true,
        outletId: true,
        active: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Profil berhasil diperbarui.",
      data: user,
    });
  } catch (error) {
    console.error("PROFILE_UPDATE_ERROR:", error);

    // Prisma P2025: record pengguna tidak ditemukan.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Pengguna tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Gagal memperbarui profil.",
      },
      { status: 500 }
    );
  }
}
