import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/*
 * =========================================================
 * CURRENT USER
 *
 * Session hanya dipakai untuk mendapatkan USER ID.
 * Data user + outlet selalu diambil ulang dari database.
 * =========================================================
 */

async function getCurrentUser() {
  const cookieStore = await cookies();

  const session =
    cookieStore.get("erp-session") ||
    cookieStore.get("session");

  if (!session) {
    return null;
  }

  let userId: number | null = null;

  /*
   * =======================================================
   * COBA SESSION DATABASE
   * =======================================================
   */

  try {
    const dbSession = await prisma.session.findUnique({
      where: {
        token: session.value,
      },
      select: {
        expiresAt: true,
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (dbSession) {
      if (dbSession.expiresAt < new Date()) {
        return null;
      }

      userId = dbSession.user.id;
    }
  } catch {
    /*
     * Jika model Session tidak tersedia / token tidak
     * ditemukan, lanjut ke session JSON.
     */
  }

  /*
   * =======================================================
   * SESSION JSON
   * =======================================================
   */

  if (!userId) {
    try {
      const data = JSON.parse(session.value);

      userId = Number(
        data?.user?.id ??
          data?.id ??
          0
      );
    } catch {
      return null;
    }
  }

  if (
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    return null;
  }

  /*
   * =======================================================
   * AMBIL USER DARI DATABASE
   *
   * outletId TIDAK PERNAH DIAMBIL DARI COOKIE.
   * =======================================================
   */

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

      outlet: {
        select: {
          id: true,
          code: true,
          name: true,
          active: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  if (!user.active) {
    return null;
  }

  return user;
}

/*
 * =========================================================
 * JSON ERROR
 * =========================================================
 */

function jsonError(
  message: string,
  status = 400
) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
    }
  );
}

/*
 * =========================================================
 * DELETE WASTE
 *
 * Endpoint:
 *
 * DELETE /api/outlet/waste/[id]
 *
 * Contoh:
 *
 * DELETE /api/outlet/waste/3
 *
 * =========================================================
 *
 * HANYA:
 *   ADMIN
 *   OUTLET_ADMIN
 *
 * HANYA:
 *   status = PENDING
 *
 * ADMIN:
 *   -> boleh hapus PENDING dari outlet mana pun
 *
 * OUTLET_ADMIN:
 *   -> hanya boleh hapus PENDING milik outlet sendiri
 *
 * MANAGER:
 *   -> TIDAK BOLEH HAPUS
 *
 * =========================================================
 *
 * IMPORTANT:
 *
 * DELETE INI HANYA MENGHAPUS RECORD WASTE PENDING.
 *
 * TIDAK:
 * - mengurangi OutletStock
 * - menambah OutletStock
 * - mengubah StockCard
 * - mengubah StockMutation
 * - mengubah Barang Keluar
 * - menghapus Master Barang
 * - reset database
 * =========================================================
 */

export async function DELETE(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    /*
     * =======================================================
     * CURRENT USER
     * =======================================================
     */

    const user = await getCurrentUser();

    if (!user) {
      return jsonError(
        "Tidak login.",
        401
      );
    }

    const role = String(
      user.role || ""
    )
      .trim()
      .toUpperCase();

    /*
     * =======================================================
     * ROLE ACCESS
     *
     * HANYA ADMIN DAN OUTLET_ADMIN.
     * =======================================================
     */

    const allowedDeleteRoles = [
      "ADMIN",
      "OUTLET_ADMIN",
    ];

    if (
      !allowedDeleteRoles.includes(role)
    ) {
      return jsonError(
        "Anda tidak memiliki akses untuk menghapus Waste.",
        403
      );
    }

    /*
     * =======================================================
     * PARAMETER ID
     *
     * Next.js 16:
     * params adalah Promise.
     * =======================================================
     */

    const params = await context.params;

    const wasteId = Number(
      params?.id
    );

    if (
      !Number.isInteger(wasteId) ||
      wasteId <= 0
    ) {
      return jsonError(
        "ID Waste tidak valid.",
        400
      );
    }

    /*
     * =======================================================
     * CEK DATA WASTE
     * =======================================================
     */

    const waste =
      await prisma.outletStockOut.findUnique({
        where: {
          id: wasteId,
        },

        select: {
          id: true,
          number: true,
          outletId: true,
          barangId: true,
          type: true,
          status: true,
          wasteQty: true,
          totalCost: true,

          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
              active: true,
            },
          },

          barang: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });

    /*
     * =======================================================
     * DATA TIDAK DITEMUKAN
     * =======================================================
     */

    if (!waste) {
      return jsonError(
        "Data Waste tidak ditemukan.",
        404
      );
    }

    /*
     * =======================================================
     * PASTIKAN TYPE WASTE
     *
     * Endpoint ini khusus transaksi Waste.
     * Tidak boleh menghapus transaksi lain.
     * =======================================================
     */

    if (
      String(
        waste.type || ""
      )
        .trim()
        .toUpperCase() !== "WASTE"
    ) {
      return jsonError(
        "Data yang dipilih bukan transaksi Waste.",
        400
      );
    }

    /*
     * =======================================================
     * HANYA STATUS PENDING
     *
     * APPROVED:
     *   TIDAK BOLEH DIHAPUS
     *
     * REJECTED:
     *   TIDAK BOLEH DIHAPUS
     *
     * PENDING:
     *   BOLEH DIHAPUS
     * =======================================================
     */

    if (
      String(
        waste.status || ""
      )
        .trim()
        .toUpperCase() !== "PENDING"
    ) {
      return jsonError(
        "Waste hanya dapat dihapus jika status masih PENDING.",
        400
      );
    }

    /*
     * =======================================================
     * OUTLET ADMIN
     *
     * HANYA BOLEH HAPUS WASTE OUTLET SENDIRI.
     *
     * outletId tidak diambil dari request.
     * =======================================================
     */

    if (role === "OUTLET_ADMIN") {
      const userOutletId = Number(
        user.outletId
      );

      /*
       * User harus memiliki outlet.
       */

      if (
        !Number.isInteger(userOutletId) ||
        userOutletId <= 0
      ) {
        return jsonError(
          "User Outlet Admin belum memiliki outlet.",
          400
        );
      }

      /*
       * Outlet user harus masih tersedia
       * dan aktif.
       */

      if (
        !user.outlet ||
        !user.outlet.active
      ) {
        return jsonError(
          "Outlet user tidak ditemukan atau sudah tidak aktif.",
          400
        );
      }

      /*
       * Jangan izinkan menghapus Waste
       * dari outlet lain.
       */

      if (
        waste.outletId !== userOutletId
      ) {
        return jsonError(
          "Anda hanya dapat menghapus Waste dari outlet Anda sendiri.",
          403
        );
      }
    }

    /*
     * =======================================================
     * DELETE DENGAN KONDISI PENGAMAN
     *
     * Kita cek kembali:
     * - id
     * - type WASTE
     * - status PENDING
     *
     * Untuk OUTLET_ADMIN juga:
     * - outletId milik user
     *
     * Jadi apabila status berubah setelah pengecekan
     * awal, record tidak akan terhapus.
     * =======================================================
     */

    const deleteWhere: any = {
      id: wasteId,

      type: "WASTE",

      status: "PENDING",
    };

    if (role === "OUTLET_ADMIN") {
      deleteWhere.outletId =
        Number(user.outletId);
    }

    const deleted =
      await prisma.outletStockOut.deleteMany({
        where: deleteWhere,
      });

    /*
     * =======================================================
     * DELETE GAGAL
     *
     * Bisa terjadi jika:
     * - status berubah
     * - outlet berubah/tidak sesuai
     * - record sudah dihapus
     * =======================================================
     */

    if (deleted.count === 0) {
      return jsonError(
        "Waste tidak dapat dihapus. Status mungkin sudah berubah atau Waste bukan milik outlet Anda.",
        409
      );
    }

    /*
     * =======================================================
     * RESPONSE
     * =======================================================
     */

    return NextResponse.json({
      success: true,

      message:
        "Waste PENDING berhasil dihapus.",

      data: {
        id: waste.id,

        number: waste.number,

        outletId:
          waste.outletId,

        outlet:
          waste.outlet,

        barangId:
          waste.barangId,

        barang:
          waste.barang,

        type: "WASTE",

        status: "PENDING",

        wasteQty:
          Number(
            waste.wasteQty || 0
          ),

        totalCost:
          Number(
            waste.totalCost || 0
          ),

        deleted: true,
      },
    });
  } catch (error: any) {
    console.error(
      "OUTLET WASTE DELETE [ID] ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Gagal menghapus Waste Outlet.",

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}