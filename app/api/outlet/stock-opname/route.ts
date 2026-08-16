import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// =====================================================
// CURRENT LOGIN USER
// =====================================================

async function getLoginUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get("erp-session");

  if (!session) {
    return {
      error: "Tidak login",
      status: 401,
    } as const;
  }

  let sessionData: any;

  try {
    sessionData = JSON.parse(session.value);
  } catch {
    return {
      error: "Session tidak valid",
      status: 401,
    } as const;
  }

  const userId = Number(
    sessionData?.id ??
      sessionData?.user?.id ??
      0
  );

  if (!Number.isInteger(userId) || userId <= 0) {
    return {
      error: "Session tidak valid",
      status: 401,
    } as const;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
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
    return {
      error: "User tidak ditemukan",
      status: 404,
    } as const;
  }

  if (!user.active) {
    return {
      error: "User tidak aktif",
      status: 403,
    } as const;
  }

  const role = String(user.role).toUpperCase();

  if (
    role !== "OUTLET_ADMIN" &&
    role !== "ADMIN" &&
    role !== "MANAGER"
  ) {
    return {
      error:
        "Anda tidak memiliki akses stock opname outlet",
      status: 403,
    } as const;
  }

  // ---------------------------------------------------
  // OUTLET ADMIN WAJIB PUNYA OUTLET
  // ---------------------------------------------------

  if (
    role === "OUTLET_ADMIN" &&
    (!user.outletId || !user.outlet)
  ) {
    return {
      error:
        "User outlet belum terhubung dengan outlet",
      status: 400,
    } as const;
  }

  return {
    user,
    role,
  } as const;
}

// =====================================================
// GET STOCK OUTLET UNTUK OPNAME
//
// ADMIN / MANAGER
// -> bisa melihat semua outlet
//
// OUTLET_ADMIN
// -> hanya outlet sendiri
// =====================================================

