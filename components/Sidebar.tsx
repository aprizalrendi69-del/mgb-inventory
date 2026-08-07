"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Role =
  | "ADMIN"
  | "MANAGER"
  | "PURCHASING"
  | "GUDANG";

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
}

const menus: Menu[] = [

  // =========================
  // UTAMA
  // =========================

  {
    title: "Dashboard",
    url: "/dashboard",
    roles: ["ADMIN", "MANAGER", "PURCHASING", "GUDANG"],
  },

  {
    title: "Attendance",
    url: "/attendance",
    roles: ["ADMIN", "MANAGER", "PURCHASING", "GUDANG"],
  },

  {
    title: "Riwayat Absensi",
    url: "/attendance/history",
    roles: ["ADMIN", "MANAGER", "PURCHASING", "GUDANG"],
  },


  // =========================
  // MASTER DATA
  // =========================

  {
    title: "MASTER DATA",
    header: true,
  },

  {
    title: "Master Barang",
    url: "/master-barang",
    roles: ["ADMIN", "PURCHASING"],
  },

  {
    title: "Master Supplier",
    url: "/supplier",
    roles: ["ADMIN", "PURCHASING"],
  },

  {
    title: "Master Customer",
    url: "/customer",
    roles: ["ADMIN"],
  },

  {
    title: "Master User",
    url: "/master/user",
    roles: ["ADMIN"],
  },

  {
    title: "Master Karyawan",
    url: "/employee",
    roles: ["ADMIN", "MANAGER"],
  },


  // =========================
  // PURCHASE
  // =========================

  {
    title: "PURCHASE",
    header: true,
  },

  {
    title: "Purchase Order",
    url: "/purchase",
    roles: ["ADMIN", "PURCHASING"],
  },

  {
    title: "Master Harga",
    url: "/master-harga",
    roles: ["ADMIN", "MANAGER", "PURCHASING"],
  },

  {
    title: "Approval Purchase",
    url: "/purchase/approve",
    roles: ["ADMIN", "MANAGER"],
  },

  {
    title: "Barang Masuk",
    url: "/barang-masuk",
    roles: ["ADMIN", "GUDANG"],
  },


  // =========================
  // GUDANG
  // =========================

  {
    title: "GUDANG",
    header: true,
  },

  {
    title: "Kartu Stok",
    url: "/gudang/stock-card",
    roles: ["ADMIN", "GUDANG"],
  },

  {
    title: "Expired Barang",
    url: "/expired",
    roles: ["ADMIN", "GUDANG"],
  },

  {
    title: "Barang Keluar",
    url: "/barang-keluar",
    roles: ["ADMIN", "GUDANG"],
  },

  {
    title: "Stock Card",
    url: "/stock-card",
    roles: ["ADMIN", "GUDANG"],
  },

  {
    title: "Mutasi Stock",
    url: "/mutasi-stock",
    roles: ["ADMIN", "GUDANG"],
  },

  {
    title: "Stock Opname",
    url: "/stock-opname",
    roles: ["ADMIN", "GUDANG"],
  },

  {
    title: "Adjustment Stock",
    url: "/adjustment",
    roles: ["ADMIN", "GUDANG"],
  },

  {
    title: "History Stock",
    url: "/history",
    roles: ["ADMIN", "GUDANG"],
  },


  // =========================
  // PENJUALAN
  // =========================

  {
    title: "PENJUALAN",
    header: true,
  },

  {
    title: "Delivery Order",
    url: "/pengiriman",
    roles: ["ADMIN"],
  },

  {
    title: "Surat Jalan",
    url: "/surat-jalan",
    roles: ["ADMIN", "GUDANG"],
  },


  // =========================
  // INVENTORY
  // =========================

  {
    title: "INVENTORY",
    header: true,
  },

  {
    title: "Inventory",
    url: "/inventory",
    roles: ["ADMIN", "MANAGER", "GUDANG"],
  },


  // =========================
  // LAPORAN
  // =========================

  {
    title: "LAPORAN",
    header: true,
  },

  {
    title: "Laporan Purchase",
    url: "/laporan/purchase",
    roles: ["ADMIN", "MANAGER", "PURCHASING"],
  },

  {
    title: "Laporan Barang Masuk",
    url: "/laporan/barang-masuk",
    roles: ["ADMIN", "MANAGER", "GUDANG"],
  },

  {
    title: "Laporan Barang Keluar",
    url: "/laporan/barang-keluar",
    roles: ["ADMIN", "MANAGER", "GUDANG"],
  },

  {
    title: "Laporan Inventory",
    url: "/laporan/inventory",
    roles: ["ADMIN", "MANAGER"],
  },

  {
    title: "Laporan Supplier",
    url: "/laporan/supplier",
    roles: ["ADMIN", "MANAGER", "PURCHASING"],
  },

  {
    title: "Laporan Customer",
    url: "/laporan/customer",
    roles: ["ADMIN", "MANAGER", "PURCHASING"],
  },

  {
    title: "Laporan Attendance",
    url: "/laporan/attendance",
    roles: ["ADMIN", "MANAGER"],
  },

  {
    title: "Laporan Stock Opname",
    url: "/laporan/stock-opname",
    roles: ["ADMIN", "MANAGER", "GUDANG"],
  },


  // =========================
  // SETTING
  // =========================

  {
    title: "SETTING",
    header: true,
  },

  {
    title: "Pengaturan",
    url: "/pengaturan",
    roles: ["ADMIN"],
  },

];

