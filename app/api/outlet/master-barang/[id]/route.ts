import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/*
 * =========================================================
 * CURRENT USER
 * =========================================================
 */

async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get("erp-session");

  if (!session) return null;

  try {
    const sessionData = JSON.parse(session.value);

    const userId = Number(
      sessionData?.id ??
        sessionData?.user?.id
    );

    if (!Number.isInteger(userId) || userId <= 0) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        role: true,
        outletId: true,
        active: true,
      },
    });

    if (!user || !user.active) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

/*
 * =========================================================
 * ROLE
 * =========================================================
 */

function isCenterUser(role: string) {
  return (
    role === "ADMIN" ||
    role === "MANAGER"
  );
}

function isOutletAdmin(role: string) {
  return role === "OUTLET_ADMIN";
}

/*
 * =========================================================
 * ID
 * =========================================================
 */

function validId(value: unknown) {
  const id = Number(value);

  return (
    Number.isInteger(id) &&
    id > 0
  );
}

/*
 * =========================================================
 * NUMBER
 * =========================================================
 */

function normalizeNumber(
  value: unknown,
  fallback = 0
) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function normalizeConversionRate(
  value: unknown
) {
  const rate = Number(value);

  if (!Number.isFinite(rate) || rate <= 0) {
    return 1;
  }

  return rate;
}

/*
 * =========================================================
 * GET DETAIL
 *
 * Mengembalikan:
 *
 * unit
 * baseUnit
 * conversionRate
 *
 * serta:
 *
 * stock
 * baseStock
 *
 * Contoh:
 *
 * unit = Dus
 * baseUnit = PCS
 * conversionRate = 24
 * stock = 5
 *
 * baseStock = 120 PCS
 * =========================================================
 */

export async function GET(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    /*
     * ===================================================
     * SESSION
     * ===================================================
     */

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login atau session sudah tidak aktif",
        },
        { status: 401 }
      );
    }

    /*
     * ===================================================
     * ROLE
     * ===================================================
     */

    if (
      !isCenterUser(user.role) &&
      !isOutletAdmin(user.role)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak memiliki akses",
        },
        { status: 403 }
      );
    }

    /*
     * ===================================================
     * ID
     * ===================================================
     */

    const { id } = await context.params;

    if (!validId(id)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID master barang outlet tidak valid",
        },
        { status: 400 }
      );
    }

    const outletBarangId =
      Number(id);

    /*
     * ===================================================
     * QUERY
     * ===================================================
     */

    const data =
      await prisma.outletBarang.findUnique({
        where: {
          id: outletBarangId,
        },

        include: {
          outlet: true,

          barang: {
            include: {
              outletStocks: true,
            },
          },
        },
      });

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang outlet tidak ditemukan",
        },
        { status: 404 }
      );
    }

    /*
     * ===================================================
     * SECURITY OUTLET ADMIN
     * ===================================================
     */

    if (isOutletAdmin(user.role)) {
      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User belum memiliki outlet",
          },
          { status: 400 }
        );
      }

      if (
        data.outletId !==
        Number(user.outletId)
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Anda tidak memiliki akses ke barang outlet ini",
          },
          { status: 403 }
        );
      }
    }

    /*
     * ===================================================
     * BARANG HARUS CENTRAL
     * ===================================================
     */

    if (data.barang.source !== "CENTRAL") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang outlet harus berasal dari Master Barang Central",
        },
        { status: 400 }
      );
    }

    /*
     * ===================================================
     * SATUAN
     * ===================================================
     */

    const conversionRate =
      normalizeConversionRate(
        data.barang.conversionRate
      );

    const unit =
      data.barang.unit || "";

    const baseUnit =
      data.barang.baseUnit || unit;

    /*
     * ===================================================
     * STOCK OUTLET
     * ===================================================
     */

    const stockRecord =
      data.barang.outletStocks.find(
        (stock) =>
          stock.outletId ===
          data.outletId
      ) ?? null;

    const stock =
      normalizeNumber(
        stockRecord?.stock,
        0
      );

    const minimumStock =
      normalizeNumber(
        stockRecord?.minimumStock ??
          data.barang.minimumStock,
        0
      );

    const averageCost =
      normalizeNumber(
        stockRecord?.averageCost,
        0
      );

    const baseStock =
      stock * conversionRate;

    const baseMinimumStock =
      minimumStock * conversionRate;

    /*
     * ===================================================
     * RESPONSE
     * ===================================================
     */

    return NextResponse.json({
      success: true,

      data: {
        ...data,

        barang: {
          ...data.barang,

          unit,

          baseUnit,

          conversionRate,

          outletStock: stockRecord
            ? {
                ...stockRecord,

                stock,

                minimumStock,

                averageCost,

                baseStock,

                baseMinimumStock,

                unit,

                baseUnit,

                conversionRate,
              }
            : {
                id: null,

                stock: 0,

                minimumStock,

                averageCost,

                updatedAt: null,

                baseStock: 0,

                baseMinimumStock,

                unit,

                baseUnit,

                conversionRate,
              },
        },
      },
    });
  } catch (error: any) {
    console.error(
      "GET DETAIL MASTER BARANG OUTLET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil detail barang outlet",
      },
      { status: 500 }
    );
  }
}

