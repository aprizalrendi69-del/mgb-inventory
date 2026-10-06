"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/*
 * =========================================================
 * OUTLET INVENTORY
 * =========================================================
 *
 * Monthly Inventory Report
 *
 * INVENTORY RULE
 * ---------------------------------------------------------
 * Stock Awal:
 *   Approved Monthly Stock Opname bulan sebelumnya.
 *
 * Barang Masuk:
 *   StockCard qtyIn periode berjalan.
 *
 * Barang Keluar:
 *   StockCard qtyOut periode berjalan.
 *
 * Ending Stock:
 *   Stock Awal + Barang Masuk - Barang Keluar.
 *
 * IMPORTANT:
 *   Ending Stock TIDAK disesuaikan oleh Stock Opname
 *   pada bulan yang sama.
 *
 * ACCESS
 * ---------------------------------------------------------
 * ADMIN / MANAGER / PURCHASING / GUDANG:
 *   dapat memilih outlet.
 *
 * OUTLET_ADMIN / ADMIN_OUTLET:
 *   terkunci ke outlet dari session user.
 *
 * DESIGN
 * ---------------------------------------------------------
 * MGB ERP / Surat Jalan premium reference.
 *
 * Primary:
 *   #497F70
 *
 * Dark:
 *   #18352D
 *
 * PDF:
 *   jsPDF + AutoTable
 *
 * =========================================================
 */

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type MeUser = {
  id?: number;
  username?: string;
  fullname?: string;
  name?: string;
  role?: string;
  outletId?: number | null;
  outlet?: Outlet | null;
};

type MeResponse = {
  success?: boolean;
  user?: MeUser | null;
  message?: string;
};

type InventoryRow = {
  id: number;
  barangId: number;

  code: string;
  category: string;
  name: string;

  unit: string;
  baseUnit: string;
  conversionRate: number;

  openingStock: number;
  incomingQty: number;
  outgoingQty: number;
  endingStock: number;

  averageCost: number;
  outgoingCost: number;
  usagePercentage: number;

  previousOutgoingCost: number;
  costChangePercentage: number;

  costStatus: "NAIK" | "TURUN" | "STABIL";

  stockStatus:
    | "AMAN"
    | "LOW STOCK"
    | "HABIS";

  minimumStock: number;
};

type Summary = {
  totalItems: number;
  totalIncoming: number;
  totalOutgoing: number;
  totalOutgoingCost: number;
  totalEndingStock: number;
  lowStockCount: number;
  emptyStockCount: number;
};

type ApiResponse = {
  success: boolean;
  message?: string;

  outlet?: Outlet;

  outlets?: Outlet[];

  role?: string;

  canSelectOutlet?: boolean;

  period?: {
    year: number;
    month: number;
    value: string;
    start: string;
    end: string;
    isCurrent: boolean;
  };

  data?: InventoryRow[];

  summary?: Summary;
};

const PRIMARY = "#497F70";
const PRIMARY_DARK = "#3D6D60";
const DARK = "#18352D";

const DEFAULT_SUMMARY: Summary = {
  totalItems: 0,
  totalIncoming: 0,
  totalOutgoing: 0,
  totalOutgoingCost: 0,
  totalEndingStock: 0,
  lowStockCount: 0,
  emptyStockCount: 0,
};

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

function formatNumber(
  value: number,
  maximumFractionDigits = 2,
) {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(Number(value) || 0);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatMonthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);

  if (!year || !month) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function getDefaultMonth() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(2, "0")}`;
}

function changeMonth(
  value: string,
  delta: number,
) {
  const [year, month] = value.split("-").map(Number);

  const date = new Date(
    year,
    month - 1 + delta,
    1,
  );

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}`;
}

function normalizeRole(role?: string) {
  return String(role || "")
    .trim()
    .toUpperCase();
}

function roleLabel(role: string) {
  switch (normalizeRole(role)) {
    case "ADMIN":
      return "Administrator Pusat";

    case "MANAGER":
      return "Manager Pusat";

    case "PURCHASING":
      return "Purchasing";

    case "GUDANG":
      return "Gudang Pusat";

    case "OUTLET_ADMIN":
    case "ADMIN_OUTLET":
      return "Admin Outlet";

    case "KASIR":
      return "Kasir";

    case "STAFF_MANUFACTURE":
      return "Staff Manufacture";

    default:
      return role || "User";
  }
}

function isLockedOutletRole(role: string) {
  const normalized = normalizeRole(role);

  return (
    normalized === "OUTLET_ADMIN" ||
    normalized === "ADMIN_OUTLET"
  );
}

function isCentralRole(role: string) {
  const normalized = normalizeRole(role);

  return [
    "ADMIN",
    "MANAGER",
    "PURCHASING",
    "GUDANG",
  ].includes(normalized);
}

/*
 * Escape text untuk kebutuhan PDF / HTML-like content.
 */
function safePdfText(value: unknown) {
  return String(
    value === null || value === undefined
      ? ""
      : value,
  );
}

/*
 * =========================================================
 * ICONS
 * =========================================================
 */

function IconInfo() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function IconPdf() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 15h2" />
      <path d="M8 18h5" />
      <path d="M14 12H8" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M20 11a8.1 8.1 0 0 0-15.5-2" />
      <path d="M4 5v4h4" />
      <path d="M4 13a8.1 8.1 0 0 0 15.5 2" />
      <path d="M20 19v-4h-4" />
    </svg>
  );
}

function IconPackage() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M4.5 7.5 12 12l7.5-4.5" />
      <path d="M12 12v9" />
    </svg>
  );
}

function IconArrowUp() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}

function IconArrowDown() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  );
}

function IconMoney() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M12 3v18" />
      <path d="M17 7H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 3 2 21h20L12 3z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
      />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="17"
        rx="2"
      />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.5 3.1-5.2 7-5.2s6.2 1.7 7 5.2" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16" />
      <path d="M17 9h3a1 1 0 0 1 1 1v11" />
      <path d="M8 7h2" />
      <path d="M8 11h2" />
      <path d="M8 15h2" />
      <path d="M12 7h2" />
      <path d="M12 11h2" />
      <path d="M12 15h2" />
      <path d="M2 21h20" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/*
 * =========================================================
 * STATUS
 * =========================================================
 */

function statusStockClass(
  status: InventoryRow["stockStatus"],
) {
  if (status === "HABIS") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300";
  }

  if (status === "LOW STOCK") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300";
}

function costStatusClass(
  status: InventoryRow["costStatus"],
) {
  if (status === "NAIK") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300";
  }

  if (status === "TURUN") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300";
  }

  return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

function CostStatusIcon({
  status,
}: {
  status: InventoryRow["costStatus"];
}) {
  if (status === "NAIK") {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 19V5" />
        <path d="m5 12 7-7 7 7" />
      </svg>
    );
  }

  if (status === "TURUN") {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 5v14" />
        <path d="m19 12-7 7-7-7" />
      </svg>
    );
  }

  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M5 12h14" />
    </svg>
  );
}

/*
 * =========================================================
 * PAGE
 * =========================================================
 */

