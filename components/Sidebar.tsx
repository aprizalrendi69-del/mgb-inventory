"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ElementType } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  LayoutDashboard,
  CalendarCheck,
  History,
  Package,
  Truck,
  Users,
  UserCog,
  UserRound,
  ShoppingCart,
  Tag,
  ClipboardCheck,
  ArrowDownToLine,
  Warehouse,
  Boxes,
  PackageMinus,
  ArrowLeftRight,
  ClipboardList,
  SlidersHorizontal,
  FileClock,
  Send,
  FileText,
  Settings,
  ChevronRight,
  TrendingUp,
  ArrowDownCircle,
  Trash2,
  CreditCard,
  WalletCards,
  Factory,
  Utensils,
  X,
  Search,
  Sparkles,
} from "lucide-react";

/*
 * =========================================================
 * ROLE
 * =========================================================
 *
 * STAFF_OUTLET ditambahkan karena digunakan pada menu
 * Manufacture.
 *
 * ADMIN_PUSAT juga disiapkan sebagai alias defensif apabila
 * backend mengembalikan role tersebut.
 * =========================================================
 */

type Role =
  | "ADMIN"
  | "ADMIN_PUSAT"
  | "MANAGER"
  | "PURCHASING"
  | "GUDANG"
  | "OUTLET_ADMIN"
  | "KASIR"
  | "STAFF_OUTLET";

interface User {
  id?: number;
  username?: string;
  fullname?: string;
  role?: Role;
  photo?: string | null;
  outletId?: number | null;
}

type BadgeKey =
  | "approvalPurchase"
  | "barangMasuk"
  | "deliveryOrder"
  | "deliveryRequest"
  | "suratJalan"
  | "approvalWastePusat"
  | "barangMasukOutlet"
  | "approvalWasteOutlet"
  | "approvalStockOpname";

type IconTone =
  | "emerald"
  | "teal"
  | "cyan"
  | "sky"
  | "blue"
  | "violet"
  | "amber"
  | "orange"
  | "rose"
  | "indigo"
  | "slate";

interface Menu {
  title: string;
  url?: string;
  roles?: Role[];
  header?: boolean;
  icon?: ElementType;
  iconTone?: IconTone;
  badgeKey?: BadgeKey;
}

interface PendingCounts {
  approvalPurchase: number;
  barangMasuk: number;
  deliveryOrder: number;
  deliveryRequest: number;
  suratJalan: number;
  approvalWastePusat: number;
  barangMasukOutlet: number;
  approvalWasteOutlet: number;
  approvalStockOpname: number;
}

const EMPTY_PENDING_COUNTS: PendingCounts = {
  approvalPurchase: 0,
  barangMasuk: 0,
  deliveryOrder: 0,
  deliveryRequest: 0,
  suratJalan: 0,
  approvalWastePusat: 0,
  barangMasukOutlet: 0,
  approvalWasteOutlet: 0,
  approvalStockOpname: 0,
};

/*
 * =========================================================
 * ICON TONES
 * =========================================================
 */

const ICON_TONES: Record<
  IconTone,
  {
    icon: string;
    bg: string;
    border: string;
    glow: string;
  }
> = {
  emerald: {
    icon: "text-emerald-300 group-hover:text-emerald-200",
    bg: "bg-emerald-400/[0.075] group-hover:bg-emerald-400/[0.115]",
    border:
      "border-emerald-300/[0.08] group-hover:border-emerald-300/[0.13]",
    glow: "bg-emerald-400/[0.12]",
  },

  teal: {
    icon: "text-teal-300 group-hover:text-teal-200",
    bg: "bg-teal-400/[0.075] group-hover:bg-teal-400/[0.115]",
    border:
      "border-teal-300/[0.08] group-hover:border-teal-300/[0.13]",
    glow: "bg-teal-400/[0.12]",
  },

  cyan: {
    icon: "text-cyan-300 group-hover:text-cyan-200",
    bg: "bg-cyan-400/[0.075] group-hover:bg-cyan-400/[0.115]",
    border:
      "border-cyan-300/[0.08] group-hover:border-cyan-300/[0.13]",
    glow: "bg-cyan-400/[0.12]",
  },

  sky: {
    icon: "text-sky-300 group-hover:text-sky-200",
    bg: "bg-sky-400/[0.07] group-hover:bg-sky-400/[0.11]",
    border:
      "border-sky-300/[0.08] group-hover:border-sky-300/[0.13]",
    glow: "bg-sky-400/[0.11]",
  },

  blue: {
    icon: "text-blue-300 group-hover:text-blue-200",
    bg: "bg-blue-400/[0.07] group-hover:bg-blue-400/[0.11]",
    border:
      "border-blue-300/[0.08] group-hover:border-blue-300/[0.13]",
    glow: "bg-blue-400/[0.11]",
  },

  violet: {
    icon: "text-violet-300 group-hover:text-violet-200",
    bg: "bg-violet-400/[0.075] group-hover:bg-violet-400/[0.115]",
    border:
      "border-violet-300/[0.08] group-hover:border-violet-300/[0.13]",
    glow: "bg-violet-400/[0.12]",
  },

  amber: {
    icon: "text-amber-300 group-hover:text-amber-200",
    bg: "bg-amber-400/[0.075] group-hover:bg-amber-400/[0.115]",
    border:
      "border-amber-300/[0.08] group-hover:border-amber-300/[0.13]",
    glow: "bg-amber-400/[0.12]",
  },

  orange: {
    icon: "text-orange-300 group-hover:text-orange-200",
    bg: "bg-orange-400/[0.075] group-hover:bg-orange-400/[0.115]",
    border:
      "border-orange-300/[0.08] group-hover:border-orange-300/[0.13]",
    glow: "bg-orange-400/[0.12]",
  },

  rose: {
    icon: "text-rose-300 group-hover:text-rose-200",
    bg: "bg-rose-400/[0.075] group-hover:bg-rose-400/[0.115]",
    border:
      "border-rose-300/[0.08] group-hover:border-rose-300/[0.13]",
    glow: "bg-rose-400/[0.12]",
  },

  indigo: {
    icon: "text-indigo-300 group-hover:text-indigo-200",
    bg: "bg-indigo-400/[0.075] group-hover:bg-indigo-400/[0.115]",
    border:
      "border-indigo-300/[0.08] group-hover:border-indigo-300/[0.13]",
    glow: "bg-indigo-400/[0.12]",
  },

  slate: {
    icon: "text-slate-300 group-hover:text-slate-200",
    bg: "bg-slate-300/[0.055] group-hover:bg-slate-300/[0.09]",
    border:
      "border-slate-300/[0.07] group-hover:border-slate-300/[0.11]",
    glow: "bg-slate-300/[0.08]",
  },
};

