import {
  NextRequest,
  NextResponse,
} from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canOperateOutlet,
  getOutletActor,
  resolveOutletId,
} from "@/lib/outlet-access";
import { normalizeBarangUnit } from "@/lib/base-unit";

const fail = (
  message: string,
  status = 400
) =>
  NextResponse.json(
    {
      success: false,
      message,
    },
    { status }
  );

export async function GET(
  req: NextRequest
) {
  try {
    const actor =
      await getOutletActor();

    if (
      !actor ||
      !canOperateOutlet(actor)
    ) {
      return fail(
        "Tidak memiliki akses POS.",
        403
      );
    }

    const outletId =
      resolveOutletId(
        actor,
        Number(
          req.nextUrl.searchParams.get(
            "outletId"
          ) || 0
        )
      );

    if (!outletId) {
      return fail(
        "Outlet belum dipilih."
      );
    }

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
      return fail(
        "Outlet tidak ditemukan.",
        404
      );
    }

    if (!outlet.active) {
      return fail(
        "Outlet sedang tidak aktif."
      );
    }

    const menus =
      await prisma.menu.findMany({
        where: {
          active: true,
        },
        include: {
          recipes: {
            where: {
              active: true,
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
                      baseUnit: true,
                      conversionRate: true,
                      active: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [
          {
            category: "asc",
          },
          {
            name: "asc",
          },
        ],
      });

    /**
     * Ambil semua barang yang dipakai BOM.
     */
    const barangIds = [
      ...new Set(
        menus.flatMap(
          (menu) =>
            menu.recipes[0]?.items.map(
              (item) =>
                item.barangId
            ) ?? []
        )
      ),
    ];

    const stocks =
      barangIds.length
        ? await prisma.outletStock.findMany({
            where: {
              outletId,
              barangId: {
                in: barangIds,
              },
            },
            select: {
              barangId: true,
              stock: true,
              averageCost: true,
              minimumStock: true,
            },
          })
        : [];

    const stockMap =
      new Map(
        stocks.map(
          (stock) => [
            stock.barangId,
            stock,
          ]
        )
      );

    const data =
      menus.map((menu) => {
        const recipe =
          menu.recipes[0];

        /**
         * Menu tanpa BOM tidak boleh
         * dijual dari POS.
         */
        if (
          !recipe ||
          !recipe.items.length
        ) {
          return {
            ...menu,
            menuId: menu.id,
            price: Number(
              menu.price || 0
            ),
            stock: 0,
            bomReady: false,
            canSell: false,
            maxQty: 0,
          };
        }

        /**
         * Tentukan jumlah maksimal menu
         * berdasarkan bahan yang paling cepat habis.
         */
        let maxQty =
          Number.POSITIVE_INFINITY;

        for (const item of recipe.items) {
          const barang =
            item.barang;

          if (!barang?.active) {
            maxQty = 0;
            break;
          }

          const units =
            normalizeBarangUnit(
              barang
            );

          const stock =
            Number(
              stockMap.get(
                item.barangId
              )?.stock || 0
            );

          /**
           * Stock OutletStock tersimpan
           * dalam unit utama Barang.
           */
          let qtyPerMenu =
            Number(
              item.qty || 0
            );

          const recipeUnit =
            String(
              item.unit ||
                units.baseUnit
            )
              .trim()
              .toLowerCase();

          const mainUnit =
            String(
              units.unit
            )
              .trim()
              .toLowerCase();

          const baseUnit =
            String(
              units.baseUnit
            )
              .trim()
              .toLowerCase();

          if (
            recipeUnit ===
            baseUnit
          ) {
            /**
             * Recipe sudah base unit.
             *
             * qty = base unit.
             */
          } else if (
            recipeUnit ===
            mainUnit
          ) {
            /**
             * Recipe menggunakan unit utama.
             *
             * Contoh:
             * 1 dus = 24 pcs
             */
            qtyPerMenu =
              qtyPerMenu *
              units.conversionRate;
          }

          if (
            qtyPerMenu <= 0
          ) {
            maxQty = 0;
            break;
          }

          const possible =
            stock /
            qtyPerMenu;

          maxQty =
            Math.min(
              maxQty,
              possible
            );
        }

        const calculatedMaxQty =
          Number.isFinite(
            maxQty
          )
            ? Math.max(
                0,
                Math.floor(
                  maxQty
                )
              )
            : 0;

        return {
          ...menu,
          menuId: menu.id,
          price: Number(
            menu.price || 0
          ),
          stock:
            calculatedMaxQty,
          maxQty:
            calculatedMaxQty,
          bomReady: true,
          canSell:
            calculatedMaxQty > 0,
        };
      });

    return NextResponse.json({
      success: true,
      data,
      outlet,
    });
  } catch (error: any) {
    console.error(
      "GET POS MENU ERROR",
      error
    );

    return fail(
      error?.message ||
        "Gagal mengambil menu POS.",
      500
    );
  }
}