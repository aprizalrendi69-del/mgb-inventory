"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ElementType } from "react";
import { useCallback, useEffect, useState } from "react";

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
} from "lucide-react";

type Role =
  | "ADMIN"
  | "MANAGER"
  | "PURCHASING"
  | "GUDANG"
  | "OUTLET_ADMIN"
  | "KASIR";

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
  | "suratJalan"
  | "approvalWastePusat"
  | "barangMasukOutlet"
  | "approvalWasteOutlet"
  | "approvalStockOpname";

interface Menu {
  title: string;
  url?: string;
  roles?: Role[];
  header?: boolean;
  icon?: ElementType;
  badgeKey?: BadgeKey;
}

interface PendingCounts {
  approvalPurchase: number;
  barangMasuk: number;
  deliveryOrder: number;
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
  suratJalan: 0,
  approvalWastePusat: 0,
  barangMasukOutlet: 0,
  approvalWasteOutlet: 0,
  approvalStockOpname: 0,
};

const menus: Menu[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    roles: ["ADMIN", "MANAGER", "PURCHASING", "GUDANG"],
    icon: LayoutDashboard,
  },
  {
    title: "Dashboard Outlet",
    url: "/outlet/dashboard",
    roles: ["OUTLET_ADMIN"],
    icon: LayoutDashboard,
  },
  {
    title: "Attendance",
    url: "/attendance",
    roles: ["ADMIN", "MANAGER", "GUDANG"],
    icon: CalendarCheck,
  },
  {
    title: "Riwayat Absensi",
    url: "/attendance/history",
    roles: ["ADMIN", "MANAGER", "GUDANG"],
    icon: History,
  },

  {
    title: "MASTER DATA",
    header: true,
  },
  {
    title: "Master Barang",
    url: "/master-barang",
    roles: ["ADMIN", "PURCHASING"],
    icon: Package,
  },
  {
    title: "Master Supplier",
    url: "/supplier",
    roles: ["ADMIN", "PURCHASING"],
    icon: Truck,
  },
  {
    title: "Master Customer",
    url: "/customer",
    roles: ["ADMIN"],
    icon: Users,
  },
  {
    title: "Master User",
    url: "/master/user",
    roles: ["ADMIN", "OUTLET_ADMIN"],
    icon: UserCog,
  },
  {
    title: "Master Outlet",
    url: "/master/outlet",
    roles: ["ADMIN"],
    icon: Warehouse,
  },
  {
    title: "Master Karyawan",
    url: "/employee",
    roles: ["ADMIN", "MANAGER"],
    icon: UserRound,
  },

  {
    title: "PURCHASE",
    header: true,
  },
  {
    title: "Purchase Order",
    url: "/purchase",
    roles: ["ADMIN"],
    icon: ShoppingCart,
  },
  {
    title: "Master Harga",
    url: "/master-harga",
    roles: ["ADMIN", "MANAGER", "PURCHASING"],
    icon: Tag,
  },
  {
    title: "Approval Purchase",
    url: "/purchase/approve",
    roles: ["ADMIN", "MANAGER", "PURCHASING"],
    icon: ClipboardCheck,
    badgeKey: "approvalPurchase",
  },
  {
    title: "Barang Masuk",
    url: "/barang-masuk",
    roles: ["ADMIN", "GUDANG"],
    icon: ArrowDownToLine,
    badgeKey: "barangMasuk",
  },

  {
    title: "GUDANG",
    header: true,
  },
  {
    title: "Stock Pusat",
    url: "/stock",
    roles: ["ADMIN", "GUDANG"],
    icon: Warehouse,
  },
  {
    title: "Kartu Stok",
    url: "/gudang/stock-card",
    roles: ["ADMIN", "GUDANG"],
    icon: Warehouse,
  },
  {
    title: "Expired Barang",
    url: "/expired",
    roles: ["ADMIN", "GUDANG"],
    icon: Package,
  },
  {
    title: "Barang Keluar",
    url: "/barang-keluar",
    roles: ["ADMIN", "GUDANG"],
    icon: PackageMinus,
  },
  {
    title: "Stock Card",
    url: "/stock-card",
    roles: ["ADMIN", "GUDANG"],
    icon: Boxes,
  },
  {
    title: "Mutasi Stock",
    url: "/mutasi-stock",
    roles: ["ADMIN", "GUDANG"],
    icon: ArrowLeftRight,
  },
  {
    title: "Stock Opname",
    url: "/stock-opname",
    roles: ["ADMIN", "GUDANG"],
    icon: ClipboardList,
  },
  {
    title: "Adjustment Stock",
    url: "/adjustment",
    roles: ["ADMIN", "GUDANG"],
    icon: SlidersHorizontal,
  },
  {
    title: "History Stock",
    url: "/history",
    roles: ["ADMIN", "GUDANG"],
    icon: FileClock,
  },

  {
    title: "WASTE",
    header: true,
  },
  {
    title: "Waste Pusat",
    url: "/waste",
    roles: ["ADMIN", "GUDANG"],
    icon: Trash2,
  },
  {
    title: "Approval Waste Pusat",
    url: "/waste/approval",
    roles: ["ADMIN", "MANAGER"],
    icon: ClipboardCheck,
    badgeKey: "approvalWastePusat",
  },

  {
    title: "PENJUALAN",
    header: true,
  },
  {
    title: "Delivery Order",
    url: "/pengiriman",
    roles: ["ADMIN"],
    icon: Send,
    badgeKey: "deliveryOrder",
  },
  {
    title: "Surat Jalan",
    url: "/surat-jalan",
    roles: ["ADMIN", "GUDANG"],
    icon: FileText,
    badgeKey: "suratJalan",
  },

  {
    title: "INVENTORY",
    header: true,
  },
  {
    title: "Menu & BOM",
    url: "/menu",
    roles: ["ADMIN", "MANAGER"],
    icon: Utensils,
  },
  {
    title: "Manufacture",
    url: "/manufacture",
    roles: ["ADMIN", "MANAGER", "GUDANG", "OUTLET_ADMIN"],
    icon: Factory,
  },
  {
    title: "Inventory",
    url: "/inventory",
    roles: ["ADMIN", "MANAGER", "GUDANG"],
    icon: Boxes,
  },

  {
    title: "COST CONTROL",
    header: true,
  },
  {
    title: "Cost Control",
    url: "/cost-control",
    roles: ["ADMIN", "MANAGER", "OUTLET_ADMIN"],
    icon: TrendingUp,
  },

  {
    title: "FINANCE",
    header: true,
  },
  {
    title: "Payment",
    url: "/payment",
    roles: ["ADMIN", "MANAGER"],
    icon: CreditCard,
  },
  {
    title: "Master Account",
    url: "/petty-cash/accounts",
    roles: ["ADMIN"],
    icon: WalletCards,
  },
  {
    title: "Purchase Payable / Hutang",
    url: "/purchase-payable",
    roles: ["ADMIN", "MANAGER", "OUTLET_ADMIN"],
    icon: FileClock,
  },
  {
    title: "Petty Cash",
    url: "/petty-cash",
    roles: ["ADMIN", "MANAGER", "OUTLET_ADMIN"],
    icon: WalletCards,
  },

  {
    title: "OUTLET",
    header: true,
  },
  {
    title: "Master Barang Outlet",
    url: "/outlet/master-barang",
    roles: ["ADMIN", "OUTLET_ADMIN"],
    icon: Package,
  },
  {
    title: "Purchase Outlet",
    url: "/outlet/purchase",
    roles: ["ADMIN", "OUTLET_ADMIN"],
    icon: ShoppingCart,
  },
  {
    title: "Barang Masuk Outlet",
    url: "/outlet/barang-masuk",
    roles: ["ADMIN", "OUTLET_ADMIN"],
    icon: ArrowDownToLine,
    badgeKey: "barangMasukOutlet",
  },
  {
    title: "Transfer Outlet",
    url: "/outlet/transfer",
    roles: ["ADMIN", "OUTLET_ADMIN"],
    icon: ArrowLeftRight,
  },
  {
    title: "POS Outlet",
    url: "/outlet/pos",
    roles: ["ADMIN", "KASIR"],
    icon: ShoppingCart,
  },
  {
    title: "Barang Keluar Outlet",
    url: "/outlet/barang-keluar",
    roles: ["ADMIN", "OUTLET_ADMIN"],
    icon: ArrowDownCircle,
  },
  {
    title: "Waste Outlet",
    url: "/outlet/waste",
    roles: ["ADMIN", "OUTLET_ADMIN"],
    icon: Trash2,
  },
  {
    title: "Approval Waste Outlet",
    url: "/outlet/waste/approval",
    roles: ["ADMIN", "MANAGER"],
    icon: ClipboardCheck,
    badgeKey: "approvalWasteOutlet",
  },
  {
    title: "Stock Outlet",
    url: "/outlet/stock",
    roles: ["ADMIN", "OUTLET_ADMIN"],
    icon: Boxes,
  },
  {
    title: "History Stock Outlet",
    url: "/outlet/history-stock",
    roles: ["ADMIN", "OUTLET_ADMIN"],
    icon: FileClock,
  },
  {
    title: "Stock Awal Outlet",
    url: "/outlet/stock-awal",
    roles: ["ADMIN"],
    icon: Warehouse,
  },
  {
    title: "Stock Opname Outlet",
    url: "/outlet/stock-opname",
    roles: ["ADMIN", "OUTLET_ADMIN"],
    icon: ClipboardList,
  },
  {
    title: "Approval Stock Opname",
    url: "/outlet/stock-opname/approval",
    roles: ["ADMIN", "OUTLET_ADMIN"],
    icon: ClipboardCheck,
    badgeKey: "approvalStockOpname",
  },

  {
    title: "Adjustment Outlet",
    url: "/outlet/adjustment",
    roles: ["ADMIN", "MANAGER", "OUTLET_ADMIN"],
    icon: SlidersHorizontal,
  },

  {
    title: "LAPORAN OUTLET",
    header: true,
  },
  {
    title: "Laporan Barang Masuk Outlet",
    url: "/outlet/laporan/barang-masuk",
    roles: ["ADMIN", "OUTLET_ADMIN"],
    icon: FileText,
  },
  {
    title: "Laporan Purchase Outlet",
    url: "/outlet/laporan/purchase",
    roles: ["ADMIN", "OUTLET_ADMIN"],
    icon: FileText,
  },
  {
    title: "Laporan Delivery Outlet",
    url: "/outlet/laporan/delivery",
    roles: ["ADMIN", "OUTLET_ADMIN"],
    icon: FileText,
  },
  {
    title: "Laporan Stock Outlet",
    url: "/outlet/laporan/stock",
    roles: ["ADMIN", "OUTLET_ADMIN"],
    icon: FileText,
  },

  {
    title: "LAPORAN",
    header: true,
  },
  {
    title: "Laporan Purchase",
    url: "/laporan/purchase",
    roles: ["ADMIN", "MANAGER", "PURCHASING"],
    icon: FileText,
  },
  {
    title: "Laporan Barang Masuk",
    url: "/laporan/barang-masuk",
    roles: ["ADMIN", "MANAGER", "GUDANG"],
    icon: FileText,
  },
  {
    title: "Laporan Barang Keluar",
    url: "/laporan/barang-keluar",
    roles: ["ADMIN", "MANAGER", "GUDANG"],
    icon: FileText,
  },
  {
    title: "Laporan Inventory",
    url: "/laporan/inventory",
    roles: ["ADMIN", "MANAGER"],
    icon: FileText,
  },
  {
    title: "Laporan Supplier",
    url: "/laporan/supplier",
    roles: ["ADMIN", "MANAGER", "PURCHASING"],
    icon: FileText,
  },
  {
    title: "Laporan Customer",
    url: "/laporan/customer",
    roles: ["ADMIN", "MANAGER", "PURCHASING"],
    icon: FileText,
  },
  {
    title: "Laporan Attendance",
    url: "/laporan/attendance",
    roles: ["ADMIN", "MANAGER"],
    icon: FileText,
  },
  {
    title: "Laporan Stock Opname",
    url: "/laporan/stock-opname",
    roles: ["ADMIN", "MANAGER", "GUDANG"],
    icon: FileText,
  },

  {
    title: "SETTING",
    header: true,
  },
  {
    title: "Pengaturan",
    url: "/pengaturan",
    roles: ["ADMIN"],
    icon: Settings,
  },
];

