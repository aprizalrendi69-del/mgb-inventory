"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Edit3,
  FileText,
  Info,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

/* =========================================================
 * TYPES
 * ========================================================= */

type UserRole = "ADMIN" | "MANAGER" | string;

type Outlet = {
  id: number;
  code?: string | null;
  name?: string | null;
  active?: boolean;
};

type Barang = {
  id: number;
  code?: string | null;
  barcode?: string | null;
  name: string;
  category?: string | null;
  brand?: string | null;
  unit?: string | null;
  baseUnit?: string | null;
  conversionRate?: number | null;
  active?: boolean;

  purchasePrice?: number | null;
  harga?: number | null;
  hargaBeli?: number | null;
  costPrice?: number | null;
  lastPurchasePrice?: number | null;
  hargaPokok?: number | null;
};

type OutletStock = {
  id: number;
  outletId: number;
  barangId: number;
  stock: number;
  minimumStock?: number;
  averageCost: number;

  outlet?: {
    id: number;
    code?: string | null;
    name?: string | null;
  } | null;

  barang?: Barang | null;
};

type RecipeItem = {
  id?: number;
  barangId: number;
  qty: number;
  unit?: string | null;

  /**
   * Maximum HPP per BASE UNIT.
   *
   * null = tidak ada batas.
   */
  maxPrice?: number | null;

  barang?: Barang | null;
};

type Recipe = {
  id: number;
  name: string;
  code?: string | null;
  active?: boolean;

  menuId?: number | null;

  outputQty?: number | null;
  outputUnit?: string | null;

  productCkId?: number | null;
  outputBarangId?: number | null;

  items?: RecipeItem[];
};

type Menu = {
  id: number;
  name: string;
  code?: string | null;
  description?: string | null;

  price?: number | null;
  sellingPrice?: number | null;

  active?: boolean;

  image?: string | null;
  category?: string | null;

  recipe?: Recipe | null;
  recipes?: Recipe[] | null;
};

type EditorItem = {
  tempId: string;
  barangId: number;
  qty: number;
  unit: string;

  /**
   * Maximum HPP per base unit.
   */
  maxPrice: number | null;
};

/* =========================================================
 * HELPERS
 * ========================================================= */

function money(
  value: number | null | undefined,
) {
  const n = Number(value ?? 0);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(
    Number.isFinite(n) ? n : 0,
  );
}

function numberFormat(
  value: number | null | undefined,
) {
  const n = Number(value ?? 0);

  return new Intl.NumberFormat(
    "id-ID",
    {
      maximumFractionDigits: 6,
    },
  ).format(
    Number.isFinite(n) ? n : 0,
  );
}

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getBaseUnit(
  barang?: Barang | null,
) {
  return (
    barang?.baseUnit ||
    barang?.unit ||
    "PCS"
  );
}

function getMainUnit(
  barang?: Barang | null,
) {
  return (
    barang?.unit ||
    barang?.baseUnit ||
    "PCS"
  );
}

function getConversionRate(
  barang?: Barang | null,
) {
  const rate = Number(
    barang?.conversionRate ?? 1,
  );

  return Number.isFinite(rate) &&
    rate > 0
    ? rate
    : 1;
}

/**
 * null = tidak ada batas.
 *
 * Nilai <= 0 juga dianggap null.
 */
function normalizeMaxPrice(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const n = Number(value);

  if (
    !Number.isFinite(n) ||
    n <= 0
  ) {
    return null;
  }

  return Math.round(
    (n + Number.EPSILON) * 100,
  ) / 100;
}

/**
 * Konversi qty ke base unit.
 *
 * Contoh:
 * BOX = 10 PCS
 *
 * 2 BOX -> 20 PCS
 */
function convertToBaseQty(
  qty: number,
  unit: string | null | undefined,
  barang?: Barang | null,
) {
  const safeQty = Number(qty ?? 0);

  if (!Number.isFinite(safeQty)) {
    return 0;
  }

  const mainUnit = normalize(
    getMainUnit(barang),
  );

  const inputUnit = normalize(unit);

  if (
    !inputUnit ||
    inputUnit === mainUnit
  ) {
    return (
      safeQty *
      getConversionRate(barang)
    );
  }

  return safeQty;
}

function makeTempId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function extractArray(
  payload: any,
): any[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (
    payload &&
    Array.isArray(payload.data)
  ) {
    return payload.data;
  }

  if (
    payload &&
    Array.isArray(payload.items)
  ) {
    return payload.items;
  }

  if (
    payload &&
    Array.isArray(payload.results)
  ) {
    return payload.results;
  }

  return [];
}

function normalizeBarang(
  raw: any,
): Barang {
  return {
    id: Number(raw.id),
    code:
      raw.code ??
      raw.kode ??
      null,
    barcode:
      raw.barcode ??
      null,
    name:
      raw.name ??
      raw.nama ??
      "Barang",
    category:
      raw.category ??
      raw.kategori ??
      null,
    brand:
      raw.brand ??
      raw.merk ??
      null,
    unit:
      raw.unit ??
      raw.satuan ??
      null,
    baseUnit:
      raw.baseUnit ??
      raw.base_unit ??
      raw.satuanDasar ??
      null,
    conversionRate:
      raw.conversionRate ??
      raw.conversion_rate ??
      1,
    active:
      raw.active !== false,

    purchasePrice:
      raw.purchasePrice ??
      raw.hargaBeli ??
      raw.hargaPokok ??
      null,

    harga:
      raw.harga ??
      null,

    hargaBeli:
      raw.hargaBeli ??
      null,

    costPrice:
      raw.costPrice ??
      null,

    lastPurchasePrice:
      raw.lastPurchasePrice ??
      null,

    hargaPokok:
      raw.hargaPokok ??
      null,
  };
}

/* =========================================================
 * PAGE
 * ========================================================= */

