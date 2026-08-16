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
    role !== "ADMIN" &&
    role !== "MANAGER" &&
    role !== "OUTLET_ADMIN"
  ) {
    return {
      error:
        "Anda tidak memiliki akses approval stock opname outlet",
      status: 403,
    } as const;
  }

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
// GET
//
// ADMIN / MANAGER
// -> semua stock opname outlet
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

    const where: any = {
      outletId: {
        not: null,
      },
    };

    // ---------------------------------------------------
    // OUTLET ADMIN
    // ---------------------------------------------------

    if (role === "OUTLET_ADMIN") {
      where.outletId = Number(user.outletId);
    }

    const data =
      await prisma.stockOpname.findMany({
        where,

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
          },
        },

        orderBy: {
          createdAt: "desc",
        },
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

      data,
    });
  } catch (error: any) {
    console.error(
      "GET OUTLET STOCK OPNAME APPROVAL ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil data approval stock opname",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// POST APPROVE
//
// PENTING:
//
// COUNTING
//      ↓
// APPROVE
//      ↓
// UPDATE OutletStock
//
// TIDAK PERNAH UPDATE Barang.stock PUSAT
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

    const opnameId = Number(
      body?.opnameId ?? 0
    );

    if (
      !Number.isInteger(opnameId) ||
      opnameId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID stock opname tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // AMBIL OPNAME
    // =================================================

    const opname =
      await prisma.stockOpname.findUnique({
        where: {
          id: opnameId,
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
                  purchasePrice: true,
                  sellingPrice: true,
                },
              },
            },
          },
        },
      });

    if (!opname) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock opname tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // HARUS OPNAME OUTLET
    // =================================================

    if (!opname.outletId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock opname ini bukan stock opname outlet",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // OUTLET HARUS ADA
    // =================================================

    if (!opname.outlet) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet stock opname tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // SECURITY OUTLET
    //
    // OUTLET_ADMIN:
    // hanya outlet sendiri.
    //
    // ADMIN / MANAGER:
    // boleh semua outlet.
    // =================================================

    if (role === "OUTLET_ADMIN") {
      if (
        !user.outletId ||
        Number(user.outletId) !==
          Number(opname.outletId)
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Anda tidak dapat approve stock opname outlet lain",
          },
          {
            status: 403,
          }
        );
      }
    }

    // =================================================
    // STATUS HARUS COUNTING
    // =================================================

    const currentStatus =
      String(opname.status).toUpperCase();

    if (currentStatus === "APPROVED") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock opname ini sudah disetujui",
        },
        {
          status: 400,
        }
      );
    }

    if (currentStatus !== "COUNTING") {
      return NextResponse.json(
        {
          success: false,
          message:
            `Stock opname tidak dapat diapprove karena status saat ini ${opname.status}`,
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // HARUS ADA ITEM
    // =================================================

    if (
      !opname.items ||
      opname.items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock opname tidak memiliki barang",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // VALIDASI ITEM
    // =================================================

    const barangIdSet =
      new Set<number>();

    for (const item of opname.items) {
      const barangId =
        Number(item.barangId);

      if (
        !Number.isInteger(barangId) ||
        barangId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Terdapat barang pada stock opname yang tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      if (
        barangIdSet.has(barangId)
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Terdapat barang duplikat pada stock opname",
          },
          {
            status: 400,
          }
        );
      }

      barangIdSet.add(barangId);

      const physicalQty = Number(
        item.physicalQty ?? 0
      );

      if (
        !Number.isFinite(
          physicalQty
        ) ||
        physicalQty < 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Qty fisik barang ${item.barang?.name || item.barangId} tidak valid`,
          },
          {
            status: 400,
          }
        );
      }
    }

    // =================================================
    // TRANSACTION
    // =================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // -------------------------------------------
          // AMBIL ULANG OPNAME
          // -------------------------------------------

          const currentOpname =
            await tx.stockOpname.findUnique({
              where: {
                id: opnameId,
              },

              include: {
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

                outlet: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },
              },
            });

          if (!currentOpname) {
            throw new Error(
              "Stock opname tidak ditemukan"
            );
          }

          // -------------------------------------------
          // OUTLET HARUS ADA
          // -------------------------------------------

          if (
            !currentOpname.outletId
          ) {
            throw new Error(
              "Stock opname tidak memiliki outlet"
            );
          }

          // -------------------------------------------
          // SECURITY OUTLET ULANG
          // -------------------------------------------

          if (
            role === "OUTLET_ADMIN" &&
            Number(user.outletId) !==
              Number(
                currentOpname.outletId
              )
          ) {
            throw new Error(
              "Stock opname bukan milik outlet user"
            );
          }

          // -------------------------------------------
          // STATUS ULANG
          //
          // Ini penting untuk mencegah approval
          // dua kali.
          // -------------------------------------------

          if (
            String(
              currentOpname.status
            ).toUpperCase() !==
            "COUNTING"
          ) {
            throw new Error(
              "Stock opname sudah diproses"
            );
          }

          // -------------------------------------------
          // ITEM HARUS ADA
          // -------------------------------------------

          if (
            !currentOpname.items ||
            currentOpname.items.length === 0
          ) {
            throw new Error(
              "Stock opname tidak memiliki barang"
            );
          }

          // -------------------------------------------
          // AMBIL STOCK OUTLET TERKINI
          // -------------------------------------------
          //
          // PENTING:
          // Kita mengambil OutletStock berdasarkan
          // outletId + barangId.
          //
          // Tidak menyentuh Barang.stock pusat.
          // -------------------------------------------

          for (
            const item of currentOpname.items
          ) {
            const barangId =
              Number(item.barangId);

            const physicalQty =
              Math.max(
                0,
                Number(
                  item.physicalQty ?? 0
                )
              );

            const outletStock =
              await tx.outletStock.findUnique(
                {
                  where: {
                    outletId_barangId: {
                      outletId:
                        Number(
                          currentOpname.outletId
                        ),

                      barangId,
                    },
                  },
                }
              );

            // -----------------------------------------
            // STOCK BELUM ADA
            // -----------------------------------------

            if (!outletStock) {
              await tx.outletStock.create({
                data: {
                  outletId:
                    Number(
                      currentOpname.outletId
                    ),

                  barangId,

                  stock: physicalQty,

                  minimumStock: 0,

                  averageCost: 0,
                },
              });

              continue;
            }

            // -----------------------------------------
            // UPDATE STOCK OUTLET
            // -----------------------------------------

            await tx.outletStock.update({
              where: {
                id: outletStock.id,
              },

              data: {
                stock: physicalQty,
              },
            });
          }

          // -------------------------------------------
          // APPROVE
          // -------------------------------------------

          const approved =
            await tx.stockOpname.update({
              where: {
                id: currentOpname.id,
              },

              data: {
                status: "APPROVED",

                approvedBy: user.id,
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

          return approved;
        }
      );

    // =================================================
    // RESPONSE
    // =================================================

    return NextResponse.json({
      success: true,

      message:
        "Stock Opname berhasil disetujui dan stock outlet telah diperbarui",

      data: result,

      outlet: result.outlet,
    });
  } catch (error: any) {
    console.error(
      "APPROVE OUTLET STOCK OPNAME ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal menyetujui stock opname",
      },
      {
        status: 500,
      }
    );
  }
}