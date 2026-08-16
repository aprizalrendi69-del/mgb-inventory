import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

async function getLoginUser() {
  const cookieStore = await cookies();

  const session = cookieStore.get("erp-session");

  if (!session) {
    throw new Error("Tidak login");
  }

  let sessionData: any;

  try {
    sessionData = JSON.parse(session.value);
  } catch {
    throw new Error("Session tidak valid");
  }

  if (!sessionData?.id) {
    throw new Error("Session tidak valid");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: Number(sessionData.id),
    },
    select: {
      id: true,
      fullname: true,
      role: true,
      active: true,
      outletId: true,

      outlet: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("User tidak ditemukan");
  }

  if (!user.active) {
    throw new Error("User tidak aktif");
  }

  if (!user.outletId || !user.outlet) {
    throw new Error(
      "User tidak terhubung dengan outlet"
    );
  }

  return user;
}

// =====================================================
// GET STOCK OUTLET UNTUK OPNAME
// =====================================================

export async function GET() {
  try {
    const user = await getLoginUser();

    const stocks = await prisma.outletStock.findMany({
      where: {
        outletId: user.outletId,
      },

      include: {
        barang: {
          select: {
            id: true,
            code: true,
            name: true,
            unit: true,
            purchasePrice: true,
            sellingPrice: true,
          },
        },
      },

      orderBy: {
        barang: {
          name: "asc",
        },
      },
    });

    return NextResponse.json({
      success: true,

      outlet: user.outlet,

      data: stocks,
    });
  } catch (error: any) {
    console.error(
      "GET OUTLET STOCK OPNAME ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil stock opname",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// POST BUAT STOCK OPNAME
// =====================================================

export async function POST(req: NextRequest) {
  try {
    const user = await getLoginUser();

    const body = await req.json();

    const items = Array.isArray(body?.items)
      ? body.items
      : [];

    if (items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak ada barang yang dihitung",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // AMBIL STOCK HANYA OUTLET LOGIN
    // =================================================

    const stockIds = items
      .map((item: any) =>
        Number(item.stockId)
      )
      .filter((id: number) => id > 0);

    if (stockIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Data barang tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const stocks =
      await prisma.outletStock.findMany({
        where: {
          id: {
            in: stockIds,
          },

          outletId: user.outletId,
        },

        include: {
          barang: true,
        },
      });

    if (
      stocks.length !==
      stockIds.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Ada barang yang bukan milik outlet login",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // NOMOR OPNAME
    // =================================================

    const count =
      await prisma.stockOpname.count();

    const code =
      "SO-" +
      String(count + 1).padStart(5, "0");

    // =================================================
    // BUAT OPNAME
    //
    // PENTING:
    // BELUM UPDATE OUTLET STOCK
    // =================================================

    const opname =
      await prisma.$transaction(
        async (tx) => {
          const result =
            await tx.stockOpname.create({
              data: {
                code,

                date: new Date(),

                status: "COUNTING",

                createdBy: user.id,

                approvedBy: null,

                outletId:
                  user.outletId,

                items: {
                  create:
                    stocks.map(
                      (stock) => {
                        const input =
                          items.find(
                            (item: any) =>
                              Number(
                                item.stockId
                              ) ===
                              stock.id
                          );

                        const systemQty =
                          Number(
                            stock.stock || 0
                          );

                        const physicalQty =
                          Math.max(
                            0,
                            Number(
                              input?.physicalQty ??
                                0
                            )
                          );

                        return {
                          barangId:
                            stock.barangId,

                          systemQty,

                          physicalQty,

                          difference:
                            physicalQty -
                            systemQty,

                          note:
                            input?.note ||
                            null,
                        };
                      }
                    ),
                },
              },

              include: {
                outlet: true,

                items: {
                  include: {
                    barang: true,
                  },
                },
              },
            });

          return result;
        }
      );

    return NextResponse.json({
      success: true,

      message:
        "Stock Opname berhasil dibuat dan menunggu approval",

      data: opname,

      outlet: user.outlet,
    });
  } catch (error: any) {
    console.error(
      "POST OUTLET STOCK OPNAME ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal membuat stock opname",
      },
      {
        status: 500,
      }
    );
  }
}