/*
 * =========================================================
 * MENUS
 * =========================================================
 */

const menus: Menu[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "PURCHASING", "GUDANG"],
    icon: LayoutDashboard,
    iconTone: "emerald",
  },

  {
    title: "Dashboard Outlet",
    url: "/outlet/dashboard",
    roles: ["OUTLET_ADMIN"],
    icon: LayoutDashboard,
    iconTone: "teal",
  },

  {
    title: "FINANCE",
    header: true,
  },

  {
    title: "Payment",
    url: "/payment",
    roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER"],
    icon: CreditCard,
    iconTone: "sky",
  },

  {
    title: "Purchase Payable / Hutang",
    url: "/purchase-payable",
    roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "OUTLET_ADMIN"],
    icon: FileClock,
    iconTone: "amber",
  },

  {
    title: "Petty Cash",
    url: "/petty-cash",
    roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "OUTLET_ADMIN"],
    icon: WalletCards,
    iconTone: "emerald",
  },

  {
    title: "PURCHASE & DELIVERY CENTRAL",
    header: true,
  },

  {
    title: "Purchase Order",
    url: "/purchase",
    roles: ["ADMIN", "ADMIN_PUSAT"],
    icon: ShoppingCart,
    iconTone: "emerald",
  },

  {
    title: "Master Harga",
    url: "/master-harga",
    roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "PURCHASING"],
    icon: Tag,
    iconTone: "amber",
  },

  {
    title: "Approval Purchase",
    url: "/purchase/approve",
    roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "PURCHASING"],
    icon: ClipboardCheck,
    iconTone: "violet",
    badgeKey: "approvalPurchase",
  },

  {
    title: "Barang Masuk",
    url: "/barang-masuk",
    roles: ["ADMIN", "ADMIN_PUSAT", "GUDANG"],
    icon: ArrowDownToLine,
    iconTone: "teal",
    badgeKey: "barangMasuk",
  },

  {
    title: "Barang Keluar Pusat & Delivery Request",
    url: "/barang-keluar",
    roles: ["ADMIN", "ADMIN_PUSAT", "GUDANG"],
    icon: PackageMinus,
    iconTone: "orange",
    badgeKey: "deliveryRequest",
  },

  {
    title: "Delivery Order",
    url: "/pengiriman",
    roles: ["ADMIN", "ADMIN_PUSAT"],
    icon: Send,
    iconTone: "cyan",
    badgeKey: "deliveryOrder",
  },

  {
    title: "Surat Jalan",
    url: "/surat-jalan",
    roles: ["ADMIN", "ADMIN_PUSAT", "GUDANG"],
    icon: FileText,
    iconTone: "sky",
    badgeKey: "suratJalan",
  },

  {
    title: "PUSAT/CENTRAL",
    header: true,
  },

  {
    title: "Stock Pusat",
    url: "/stock",
    roles: ["ADMIN", "ADMIN_PUSAT", "GUDANG"],
    icon: Warehouse,
    iconTone: "emerald",
  },

  {
    title: "Cost Item Stock Pusat",
    url: "/inventory",
    roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "GUDANG"],
    icon: Boxes,
    iconTone: "emerald",
  },

  {
    title: "Expired Barang Pusat",
    url: "/expired",
    roles: ["ADMIN", "ADMIN_PUSAT", "GUDANG"],
    icon: Package,
    iconTone: "rose",
  },

  {
    title: "Stock Opname Pusat",
    url: "/stock-opname",
    roles: ["ADMIN", "ADMIN_PUSAT", "GUDANG"],
    icon: ClipboardList,
    iconTone: "violet",
  },

  {
    title: "Adjustment Stock Pusat",
    url: "/adjustment",
    roles: ["ADMIN", "ADMIN_PUSAT", "GUDANG"],
    icon: SlidersHorizontal,
    iconTone: "amber",
  },

  {
    title: "History Stock Pusat",
    url: "/history",
    roles: ["ADMIN", "ADMIN_PUSAT", "GUDANG"],
    icon: FileClock,
    iconTone: "slate",
  },

  {
    title: "Waste Pusat",
    url: "/waste",
    roles: ["ADMIN", "ADMIN_PUSAT", "GUDANG"],
    icon: Trash2,
    iconTone: "rose",
  },

  {
    title: "Approval Waste Pusat",
    url: "/waste/approval",
    roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER"],
    icon: ClipboardCheck,
    iconTone: "violet",
    badgeKey: "approvalWastePusat",
  },

  {
    title: "MANUFACTURING",
    header: true,
  },

  {
    title: "Menu & BOM",
    url: "/menu",
    roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER"],
    icon: Utensils,
    iconTone: "amber",
  },

  {
    title: "Manufacture",
    url: "/manufacture",
    roles: [
      "ADMIN",
      "ADMIN_PUSAT",
      "MANAGER",
      "GUDANG",
      "OUTLET_ADMIN",
      "STAFF_OUTLET",
    ],
    icon: Factory,
    iconTone: "orange",
  },

  {
    title: "COST CONTROL OUTLET",
    header: true,
  },

  {
    title: "Cost Control",
    url: "/cost-control",
    roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "OUTLET_ADMIN"],
    icon: TrendingUp,
    iconTone: "teal",
  },

  {
    title: "PURCHASE OUTLET & MASTER",
    header: true,
  },

  {
    title: "Master Barang Outlet",
    url: "/outlet/master-barang",
    roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"],
    icon: Package,
    iconTone: "teal",
  },

  {
    title: "Purchase Outlet",
    url: "/outlet/purchase",
    roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"],
    icon: ShoppingCart,
    iconTone: "emerald",
  },

  {
    title: "Transfer Outlet",
    url: "/outlet/transfer",
    roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"],
    icon: ArrowLeftRight,
    iconTone: "indigo",
  },

  {
    title: "OUTLET STOCK ACTIVITY",
    header: true,
  },
  {
    title: "Inventory Outlet",
    url: "/outlet/inventory",
    roles: ["ADMIN", "OUTLET_ADMIN"],
    icon: Boxes,
    iconTone: "emerald",
  },
  {
    title: "Stock Outlet",
    url: "/outlet/stock",
    roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"],
    icon: Boxes,
    iconTone: "emerald",
  },

  {
    title: "Barang Masuk Outlet",
    url: "/outlet/barang-masuk",
    roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"],
    icon: ArrowDownToLine,
    iconTone: "teal",
    badgeKey: "barangMasukOutlet",
  },

  {
    title: "Delivery Request To Gudang Pusat",
    url: "/outlet/delivery-request",
    roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"],
    icon: Truck,
    iconTone: "cyan",
  },

  {
    title: "Barang Keluar Outlet",
    url: "/outlet/barang-keluar",
    roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"],
    icon: ArrowDownCircle,
    iconTone: "orange",
  },

  {
    title: "POS Outlet",
    url: "/outlet/pos",
    roles: ["ADMIN", "ADMIN_PUSAT", "KASIR"],
    icon: ShoppingCart,
    iconTone: "violet",
  },

  {
    title: "Waste Outlet",
    url: "/outlet/waste",
    roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"],
    icon: Trash2,
    iconTone: "rose",
  },

  {
    title: "Approval Waste Outlet",
    url: "/outlet/waste/approval",
    roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER"],
    icon: ClipboardCheck,
    iconTone: "violet",
    badgeKey: "approvalWasteOutlet",
  },

  {
    title: "History Stock Outlet",
    url: "/outlet/history-stock",
    roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"],
    icon: FileClock,
    iconTone: "slate",
  },

  {
    title: "Stock Awal Outlet",
    url: "/outlet/stock-awal",
    roles: ["ADMIN", "ADMIN_PUSAT"],
    icon: Warehouse,
    iconTone: "amber",
  },

  {
    title: "Stock Opname Outlet",
    url: "/outlet/stock-opname",
    roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"],
    icon: ClipboardList,
    iconTone: "violet",
  },

  {
    title: "Approval Stock Opname",
    url: "/outlet/stock-opname/approval",
    roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"],
    icon: ClipboardCheck,
    iconTone: "cyan",
    badgeKey: "approvalStockOpname",
  },

  {
    title: "Adjustment Outlet",
    url: "/outlet/adjustment",
    roles: [
      "ADMIN",
      "ADMIN_PUSAT",
      "MANAGER",
      "OUTLET_ADMIN",
    ],
    icon: SlidersHorizontal,
    iconTone: "amber",
  },

  {
    title: "LAPORAN OUTLET",
    header: true,
  },

  {
    title: "Laporan Barang Masuk Outlet",
    url: "/outlet/laporan/barang-masuk",
    roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"],
    icon: FileText,
    iconTone: "teal",
  },

  {
    title: "Laporan Purchase Outlet",
    url: "/outlet/laporan/purchase",
    roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"],
    icon: FileText,
    iconTone: "emerald",
  },

  {
    title: "Laporan Barang Keluar Outlet",
    url: "/outlet/laporan/barang-keluar",
    roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"],
    icon: PackageMinus,
    iconTone: "orange",
  },

  {
    title: "Laporan Delivery Outlet",
    url: "/outlet/laporan/delivery",
    roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"],
    icon: FileText,
    iconTone: "cyan",
  },

  {
    title: "Laporan Stock Outlet",
    url: "/outlet/laporan/stock",
    roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"],
    icon: FileText,
    iconTone: "violet",
  },

  {
    title: "MASTER DATA PUSAT",
    header: true,
  },

  {
    title: "Master Barang",
    url: "/master-barang",
    roles: ["ADMIN", "ADMIN_PUSAT", "PURCHASING"],
    icon: Package,
    iconTone: "emerald",
  },

  {
    title: "Master Supplier",
    url: "/supplier",
    roles: ["ADMIN", "ADMIN_PUSAT", "PURCHASING"],
    icon: Truck,
    iconTone: "cyan",
  },

  {
    title: "Master Customer",
    url: "/customer",
    roles: ["ADMIN", "ADMIN_PUSAT"],
    icon: Users,
    iconTone: "violet",
  },

  {
    title: "Master User",
    url: "/master/user",
    roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"],
    icon: UserCog,
    iconTone: "indigo",
  },

  {
    title: "Master Outlet",
    url: "/master/outlet",
    roles: ["ADMIN", "ADMIN_PUSAT"],
    icon: Warehouse,
    iconTone: "amber",
  },

  {
    title: "Master Karyawan",
    url: "/employee",
    roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER"],
    icon: UserRound,
    iconTone: "rose",
  },

  {
    title: "Master Account",
    url: "/petty-cash/accounts",
    roles: ["ADMIN", "ADMIN_PUSAT"],
    icon: WalletCards,
    iconTone: "violet",
  },

  {
    title: "LAPORAN PUSAT",
    header: true,
  },

  {
    title: "Laporan Purchase",
    url: "/laporan/purchase",
    roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "PURCHASING"],
    icon: FileText,
    iconTone: "emerald",
  },

  {
    title: "Laporan Barang Masuk",
    url: "/laporan/barang-masuk",
    roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "GUDANG"],
    icon: FileText,
    iconTone: "teal",
  },

  {
    title: "Laporan Barang Keluar",
    url: "/laporan/barang-keluar",
    roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "GUDANG"],
    icon: FileText,
    iconTone: "orange",
  },

  {
    title: "Laporan Inventory",
    url: "/laporan/inventory",
    roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER"],
    icon: FileText,
    iconTone: "emerald",
  },

  {
    title: "Laporan Supplier",
    url: "/laporan/supplier",
    roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "PURCHASING"],
    icon: FileText,
    iconTone: "cyan",
  },

  {
    title: "Laporan Customer",
    url: "/laporan/customer",
    roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "PURCHASING"],
    icon: FileText,
    iconTone: "violet",
  },

  {
    title: "Laporan Attendance",
    url: "/laporan/attendance",
    roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER"],
    icon: FileText,
    iconTone: "sky",
  },

  {
    title: "Laporan Stock Opname",
    url: "/laporan/stock-opname",
    roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "GUDANG"],
    icon: FileText,
    iconTone: "amber",
  },

  {
    title: "SETTING",
    header: true,
  },

  {
    title: "Attendance",
    url: "/attendance",
    roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "GUDANG"],
    icon: CalendarCheck,
    iconTone: "sky",
  },

  {
    title: "Riwayat Absensi",
    url: "/attendance/history",
    roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "GUDANG"],
    icon: History,
    iconTone: "violet",
  },

  {
    title: "Pengaturan",
    url: "/pengaturan",
    roles: ["ADMIN", "ADMIN_PUSAT"],
    icon: Settings,
    iconTone: "slate",
  },
];