interface SidebarProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({
  user,
  open,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();
  const role = user?.role;

  const [pendingCounts, setPendingCounts] =
    useState<PendingCounts>(EMPTY_PENDING_COUNTS);

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

  const visibleMenus = menus.filter((menu) => {
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

  const allowedMenus = visibleMenus.filter(
    (menu, index, array) => {
      if (!menu.header) {
        return true;
      }

      const nextMenu = array[index + 1];

      if (!nextMenu) {
        return false;
      }

      return !nextMenu.header;
    }
  );

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

  return (
    <>
      {/* OVERLAY */}

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
            bg-slate-950/55
            backdrop-blur-[4px]
          "
        />
      )}

      {/* SIDEBAR */}

      <aside
        className={`
          fixed
          left-0
          top-0
          z-50
          flex
          h-screen
          w-[286px]
          shrink-0
          flex-col
          overflow-hidden
          border-r
          border-white/[0.07]
          bg-[#041c17]
          text-white
          shadow-[18px_0_70px_rgba(0,0,0,0.32)]
          transition-transform
          duration-300
          ease-out
          ${
            open
              ? "translate-x-0"
              : "-translate-x-full"
          }
        `}
      >
        {/* PREMIUM BACKGROUND */}

        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="
              absolute
              -left-36
              -top-32
              h-96
              w-96
              rounded-full
              bg-emerald-400/[0.09]
              blur-[120px]
            "
          />

          <div
            className="
              absolute
              -right-32
              top-[35%]
              h-80
              w-80
              rounded-full
              bg-teal-300/[0.045]
              blur-[110px]
            "
          />

          <div
            className="
              absolute
              -bottom-40
              -left-20
              h-96
              w-96
              rounded-full
              bg-emerald-500/[0.045]
              blur-[120px]
            "
          />

          <div
            className="
              absolute
              inset-0
              bg-[radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.045),transparent_25%)]
            "
          />

          <div
            className="
              absolute
              inset-0
              bg-gradient-to-b
              from-emerald-950/[0.16]
              via-transparent
              to-black/[0.10]
            "
          />
        </div>

        {/* BRAND */}

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
                border-white/[0.10]
                bg-white/[0.045]
                shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.12)]
              "
            >
              <div
                className="
                  absolute
                  inset-0
                  bg-gradient-to-br
                  from-emerald-300/[0.15]
                  via-transparent
                  to-transparent
                "
              />

              <span
                className="
                  relative
                  text-[10px]
                  font-black
                  tracking-[-0.06em]
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
                  leading-[1.18]
                  tracking-[-0.035em]
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
                      opacity-30
                    "
                  />

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

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup sidebar"
              className="
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
                hover:border-white/[0.12]
                hover:bg-white/[0.06]
                hover:text-white
              "
            >
              <X
                size={15}
                strokeWidth={1.8}
              />
            </button>
          </div>

          {/* USER CARD */}

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
              shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_12px_32px_rgba(0,0,0,0.10)]
              backdrop-blur-xl
              transition-all
              duration-300
              hover:border-white/[0.11]
              hover:bg-white/[0.045]
            "
          >
            <div
              className="
                pointer-events-none
                absolute
                -left-10
                -top-10
                h-28
                w-28
                rounded-full
                bg-emerald-400/[0.07]
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
                via-white/[0.08]
                to-transparent
              "
            />

            <div className="relative flex items-center gap-3">
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
                    shadow-[0_0_8px_rgba(52,211,153,0.8)]
                  "
                />
              </div>

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
                    {user?.role || "USER"}
                  </p>
                </div>
              </div>

              <div
                className="
                  flex
                  shrink-0
                  items-center
                  gap-1.5
                  rounded-full
                  border
                  border-white/[0.08]
                  bg-white/[0.035]
                  px-2
                  py-1
                "
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,0.7)]" />

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
        </div>

        {/* NAVIGATION */}

        <nav
          className="
            relative
            flex-1
            overflow-y-auto
            px-3.5
            py-3.5
            [&::-webkit-scrollbar]:w-1
            [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-thumb]:rounded-full
            [&::-webkit-scrollbar-thumb]:bg-white/[0.07]
            hover:[&::-webkit-scrollbar-thumb]:bg-white/[0.12]
          "
        >
          {allowedMenus.map(
            (menu, index) => {
              if (menu.header) {
                return (
                  <div
                    key={`header-${index}`}
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
                        bg-emerald-400/[0.25]
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
                      pathname !== menu.url
                    ) {
                      window.dispatchEvent(
                        new CustomEvent(
                          "erp:navigation-start"
                        )
                      );
                    }

                    onClose();
                  }}
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
                    transition-all
                    duration-200

                    ${
                      active
                        ? `
                          border
                          border-white/[0.09]
                          bg-gradient-to-r
                          from-white/[0.085]
                          via-emerald-400/[0.065]
                          to-transparent
                          text-white
                          shadow-[0_8px_25px_rgba(0,0,0,0.10)]
                        `
                        : `
                          border
                          border-transparent
                          text-slate-400
                          hover:border-white/[0.055]
                          hover:bg-white/[0.035]
                          hover:text-white
                        `
                    }
                  `}
                >
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
                          shadow-[0_0_14px_rgba(52,211,153,0.75)]
                        "
                      />

                      <span
                        className="
                          pointer-events-none
                          absolute
                          -right-7
                          top-1/2
                          h-20
                          w-20
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
                          from-white/[0.10]
                          via-emerald-300/[0.08]
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
                      rounded-lg
                      transition-all
                      duration-200

                      ${
                        active
                          ? `
                            bg-white/[0.055]
                            text-emerald-300
                            shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]
                          `
                          : `
                            text-slate-500
                            group-hover:bg-white/[0.035]
                            group-hover:text-emerald-300
                          `
                      }
                    `}
                  >
                    <Icon
                      size={16}
                      strokeWidth={1.8}
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
                      ${
                        active
                          ? "font-bold text-white"
                          : "font-medium text-inherit"
                      }
                    `}
                  >
                    {menu.title}
                  </span>

                  {/* PREMIUM WHITE COUNT */}

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
                        "
                      />
                    </span>
                  )}

                  {/* ARROW */}

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
                    />
                  </span>
                </Link>
              );
            }
          )}
        </nav>

        {/* FOOTER */}

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
              via-white/[0.08]
              to-transparent
            "
          />

          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="
                    h-1.5
                    w-1.5
                    rounded-full
                    bg-emerald-400
                    shadow-[0_0_8px_rgba(52,211,153,0.8)]
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

            <div
              className="
                flex
                items-center
                gap-1.5
                rounded-full
                border
                border-white/[0.08]
                bg-white/[0.035]
                px-2.5
                py-1.5
              "
            >
              <span
                className="
                  h-1.5
                  w-1.5
                  rounded-full
                  bg-emerald-400
                  shadow-[0_0_7px_rgba(52,211,153,0.75)]
                "
              />

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
        </div>
      </aside>
    </>
  );
}