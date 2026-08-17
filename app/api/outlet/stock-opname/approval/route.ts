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

  // =====================================================
  // ROLE
  // =====================================================

  if (
    role !== "ADMIN" &&
    role !== "MANAGER" &&
    role !== "OUTLET_ADMIN" &&
    role !== "ADMIN_OUTLET"
  ) {
    return {
      error:
        "Anda tidak memiliki akses approval stock opname outlet",
      status: 403,
    } as const;
  }

  // =====================================================
  // ADMIN OUTLET WAJIB PUNYA OUTLET
  // =====================================================

  const isOutletAdmin =
    role === "OUTLET_ADMIN" ||
    role === "ADMIN_OUTLET";

  if (
    isOutletAdmin &&
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
    isOutletAdmin,
  } as const;
}

// =====================================================
// GET APPROVAL STOCK OPNAME
//
// ADMIN
// -> semua outlet
// -> bisa filter outlet
// -> bisa filter tanggal
// -> mendapatkan daftar outlet
//
// MANAGER
// -> semua outlet
// -> bisa filter outlet
// -> bisa filter tanggal
//
// OUTLET_ADMIN / ADMIN_OUTLET
// -> hanya outlet sendiri
// =====================================================

export async function GET(
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

    const {
      user,
      role,
      isOutletAdmin,
    } = login;

    const { searchParams } =
      new URL(req.url);

    // =================================================
    // FILTER
    // =================================================

    const requestedOutletId = Number(
      searchParams.get("outletId") ?? 0
    );

    const dateFrom =
      searchParams.get("dateFrom")?.trim() ||
      "";

    const dateTo =
      searchParams.get("dateTo")?.trim() ||
      "";

    const where: any = {
      outletId: {
        not: null,
      },
    };

    // =================================================
    // OUTLET ADMIN
    // =================================================

    if (isOutletAdmin) {
      where.outletId = Number(
        user.outletId
      );
    }

    // =================================================
    // ADMIN / MANAGER
    // =================================================

    if (!isOutletAdmin) {
      if (
        Number.isInteger(
          requestedOutletId
        ) &&
        requestedOutletId > 0
      ) {
        where.outletId =
          requestedOutletId;
      }
    }

    // =================================================
    // FILTER TANGGAL
    //
    // dateFrom = awal hari
    // dateTo   = akhir hari
    // =================================================

    if (dateFrom || dateTo) {
      where.date = {};

      if (dateFrom) {
        const start = new Date(
          `${dateFrom}T00:00:00`
        );

        if (!Number.isNaN(start.getTime())) {
          where.date.gte = start;
        }
      }

      if (dateTo) {
        const end = new Date(
          `${dateTo}T23:59:59.999`
        );

        if (!Number.isNaN(end.getTime())) {
          where.date.lte = end;
        }
      }

      if (
        Object.keys(where.date).length ===
        0
      ) {
        delete where.date;
      }
    }

    // =================================================
    // DATA OPNAME
    // =================================================

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

    // =================================================
    // LIST OUTLET
    //
    // Hanya Admin Pusat / Manager.
    // Frontend akan menggunakan ini untuk dropdown.
    // =================================================

    let outlets: any[] = [];

    if (!isOutletAdmin) {
      outlets =
        await prisma.outlet.findMany({
          select: {
            id: true,
            code: true,
            name: true,
          },

          orderBy: {
            name: "asc",
          },
        });
    }

    return NextResponse.json({
      success: true,

      user: {
        id: user.id,
        fullname: user.fullname,
        role,
        outletId: user.outletId,
      },

      // Outlet user sendiri
      outlet:
        isOutletAdmin
          ? user.outlet || null
          : null,

      // Dropdown outlet
      outlets,

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
// COUNTING
//      ↓
// APPROVED
//      ↓
// UPDATE OutletStock
//
// TIDAK UPDATE Barang.stock PUSAT
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

    const {
      user,
      role,
      isOutletAdmin,
    } = login;

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
    // =================================================

    if (isOutletAdmin) {
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
    // STATUS
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

      if (barangIdSet.has(barangId)) {
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

          if (
            !currentOpname.outletId
          ) {
            throw new Error(
              "Stock opname tidak memiliki outlet"
            );
          }

          if (
            isOutletAdmin &&
            Number(user.outletId) !==
              Number(
                currentOpname.outletId
              )
          ) {
            throw new Error(
              "Stock opname bukan milik outlet user"
            );
          }

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

          if (
            !currentOpname.items ||
            currentOpname.items.length === 0
          ) {
            throw new Error(
              "Stock opname tidak memiliki barang"
            );
          }

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
              await tx.outletStock.findUnique({
                where: {
                  outletId_barangId: {
                    outletId:
                      Number(
                        currentOpname.outletId
                      ),
                    barangId,
                  },
                },
              });

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

            await tx.outletStock.update({
              where: {
                id: outletStock.id,
              },

              data: {
                stock: physicalQty,
              },
            });
          }

          return await tx.stockOpname.update({
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
        }
      );

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

// =====================================================
// DELETE STOCK OPNAME
//
// HANYA ADMIN PUSAT
//
// HANYA STATUS COUNTING
//
// DELETE TIDAK MENGUBAH STOCK OUTLET
// =====================================================

export async function DELETE(
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
    // HANYA ADMIN PUSAT
    // =================================================

    if (role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Hanya Admin Pusat yang dapat menghapus stock opname",
        },
        {
          status: 403,
        }
      );
    }

    const { searchParams } =
      new URL(req.url);

    const opnameId = Number(
      searchParams.get("opnameId") ?? 0
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
    // CEK OPNAME
    // =================================================

    const opname =
      await prisma.stockOpname.findUnique({
        where: {
          id: opnameId,
        },

        select: {
          id: true,
          code: true,
          status: true,
          outletId: true,
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
    // JANGAN HAPUS APPROVED
    // =================================================

    if (
      String(opname.status).toUpperCase() !==
      "COUNTING"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stock opname yang sudah diproses tidak dapat dihapus",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // DELETE
    //
    // Jika relasi StockOpnameItem sudah memakai
    // onDelete: Cascade, delete parent akan sekaligus
    // menghapus detail.
    // =================================================

    await prisma.stockOpname.delete({
      where: {
        id: opnameId,
      },
    });

    console.log(
      `STOCK OPNAME DELETED: ${opname.code} by user ${user.id}`
    );

    return NextResponse.json({
      success: true,
      message:
        `Stock Opname ${opname.code} berhasil dihapus`,
    });
  } catch (error: any) {
    console.error(
      "DELETE OUTLET STOCK OPNAME ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal menghapus stock opname",
      },
      {
        status: 500,
      }
    );
  }
}