/*
 * =========================================================
 * PROPS
 * =========================================================
 */

interface SidebarProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
}

/*
 * =========================================================
 * SIDEBAR
 * =========================================================
 */

export default function Sidebar({
  user,
  open,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();

  const role = user?.role;

  const [pendingCounts, setPendingCounts] =
    useState<PendingCounts>(EMPTY_PENDING_COUNTS);

  const [menuSearch, setMenuSearch] = useState("");

  const searchInputRef =
    useRef<HTMLInputElement>(null);

  /*
   * =====================================================
   * NORMALIZE BADGE COUNT
   * =====================================================
   */

  const normalizeCount = (value: unknown) => {
    const numberValue = Number(value ?? 0);

    if (
      !Number.isFinite(numberValue) ||
      numberValue <= 0
    ) {
      return 0;
    }

    return Math.floor(numberValue);
  };

  /*
   * =====================================================
   * LOAD PENDING COUNTS
   * =====================================================
   */

  const loadPendingCounts = useCallback(async () => {
    if (!user?.id) {
      setPendingCounts(EMPTY_PENDING_COUNTS);
      return;
    }

    try {
      const response = await fetch(
        "/api/sidebar/pending-counts",
        {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache",
          },
        }
      );

      if (!response.ok) {
        console.error(
          "SIDEBAR PENDING COUNTS HTTP ERROR:",
          response.status
        );
        return;
      }

      const data = await response.json();

      if (!data?.success) {
        console.error(
          "SIDEBAR PENDING COUNTS API ERROR:",
          data?.message
        );
        return;
      }

      const counts = data?.counts ?? {};

      setPendingCounts({
        approvalPurchase: normalizeCount(
          counts.approvalPurchase
        ),
        barangMasuk: normalizeCount(
          counts.barangMasuk
        ),
        deliveryOrder: normalizeCount(
          counts.deliveryOrder
        ),
        deliveryRequest: normalizeCount(
          counts.deliveryRequest
        ),
        suratJalan: normalizeCount(
          counts.suratJalan
        ),
        approvalWastePusat: normalizeCount(
          counts.approvalWastePusat
        ),
        barangMasukOutlet: normalizeCount(
          counts.barangMasukOutlet
        ),
        approvalWasteOutlet: normalizeCount(
          counts.approvalWasteOutlet
        ),
        approvalStockOpname: normalizeCount(
          counts.approvalStockOpname
        ),
      });
    } catch (error) {
      console.error(
        "SIDEBAR PENDING COUNTS FETCH ERROR:",
        error
      );
    }
  }, [user?.id]);

  /*
   * =====================================================
   * AUTO REFRESH PENDING COUNTS
   * =====================================================
   */

  useEffect(() => {
    if (!user?.id) {
      setPendingCounts(EMPTY_PENDING_COUNTS);
      return;
    }

    void loadPendingCounts();

    const intervalId = window.setInterval(() => {
      void loadPendingCounts();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    user?.id,
    user?.role,
    user?.outletId,
    loadPendingCounts,
  ]);

  /*
   * =====================================================
   * GLOBAL SIDEBAR REFRESH EVENT
   * =====================================================
   */

  useEffect(() => {
    const handleRefresh = () => {
      void loadPendingCounts();
    };

    window.addEventListener(
      "erp:refresh-sidebar-counts",
      handleRefresh
    );

    return () => {
      window.removeEventListener(
        "erp:refresh-sidebar-counts",
        handleRefresh
      );
    };
  }, [loadPendingCounts]);

  /*
   * =====================================================
   * REFRESH WHEN TAB BECOMES VISIBLE
   * =====================================================
   */

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible"
      ) {
        void loadPendingCounts();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [loadPendingCounts]);

  /*
   * =====================================================
   * ROLE FILTER
   * =====================================================
   */

  const roleFilteredMenus = useMemo(() => {
    return menus.filter((menu) => {
      if (menu.header) {
        return true;
      }

      if (!menu.roles) {
        return false;
      }

      if (!role) {
        return false;
      }

      return menu.roles.includes(role);
    });
  }, [role]);

  /*
   * =====================================================
   * SEARCH FILTER
   *
   * Header hanya ditampilkan apabila section tersebut
   * memiliki minimal satu menu yang cocok.
   * =====================================================
   */

  const filteredMenus = useMemo(() => {
    const query = menuSearch
      .trim()
      .toLowerCase();

    if (!query) {
      return roleFilteredMenus.filter(
        (menu, index, array) => {
          if (!menu.header) {
            return true;
          }

          const nextMenu =
            array[index + 1];

          if (!nextMenu) {
            return false;
          }

          return !nextMenu.header;
        }
      );
    }

    const result: Menu[] = [];

    let currentHeader: Menu | null = null;
    let currentItems: Menu[] = [];

    const flushSection = () => {
      if (currentItems.length === 0) {
        currentHeader = null;
        currentItems = [];
        return;
      }

      if (currentHeader) {
        result.push(currentHeader);
      }

      result.push(...currentItems);

      currentHeader = null;
      currentItems = [];
    };

    for (const menu of roleFilteredMenus) {
      if (menu.header) {
        flushSection();
        currentHeader = menu;
        continue;
      }

      const title =
        menu.title.toLowerCase();

      const url =
        menu.url?.toLowerCase() ?? "";

      const matches =
        title.includes(query) ||
        url.includes(query);

      if (matches) {
        currentItems.push(menu);
      }
    }

    flushSection();

    return result;
  }, [
    menuSearch,
    roleFilteredMenus,
  ]);

  /*
   * =====================================================
   * KEYBOARD SHORTCUT
   *
   * Ctrl + K / Cmd + K
   * =====================================================
   */

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === "Escape") {
        if (menuSearch) {
          setMenuSearch("");
          return;
        }
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();

        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [menuSearch]);

  /*
   * =====================================================
   * CLEAR SEARCH WHEN SIDEBAR CLOSED
   * =====================================================
   */

  useEffect(() => {
    if (!open) {
      setMenuSearch("");
    }
  }, [open]);

  /*
   * =====================================================
   * USER DISPLAY
   * =====================================================
   */

  const displayName =
    user?.fullname ||
    user?.username ||
    "User";

  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) =>
        word.charAt(0)
      )
      .join("")
      .toUpperCase() || "U";

  /*
   * =====================================================
   * ROLE LABEL
   * =====================================================
   */

  const roleLabel = useMemo(() => {
    if (!role) {
      return "USER";
    }

    if (role === "ADMIN_PUSAT") {
      return "ADMIN PUSAT";
    }

    if (role === "OUTLET_ADMIN") {
      return "ADMIN OUTLET";
    }

    if (role === "STAFF_OUTLET") {
      return "STAFF OUTLET";
    }

    return role;
  }, [role]);

  /*
   * =====================================================
   * BADGE
   * =====================================================
   */

  const getBadgeValue = (
    badgeKey?: Menu["badgeKey"]
  ) => {
    if (!badgeKey) {
      return 0;
    }

    const value = Number(
      pendingCounts[badgeKey] ?? 0
    );

    if (
      !Number.isFinite(value) ||
      value <= 0
    ) {
      return 0;
    }

    return Math.floor(value);
  };

  const hasSearch =
    menuSearch.trim().length > 0;

  const searchResultCount =
    filteredMenus.filter(
      (menu) => !menu.header
    ).length;

  /*
   * =====================================================
   * RENDER
   * =====================================================
   */

  return (
    <>
      {/* =================================================
          MOBILE OVERLAY
          ================================================= */}

      {open && (
        <button
          type="button"
          aria-label="Tutup sidebar"
          onClick={onClose}
          className="
            fixed
            inset-0
            z-40
            cursor-default
            bg-slate-950/65
            backdrop-blur-[6px]
            transition-opacity
            duration-300
          "
        />
      )}

      {/* =================================================
          SIDEBAR
          ================================================= */}

      <aside
        className={`
          fixed
          left-0
          top-0
          z-50
          flex
          h-screen
          w-[292px]
          shrink-0
          flex-col
          overflow-hidden

          border-r
          border-white/[0.075]

          bg-[#041c17]

          text-white

          shadow-[24px_0_90px_rgba(0,0,0,0.42)]

          transition-transform
          duration-300
          ease-[cubic-bezier(0.22,1,0.36,1)]

          ${
            open
              ? "translate-x-0"
              : "-translate-x-full"
          }
        `}
      >
        {/* =================================================
            PREMIUM ATMOSPHERE
            ================================================= */}

        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* top emerald glow */}
          <div
            className="
              absolute
              -left-44
              -top-40
              h-[470px]
              w-[470px]
              rounded-full
              bg-emerald-400/[0.085]
              blur-[135px]
            "
          />

          {/* center teal glow */}
          <div
            className="
              absolute
              -right-40
              top-[28%]
              h-[390px]
              w-[390px]
              rounded-full
              bg-teal-300/[0.045]
              blur-[125px]
            "
          />

          {/* bottom glow */}
          <div
            className="
              absolute
              -bottom-48
              -left-32
              h-[440px]
              w-[440px]
              rounded-full
              bg-emerald-500/[0.045]
              blur-[135px]
            "
          />

          {/* radial highlight */}
          <div
            className="
              absolute
              inset-0
              bg-[radial-gradient(circle_at_78%_0%,rgba(255,255,255,0.055),transparent_27%)]
            "
          />

          {/* vertical depth */}
          <div
            className="
              absolute
              inset-0
              bg-gradient-to-b
              from-emerald-950/[0.20]
              via-transparent
              to-black/[0.14]
            "
          />

          {/* subtle grid */}
          <div
            className="
              absolute
              inset-0
              opacity-[0.018]
              [background-image:linear-gradient(rgba(255,255,255,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.4)_1px,transparent_1px)]
              [background-size:32px_32px]
            "
          />
        </div>

        {/* =================================================
            HEADER
            ================================================= */}

        <div
          className="
            relative
            shrink-0
            border-b
            border-white/[0.065]
            px-5
            pb-5
            pt-5
          "
        >
          {/* BRAND */}

          <div className="flex items-start gap-3">
            <div
              className="
                relative
                flex
                h-11
                w-11
                shrink-0
                items-center
                justify-center
                overflow-hidden
                rounded-[14px]
                border
                border-emerald-200/[0.13]
                bg-gradient-to-br
                from-emerald-300/[0.15]
                via-white/[0.045]
                to-transparent
                shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_12px_34px_rgba(0,0,0,0.20)]
              "
            >
              <div
                className="
                  absolute
                  inset-0
                  bg-[radial-gradient(circle_at_30%_20%,rgba(110,231,183,0.20),transparent_48%)]
                "
              />

              <div
                className="
                  absolute
                  bottom-0
                  right-0
                  h-7
                  w-7
                  rounded-full
                  bg-emerald-400/[0.08]
                  blur-xl
                "
              />

              <span
                className="
                  relative
                  text-[10px]
                  font-black
                  tracking-[-0.08em]
                  text-white
                "
              >
                MGB
              </span>
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              <h1
                className="
                  text-[20px]
                  font-bold
                  leading-[1.15]
                  tracking-[-0.04em]
                  text-white
                "
              >
                PT. MITRA GARAM
                <br />
                BOGATAMA
              </h1>

              <div className="mt-2.5 flex items-center gap-2">
                <span className="relative flex h-1.5 w-1.5">
                  <span
                    className="
                      absolute
                      inset-0
                      animate-ping
                      rounded-full
                      bg-emerald-400
                      opacity-25
                    "
                  />

                  <span
                    className="
                      relative
                      h-1.5
                      w-1.5
                      rounded-full
                      bg-emerald-400
                      shadow-[0_0_10px_rgba(52,211,153,0.85)]
                    "
                  />
                </span>

                <p
                  className="
                    text-[7px]
                    font-semibold
                    uppercase
                    tracking-[0.20em]
                    text-slate-400
                  "
                >
                  ERP Inventory System
                </p>
              </div>
            </div>

            {/* CLOSE */}

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup sidebar"
              className="
                group
                relative
                mt-0.5
                flex
                h-8
                w-8
                shrink-0
                items-center
                justify-center
                rounded-xl
                border
                border-white/[0.07]
                bg-white/[0.025]
                text-slate-400
                transition-all
                duration-200
                hover:-rotate-90
                hover:border-emerald-300/[0.14]
                hover:bg-emerald-400/[0.06]
                hover:text-white
                active:scale-90
              "
            >
              <X
                size={15}
                strokeWidth={1.8}
                className="
                  transition-transform
                  duration-200
                  group-hover:scale-110
                "
              />
            </button>
          </div>

          {/* =================================================
              USER PROFILE
              ================================================= */}

          <div
            className="
              group
              relative
              mt-5
              overflow-hidden
              rounded-2xl
              border
              border-white/[0.075]
              bg-white/[0.035]
              p-3
              shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_14px_34px_rgba(0,0,0,0.13)]
              backdrop-blur-xl
              transition-all
              duration-300
              hover:border-emerald-200/[0.11]
              hover:bg-white/[0.045]
            "
          >
            <div
              className="
                pointer-events-none
                absolute
                -left-12
                -top-12
                h-32
                w-32
                rounded-full
                bg-emerald-400/[0.075]
                blur-3xl
              "
            />

            <div
              className="
                pointer-events-none
                absolute
                inset-x-0
                top-0
                h-px
                bg-gradient-to-r
                from-transparent
                via-emerald-300/[0.11]
                to-transparent
              "
            />

            <div className="relative flex items-center gap-3">
              {/* AVATAR */}

              <div className="relative h-10 w-10 shrink-0">
                <div
                  className="
                    relative
                    h-10
                    w-10
                    overflow-hidden
                    rounded-xl
                    border
                    border-white/[0.10]
                    bg-gradient-to-br
                    from-emerald-300/[0.16]
                    via-white/[0.04]
                    to-transparent
                    shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]
                    transition-transform
                    duration-300
                    group-hover:scale-[1.04]
                  "
                >
                  {user?.photo ? (
                    <img
                      src={user.photo}
                      alt={displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="
                        flex
                        h-full
                        w-full
                        items-center
                        justify-center
                        bg-[radial-gradient(circle_at_35%_25%,rgba(110,231,183,0.16),transparent_55%)]
                        text-[10px]
                        font-black
                        tracking-wide
                        text-white
                      "
                    >
                      {initials}
                    </div>
                  )}
                </div>

                <span
                  className="
                    absolute
                    -bottom-0.5
                    -right-0.5
                    h-2
                    w-2
                    rounded-full
                    border-2
                    border-[#09261f]
                    bg-emerald-400
                    shadow-[0_0_9px_rgba(52,211,153,0.85)]
                  "
                />
              </div>

              {/* USER INFO */}

              <div className="min-w-0 flex-1">
                <p
                  className="
                    truncate
                    text-[11px]
                    font-bold
                    leading-4
                    text-white
                  "
                >
                  {displayName}
                </p>

                <div className="mt-1 flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-emerald-400/70" />

                  <p
                    className="
                      truncate
                      text-[7px]
                      font-bold
                      uppercase
                      tracking-[0.14em]
                      text-slate-500
                    "
                  >
                    {roleLabel}
                  </p>
                </div>
              </div>

              {/* ONLINE */}

              <div
                className="
                  flex
                  shrink-0
                  items-center
                  gap-1.5
                  rounded-full
                  border
                  border-emerald-300/[0.08]
                  bg-emerald-300/[0.035]
                  px-2
                  py-1
                "
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span
                    className="
                      absolute
                      inset-0
                      animate-ping
                      rounded-full
                      bg-emerald-400
                      opacity-20
                    "
                  />

                  <span
                    className="
                      relative
                      h-1.5
                      w-1.5
                      rounded-full
                      bg-emerald-400
                      shadow-[0_0_7px_rgba(52,211,153,0.75)]
                    "
                  />
                </span>

                <span
                  className="
                    text-[6px]
                    font-bold
                    uppercase
                    tracking-[0.12em]
                    text-slate-400
                  "
                >
                  Online
                </span>
              </div>
            </div>
          </div>

          {/* =================================================
              SEARCH
              ================================================= */}

          <div className="relative mt-3.5">
            <div
              className={`
                group
                relative
                flex
                h-[41px]
                items-center
                overflow-hidden
                rounded-xl
                border
                bg-black/[0.12]
                transition-all
                duration-200

                ${
                  hasSearch
                    ? `
                      border-emerald-300/[0.18]
                      bg-emerald-400/[0.045]
                      shadow-[0_8px_25px_rgba(0,0,0,0.10)]
                    `
                    : `
                      border-white/[0.075]
                      hover:border-white/[0.11]
                      hover:bg-white/[0.035]
                    `
                }
              `}
            >
              <span
                className={`
                  pointer-events-none
                  ml-3
                  flex
                  shrink-0
                  items-center
                  justify-center
                  transition-colors
                  duration-200

                  ${
                    hasSearch
                      ? "text-emerald-300"
                      : "text-slate-500 group-focus-within:text-emerald-300"
                  }
                `}
              >
                <Search
                  size={15}
                  strokeWidth={1.9}
                />
              </span>

              <input
                ref={searchInputRef}
                type="text"
                value={menuSearch}
                onChange={(event) =>
                  setMenuSearch(
                    event.target.value
                  )
                }
                placeholder="Cari menu..."
                aria-label="Cari menu sidebar"
                spellCheck={false}
                autoComplete="off"
                className="
                  min-w-0
                  flex-1
                  bg-transparent
                  px-2.5
                  text-[10px]
                  font-medium
                  text-white
                  outline-none
                  placeholder:text-slate-600
                "
              />

              {hasSearch ? (
                <button
                  type="button"
                  aria-label="Hapus pencarian"
                  onClick={() => {
                    setMenuSearch("");
                    searchInputRef.current?.focus();
                  }}
                  className="
                    mr-1.5
                    flex
                    h-7
                    w-7
                    shrink-0
                    items-center
                    justify-center
                    rounded-lg
                    text-slate-500
                    transition-all
                    duration-200
                    hover:bg-white/[0.07]
                    hover:text-white
                    active:scale-90
                  "
                >
                  <X
                    size={13}
                    strokeWidth={2}
                  />
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="Fokus pencarian menu"
                  onClick={() =>
                    searchInputRef.current?.focus()
                  }
                  className="
                    mr-2
                    hidden
                    h-6
                    shrink-0
                    items-center
                    rounded-md
                    border
                    border-white/[0.06]
                    bg-white/[0.025]
                    px-1.5
                    text-[6px]
                    font-bold
                    tracking-[0.08em]
                    text-slate-600
                    transition-colors
                    hover:border-white/[0.10]
                    hover:text-slate-400
                    min-[1100px]:flex
                  "
                >
                  CTRL K
                </button>
              )}
            </div>

            {hasSearch && (
              <div
                className="
                  mt-1.5
                  flex
                  items-center
                  justify-between
                  px-1
                "
              >
                <span
                  className="
                    text-[6.5px]
                    font-bold
                    uppercase
                    tracking-[0.14em]
                    text-slate-600
                  "
                >
                  Hasil pencarian
                </span>

                <span
                  className="
                    rounded-full
                    border
                    border-emerald-300/[0.07]
                    bg-emerald-300/[0.025]
                    px-1.5
                    py-0.5
                    text-[6.5px]
                    font-bold
                    text-emerald-400/70
                  "
                >
                  {searchResultCount}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* =================================================
            NAVIGATION
            ================================================= */}

        <nav
          aria-label="Navigasi utama"
          className="
            relative
            flex-1
            overflow-y-auto
            px-3.5
            py-3.5

            [&::-webkit-scrollbar]:w-1
            [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-thumb]:rounded-full
            [&::-webkit-scrollbar-thumb]:bg-white/[0.065]
            hover:[&::-webkit-scrollbar-thumb]:bg-white/[0.12]
          "
        >
          {/* TOP FADE */}

          <div
            className="
              pointer-events-none
              sticky
              left-0
              right-0
              top-[-14px]
              z-20
              -mb-1
              h-3
              bg-gradient-to-b
              from-[#041c17]
              to-transparent
            "
          />

          {filteredMenus.length === 0 ? (
            <div
              className="
                flex
                min-h-[210px]
                flex-col
                items-center
                justify-center
                px-5
                text-center
              "
            >
              <div
                className="
                  relative
                  flex
                  h-12
                  w-12
                  items-center
                  justify-center
                  rounded-2xl
                  border
                  border-white/[0.07]
                  bg-white/[0.025]
                  text-slate-600
                  shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]
                "
              >
                <div
                  className="
                    absolute
                    inset-0
                    rounded-2xl
                    bg-emerald-400/[0.035]
                    blur-xl
                  "
                />

                <Search
                  size={18}
                  strokeWidth={1.6}
                  className="relative"
                />
              </div>

              <p
                className="
                  mt-3
                  text-[10px]
                  font-bold
                  text-slate-400
                "
              >
                Menu tidak ditemukan
              </p>

              <p
                className="
                  mt-1
                  max-w-[190px]
                  text-[7px]
                  leading-relaxed
                  text-slate-600
                "
              >
                Tidak ada menu yang cocok dengan
                pencarian "{menuSearch.trim()}"."
              </p>

              <button
                type="button"
                onClick={() =>
                  setMenuSearch("")
                }
                className="
                  mt-3
                  rounded-lg
                  border
                  border-emerald-300/[0.09]
                  bg-emerald-300/[0.035]
                  px-3
                  py-1.5
                  text-[7px]
                  font-bold
                  uppercase
                  tracking-[0.10em]
                  text-emerald-300/80
                  transition-all
                  hover:border-emerald-300/[0.16]
                  hover:bg-emerald-300/[0.06]
                  hover:text-emerald-200
                  active:scale-95
                "
              >
                Hapus Pencarian
              </button>
            </div>
          ) : (
            filteredMenus.map(
              (menu, index) => {
                /*
                 * =========================================
                 * SECTION HEADER
                 * =========================================
                 */

                if (menu.header) {
                  return (
                    <div
                      key={`header-${menu.title}-${index}`}
                      className="
                        mb-2
                        mt-6
                        flex
                        items-center
                        gap-2.5
                        px-3
                        pt-1
                      "
                    >
                      <span
                        className="
                          h-px
                          w-3
                          bg-gradient-to-r
                          from-emerald-400/[0.40]
                          to-transparent
                        "
                      />

                      <span
                        className="
                          text-[8px]
                          font-bold
                          uppercase
                          tracking-[0.23em]
                          text-slate-500
                        "
                      >
                        {menu.title}
                      </span>

                      <span
                        className="
                          h-px
                          flex-1
                          bg-gradient-to-r
                          from-white/[0.045]
                          to-transparent
                        "
                      />
                    </div>
                  );
                }

                if (!menu.url) {
                  return null;
                }

                const active =
                  pathname === menu.url ||
                  pathname.startsWith(
                    `${menu.url}/`
                  );

                const Icon =
                  menu.icon || Package;

                const tone =
                  ICON_TONES[
                    menu.iconTone ||
                      "emerald"
                  ] ??
                  ICON_TONES.emerald;

                const badgeValue =
                  getBadgeValue(
                    menu.badgeKey
                  );

                const hasBadge =
                  badgeValue > 0;

                return (
                  <Link
                    key={menu.url}
                    href={menu.url}
                    onClick={() => {
                      if (
                        pathname !==
                        menu.url
                      ) {
                        window.dispatchEvent(
                          new CustomEvent(
                            "erp:navigation-start"
                          )
                        );
                      }

                      onClose();
                    }}
                    aria-current={
                      active
                        ? "page"
                        : undefined
                    }
                    className={`
                      group
                      relative
                      mb-1
                      flex
                      h-[43px]
                      items-center
                      overflow-hidden
                      rounded-xl
                      px-2.5

                      border

                      transition-all
                      duration-200
                      ease-out

                      ${
                        active
                          ? `
                            border-emerald-200/[0.10]
                            bg-gradient-to-r
                            from-white/[0.085]
                            via-emerald-400/[0.065]
                            to-transparent
                            text-white
                            shadow-[0_8px_25px_rgba(0,0,0,0.13)]
                          `
                          : `
                            border-transparent
                            text-slate-400
                            hover:border-white/[0.055]
                            hover:bg-white/[0.035]
                            hover:text-white
                          `
                      }
                    `}
                  >
                    {/* ACTIVE INDICATOR */}

                    {active && (
                      <>
                        <span
                          className="
                            absolute
                            left-0
                            top-1/2
                            h-6
                            w-[3px]
                            -translate-y-1/2
                            rounded-r-full
                            bg-emerald-300
                            shadow-[0_0_15px_rgba(52,211,153,0.80)]
                          "
                        />

                        <span
                          className="
                            pointer-events-none
                            absolute
                            -right-8
                            top-1/2
                            h-24
                            w-24
                            -translate-y-1/2
                            rounded-full
                            bg-emerald-400/[0.07]
                            blur-2xl
                          "
                        />

                        <span
                          className="
                            pointer-events-none
                            absolute
                            inset-x-0
                            top-0
                            h-px
                            bg-gradient-to-r
                            from-white/[0.11]
                            via-emerald-300/[0.09]
                            to-transparent
                          "
                        />
                      </>
                    )}

                    {/* ICON */}

                    <span
                      className={`
                        relative
                        flex
                        h-8
                        w-8
                        shrink-0
                        items-center
                        justify-center
                        overflow-hidden
                        rounded-lg
                        border

                        transition-all
                        duration-300
                        ease-out

                        group-hover:scale-[1.055]
                        group-hover:-translate-y-0.5
                        group-hover:shadow-[0_6px_18px_rgba(0,0,0,0.14)]

                        group-active:scale-90
                        group-active:translate-y-0
                        group-active:rotate-1

                        ${
                          active
                            ? `
                              border-emerald-200/[0.10]
                              bg-gradient-to-br
                              from-emerald-300/[0.13]
                              via-white/[0.045]
                              to-transparent
                              text-emerald-200
                              shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_4px_14px_rgba(0,0,0,0.10)]
                            `
                            : `
                              ${tone.bg}
                              ${tone.border}
                              ${tone.icon}
                            `
                        }
                      `}
                    >
                      {!active && (
                        <>
                          <span
                            className={`
                              pointer-events-none
                              absolute
                              -right-2
                              -top-2
                              h-5
                              w-5
                              rounded-full
                              ${tone.glow}
                              blur-md
                              opacity-70
                              transition-all
                              duration-300
                              group-hover:scale-150
                              group-hover:opacity-100
                            `}
                          />

                          <span
                            className="
                              pointer-events-none
                              absolute
                              inset-0
                              bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.09),transparent_42%)]
                            "
                          />
                        </>
                      )}

                      {active && (
                        <span
                          className="
                            pointer-events-none
                            absolute
                            inset-0
                            bg-[radial-gradient(circle_at_30%_20%,rgba(110,231,183,0.18),transparent_55%)]
                            transition-transform
                            duration-300
                            group-hover:scale-125
                          "
                        />
                      )}

                      <Icon
                        aria-hidden="true"
                        size={16.5}
                        strokeWidth={1.85}
                        className="
                          relative
                          z-10
                          origin-center
                          transition-all
                          duration-300
                          ease-out
                          group-hover:scale-110
                          group-hover:-translate-y-0.5
                          group-hover:rotate-[-4deg]
                          group-active:scale-90
                          group-active:translate-y-0
                          group-active:rotate-[5deg]
                        "
                      />
                    </span>

                    {/* TITLE */}

                    <span
                      className={`
                        relative
                        ml-2.5
                        min-w-0
                        flex-1
                        truncate
                        text-[10.5px]
                        leading-none
                        transition-transform
                        duration-200

                        ${
                          active
                            ? "font-bold text-white group-hover:translate-x-0.5"
                            : "font-medium text-inherit group-hover:translate-x-0.5"
                        }
                      `}
                    >
                      {menu.title}
                    </span>

                    {/* BADGE */}

                    {hasBadge && (
                      <span
                        aria-label={`${badgeValue} pending`}
                        className="
                          relative
                          mr-1
                          flex
                          h-[23px]
                          min-w-[23px]
                          shrink-0
                          items-center
                          justify-center
                          overflow-hidden
                          rounded-full
                          border
                          border-white/[0.22]
                          bg-white
                          px-1.5
                          text-[9px]
                          font-black
                          leading-none
                          text-[#18352D]
                          shadow-[0_3px_12px_rgba(0,0,0,0.16),0_0_0_1px_rgba(255,255,255,0.08)]
                          transition-all
                          duration-200
                          group-hover:scale-110
                          group-hover:bg-slate-50
                          group-hover:shadow-[0_5px_18px_rgba(255,255,255,0.14)]
                        "
                      >
                        {badgeValue > 99
                          ? "99+"
                          : badgeValue}

                        <span
                          className="
                            pointer-events-none
                            absolute
                            right-[3px]
                            top-[3px]
                            h-1.5
                            w-1.5
                            rounded-full
                            bg-emerald-300
                            shadow-[0_0_5px_rgba(52,211,153,0.6)]
                          "
                        />
                      </span>
                    )}

                    {/* CHEVRON */}

                    <span
                      className={`
                        relative
                        flex
                        h-6
                        w-6
                        shrink-0
                        items-center
                        justify-center
                        rounded-md
                        transition-all
                        duration-200

                        ${
                          active
                            ? `
                              text-emerald-300/70
                              group-hover:translate-x-0.5
                            `
                            : `
                              text-transparent
                              group-hover:text-slate-600
                            `
                        }
                      `}
                    >
                      <ChevronRight
                        size={13}
                        strokeWidth={1.8}
                        className="
                          transition-transform
                          duration-200
                          group-hover:translate-x-0.5
                        "
                      />
                    </span>
                  </Link>
                );
              }
            )
          )}

          {/* BOTTOM FADE */}

          <div
            className="
              pointer-events-none
              sticky
              bottom-[-14px]
              left-0
              right-0
              z-20
              -mt-4
              h-5
              bg-gradient-to-t
              from-[#041c17]
              to-transparent
            "
          />
        </nav>

        {/* =================================================
            FOOTER
            ================================================= */}

        <div
          className="
            relative
            shrink-0
            border-t
            border-white/[0.065]
            px-4
            py-3.5
          "
        >
          <div
            className="
              pointer-events-none
              absolute
              inset-x-0
              -top-px
              h-px
              bg-gradient-to-r
              from-transparent
              via-emerald-300/[0.08]
              to-transparent
            "
          />

          <div className="flex items-center justify-between">
            {/* BRAND STATUS */}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="
                    relative
                    h-1.5
                    w-1.5
                    rounded-full
                    bg-emerald-400
                    shadow-[0_0_9px_rgba(52,211,153,0.8)]
                  "
                />

                <p
                  className="
                    text-[7px]
                    font-bold
                    uppercase
                    tracking-[0.2em]
                    text-slate-400
                  "
                >
                  MGB ERP
                </p>
              </div>

              <p
                className="
                  mt-1
                  truncate
                  text-[7px]
                  font-medium
                  text-slate-600
                "
              >
                Enterprise Management
              </p>
            </div>

            {/* LIVE STATUS */}

            <div
              className="
                flex
                items-center
                gap-1.5
                rounded-full
                border
                border-emerald-300/[0.08]
                bg-emerald-300/[0.035]
                px-2.5
                py-1.5
              "
            >
              <span
                className="
                  relative
                  flex
                  h-1.5
                  w-1.5
                "
              >
                <span
                  className="
                    absolute
                    inset-0
                    animate-ping
                    rounded-full
                    bg-emerald-400
                    opacity-20
                  "
                />

                <span
                  className="
                    relative
                    h-1.5
                    w-1.5
                    rounded-full
                    bg-emerald-400
                    shadow-[0_0_7px_rgba(52,211,153,0.75)]
                  "
                />
              </span>

              <span
                className="
                  text-[6.5px]
                  font-bold
                  uppercase
                  tracking-[0.14em]
                  text-slate-400
                "
              >
                ONLINE
              </span>
            </div>
          </div>

          {/* MICRO BRAND LINE */}

          <div className="mt-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-white/[0.035]" />

            <div
              className="
                flex
                items-center
                gap-1
                text-slate-700
              "
            >
              <Sparkles
                size={8}
                strokeWidth={1.7}
              />

              <span
                className="
                  text-[5.5px]
                  font-semibold
                  uppercase
                  tracking-[0.16em]
                "
              >
                Premium ERP
              </span>
            </div>

            <div className="h-px flex-1 bg-white/[0.035]" />
          </div>
        </div>
      </aside>
    </>
  );
}