export default function MenuPage() {
  const router = useRouter();

  /* =======================================================
   * AUTH
   * ======================================================= */

  const [user, setUser] =
    useState<any>(null);

  const [authLoading, setAuthLoading] =
    useState(true);

  /* =======================================================
   * MASTER DATA
   * ======================================================= */

  const [menus, setMenus] =
    useState<Menu[]>([]);

  const [barangs, setBarangs] =
    useState<Barang[]>([]);

  const [outlets, setOutlets] =
    useState<Outlet[]>([]);

  const [
    selectedOutletId,
    setSelectedOutletId,
  ] = useState<number | null>(null);

  const [
    outletStocks,
    setOutletStocks,
  ] = useState<OutletStock[]>([]);

  /* =======================================================
   * UI
   * ======================================================= */

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  /* =======================================================
   * EDITOR
   * ======================================================= */

  const [
    selectedMenu,
    setSelectedMenu,
  ] = useState<Menu | null>(null);

  const [
    editorOpen,
    setEditorOpen,
  ] = useState(false);

  const [saving, setSaving] =
    useState(false);

  const [toast, setToast] =
    useState<{
      type: "success" | "error";
      message: string;
    } | null>(null);

  const [
    menuName,
    setMenuName,
  ] = useState("");

  const [
    menuCode,
    setMenuCode,
  ] = useState("");

  const [
    menuDescription,
    setMenuDescription,
  ] = useState("");

  const [
    menuPrice,
    setMenuPrice,
  ] = useState("");

  const [items, setItems] =
    useState<EditorItem[]>([]);

  const [
    materialSearch,
    setMaterialSearch,
  ] = useState("");

  /* =======================================================
   * MAPS
   * ======================================================= */

  const barangMap = useMemo(() => {
    return new Map(
      barangs.map((item) => [
        Number(item.id),
        item,
      ]),
    );
  }, [barangs]);

  const outletStockMap = useMemo(() => {
    const map = new Map<
      number,
      OutletStock
    >();

    for (const stock of outletStocks) {
      map.set(
        Number(stock.barangId),
        stock,
      );
    }

    return map;
  }, [outletStocks]);

  const selectedOutlet =
    outlets.find(
      (item) =>
        Number(item.id) ===
        Number(selectedOutletId),
    ) ?? null;

  /* =======================================================
   * HPP
   * ======================================================= */

  const getOutletStock =
    useCallback(
      (barangId: number) => {
        return outletStockMap.get(
          Number(barangId),
        );
      },
      [outletStockMap],
    );

  const getOutletAverageCost =
    useCallback(
      (barangId: number) => {
        const stock =
          getOutletStock(barangId);

        if (!stock) {
          return 0;
        }

        const cost = Number(
          stock.averageCost ?? 0,
        );

        return Number.isFinite(cost)
          ? cost
          : 0;
      },
      [getOutletStock],
    );

  /**
   * OutletStock.averageCost adalah
   * HPP per MAIN UNIT.
   *
   * Maka:
   *
   * base HPP =
   * averageCost / conversionRate
   *
   * Contoh:
   *
   * BOX = 10 PCS
   * averageCost = Rp100.000 / BOX
   *
   * HPP base = Rp10.000 / PCS
   */
  const getOutletBaseUnitCost =
    useCallback(
      (barangId: number) => {
        const barang =
          barangMap.get(
            Number(barangId),
          );

        if (!barang) {
          return 0;
        }

        const averageCost =
          getOutletAverageCost(
            barangId,
          );

        const rate =
          getConversionRate(barang);

        if (
          !Number.isFinite(
            averageCost,
          ) ||
          averageCost <= 0
        ) {
          return 0;
        }

        return averageCost / rate;
      },
      [
        barangMap,
        getOutletAverageCost,
      ],
    );

  /* =======================================================
   * TOAST
   * ======================================================= */

  const showToast = useCallback(
    (
      type:
        | "success"
        | "error",
      message: string,
    ) => {
      setToast({
        type,
        message,
      });

      window.setTimeout(() => {
        setToast(null);
      }, 3500);
    },
    [],
  );

  /* =======================================================
   * LOAD OUTLET STOCK
   * ======================================================= */

  const loadOutletStock =
    useCallback(
      async (
        outletId: number,
      ) => {
        try {
          const response =
            await fetch(
              `/api/outlet/stock?outletId=${outletId}`,
              {
                cache: "no-store",
              },
            );

          if (!response.ok) {
            throw new Error(
              "Gagal mengambil stock outlet",
            );
          }

          const json =
            await response.json();

          const rows =
            extractArray(json);

          setOutletStocks(
            rows.map(
              (row: any) => ({
                id: Number(row.id),
                outletId:
                  Number(
                    row.outletId ??
                      outletId,
                  ),
                barangId:
                  Number(
                    row.barangId ??
                      row.barang?.id,
                  ),
                stock:
                  Number(
                    row.stock ?? 0,
                  ),
                minimumStock:
                  Number(
                    row.minimumStock ??
                      0,
                  ),
                averageCost:
                  Number(
                    row.averageCost ??
                      0,
                  ),
                outlet:
                  row.outlet ??
                  null,
                barang:
                  row.barang
                    ? normalizeBarang(
                        row.barang,
                      )
                    : undefined,
              }),
            ),
          );
        } catch (err: any) {
          console.error(
            "LOAD OUTLET STOCK:",
            err,
          );

          setOutletStocks([]);

          showToast(
            "error",
            err?.message ||
              "Gagal memuat stock outlet",
          );
        }
      },
      [showToast],
    );

  /* =======================================================
   * AUTH CHECK
   * ======================================================= */

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      try {
        const response =
          await fetch("/api/me", {
            cache: "no-store",
          });

        if (!response.ok) {
          router.replace("/login");
          return;
        }

        const json =
          await response.json();

        const currentUser =
          json?.user ??
          json?.data ??
          json;

        if (!mounted) {
          return;
        }

        setUser(currentUser);

        const role =
          currentUser?.role;

        if (
          role !== "ADMIN" &&
          role !== "MANAGER"
        ) {
          router.replace("/");
          return;
        }
      } catch {
        router.replace("/login");
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    }

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [router]);

  /* =======================================================
   * LOAD MASTER
   * ======================================================= */

  const load = useCallback(
    async (
      showRefresh = false,
    ) => {
      try {
        setError("");

        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const [
          menuResponse,
          barangResponse,
          outletResponse,
        ] = await Promise.all([
          fetch("/api/menu", {
            cache: "no-store",
          }),

          fetch("/api/master/barang", {
            cache: "no-store",
          }),

          fetch("/api/outlet", {
            cache: "no-store",
          }),
        ]);

        if (
          !menuResponse.ok
        ) {
          throw new Error(
            "Gagal mengambil data menu",
          );
        }

        if (
          !barangResponse.ok
        ) {
          throw new Error(
            "Gagal mengambil master barang",
          );
        }

        if (
          !outletResponse.ok
        ) {
          throw new Error(
            "Gagal mengambil outlet",
          );
        }

        const [
          menuJson,
          barangJson,
          outletJson,
        ] = await Promise.all([
          menuResponse.json(),
          barangResponse.json(),
          outletResponse.json(),
        ]);

        const menuRows =
          extractArray(menuJson);

        const barangRows =
          extractArray(
            barangJson,
          );

        const outletRows =
          extractArray(
            outletJson,
          );

        setMenus(
          menuRows.map(
            (menu: any) => ({
              ...menu,
              id: Number(menu.id),

              recipe:
                menu.recipe ??
                null,

              recipes:
                menu.recipes ??
                null,
            }),
          ),
        );

        setBarangs(
          barangRows
            .map(normalizeBarang)
            .filter(
              (item) =>
                Number.isFinite(
                  item.id,
                ) &&
                item.id > 0,
            ),
        );

        const normalizedOutlets =
          outletRows
            .map(
              (item: any) => ({
                id: Number(item.id),
                code:
                  item.code ??
                  null,
                name:
                  item.name ??
                  "Outlet",
                active:
                  item.active !==
                  false,
              }),
            )
            .filter(
              (item: Outlet) =>
                item.active !== false,
            );

        setOutlets(
          normalizedOutlets,
        );

        setSelectedOutletId(
          (current) => {
            if (
              current &&
              normalizedOutlets.some(
                (outlet) =>
                  Number(
                    outlet.id,
                  ) ===
                  Number(current),
              )
            ) {
              return current;
            }

            return (
              normalizedOutlets[0]
                ?.id ?? null
            );
          },
        );
      } catch (err: any) {
        console.error(
          "LOAD MENU PAGE:",
          err,
        );

        setError(
          err?.message ||
            "Gagal memuat data",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (
      authLoading ||
      !user
    ) {
      return;
    }

    load();
  }, [
    authLoading,
    user,
    load,
  ]);

  /* =======================================================
   * LOAD STOCK WHEN OUTLET CHANGES
   * ======================================================= */

  useEffect(() => {
    if (
      authLoading ||
      !user ||
      !selectedOutletId
    ) {
      return;
    }

    loadOutletStock(
      selectedOutletId,
    );
  }, [
    authLoading,
    user,
    selectedOutletId,
    loadOutletStock,
  ]);

  /* =======================================================
   * FILTER MENU
   * ======================================================= */

  const filteredMenus =
    useMemo(() => {
      const q =
        normalize(search);

      if (!q) {
        return menus;
      }

      return menus.filter(
        (menu) => {
          const recipe =
            menu.recipe ??
            menu.recipes?.[0] ??
            null;

          return (
            normalize(
              menu.name,
            ).includes(q) ||
            normalize(
              menu.code,
            ).includes(q) ||
            normalize(
              recipe?.name,
            ).includes(q) ||
            normalize(
              recipe?.code,
            ).includes(q)
          );
        },
      );
    }, [
      menus,
      search,
    ]);

  /* =======================================================
   * GLOBAL STATS
   * ======================================================= */

  const globalStats =
    useMemo(() => {
      let bomCount = 0;
      let ingredientCount = 0;
      let exceeded = 0;

      for (const menu of menus) {
        const recipe =
          menu.recipe ??
          menu.recipes?.[0] ??
          null;

        if (!recipe) {
          continue;
        }

        bomCount += 1;

        for (
          const item of
            recipe.items ??
            []
        ) {
          ingredientCount += 1;

          const baseCost =
            getOutletBaseUnitCost(
              Number(
                item.barangId,
              ),
            );

          const maxPrice =
            normalizeMaxPrice(
              item.maxPrice,
            );

          if (
            maxPrice !== null &&
            baseCost > maxPrice
          ) {
            exceeded += 1;
          }
        }
      }

      return {
        menuCount: menus.length,
        bomCount,
        ingredientCount,
        exceeded,
      };
    }, [
      menus,
      getOutletBaseUnitCost,
    ]);

  /* =======================================================
   * SYNC EDITOR
   * ======================================================= */

  const syncEditor = useCallback(
    (menu: Menu) => {
      setSelectedMenu(menu);

      setMenuName(
        menu.name ?? "",
      );

      setMenuCode(
        menu.code ?? "",
      );

      setMenuDescription(
        menu.description ?? "",
      );

      setMenuPrice(
        String(
          menu.price ??
            menu.sellingPrice ??
            "",
        ),
      );

      const recipe =
        menu.recipe ??
        menu.recipes?.[0] ??
        null;

      const recipeItems =
        recipe?.items ?? [];

      setItems(
        recipeItems.map(
          (
            item,
            index,
          ) => {
            const barang =
              barangMap.get(
                Number(
                  item.barangId,
                ),
              ) ??
              item.barang ??
              null;

            const baseQty =
              convertToBaseQty(
                Number(
                  item.qty ?? 0,
                ),
                item.unit,
                barang,
              );

            return {
              tempId: String(
                item.id ??
                  `${item.barangId}-${index}`,
              ),

              barangId:
                Number(
                  item.barangId,
                ),

              qty: baseQty,

              unit:
                getBaseUnit(
                  barang,
                ),

              /**
               * PENTING:
               *
               * maxPrice diambil dari
               * RecipeItem yang tersimpan.
               */
              maxPrice:
                normalizeMaxPrice(
                  item.maxPrice,
                ),
            };
          },
        ),
      );

      setMaterialSearch("");
      setEditorOpen(true);
    },
    [barangMap],
  );

  /* =======================================================
   * OPEN EDITOR
   * ======================================================= */

  const openEditor = useCallback(
    (menu: Menu) => {
      syncEditor(menu);
    },
    [syncEditor],
  );

  /* =======================================================
   * NEW MENU
   * ======================================================= */

  const openNewMenu =
    useCallback(() => {
      setSelectedMenu(null);

      setMenuName("");
      setMenuCode("");
      setMenuDescription("");
      setMenuPrice("");

      setItems([]);

      setMaterialSearch("");

      setEditorOpen(true);
    }, []);

  /* =======================================================
   * CLOSE EDITOR
   * ======================================================= */

  const closeEditor =
    useCallback(() => {
      if (saving) {
        return;
      }

      setEditorOpen(false);
      setSelectedMenu(null);
      setItems([]);
      setMaterialSearch("");
    }, [saving]);

  /* =======================================================
   * ADD MATERIAL
   * ======================================================= */

  const addMaterial = useCallback(
    (barangId: number) => {
      const id = Number(
        barangId,
      );

      if (!id) {
        return;
      }

      if (
        items.some(
          (item) =>
            Number(
              item.barangId,
            ) === id,
        )
      ) {
        showToast(
          "error",
          "Bahan tersebut sudah ada di BOM",
        );

        return;
      }

      const barang =
        barangMap.get(id);

      setItems(
        (prev) => [
          ...prev,
          {
            tempId:
              makeTempId(),

            barangId: id,

            qty: 1,

            unit:
              getBaseUnit(
                barang,
              ),

            /**
             * DEFAULT:
             * tidak ada batas HPP.
             */
            maxPrice: null,
          },
        ],
      );

      setMaterialSearch("");
    },
    [
      items,
      barangMap,
      showToast,
    ],
  );

  /* =======================================================
   * UPDATE QTY
   * ======================================================= */

  const updateItemQty =
    useCallback(
      (
        tempId: string,
        value: string,
      ) => {
        const qty =
          Number(value);

        setItems(
          (prev) =>
            prev.map(
              (item) =>
                item.tempId ===
                tempId
                  ? {
                      ...item,
                      qty:
                        Number.isFinite(
                          qty,
                        ) &&
                        qty >= 0
                          ? qty
                          : 0,
                    }
                  : item,
            ),
        );
      },
      [],
    );

  /* =======================================================
   * UPDATE MAX PRICE
   * ======================================================= */

  const updateItemMaxPrice =
    useCallback(
      (
        tempId: string,
        value: string,
      ) => {
        /**
         * Input kosong = null
         * = tidak ada batas.
         */
        const maxPrice =
          normalizeMaxPrice(
            value,
          );

        setItems(
          (prev) =>
            prev.map(
              (item) =>
                item.tempId ===
                tempId
                  ? {
                      ...item,
                      maxPrice,
                    }
                  : item,
            ),
        );
      },
      [],
    );

  /* =======================================================
   * REMOVE ITEM
   * ======================================================= */

  const removeItem =
    useCallback(
      (tempId: string) => {
        setItems(
          (prev) =>
            prev.filter(
              (item) =>
                item.tempId !==
                tempId,
            ),
        );
      },
      [],
    );

  /* =======================================================
   * MATERIAL OPTIONS
   * ======================================================= */

  const materialOptions =
    useMemo(() => {
      const q =
        normalize(
          materialSearch,
        );

      const existing =
        new Set(
          items.map(
            (item) =>
              Number(
                item.barangId,
              ),
          ),
        );

      return barangs
        .filter(
          (barang) =>
            barang.active !==
              false &&
            !existing.has(
              Number(
                barang.id,
              ),
            ),
        )
        .filter(
          (barang) => {
            if (!q) {
              return true;
            }

            return (
              normalize(
                barang.name,
              ).includes(q) ||
              normalize(
                barang.code,
              ).includes(q) ||
              normalize(
                barang.barcode,
              ).includes(q)
            );
          },
        )
        .slice(0, 30);
    }, [
      barangs,
      items,
      materialSearch,
    ]);

  /* =======================================================
   * BOM STATS
   * ======================================================= */

  const bomStats =
    useMemo(() => {
      let estimatedCost = 0;
      let missingStockCount = 0;
      let zeroCostCount = 0;
      let maxPriceExceededCount = 0;

      for (
        const item of items
      ) {
        const barang =
          barangMap.get(
            Number(
              item.barangId,
            ),
          );

        if (!barang) {
          continue;
        }

        const qty =
          Number(
            item.qty ?? 0,
          );

        const baseCost =
          getOutletBaseUnitCost(
            Number(
              item.barangId,
            ),
          );

        const stock =
          getOutletStock(
            Number(
              item.barangId,
            ),
          );

        if (!stock) {
          missingStockCount += 1;
        }

        if (
          !Number.isFinite(
            baseCost,
          ) ||
          baseCost <= 0
        ) {
          zeroCostCount += 1;
        }

        estimatedCost +=
          qty * baseCost;

        const maxPrice =
          normalizeMaxPrice(
            item.maxPrice,
          );

        if (
          maxPrice !== null &&
          baseCost > maxPrice
        ) {
          maxPriceExceededCount +=
            1;
        }
      }

      return {
        estimatedCost,
        missingStockCount,
        zeroCostCount,
        maxPriceExceededCount,
      };
    }, [
      items,
      barangMap,
      getOutletStock,
      getOutletBaseUnitCost,
    ]);

  /* =======================================================
   * SAVE MENU
   * ======================================================= */

  const saveMenu =
    useCallback(
      async () => {
        try {
          const name =
          menuName.trim();

        if (!name) {
          showToast(
            "error",
            "Nama menu wajib diisi",
          );

          return;
        }

        if (!selectedOutletId) {
          showToast(
            "error",
            "Outlet wajib dipilih",
          );

          return;
        }

        const cleanItems =
          items
            .map((item) => {
              const barang =
                barangMap.get(
                  Number(
                    item.barangId,
                  ),
                );

              return {
                barangId:
                  Number(
                    item.barangId,
                  ),

                qty:
                  Number(
                    item.qty ?? 0,
                  ),

                unit:
                  item.unit ||
                  getBaseUnit(
                    barang,
                  ),

                /**
                 * INI YANG PENTING.
                 *
                 * Nilai Max HPP ikut
                 * dikirim ke API.
                 */
                maxPrice:
                  normalizeMaxPrice(
                    item.maxPrice,
                  ),
              };
            })
            .filter(
              (item) =>
                item.barangId >
                  0 &&
                item.qty > 0,
            );

        if (
          cleanItems.length === 0
        ) {
          showToast(
            "error",
            "Minimal satu bahan BOM harus diisi",
          );

          return;
        }

        const payload = {
          name,

          code:
            menuCode.trim() ||
            null,

          description:
            menuDescription.trim() ||
            null,

          price:
            Number(menuPrice) ||
            0,

          /**
           * Outlet tetap dikirim.
           */
          outletId:
            Number(
              selectedOutletId,
            ),

          /**
           * BOM + MAX HPP
           */
          items:
            cleanItems,
        };

        setSaving(true);

        const isEdit =
          Boolean(
            selectedMenu?.id,
          );

        const url = isEdit
          ? `/api/menu/${selectedMenu!.id}`
          : "/api/menu";

        const method = isEdit
          ? "PUT"
          : "POST";

        const response =
          await fetch(url, {
            method,

            headers: {
              "Content-Type":
                "application/json",
            },

            cache: "no-store",

            body: JSON.stringify(
              payload,
            ),
          });

        const json =
          await response
            .json()
            .catch(
              () => ({}),
            );

        if (
          !response.ok ||
          json?.success === false
        ) {
          throw new Error(
            json?.message ||
              json?.error ||
              "Gagal menyimpan menu",
          );
        }

        // =====================================================
        // SIMPAN BOM SECARA TERPISAH
        // =====================================================
        // /api/menu hanya menyimpan master Menu.
        // BOM + maxPrice disimpan permanen melalui
        // /api/menu-bom/[menuId].
        const savedMenuId = Number(
          json?.data?.id ??
            json?.menu?.id ??
            json?.result?.id ??
            json?.id ??
            selectedMenu?.id,
        );

        if (!Number.isFinite(savedMenuId) || savedMenuId <= 0) {
          throw new Error(
            "Menu berhasil disimpan, tetapi ID menu tidak ditemukan untuk menyimpan BOM.",
          );
        }

        const existingRecipe =
          selectedMenu?.recipe ??
          selectedMenu?.recipes?.[0] ??
          null;

        const bomResponse =
          await fetch(
            `/api/menu-bom/${savedMenuId}`,
            {
              method: "PUT",
              headers: {
                "Content-Type":
                  "application/json",
              },
              cache: "no-store",
              body: JSON.stringify({
                items: cleanItems,
                // Pertahankan metadata BOM yang sudah ada saat edit.
                outputQty:
                  Number(
                    existingRecipe?.outputQty ?? 1,
                  ) > 0
                    ? Number(
                        existingRecipe?.outputQty ?? 1,
                      )
                    : 1,
                notes:
                  (existingRecipe as any)?.notes ??
                  null,
              }),
            },
          );

        const bomJson =
          await bomResponse
            .json()
            .catch(
              () => ({}),
            );

        if (
          !bomResponse.ok ||
          bomJson?.success === false
        ) {
          throw new Error(
            bomJson?.message ||
              bomJson?.error ||
              "Menu tersimpan, tetapi BOM gagal disimpan.",
          );
        }

        showToast(
          "success",
          isEdit
            ? "Menu dan BOM berhasil diperbarui"
            : "Menu dan BOM berhasil dibuat",
        );

        setEditorOpen(false);

        setSelectedMenu(null);

        /**
         * Reload data dari database.
         *
         * Ini sekaligus memastikan
         * maxPrice benar-benar dibaca
         * kembali dari API.
         */
        await load(true);

        /**
         * Refresh stock juga.
         */
        await loadOutletStock(
          Number(
            selectedOutletId,
          ),
        );
      } catch (err: any) {
        console.error(
          "SAVE MENU ERROR:",
          err,
        );

        showToast(
          "error",
          err?.message ||
            "Gagal menyimpan menu",
        );
      } finally {
        setSaving(false);
      }
    },
    [
      menuName,
      selectedOutletId,
      items,
      barangMap,
      menuCode,
      menuDescription,
      menuPrice,
      selectedMenu,
      showToast,
      load,
      loadOutletStock,
    ],
  );

  /* =======================================================
   * DELETE MENU
   * ======================================================= */

  const deleteMenu =
    useCallback(
      async (
        menu: Menu,
      ) => {
        const confirmed =
          window.confirm(
            `Hapus menu "${menu.name}"?`,
          );

        if (!confirmed) {
          return;
        }

        try {
          const response =
            await fetch(
              `/api/menu/${menu.id}`,
              {
                method: "DELETE",
              },
            );

          const json =
            await response
              .json()
              .catch(
                () => ({}),
              );

          if (
            !response.ok ||
            json?.success === false
          ) {
            throw new Error(
              json?.message ||
                "Gagal menghapus menu",
            );
          }

          showToast(
            "success",
            "Menu berhasil dihapus",
          );

          await load(true);
        } catch (err: any) {
          console.error(
            "DELETE MENU ERROR:",
            err,
          );

          showToast(
            "error",
            err?.message ||
              "Gagal menghapus menu",
          );
        }
      },
      [
        load,
        showToast,
      ],
    );

  /* =======================================================
   * LOADING GUARD
   * ======================================================= */

  if (authLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-[#DDE9E4] bg-white px-6 py-5 shadow-sm">
          <Loader2
            className="animate-spin text-[#497F70]"
            size={20}
          />

          <span className="text-sm font-semibold text-[#18352D]">
            Memeriksa akses...
          </span>
        </div>
      </div>
    );
  }

  /* =======================================================
   * RENDER
   * ======================================================= */

  return (
    <div className="min-h-screen bg-[#F6F9F7] px-4 py-5 md:px-6 lg:px-8">
      {/* ===================================================
          TOAST
      =================================================== */}

      {toast && (
        <div
          className={`fixed right-5 top-5 z-[100] flex max-w-md items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl ${
            toast.type ===
            "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {toast.type ===
          "success" ? (
            <CheckCircle2
              size={19}
              className="mt-0.5 shrink-0"
            />
          ) : (
            <AlertTriangle
              size={19}
              className="mt-0.5 shrink-0"
            />
          )}

          <div className="text-sm font-semibold">
            {toast.message}
          </div>

          <button
            type="button"
            onClick={() =>
              setToast(null)
            }
            className="ml-auto"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#789087]">
            <Package size={14} />

            Master Menu
          </div>

          <h1 className="text-2xl font-black tracking-tight text-[#18352D] md:text-3xl">
            Menu & BOM
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#71847D]">
            Kelola menu, bahan BOM,
            HPP outlet, dan batas
            maksimum HPP per bahan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* OUTLET */}

          <div className="flex h-11 items-center gap-2 rounded-xl border border-[#D7E4DE] bg-white px-3 shadow-sm">
            <Building2
              size={17}
              className="text-[#497F70]"
            />

            <select
              value={
                selectedOutletId ??
                ""
              }
              onChange={(e) =>
                setSelectedOutletId(
                  Number(
                    e.target.value,
                  ),
                )
              }
              className="min-w-[160px] bg-transparent text-sm font-semibold text-[#29483A] outline-none"
            >
              {outlets.map(
                (outlet) => (
                  <option
                    key={outlet.id}
                    value={
                      outlet.id
                    }
                  >
                    {outlet.code
                      ? `${outlet.code} — `
                      : ""}
                    {outlet.name}
                  </option>
                ),
              )}
            </select>
          </div>

          {/* REFRESH */}

          <button
            type="button"
            onClick={() =>
              load(true)
            }
            disabled={
              refreshing
            }
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#D7E4DE] bg-white px-4 text-sm font-bold text-[#497F70] shadow-sm transition hover:bg-[#F3F8F5] disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh
          </button>

          {/* NEW */}

          <button
            type="button"
            onClick={
              openNewMenu
            }
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#497F70] px-4 text-sm font-bold text-white shadow-lg shadow-[#497F70]/15 transition hover:-translate-y-0.5 hover:bg-[#3D6D60]"
          >
            <Plus size={18} />

            Menu Baru
          </button>
        </div>
      </div>

      {/* ===================================================
          ERROR
      =================================================== */}

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          <AlertTriangle
            size={19}
            className="mt-0.5 shrink-0"
          />

          <div className="flex-1">
            <p className="font-bold">
              Gagal memuat data
            </p>

            <p className="mt-1">
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              load(true)
            }
            className="rounded-lg bg-white px-3 py-2 text-xs font-bold shadow-sm"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* ===================================================
          KPI
      =================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[22px] border border-[#DDE9E4] bg-white p-5 shadow-[0_8px_30px_rgba(24,53,45,0.04)]">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <FileText size={19} />
            </div>

            <BadgeCheck
              size={18}
              className="text-[#9DB4AA]"
            />
          </div>

          <p className="text-xs font-bold uppercase tracking-wider text-[#789087]">
            Total Menu
          </p>

          <p className="mt-1 text-2xl font-black text-[#18352D]">
            {globalStats.menuCount}
          </p>
        </div>

        <div className="rounded-[22px] border border-[#DDE9E4] bg-white p-5 shadow-[0_8px_30px_rgba(24,53,45,0.04)]">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF5F1] text-[#497F70]">
            <Package size={19} />
          </div>

          <p className="text-xs font-bold uppercase tracking-wider text-[#789087]">
            Total BOM
          </p>

          <p className="mt-1 text-2xl font-black text-[#18352D]">
            {globalStats.bomCount}
          </p>
        </div>

        <div className="rounded-[22px] border border-[#DDE9E4] bg-white p-5 shadow-[0_8px_30px_rgba(24,53,45,0.04)]">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF5F1] text-[#497F70]">
            <Clock3 size={19} />
          </div>

          <p className="text-xs font-bold uppercase tracking-wider text-[#789087]">
            Bahan BOM
          </p>

          <p className="mt-1 text-2xl font-black text-[#18352D]">
            {globalStats.ingredientCount}
          </p>
        </div>

        <div className="rounded-[22px] border border-[#F0D5D0] bg-white p-5 shadow-[0_8px_30px_rgba(24,53,45,0.04)]">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500">
            <AlertTriangle
              size={19}
            />
          </div>

          <p className="text-xs font-bold uppercase tracking-wider text-[#9C7771]">
            Melebihi Max HPP
          </p>

          <p className="mt-1 text-2xl font-black text-red-600">
            {globalStats.exceeded}
          </p>
        </div>
      </div>

      {/* ===================================================
          MAIN
      =================================================== */}

      <div className="overflow-hidden rounded-[26px] border border-[#DDE9E4] bg-white shadow-[0_8px_30px_rgba(24,53,45,0.045)]">
        {/* TOOLBAR */}

        <div className="flex flex-col gap-4 border-b border-[#E8EEEB] px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <h2 className="font-bold text-[#18352D]">
              Daftar Menu
            </h2>

            <p className="mt-1 text-xs text-[#82928C]">
              HPP dihitung berdasarkan
              stock outlet yang dipilih.
            </p>
          </div>

          <div className="relative w-full md:w-[340px]">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9AA9A3]"
            />

            <input
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value,
                )
              }
              placeholder="Cari menu, kode, atau BOM..."
              className="h-11 w-full rounded-xl border border-[#D7E4DE] bg-[#FAFCFB] pl-10 pr-4 text-sm outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
            />
          </div>
        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead>
              <tr className="border-b border-[#E8EEEB] bg-[#F8FBF9]">
                <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-wider text-[#71847D]">
                  Menu
                </th>

                <th className="px-4 py-4 text-left text-[11px] font-black uppercase tracking-wider text-[#71847D]">
                  BOM
                </th>

                <th className="px-4 py-4 text-center text-[11px] font-black uppercase tracking-wider text-[#71847D]">
                  Bahan
                </th>

                <th className="px-4 py-4 text-right text-[11px] font-black uppercase tracking-wider text-[#71847D]">
                  Harga Jual
                </th>

                <th className="px-4 py-4 text-center text-[11px] font-black uppercase tracking-wider text-[#71847D]">
                  Status HPP
                </th>

                <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-wider text-[#71847D]">
                  Aksi
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-16"
                  >
                    <div className="flex items-center justify-center gap-3 text-sm font-semibold text-[#71847D]">
                      <Loader2
                        size={20}
                        className="animate-spin text-[#497F70]"
                      />

                      Memuat menu...
                    </div>
                  </td>
                </tr>
              ) : filteredMenus.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-16 text-center"
                  >
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF5F1] text-[#789087]">
                      <Search size={24} />
                    </div>

                    <p className="mt-4 text-sm font-bold text-[#18352D]">
                      Menu tidak ditemukan
                    </p>

                    <p className="mt-1 text-xs text-[#82928C]">
                      Coba ubah kata pencarian.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredMenus.map(
                  (menu) => {
                    const recipe =
                      menu.recipe ??
                      menu.recipes?.[0] ??
                      null;

                    const recipeItems =
                      recipe?.items ??
                      [];

                    let exceeded =
                      0;

                    for (
                      const item of recipeItems
                    ) {
                      const cost =
                        getOutletBaseUnitCost(
                          Number(
                            item.barangId,
                          ),
                        );

                      const max =
                        normalizeMaxPrice(
                          item.maxPrice,
                        );

                      if (
                        max !== null &&
                        cost > max
                      ) {
                        exceeded += 1;
                      }
                    }

                    return (
                      <tr
                        key={menu.id}
                        className="border-b border-[#EEF2F0] transition hover:bg-[#FBFDFC]"
                      >
                        <td className="px-6 py-5">
                          <div>
                            <p className="font-bold text-[#18352D]">
                              {menu.name}
                            </p>

                            <div className="mt-1 flex items-center gap-2">
                              {menu.code && (
                                <span className="rounded-md bg-[#F1F5F3] px-2 py-1 text-[10px] font-bold text-[#71847D]">
                                  {menu.code}
                                </span>
                              )}

                              {menu.active ===
                                false ? (
                                <span className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600">
                                  Nonaktif
                                </span>
                              ) : (
                                <span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                                  Aktif
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-5">
                          {recipe ? (
                            <div>
                              <p className="text-sm font-semibold text-[#29483A]">
                                {recipe.name}
                              </p>

                              {recipe.code && (
                                <p className="mt-1 text-[11px] text-[#8A9993]">
                                  {recipe.code}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-[#A0AAA6]">
                              Belum ada BOM
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-5 text-center">
                          <span className="inline-flex min-w-8 items-center justify-center rounded-lg bg-[#F1F5F3] px-2.5 py-1.5 text-xs font-bold text-[#497F70]">
                            {recipeItems.length}
                          </span>
                        </td>

                        <td className="px-4 py-5 text-right">
                          <span className="text-sm font-bold text-[#29483A]">
                            {money(
                              menu.price ??
                                menu.sellingPrice ??
                                0,
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-5 text-center">
                          {exceeded >
                          0 ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600">
                              <AlertTriangle
                                size={13}
                              />

                              {exceeded} bahan
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700">
                              <CheckCircle2
                                size={13}
                              />

                              Aman
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                openEditor(
                                  menu,
                                )
                              }
                              className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#D7E4DE] bg-white px-3 text-xs font-bold text-[#497F70] transition hover:border-[#AFC9BD] hover:bg-[#F3F8F5]"
                            >
                              <Edit3
                                size={15}
                              />

                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                deleteMenu(
                                  menu,
                                )
                              }
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500 transition hover:bg-red-100"
                              title="Hapus menu"
                            >
                              <Trash2
                                size={15}
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  },
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================================================
          EDITOR MODAL
      =================================================== */}

      {editorOpen && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#12251F]/45 p-0 backdrop-blur-sm md:items-center md:p-6">
          <div className="flex max-h-[94vh] w-full max-w-[1280px] flex-col overflow-hidden rounded-t-[30px] bg-[#F7FAF8] shadow-2xl md:rounded-[30px]">
            {/* MODAL HEADER */}

            <div className="flex shrink-0 items-center justify-between border-b border-[#E2EBE6] bg-white px-5 py-4 md:px-7">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={
                    closeEditor
                  }
                  disabled={saving}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DDE8E3] bg-white text-[#607A70] transition hover:bg-[#F2F7F4] disabled:opacity-50"
                >
                  <ArrowLeft
                    size={18}
                  />
                </button>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7D9189]">
                    {selectedMenu
                      ? "Edit Menu"
                      : "Menu Baru"}
                  </p>

                  <h2 className="text-lg font-black text-[#18352D]">
                    {selectedMenu
                      ? selectedMenu.name
                      : "Buat Menu"}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={
                  closeEditor
                }
                disabled={saving}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F2F6F4] text-[#607A70] transition hover:bg-[#E8F0EC] disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* MODAL BODY */}

            <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
              <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
                {/* LEFT */}

                <div className="space-y-5">
                  <section className="rounded-[24px] border border-[#DDE9E4] bg-white p-5 shadow-sm">
                    <div className="mb-5">
                      <p className="text-xs font-black uppercase tracking-wider text-[#71847D]">
                        Informasi Menu
                      </p>

                      <p className="mt-1 text-xs text-[#8A9993]">
                        Data dasar menu dan harga
                        jual.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* NAME */}

                      <div>
                        <label className="mb-2 block text-xs font-bold text-[#526B61]">
                          Nama Menu
                        </label>

                        <input
                          value={
                            menuName
                          }
                          onChange={(
                            e,
                          ) =>
                            setMenuName(
                              e.target
                                .value,
                            )
                          }
                          placeholder="Contoh: Chicken Katsu"
                          className="h-11 w-full rounded-xl border border-[#D7E4DE] bg-[#FAFCFB] px-3.5 text-sm font-semibold outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                        />
                      </div>

                      {/* CODE */}

                      <div>
                        <label className="mb-2 block text-xs font-bold text-[#526B61]">
                          Kode Menu
                        </label>

                        <input
                          value={
                            menuCode
                          }
                          onChange={(
                            e,
                          ) =>
                            setMenuCode(
                              e.target
                                .value,
                            )
                          }
                          placeholder="Opsional"
                          className="h-11 w-full rounded-xl border border-[#D7E4DE] bg-[#FAFCFB] px-3.5 text-sm font-semibold outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                        />
                      </div>

                      {/* PRICE */}

                      <div>
                        <label className="mb-2 block text-xs font-bold text-[#526B61]">
                          Harga Jual
                        </label>

                        <input
                          type="number"
                          min="0"
                          value={
                            menuPrice
                          }
                          onChange={(
                            e,
                          ) =>
                            setMenuPrice(
                              e.target
                                .value,
                            )
                          }
                          placeholder="0"
                          className="h-11 w-full rounded-xl border border-[#D7E4DE] bg-[#FAFCFB] px-3.5 text-right text-sm font-semibold outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                        />
                      </div>

                      {/* DESCRIPTION */}

                      <div>
                        <label className="mb-2 block text-xs font-bold text-[#526B61]">
                          Deskripsi
                        </label>

                        <textarea
                          value={
                            menuDescription
                          }
                          onChange={(
                            e,
                          ) =>
                            setMenuDescription(
                              e.target
                                .value,
                            )
                          }
                          rows={4}
                          placeholder="Deskripsi menu..."
                          className="w-full resize-none rounded-xl border border-[#D7E4DE] bg-[#FAFCFB] px-3.5 py-3 text-sm font-medium outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                        />
                      </div>
                    </div>
                  </section>

                  {/* OUTLET */}

                  <section className="rounded-[24px] border border-[#DDE9E4] bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                        <Building2
                          size={18}
                        />
                      </div>

                      <div>
                        <p className="font-bold text-[#18352D]">
                          Outlet HPP
                        </p>

                        <p className="text-xs text-[#84948E]">
                          HPP aktual mengikuti
                          outlet ini.
                        </p>
                      </div>
                    </div>

                    <select
                      value={
                        selectedOutletId ??
                        ""
                      }
                      onChange={(e) =>
                        setSelectedOutletId(
                          Number(
                            e.target
                              .value,
                          ),
                        )
                      }
                      className="h-11 w-full rounded-xl border border-[#D7E4DE] bg-[#FAFCFB] px-3 text-sm font-bold text-[#29483A] outline-none focus:border-[#497F70]"
                    >
                      {outlets.map(
                        (
                          outlet,
                        ) => (
                          <option
                            key={
                              outlet.id
                            }
                            value={
                              outlet.id
                            }
                          >
                            {outlet.code
                              ? `${outlet.code} — `
                              : ""}
                            {
                              outlet.name
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </section>

                  {/* HPP SUMMARY */}

                  <section className="rounded-[24px] border border-[#DDE9E4] bg-[#F4F8F6] p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#497F70] shadow-sm">
                        <Info
                          size={18}
                        />
                      </div>

                      <div>
                        <p className="text-sm font-bold text-[#29483A]">
                          Cara hitung HPP
                        </p>

                        <p className="mt-1 text-xs leading-5 text-[#71847D]">
                          HPP Aktual diambil
                          dari{" "}
                          <strong>
                            OutletStock.averageCost
                          </strong>{" "}
                          lalu dikonversi ke
                          base unit.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl bg-white px-4 py-3 text-xs font-semibold text-[#607A70]">
                      Qty Base × HPP Aktual
                      Base = Subtotal HPP
                    </div>
                  </section>
                </div>

                {/* RIGHT */}

                <div className="min-w-0 space-y-5">
                  {/* BOM HEADER */}

                  <section className="overflow-hidden rounded-[24px] border border-[#DDE9E4] bg-white shadow-sm">
                    <div className="border-b border-[#E8EEEB] px-5 py-5 md:px-6">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-[#71847D]">
                            Bill of Material
                          </p>

                          <h3 className="mt-1 text-lg font-black text-[#18352D]">
                            Bahan Menu
                          </h3>

                          <p className="mt-1 text-xs text-[#82928C]">
                            Tentukan qty dan batas
                            maksimum HPP per
                            bahan.
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-xl bg-[#F3F7F5] px-3 py-2.5 text-center">
                            <p className="text-[9px] font-black uppercase tracking-wider text-[#80918A]">
                              Bahan
                            </p>

                            <p className="mt-0.5 text-lg font-black text-[#29483A]">
                              {
                                items.length
                              }
                            </p>
                          </div>

                          <div
                            className={`rounded-xl px-3 py-2.5 text-center ${
                              bomStats.maxPriceExceededCount >
                              0
                                ? "bg-red-50"
                                : "bg-emerald-50"
                            }`}
                          >
                            <p className="text-[9px] font-black uppercase tracking-wider text-[#80918A]">
                              Warning
                            </p>

                            <p
                              className={`mt-0.5 text-lg font-black ${
                                bomStats.maxPriceExceededCount >
                                0
                                  ? "text-red-600"
                                  : "text-emerald-700"
                              }`}
                            >
                              {
                                bomStats.maxPriceExceededCount
                              }
                            </p>
                          </div>

                          <div className="rounded-xl bg-[#F3F7F5] px-3 py-2.5 text-center">
                            <p className="text-[9px] font-black uppercase tracking-wider text-[#80918A]">
                              Est. HPP
                            </p>

                            <p className="mt-0.5 text-sm font-black text-[#29483A]">
                              {money(
                                bomStats.estimatedCost,
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ADD MATERIAL */}

                    <div className="border-b border-[#E8EEEB] bg-[#FAFCFB] p-5 md:p-6">
                      <div className="relative">
                        <Search
                          size={17}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9AA9A3]"
                        />

                        <input
                          value={
                            materialSearch
                          }
                          onChange={(
                            e,
                          ) =>
                            setMaterialSearch(
                              e.target
                                .value,
                            )
                          }
                          placeholder="Cari bahan untuk ditambahkan..."
                          className="h-12 w-full rounded-xl border border-[#D7E4DE] bg-white pl-10 pr-4 text-sm font-medium outline-none focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                        />

                        {materialSearch && (
                          <button
                            type="button"
                            onClick={() =>
                              setMaterialSearch(
                                "",
                              )
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#879790]"
                          >
                            <X
                              size={16}
                            />
                          </button>
                        )}
                      </div>

                      {materialSearch && (
                        <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-[#DDE9E4] bg-white shadow-lg">
                          {materialOptions.length ===
                          0 ? (
                            <div className="px-4 py-4 text-xs text-[#8A9993]">
                              Barang tidak
                              ditemukan.
                            </div>
                          ) : (
                            materialOptions.map(
                              (
                                barang,
                              ) => (
                                <button
                                  key={
                                    barang.id
                                  }
                                  type="button"
                                  onClick={() =>
                                    addMaterial(
                                      barang.id,
                                    )
                                  }
                                  className="flex w-full items-center justify-between border-b border-[#EFF3F1] px-4 py-3 text-left transition last:border-0 hover:bg-[#F4F8F6]"
                                >
                                  <div>
                                    <p className="text-sm font-bold text-[#29483A]">
                                      {
                                        barang.name
                                      }
                                    </p>

                                    <p className="mt-0.5 text-[11px] text-[#8A9993]">
                                      {barang.code ||
                                        "-"}{" "}
                                      •{" "}
                                      {
                                        getBaseUnit(
                                          barang,
                                        )
                                      }
                                    </p>
                                  </div>

                                  <Plus
                                    size={17}
                                    className="text-[#497F70]"
                                  />
                                </button>
                              ),
                            )
                          )}
                        </div>
                      )}
                    </div>

                    {/* BOM TABLE */}

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[950px]">
                        <thead>
                          <tr className="border-b border-[#E8EEEB] bg-[#F8FBF9]">
                            <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-wider text-[#71847D]">
                              Bahan
                            </th>

                            <th className="w-[130px] px-3 py-4 text-right text-[10px] font-black uppercase tracking-wider text-[#71847D]">
                              Qty Base
                            </th>

                            <th className="w-[120px] px-3 py-4 text-right text-[10px] font-black uppercase tracking-wider text-[#71847D]">
                              Stock
                            </th>

                            <th className="w-[150px] px-3 py-4 text-right text-[10px] font-black uppercase tracking-wider text-[#71847D]">
                              HPP Aktual
                            </th>

                            <th className="w-[170px] px-3 py-4 text-right text-[10px] font-black uppercase tracking-wider text-[#71847D]">
                              Max HPP
                            </th>

                            <th className="w-[150px] px-3 py-4 text-right text-[10px] font-black uppercase tracking-wider text-[#71847D]">
                              Subtotal
                            </th>

                            <th className="w-[60px] px-3 py-4" />
                          </tr>
                        </thead>

                        <tbody>
                          {items.length ===
                          0 ? (
                            <tr>
                              <td
                                colSpan={7}
                                className="px-6 py-16 text-center"
                              >
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF5F1] text-[#789087]">
                                  <Package
                                    size={24}
                                  />
                                </div>

                                <p className="mt-4 text-sm font-bold text-[#29483A]">
                                  Belum ada bahan
                                </p>

                                <p className="mt-1 text-xs text-[#8A9993]">
                                  Gunakan pencarian di
                                  atas untuk
                                  menambahkan bahan.
                                </p>
                              </td>
                            </tr>
                          ) : (
                            items.map(
                              (
                                item,
                              ) => {
                                const barang =
                                  barangMap.get(
                                    Number(
                                      item.barangId,
                                    ),
                                  );

                                const stock =
                                  getOutletStock(
                                    Number(
                                      item.barangId,
                                    ),
                                  );

                                const baseCost =
                                  getOutletBaseUnitCost(
                                    Number(
                                      item.barangId,
                                    ),
                                  );

                                const maxPrice =
                                  normalizeMaxPrice(
                                    item.maxPrice,
                                  );

                                const exceeded =
                                  maxPrice !==
                                    null &&
                                  baseCost >
                                    maxPrice;

                                const qty =
                                  Number(
                                    item.qty ??
                                      0,
                                  );

                                const subtotal =
                                  qty *
                                  baseCost;

                                return (
                                  <tr
                                    key={
                                      item.tempId
                                    }
                                    className={`border-b border-[#EEF2F0] transition ${
                                      exceeded
                                        ? "bg-red-50/40"
                                        : "hover:bg-[#FCFDFC]"
                                    }`}
                                  >
                                    {/* BARANG */}

                                    <td className="px-5 py-4">
                                      <div className="flex items-center gap-3">
                                        <div
                                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                            exceeded
                                              ? "bg-red-100 text-red-600"
                                              : "bg-[#EAF3EF] text-[#497F70]"
                                          }`}
                                        >
                                          <Package
                                            size={17}
                                          />
                                        </div>

                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-bold text-[#29483A]">
                                            {barang?.name ??
                                              "Barang tidak ditemukan"}
                                          </p>

                                          <p className="mt-0.5 text-[10px] text-[#8A9993]">
                                            {barang?.code ||
                                              "-"}{" "}
                                            • Base:{" "}
                                            {getBaseUnit(
                                              barang,
                                            )}
                                          </p>
                                        </div>
                                      </div>
                                    </td>

                                    {/* QTY */}

                                    <td className="px-3 py-4">
                                      <div className="flex items-center justify-end gap-2">
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.000001"
                                          value={
                                            item.qty
                                          }
                                          onChange={(
                                            e,
                                          ) =>
                                            updateItemQty(
                                              item.tempId,
                                              e
                                                .target
                                                .value,
                                            )
                                          }
                                          className="h-10 w-24 rounded-xl border border-[#D7E4DE] bg-white px-3 text-right text-sm font-bold text-[#29483A] outline-none focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                                        />

                                        <span className="w-10 text-[10px] font-bold text-[#8A9993]">
                                          {getBaseUnit(
                                            barang,
                                          )}
                                        </span>
                                      </div>
                                    </td>

                                    {/* STOCK */}

                                    <td className="px-3 py-4 text-right">
                                      {stock ? (
                                        <div>
                                          <p className="text-sm font-bold text-[#29483A]">
                                            {numberFormat(
                                              convertToBaseQty(
                                                Number(
                                                  stock.stock ??
                                                    0,
                                                ),
                                                barang?.unit,
                                                barang,
                                              ),
                                            )}
                                          </p>

                                          <p className="mt-0.5 text-[10px] text-[#8A9993]">
                                            {
                                              getBaseUnit(
                                                barang,
                                              )
                                            }
                                          </p>
                                        </div>
                                      ) : (
                                        <span className="inline-flex rounded-lg bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold text-amber-700">
                                          Belum ada
                                        </span>
                                      )}
                                    </td>

                                    {/* ACTUAL HPP */}

                                    <td className="px-3 py-4 text-right">
                                      {baseCost >
                                      0 ? (
                                        <div>
                                          <p
                                            className={`text-sm font-black ${
                                              exceeded
                                                ? "text-red-600"
                                                : "text-[#29483A]"
                                            }`}
                                          >
                                            {money(
                                              baseCost,
                                            )}
                                          </p>

                                          <p className="mt-0.5 text-[10px] text-[#8A9993]">
                                            /{" "}
                                            {
                                              getBaseUnit(
                                                barang,
                                              )
                                            }
                                          </p>
                                        </div>
                                      ) : (
                                        <span className="inline-flex rounded-lg bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold text-amber-700">
                                          HPP belum ada
                                        </span>
                                      )}
                                    </td>

                                    {/* MAX HPP */}

                                    <td className="px-3 py-4">
                                      <div className="flex items-center justify-end gap-2">
                                        <div className="relative">
                                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#8A9993]">
                                            Rp
                                          </span>

                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={
                                              item.maxPrice ??
                                              ""
                                            }
                                            onChange={(
                                              e,
                                            ) =>
                                              updateItemMaxPrice(
                                                item.tempId,
                                                e
                                                  .target
                                                  .value,
                                              )
                                            }
                                            placeholder="Tanpa batas"
                                            className={`h-10 w-[135px] rounded-xl border bg-white pl-9 pr-3 text-right text-sm font-bold outline-none transition ${
                                              exceeded
                                                ? "border-red-300 text-red-700 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                                : "border-[#D7E4DE] text-[#29483A] focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                                            }`}
                                          />
                                        </div>

                                        <span className="text-[10px] font-bold text-[#8A9993]">
                                          /{" "}
                                          {
                                            getBaseUnit(
                                              barang,
                                            )
                                          }
                                        </span>
                                      </div>

                                      {exceeded && (
                                        <p className="mt-1 text-right text-[10px] font-bold text-red-600">
                                          Melebihi{" "}
                                          {money(
                                            baseCost -
                                              Number(
                                                maxPrice ??
                                                  0,
                                              ),
                                          )}
                                        </p>
                                      )}
                                    </td>

                                    {/* SUBTOTAL */}

                                    <td className="px-3 py-4 text-right">
                                      <p className="text-sm font-black text-[#29483A]">
                                        {money(
                                          subtotal,
                                        )}
                                      </p>
                                    </td>

                                    {/* DELETE */}

                                    <td className="px-3 py-4">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeItem(
                                            item.tempId,
                                          )
                                        }
                                        disabled={
                                          saving
                                        }
                                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500 transition hover:bg-red-100 disabled:opacity-50"
                                        title="Hapus bahan"
                                      >
                                        <Trash2
                                          size={15}
                                        />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              },
                            )
                          )}
                        </tbody>

                        {items.length >
                          0 && (
                          <tfoot>
                            <tr className="bg-[#F7FAF8]">
                              <td
                                colSpan={5}
                                className="px-5 py-5 text-right text-xs font-black uppercase tracking-wider text-[#607A70]"
                              >
                                Estimasi Total HPP
                              </td>

                              <td className="px-3 py-5 text-right">
                                <span className="text-lg font-black text-[#18352D]">
                                  {money(
                                    bomStats.estimatedCost,
                                  )}
                                </span>
                              </td>

                              <td />
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </section>

                  {/* WARNING */}

                  {bomStats.maxPriceExceededCount >
                    0 && (
                    <section className="rounded-[22px] border border-red-200 bg-red-50 p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-red-600 shadow-sm">
                          <AlertTriangle
                            size={19}
                          />
                        </div>

                        <div>
                          <p className="text-sm font-black text-red-700">
                            HPP melebihi batas
                          </p>

                          <p className="mt-1 text-xs leading-5 text-red-600">
                            Ada{" "}
                            <strong>
                              {
                                bomStats.maxPriceExceededCount
                              }{" "}
                              bahan
                            </strong>{" "}
                            dengan HPP aktual
                            outlet lebih tinggi
                            daripada Max HPP yang
                            ditetapkan.
                          </p>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* MISSING HPP */}

                  {bomStats.missingStockCount >
                    0 && (
                    <section className="rounded-[22px] border border-amber-200 bg-amber-50 p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm">
                          <Info
                            size={19}
                          />
                        </div>

                        <div>
                          <p className="text-sm font-black text-amber-700">
                            Stock outlet belum tersedia
                          </p>

                          <p className="mt-1 text-xs leading-5 text-amber-700">
                            Ada{" "}
                            <strong>
                              {
                                bomStats.missingStockCount
                              }{" "}
                              bahan
                            </strong>{" "}
                            yang belum mempunyai
                            record stock pada outlet
                            ini.
                          </p>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* INFO */}

                  <div className="flex items-start gap-3 rounded-2xl border border-[#DDE9E4] bg-white px-4 py-4">
                    <Info
                      size={17}
                      className="mt-0.5 shrink-0 text-[#497F70]"
                    />

                    <p className="text-xs leading-5 text-[#71847D]">
                      <strong className="text-[#29483A]">
                        Max HPP
                      </strong>{" "}
                      disimpan per bahan BOM dan
                      berlaku sebagai batas HPP per
                      base unit. Kosong berarti{" "}
                      <strong>
                        tanpa batas
                      </strong>
                      . Nilai HPP aktual tidak
                      diubah oleh halaman ini.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* =================================================
                FOOTER
            ================================================= */}

            <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-[#E2EBE6] bg-white px-5 py-4 md:flex-row md:items-center md:justify-between md:px-7">
              <div className="text-xs text-[#84948E]">
                {selectedOutlet
                  ? `HPP outlet: ${selectedOutlet.name}`
                  : "Outlet belum dipilih"}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={
                    closeEditor
                  }
                  disabled={saving}
                  className="h-11 rounded-xl border border-[#D7E4DE] bg-white px-5 text-sm font-bold text-[#607A70] transition hover:bg-[#F4F8F6] disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={
                    saveMenu
                  }
                  disabled={saving}
                  className="inline-flex h-11 min-w-[150px] items-center justify-center gap-2 rounded-xl bg-[#497F70] px-5 text-sm font-bold text-white shadow-lg shadow-[#497F70]/15 transition hover:-translate-y-0.5 hover:bg-[#3D6D60] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />

                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <CheckCircle2
                        size={17}
                      />

                      Simpan Menu
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}