export async function GET() {
  try {
    const login = await getLoginUser();

    if ("error" in login) {
      return NextResponse.json(
        {
          success: false,
          message: login.error,
        },
        {
          status: login.status,
        }
      );
    }

    const { user, role } = login;

    const where: any = {};

    // ---------------------------------------------------
    // SECURITY OUTLET ADMIN
    // ---------------------------------------------------

    if (role === "OUTLET_ADMIN") {
      where.outletId = Number(user.outletId);
    }

    // ---------------------------------------------------
    // ADMIN / MANAGER
    // ---------------------------------------------------
    // Tidak diberi filter sehingga bisa melihat
    // seluruh stock outlet.

    const stocks =
      await prisma.outletStock.findMany({
        where,

        include: {
          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },

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

        orderBy: [
          {
            outlet: {
              name: "asc",
            },
          },

          {
            barang: {
              name: "asc",
            },
          },
        ],
      });

    return NextResponse.json({
      success: true,

      user: {
        id: user.id,
        fullname: user.fullname,
        role,
        outletId: user.outletId,
      },

      outlet:
        role === "OUTLET_ADMIN"
          ? user.outlet || null
          : null,

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
// POST CREATE STOCK OPNAME
//
// CREATE = COUNTING
//
// PENTING:
// - TIDAK mengubah OutletStock
// - Status = COUNTING
// - Perubahan stock dilakukan saat APPROVE
// =====================================================

export async function POST(
  req: NextRequest
) {
  try {
    const login = await getLoginUser();

    if ("error" in login) {
      return NextResponse.json(
        {
          success: false,
          message: login.error,
        },
        {
          status: login.status,
        }
      );
    }

    const { user, role } = login;

    // =================================================
    // BODY
    // =================================================

    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Body request tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const requestedOutletId = Number(
      body?.outletId ?? 0
    );

    const items = Array.isArray(body?.items)
      ? body.items
      : [];

    // =================================================
    // VALIDASI ITEMS
    // =================================================

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
    // TENTUKAN OUTLET
    //
    // OUTLET_ADMIN
    // -> SELALU outlet dari session
    //
    // ADMIN / MANAGER
    // -> outletId dari request
    // =================================================

    let outletId: number;

    if (role === "OUTLET_ADMIN") {
      outletId = Number(user.outletId);

      if (
        !Number.isInteger(outletId) ||
        outletId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User tidak terhubung dengan outlet yang valid",
          },
          {
            status: 400,
          }
        );
      }
    } else {
      if (
        !Number.isInteger(
          requestedOutletId
        ) ||
        requestedOutletId <= 0
      ) {
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

      outletId = requestedOutletId;
    }

    // =================================================
    // CEK OUTLET
    // =================================================

    const outlet =
      await prisma.outlet.findUnique({
        where: {
          id: outletId,
        },

        select: {
          id: true,
          code: true,
          name: true,
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

    // =================================================
    // SECURITY TAMBAHAN
    //
    // OUTLET_ADMIN TIDAK BOLEH MEMANIPULASI
    // outletId melalui body.
    //
    // Walaupun dia mengirim outletId outlet lain,
    // tetap dipaksa menggunakan outlet session.
    // =================================================

    if (
      role === "OUTLET_ADMIN" &&
      requestedOutletId > 0 &&
      requestedOutletId !== outletId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak dapat membuat stock opname untuk outlet lain",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // VALIDASI STOCK ID
    // =================================================

    const parsedItems = items.map(
      (item: any, index: number) => {
        const stockId = Number(
          item?.stockId
        );

        const physicalQty = Number(
          item?.physicalQty
        );

        return {
          index,
          stockId,
          physicalQty,
          note:
            item?.note !== undefined &&
            item?.note !== null
              ? String(item.note).trim()
              : null,
        };
      }
    );

    // -------------------------------------------------
    // CEK STOCK ID
    // -------------------------------------------------

    const invalidStock = parsedItems.find(
      (item) =>
        !Number.isInteger(
          item.stockId
        ) ||
        item.stockId <= 0
    );

    if (invalidStock) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Stock ID pada item ke-${invalidStock.index + 1} tidak valid`,
        },
        {
          status: 400,
        }
      );
    }

    // -------------------------------------------------
    // CEK PHYSICAL QTY
    // -------------------------------------------------

    const invalidQty = parsedItems.find(
      (item) =>
        !Number.isFinite(
          item.physicalQty
        ) ||
        item.physicalQty < 0
    );

    if (invalidQty) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Qty fisik pada item ke-${invalidQty.index + 1} tidak valid`,
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // CEK DUPLIKAT STOCK ID
    //
    // Satu barang tidak boleh muncul dua kali
    // dalam satu stock opname.
    // =================================================

    const stockIdSet = new Set(
      parsedItems.map(
        (item) => item.stockId
      )
    );

    if (
      stockIdSet.size !==
      parsedItems.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang yang sama tidak boleh dimasukkan dua kali",
        },
        {
          status: 400,
        }
      );
    }

    const stockIds = Array.from(
      stockIdSet
    );

    // =================================================
    // AMBIL STOCK
    //
    // PENTING:
    // WHERE MENGUNCI outletId.
    //
    // Jadi user tidak bisa mengirim stockId
    // milik outlet lain.
    // =================================================

    const stocks =
      await prisma.outletStock.findMany({
        where: {
          id: {
            in: stockIds,
          },

          outletId,
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
      });

    // =================================================
    // SEMUA STOCK HARUS DITEMUKAN
    // =================================================

    if (
      stocks.length !== stockIds.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Ada barang yang bukan milik outlet tersebut atau stock tidak ditemukan",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // CEK BARANG ID UNIK
    //
    // Pencegahan tambahan jika database mempunyai
    // data stock yang tidak semestinya.
    // =================================================

    const barangIds =
      stocks.map(
        (stock) =>
          Number(stock.barangId)
      );

    const barangIdSet =
      new Set(barangIds);

    if (
      barangIdSet.size !==
      barangIds.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Terdapat data stock barang yang duplikat",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // NOMOR OPNAME
    // =================================================

    const lastOpname =
      await prisma.stockOpname.findFirst({
        orderBy: {
          id: "desc",
        },

        select: {
          id: true,
        },
      });

    const nextId =
      (lastOpname?.id ?? 0) + 1;

    const code =
      "SO-" +
      String(nextId).padStart(5, "0");

    // =================================================
    // CREATE COUNTING
    //
    // TIDAK ADA UPDATE OUTLET STOCK DI SINI.
    //
    // Stock baru berubah ketika approval dilakukan.
    // =================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // -------------------------------------------
          // CEK ULANG OUTLET
          // -------------------------------------------

          const currentOutlet =
            await tx.outlet.findUnique({
              where: {
                id: outletId,
              },

              select: {
                id: true,
                code: true,
                name: true,
              },
            });

          if (!currentOutlet) {
            throw new Error(
              "Outlet tidak ditemukan"
            );
          }

          // -------------------------------------------
          // CEK STOCK ULANG DI DALAM TRANSACTION
          // -------------------------------------------

          const currentStocks =
            await tx.outletStock.findMany({
              where: {
                id: {
                  in: stockIds,
                },

                outletId,
              },

              select: {
                id: true,
                outletId: true,
                barangId: true,
                stock: true,
              },
            });

          if (
            currentStocks.length !==
            stockIds.length
          ) {
            throw new Error(
              "Data stock berubah atau tidak lagi tersedia"
            );
          }

          // -------------------------------------------
          // BUAT MAP INPUT
          // -------------------------------------------

          const inputMap =
            new Map<
              number,
              {
                physicalQty: number;
                note: string | null;
              }
            >();

          for (const item of parsedItems) {
            inputMap.set(
              item.stockId,
              {
                physicalQty:
                  item.physicalQty,
                note: item.note,
              }
            );
          }

          // -------------------------------------------
          // CREATE OPNAME
          // -------------------------------------------

          const opname =
            await tx.stockOpname.create({
              data: {
                code,

                outletId,

                date: new Date(),

                status: "COUNTING",

                createdBy: user.id,

                items: {
                  create:
                    currentStocks.map(
                      (stock) => {
                        const input =
                          inputMap.get(
                            stock.id
                          );

                        const systemQty =
                          Number(
                            stock.stock ?? 0
                          );

                        const physicalQty =
                          Math.max(
                            0,
                            Number(
                              input
                                ?.physicalQty ??
                                0
                            )
                          );

                        const difference =
                          physicalQty -
                          systemQty;

                        return {
                          barangId:
                            stock.barangId,

                          systemQty,

                          physicalQty,

                          difference,

                          note:
                            input?.note ??
                            null,
                        };
                      }
                    ),
                },
              },

              include: {
                outlet: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },

                items: {
                  include: {
                    barang: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                        unit: true,
                      },
                    },
                  },
                },
              },
            });

          return opname;
        }
      );

    // =================================================
    // RESPONSE
    // =================================================

    return NextResponse.json(
      {
        success: true,

        message:
          "Stock Opname berhasil dibuat dan menunggu approval",

        data: result,

        outlet,
      },
      {
        status: 201,
      }
    );
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