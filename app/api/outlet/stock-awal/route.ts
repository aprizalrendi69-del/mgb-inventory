import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// =====================================================
// CURRENT LOGIN USER
// =====================================================

async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get("erp-session");

  if (!session) {
    return null;
  }

  let sessionData: any;

  try {
    sessionData = JSON.parse(session.value);
  } catch {
    return null;
  }

  const userId = Number(
    sessionData?.id ?? sessionData?.user?.id
  );

  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  return prisma.user.findUnique({
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
}

// =====================================================
// RESPONSE HELPER
// =====================================================

function unauthorized(message = "Tidak login") {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status: 401,
    }
  );
}

function forbidden(message = "Anda tidak memiliki akses") {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status: 403,
    }
  );
}

// =====================================================
// ROLE HELPER
// =====================================================

function isAdmin(user: any) {
  return (
    String(user?.role || "").toUpperCase() ===
    "ADMIN"
  );
}

function isOutletAdmin(user: any) {
  return (
    String(user?.role || "").toUpperCase() ===
    "OUTLET_ADMIN"
  );
}

// =====================================================
// ID VALIDATION
// =====================================================

function validId(value: any) {
  const id = Number(value);

  return (
    Number.isInteger(id) &&
    id > 0
  );
}

// =====================================================
// NUMBER VALIDATION
// =====================================================

function validNumber(value: any) {
  const number = Number(value);

  return (
    Number.isFinite(number) &&
    number >= 0
  );
}

// =====================================================
// GET STOCK OUTLET
//
// ADMIN
// -> semua outlet
// -> bisa filter outlet
//
// OUTLET_ADMIN
// -> hanya outlet sendiri
//
// TIDAK PERNAH MENGAMBIL Barang.stock
// =====================================================

