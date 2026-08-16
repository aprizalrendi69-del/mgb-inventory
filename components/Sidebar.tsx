"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
} from "lucide-react";

type Role =
  | "ADMIN"
  | "MANAGER"
  | "PURCHASING"
  | "GUDANG"
  | "OUTLET_ADMIN";


interface User {
  id?: number;
  username?: string;
  fullname?: string;
  role?: Role;
}

interface Menu {
  title: string;
  url?: string;
  roles?: Role[];
  header?: boolean;
  icon?: React.ElementType;
}

const menus: Menu[] = [
  // =====================================================
  // UTAMA
  // =====================================================

  {
    title: "Dashboard",
    url: "/dashboard",
    roles: ["ADMIN", "MANAGER", "PURCHASING", "GUDANG"],
    icon: LayoutDashboard,
  },

  {
    title: "Attendance",
    url: "/attendance",
    roles: ["ADMIN", "MANAGER", "PURCHASING", "GUDANG"],
    icon: CalendarCheck,
  },

  {
    title: "Riwayat Absensi",
    url: "/attendance/history",
    roles: ["ADMIN", "MANAGER", "PURCHASING", "GUDANG"],
    icon: History,
  },

  // =====================================================
  // MASTER DATA
  // =====================================================

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
    roles: ["ADMIN"],
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

  // =====================================================
  // OUTLET
  // =====================================================

  {
    title: "OUTLET",
    header: true,
  },

  {
    title: "Dashboard Outlet",
    url: "/outlet",
    roles: ["OUTLET_ADMIN"],
    icon: LayoutDashboard,
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
    roles: ["OUTLET_ADMIN"],
    icon: ShoppingCart,
  },

  {
    title: "Barang Masuk Outlet",
    url: "/outlet/barang-masuk",
    roles: ["OUTLET_ADMIN"],
    icon: ArrowDownToLine,
  },

  {
    title: "Stock Outlet",
    url: "/outlet/stock",
    roles: ["OUTLET_ADMIN"],
    icon: Boxes,
  },

  {
    title: "Stock Awal Outlet",
    url: "/outlet/stock-awal",
    roles: ["ADMIN", "OUTLET_ADMIN"],
    icon: Warehouse,
  },

    {
    title: "Stock Opname Outlet",
    url: "/outlet/stock-opname",
    roles: ["OUTLET_ADMIN"],
    icon: ClipboardList,
  },

  {
    title: "Approval Stock Opname",
    url: "/outlet/stock-opname/approval",
    roles: ["OUTLET_ADMIN"],
    icon: ClipboardCheck,
  },

    // =====================================================
  // LAPORAN OUTLET
  // =====================================================

  {
    title: "LAPORAN OUTLET",
    header: true,
  },

  {
    title: "Laporan Purchase Order",
    url: "/outlet/laporan/purchase",
    roles: ["ADMIN", "OUTLET_ADMIN"],
    icon: FileText,
  },

  {
    title: "Laporan Delivery Order",
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

  // =====================================================
  // PURCHASE
  // =====================================================

  {
    title: "PURCHASE",
    header: true,
  },

  {
    title: "Purchase Order",
    url: "/purchase",
    roles: ["ADMIN", "PURCHASING"],
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
    roles: ["ADMIN", "MANAGER"],
    icon: ClipboardCheck,
  },

  {
    title: "Barang Masuk",
    url: "/barang-masuk",
    roles: ["ADMIN", "GUDANG"],
    icon: ArrowDownToLine,
  },

  // =====================================================
  // GUDANG
  // =====================================================

  {
    title: "GUDANG",
    header: true,
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

  // =====================================================
  // PENJUALAN
  // =====================================================

  {
    title: "PENJUALAN",
    header: true,
  },

  {
    title: "Delivery Order",
    url: "/pengiriman",
    roles: ["ADMIN"],
    icon: Send,
  },

  {
    title: "Surat Jalan",
    url: "/surat-jalan",
    roles: ["ADMIN", "GUDANG"],
    icon: FileText,
  },

  // =====================================================
  // INVENTORY
  // =====================================================

  {
    title: "INVENTORY",
    header: true,
  },

  {
    title: "Inventory",
    url: "/inventory",
    roles: ["ADMIN", "MANAGER", "GUDANG"],
    icon: Boxes,
  },

  // =====================================================
  // LAPORAN
  // =====================================================

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

  // =====================================================
  // SETTING
  // =====================================================

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

export default function Sidebar({
  user,
}: {
  user: User | null;
}) {
  const pathname = usePathname();

  const role = user?.role;

  // =====================================================
  // FILTER MENU
  // =====================================================

  const visibleMenus = menus.filter((menu) => {
    if (menu.header) {
      return true;
    }

    if (!menu.roles) {
      return false;
    }

    return role
      ? menu.roles.includes(role)
      : false;
  });

  // =====================================================
  // HAPUS HEADER KOSONG
  // =====================================================

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

  // =====================================================
  // USER
  // =====================================================

  const displayName =
    user?.fullname ||
    user?.username ||
    "User";

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <aside
      className="
        sticky
        top-0
        flex
        h-screen
        w-[280px]
        shrink-0
        flex-col
        overflow-hidden
        border-r
        border-[#668A7C]
        bg-[#527A6B]
        text-white
        shadow-[4px_0_20px_rgba(48,78,67,0.12)]
      "
    >

      {/* =================================================
          BRAND
      ================================================= */}

      <div
        className="
          shrink-0
          border-b
          border-[#668A7C]
          px-6
          pb-5
          pt-6
        "
      >
        <div className="flex items-start gap-3">

          {/* LOGO */}

          <div
            className="
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-xl
              bg-[#6F9384]
              shadow-[0_5px_14px_rgba(42,69,59,0.18)]
            "
          >
            <Package
              size={19}
              strokeWidth={1.9}
              className="text-white"
            />
          </div>

          {/* COMPANY */}

          <div className="min-w-0 pt-0.5">
            <h1
              className="
                text-[25px]
                font-bold
                leading-[1.35]
                tracking-[-0.015em]
                text-white
              "
            >
              PT. MITRA GARAM
              <br />
              BOGATAMA
            </h1>

            <p
              className="
                mt-1.5
                text-[9px]
                font-semibold
                uppercase
                tracking-[0.13em]
                text-[#D5E3DD]
              "
            >
              ERP Inventory System
            </p>
          </div>

        </div>

        {/* USER CARD */}

        <div
          className="
            mt-5
            rounded-xl
            border
            border-[#668A7C]
            bg-[#486D60]
            px-3
            py-3
          "
        >
          <div className="flex items-center gap-3">

            {/* AVATAR */}

            <div
              className="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-full
                bg-[#719789]
                text-[11px]
                font-bold
                text-white
              "
            >
              {initials || "U"}
            </div>

            {/* USER DETAIL */}

            <div className="min-w-0 flex-1">
              <p
                className="
                  truncate
                  text-[12px]
                  font-bold
                  leading-4
                  text-white
                "
              >
                {displayName}
              </p>

              <p
                className="
                  mt-0.5
                  text-[9px]
                  font-semibold
                  uppercase
                  tracking-[0.06em]
                  text-[#C9DCD4]
                "
              >
                {user?.role || "USER"}
              </p>
            </div>

            {/* ONLINE */}

            <span
              className="
                h-1.5
                w-1.5
                shrink-0
                rounded-full
                bg-[#B7D3C5]
                shadow-[0_0_6px_rgba(183,211,197,0.4)]
              "
            />

          </div>
        </div>
      </div>

      {/* =================================================
          NAVIGATION
      ================================================= */}

      <nav
        className="
          flex-1
          overflow-y-auto
          px-4
          py-4

          [&::-webkit-scrollbar]:w-1.5
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:rounded-full
          [&::-webkit-scrollbar-thumb]:bg-[#6A8D80]
        "
      >
        {allowedMenus.map((menu, index) => {

          // SECTION HEADER

          if (menu.header) {
            return (
              <div
                key={`header-${index}`}
                className="
                  mb-2
                  mt-5
                  px-3
                  pt-1
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.16em]
                  text-[#CFE0D8]
                "
              >
                {menu.title}
              </div>
            );
          }

          // ACTIVE

          const active =
            pathname === menu.url ||
            pathname.startsWith(`${menu.url}/`);

          const Icon =
            menu.icon || Package;

          return (
            <Link
              key={menu.url}
              href={menu.url!}
              className={`
                group
                relative
                mb-1
                flex
                h-[42px]
                items-center
                rounded-[10px]
                px-3
                transition-all
                duration-150

                ${
                  active
                    ? `
                      bg-[#6F9384]
                      text-white
                      shadow-[0_5px_14px_rgba(42,69,59,0.15)]
                    `
                    : `
                      text-[#DFEAE5]
                      hover:bg-[#486D60]
                      hover:text-white
                    `
                }
              `}
            >

              {/* ACTIVE BAR */}

              {active && (
                <span
                  className="
                    absolute
                    left-0
                    top-1/2
                    h-5
                    w-[3px]
                    -translate-y-1/2
                    rounded-r-full
                    bg-[#E4EFEA]
                  "
                />
              )}

              {/* ICON */}

              <span
                className={`
                  flex
                  h-7
                  w-7
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg

                  ${
                    active
                      ? "text-white"
                      : "text-[#C2D7CE] group-hover:text-white"
                  }
                `}
              >
                <Icon
                  size={17}
                  strokeWidth={1.8}
                />
              </span>

              {/* TEXT */}

              <span
                className={`
                  ml-2.5
                  truncate
                  text-[12px]
                  leading-none

                  ${
                    active
                      ? "font-bold text-white"
                      : "font-semibold text-inherit"
                  }
                `}
              >
                {menu.title}
              </span>

              {/* ACTIVE ARROW */}

              {active && (
                <ChevronRight
                  size={14}
                  strokeWidth={1.9}
                  className="
                    ml-auto
                    text-white/70
                  "
                />
              )}

            </Link>
          );
        })}
      </nav>

      {/* =================================================
          FOOTER
      ================================================= */}

      <div
        className="
          shrink-0
          border-t
          border-[#668A7C]
          px-5
          py-4
        "
      >
        <div className="flex items-center justify-between">

          <div>
            <p
              className="
                text-[9px]
                font-bold
                uppercase
                tracking-[0.16em]
                text-[#CFE0D8]
              "
            >
              MGB ERP
            </p>

            <p
              className="
                mt-1
                text-[9px]
                font-medium
                text-[#B9CEC5]
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
              border-[#668A7C]
              bg-[#486D60]
              px-2.5
              py-1.5
            "
          >
            <span
              className="
                h-1.5
                w-1.5
                rounded-full
                bg-[#B7D3C5]
              "
            />

            <span
              className="
                text-[8px]
                font-bold
                tracking-wide
                text-[#DCE9E4]
              "
            >
              ONLINE
            </span>
          </div>

        </div>
      </div>

    </aside>
  );
}