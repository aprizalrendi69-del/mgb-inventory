import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// =====================================================
// GET LOGIN USER
// =====================================================

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

  return user;
}

// =====================================================
// ROLE
// =====================================================

function isAdmin(user: {
  role: string;
}) {
  return (
    String(user.role).toUpperCase() ===
    "ADMIN"
  );
}

// =====================================================
// GET
// =====================================================

export async function GET() {
  try {
    const user = await getLoginUser();

    // -------------------------------------------------
    // FILTER OUTLET
    //
    // ADMIN PUSAT:
    //   melihat semua stock opname outlet
    //
    // ADMIN OUTLET:
    //   hanya melihat stock opname outlet sendiri
    // -------------------------------------------------

    const where: any = {
      outletId: {
        not: null,
      },
    };

    if (!isAdmin(user)) {
      if (!user.outletId) {
        throw new Error(
          "User tidak terhubung dengan outlet"
        );
      }

      where.outletId = user.outletId;
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
              barang: true,
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

      outlet: user.outlet || null,

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
// =====================================================

export async function POST(
  req: NextRequest
) {
  try {
    const user = await getLoginUser();

    const body = await req.json();

    const opnameId = Number(
      body?.opnameId
    );

    if (!opnameId || opnameId <= 0) {
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
              barang: true,
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
    // HARUS STOCK OPNAME OUTLET
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
    // ADMIN OUTLET HANYA BOLEH APPROVE OUTLET SENDIRI
    //
    // ADMIN PUSAT BOLEH APPROVE SEMUA OUTLET
    // =================================================

    if (!isAdmin(user)) {
      if (
        !user.outletId ||
        user.outletId !== opname.outletId
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Stock opname bukan milik outlet user",
          },
          {
            status: 403,
          }
        );
      }
    }

    // =================================================
    // STATUS
    // =================================================

    const status = String(
      opname.status
    ).toUpperCase();

    if (status === "APPROVED") {
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

    if (status !== "COUNTING") {
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
    // TRANSACTION
    // =================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // -------------------------------------------
          // CEK ULANG DATA
          // -------------------------------------------

          const currentOpname =
            await tx.stockOpname.findUnique({
              where: {
                id: opname.id,
              },

              include: {
                items: true,
              },
            });

          if (!currentOpname) {
            throw new Error(
              "Stock opname tidak ditemukan"
            );
          }

          // -------------------------------------------
          // CEK OUTLET
          // -------------------------------------------

          if (
            !currentOpname.outletId
          ) {
            throw new Error(
              "Stock opname tidak memiliki outlet"
            );
          }

          if (!isAdmin(user)) {
            if (
              !user.outletId ||
              user.outletId !==
                currentOpname.outletId
            ) {
              throw new Error(
                "Stock opname bukan milik outlet user"
              );
            }
          }

          // -------------------------------------------
          // CEK STATUS
          // -------------------------------------------

          if (
            String(
              currentOpname.status
            ).toUpperCase() !== "COUNTING"
          ) {
            throw new Error(
              "Stock opname sudah diproses"
            );
          }

          // -------------------------------------------
          // UPDATE OUTLET STOCK
          // -------------------------------------------

          for (
            const item of currentOpname.items
          ) {
            const physicalQty =
              Math.max(
                0,
                Number(
                  item.physicalQty || 0
                )
              );

            const outletStock =
              await tx.outletStock.findFirst(
                {
                  where: {
                    outletId:
                      currentOpname.outletId,

                    barangId:
                      item.barangId,
                  },
                }
              );

            if (outletStock) {
              await tx.outletStock.update({
                where: {
                  id: outletStock.id,
                },

                data: {
                  stock: physicalQty,
                },
              });
            } else {
              await tx.outletStock.create({
                data: {
                  outletId:
                    currentOpname.outletId,

                  barangId:
                    item.barangId,

                  stock: physicalQty,

                  minimumStock: 0,

                  averageCost: 0,
                },
              });
            }
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
                    barang: true,
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