export async function GET(
  req: NextRequest
) {
  try {
    // ===================================================
    // 1. SESSION
    // ===================================================

    const user = await getCurrentUser();

    if (!user) {
      return unauthorized();
    }

    if (!user.active) {
      return forbidden("User tidak aktif");
    }

    // ===================================================
    // 2. ROLE
    // ===================================================

    if (
      !isAdmin(user) &&
      !isOutletAdmin(user)
    ) {
      return forbidden(
        "Anda tidak memiliki akses stock outlet"
      );
    }

    // ===================================================
    // 3. QUERY
    // ===================================================

    const { searchParams } =
      new URL(req.url);

    const outletIdParam =
      searchParams.get("outletId");

    let outletId: number | null = null;

    // ===================================================
    // 4. ADMIN
    // ===================================================

    if (isAdmin(user)) {
      if (outletIdParam !== null) {
        if (!validId(outletIdParam)) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Outlet ID tidak valid",
            },
            {
              status: 400,
            }
          );
        }

        outletId = Number(
          outletIdParam
        );
      }
    }

    // ===================================================
    // 5. OUTLET ADMIN
    //
    // SELALU DARI SESSION
    // ===================================================

    if (isOutletAdmin(user)) {
      if (
        !user.outletId ||
        !validId(user.outletId)
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet belum terhubung dengan outlet",
          },
          {
            status: 400,
          }
        );
      }

      outletId = Number(
        user.outletId
      );
    }

    // ===================================================
    // 6. VALIDASI OUTLET
    // ===================================================

    if (outletId !== null) {
      const outlet =
        await prisma.outlet.findUnique({
          where: {
            id: outletId,
          },

          select: {
            id: true,
            code: true,
            name: true,
            active: true,
          },
        });

      if (!outlet) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet tidak ditemukan",
          },
          {
            status: 404,
          }
        );
      }

      if (!outlet.active) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet tidak aktif",
          },
          {
            status: 400,
          }
        );
      }
    }

    // ===================================================
    // 7. WHERE
    // ===================================================

    const where: {
      outletId?: number;
    } = {};

    if (outletId !== null) {
      where.outletId = outletId;
    }

    // ===================================================
    // 8. GET
    // ===================================================

    const data =
      await prisma.outletStock.findMany({
        where,

        select: {
          id: true,
          outletId: true,
          barangId: true,
          stock: true,
          averageCost: true,
          minimumStock: true,
          updatedAt: true,

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
              barcode: true,
              name: true,
              category: true,
              unit: true,
              purchasePrice: true,
              sellingPrice: true,
              minimumStock: true,
              source: true,
              active: true,
            },
          },
        },

        orderBy: [
          {
            outletId: "asc",
          },
          {
            updatedAt: "desc",
          },
        ],
      });

    // ===================================================
    // 9. RESPONSE
    // ===================================================

    return NextResponse.json({
      success: true,

      scope: {
        role: user.role,
        outletId,
      },

      user: {
        id: user.id,
        fullname: user.fullname,
        role: user.role,
        outletId: user.outletId,
      },

      data,
    });
  } catch (error: any) {
    console.error(
      "GET STOCK OUTLET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil stock outlet",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// POST STOCK AWAL OUTLET
//
// POST = MEMBUAT STOCK AWAL
//
// Jika stock sudah ada:
// -> TIDAK ditambahkan
// -> TIDAK di-overwrite
// -> return 409
//
// Untuk edit gunakan PUT.
//
// ADMIN
// -> boleh memilih outlet
//
// OUTLET_ADMIN
// -> otomatis outlet sendiri
//
// TIDAK MENGUBAH:
// Barang.stock
// Barang.purchasePrice
// =====================================================

export async function POST(
  req: NextRequest
) {
  try {
    // ===================================================
    // 1. SESSION
    // ===================================================

    const user = await getCurrentUser();

    if (!user) {
      return unauthorized();
    }

    if (!user.active) {
      return forbidden("User tidak aktif");
    }

    // ===================================================
    // 2. ROLE
    // ===================================================

    if (
      !isAdmin(user) &&
      !isOutletAdmin(user)
    ) {
      return forbidden(
        "Anda tidak memiliki akses stock outlet"
      );
    }

    // ===================================================
    // 3. BODY
    // ===================================================

    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Body request tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const {
      outletId: requestedOutletId,
      barangId,
      qty,
      averageCost,
      minimumStock,
    } = body;

    // ===================================================
    // 4. TENTUKAN OUTLET
    // ===================================================

    let outletId: number;

    if (isOutletAdmin(user)) {
      if (
        !user.outletId ||
        !validId(user.outletId)
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet belum terhubung dengan outlet",
          },
          {
            status: 400,
          }
        );
      }

      outletId = Number(
        user.outletId
      );
    } else {
      if (!validId(requestedOutletId)) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet wajib dipilih",
          },
          {
            status: 400,
          }
        );
      }

      outletId = Number(
        requestedOutletId
      );
    }

    // ===================================================
    // 5. VALIDASI BARANG
    // ===================================================

    if (!validId(barangId)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang wajib dipilih",
        },
        {
          status: 400,
        }
      );
    }

    const barangIdNumber =
      Number(barangId);

    // ===================================================
    // 6. VALIDASI QTY
    // ===================================================

    if (!validNumber(qty)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Qty stock awal tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const jumlah = Number(qty);

    // ===================================================
    // 7. VALIDASI AVERAGE COST
    // ===================================================

    if (!validNumber(averageCost ?? 0)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Harga modal tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const harga = Number(
      averageCost ?? 0
    );

    // ===================================================
    // 8. VALIDASI MINIMUM STOCK
    // ===================================================

    if (!validNumber(minimumStock ?? 0)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Minimum stock tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const minimum = Number(
      minimumStock ?? 0
    );

    // ===================================================
    // 9. CEK OUTLET
    // ===================================================

    const outlet =
      await prisma.outlet.findUnique({
        where: {
          id: outletId,
        },

        select: {
          id: true,
          code: true,
          name: true,
          active: true,
        },
      });

    if (!outlet) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    if (!outlet.active) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tidak aktif",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // 10. CEK MASTER BARANG
    //
    // HARUS CENTRAL
    // ===================================================

    const barang =
      await prisma.barang.findFirst({
        where: {
          id: barangIdNumber,
          source: "CENTRAL",
          active: true,
        },

        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          unit: true,
          purchasePrice: true,
          sellingPrice: true,
          minimumStock: true,
          source: true,
        },
      });

    if (!barang) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang tidak ditemukan di Master Barang Pusat",
        },
        {
          status: 404,
        }
      );
    }

    // ===================================================
    // 11. CEK BARANG OUTLET
    // ===================================================

    const outletBarang =
      await prisma.outletBarang.findUnique({
        where: {
          outletId_barangId: {
            outletId,
            barangId:
              barangIdNumber,
          },
        },

        select: {
          id: true,
          outletId: true,
          barangId: true,
          aktif: true,
          harga: true,
        },
      });

    if (!outletBarang) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang belum terdaftar di Master Barang Outlet",
        },
        {
          status: 400,
        }
      );
    }

    if (!outletBarang.aktif) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang outlet sedang tidak aktif",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // 12. TRANSACTION
    // ===================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          const existing =
            await tx.outletStock.findUnique({
              where: {
                outletId_barangId: {
                  outletId,
                  barangId:
                    barangIdNumber,
                },
              },
            });

          if (existing) {
            return {
              action: "EXISTS" as const,
              data: existing,
            };
          }

          const created =
            await tx.outletStock.create({
              data: {
                outletId,

                barangId:
                  barangIdNumber,

                stock: jumlah,

                minimumStock:
                  minimum > 0
                    ? minimum
                    : Number(
                        barang.minimumStock ?? 0
                      ),

                averageCost:
                  harga,
              },

              include: {
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
                    barcode: true,
                    name: true,
                    category: true,
                    unit: true,
                    purchasePrice: true,
                    sellingPrice: true,
                    minimumStock: true,
                    source: true,
                  },
                },
              },
            });

          return {
            action: "CREATE" as const,
            data: created,
          };
        }
      );

    // ===================================================
    // 13. JIKA STOCK SUDAH ADA
    // ===================================================

    if (result.action === "EXISTS") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock barang untuk outlet tersebut sudah tersedia. Gunakan PUT untuk mengedit stock.",
          data: result.data,
        },
        {
          status: 409,
        }
      );
    }

    // ===================================================
    // 14. SUCCESS
    // ===================================================

    return NextResponse.json(
      {
        success: true,

        message:
          "Stock awal outlet berhasil dibuat",

        data: result.data,
      },
      {
        status: 201,
      }
    );
  } catch (error: any) {
    console.error(
      "POST STOCK AWAL OUTLET ERROR:",
      error
    );

    if (error?.code === "P2002") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock barang untuk outlet tersebut sudah tersedia. Gunakan PUT untuk mengedit.",
        },
        {
          status: 409,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal menyimpan stock awal outlet",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// PUT STOCK AWAL OUTLET
//
// PUT = SET NILAI STOCK BARU
//
// Contoh:
//
// stock lama = 100
// qty baru   = 80
//
// hasil = 80
//
// BUKAN 180
// =====================================================

export async function PUT(
  req: NextRequest
) {
  try {
    // ===================================================
    // 1. SESSION
    // ===================================================

    const user = await getCurrentUser();

    if (!user) {
      return unauthorized();
    }

    if (!user.active) {
      return forbidden("User tidak aktif");
    }

    // ===================================================
    // 2. ROLE
    // ===================================================

    if (
      !isAdmin(user) &&
      !isOutletAdmin(user)
    ) {
      return forbidden(
        "Anda tidak memiliki akses stock outlet"
      );
    }

    // ===================================================
    // 3. BODY
    // ===================================================

    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Body request tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const {
      id,
      outletId: requestedOutletId,
      barangId,
      qty,
      averageCost,
      minimumStock,
    } = body;

    // ===================================================
    // 4. VALIDASI STOCK ID
    // ===================================================

    if (!validId(id)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock ID tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const stockId = Number(id);

    // ===================================================
    // 5. TENTUKAN OUTLET
    // ===================================================

    let outletId: number;

    if (isOutletAdmin(user)) {
      if (
        !user.outletId ||
        !validId(user.outletId)
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet belum terhubung dengan outlet",
          },
          {
            status: 400,
          }
        );
      }

      outletId = Number(
        user.outletId
      );
    } else {
      if (!validId(requestedOutletId)) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet wajib dipilih",
          },
          {
            status: 400,
          }
        );
      }

      outletId = Number(
        requestedOutletId
      );
    }

    // ===================================================
    // 6. VALIDASI BARANG
    // ===================================================

    if (!validId(barangId)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang wajib dipilih",
        },
        {
          status: 400,
        }
      );
    }

    const barangIdNumber =
      Number(barangId);

    // ===================================================
    // 7. VALIDASI QTY
    // ===================================================

    if (!validNumber(qty)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Qty stock tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const jumlah = Number(qty);

    // ===================================================
    // 8. VALIDASI HARGA
    // ===================================================

    if (!validNumber(averageCost ?? 0)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Harga modal tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const harga = Number(
      averageCost ?? 0
    );

    // ===================================================
    // 9. VALIDASI MINIMUM STOCK
    // ===================================================

    if (!validNumber(minimumStock ?? 0)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Minimum stock tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const minimum = Number(
      minimumStock ?? 0
    );

    // ===================================================
    // 10. CEK OUTLET
    // ===================================================

    const outlet =
      await prisma.outlet.findUnique({
        where: {
          id: outletId,
        },

        select: {
          id: true,
          code: true,
          name: true,
          active: true,
        },
      });

    if (!outlet) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    if (!outlet.active) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet tidak aktif",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // 11. CEK BARANG CENTRAL
    // ===================================================

    const barang =
      await prisma.barang.findFirst({
        where: {
          id: barangIdNumber,
          source: "CENTRAL",
          active: true,
        },

        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          unit: true,
          purchasePrice: true,
          sellingPrice: true,
          minimumStock: true,
          source: true,
        },
      });

    if (!barang) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang tidak ditemukan di Master Barang Pusat",
        },
        {
          status: 404,
        }
      );
    }

    // ===================================================
    // 12. CEK BARANG OUTLET
    // ===================================================

    const outletBarang =
      await prisma.outletBarang.findUnique({
        where: {
          outletId_barangId: {
            outletId,
            barangId:
              barangIdNumber,
          },
        },

        select: {
          id: true,
          outletId: true,
          barangId: true,
          aktif: true,
          harga: true,
        },
      });

    if (!outletBarang) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang belum terdaftar di Master Barang Outlet",
        },
        {
          status: 400,
        }
      );
    }

    if (!outletBarang.aktif) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang outlet sedang tidak aktif",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // 13. CEK STOCK
    //
    // HARUS COCOK:
    // id
    // outletId
    // barangId
    // ===================================================

    const existing =
      await prisma.outletStock.findFirst({
        where: {
          id: stockId,
          outletId,
          barangId:
            barangIdNumber,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Data stock outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // ===================================================
    // 14. UPDATE
    //
    // SET, BUKAN TAMBAH
    // ===================================================

    const updated =
      await prisma.outletStock.update({
        where: {
          id: existing.id,
        },

        data: {
          stock: jumlah,

          averageCost: harga,

          minimumStock:
            minimum > 0
              ? minimum
              : Number(
                  barang.minimumStock ?? 0
                ),
        },

        include: {
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
              barcode: true,
              name: true,
              category: true,
              unit: true,
              purchasePrice: true,
              sellingPrice: true,
              minimumStock: true,
              source: true,
            },
          },
        },
      });

    // ===================================================
    // 15. RESPONSE
    // ===================================================

    return NextResponse.json(
      {
        success: true,

        message:
          "Stock awal outlet berhasil diperbarui",

        data: updated,
      },
      {
        status: 200,
      }
    );
  } catch (error: any) {
    console.error(
      "PUT STOCK AWAL OUTLET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal memperbarui stock awal outlet",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// DELETE STOCK AWAL OUTLET
//
// ADMIN
// -> boleh hapus stock outlet mana pun
//
// OUTLET_ADMIN
// -> hanya boleh hapus stock outlet sendiri
//
// TIDAK MENGUBAH:
// Barang.stock
// =====================================================

export async function DELETE(
  req: NextRequest
) {
  try {
    // ===================================================
    // 1. SESSION
    // ===================================================

    const user = await getCurrentUser();

    if (!user) {
      return unauthorized();
    }

    if (!user.active) {
      return forbidden("User tidak aktif");
    }

    // ===================================================
    // 2. ROLE
    // ===================================================

    if (
      !isAdmin(user) &&
      !isOutletAdmin(user)
    ) {
      return forbidden(
        "Anda tidak memiliki akses stock outlet"
      );
    }

    // ===================================================
    // 3. AMBIL ID
    // ===================================================

    const { searchParams } =
      new URL(req.url);

    const idParam =
      searchParams.get("id");

    if (!validId(idParam)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock ID tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const stockId = Number(
      idParam
    );

    // ===================================================
    // 4. CARI STOCK
    // ===================================================

    const existing =
      await prisma.outletStock.findUnique({
        where: {
          id: stockId,
        },

        select: {
          id: true,
          outletId: true,
          barangId: true,
          stock: true,

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

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Data stock outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // ===================================================
    // 5. SECURITY OUTLET ADMIN
    //
    // Outlet admin TIDAK BOLEH menghapus
    // stock outlet lain.
    //
    // Outlet ditentukan dari SESSION,
    // bukan dari request frontend.
    // ===================================================

    if (isOutletAdmin(user)) {
      if (
        !user.outletId ||
        !validId(user.outletId)
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet belum terhubung dengan outlet",
          },
          {
            status: 400,
          }
        );
      }

      if (
        existing.outletId !==
        Number(user.outletId)
      ) {
        return forbidden(
          "Anda hanya dapat menghapus stock outlet sendiri"
        );
      }
    }

    // ===================================================
    // 6. HAPUS
    // ===================================================

    await prisma.outletStock.delete({
      where: {
        id: existing.id,
      },
    });

    // ===================================================
    // 7. RESPONSE
    // ===================================================

    return NextResponse.json(
      {
        success: true,

        message:
          `Stock ${existing.barang.name} di ${existing.outlet.name} berhasil dihapus`,

        data: {
          id: existing.id,
          outletId:
            existing.outletId,
          barangId:
            existing.barangId,
        },
      },
      {
        status: 200,
      }
    );
  } catch (error: any) {
    console.error(
      "DELETE STOCK AWAL OUTLET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal menghapus stock outlet",
      },
      {
        status: 500,
      }
    );
  }
}