export default function Sidebar({
  user,
}: {
  user: User | null;
}) {

  const pathname = usePathname();

  const role = user?.role;

  /*
   * Filter menu berdasarkan role.
   */
  const visibleMenus = menus.filter((menu) => {

    // Header diproses nanti.
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


  /*
   * Hapus header yang tidak mempunyai
   * menu yang terlihat di bawahnya.
   */
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


  return (

    <aside
      className="
        w-72
        h-screen
        bg-slate-900
        text-white
        overflow-y-auto
        border-r
        border-slate-700
      "
    >

      {/* ========================= */}
      {/* HEADER */}
      {/* ========================= */}

      <div
        className="
          p-6
          border-b
          border-slate-700
        "
      >

        <h1 className="text-xl font-bold">
          PT. MITRA GARAM BOGATAMA
        </h1>

        <p className="text-sm text-slate-400 mt-2">
          ERP Inventory System
        </p>

        <div className="mt-3">

          <p className="text-xs text-slate-400">
            Login
          </p>

          <p className="text-sm text-blue-400 font-medium">
            {user?.fullname || user?.username || "-"}
          </p>

          <p className="text-xs text-slate-400 mt-1">
            Role
          </p>

          <p className="text-xs text-blue-400 font-semibold">
            {user?.role || "-"}
          </p>

        </div>

      </div>


      {/* ========================= */}
      {/* MENU */}
      {/* ========================= */}

      <nav className="p-4">

        {allowedMenus.map((menu, index) => {

          /*
           * HEADER
           */
          if (menu.header) {

            return (
              <div
                key={`header-${index}`}
                className="
                  text-xs
                  uppercase
                  text-slate-400
                  font-bold
                  mt-6
                  mb-3
                "
              >
                {menu.title}
              </div>
            );
          }


          /*
           * ACTIVE MENU
           */
          const active =
            pathname === menu.url ||
            pathname.startsWith(`${menu.url}/`);


          return (

            <Link
              key={menu.url}
              href={menu.url!}
              className={`
                block
                rounded-lg
                px-4
                py-3
                mb-2
                transition

                ${
                  active
                    ? "bg-blue-600 text-white"
                    : "text-slate-200 hover:bg-slate-800"
                }
              `}
            >
              {menu.title}
            </Link>

          );

        })}

      </nav>

    </aside>
  );
}