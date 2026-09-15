"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Factory,
  Plus,
  RefreshCw,
  ClipboardList,
  CheckCircle2,
  X,
  Trash2,
  Search,
  Package,
  Boxes,
  ClipboardCheck,
  Store,
  Pencil,
  ChevronDown,
  SlidersHorizontal,
  PackageCheck,
  Clock3,
  AlertCircle,
  Layers3,
  Sparkles,
  ArrowUpRight,
  Hash,
  CalendarDays,
  CircleDot,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";

/* =========================================================
 * TYPES
 * ========================================================= */

type Outlet = {
  id: number;
  name: string;
  code?: string | null;
  active?: boolean;
};

type Barang = {
  id: number;
  code: string;
  name: string;
  unit: string;
  baseUnit?: string | null;
  conversionRate?: number;
  stock?: number;
};

type OutletStock = {
  id?: number;
  outletId: number;
  barangId: number;
  stock: number;
  minimumStock?: number;
  averageCost?: number;
  barang?: Barang;
};

type RecipeItem = {
  id: number;
  qty: number;
  unit?: string | null;
  itemType?: "STOCK" | "UTILITY";
  name?: string | null;
  barang?: Barang | null;
};

type Recipe = {
  id: number;
  code: string;
  name: string;
  outputQty: number;
  outputBarang: Barang;
  items: RecipeItem[];
};

type OrderItem = {
  plannedQty: number;
  actualQty: number;
  barang: Barang;
};

type Order = {
  id: number;
  number: string;
  plannedQty: number;
  producedQty: number;
  status: string;
  productionDate: string;
  outletId?: number | null;
  outlet?: Outlet | null;
  recipe: {
    name: string;
    outputBarang: Barang;
  };
  items: OrderItem[];
};

type RecipeForm = {
  code: string;
  name: string;
  outputBarangId: string;
  outputQty: string;
  notes: string;
};

type RecipeItemForm = {
  itemType: "STOCK" | "UTILITY";
  barangId: string;
  name: string;
  qty: string;
  unit: string;
};

type OrderForm = {
  recipeId: string;
  plannedQty: string;
  note: string;
};

type CurrentUser = {
  id: number;
  role?: string | null;
  outletId?: number | null;
  outlet?: Outlet | null;
};

/* =========================================================
 * HELPERS
 * ========================================================= */

function isCentralRole(role?: string | null) {
  const normalized = String(role ?? "")
    .trim()
    .toUpperCase();

  return normalized === "ADMIN" || normalized === "MANAGER";
}

function isOutletRole(role?: string | null) {
  const normalized = String(role ?? "")
    .trim()
    .toUpperCase();

  return (
    normalized === "OUTLET_ADMIN" ||
    normalized === "ADMIN_OUTLET"
  );
}

function normalizeStatus(status?: string | null) {
  return String(status ?? "")
    .trim()
    .toUpperCase();
}

function formatNumber(value: number | string | null | undefined) {
  const n = Number(value ?? 0);

  if (!Number.isFinite(n)) {
    return "0";
  }

  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 4,
  }).format(n);
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* =========================================================
 * PAGE
 * ========================================================= */