/*
 * =========================================================
 * PUT
 *
 * Yang boleh diubah:
 * - harga outlet
 * - aktif
 *
 * Yang TIDAK boleh diubah:
 * - barangId
 * - outletId
 * - unit
 * - baseUnit
 * - conversionRate
 * - Barang pusat
 * - stock
 * - averageCost
 *
 * Satuan selalu mengikuti Master Barang Central.
 * =========================================================
 */

export async function PUT(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    /*
     * ===================================================
     * SESSION
     * ===================================================
     */

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login atau session sudah tidak aktif",
        },
        { status: 401 }
      );
    }

    /*
     * ===================================================
     * ROLE
     * ===================================================
     */

    if (
      !isCenterUser(user.role) &&
      !isOutletAdmin(user.role)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak memiliki akses",
        },
        { status: 403 }
      );
    }

    /*
     * ===================================================
     * ID
     * ===================================================
     */

    const { id } = await context.params;

    if (!validId(id)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID master barang outlet tidak valid",
        },
        { status: 400 }
      );
    }

    const outletBarangId =
      Number(id);

    /*
     * ===================================================
     * DATA EXISTING
     * ===================================================
     */

    const existing =
      await prisma.outletBarang.findUnique({
        where: {
          id: outletBarangId,
        },

        include: {
          outlet: true,
          barang: true,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang outlet tidak ditemukan",
        },
        { status: 404 }
      );
    }

    /*
     * ===================================================
     * SECURITY OUTLET ADMIN
     * ===================================================
     */

    if (isOutletAdmin(user.role)) {
      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User belum memiliki outlet",
          },
          { status: 400 }
        );
      }

      if (
        existing.outletId !==
        Number(user.outletId)
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Anda tidak memiliki akses mengubah barang outlet ini",
          },
          { status: 403 }
        );
      }
    }

    /*
     * ===================================================
     * OUTLET AKTIF
     * ===================================================
     */

    if (!existing.outlet.active) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet sedang tidak aktif",
        },
        { status: 400 }
      );
    }

    /*
     * ===================================================
     * BARANG HARUS CENTRAL
     * ===================================================
     */

    if (existing.barang.source !== "CENTRAL") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang outlet harus berasal dari Master Barang Central",
        },
        { status: 400 }
      );
    }

    /*
     * ===================================================
     * BODY
     * ===================================================
     */

    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Request tidak valid",
        },
        { status: 400 }
      );
    }

    /*
     * ===================================================
     * HARGA
     * ===================================================
     */

    let harga = Number(
      existing.harga ?? 0
    );

    if (
      body?.harga !== undefined &&
      body?.harga !== null &&
      body?.harga !== ""
    ) {
      harga = Number(body.harga);

      if (
        !Number.isFinite(harga) ||
        harga < 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Harga outlet tidak valid",
          },
          { status: 400 }
        );
      }
    }

    /*
     * ===================================================
     * AKTIF
     * ===================================================
     */

    let aktif = Boolean(
      existing.aktif
    );

    if (
      body?.aktif !== undefined
    ) {
      if (
        typeof body.aktif !==
        "boolean"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Status aktif tidak valid",
          },
          { status: 400 }
        );
      }

      aktif = body.aktif;
    }

    /*
     * ===================================================
     * UPDATE
     *
     * Satuan TIDAK diubah.
     * ===================================================
     */

    const updated =
      await prisma.outletBarang.update({
        where: {
          id: outletBarangId,
        },

        data: {
          harga,
          aktif,
        },

        include: {
          outlet: true,
          barang: true,
        },
      });

    /*
     * ===================================================
     * SATUAN RESPONSE
     * ===================================================
     */

    const conversionRate =
      normalizeConversionRate(
        updated.barang.conversionRate
      );

    const unit =
      updated.barang.unit || "";

    const baseUnit =
      updated.barang.baseUnit || unit;

    return NextResponse.json({
      success: true,

      message:
        "Barang outlet berhasil diperbarui",

      data: {
        ...updated,

        unit,
        baseUnit,
        conversionRate,
      },
    });
  } catch (error: any) {
    console.error(
      "PUT MASTER BARANG OUTLET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal memperbarui barang outlet",
      },
      { status: 500 }
    );
  }
}

