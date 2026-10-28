
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/*
===========================================================
PETTY CASH ACCOUNTS API
===========================================================

GET:
- ADMIN / MANAGER:
  Melihat seluruh akun petty cash dan seluruh outlet aktif.
- OUTLET_ADMIN / ADMIN_OUTLET:
  Melihat akun petty cash dan lokasi outlet sendiri.

RESPONSE:
{
  success: true,
  data: [...accounts],
  outlets: [...activeOutlets]
}

ATURAN:
- PUSAT = outletId null.
- OUTLET = outletId ID outlet.
- Tidak mengubah saldo atau transaksi.
- Akun nonaktif tetap ditampilkan agar bisa diaktifkan kembali.
===========================================================
*/

type CurrentUser = {
  id: number;
  fullname: string | null;
  role: Role;
  active: boolean;
  outletId: number | null;
};

/*
===========================================================
CURRENT USER
===========================================================
*/

async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("erp-session");

    if (!session?.value) {
      return null;
    }

    let sessionData: any;

    try {
      sessionData = JSON.parse(session.value);
    } catch {
      return null;
    }

    const sessionUser = sessionData?.user ?? sessionData;
    const userId = Number(sessionUser?.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return null;
    }

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

    if (!user || !user.active) {
      return null;
    }

    return user;
  } catch (error) {
    console.error(
      "GET CURRENT USER PETTY CASH ACCOUNTS ERROR:",
      error
    );

    return null;
  }
}

/*
===========================================================
ROLE HELPERS
===========================================================
*/

function isCentralAdmin(role: Role): boolean {
  return role === Role.ADMIN || role === Role.MANAGER;
}

function isOutletAdmin(role: Role): boolean {
  return (
    role === Role.OUTLET_ADMIN ||
    role === Role.ADMIN_OUTLET
  );
}

/*
===========================================================
GET PETTY CASH ACCOUNTS + OUTLETS
===========================================================
*/

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Sesi login tidak valid atau sudah berakhir.",
        },
        { status: 401 }
      );
    }

    const centralAdmin = isCentralAdmin(user.role);
    const outletAdmin = isOutletAdmin(user.role);

    if (!centralAdmin && !outletAdmin) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses ke akun petty cash.",
        },
        { status: 403 }
      );
    }

    /*
    ========================================================
    OUTLET ADMIN VALIDATION
    ========================================================
    */

    if (outletAdmin && !user.outletId) {
      return NextResponse.json(
        {
          success: false,
          message: "User belum terhubung dengan outlet.",
        },
        { status: 400 }
      );
    }

    /*
    ========================================================
    QUERY ACCOUNTS
    ========================================================

    Jangan hanya mengambil isActive=true.
    Halaman pengelolaan harus tetap bisa menampilkan akun
    nonaktif agar statusnya bisa diaktifkan kembali.
    */

    const accounts = await prisma.pettyCashAccount.findMany({
      where: centralAdmin
        ? {}
        : {
            outletId: user.outletId!,
          },

      select: {
        id: true,
        code: true,
        name: true,
        outletId: true,
        openingBalance: true,
        currentBalance: true,
        isActive: true,

        outlet: {
          select: {
            id: true,
            code: true,
            name: true,
            active: true,
          },
        },
      },

      orderBy: [
        { outletId: "asc" },
        { code: "asc" },
      ],
    });

    /*
    ========================================================
    QUERY OUTLETS
    ========================================================

    ADMIN / MANAGER:
    Semua outlet aktif.

    OUTLET_ADMIN / ADMIN_OUTLET:
    Hanya outlet sendiri jika outlet tersebut aktif.

    Daftar ini digunakan oleh dropdown lokasi di halaman.
    */

    const outlets = await prisma.outlet.findMany({
      where: centralAdmin
        ? {
            active: true,
          }
        : {
            id: user.outletId!,
            active: true,
          },

      select: {
        id: true,
        code: true,
        name: true,
        active: true,
      },

      orderBy: {
        name: "asc",
      },
    });

    /*
    ========================================================
    NORMALIZE RESPONSE
    ========================================================
    */

    const normalizedAccounts = accounts.map((account) => ({
      id: account.id,
      code: account.code,
      name: account.name,
      outletId: account.outletId,

      openingBalance: Number(account.openingBalance ?? 0),
      currentBalance: Number(account.currentBalance ?? 0),

      // Field utama yang dipakai halaman TSX.
      isActive: Boolean(account.isActive),

      // Kompatibilitas dengan halaman/API lama.
      active: Boolean(account.isActive),

      outlet: account.outlet
        ? {
            id: account.outlet.id,
            code: account.outlet.code,
            name: account.outlet.name,
            active: account.outlet.active,
          }
        : null,
    }));

    /*
    ========================================================
    RESPONSE
    ========================================================
    */

    return NextResponse.json(
      {
        success: true,
        data: normalizedAccounts,
        accounts: normalizedAccounts,
        outlets,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "GET PETTY CASH ACCOUNTS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil akun petty cash dan daftar outlet.",
      },
      { status: 500 }
    );
  }
}