export default function ManufacturePage() {
  const [user, setUser] =
    useState<CurrentUser | null>(null);

  const [loadingUser, setLoadingUser] =
    useState(true);

  const [tab, setTab] =
    useState<"orders" | "recipes">("orders");

  const [recipes, setRecipes] =
    useState<Recipe[]>([]);

  const [orders, setOrders] =
    useState<Order[]>([]);

  const [barangs, setBarangs] =
    useState<Barang[]>([]);

  const [outlets, setOutlets] =
    useState<Outlet[]>([]);

  const [outletStocks, setOutletStocks] =
    useState<OutletStock[]>([]);

  const [selectedOutletId, setSelectedOutletId] =
    useState<string>("");

  const [loading, setLoading] =
    useState(false);

  const [loadingOutletStock, setLoadingOutletStock] =
    useState(false);

  const [showRecipe, setShowRecipe] =
    useState(false);

  const [showOrder, setShowOrder] =
    useState(false);

  const [savingRecipe, setSavingRecipe] =
    useState(false);

  const [savingOrder, setSavingOrder] =
    useState(false);

  const [editingRecipeId, setEditingRecipeId] =
    useState<number | null>(null);

  const [recipeSearch, setRecipeSearch] =
    useState("");

  const [orderSearch, setOrderSearch] =
    useState("");

  const [orderStatusFilter, setOrderStatusFilter] =
    useState("ALL");

  const [recipe, setRecipe] =
    useState<RecipeForm>({
      code: "",
      name: "",
      outputBarangId: "",
      outputQty: "1",
      notes: "",
    });

  const [recipeItems, setRecipeItems] =
    useState<RecipeItemForm[]>([
      {
        itemType: "STOCK",
        barangId: "",
        name: "",
        qty: "",
        unit: "",
      },
    ]);

  const [order, setOrder] =
    useState<OrderForm>({
      recipeId: "",
      plannedQty: "",
      note: "",
    });

  /* =========================================================
   * LOAD USER
   * ========================================================= */

  async function loadUser() {
    try {
      const res = await fetch("/api/me", {
        cache: "no-store",
      });

      const json = await res.json();

      const currentUser =
        json?.user ??
        json?.data ??
        json;

      if (res.ok && currentUser?.id) {
        const normalizedUser: CurrentUser = {
          id: Number(currentUser.id),
          role: currentUser.role ?? null,
          outletId:
            currentUser.outletId != null
              ? Number(currentUser.outletId)
              : currentUser.outlet?.id != null
              ? Number(currentUser.outlet.id)
              : null,
          outlet:
            currentUser.outlet ?? null,
        };

        setUser(normalizedUser);

        return normalizedUser;
      }
    } catch (error) {
      console.error(
        "LOAD USER ERROR:",
        error
      );
    } finally {
      setLoadingUser(false);
    }

    return null;
  }

  /* =========================================================
   * LOAD OUTLETS
   * ========================================================= */

  async function loadOutlets(
    currentUser?: CurrentUser | null
  ) {
    if (!isCentralRole(currentUser?.role)) {
      if (isOutletRole(currentUser?.role)) {
        const outletId =
          currentUser?.outletId;

        if (outletId != null) {
          setSelectedOutletId(
            String(outletId)
          );

          if (currentUser?.outlet) {
            setOutlets([
              currentUser.outlet,
            ]);
          }
        }
      }

      return;
    }

    try {
      const res = await fetch(
        "/api/outlet",
        {
          cache: "no-store",
        }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.message ||
            "Gagal mengambil outlet"
        );
      }

      const raw =
        data.data?.data ??
        data.data ??
        [];

      const list: Outlet[] =
        Array.isArray(raw)
          ? raw
              .map((x: any) => ({
                id: Number(x.id),
                name:
                  x.name ??
                  x.nama ??
                  `Outlet ${x.id}`,
                code:
                  x.code ??
                  x.kode ??
                  null,
                active:
                  x.active !== false,
              }))
              .filter(
                (x: Outlet) =>
                  Number.isInteger(
                    x.id
                  ) &&
                  x.id > 0 &&
                  x.active !== false
              )
          : [];

      setOutlets(list);

      setSelectedOutletId(
        (current) => {
          if (
            current &&
            list.some(
              (x) =>
                String(x.id) ===
                String(current)
            )
          ) {
            return current;
          }

          return list.length
            ? String(list[0].id)
            : "";
        }
      );
    } catch (error) {
      console.error(
        "LOAD OUTLETS ERROR:",
        error
      );

      toast.error(
        "Gagal memuat daftar outlet"
      );
    }
  }

  /* =========================================================
   * LOAD OUTLET STOCK
   * ========================================================= */

  async function loadOutletStock(
    outletId: string
  ) {
    if (!outletId) {
      setOutletStocks([]);
      return;
    }

    setLoadingOutletStock(true);

    try {
      const res = await fetch(
        `/api/outlet/stock?outletId=${encodeURIComponent(
          outletId
        )}`,
        {
          cache: "no-store",
        }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.message ||
            "Gagal mengambil stock outlet"
        );
      }

      const raw =
        data.data?.data ??
        data.data ??
        [];

      const list: OutletStock[] =
        Array.isArray(raw)
          ? raw
              .map((x: any) => ({
                id: x.id,
                outletId: Number(
                  x.outletId ??
                    outletId
                ),
                barangId: Number(
                  x.barangId ??
                    x.barang?.id
                ),
                stock: Number(
                  x.stock ?? 0
                ),
                minimumStock:
                  x.minimumStock != null
                    ? Number(
                        x.minimumStock
                      )
                    : undefined,
                averageCost:
                  x.averageCost != null
                    ? Number(
                        x.averageCost
                      )
                    : undefined,
                barang:
                  x.barang ??
                  undefined,
              }))
              .filter(
                (x: OutletStock) =>
                  Number.isInteger(
                    x.barangId
                  ) &&
                  x.barangId > 0
              )
          : [];

      setOutletStocks(list);
    } catch (error) {
      console.error(
        "LOAD OUTLET STOCK ERROR:",
        error
      );

      setOutletStocks([]);

      toast.error(
        "Gagal memuat stock outlet"
      );
    } finally {
      setLoadingOutletStock(false);
    }
  }

  /* =========================================================
   * LOAD MAIN DATA
   * ========================================================= */

  async function load() {
    setLoading(true);

    try {
      const [
        recipesRes,
        ordersRes,
        barangRes,
      ] = await Promise.all([
        fetch(
          "/api/manufacture/recipes",
          {
            cache: "no-store",
          }
        ).then((x) => x.json()),

        fetch(
          "/api/manufacture/orders",
          {
            cache: "no-store",
          }
        ).then((x) => x.json()),

        fetch(
          "/api/master/barang",
          {
            cache: "no-store",
          }
        )
          .then((x) => x.json())
          .catch(() => ({
            success: false,
          })),
      ]);

      if (recipesRes.success) {
        setRecipes(
          Array.isArray(
            recipesRes.data
          )
            ? recipesRes.data
            : []
        );
      }

      if (ordersRes.success) {
        setOrders(
          Array.isArray(
            ordersRes.data
          )
            ? ordersRes.data
            : []
        );
      }

      if (barangRes.success) {
        const raw =
          barangRes.data?.data ??
          barangRes.data ??
          [];

        setBarangs(
          Array.isArray(raw)
            ? raw
            : []
        );
      }
    } catch (error) {
      console.error(
        "LOAD MANUFACTURE ERROR:",
        error
      );

      toast.error(
        "Gagal memuat data manufacture"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
   * INITIAL LOAD
   * ========================================================= */

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const currentUser =
        await loadUser();

      if (cancelled) {
        return;
      }

      await Promise.all([
        loadOutlets(
          currentUser
        ),
        load(),
      ]);
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =========================================================
   * OUTLET CHANGE
   * ========================================================= */

  useEffect(() => {
    if (
      loadingUser ||
      !user
    ) {
      return;
    }

    if (selectedOutletId) {
      loadOutletStock(
        selectedOutletId
      );
    } else {
      setOutletStocks([]);
    }
  }, [
    selectedOutletId,
    loadingUser,
    user,
  ]);

  /* =========================================================
   * STOCK MAP
   * ========================================================= */

  const outletStockMap = useMemo(() => {
    const map = new Map<
      number,
      number
    >();

    for (const item of outletStocks) {
      map.set(
        Number(item.barangId),
        Number(item.stock ?? 0)
      );
    }

    return map;
  }, [outletStocks]);

  function getOutletStock(
    barangId: number
  ) {
    return Number(
      outletStockMap.get(
        Number(barangId)
      ) ?? 0
    );
  }

  /* =========================================================
   * COMPUTED DATA
   * ========================================================= */

  const outputOptions = useMemo(
    () =>
      barangs.filter(
        (b) => b.id
      ),
    [barangs]
  );

  const completedOrders =
    useMemo(
      () =>
        orders.filter(
          (x) =>
            normalizeStatus(
              x.status
            ) === "COMPLETED"
        ).length,
      [orders]
    );

  const pendingOrders =
    useMemo(
      () =>
        orders.filter(
          (x) =>
            ![
              "COMPLETED",
              "CANCELLED",
            ].includes(
              normalizeStatus(
                x.status
              )
            )
        ).length,
      [orders]
    );

  const cancelledOrders =
    useMemo(
      () =>
        orders.filter(
          (x) =>
            normalizeStatus(
              x.status
            ) === "CANCELLED"
        ).length,
      [orders]
    );

  const selectedOutlet =
    useMemo(
      () =>
        outlets.find(
          (x) =>
            String(x.id) ===
            String(
              selectedOutletId
            )
        ),
      [
        outlets,
        selectedOutletId,
      ]
    );

  const isCentralAdmin =
    isCentralRole(user?.role);

  const isOutletAdmin =
    isOutletRole(user?.role);

  const filteredOrders =
    useMemo(() => {
      const keyword =
        orderSearch
          .trim()
          .toLowerCase();

      return orders.filter(
        (item) => {
          const status =
            normalizeStatus(
              item.status
            );

          if (
            orderStatusFilter !==
              "ALL" &&
            status !==
              orderStatusFilter
          ) {
            return false;
          }

          if (!keyword) {
            return true;
          }

          return [
            item.number,
            item.recipe?.name,
            item.recipe
              ?.outputBarang
              ?.name,
            item.outlet?.name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(keyword);
        }
      );
    }, [
      orders,
      orderSearch,
      orderStatusFilter,
    ]);

  const filteredRecipes =
    useMemo(() => {
      const keyword =
        recipeSearch
          .trim()
          .toLowerCase();

      if (!keyword) {
        return recipes;
      }

      return recipes.filter(
        (item) =>
          [
            item.code,
            item.name,
            item.outputBarang
              ?.name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(keyword)
      );
    }, [
      recipes,
      recipeSearch,
    ]);

  /* =========================================================
   * RECIPE ITEMS
   * ========================================================= */

  function updateRecipeItem(
    index: number,
    patch: Partial<RecipeItemForm>
  ) {
    setRecipeItems(
      (prev) =>
        prev.map(
          (item, i) =>
            i === index
              ? {
                  ...item,
                  ...patch,
                }
              : item
        )
    );
  }

  function addRecipeItem() {
    setRecipeItems(
      (prev) => [
        ...prev,
        {
          itemType: "STOCK",
          barangId: "",
          name: "",
          qty: "",
          unit: "",
        },
      ]
    );
  }

  function removeRecipeItem(
    index: number
  ) {
    if (
      recipeItems.length === 1
    ) {
      return;
    }

    setRecipeItems(
      (prev) =>
        prev.filter(
          (_, i) =>
            i !== index
        )
    );
  }

  /* =========================================================
   * RESET RECIPE
   * ========================================================= */

  function resetRecipe() {
    setEditingRecipeId(null);

    setRecipe({
      code: "",
      name: "",
      outputBarangId: "",
      outputQty: "1",
      notes: "",
    });

    setRecipeItems([
      {
        itemType: "STOCK",
        barangId: "",
        name: "",
        qty: "",
        unit: "",
      },
    ]);
  }

  function openNewRecipe() {
    resetRecipe();
    setShowRecipe(true);
  }

  function openEditRecipe(
    selectedRecipe: Recipe
  ) {
    setEditingRecipeId(
      selectedRecipe.id
    );

    setRecipe({
      code:
        selectedRecipe.code ??
        "",
      name:
        selectedRecipe.name ??
        "",
      outputBarangId:
        selectedRecipe
          .outputBarang?.id
          ? String(
              selectedRecipe
                .outputBarang.id
            )
          : "",
      outputQty: String(
        selectedRecipe.outputQty ??
          1
      ),
      notes: "",
    });

    const items =
      selectedRecipe.items ?? [];

    setRecipeItems(
      items.length
        ? items.map(
            (item) => ({
              itemType:
                item.itemType ===
                "UTILITY"
                  ? "UTILITY"
                  : "STOCK",

              barangId:
                item.itemType ===
                "UTILITY"
                  ? ""
                  : String(
                      item.barang?.id ??
                        ""
                    ),

              name:
                item.itemType ===
                "UTILITY"
                  ? item.name ??
                    ""
                  : "",

              qty:
                item.qty != null
                  ? String(
                      item.qty
                    )
                  : "",

              unit:
                item.unit ??
                item.barang
                  ?.baseUnit ??
                item.barang?.unit ??
                "",
            })
          )
        : [
            {
              itemType:
                "STOCK",
              barangId: "",
              name: "",
              qty: "",
              unit: "",
            },
          ]
    );

    setShowRecipe(true);
  }

  /* =========================================================
   * SAVE RECIPE
   * ========================================================= */

  async function saveRecipe() {
    if (!recipe.code.trim()) {
      return toast.error(
        "Kode BOM wajib diisi"
      );
    }

    if (!recipe.name.trim()) {
      return toast.error(
        "Nama resep wajib diisi"
      );
    }

    if (!recipe.outputBarangId) {
      return toast.error(
        "Produk hasil wajib dipilih"
      );
    }

    const outputQty =
      Number(recipe.outputQty);

    if (
      !Number.isFinite(
        outputQty
      ) ||
      outputQty <= 0
    ) {
      return toast.error(
        "Qty hasil tidak valid"
      );
    }

    const validItems =
      recipeItems
        .filter((item) => {
          const qty =
            Number(item.qty);

          if (
            !Number.isFinite(
              qty
            ) ||
            qty <= 0
          ) {
            return false;
          }

          if (
            item.itemType ===
            "UTILITY"
          ) {
            return (
              item.name.trim()
                .length > 0 &&
              item.unit.trim()
                .length > 0
            );
          }

          return Boolean(
            item.barangId
          );
        })
        .map((item) => ({
          itemType:
            item.itemType,

          barangId:
            item.itemType ===
            "STOCK"
              ? Number(
                  item.barangId
                )
              : null,

          name:
            item.itemType ===
            "UTILITY"
              ? item.name.trim()
              : null,

          qty: Number(
            item.qty
          ),

          unit:
            item.unit.trim(),
        }));

    if (!validItems.length) {
      return toast.error(
        "Minimal satu bahan baku harus diisi"
      );
    }

    const invalidStock =
      validItems.some(
        (item) =>
          item.itemType ===
            "STOCK" &&
          !item.barangId
      );

    if (invalidStock) {
      return toast.error(
        "Semua bahan STOCK wajib memilih barang"
      );
    }

    const invalidUtility =
      validItems.some(
        (item) =>
          item.itemType ===
            "UTILITY" &&
          (!item.name ||
            !item.unit)
      );

    if (invalidUtility) {
      return toast.error(
        "UTILITY wajib memiliki nama dan unit"
      );
    }

    setSavingRecipe(true);

    try {
      const payload = {
        code:
          recipe.code.trim(),

        name:
          recipe.name.trim(),

        outputBarangId:
          Number(
            recipe.outputBarangId
          ),

        outputQty,

        notes:
          recipe.notes.trim(),

        items:
          validItems,
      };

      const isEdit =
        editingRecipeId !== null;

      const url = isEdit
        ? `/api/manufacture/recipes/${editingRecipeId}`
        : "/api/manufacture/recipes";

      const method = isEdit
        ? "PUT"
        : "POST";

      const res =
        await fetch(url, {
          method,

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              payload
            ),
        });

      const data =
        await res.json();

      if (
        !res.ok ||
        !data.success
      ) {
        return toast.error(
          data.message ||
            (isEdit
              ? "Gagal mengubah BOM"
              : "Gagal menyimpan BOM")
        );
      }

      toast.success(
        isEdit
          ? "BOM berhasil diperbarui"
          : "BOM / resep berhasil disimpan"
      );

      setShowRecipe(false);

      resetRecipe();

      await load();
    } catch (error) {
      console.error(
        "SAVE RECIPE ERROR:",
        error
      );

      toast.error(
        editingRecipeId !== null
          ? "Gagal mengubah BOM"
          : "Gagal menyimpan BOM"
      );
    } finally {
      setSavingRecipe(false);
    }
  }

  /* =========================================================
   * CREATE ORDER
   * ========================================================= */

  async function createOrder() {
    if (!selectedOutletId) {
      return toast.error(
        "Outlet wajib dipilih"
      );
    }

    if (!order.recipeId) {
      return toast.error(
        "BOM / resep wajib dipilih"
      );
    }

    const plannedQty =
      Number(
        order.plannedQty
      );

    if (
      !Number.isFinite(
        plannedQty
      ) ||
      plannedQty <= 0
    ) {
      return toast.error(
        "Qty produksi tidak valid"
      );
    }

    setSavingOrder(true);

    try {
      const res =
        await fetch(
          "/api/manufacture/orders",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                ...order,

                recipeId:
                  Number(
                    order.recipeId
                  ),

                plannedQty,

                outletId:
                  Number(
                    selectedOutletId
                  ),
              }),
          }
        );

      const data =
        await res.json();

      if (
        !res.ok ||
        !data.success
      ) {
        return toast.error(
          data.message ||
            "Gagal membuat order"
        );
      }

      toast.success(
        `Order ${
          data.data?.number ??
          ""
        } berhasil dibuat`
      );

      setShowOrder(false);

      setOrder({
        recipeId: "",
        plannedQty: "",
        note: "",
      });

      await load();
    } catch (error) {
      console.error(
        "CREATE ORDER ERROR:",
        error
      );

      toast.error(
        "Gagal membuat order produksi"
      );
    } finally {
      setSavingOrder(false);
    }
  }

  /* =========================================================
   * COMPLETE
   * ========================================================= */

  async function complete(
    id: number
  ) {
    const target =
      orders.find(
        (x) => x.id === id
      );

    if (!target) {
      return;
    }

    const targetOutletId =
      target.outletId
        ? String(
            target.outletId
          )
        : selectedOutletId;

    if (!targetOutletId) {
      return toast.error(
        "Outlet produksi belum ditentukan"
      );
    }

    const qty =
      window.prompt(
        "Qty hasil produksi:",
        String(
          target.plannedQty
        )
      );

    if (qty === null) {
      return;
    }

    const n = Number(qty);

    if (
      !Number.isFinite(n) ||
      n <= 0
    ) {
      return toast.error(
        "Qty tidak valid"
      );
    }

    const outletName =
      outlets.find(
        (x) =>
          String(x.id) ===
          String(
            targetOutletId
          )
      )?.name ??
      "Outlet";

    const confirmed =
      window.confirm(
        `Selesaikan produksi ${target.number} sebanyak ${n} untuk ${outletName}? Stok bahan akan berkurang dan stok hasil bertambah di outlet tersebut.`
      );

    if (!confirmed) {
      return;
    }

    try {
      const res =
        await fetch(
          `/api/manufacture/orders/${id}/complete`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                producedQty: n,

                outletId:
                  Number(
                    targetOutletId
                  ),
              }),
          }
        );

      const data =
        await res.json();

      if (
        !res.ok ||
        !data.success
      ) {
        return toast.error(
          data.message ||
            "Gagal menyelesaikan produksi"
        );
      }

      toast.success(
        "Produksi berhasil diselesaikan"
      );

      await Promise.all([
        load(),

        loadOutletStock(
          targetOutletId
        ),
      ]);
    } catch (error) {
      console.error(
        "COMPLETE ORDER ERROR:",
        error
      );

      toast.error(
        "Gagal menyelesaikan produksi"
      );
    }
  }

  /* =========================================================
   * OPEN NEW ORDER
   * ========================================================= */

  function openNewOrder() {
    if (!selectedOutletId) {
      toast.error(
        "Pilih outlet terlebih dahulu"
      );

      return;
    }

    setOrder({
      recipeId: "",
      plannedQty: "",
      note: "",
    });

    setShowOrder(true);
  }

  /* =========================================================
   * REFRESH
   * ========================================================= */

  async function refreshAll() {
    await Promise.all([
      load(),

      selectedOutletId
        ? loadOutletStock(
            selectedOutletId
          )
        : Promise.resolve(),
    ]);
  }

  /* =========================================================
   * RENDER
   * ========================================================= */

  return (
    <div className="min-h-screen bg-[#F5F7F6] text-[#23382F]">
      {/* =====================================================
          TOP ACCENT
         ===================================================== */}

      <div className="h-1 w-full bg-gradient-to-r from-[#2F6657] via-[#5F927E] to-[#C89A52]" />

      <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
        {/* ===================================================
            HEADER
           =================================================== */}

        <section className="relative mb-7 overflow-hidden rounded-[28px] border border-[#DCE7E2] bg-white shadow-[0_18px_55px_rgba(35,56,47,0.07)]">
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-[#EAF3EE] blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-[#F4EBDD] blur-3xl" />

          <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between lg:p-8">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#315F51] to-[#5B8D78] text-white shadow-lg shadow-[#315F51]/20">
                <Factory size={27} />
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF3EE] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#3E7462]">
                    <Sparkles size={12} />
                    Production Center
                  </span>

                  {selectedOutlet && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E1E9E5] bg-white px-3 py-1 text-[11px] font-semibold text-[#64766D]">
                      <Store size={12} />
                      {selectedOutlet.code
                        ? `${selectedOutlet.code} · `
                        : ""}
                      {selectedOutlet.name}
                    </span>
                  )}
                </div>

                <h1 className="text-2xl font-black tracking-tight text-[#243F34] sm:text-3xl">
                  Manufacture
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#72827A]">
                  Kelola BOM, rencana produksi,
                  pemakaian bahan baku, utility,
                  dan hasil produksi secara
                  terintegrasi dengan stock outlet.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={refreshAll}
                disabled={
                  loading ||
                  loadingOutletStock
                }
                className="inline-flex items-center gap-2 rounded-xl border border-[#D9E5DF] bg-white px-3.5 py-2.5 text-sm font-bold text-[#46665A] shadow-sm transition hover:border-[#BDD2C8] hover:bg-[#F7FAF8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw
                  size={16}
                  className={
                    loading ||
                    loadingOutletStock
                      ? "animate-spin"
                      : ""
                  }
                />
                Refresh
              </button>

              <button
                type="button"
                onClick={openNewRecipe}
                className="inline-flex items-center gap-2 rounded-xl border border-[#CFE0D7] bg-white px-4 py-2.5 text-sm font-bold text-[#315C4E] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#F5F9F7]"
              >
                <Plus size={17} />
                Buat BOM
              </button>

              <button
                type="button"
                onClick={openNewOrder}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#315F51] to-[#4E806C] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#315F51]/20 transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                <Plus size={17} />
                Order Produksi
              </button>
            </div>
          </div>
        </section>

        {/* ===================================================
            OUTLET SELECTOR
           =================================================== */}

        {isCentralAdmin && (
          <section className="mb-6 overflow-hidden rounded-[22px] border border-[#DCE7E2] bg-white shadow-sm">
            <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EE] text-[#3D7461]">
                  <Store size={20} />
                </div>

                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[#8A9992]">
                    Production Outlet
                  </div>

                  <div className="mt-0.5 text-sm font-bold text-[#29473B]">
                    Pilih outlet untuk melihat stock
                  </div>
                </div>
              </div>

              <div className="relative w-full lg:max-w-[420px]">
                <select
                  value={
                    selectedOutletId
                  }
                  onChange={(e) =>
                    setSelectedOutletId(
                      e.target.value
                    )
                  }
                  className="w-full appearance-none rounded-xl border border-[#D7E3DE] bg-[#FBFCFB] px-4 py-3 pr-10 text-sm font-bold text-[#29473B] outline-none transition focus:border-[#5B8D78] focus:ring-4 focus:ring-[#5B8D78]/10"
                >
                  <option value="">
                    Pilih Outlet
                  </option>

                  {outlets.map(
                    (outlet) => (
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
                    )
                  )}
                </select>

                <ChevronDown
                  size={17}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#819089]"
                />
              </div>
            </div>

            {selectedOutletId && (
              <div className="flex flex-wrap items-center gap-3 border-t border-[#EDF2EF] bg-[#FAFCFB] px-5 py-3">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#EAF3EE] px-2.5 py-1.5 text-xs font-bold text-[#3F7462]">
                  <CircleDot
                    size={11}
                    className="fill-current"
                  />
                  Outlet aktif
                </span>

                <span className="text-xs font-semibold text-[#52675D]">
                  {selectedOutlet?.name ??
                    `Outlet ${selectedOutletId}`}
                </span>

                <span className="h-1 w-1 rounded-full bg-[#B6C4BD]" />

                {loadingOutletStock ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#7D8B85]">
                    <Loader2
                      size={13}
                      className="animate-spin"
                    />
                    Membaca stock...
                  </span>
                ) : (
                  <span className="text-xs text-[#7D8B85]">
                    {outletStocks.length} item
                    stock terdaftar
                  </span>
                )}
              </div>
            )}
          </section>
        )}

        {/* ===================================================
            SUMMARY
           =================================================== */}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={
              <ClipboardList size={20} />
            }
            label="Total Order"
            value={orders.length}
            description="Semua order produksi"
          />

          <SummaryCard
            icon={
              <Clock3 size={20} />
            }
            label="Berjalan"
            value={pendingOrders}
            description="Menunggu penyelesaian"
            accent="amber"
          />

          <SummaryCard
            icon={
              <PackageCheck size={20} />
            }
            label="Selesai"
            value={completedOrders}
            description="Produksi completed"
            accent="green"
          />

          <SummaryCard
            icon={
              <AlertCircle size={20} />
            }
            label="Dibatalkan"
            value={cancelledOrders}
            description="Order cancelled"
            accent="red"
          />
        </section>

        {/* ===================================================
            NAVIGATION
           =================================================== */}

        <section className="mb-5 flex flex-col gap-3 rounded-[22px] border border-[#DCE7E2] bg-white p-2 shadow-sm sm:flex-row">
          <button
            type="button"
            onClick={() =>
              setTab("orders")
            }
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${
              tab === "orders"
                ? "bg-[#EAF3EE] text-[#2F6657] shadow-sm"
                : "text-[#7A8982] hover:bg-[#F7FAF8] hover:text-[#46665A]"
            }`}
          >
            <ClipboardList size={17} />
            Order Produksi
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] ${
                tab === "orders"
                  ? "bg-white text-[#3D7461]"
                  : "bg-[#F1F4F2] text-[#84918B]"
              }`}
            >
              {orders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setTab("recipes")
            }
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${
              tab === "recipes"
                ? "bg-[#EAF3EE] text-[#2F6657] shadow-sm"
                : "text-[#7A8982] hover:bg-[#F7FAF8] hover:text-[#46665A]"
            }`}
          >
            <Layers3 size={17} />
            BOM / Resep
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] ${
                tab === "recipes"
                  ? "bg-white text-[#3D7461]"
                  : "bg-[#F1F4F2] text-[#84918B]"
              }`}
            >
              {recipes.length}
            </span>
          </button>

          <button
            type="button"
            onClick={refreshAll}
            disabled={
              loading ||
              loadingOutletStock
            }
            className="hidden rounded-xl px-3 py-3 text-[#547469] transition hover:bg-[#F4F8F6] disabled:opacity-50 sm:block"
            title="Refresh data"
          >
            <RefreshCw
              size={17}
              className={
                loading ||
                loadingOutletStock
                  ? "animate-spin"
                  : ""
              }
            />
          </button>
        </section>

        {/* ===================================================
            ORDERS
           =================================================== */}

        {tab === "orders" && (
          <section className="overflow-hidden rounded-[24px] border border-[#DCE7E2] bg-white shadow-[0_12px_35px_rgba(35,56,47,0.05)]">
            <div className="border-b border-[#EAF0ED] p-5 lg:p-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EE] text-[#3E7462]">
                    <ClipboardList size={19} />
                  </div>

                  <div>
                    <h2 className="font-black text-[#29473B]">
                      Order Produksi
                    </h2>

                    <p className="mt-0.5 text-xs text-[#84918B]">
                      Monitoring pekerjaan produksi
                      dan status penyelesaiannya.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative min-w-0 sm:w-[280px]">
                    <Search
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#97A59F]"
                    />

                    <input
                      value={
                        orderSearch
                      }
                      onChange={(e) =>
                        setOrderSearch(
                          e.target.value
                        )
                      }
                      placeholder="Cari order, produk, outlet..."
                      className="w-full rounded-xl border border-[#DCE7E2] bg-[#FBFCFB] py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-[#5B8D78] focus:ring-4 focus:ring-[#5B8D78]/10"
                    />
                  </div>

                  <div className="relative">
                    <SlidersHorizontal
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8B9992]"
                    />

                    <select
                      value={
                        orderStatusFilter
                      }
                      onChange={(e) =>
                        setOrderStatusFilter(
                          e.target.value
                        )
                      }
                      className="w-full appearance-none rounded-xl border border-[#DCE7E2] bg-[#FBFCFB] py-2.5 pl-9 pr-8 text-sm font-semibold text-[#4D6258] outline-none focus:border-[#5B8D78] sm:w-[150px]"
                    >
                      <option value="ALL">
                        Semua Status
                      </option>
                      <option value="PLANNED">
                        Planned
                      </option>
                      <option value="PROCESSING">
                        Processing
                      </option>
                      <option value="COMPLETED">
                        Completed
                      </option>
                      <option value="CANCELLED">
                        Cancelled
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px]">
                <thead>
                  <tr className="border-b border-[#EAF0ED] bg-[#F8FAF9]">
                    {[
                      "#",
                      "Order",
                      "Outlet",
                      "Tanggal",
                      "Produk",
                      "Rencana",
                      "Hasil",
                      "Status",
                      "Aksi",
                    ].map(
                      (label) => (
                        <th
                          key={
                            label
                          }
                          className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.12em] text-[#83918B]"
                        >
                          {label}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <OrderLoadingRows />
                  ) : filteredOrders.length ? (
                    filteredOrders.map(
                      (item, index) => {
                        const status =
                          normalizeStatus(
                            item.status
                          );

                        const completed =
                          status ===
                          "COMPLETED";

                        const cancelled =
                          status ===
                          "CANCELLED";

                        return (
                          <tr
                            key={
                              item.id
                            }
                            className="border-b border-[#EEF3F0] last:border-0 transition hover:bg-[#FBFDFC]"
                          >
                            <td className="px-5 py-4 text-xs font-semibold text-[#9AA7A1]">
                              {index +
                                1}
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F1F6F3] text-[#52796A]">
                                  <Hash
                                    size={
                                      15
                                    }
                                  />
                                </div>

                                <div>
                                  <div className="font-bold text-[#29473B]">
                                    {
                                      item.number
                                    }
                                  </div>

                                  <div className="mt-0.5 text-[10px] text-[#96A39D]">
                                    Manufacture
                                    Order
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#F1F6F3] px-2.5 py-1.5 text-xs font-bold text-[#52796A]">
                                <Store
                                  size={
                                    12
                                  }
                                />

                                {item
                                  .outlet
                                  ?.name ??
                                  (item.outletId
                                    ? `Outlet ${item.outletId}`
                                    : "Belum ditentukan")}
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2 text-xs font-semibold text-[#64766D]">
                                <CalendarDays
                                  size={
                                    14
                                  }
                                  className="text-[#90A099]"
                                />
                                {formatDate(
                                  item.productionDate
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div className="max-w-[240px]">
                                <div className="truncate font-bold text-[#29473B]">
                                  {
                                    item
                                      .recipe
                                      ?.outputBarang
                                      ?.name
                                  }
                                </div>

                                <div className="mt-1 truncate text-xs text-[#87948E]">
                                  {
                                    item
                                      .recipe
                                      ?.name
                                  }
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div className="font-black text-[#405B50]">
                                {formatNumber(
                                  item.plannedQty
                                )}
                              </div>

                              <div className="mt-0.5 text-[10px] font-semibold uppercase text-[#98A49F]">
                                {item
                                  .recipe
                                  ?.outputBarang
                                  ?.baseUnit ||
                                  item
                                    .recipe
                                    ?.outputBarang
                                    ?.unit ||
                                  "unit"}
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div
                                className={`font-black ${
                                  completed
                                    ? "text-[#39745F]"
                                    : "text-[#7B8982]"
                                }`}
                              >
                                {formatNumber(
                                  item.producedQty
                                )}
                              </div>

                              <div className="mt-0.5 text-[10px] font-semibold uppercase text-[#98A49F]">
                                {item
                                  .recipe
                                  ?.outputBarang
                                  ?.baseUnit ||
                                  item
                                    .recipe
                                    ?.outputBarang
                                    ?.unit ||
                                  "unit"}
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <StatusBadge
                                status={
                                  item.status
                                }
                              />
                            </td>

                            <td className="px-5 py-4">
                              {!completed &&
                              !cancelled ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    complete(
                                      item.id
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#3E7462] px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#315F51] hover:shadow-md"
                                >
                                  <CheckCircle2
                                    size={
                                      14
                                    }
                                  />
                                  Selesaikan
                                </button>
                              ) : (
                                <span className="text-xs font-semibold text-[#98A49F]">
                                  {completed
                                    ? "Sudah selesai"
                                    : "Tidak tersedia"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      }
                    )
                  ) : (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-6 py-20 text-center"
                      >
                        <EmptyState
                          icon={
                            <ClipboardList
                              size={
                                25
                              }
                            />
                          }
                          title={
                            orderSearch ||
                            orderStatusFilter !==
                              "ALL"
                              ? "Order tidak ditemukan"
                              : "Belum ada order produksi"
                          }
                          description={
                            orderSearch ||
                            orderStatusFilter !==
                              "ALL"
                              ? "Coba ubah kata pencarian atau filter status."
                              : "Order produksi yang dibuat akan tampil di halaman ini."
                          }
                          action={
                            !orderSearch &&
                            orderStatusFilter ===
                              "ALL"
                              ? {
                                  label:
                                    "Buat Order Produksi",
                                  onClick:
                                    openNewOrder,
                                }
                              : undefined
                          }
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {!loading &&
              filteredOrders.length > 0 && (
                <div className="flex items-center justify-between border-t border-[#EAF0ED] bg-[#FBFCFB] px-5 py-3">
                  <span className="text-[11px] font-semibold text-[#89968F]">
                    Menampilkan{" "}
                    <b className="text-[#52675D]">
                      {
                        filteredOrders.length
                      }
                    </b>{" "}
                    dari{" "}
                    <b className="text-[#52675D]">
                      {
                        orders.length
                      }
                    </b>{" "}
                    order
                  </span>

                  <span className="hidden text-[11px] font-semibold text-[#A0ABA6] sm:block">
                    Stock source: OutletStock
                  </span>
                </div>
              )}
          </section>
        )}

        {/* ===================================================
            RECIPES
           =================================================== */}

        {tab === "recipes" && (
          <section>
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EE] text-[#3E7462]">
                    <Layers3 size={19} />
                  </div>

                  <div>
                    <h2 className="font-black text-[#29473B]">
                      BOM / Resep
                    </h2>

                    <p className="mt-0.5 text-xs text-[#84918B]">
                      Definisi bahan baku dan hasil
                      produksi.
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative w-full sm:w-[300px]">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#97A59F]"
                />

                <input
                  value={
                    recipeSearch
                  }
                  onChange={(e) =>
                    setRecipeSearch(
                      e.target.value
                    )
                  }
                  placeholder="Cari kode atau nama BOM..."
                  className="w-full rounded-xl border border-[#DCE7E2] bg-white py-2.5 pl-10 pr-3 text-sm outline-none shadow-sm transition focus:border-[#5B8D78] focus:ring-4 focus:ring-[#5B8D78]/10"
                />
              </div>
            </div>

            {loading ? (
              <RecipeLoadingGrid />
            ) : filteredRecipes.length ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredRecipes.map(
                  (item) => (
                    <RecipeCard
                      key={
                        item.id
                      }
                      recipe={
                        item
                      }
                      selectedOutletId={
                        selectedOutletId
                      }
                      getOutletStock={
                        getOutletStock
                      }
                      onEdit={
                        openEditRecipe
                      }
                    />
                  )
                )}
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#CBDCD4] bg-white px-6 py-20 text-center shadow-sm">
                <EmptyState
                  icon={
                    <Package size={25} />
                  }
                  title={
                    recipeSearch
                      ? "BOM tidak ditemukan"
                      : "Belum ada BOM / resep"
                  }
                  description={
                    recipeSearch
                      ? "Coba gunakan kata kunci lain."
                      : "Buat BOM pertama untuk mulai menjalankan proses manufacture."
                  }
                  action={
                    !recipeSearch
                      ? {
                          label:
                            "Buat BOM / Resep",
                          onClick:
                            openNewRecipe,
                        }
                      : undefined
                  }
                />
              </div>
            )}
          </section>
        )}
      </main>

      {/* =====================================================
          RECIPE MODAL
         ===================================================== */}

      {showRecipe && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#17271F]/45 p-3 backdrop-blur-sm sm:p-5">
          <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-white/50 bg-white shadow-[0_30px_100px_rgba(15,35,27,0.25)]">
            <div className="flex shrink-0 items-center justify-between border-b border-[#E7EEEA] bg-white px-5 py-4 sm:px-7 sm:py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EE] text-[#3E7462]">
                  <Boxes size={20} />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-[#29473B] sm:text-xl">
                      {editingRecipeId !==
                      null
                        ? "Edit BOM / Resep"
                        : "Buat BOM / Resep"}
                    </h2>

                    <span className="rounded-full bg-[#F2F6F4] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#789087]">
                      BOM
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-[#84918B]">
                    Definisikan produk hasil dan
                    kebutuhan produksinya.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (
                    savingRecipe
                  ) {
                    return;
                  }

                  setShowRecipe(
                    false
                  );

                  resetRecipe();
                }}
                className="rounded-xl p-2.5 text-[#7C8B84] transition hover:bg-[#F3F7F5] hover:text-[#3E5E52]"
              >
                <X size={19} />
              </button>
            </div>

            <div className="overflow-y-auto p-5 sm:p-7">
              <div className="mb-6 rounded-2xl border border-[#DCE9E2] bg-gradient-to-br from-[#F8FBF9] to-[#EEF6F1] p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#4D806D] shadow-sm">
                    <Sparkles size={16} />
                  </div>

                  <div>
                    <div className="text-xs font-black text-[#355B4E]">
                      Struktur BOM
                    </div>

                    <p className="mt-1 text-xs leading-5 text-[#71837A]">
                      STOCK akan menggunakan master
                      Barang dan menjadi komponen yang
                      memengaruhi stock outlet saat
                      produksi. UTILITY dicatat sebagai
                      kebutuhan non-stock.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Kode BOM"
                  required
                >
                  <input
                    value={
                      recipe.code
                    }
                    onChange={(e) =>
                      setRecipe({
                        ...recipe,
                        code: e.target
                          .value,
                      })
                    }
                    placeholder="Contoh: BOM-001"
                  />
                </Field>

                <Field
                  label="Nama Resep"
                  required
                >
                  <input
                    value={
                      recipe.name
                    }
                    onChange={(e) =>
                      setRecipe({
                        ...recipe,
                        name: e.target
                          .value,
                      })
                    }
                    placeholder="Contoh: Saus Sambal"
                  />
                </Field>

                <Field
                  label="Produk Hasil"
                  required
                >
                  <SearchableBarangSelect
                    value={
                      recipe.outputBarangId
                    }
                    onChange={(
                      value
                    ) =>
                      setRecipe({
                        ...recipe,
                        outputBarangId:
                          value,
                      })
                    }
                    barangs={
                      outputOptions
                    }
                    outletStockMap={
                      outletStockMap
                    }
                    placeholder="Cari produk hasil..."
                  />
                </Field>

                <Field
                  label="Hasil per Batch"
                  required
                >
                  <input
                    type="number"
                    min="0.0001"
                    step="any"
                    value={
                      recipe.outputQty
                    }
                    onChange={(e) =>
                      setRecipe({
                        ...recipe,
                        outputQty:
                          e.target
                            .value,
                      })
                    }
                    placeholder="1"
                  />
                </Field>
              </div>

              <div className="my-7 h-px bg-[#E8EFEB]" />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-[#29473B]">
                      Bahan Baku & Utility
                    </h3>

                    <span className="rounded-full bg-[#F2F6F4] px-2 py-1 text-[9px] font-black text-[#75857D]">
                      {
                        recipeItems.length
                      }{" "}
                      ITEM
                    </span>
                  </div>

                  <p className="mt-1 max-w-2xl text-xs leading-5 text-[#84918B]">
                    Gunakan STOCK untuk komponen
                    inventory. Gunakan UTILITY untuk
                    kebutuhan non-stock seperti AIR RO.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    addRecipeItem
                  }
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#CFE0D7] bg-white px-3.5 py-2.5 text-xs font-bold text-[#3E7462] transition hover:bg-[#F2F8F5]"
                >
                  <Plus size={15} />
                  Tambah Item
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {recipeItems.map(
                  (item, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-[#E0EAE5] bg-[#FBFCFB] p-4 transition hover:border-[#C9DBD2]"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EDF4F0] text-[10px] font-black text-[#547568]">
                            {String(
                              index +
                                1
                            ).padStart(
                              2,
                              "0"
                            )}
                          </span>

                          <span className="text-xs font-black uppercase tracking-wider text-[#708078]">
                            Komponen
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeRecipeItem(
                              index
                            )
                          }
                          className="rounded-lg p-2 text-[#B56B6B] transition hover:bg-[#FFF1F1]"
                          title="Hapus item"
                        >
                          <Trash2
                            size={15}
                          />
                        </button>
                      </div>

                      <div className="mb-4 flex rounded-xl bg-[#F0F4F2] p-1">
                        <button
                          type="button"
                          onClick={() =>
                            updateRecipeItem(
                              index,
                              {
                                itemType:
                                  "STOCK",
                                name: "",
                                unit:
                                  "",
                              }
                            )
                          }
                          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition ${
                            item.itemType ===
                            "STOCK"
                              ? "bg-white text-[#3E7462] shadow-sm"
                              : "text-[#83918B]"
                          }`}
                        >
                          <Package
                            size={
                              13
                            }
                          />
                          STOCK
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            updateRecipeItem(
                              index,
                              {
                                itemType:
                                  "UTILITY",
                                barangId:
                                  "",
                              }
                            )
                          }
                          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition ${
                            item.itemType ===
                            "UTILITY"
                              ? "bg-white text-[#A87932] shadow-sm"
                              : "text-[#83918B]"
                          }`}
                        >
                          <CircleDot
                            size={
                              13
                            }
                          />
                          UTILITY
                        </button>
                      </div>

                      {item.itemType ===
                      "STOCK" ? (
                        <div className="grid gap-3 md:grid-cols-[1fr_130px_110px]">
                          <div>
                            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-[#8B9992]">
                              Barang
                            </label>

                            <SearchableBarangSelect
                              value={
                                item.barangId
                              }
                              onChange={(
                                value
                              ) => {
                                const barang =
                                  barangs.find(
                                    (b) =>
                                      String(
                                        b.id
                                      ) ===
                                      String(
                                        value
                                      )
                                  );

                                updateRecipeItem(
                                  index,
                                  {
                                    barangId:
                                      value,
                                    unit:
                                      barang?.baseUnit ||
                                      barang?.unit ||
                                      "",
                                  }
                                );
                              }}
                              barangs={
                                barangs
                              }
                              outletStockMap={
                                outletStockMap
                              }
                              placeholder="Cari bahan baku..."
                            />
                          </div>

                          <Field label="Qty">
                            <input
                              type="number"
                              min="0.0001"
                              step="any"
                              placeholder="Qty"
                              value={
                                item.qty
                              }
                              onChange={(
                                e
                              ) =>
                                updateRecipeItem(
                                  index,
                                  {
                                    qty:
                                      e
                                        .target
                                        .value,
                                  }
                                )
                              }
                            />
                          </Field>

                          <div>
                            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-[#8B9992]">
                              Unit
                            </label>

                            <div className="flex min-h-[46px] items-center justify-center rounded-xl border border-[#DCE7E2] bg-[#EFF5F1] px-3 text-xs font-black text-[#4D7768]">
                              {item.unit ||
                                "BASE"}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-[1fr_130px_130px]">
                          <Field label="Nama Utility">
                            <input
                              value={
                                item.name
                              }
                              onChange={(
                                e
                              ) =>
                                updateRecipeItem(
                                  index,
                                  {
                                    name:
                                      e
                                        .target
                                        .value,
                                  }
                                )
                              }
                              placeholder="Contoh: AIR RO"
                            />
                          </Field>

                          <Field label="Qty">
                            <input
                              type="number"
                              min="0.0001"
                              step="any"
                              value={
                                item.qty
                              }
                              onChange={(
                                e
                              ) =>
                                updateRecipeItem(
                                  index,
                                  {
                                    qty:
                                      e
                                        .target
                                        .value,
                                  }
                                )
                              }
                              placeholder="Qty"
                            />
                          </Field>

                          <Field label="Unit">
                            <input
                              value={
                                item.unit
                              }
                              onChange={(
                                e
                              ) =>
                                updateRecipeItem(
                                  index,
                                  {
                                    unit:
                                      e
                                        .target
                                        .value,
                                  }
                                )
                              }
                              placeholder="Liter"
                            />
                          </Field>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>

              <div className="mt-7 flex flex-col-reverse gap-2 border-t border-[#E8EFEB] pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (
                      savingRecipe
                    ) {
                      return;
                    }

                    setShowRecipe(
                      false
                    );

                    resetRecipe();
                  }}
                  disabled={
                    savingRecipe
                  }
                  className="rounded-xl border border-[#D8E3DE] bg-white px-5 py-2.5 text-sm font-bold text-[#566C62] transition hover:bg-[#F7F9F8] disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={
                    saveRecipe
                  }
                  disabled={
                    savingRecipe
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#315F51] to-[#4E806C] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#315F51]/15 transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingRecipe ? (
                    <>
                      <Loader2
                        size={
                          15
                        }
                        className="animate-spin"
                      />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <CheckCircle2
                        size={
                          15
                        }
                      />
                      {editingRecipeId !==
                      null
                        ? "Simpan Perubahan"
                        : "Simpan BOM"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          ORDER MODAL
         ===================================================== */}

      {showOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#17271F]/45 p-3 backdrop-blur-sm sm:p-5">
          <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/50 bg-white shadow-[0_30px_100px_rgba(15,35,27,0.25)]">
            <div className="flex items-center justify-between border-b border-[#E7EEEA] px-5 py-4 sm:px-7 sm:py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EE] text-[#3E7462]">
                  <Factory size={20} />
                </div>

                <div>
                  <h2 className="text-lg font-black text-[#29473B] sm:text-xl">
                    Order Produksi
                  </h2>

                  <p className="mt-1 text-xs text-[#84918B]">
                    Buat pekerjaan produksi dari BOM
                    yang tersedia.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowOrder(
                    false
                  )
                }
                className="rounded-xl p-2.5 text-[#7C8B84] transition hover:bg-[#F3F7F5]"
              >
                <X size={19} />
              </button>
            </div>

            <div className="p-5 sm:p-7">
              <div className="mb-5 rounded-2xl border border-[#DCE9E2] bg-gradient-to-br from-[#F7FBF9] to-[#EDF6F1] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#4D806D] shadow-sm">
                    <Store size={17} />
                  </div>

                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.13em] text-[#8B9992]">
                      Outlet Produksi
                    </div>

                    <div className="mt-1 font-black text-[#29473B]">
                      {selectedOutlet?.name ??
                        "Belum dipilih"}
                    </div>
                  </div>
                </div>
              </div>

              <Field
                label="BOM / Resep"
                required
              >
                <select
                  value={
                    order.recipeId
                  }
                  onChange={(e) =>
                    setOrder({
                      ...order,
                      recipeId:
                        e.target
                          .value,
                    })
                  }
                >
                  <option value="">
                    Pilih BOM
                  </option>

                  {recipes.map(
                    (item) => (
                      <option
                        key={
                          item.id
                        }
                        value={
                          item.id
                        }
                      >
                        {item.code} —{" "}
                        {item.name} (
                        {
                          item
                            .outputBarang
                            ?.name
                        }
                        )
                      </option>
                    )
                  )}
                </select>
              </Field>

              {order.recipeId && (
                <div className="mt-3 rounded-xl border border-[#E5EDE9] bg-[#FAFCFB] p-3">
                  {(() => {
                    const selectedRecipe =
                      recipes.find(
                        (x) =>
                          String(
                            x.id
                          ) ===
                          String(
                            order.recipeId
                          )
                      );

                    if (
                      !selectedRecipe
                    ) {
                      return null;
                    }

                    return (
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EAF3EE] text-[#3E7462]">
                          <Package
                            size={
                              16
                            }
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-xs font-black text-[#3D5E51]">
                            Hasil produksi
                          </div>

                          <div className="truncate text-sm font-bold text-[#29473B]">
                            {
                              selectedRecipe
                                .outputBarang
                                ?.name
                            }
                          </div>
                        </div>

                        <div className="ml-auto shrink-0 text-right">
                          <div className="text-[10px] font-semibold uppercase text-[#95A19B]">
                            Per Batch
                          </div>

                          <div className="text-xs font-black text-[#4C7767]">
                            {formatNumber(
                              selectedRecipe.outputQty
                            )}{" "}
                            {
                              selectedRecipe
                                .outputBarang
                                ?.baseUnit
                            }
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="mt-4">
                <Field
                  label="Qty Produksi"
                  required
                >
                  <input
                    type="number"
                    min="0.0001"
                    step="any"
                    value={
                      order.plannedQty
                    }
                    onChange={(e) =>
                      setOrder({
                        ...order,
                        plannedQty:
                          e.target
                            .value,
                      })
                    }
                    placeholder="Contoh: 100"
                  />
                </Field>
              </div>

              <div className="mt-4">
                <Field label="Catatan">
                  <textarea
                    rows={3}
                    value={
                      order.note
                    }
                    onChange={(e) =>
                      setOrder({
                        ...order,
                        note:
                          e.target
                            .value,
                      })
                    }
                    placeholder="Catatan produksi, batch, atau instruksi..."
                  />
                </Field>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-2 border-t border-[#E8EFEB] pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setShowOrder(
                      false
                    )
                  }
                  disabled={
                    savingOrder
                  }
                  className="rounded-xl border border-[#D8E3DE] bg-white px-5 py-2.5 text-sm font-bold text-[#566C62] transition hover:bg-[#F7F9F8] disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={
                    createOrder
                  }
                  disabled={
                    savingOrder
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#315F51] to-[#4E806C] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#315F51]/15 transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingOrder ? (
                    <>
                      <Loader2
                        size={
                          15
                        }
                        className="animate-spin"
                      />
                      Membuat...
                    </>
                  ) : (
                    <>
                      <Factory
                        size={
                          15
                        }
                      />
                      Buat Order
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

/* ===========================================================
 * RECIPE CARD
 * =========================================================== */

function RecipeCard({
  recipe,
  selectedOutletId,
  getOutletStock,
  onEdit,
}: {
  recipe: Recipe;
  selectedOutletId: string;
  getOutletStock: (
    barangId: number
  ) => number;
  onEdit: (
    recipe: Recipe
  ) => void;
}) {
  return (
    <article className="group overflow-hidden rounded-[24px] border border-[#DCE7E2] bg-white shadow-[0_10px_30px_rgba(35,56,47,0.045)] transition duration-300 hover:-translate-y-1 hover:border-[#C8DAD2] hover:shadow-[0_20px_45px_rgba(35,56,47,0.09)]">
      <div className="border-b border-[#EDF2EF] bg-gradient-to-br from-[#FBFDFC] to-[#F5F9F7] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EE] text-[#3E7462]">
              <Package size={18} />
            </div>

            <div className="min-w-0">
              <div className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#4D806D]">
                {recipe.code}
              </div>

              <h3 className="truncate text-base font-black text-[#29473B]">
                {recipe.name}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onEdit(recipe)
            }
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#D6E3DD] bg-white px-2.5 py-2 text-[11px] font-bold text-[#527568] shadow-sm transition hover:border-[#BFD4C9] hover:bg-[#F5F9F7]"
          >
            <Pencil size={12} />
            Edit
          </button>
        </div>
      </div>

      <div className="p-5">
        <div className="rounded-2xl border border-[#E2EBE6] bg-[#FAFCFB] p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.13em] text-[#95A19B]">
              Produk Hasil
            </span>

            <ArrowUpRight
              size={14}
              className="text-[#9BA9A2]"
            />
          </div>

          <div className="font-black text-[#29473B]">
            {recipe.outputBarang?.name}
          </div>

          <div className="mt-1 text-xs font-semibold text-[#788881]">
            {formatNumber(
              recipe.outputQty
            )}{" "}
            {recipe.outputBarang?.baseUnit ||
              recipe.outputBarang?.unit}
            {" / batch"}
          </div>

          {selectedOutletId &&
            recipe.outputBarang && (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-[#E6EEE9] bg-white px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <PackageCheck
                    size={14}
                    className="text-[#4B806C]"
                  />

                  <span className="text-[11px] font-semibold text-[#788881]">
                    Stock outlet
                  </span>
                </div>

                <span className="text-sm font-black text-[#3E7462]">
                  {formatNumber(
                    getOutletStock(
                      recipe
                        .outputBarang
                        .id
                    )
                  )}{" "}
                  {recipe.outputBarang
                    .baseUnit ||
                    recipe
                      .outputBarang
                      .unit}
                </span>
              </div>
            )}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F0F5F2] text-[#5C7B6E]">
              <Boxes size={14} />
            </div>

            <span className="text-[10px] font-black uppercase tracking-[0.13em] text-[#84918B]">
              Komponen
            </span>
          </div>

          <span className="rounded-full bg-[#F3F6F4] px-2 py-1 text-[10px] font-black text-[#76847E]">
            {recipe.items?.length ??
              0}
          </span>
        </div>

        <div className="mt-3 space-y-2">
          {recipe.items?.map(
            (item) => {
              const utility =
                item.itemType ===
                "UTILITY";

              const stock =
                item.barang
                  ? getOutletStock(
                      item.barang.id
                    )
                  : 0;

              const required =
                Number(
                  item.qty ?? 0
                );

              const insufficient =
                !utility &&
                stock < required;

              return (
                <div
                  key={
                    item.id
                  }
                  className="rounded-xl border border-[#EDF2EF] bg-[#FCFDFC] px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-[#455D53]">
                        {utility
                          ? item.name
                          : item
                              .barang
                              ?.name}
                      </div>

                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#98A49F]">
                        {utility ? (
                          <>
                            <span className="rounded bg-[#FBF3E7] px-1.5 py-0.5 font-bold text-[#A87932]">
                              UTILITY
                            </span>

                            <span>
                              Non-stock
                            </span>
                          </>
                        ) : (
                          <>
                            <span>
                              {
                                item
                                  .barang
                                  ?.code
                              }
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-xs font-black text-[#405B50]">
                        {formatNumber(
                          item.qty
                        )}{" "}
                        {item.unit ||
                          item
                            .barang
                            ?.baseUnit ||
                          item
                            .barang
                            ?.unit}
                      </div>
                    </div>
                  </div>

                  {!utility &&
                    selectedOutletId && (
                      <div className="mt-2 flex items-center justify-between border-t border-[#EEF3F0] pt-2">
                        <span className="text-[10px] font-semibold text-[#9AA6A0]">
                          Stock outlet
                        </span>

                        <span
                          className={`text-[11px] font-black ${
                            insufficient
                              ? "text-[#C35C5C]"
                              : "text-[#4B806C]"
                          }`}
                        >
                          {formatNumber(
                            stock
                          )}{" "}
                          {item
                            .barang
                            ?.baseUnit ||
                            item
                              .barang
                              ?.unit}
                        </span>
                      </div>
                    )}

                  {utility && (
                    <div className="mt-2 border-t border-[#EEF3F0] pt-2 text-right text-[9px] font-bold uppercase tracking-wider text-[#B1884B]">
                      Tidak mengurangi stock
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>
      </div>
    </article>
  );
}

/* ===========================================================
 * SEARCHABLE BARANG SELECT
 * =========================================================== */

function SearchableBarangSelect({
  value,
  onChange,
  barangs,
  outletStockMap,
  placeholder = "Pilih barang...",
}: {
  value: string;

  onChange: (
    value: string
  ) => void;

  barangs: Barang[];

  outletStockMap?: Map<
    number,
    number
  >;

  placeholder?: string;
}) {
  const [open, setOpen] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const selected =
    barangs.find(
      (b) =>
        String(b.id) ===
        String(value)
    );

  const getStock = (
    barangId: number
  ) =>
    Number(
      outletStockMap?.get(
        Number(barangId)
      ) ?? 0
    );

  const filtered =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      if (!keyword) {
        return barangs;
      }

      return barangs.filter(
        (barang) =>
          barang.code
            .toLowerCase()
            .includes(keyword) ||
          barang.name
            .toLowerCase()
            .includes(keyword)
      );
    }, [
      barangs,
      search,
    ]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(
            (current) =>
              !current
          );

          setSearch("");
        }}
        className={`flex min-h-[46px] w-full items-center justify-between rounded-xl border bg-white px-3.5 text-left outline-none transition ${
          open
            ? "border-[#5B8D78] ring-4 ring-[#5B8D78]/10"
            : "border-[#DCE7E2] hover:border-[#C4D7CD]"
        }`}
      >
        {selected ? (
          <div className="min-w-0">
            <div className="truncate text-xs font-black text-[#34594C]">
              {selected.code}
            </div>

            <div className="mt-0.5 truncate text-xs text-[#7C8B84]">
              {selected.name}
            </div>
          </div>
        ) : (
          <span className="text-xs text-[#A0AAA5]">
            {placeholder}
          </span>
        )}

        <ChevronDown
          size={16}
          className={`ml-3 shrink-0 text-[#83918B] transition ${
            open
              ? "rotate-180"
              : ""
          }`}
        />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() =>
              setOpen(false)
            }
          />

          <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-[#D8E4DE] bg-white shadow-[0_20px_50px_rgba(25,45,36,0.16)]">
            <div className="border-b border-[#E8EFEB] bg-[#FAFCFB] p-3">
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA7A1]"
                />

                <input
                  autoFocus
                  value={
                    search
                  }
                  onChange={(e) =>
                    setSearch(
                      e.target
                        .value
                    )
                  }
                  onClick={(e) =>
                    e.stopPropagation()
                  }
                  placeholder="Cari kode atau nama barang..."
                  className="w-full rounded-xl border border-[#DCE7E2] bg-white py-2.5 pl-9 pr-3 text-xs outline-none focus:border-[#5B8D78] focus:ring-4 focus:ring-[#5B8D78]/10"
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {filtered.length ? (
                filtered.map(
                  (barang) => {
                    const isSelected =
                      String(
                        barang.id
                      ) ===
                      String(
                        value
                      );

                    const stock =
                      getStock(
                        barang.id
                      );

                    return (
                      <button
                        key={
                          barang.id
                        }
                        type="button"
                        onClick={() => {
                          onChange(
                            String(
                              barang.id
                            )
                          );

                          setOpen(
                            false
                          );

                          setSearch(
                            ""
                          );
                        }}
                        className={`w-full border-b border-[#F0F4F2] px-3.5 py-3 text-left transition last:border-0 ${
                          isSelected
                            ? "bg-[#EAF3EE]"
                            : "bg-white hover:bg-[#F7FAF8]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-black text-[#34594C]">
                              {
                                barang.code
                              }
                            </div>

                            <div className="mt-0.5 truncate text-xs text-[#65776E]">
                              {
                                barang.name
                              }
                            </div>
                          </div>

                          <div
                            className={`shrink-0 rounded-lg px-2 py-1 text-[9px] font-black ${
                              stock >
                              0
                                ? "bg-[#EDF5F1] text-[#4B806C]"
                                : "bg-[#FFF0F0] text-[#B55B5B]"
                            }`}
                          >
                            {formatNumber(
                              stock
                            )}{" "}
                            {barang
                              .baseUnit ||
                              barang.unit}
                          </div>
                        </div>
                      </button>
                    );
                  }
                )
              ) : (
                <div className="px-6 py-10 text-center">
                  <Search
                    size={22}
                    className="mx-auto text-[#B1BDB7]"
                  />

                  <div className="mt-2 text-xs font-bold text-[#687A71]">
                    Barang tidak ditemukan
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-[#E8EFEB] bg-[#FAFCFB] px-3.5 py-2 text-[10px] font-semibold text-[#98A49F]">
              Menampilkan{" "}
              {filtered.length}{" "}
              dari{" "}
              {barangs.length}{" "}
              barang
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ===========================================================
 * FIELD
 * =========================================================== */

function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#84918B]">
        {label}

        {required && (
          <span className="text-[#B85E5E]">
            *
          </span>
        )}
      </div>

      <div className="[&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-[#DCE7E2] [&>input]:bg-white [&>input]:px-3.5 [&>input]:py-2.5 [&>input]:text-sm [&>input]:outline-none [&>input]:transition [&>input]:focus:border-[#5B8D78] [&>input]:focus:ring-4 [&>input]:focus:ring-[#5B8D78]/10 [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:border-[#DCE7E2] [&>select]:bg-white [&>select]:px-3.5 [&>select]:py-2.5 [&>select]:text-sm [&>select]:outline-none [&>select]:focus:border-[#5B8D78] [&>select]:focus:ring-4 [&>select]:focus:ring-[#5B8D78]/10 [&>textarea]:w-full [&>textarea]:resize-none [&>textarea]:rounded-xl [&>textarea]:border [&>textarea]:border-[#DCE7E2] [&>textarea]:bg-white [&>textarea]:px-3.5 [&>textarea]:py-2.5 [&>textarea]:text-sm [&>textarea]:outline-none [&>textarea]:focus:border-[#5B8D78] [&>textarea]:focus:ring-4 [&>textarea]:focus:ring-[#5B8D78]/10">
        {children}
      </div>
    </label>
  );
}

/* ===========================================================
 * SUMMARY CARD
 * =========================================================== */

function SummaryCard({
  icon,
  label,
  value,
  description,
  accent = "green",
}: {
  icon: ReactNode;
  label: string;
  value: number;
  description: string;
  accent?:
    | "green"
    | "amber"
    | "red";
}) {
  const styles = {
    green: {
      icon: "bg-[#EAF3EE] text-[#3E7462]",
      dot: "bg-[#4E806C]",
    },
    amber: {
      icon: "bg-[#FBF3E7] text-[#A87932]",
      dot: "bg-[#C28D42]",
    },
    red: {
      icon: "bg-[#FFF0F0] text-[#B55B5B]",
      dot: "bg-[#C76B6B]",
    },
  };

  return (
    <div className="group rounded-[22px] border border-[#DCE7E2] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles[accent].icon}`}
        >
          {icon}
        </div>

        <span
          className={`mt-1 h-2 w-2 rounded-full ${styles[accent].dot}`}
        />
      </div>

      <div className="mt-4">
        <div className="text-[10px] font-black uppercase tracking-[0.13em] text-[#8B9992]">
          {label}
        </div>

        <div className="mt-1 text-2xl font-black tracking-tight text-[#29473B]">
          {formatNumber(value)}
        </div>

        <div className="mt-1 text-[11px] font-medium text-[#98A49F]">
          {description}
        </div>
      </div>
    </div>
  );
}

/* ===========================================================
 * STATUS BADGE
 * =========================================================== */

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized =
    normalizeStatus(
      status
    );

  const config: Record<
    string,
    {
      label: string;
      className: string;
      dot: string;
    }
  > = {
    COMPLETED: {
      label: "COMPLETED",
      className:
        "bg-[#EAF5EF] text-[#39745F] border-[#D3E8DB]",
      dot: "bg-[#4E806C]",
    },

    CANCELLED: {
      label: "CANCELLED",
      className:
        "bg-[#FFF0F0] text-[#B55B5B] border-[#F1D6D6]",
      dot: "bg-[#C76B6B]",
    },

    PROCESSING: {
      label: "PROCESSING",
      className:
        "bg-[#EEF4FA] text-[#52759A] border-[#D8E5F0]",
      dot: "bg-[#678CAF]",
    },

    PLANNED: {
      label: "PLANNED",
      className:
        "bg-[#FBF3E7] text-[#A87932] border-[#F0DFC2]",
      dot: "bg-[#C18C41]",
    },
  };

  const item =
    config[normalized] ?? {
      label:
        status ||
        "UNKNOWN",
      className:
        "bg-[#F2F4F3] text-[#6E7B75] border-[#E0E5E2]",
      dot: "bg-[#8B9992]",
    };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[9px] font-black tracking-[0.08em] ${item.className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${item.dot}`}
      />

      {item.label}
    </span>
  );
}

/* ===========================================================
 * EMPTY STATE
 * =========================================================== */

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}) {
  return (
    <div className="mx-auto max-w-md">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0F5F2] text-[#71857B]">
        {icon}
      </div>

      <div className="mt-4 text-sm font-black text-[#4A6258]">
        {title}
      </div>

      <div className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[#98A49F]">
        {description}
      </div>

      {action && (
        <button
          type="button"
          onClick={
            action.onClick
          }
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#3E7462] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#315F51]"
        >
          <Plus size={14} />
          {action.label}
        </button>
      )}
    </div>
  );
}

/* ===========================================================
 * ORDER LOADING
 * =========================================================== */

function OrderLoadingRows() {
  return (
    <>
      {Array.from({
        length: 5,
      }).map((_, index) => (
        <tr
          key={index}
          className="border-b border-[#EEF3F0]"
        >
          {Array.from({
            length: 9,
          }).map(
            (_, column) => (
              <td
                key={column}
                className="px-5 py-5"
              >
                <div className="h-4 animate-pulse rounded-lg bg-[#EDF2EF]" />
              </td>
            )
          )}
        </tr>
      ))}
    </>
  );
}

/* ===========================================================
 * RECIPE LOADING
 * =========================================================== */

function RecipeLoadingGrid() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({
        length: 6,
      }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-[24px] border border-[#DCE7E2] bg-white"
        >
          <div className="h-28 animate-pulse bg-[#F0F4F2]" />

          <div className="space-y-3 p-5">
            <div className="h-20 animate-pulse rounded-2xl bg-[#F2F5F3]" />

            <div className="h-4 w-1/2 animate-pulse rounded bg-[#EDF2EF]" />

            <div className="h-10 animate-pulse rounded-xl bg-[#F2F5F3]" />

            <div className="h-10 animate-pulse rounded-xl bg-[#F2F5F3]" />
          </div>
        </div>
      ))}
    </div>
  );
}