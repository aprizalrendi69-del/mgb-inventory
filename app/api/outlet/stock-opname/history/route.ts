import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// =====================================================
// GET HISTORY STOCK OPNAME OUTLET
//
// ADMIN
// -> semua outlet
// -> bisa filter outlet
//
// MANAGER
// -> semua outlet
// -> bisa filter outlet
//
// OUTLET_ADMIN
// -> hanya outlet sendiri
//
// READ ONLY
// =====================================================

export async function GET(
  req: NextRequest
) {
  try {
    // =================================================
    // SESSION
    // =================================================

    const cookieStore =
      await cookies();

    const session =
      cookieStore.get(
        "erp-session"
      );

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        {
          status: 401,
        }
      );
    }

    // =================================================
    // PARSE SESSION
    // =================================================

    let sessionData: any;

    try {
      sessionData =
        JSON.parse(
          session.value
        );
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Session tidak valid",
        },
        {
          status: 401,
        }
      );
    }

    const userId =
      Number(
        sessionData?.id ??
          sessionData?.user?.id ??
          0
      );

    if (
      !Number.isInteger(
        userId
      ) ||
      userId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Session tidak valid",
        },
        {
          status: 401,
        }
      );
    }

    // =================================================
    // USER
    // =================================================

    const user =
      await prisma.user.findUnique({
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
              active: true,
            },
          },
        },
      });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    if (!user.active) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User tidak aktif",
        },
        {
          status: 403,
        }
      );
    }

    const role =
      String(
        user.role
      ).toUpperCase();

    // =================================================
    // ROLE
    // =================================================

    if (
      role !== "ADMIN" &&
      role !== "MANAGER" &&
      role !== "OUTLET_ADMIN"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses history stock opname",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // QUERY
    // =================================================

    const { searchParams } =
      new URL(req.url);

    const outletIdParam =
      searchParams.get(
        "outletId"
      );

    const barangIdParam =
      searchParams.get(
        "barangId"
      );

    let outletId:
      | number
      | null = null;

    let barangId:
      | number
      | null = null;

    // =================================================
    // BARANG ID
    // =================================================

    if (
      barangIdParam !==
      null
    ) {
      const parsedBarangId =
        Number(
          barangIdParam
        );

      if (
        !Number.isInteger(
          parsedBarangId
        ) ||
        parsedBarangId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Barang ID tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      barangId =
        parsedBarangId;
    }

    // =================================================
    // OUTLET SCOPE
    // =================================================

    if (
      role ===
      "OUTLET_ADMIN"
    ) {
      if (
        !user.outletId ||
        !Number.isInteger(
          user.outletId
        ) ||
        user.outletId <= 0
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

      outletId =
        user.outletId;
    } else if (
      outletIdParam !==
      null
    ) {
      const parsedOutletId =
        Number(
          outletIdParam
        );

      if (
        !Number.isInteger(
          parsedOutletId
        ) ||
        parsedOutletId <= 0
      ) {
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

      outletId =
        parsedOutletId;
    }

    // =================================================
    // VALIDASI OUTLET
    // =================================================

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
              "Outlet sedang tidak aktif",
          },
          {
            status: 400,
          }
        );
      }
    }

    // =================================================
    // WHERE
    // =================================================

    const where: any = {};

    if (outletId !== null) {
      where.outletId =
        outletId;
    }

    if (barangId !== null) {
      where.items = {
        some: {
          barangId,
        },
      };
    }

    // =================================================
    // DATA
    // =================================================

    const opnames =
      await prisma.stockOpname.findMany({
        where,

        orderBy: [
          {
            date: "desc",
          },
          {
            id: "desc",
          },
        ],

        select: {
          id: true,
          code: true,
          outletId: true,
          date: true,
          status: true,
          createdAt: true,
          approvedBy: true,

          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },

          items: {
            where:
              barangId !== null
                ? {
                    barangId,
                  }
                : undefined,

            select: {
              id: true,
              barangId: true,
              systemQty: true,
              physicalQty: true,
              difference: true,
              note: true,

              barang: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  unit: true,
                  barcode: true,
                },
              },
            },
          },
        },
      });

    // =================================================
    // NORMALIZE
    // =================================================

    const data =
      opnames.map(
        (opname) => ({
          id: opname.id,

          code: opname.code,

          outletId:
            opname.outletId,

          date: opname.date,

          status:
            opname.status,

          createdAt:
            opname.createdAt,

          approvedBy:
            opname.approvedBy,

          outlet:
            opname.outlet,

          items:
            opname.items.map(
              (item) => ({
                id: item.id,

                barangId:
                  item.barangId,

                systemQty:
                  Number(
                    item.systemQty ??
                      0
                  ),

                physicalQty:
                  Number(
                    item.physicalQty ??
                      0
                  ),

                difference:
                  Number(
                    item.difference ??
                      0
                  ),

                note:
                  item.note ??
                  null,

                barang:
                  item.barang,
              })
            ),
        })
      );

    // =================================================
    // RESPONSE
    // =================================================

    return NextResponse.json({
      success: true,

      scope: {
        role,
        outletId,
        barangId,
      },

      user: {
        id: user.id,
        fullname:
          user.fullname,
        role,
        outletId:
          user.outletId,
      },

      data,

      meta: {
        totalOpname:
          data.length,

        totalItems:
          data.reduce(
            (
              total,
              opname
            ) =>
              total +
              opname.items
                .length,
            0
          ),

        readOnly: true,

        stockChanged:
          false,
      },
    });
  } catch (error: any) {
    console.error(
      "GET OUTLET STOCK OPNAME HISTORY ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil history stock opname outlet",
      },
      {
        status: 500,
      }
    );
  }
}