/*
 * =========================================================
 * DELETE
 *
 * Hanya menghapus relasi OutletBarang.
 *
 * TIDAK menghapus:
 * - Barang Central
 * - OutletStock
 *
 * Barang dengan stock > 0 tidak boleh dihapus.
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
     * ===================================================
     * SESSION
     * ===================================================
     */

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login atau session sudah tidak aktif",
        },
        { status: 401 }
      );
    }

    /*
     * ===================================================
     * ROLE
     * ===================================================
     */

    if (
      !isCenterUser(user.role) &&
      !isOutletAdmin(user.role)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak memiliki akses",
        },
        { status: 403 }
      );
    }

    /*
     * ===================================================
     * ID
     * ===================================================
     */

    const { id } = await context.params;

    if (!validId(id)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID master barang outlet tidak valid",
        },
        { status: 400 }
      );
    }

    const outletBarangId =
      Number(id);

    /*
     * ===================================================
     * DATA EXISTING
     * ===================================================
     */

    const existing =
      await prisma.outletBarang.findUnique({
        where: {
          id: outletBarangId,
        },

        include: {
          outlet: true,
          barang: true,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang outlet tidak ditemukan",
        },
        { status: 404 }
      );
    }

    /*
     * ===================================================
     * SECURITY OUTLET ADMIN
     * ===================================================
     */

    if (isOutletAdmin(user.role)) {
      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User belum memiliki outlet",
          },
          { status: 400 }
        );
      }

      if (
        existing.outletId !==
        Number(user.outletId)
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Anda tidak memiliki akses menghapus barang outlet ini",
          },
          { status: 403 }
        );
      }
    }

    /*
     * ===================================================
     * OUTLET AKTIF
     * ===================================================
     */

    if (!existing.outlet.active) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet sedang tidak aktif",
        },
        { status: 400 }
      );
    }

    /*
     * ===================================================
     * CEK STOCK
     *
     * Stock tetap dalam unit transaksi.
     * ===================================================
     */

    const stock =
      await prisma.outletStock.findUnique({
        where: {
          outletId_barangId: {
            outletId:
              existing.outletId,

            barangId:
              existing.barangId,
          },
        },

        select: {
          stock: true,
        },
      });

    const currentStock =
      normalizeNumber(
        stock?.stock,
        0
      );

    if (currentStock > 0) {
      const conversionRate =
        normalizeConversionRate(
          existing.barang.conversionRate
        );

      const baseStock =
        currentStock *
        conversionRate;

      const unit =
        existing.barang.unit || "";

      const baseUnit =
        existing.barang.baseUnit ||
        unit;

      return NextResponse.json(
        {
          success: false,

          message:
            `Barang tidak dapat dihapus karena stock outlet masih ${currentStock} ${unit} (${baseStock} ${baseUnit})`,
        },
        { status: 400 }
      );
    }

    /*
     * ===================================================
     * DELETE
     * ===================================================
     */

    await prisma.outletBarang.delete({
      where: {
        id: outletBarangId,
      },
    });

    return NextResponse.json({
      success: true,

      message:
        "Barang berhasil dihapus dari master outlet",
    });
  } catch (error: any) {
    console.error(
      "DELETE MASTER BARANG OUTLET ERROR:",
      error
    );

    if (error?.code === "P2002") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang sudah terdaftar di outlet",
        },
        { status: 409 }
      );
    }

    if (error?.code === "P2003") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang tidak dapat dihapus karena masih digunakan transaksi outlet",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal menghapus barang outlet",
      },
      { status: 500 }
    );
  }
}