export default function OutletInventoryPage() {
  const router = useRouter();

  const [month, setMonth] =
    useState(getDefaultMonth());

  const [outletId, setOutletId] =
    useState("");

  const [outlets, setOutlets] =
    useState<Outlet[]>([]);

  const [selectedOutlet, setSelectedOutlet] =
    useState<Outlet | null>(null);

  const [rows, setRows] =
    useState<InventoryRow[]>([]);

  const [summary, setSummary] =
    useState<Summary>(DEFAULT_SUMMARY);

  const [role, setRole] =
    useState("");

  const [user, setUser] =
    useState<MeUser | null>(null);

  const [canSelectOutlet, setCanSelectOutlet] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [category, setCategory] =
    useState("ALL");

  const [page, setPage] =
    useState(1);

  const [pageSize, setPageSize] =
    useState(25);

  const [showInfo, setShowInfo] =
    useState(false);

  const autoSelectDone =
    useRef(false);

  /*
   * =======================================================
   * USER / SESSION
   * =======================================================
   */

  const loadCurrentUser =
    useCallback(async () => {
      const response = await fetch(
        "/api/me",
        {
          method: "GET",
          cache: "no-store",
        },
      );

      if (response.status === 401) {
        router.push("/login");
        return null;
      }

      if (!response.ok) {
        throw new Error(
          "Gagal membaca session user.",
        );
      }

      const result =
        (await response.json()) as MeResponse;

      const currentUser =
        result.user ?? null;

      setUser(currentUser);

      const currentRole =
        normalizeRole(
          currentUser?.role,
        );

      if (currentRole) {
        setRole(currentRole);
      }

      return currentUser;
    }, [router]);

  /*
   * =======================================================
   * LOAD DATA
   * =======================================================
   */

  const loadData = useCallback(
    async (
      selectedMonth: string,
      selectedOutletId: string,
      silent = false,
    ) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        let currentUser = user;

        if (!currentUser) {
          currentUser =
            await loadCurrentUser();
        }

        if (!currentUser) {
          return;
        }

        const currentRole =
          normalizeRole(
            currentUser.role,
          );

        const locked =
          isLockedOutletRole(
            currentRole,
          );

        const centralUser =
          isCentralRole(currentRole);

        const userCanSelect =
          centralUser ||
          !locked;

        setCanSelectOutlet(
          userCanSelect,
        );

        if (
          locked &&
          currentUser.outletId
        ) {
          selectedOutletId =
            String(
              currentUser.outletId,
            );

          setOutletId(
            selectedOutletId,
          );
        }

        const params =
          new URLSearchParams();

        params.set(
          "month",
          selectedMonth,
        );

        if (selectedOutletId) {
          params.set(
            "outletId",
            selectedOutletId,
          );
        }

        const response = await fetch(
          `/api/outlet/inventory?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        if (response.status === 401) {
          router.push("/login");
          return;
        }

        const result =
          (await response.json()) as ApiResponse;

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.message ||
              "Gagal mengambil data Inventory Outlet.",
          );
        }

        const availableOutlets =
          result.outlets ?? [];

        setOutlets(
          availableOutlets,
        );

        if (
          userCanSelect &&
          !selectedOutletId &&
          availableOutlets.length > 0
        ) {
          const firstOutlet =
            availableOutlets[0];

          setOutletId(
            String(firstOutlet.id),
          );

          setSelectedOutlet(
            firstOutlet,
          );

          if (
            !autoSelectDone.current
          ) {
            autoSelectDone.current =
              true;

            await loadData(
              selectedMonth,
              String(firstOutlet.id),
              silent,
            );

            return;
          }
        }

        if (
          locked &&
          currentUser.outletId
        ) {
          const sessionOutlet =
            availableOutlets.find(
              (item) =>
                item.id ===
                currentUser?.outletId,
            );

          if (sessionOutlet) {
            setSelectedOutlet(
              sessionOutlet,
            );
          } else if (
            result.outlet
          ) {
            setSelectedOutlet(
              result.outlet,
            );
          }
        } else if (
          selectedOutletId
        ) {
          const chosenOutlet =
            availableOutlets.find(
              (item) =>
                String(item.id) ===
                String(
                  selectedOutletId,
                ),
            );

          if (chosenOutlet) {
            setSelectedOutlet(
              chosenOutlet,
            );
          } else if (
            result.outlet
          ) {
            setSelectedOutlet(
              result.outlet,
            );
          }
        }

        const apiRole =
          normalizeRole(
            result.role,
          );

        if (
          apiRole &&
          !currentUser.role
        ) {
          setRole(apiRole);
        }

        setRows(
          result.data ?? [],
        );

        setSummary(
          result.summary ??
            DEFAULT_SUMMARY,
        );

        setPage(1);
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Gagal mengambil data Inventory Outlet.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      user,
      loadCurrentUser,
      router,
    ],
  );

  useEffect(() => {
    loadData(
      month,
      outletId,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOutletChange = (
    value: string,
  ) => {
    if (!canSelectOutlet) {
      return;
    }

    setOutletId(value);

    const nextOutlet =
      outlets.find(
        (item) =>
          String(item.id) ===
          String(value),
      ) ?? null;

    setSelectedOutlet(
      nextOutlet,
    );

    loadData(
      month,
      value,
    );
  };

  const handleMonthChange = (
    value: string,
  ) => {
    setMonth(value);

    loadData(
      value,
      outletId,
    );
  };

  const handleRefresh = () => {
    loadData(
      month,
      outletId,
      true,
    );
  };

  const categories =
    useMemo(() => {
      const categorySet =
        new Set<string>();

      for (const row of rows) {
        if (
          row.category &&
          row.category !== "-"
        ) {
          categorySet.add(
            row.category,
          );
        }
      }

      return Array.from(
        categorySet,
      ).sort((a, b) =>
        a.localeCompare(b, "id"),
      );
    }, [rows]);

  const filteredRows =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      return rows.filter(
        (row) => {
          const matchesSearch =
            !keyword ||
            row.code
              .toLowerCase()
              .includes(keyword) ||
            row.name
              .toLowerCase()
              .includes(keyword) ||
            row.category
              .toLowerCase()
              .includes(keyword);

          const matchesCategory =
            category === "ALL" ||
            row.category === category;

          return (
            matchesSearch &&
            matchesCategory
          );
        },
      );
    }, [
      rows,
      search,
      category,
    ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredRows.length /
        pageSize,
    ),
  );

  const visibleRows =
    filteredRows.slice(
      (page - 1) *
        pageSize,
      page * pageSize,
    );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [
    page,
    totalPages,
  ]);

  const filteredSummary =
    useMemo(() => {
      return {
        totalItems:
          filteredRows.length,

        totalIncoming:
          filteredRows.reduce(
            (sum, row) =>
              sum + row.incomingQty,
            0,
          ),

        totalOutgoing:
          filteredRows.reduce(
            (sum, row) =>
              sum + row.outgoingQty,
            0,
          ),

        totalOutgoingCost:
          filteredRows.reduce(
            (sum, row) =>
              sum + row.outgoingCost,
            0,
          ),

        totalEndingStock:
          filteredRows.reduce(
            (sum, row) =>
              sum + row.endingStock,
            0,
          ),
      };
    }, [filteredRows]);

  const displayName =
    user?.fullname ||
    user?.name ||
    user?.username ||
    "User";

  const normalizedRole =
    normalizeRole(
      user?.role || role,
    );

  const currentRoleLabel =
    roleLabel(
      normalizedRole,
    );

  const userOutlet =
    user?.outlet ??
    (user?.outletId
      ? outlets.find(
          (item) =>
            item.id ===
            user?.outletId,
        ) ?? null
      : null);

  const scopeText =
    canSelectOutlet
      ? "Akses semua outlet"
      : userOutlet
        ? `${userOutlet.code} · ${userOutlet.name}`
        : selectedOutlet
          ? `${selectedOutlet.code} · ${selectedOutlet.name}`
          : "Outlet session";

  /*
   * =======================================================
   * EXPORT CSV
   * =======================================================
   */

  const exportCSV = () => {
    if (!filteredRows.length) {
      return;
    }

    const header = [
      "Kode",
      "Kategori",
      "Nama Barang",
      "Unit",
      "Base Unit",
      "Konversi",
      "Stock Awal",
      "Barang Masuk",
      "Barang Keluar",
      "Ending Stock",
      "Harga / Cost",
      "Cost Pemakaian",
      "% Pemakaian",
      "Cost Bulan Sebelumnya",
      "Perubahan Cost %",
      "Status Cost",
      "Status Stock",
    ];

    const body =
      filteredRows.map(
        (row) => [
          row.code,
          row.category,
          row.name,
          row.unit,
          row.baseUnit,
          row.conversionRate,
          row.openingStock,
          row.incomingQty,
          row.outgoingQty,
          row.endingStock,
          row.averageCost,
          row.outgoingCost,
          row.usagePercentage,
          row.previousOutgoingCost,
          row.costChangePercentage,
          row.costStatus,
          row.stockStatus,
        ],
      );

    const escapeCSV = (
      value: unknown,
    ) => {
      const text =
        value === null ||
        value === undefined
          ? ""
          : String(value);

      return `"${text.replace(
        /"/g,
        '""',
      )}"`;
    };

    const csv = [
      header,
      ...body,
    ]
      .map((row) =>
        row
          .map(escapeCSV)
          .join(","),
      )
      .join("\n");

    const blob = new Blob(
      ["\uFEFF" + csv],
      {
        type:
          "text/csv;charset=utf-8;",
      },
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      `inventory-outlet-${month}.csv`;

    document.body.appendChild(
      link,
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
  };

  /*
   * =======================================================
   * EXPORT PDF - jsPDF + AutoTable
   * =======================================================
   */

  const exportPDF = () => {
    if (!filteredRows.length) {
      return;
    }

    try {
      const doc =
        new jsPDF({
          orientation: "landscape",
          unit: "mm",
          format: "a4",
          compress: true,
        });

      const pageWidth =
        doc.internal.pageSize.getWidth();

      const pageHeight =
        doc.internal.pageSize.getHeight();

      const margin = 10;

      const outletName =
        selectedOutlet?.name ||
        userOutlet?.name ||
        "Outlet";

      const outletCode =
        selectedOutlet?.code ||
        userOutlet?.code ||
        "-";

      const generatedAt =
        new Intl.DateTimeFormat(
          "id-ID",
          {
            dateStyle: "medium",
            timeStyle: "short",
          },
        ).format(new Date());

      const filenameOutlet =
        outletCode
          .replace(
            /[^a-zA-Z0-9-_]/g,
            "-",
          )
          .replace(
            /-+/g,
            "-",
          );

      const filename =
        `inventory-outlet-${filenameOutlet || "outlet"}-${month}.pdf`;

      /*
       * ---------------------------------------------------
       * COLORS
       * ---------------------------------------------------
       */

      const rgb = {
        dark: [24, 53, 45] as [
          number,
          number,
          number,
        ],
        primary: [73, 127, 112] as [
          number,
          number,
          number,
        ],
        light: [237, 247, 242] as [
          number,
          number,
          number,
        ],
        lighter: [247, 250, 249] as [
          number,
          number,
          number,
        ],
        slate: [100, 116, 139] as [
          number,
          number,
          number,
        ],
        border: [214, 226, 221] as [
          number,
          number,
          number,
        ],
        red: [185, 28, 28] as [
          number,
          number,
          number,
        ],
        amber: [180, 83, 9] as [
          number,
          number,
          number,
        ],
        green: [4, 120, 87] as [
          number,
          number,
          number,
        ],
      };

      /*
       * ---------------------------------------------------
       * HEADER
       * ---------------------------------------------------
       */

      doc.setFillColor(
        ...rgb.dark,
      );

      doc.roundedRect(
        margin,
        9,
        pageWidth -
          margin * 2,
        38,
        5,
        5,
        "F",
      );

      /*
       * Decorative circles
       */

      doc.setDrawColor(
        80,
        145,
        126,
      );

      doc.setLineWidth(0.5);

      doc.circle(
        pageWidth - 32,
        20,
        16,
      );

      doc.circle(
        pageWidth - 23,
        34,
        8,
      );

      /*
       * Brand
       */

      doc.setTextColor(
        210,
        244,
        232,
      );

      doc.setFont(
        "helvetica",
        "bold",
      );

      doc.setFontSize(7);

      doc.text(
        "MGB ERP",
        margin + 7,
        17,
      );

      doc.setTextColor(
        255,
        255,
        255,
      );

      doc.setFontSize(20);

      doc.text(
        "INVENTORY OUTLET",
        margin + 7,
        27,
      );

      doc.setFont(
        "helvetica",
        "normal",
      );

      doc.setFontSize(7.5);

      doc.setTextColor(
        194,
        224,
        214,
      );

      doc.text(
        "Monthly Inventory Control · Outlet Inventory Snapshot",
        margin + 7,
        34,
      );

      /*
       * Period badge
       */

      doc.setFillColor(
        ...rgb.primary,
      );

      doc.roundedRect(
        pageWidth - 69,
        27,
        48,
        10,
        5,
        5,
        "F",
      );

      doc.setTextColor(
        255,
        255,
        255,
      );

      doc.setFont(
        "helvetica",
        "bold",
      );

      doc.setFontSize(7.5);

      doc.text(
        formatMonthLabel(month),
        pageWidth - 45,
        33.2,
        {
          align: "center",
        },
      );

      /*
       * ---------------------------------------------------
       * DOCUMENT META
       * ---------------------------------------------------
       */

      const metaY = 53;

      doc.setFillColor(
        ...rgb.lighter,
      );

      doc.setDrawColor(
        ...rgb.border,
      );

      doc.roundedRect(
        margin,
        metaY,
        pageWidth -
          margin * 2,
        27,
        4,
        4,
        "FD",
      );

      const metaColumns = [
        {
          label: "OUTLET",
          value: `${safePdfText(outletCode)} · ${safePdfText(outletName)}`,
        },
        {
          label: "PERIODE",
          value: formatMonthLabel(month),
        },
        {
          label: "USER",
          value: displayName,
        },
        {
          label: "ROLE",
          value: currentRoleLabel,
        },
        {
          label: "GENERATED",
          value: generatedAt,
        },
      ];

      const metaWidth =
        (pageWidth -
          margin * 2 -
          12) /
        metaColumns.length;

      metaColumns.forEach(
        (item, index) => {
          const x =
            margin +
            6 +
            index * metaWidth;

          doc.setTextColor(
            ...rgb.slate,
          );

          doc.setFont(
            "helvetica",
            "bold",
          );

          doc.setFontSize(5.8);

          doc.text(
            item.label,
            x,
            metaY + 8,
          );

          doc.setTextColor(
            ...rgb.dark,
          );

          doc.setFont(
            "helvetica",
            "bold",
          );

          doc.setFontSize(7.2);

          const maxWidth =
            metaWidth - 6;

          const valueLines =
            doc.splitTextToSize(
              item.value,
              maxWidth,
            );

          doc.text(
            valueLines.slice(0, 2),
            x,
            metaY + 15,
          );
        },
      );

      /*
       * ---------------------------------------------------
       * KPI CARDS
       * ---------------------------------------------------
       */

      const kpiY = 85;
      const kpiGap = 4;
      const kpiWidth =
        (pageWidth -
          margin * 2 -
          kpiGap * 3) /
        4;

      const kpis = [
        {
          label: "TOTAL BARANG",
          value: formatNumber(
            filteredSummary.totalItems,
            0,
          ),
          caption: "Inventory outlet",
        },
        {
          label: "BARANG MASUK",
          value: formatNumber(
            filteredSummary.totalIncoming,
          ),
          caption: "Periode berjalan",
        },
        {
          label: "BARANG KELUAR",
          value: formatNumber(
            filteredSummary.totalOutgoing,
          ),
          caption: "Pemakaian / pengeluaran",
        },
        {
          label: "COST PEMAKAIAN",
          value: formatCurrency(
            filteredSummary.totalOutgoingCost,
          ),
          caption: "Nilai barang keluar",
        },
      ];

      kpis.forEach(
        (item, index) => {
          const x =
            margin +
            index *
              (kpiWidth + kpiGap);

          doc.setFillColor(
            255,
            255,
            255,
          );

          doc.setDrawColor(
            ...rgb.border,
          );

          doc.roundedRect(
            x,
            kpiY,
            kpiWidth,
            25,
            4,
            4,
            "FD",
          );

          doc.setTextColor(
            ...rgb.slate,
          );

          doc.setFont(
            "helvetica",
            "bold",
          );

          doc.setFontSize(5.8);

          doc.text(
            item.label,
            x + 5,
            kpiY + 7,
          );

          doc.setTextColor(
            ...rgb.dark,
          );

          doc.setFont(
            "helvetica",
            "bold",
          );

          doc.setFontSize(
            item.label ===
              "COST PEMAKAIAN"
              ? 10
              : 13,
          );

          doc.text(
            item.value,
            x + 5,
            kpiY + 15,
          );

          doc.setTextColor(
            ...rgb.slate,
          );

          doc.setFont(
            "helvetica",
            "normal",
          );

          doc.setFontSize(5.8);

          doc.text(
            item.caption,
            x + 5,
            kpiY + 21,
          );
        },
      );

      /*
       * ---------------------------------------------------
       * INVENTORY RULE
       * ---------------------------------------------------
       */

      const ruleY = 115;

      doc.setFillColor(
        ...rgb.light,
      );

      doc.setDrawColor(
        194,
        222,
        211,
      );

      doc.roundedRect(
        margin,
        ruleY,
        pageWidth -
          margin * 2,
        22,
        4,
        4,
        "FD",
      );

      doc.setTextColor(
        ...rgb.dark,
      );

      doc.setFont(
        "helvetica",
        "bold",
      );

      doc.setFontSize(7);

      doc.text(
        "INVENTORY RULE",
        margin + 6,
        ruleY + 7,
      );

      doc.setFont(
        "helvetica",
        "normal",
      );

      doc.setFontSize(6.2);

      doc.setTextColor(
        ...rgb.slate,
      );

      doc.text(
        "Stock Awal = Approved Monthly Stock Opname bulan sebelumnya.",
        margin + 6,
        ruleY + 12,
      );

      doc.text(
        "Barang Masuk = StockCard qtyIn · Barang Keluar = StockCard qtyOut.",
        margin + 6,
        ruleY + 17,
      );

      doc.setFont(
        "helvetica",
        "bold",
      );

      doc.setTextColor(
        ...rgb.primary,
      );

      doc.text(
        "Ending Stock = Opening + Masuk − Keluar",
        pageWidth - margin - 6,
        ruleY + 13,
        {
          align: "right",
        },
      );

      /*
       * ---------------------------------------------------
       * TABLE
       * ---------------------------------------------------
       */

      const tableRows =
        filteredRows.map(
          (row, index) => [
            String(index + 1),
            safePdfText(row.code),
            safePdfText(row.category),
            safePdfText(row.name),
            safePdfText(row.unit),
            safePdfText(row.baseUnit),
            formatNumber(
              row.conversionRate,
            ),
            formatNumber(
              row.openingStock,
            ),
            formatNumber(
              row.incomingQty,
            ),
            formatNumber(
              row.outgoingQty,
            ),
            formatNumber(
              row.endingStock,
            ),
            formatCurrency(
              row.averageCost,
            ),
            formatCurrency(
              row.outgoingCost,
            ),
            `${formatNumber(
              row.usagePercentage,
            )}%`,
            formatCurrency(
              row.previousOutgoingCost,
            ),
            `${
              row.costChangePercentage >
              0
                ? "+"
                : ""
            }${formatNumber(
              row.costChangePercentage,
            )}%`,
            safePdfText(
              row.costStatus,
            ),
            safePdfText(
              row.stockStatus,
            ),
          ],
        );

      autoTable(doc, {
        startY: ruleY + 28,

        head: [
          [
            "#",
            "Kode",
            "Kategori",
            "Nama Barang",
            "Unit",
            "Base",
            "Konversi",
            "Stock Awal",
            "Masuk",
            "Keluar",
            "Ending",
            "Harga / Cost",
            "Cost Pemakaian",
            "% Pakai",
            "Cost Sebelumnya",
            "Δ Cost",
            "Status Cost",
            "Status Stock",
          ],
        ],

        body: tableRows,

        theme: "grid",

        margin: {
          left: margin,
          right: margin,
          top: 10,
          bottom: 15,
        },

        tableWidth: pageWidth - margin * 2,

        styles: {
          font: "helvetica",
          fontSize: 4.6,
          cellPadding: 1.35,
          lineColor: rgb.border,
          lineWidth: 0.2,
          textColor: rgb.dark,
          valign: "middle",
          overflow: "linebreak",
          cellWidth: "wrap",
        },

        headStyles: {
          fillColor: rgb.dark,
          textColor: [
            255,
            255,
            255,
          ],
          fontStyle: "bold",
          fontSize: 4.7,
          cellPadding: 1.5,
          halign: "center",
          valign: "middle",
        },

        alternateRowStyles: {
          fillColor: [
            248,
            251,
            250,
          ],
        },

        columnStyles: {
          0: {
            halign: "center",
            cellWidth: 7,
          },

          1: {
            fontStyle: "bold",
            cellWidth: 15,
          },

          2: {
            cellWidth: 19,
          },

          3: {
            cellWidth: 31,
            fontStyle: "bold",
          },

          4: {
            halign: "center",
            cellWidth: 10,
          },

          5: {
            halign: "center",
            cellWidth: 10,
          },

          6: {
            halign: "right",
            cellWidth: 12,
          },

          7: {
            halign: "right",
            cellWidth: 14,
          },

          8: {
            halign: "right",
            cellWidth: 13,
          },

          9: {
            halign: "right",
            cellWidth: 13,
          },

          10: {
            halign: "right",
            cellWidth: 14,
            fontStyle: "bold",
          },

          11: {
            halign: "right",
            cellWidth: 18,
          },

          12: {
            halign: "right",
            cellWidth: 19,
          },

          13: {
            halign: "right",
            cellWidth: 14,
          },

          14: {
            halign: "right",
            cellWidth: 18,
          },

          15: {
            halign: "right",
            cellWidth: 14,
          },

          16: {
            halign: "center",
            cellWidth: 13,
            fontStyle: "bold",
          },

          17: {
            halign: "center",
            cellWidth: 15,
            fontStyle: "bold",
          },
        },

        didParseCell: (
          data,
        ) => {
          if (
            data.section !==
            "body"
          ) {
            return;
          }

          /*
           * Status Cost
           */

          if (
            data.column.index ===
            16
          ) {
            const value =
              String(
                data.cell.raw ??
                  "",
              );

            if (
              value === "NAIK"
            ) {
              data.cell.styles.textColor =
                rgb.red;
              data.cell.styles.fillColor =
                [
                  254,
                  242,
                  242,
                ];
            } else if (
              value === "TURUN"
            ) {
              data.cell.styles.textColor =
                rgb.green;
              data.cell.styles.fillColor =
                [
                  236,
                  253,
                  245,
                ];
            } else {
              data.cell.styles.textColor =
                rgb.slate;
              data.cell.styles.fillColor =
                [
                  248,
                  250,
                  252,
                ];
            }
          }

          /*
           * Status Stock
           */

          if (
            data.column.index ===
            17
          ) {
            const value =
              String(
                data.cell.raw ??
                  "",
              );

            if (
              value === "HABIS"
            ) {
              data.cell.styles.textColor =
                rgb.red;
              data.cell.styles.fillColor =
                [
                  254,
                  242,
                  242,
                ];
            } else if (
              value ===
              "LOW STOCK"
            ) {
              data.cell.styles.textColor =
                rgb.amber;
              data.cell.styles.fillColor =
                [
                  255,
                  251,
                  235,
                ];
            } else {
              data.cell.styles.textColor =
                rgb.green;
              data.cell.styles.fillColor =
                [
                  236,
                  253,
                  245,
                ];
            }
          }

          /*
           * Barang masuk
           */

          if (
            data.column.index ===
            8
          ) {
            data.cell.styles.textColor =
              rgb.green;
            data.cell.styles.fontStyle =
              "bold";
          }

          /*
           * Barang keluar
           */

          if (
            data.column.index ===
            9
          ) {
            data.cell.styles.textColor =
              rgb.slate;
          }

          /*
           * Ending stock
           */

          if (
            data.column.index ===
            10
          ) {
            data.cell.styles.textColor =
              rgb.dark;
            data.cell.styles.fontStyle =
              "bold";
          }
        },

        didDrawPage: (
          data,
        ) => {
          const currentPage =
            doc.getNumberOfPages();

          /*
           * Header mini untuk halaman
           * berikutnya.
           */

          if (
            currentPage > 1
          ) {
            doc.setFillColor(
              ...rgb.dark,
            );

            doc.rect(
              0,
              0,
              pageWidth,
              7,
              "F",
            );

            doc.setFont(
              "helvetica",
              "bold",
            );

            doc.setFontSize(5.5);

            doc.setTextColor(
              255,
              255,
              255,
            );

            doc.text(
              "MGB ERP · INVENTORY OUTLET",
              margin,
              4.5,
            );

            doc.text(
              formatMonthLabel(
                month,
              ),
              pageWidth -
                margin,
              4.5,
              {
                align: "right",
              },
            );
          }

          /*
           * Footer
           */

          doc.setDrawColor(
            ...rgb.border,
          );

          doc.setLineWidth(
            0.25,
          );

          doc.line(
            margin,
            pageHeight - 9,
            pageWidth -
              margin,
            pageHeight - 9,
          );

          doc.setFont(
            "helvetica",
            "normal",
          );

          doc.setFontSize(5.5);

          doc.setTextColor(
            ...rgb.slate,
          );

          doc.text(
            "MGB ERP · Outlet Inventory · Monthly Inventory Snapshot",
            margin,
            pageHeight - 5,
          );

          doc.text(
            `Halaman ${currentPage}`,
            pageWidth -
              margin,
            pageHeight - 5,
            {
              align: "right",
            },
          );
        },
      });

      /*
       * ---------------------------------------------------
       * SUMMARY FOOTER PAGE
       * ---------------------------------------------------
       */

      const finalY =
        (
          doc as unknown as {
            lastAutoTable?: {
              finalY: number;
            };
          }
        ).lastAutoTable
          ?.finalY ?? 125;

      if (
        finalY + 25 <
        pageHeight - 12
      ) {
        const y =
          finalY + 7;

        doc.setFillColor(
          ...rgb.lighter,
        );

        doc.setDrawColor(
          ...rgb.border,
        );

        doc.roundedRect(
          margin,
          y,
          pageWidth -
            margin * 2,
          18,
          3,
          3,
          "FD",
        );

        doc.setFont(
          "helvetica",
          "bold",
        );

        doc.setFontSize(6);

        doc.setTextColor(
          ...rgb.dark,
        );

        doc.text(
          "REPORT SUMMARY",
          margin + 5,
          y + 6,
        );

        doc.setFont(
          "helvetica",
          "normal",
        );

        doc.setTextColor(
          ...rgb.slate,
        );

        doc.text(
          `Total ${formatNumber(
            filteredSummary.totalItems,
            0,
          )} item`,
          margin + 5,
          y + 12,
        );

        doc.text(
          `Masuk ${formatNumber(
            filteredSummary.totalIncoming,
          )}`,
          margin + 65,
          y + 12,
        );

        doc.text(
          `Keluar ${formatNumber(
            filteredSummary.totalOutgoing,
          )}`,
          margin + 115,
          y + 12,
        );

        doc.text(
          `Ending ${formatNumber(
            filteredSummary.totalEndingStock,
          )}`,
          margin + 165,
          y + 12,
        );

        doc.text(
          `Cost ${formatCurrency(
            filteredSummary.totalOutgoingCost,
          )}`,
          pageWidth -
            margin -
            5,
          y + 12,
          {
            align: "right",
          },
        );
      }

      /*
       * ---------------------------------------------------
       * SAVE
       * ---------------------------------------------------
       */

      doc.setProperties({
        title: `Inventory Outlet ${outletCode} ${formatMonthLabel(month)}`,
        subject:
          "Monthly Inventory Outlet Report",
        author: "MGB ERP",
        creator: "MGB ERP",
        keywords:
          "MGB ERP, Inventory, Outlet, Monthly Inventory",
      });

      doc.save(filename);
    } catch (err) {
      console.error(
        "Gagal membuat PDF Inventory Outlet:",
        err,
      );

      setError(
        "Gagal membuat PDF Inventory Outlet. Pastikan package jspdf dan jspdf-autotable sudah terinstall.",
      );
    }
  };

  /*
   * =======================================================
   * RENDER
   * =======================================================
   */

  return (
    <div className="min-h-screen bg-[#f4f8f6] text-slate-800 transition-colors dark:bg-[#071310] dark:text-slate-100">
      <div className="mx-auto max-w-[1920px] px-4 py-5 sm:px-6 lg:px-8">

        {/* ================================================= */}
        {/* PREMIUM HERO */}
        {/* ================================================= */}

        <section className="relative overflow-hidden rounded-[30px] border border-[#dcebe5] bg-white shadow-[0_18px_60px_rgba(24,53,45,0.08)] dark:border-emerald-900/50 dark:bg-[#0c1d18] dark:shadow-[0_18px_70px_rgba(0,0,0,0.28)]">

          <div
            className="absolute inset-0 opacity-[0.07] dark:opacity-[0.12]"
            style={{
              background:
                `radial-gradient(circle at 86% 8%, ${PRIMARY} 0, transparent 32%), radial-gradient(circle at 4% 100%, ${DARK} 0, transparent 36%)`,
            }}
          />

          <div className="absolute -right-24 -top-32 h-96 w-96 rounded-full border border-emerald-200/30 dark:border-emerald-700/20" />

          <div className="absolute -right-4 -top-12 h-64 w-64 rounded-full border border-emerald-200/20 dark:border-emerald-700/20" />

          <div className="relative p-6 sm:p-8 lg:p-9">

            <div className="flex flex-col gap-7 xl:flex-row xl:items-start xl:justify-between">

              <div className="min-w-0">

                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[10px] font-black tracking-[0.16em] text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
                  MONTHLY INVENTORY CONTROL
                </div>

                <h1
                  className="text-3xl font-black tracking-[-0.03em] sm:text-4xl lg:text-[42px]"
                  style={{
                    color:
                      "var(--inventory-heading)",
                  }}
                >
                  Inventory Outlet
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Monitoring inventory outlet
                  berdasarkan opening stock,
                  movement, ending stock, cost
                  pemakaian, dan perubahan cost
                  antar periode.
                </p>

                <div className="mt-6 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">

                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-3.5 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.13em] text-slate-400 dark:text-slate-500">
                      <IconUser />
                      User
                    </div>

                    <div className="mt-2 truncate text-sm font-black text-slate-800 dark:text-slate-100">
                      {displayName}
                    </div>

                    <div className="mt-0.5 truncate text-[10px] text-slate-400 dark:text-slate-500">
                      {user?.username
                        ? `@${user.username}`
                        : "Session user"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-3.5 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.13em] text-slate-400 dark:text-slate-500">
                      <IconBuilding />
                      Role
                    </div>

                    <div className="mt-2 text-sm font-black text-slate-800 dark:text-slate-100">
                      {currentRoleLabel}
                    </div>

                    <div className="mt-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      {canSelectOutlet
                        ? "MULTI OUTLET ACCESS"
                        : "SESSION OUTLET ACCESS"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-3.5 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70 sm:col-span-2 lg:col-span-1">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.13em] text-slate-400 dark:text-slate-500">
                      {canSelectOutlet ? (
                        <IconBuilding />
                      ) : (
                        <IconLock />
                      )}
                      Outlet Scope
                    </div>

                    <div className="mt-2 truncate text-sm font-black text-slate-800 dark:text-slate-100">
                      {scopeText}
                    </div>

                    <div className="mt-0.5 truncate text-[10px] text-slate-400 dark:text-slate-500">
                      {canSelectOutlet
                        ? "User pusat dapat memilih outlet"
                        : "Mengikuti outlet session"}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">

                  {selectedOutlet && (
                    <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.10)]" />
                      {selectedOutlet.code}
                      <span className="font-medium text-emerald-500/50">
                        /
                      </span>
                      {selectedOutlet.name}
                    </div>
                  )}

                  {!canSelectOutlet &&
                    selectedOutlet && (
                      <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-black text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                        <IconLock />
                        SESSION LOCKED
                      </div>
                    )}

                  {canSelectOutlet && (
                    <div className="inline-flex items-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] font-black text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
                      <IconBuilding />
                      OUTLET SELECTABLE
                    </div>
                  )}

                  {month ===
                    getDefaultMonth() && (
                    <div className="inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-100 px-3 py-2 text-[10px] font-black text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300">
                      BULAN BERJALAN
                    </div>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-3">

                <button
                  type="button"
                  onClick={() =>
                    setShowInfo(true)
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <IconInfo />
                  Info Inventory
                </button>

                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={
                    loading ||
                    refreshing
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <span
                    className={
                      refreshing
                        ? "animate-spin"
                        : ""
                    }
                  >
                    <IconRefresh />
                  </span>
                  Refresh
                </button>

                {/* PDF */}

                <button
                  type="button"
                  onClick={exportPDF}
                  disabled={
                    loading ||
                    !filteredRows.length
                  }
                  title="Download PDF Inventory Outlet"
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(24,53,45,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(24,53,45,0.34)] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background:
                      `linear-gradient(135deg, ${DARK}, ${PRIMARY_DARK})`,
                  }}
                >
                  <IconPdf />
                  Download PDF
                </button>

                {/* CSV */}

                <button
                  type="button"
                  onClick={exportCSV}
                  disabled={
                    loading ||
                    !filteredRows.length
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-100 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                >
                  <IconDownload />
                  Export CSV
                </button>

              </div>
            </div>
          </div>
        </section>

        {/* ================================================= */}
        {/* FILTER */}
        {/* ================================================= */}

        <section className="mt-5 rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_8px_30px_rgba(24,53,45,0.05)] dark:border-slate-800 dark:bg-[#0d1b18] sm:p-5">

          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

            <div>
              <div className="flex items-center gap-2">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm"
                  style={{
                    background:
                      `linear-gradient(135deg, ${DARK}, ${PRIMARY})`,
                  }}
                >
                  <IconCalendar />
                </div>

                <div>
                  <div className="text-sm font-black text-slate-800 dark:text-slate-100">
                    Filter Inventory
                  </div>

                  <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    Atur periode, outlet, pencarian,
                    dan kategori.
                  </div>
                </div>
              </div>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] font-black text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
              <IconCalendar />
              {formatMonthLabel(month)}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.8fr_1.2fr_0.9fr]">

            <div>
              <label className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Outlet

                {!canSelectOutlet &&
                  selectedOutlet && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8px] text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                      <IconLock />
                      LOCKED
                    </span>
                  )}

                {canSelectOutlet && (
                  <span className="rounded-md border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[8px] font-black text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
                    SELECTABLE
                  </span>
                )}
              </label>

              <div className="relative">
                <select
                  value={outletId}
                  disabled={
                    !canSelectOutlet
                  }
                  onChange={(event) =>
                    handleOutletChange(
                      event.target.value,
                    )
                  }
                  className={`h-12 w-full appearance-none rounded-xl border px-3 pr-10 text-sm font-bold outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:focus:border-emerald-600 dark:focus:ring-emerald-900/30 ${
                    !canSelectOutlet
                      ? "cursor-not-allowed border-amber-200 bg-amber-50/70 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
                      : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  }`}
                >
                  {outlets.length ===
                    0 && (
                    <option value="">
                      Loading outlet...
                    </option>
                  )}

                  {outlets.map(
                    (outlet) => (
                      <option
                        key={outlet.id}
                        value={outlet.id}
                      >
                        {outlet.code} —{" "}
                        {outlet.name}
                      </option>
                    ),
                  )}
                </select>

                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {canSelectOutlet ? (
                    <IconChevronDown />
                  ) : (
                    <IconLock />
                  )}
                </div>
              </div>

              <div className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
                {canSelectOutlet
                  ? `${outlets.length} outlet tersedia untuk user pusat.`
                  : "Outlet mengikuti outlet yang tersimpan pada session user."}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Periode
              </label>

              <input
                type="month"
                value={month}
                max={getDefaultMonth()}
                onChange={(event) =>
                  handleMonthChange(
                    event.target.value,
                  )
                }
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition hover:border-emerald-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-emerald-600 dark:focus:ring-emerald-900/30"
              />
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Cari Barang
              </label>

              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <IconSearch />
                </div>

                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(
                      event.target.value,
                    );
                    setPage(1);
                  }}
                  placeholder="Kode, nama, atau kategori..."
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 text-sm outline-none transition placeholder:text-slate-400 hover:border-emerald-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-600 dark:focus:border-emerald-600 dark:focus:ring-emerald-900/30"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Kategori
              </label>

              <div className="relative">
                <select
                  value={category}
                  onChange={(event) => {
                    setCategory(
                      event.target.value,
                    );
                    setPage(1);
                  }}
                  className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm font-bold text-slate-700 outline-none transition hover:border-emerald-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-emerald-600 dark:focus:ring-emerald-900/30"
                >
                  <option value="ALL">
                    Semua Kategori
                  </option>

                  {categories.map(
                    (item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    ),
                  )}
                </select>

                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <IconChevronDown />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">

            <span className="mr-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
              Quick Period
            </span>

            <button
              type="button"
              onClick={() =>
                handleMonthChange(
                  getDefaultMonth(),
                )
              }
              className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
            >
              Bulan Berjalan
            </button>

            <button
              type="button"
              onClick={() =>
                handleMonthChange(
                  changeMonth(
                    month,
                    -1,
                  ),
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              ← Bulan Sebelumnya
            </button>

            <button
              type="button"
              onClick={() =>
                handleMonthChange(
                  changeMonth(
                    month,
                    1,
                  ),
                )
              }
              disabled={
                month >=
                getDefaultMonth()
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Bulan Berikutnya →
            </button>
          </div>
        </section>

        {/* ================================================= */}
        {/* RULE BANNER */}
        {/* ================================================= */}

        <section className="mt-5 overflow-hidden rounded-[24px] border border-emerald-100 bg-gradient-to-r from-[#edf7f2] via-white to-white shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/30 dark:via-[#0d1b18] dark:to-[#0d1b18]">

          <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-start gap-3">

              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-md"
                style={{
                  background:
                    `linear-gradient(135deg, ${DARK}, ${PRIMARY})`,
                }}
              >
                <IconPackage />
              </div>

              <div>
                <div className="text-sm font-black text-emerald-950 dark:text-emerald-200">
                  Inventory Snapshot ·{" "}
                  {formatMonthLabel(month)}
                </div>

                <p className="mt-1 max-w-3xl text-xs leading-5 text-emerald-700/80 dark:text-emerald-300/70">
                  Stock Awal mengambil sumber
                  dari Approved Monthly Stock
                  Opname bulan sebelumnya.
                  Ending Stock dihitung dari
                  pergerakan inventory dan tidak
                  ditimpa oleh Stock Opname pada
                  bulan yang sama.
                </p>
              </div>
            </div>

            <div className="shrink-0 rounded-2xl border border-white bg-white/80 px-5 py-3.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
              <div className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
                Rumus Ending Stock
              </div>

              <div className="mt-1 text-sm font-black text-slate-700 dark:text-slate-200">
                Opening + Masuk − Keluar
              </div>
            </div>

          </div>
        </section>

        {/* ================================================= */}
        {/* ERROR */}
        {/* ================================================= */}

        {error && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">

            <div className="mt-0.5 shrink-0">
              <IconWarning />
            </div>

            <div className="flex-1">
              <div className="font-black">
                Terjadi kesalahan
              </div>

              <div className="mt-1 text-xs leading-5">
                {error}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                loadData(
                  month,
                  outletId,
                )
              }
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-black text-red-700 shadow-sm dark:border-red-900/60 dark:bg-slate-900 dark:text-red-300"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* ================================================= */}
        {/* KPI */}
        {/* ================================================= */}

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <div className="group relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(24,53,45,0.05)] transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-[#0d1b18]">

            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-50 dark:bg-emerald-950/30" />

            <div className="relative flex items-start justify-between">

              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  Total Barang
                </div>

                <div
                  className="mt-2 text-3xl font-black tracking-tight"
                  style={{
                    color: PRIMARY,
                  }}
                >
                  {loading
                    ? "..."
                    : formatNumber(
                        filteredSummary.totalItems,
                        0,
                      )}
                </div>

                <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Inventory outlet
                </div>
              </div>

              <div className="rounded-2xl bg-emerald-50 p-3.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <IconPackage />
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(24,53,45,0.05)] transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-[#0d1b18]">

            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-50 dark:bg-emerald-950/30" />

            <div className="relative flex items-start justify-between">

              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  Barang Masuk
                </div>

                <div className="mt-2 text-3xl font-black tracking-tight text-emerald-700 dark:text-emerald-300">
                  {loading
                    ? "..."
                    : formatNumber(
                        filteredSummary.totalIncoming,
                      )}
                </div>

                <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Periode{" "}
                  {formatMonthLabel(
                    month,
                  )}
                </div>
              </div>

              <div className="rounded-2xl bg-emerald-50 p-3.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <IconArrowUp />
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(24,53,45,0.05)] transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-[#0d1b18]">

            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-slate-100 dark:bg-slate-800" />

            <div className="relative flex items-start justify-between">

              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  Barang Keluar
                </div>

                <div className="mt-2 text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100">
                  {loading
                    ? "..."
                    : formatNumber(
                        filteredSummary.totalOutgoing,
                      )}
                </div>

                <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Pemakaian / pengeluaran
                </div>
              </div>

              <div className="rounded-2xl bg-slate-100 p-3.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <IconArrowDown />
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(24,53,45,0.05)] transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-[#0d1b18]">

            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-50 dark:bg-emerald-950/30" />

            <div className="relative flex items-start justify-between">

              <div className="min-w-0">
                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  Cost Pemakaian
                </div>

                <div
                  className="mt-2 truncate text-2xl font-black tracking-tight sm:text-3xl"
                  style={{
                    color: DARK,
                  }}
                >
                  <span className="dark:hidden">
                    {loading
                      ? "..."
                      : formatCurrency(
                          filteredSummary.totalOutgoingCost,
                        )}
                  </span>

                  <span className="hidden text-emerald-300 dark:inline">
                    {loading
                      ? "..."
                      : formatCurrency(
                          filteredSummary.totalOutgoingCost,
                        )}
                  </span>
                </div>

                <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Nilai barang keluar
                </div>
              </div>

              <div className="rounded-2xl bg-emerald-50 p-3.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <IconMoney />
              </div>
            </div>
          </div>
        </section>

        {/* ================================================= */}
        {/* STOCK ALERT */}
        {/* ================================================= */}

        {!loading &&
          (summary.lowStockCount > 0 ||
            summary.emptyStockCount >
              0) && (
            <section className="mt-5 grid gap-3 sm:grid-cols-2">

              {summary.lowStockCount >
                0 && (
                <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
                  <div className="rounded-xl bg-white p-2.5 text-amber-600 shadow-sm dark:bg-slate-900 dark:text-amber-300">
                    <IconWarning />
                  </div>

                  <div>
                    <div className="text-sm font-black text-amber-800 dark:text-amber-200">
                      {summary.lowStockCount}{" "}
                      barang low stock
                    </div>

                    <div className="mt-1 text-xs text-amber-700 dark:text-amber-300/80">
                      Periksa kebutuhan
                      replenishment outlet.
                    </div>
                  </div>
                </div>
              )}

              {summary.emptyStockCount >
                0 && (
                <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/30">
                  <div className="rounded-xl bg-white p-2.5 text-red-600 shadow-sm dark:bg-slate-900 dark:text-red-300">
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                      />
                      <path d="m9 9 6 6" />
                      <path d="m15 9-6 6" />
                    </svg>
                  </div>

                  <div>
                    <div className="text-sm font-black text-red-800 dark:text-red-200">
                      {summary.emptyStockCount}{" "}
                      barang habis
                    </div>

                    <div className="mt-1 text-xs text-red-700 dark:text-red-300/80">
                      Ending stock nol atau negatif.
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

        {/* ================================================= */}
        {/* TABLE */}
        {/* ================================================= */}

        <section className="mt-5 overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_10px_35px_rgba(24,53,45,0.06)] dark:border-slate-800 dark:bg-[#0b1714]">

          <div className="border-b border-slate-100 px-5 py-5 dark:border-slate-800">

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

              <div>
                <div className="flex flex-wrap items-center gap-2">

                  <h2 className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100">
                    Detail Inventory
                  </h2>

                  {selectedOutlet && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {selectedOutlet.code}
                    </span>
                  )}

                  {refreshing && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      REFRESHING
                    </span>
                  )}
                </div>

                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  {filteredRows.length} item ditampilkan
                  · {formatMonthLabel(month)}
                  {selectedOutlet
                    ? ` · ${selectedOutlet.name}`
                    : ""}
                </p>
              </div>

              <div className="flex items-center gap-3">

                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                  Baris
                </span>

                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(
                      Number(
                        event.target.value,
                      ),
                    );
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <option value={25}>
                    25
                  </option>

                  <option value={50}>
                    50
                  </option>

                  <option value={100}>
                    100
                  </option>
                </select>

              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[480px] items-center justify-center">

              <div className="text-center">

                <div className="relative mx-auto h-14 w-14">

                  <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-slate-800" />

                  <div
                    className="absolute inset-0 animate-spin rounded-full border-4 border-transparent"
                    style={{
                      borderTopColor:
                        PRIMARY,
                    }}
                  />

                </div>

                <div className="mt-5 text-sm font-black text-slate-600 dark:text-slate-300">
                  Memuat inventory...
                </div>

                <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Menyiapkan snapshot inventory
                  bulanan
                </div>

              </div>
            </div>
          ) : filteredRows.length ===
            0 ? (
            <div className="flex min-h-[480px] items-center justify-center px-6">

              <div className="max-w-md text-center">

                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] border border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <IconPackage />
                </div>

                <h3 className="mt-5 text-xl font-black text-slate-800 dark:text-slate-100">
                  Tidak ada data inventory
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-400 dark:text-slate-500">
                  Tidak ada barang yang ditemukan
                  untuk periode, outlet, atau filter
                  yang dipilih.
                </p>

                {(search ||
                  category !==
                    "ALL") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setCategory("ALL");
                      setPage(1);
                    }}
                    className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">

                <table className="min-w-[1780px] w-full border-collapse">

                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90 dark:border-slate-800 dark:bg-[#101f1b]">

                      <th className="sticky left-0 z-30 min-w-[65px] border-r border-slate-200 bg-slate-50 px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-[#101f1b] dark:text-slate-400">
                        #
                      </th>

                      <th className="sticky left-[65px] z-30 min-w-[125px] border-r border-slate-200 bg-slate-50 px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-[#101f1b] dark:text-slate-400">
                        Kode
                      </th>

                      <th className="min-w-[130px] px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Kategori
                      </th>

                      <th className="min-w-[240px] px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Nama Barang
                      </th>

                      <th className="min-w-[90px] px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Unit
                      </th>

                      <th className="min-w-[100px] px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Base Unit
                      </th>

                      <th className="min-w-[115px] px-3 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Konversi
                      </th>

                      <th className="min-w-[120px] px-3 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Stock Awal
                      </th>

                      <th className="min-w-[130px] px-3 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Barang Masuk
                      </th>

                      <th className="min-w-[130px] px-3 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Barang Keluar
                      </th>

                      <th className="min-w-[135px] px-3 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Ending Stock
                      </th>

                      <th className="min-w-[150px] px-3 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Harga / Cost
                      </th>

                      <th className="min-w-[155px] px-3 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Cost Pemakaian
                      </th>

                      <th className="min-w-[120px] px-3 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        % Pemakaian
                      </th>

                      <th className="min-w-[175px] px-3 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Perbandingan Cost
                      </th>

                      <th className="min-w-[125px] px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Status Cost
                      </th>

                      <th className="min-w-[135px] px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Status Stock
                      </th>

                    </tr>
                  </thead>

                  <tbody>

                    {visibleRows.map(
                      (row, index) => {
                        const rowNumber =
                          (page - 1) *
                            pageSize +
                          index +
                          1;

                        return (
                          <tr
                            key={row.id}
                            className="group border-b border-slate-100 transition hover:bg-emerald-50/40 dark:border-slate-800 dark:hover:bg-emerald-950/20"
                          >

                            <td className="sticky left-0 z-10 border-r border-slate-100 bg-white px-3 py-3 text-xs font-bold text-slate-400 group-hover:bg-emerald-50/40 dark:border-slate-800 dark:bg-[#0b1714] dark:text-slate-600 dark:group-hover:bg-emerald-950/20">
                              {rowNumber}
                            </td>

                            <td className="sticky left-[65px] z-10 border-r border-slate-100 bg-white px-3 py-3 group-hover:bg-emerald-50/40 dark:border-slate-800 dark:bg-[#0b1714] dark:group-hover:bg-emerald-950/20">
                              <div className="font-mono text-xs font-black text-slate-700 dark:text-slate-300">
                                {row.code}
                              </div>
                            </td>

                            <td className="px-3 py-3">
                              <span className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {row.category}
                              </span>
                            </td>

                            <td className="px-3 py-3">
                              <div className="text-sm font-black text-slate-800 dark:text-slate-100">
                                {row.name}
                              </div>
                            </td>

                            <td className="px-3 py-3 text-center text-xs font-bold text-slate-600 dark:text-slate-300">
                              {row.unit}
                            </td>

                            <td className="px-3 py-3 text-center text-xs font-bold text-slate-600 dark:text-slate-300">
                              {row.baseUnit}
                            </td>

                            <td className="px-3 py-3 text-right">
                              <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                {formatNumber(
                                  row.conversionRate,
                                )}
                              </div>

                              {row.baseUnit !==
                                "-" &&
                                row.conversionRate >
                                  0 && (
                                  <div className="mt-0.5 text-[9px] text-slate-400 dark:text-slate-600">
                                    1{" "}
                                    {row.unit}{" "}
                                    ={" "}
                                    {formatNumber(
                                      row.conversionRate,
                                    )}{" "}
                                    {
                                      row.baseUnit
                                    }
                                  </div>
                                )}
                            </td>

                            <td className="px-3 py-3 text-right">
                              <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                {formatNumber(
                                  row.openingStock,
                                )}
                              </div>

                              <div className="mt-0.5 text-[9px] uppercase tracking-wide text-slate-400 dark:text-slate-600">
                                Opening
                              </div>
                            </td>

                            <td className="px-3 py-3 text-right">
                              <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                                +
                                {formatNumber(
                                  row.incomingQty,
                                )}
                              </span>
                            </td>

                            <td className="px-3 py-3 text-right">
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                -
                                {formatNumber(
                                  row.outgoingQty,
                                )}
                              </span>
                            </td>

                            <td className="px-3 py-3 text-right">
                              <div className="text-sm font-black text-[#18352D] dark:text-emerald-200">
                                {formatNumber(
                                  row.endingStock,
                                )}
                              </div>

                              {row.minimumStock >
                                0 && (
                                <div className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-600">
                                  Min.{" "}
                                  {formatNumber(
                                    row.minimumStock,
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="px-3 py-3 text-right">
                              <div className="text-xs font-black text-slate-700 dark:text-slate-200">
                                {formatCurrency(
                                  row.averageCost,
                                )}
                              </div>

                              <div className="mt-0.5 text-[9px] text-slate-400 dark:text-slate-600">
                                / {row.unit}
                              </div>
                            </td>

                            <td className="px-3 py-3 text-right">
                              <div className="text-xs font-black text-slate-800 dark:text-slate-100">
                                {formatCurrency(
                                  row.outgoingCost,
                                )}
                              </div>

                              <div className="mt-0.5 text-[9px] text-slate-400 dark:text-slate-600">
                                qty × cost
                              </div>
                            </td>

                            <td className="px-3 py-3 text-right">
                              <div className="text-xs font-black text-slate-700 dark:text-slate-200">
                                {formatNumber(
                                  row.usagePercentage,
                                )}
                                %
                              </div>

                              <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      Math.max(
                                        0,
                                        row.usagePercentage,
                                      ),
                                    )}%`,
                                    backgroundColor:
                                      PRIMARY,
                                  }}
                                />
                              </div>
                            </td>

                            <td className="px-3 py-3 text-right">
                              <div className="flex flex-col items-end gap-1.5">

                                <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                                  Sebelumnya
                                </div>

                                <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                  {formatCurrency(
                                    row.previousOutgoingCost,
                                  )}
                                </div>

                                <span
                                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-black ${costStatusClass(
                                    row.costStatus,
                                  )}`}
                                >
                                  <CostStatusIcon
                                    status={
                                      row.costStatus
                                    }
                                  />

                                  {row.costChangePercentage >
                                  0
                                    ? "+"
                                    : ""}
                                  {formatNumber(
                                    row.costChangePercentage,
                                  )}
                                  %
                                </span>

                              </div>
                            </td>

                            <td className="px-3 py-3 text-center">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-black ${costStatusClass(
                                  row.costStatus,
                                )}`}
                              >
                                <CostStatusIcon
                                  status={
                                    row.costStatus
                                  }
                                />

                                {row.costStatus}
                              </span>
                            </td>

                            <td className="px-3 py-3 text-center">
                              <span
                                className={`inline-flex items-center rounded-lg border px-2.5 py-1.5 text-[10px] font-black ${statusStockClass(
                                  row.stockStatus,
                                )}`}
                              >
                                {row.stockStatus}
                              </span>
                            </td>

                          </tr>
                        );
                      },
                    )}

                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">

                <div className="text-xs text-slate-400 dark:text-slate-500">
                  Menampilkan{" "}
                  <span className="font-black text-slate-600 dark:text-slate-300">
                    {filteredRows.length ===
                    0
                      ? 0
                      : (page - 1) *
                          pageSize +
                        1}
                  </span>{" "}
                  sampai{" "}
                  <span className="font-black text-slate-600 dark:text-slate-300">
                    {Math.min(
                      page *
                        pageSize,
                      filteredRows.length,
                    )}
                  </span>{" "}
                  dari{" "}
                  <span className="font-black text-slate-600 dark:text-slate-300">
                    {filteredRows.length}
                  </span>{" "}
                  barang
                </div>

                <div className="flex items-center gap-1">

                  <button
                    type="button"
                    disabled={
                      page <= 1
                    }
                    onClick={() =>
                      setPage(
                        (value) =>
                          Math.max(
                            1,
                            value - 1,
                          ),
                      )
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Sebelumnya
                  </button>

                  <span className="min-w-[80px] px-3 text-center text-xs font-black text-slate-500 dark:text-slate-400">
                    {page} /{" "}
                    {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={
                      page >=
                      totalPages
                    }
                    onClick={() =>
                      setPage(
                        (value) =>
                          Math.min(
                            totalPages,
                            value + 1,
                          ),
                      )
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Berikutnya
                  </button>

                </div>
              </div>
            </>
          )}
        </section>

        {/* ================================================= */}
        {/* FOOTNOTE */}
        {/* ================================================= */}

        <section className="mt-4 rounded-[22px] border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-[#0d1b18]">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-start gap-3">

              <div className="mt-0.5 rounded-xl bg-emerald-50 p-2.5 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                <IconInfo />
              </div>

              <div>
                <div className="text-xs font-black text-slate-700 dark:text-slate-200">
                  Monthly Inventory Snapshot
                </div>

                <div className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-400 dark:text-slate-500">
                  Ending Stock disimpan sebagai
                  snapshot bulanan. Hasil Stock
                  Opname pada bulan yang sama tidak
                  digunakan untuk menimpa Ending
                  Stock tersebut.
                </div>
              </div>

            </div>

            <div className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-300 dark:text-slate-700">
              MGB ERP · Outlet Inventory
            </div>

          </div>
        </section>
      </div>

      {/* =================================================== */}
      {/* INFO MODAL */}
      {/* =================================================== */}

      {showInfo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md"
          onMouseDown={() =>
            setShowInfo(false)
          }
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[30px] border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#0d1b18]"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <div
              className="relative overflow-hidden p-6 text-white sm:p-7"
              style={{
                background:
                  `linear-gradient(135deg, ${DARK}, ${PRIMARY})`,
              }}
            >

              <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full border border-white/10" />

              <div className="absolute -right-4 -top-8 h-28 w-28 rounded-full border border-white/10" />

              <div className="relative flex items-start justify-between gap-4">

                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-100">
                    Inventory Rule
                  </div>

                  <h3 className="mt-2 text-2xl font-black">
                    Cara Inventory Bulanan
                  </h3>

                  <p className="mt-2 max-w-xl text-xs leading-5 text-emerald-50/80">
                    Inventory dihitung sebagai
                    snapshot periodik agar opening,
                    movement, ending stock, dan cost
                    dapat dibandingkan antar bulan.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowInfo(false)
                  }
                  className="rounded-xl bg-white/10 p-2.5 transition hover:bg-white/20"
                >
                  <IconClose />
                </button>

              </div>
            </div>

            <div className="space-y-4 p-6">

              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">

                <div className="flex items-start gap-3">

                  <div className="rounded-xl bg-white p-2.5 text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300">
                    <IconUser />
                  </div>

                  <div className="min-w-0">

                    <div className="text-sm font-black text-blue-950 dark:text-blue-200">
                      User Access
                    </div>

                    <div className="mt-2 grid gap-2 sm:grid-cols-3">

                      <div>
                        <div className="text-[9px] font-black uppercase tracking-wider text-blue-500">
                          User
                        </div>

                        <div className="mt-0.5 truncate text-xs font-bold text-blue-900 dark:text-blue-100">
                          {displayName}
                        </div>
                      </div>

                      <div>
                        <div className="text-[9px] font-black uppercase tracking-wider text-blue-500">
                          Role
                        </div>

                        <div className="mt-0.5 text-xs font-bold text-blue-900 dark:text-blue-100">
                          {currentRoleLabel}
                        </div>
                      </div>

                      <div>
                        <div className="text-[9px] font-black uppercase tracking-wider text-blue-500">
                          Scope
                        </div>

                        <div className="mt-0.5 truncate text-xs font-bold text-blue-900 dark:text-blue-100">
                          {canSelectOutlet
                            ? "Semua outlet"
                            : scopeText}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">

                <div className="flex items-center gap-2">

                  <div className="rounded-lg bg-white p-2 text-emerald-700 shadow-sm dark:bg-slate-900 dark:text-emerald-300">
                    <IconPackage />
                  </div>

                  <div className="text-sm font-black text-emerald-900 dark:text-emerald-200">
                    Stock Awal
                  </div>

                </div>

                <p className="mt-3 text-xs leading-6 text-emerald-700 dark:text-emerald-300/80">
                  Stock Awal periode diambil dari
                  hasil{" "}
                  <strong>
                    Approved Monthly Stock
                    Opname bulan sebelumnya
                  </strong>
                  . Stock Opname bulan berjalan tidak
                  digunakan untuk menimpa Ending Stock
                  bulan tersebut.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">

                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    01
                  </div>

                  <div className="mt-2 text-sm font-black text-slate-700 dark:text-slate-200">
                    Stock Awal
                  </div>

                  <div className="mt-1 text-[11px] leading-5 text-slate-400 dark:text-slate-500">
                    Approved Monthly Stock
                    Opname sebelumnya.
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    02
                  </div>

                  <div className="mt-2 text-sm font-black text-slate-700 dark:text-slate-200">
                    Pergerakan
                  </div>

                  <div className="mt-1 text-[11px] leading-5 text-slate-400 dark:text-slate-500">
                    Barang masuk dan barang keluar
                    pada periode tersebut.
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    03
                  </div>

                  <div className="mt-2 text-sm font-black text-slate-700 dark:text-slate-200">
                    Ending Stock
                  </div>

                  <div className="mt-1 text-[11px] leading-5 text-slate-400 dark:text-slate-500">
                    Opening + Masuk − Keluar.
                  </div>
                </div>

              </div>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                  <div>
                    <div className="text-sm font-black text-slate-700 dark:text-slate-200">
                      Perbandingan Cost
                    </div>

                    <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Dibandingkan dengan periode
                      sebelumnya.
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">

                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] font-black text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                      <CostStatusIcon status="NAIK" />
                      NAIK
                    </span>

                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-black text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <CostStatusIcon status="STABIL" />
                      STABIL
                    </span>

                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-black text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <CostStatusIcon status="TURUN" />
                      TURUN
                    </span>

                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">

                <div className="text-sm font-black text-slate-700 dark:text-slate-200">
                  Status Stock
                </div>

                <div className="mt-3 flex flex-wrap gap-2">

                  <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-black text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                    AMAN
                  </span>

                  <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-black text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                    LOW STOCK
                  </span>

                  <span className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-black text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                    HABIS
                  </span>

                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">

                <div className="flex items-start gap-3">

                  <div className="rounded-lg bg-white p-2 text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                    {canSelectOutlet ? (
                      <IconBuilding />
                    ) : (
                      <IconLock />
                    )}
                  </div>

                  <div>

                    <div className="text-sm font-black text-slate-700 dark:text-slate-200">
                      Scope Outlet
                    </div>

                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {canSelectOutlet
                        ? `${currentRoleLabel} memiliki akses untuk memilih dan membaca inventory dari outlet yang tersedia.`
                        : "User outlet terkunci ke outlet yang terhubung dengan session dan tidak dapat berpindah ke outlet lain."}
                    </p>

                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowInfo(false)
                }
                className="w-full rounded-xl px-4 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:opacity-95"
                style={{
                  backgroundColor:
                    PRIMARY,
                }}
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================= */}
      {/* CSS VARIABLES */}
      {/* ================================================= */}

      <style jsx global>{`
        :root {
          --inventory-heading: #18352d;
        }

        .dark {
          --inventory-heading: #d7f4e8;
        }

        select,
        input {
          color-scheme: light;
        }

        .dark select,
        .dark input {
          color-scheme: dark;
        }
      `}</style>
    </div>
  );
}