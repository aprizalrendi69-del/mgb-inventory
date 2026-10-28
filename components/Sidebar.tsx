"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ElementType } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard, CalendarCheck, History, Package, Truck, Users, UserCog,
  UserRound, ShoppingCart, Tag, ClipboardCheck, ArrowDownToLine, Warehouse,
  Boxes, PackageMinus, ArrowLeftRight, ClipboardList, SlidersHorizontal,
  FileClock, Send, FileText, Settings, ChevronRight, TrendingUp,
  ArrowDownCircle, Trash2, CreditCard, WalletCards, Factory, Utensils, X,
  Search, Sparkles, ChevronDown,
} from "lucide-react";

type Role = "ADMIN" | "ADMIN_PUSAT" | "MANAGER" | "PURCHASING" | "GUDANG" | "OUTLET_ADMIN" | "KASIR" | "STAFF_OUTLET";
type BadgeKey = "approvalPurchase" | "barangMasuk" | "deliveryOrder" | "deliveryRequest" | "suratJalan" | "approvalWastePusat" | "barangMasukOutlet" | "approvalWasteOutlet" | "approvalStockOpname";
type IconTone = "emerald" | "teal" | "cyan" | "sky" | "blue" | "violet" | "amber" | "orange" | "rose" | "indigo" | "slate";

interface User { id?: number; username?: string; fullname?: string; role?: Role; photo?: string | null; outletId?: number | null; }
interface Menu { title: string; url?: string; roles?: Role[]; header?: boolean; icon?: ElementType; iconTone?: IconTone; badgeKey?: BadgeKey; }
interface PendingCounts { approvalPurchase: number; barangMasuk: number; deliveryOrder: number; deliveryRequest: number; suratJalan: number; approvalWastePusat: number; barangMasukOutlet: number; approvalWasteOutlet: number; approvalStockOpname: number; }
interface MenuSection { title: string; items: Menu[]; }
interface SidebarProps { user: User | null; open: boolean; onClose: () => void; }

const EMPTY_PENDING_COUNTS: PendingCounts = {
  approvalPurchase: 0, barangMasuk: 0, deliveryOrder: 0, deliveryRequest: 0,
  suratJalan: 0, approvalWastePusat: 0, barangMasukOutlet: 0,
  approvalWasteOutlet: 0, approvalStockOpname: 0,
};

const ICON_TONES: Record<IconTone, { icon: string; bg: string; border: string; glow: string }> = {
  emerald: { icon: "text-emerald-300 group-hover:text-emerald-200", bg: "bg-emerald-400/[0.075] group-hover:bg-emerald-400/[0.115]", border: "border-emerald-300/[0.08] group-hover:border-emerald-300/[0.13]", glow: "bg-emerald-400/[0.12]" },
  teal: { icon: "text-teal-300 group-hover:text-teal-200", bg: "bg-teal-400/[0.075] group-hover:bg-teal-400/[0.115]", border: "border-teal-300/[0.08] group-hover:border-teal-300/[0.13]", glow: "bg-teal-400/[0.12]" },
  cyan: { icon: "text-cyan-300 group-hover:text-cyan-200", bg: "bg-cyan-400/[0.075] group-hover:bg-cyan-400/[0.115]", border: "border-cyan-300/[0.08] group-hover:border-cyan-300/[0.13]", glow: "bg-cyan-400/[0.12]" },
  sky: { icon: "text-sky-300 group-hover:text-sky-200", bg: "bg-sky-400/[0.07] group-hover:bg-sky-400/[0.11]", border: "border-sky-300/[0.08] group-hover:border-sky-300/[0.13]", glow: "bg-sky-400/[0.11]" },
  blue: { icon: "text-blue-300 group-hover:text-blue-200", bg: "bg-blue-400/[0.07] group-hover:bg-blue-400/[0.11]", border: "border-blue-300/[0.08] group-hover:border-blue-300/[0.13]", glow: "bg-blue-400/[0.11]" },
  violet: { icon: "text-violet-300 group-hover:text-violet-200", bg: "bg-violet-400/[0.075] group-hover:bg-violet-400/[0.115]", border: "border-violet-300/[0.08] group-hover:border-violet-300/[0.13]", glow: "bg-violet-400/[0.12]" },
  amber: { icon: "text-amber-300 group-hover:text-amber-200", bg: "bg-amber-400/[0.075] group-hover:bg-amber-400/[0.115]", border: "border-amber-300/[0.08] group-hover:border-amber-300/[0.13]", glow: "bg-amber-400/[0.12]" },
  orange: { icon: "text-orange-300 group-hover:text-orange-200", bg: "bg-orange-400/[0.075] group-hover:bg-orange-400/[0.115]", border: "border-orange-300/[0.08] group-hover:border-orange-300/[0.13]", glow: "bg-orange-400/[0.12]" },
  rose: { icon: "text-rose-300 group-hover:text-rose-200", bg: "bg-rose-400/[0.075] group-hover:bg-rose-400/[0.115]", border: "border-rose-300/[0.08] group-hover:border-rose-300/[0.13]", glow: "bg-rose-400/[0.12]" },
  indigo: { icon: "text-indigo-300 group-hover:text-indigo-200", bg: "bg-indigo-400/[0.075] group-hover:bg-indigo-400/[0.115]", border: "border-indigo-300/[0.08] group-hover:border-indigo-300/[0.13]", glow: "bg-indigo-400/[0.12]" },
  slate: { icon: "text-slate-300 group-hover:text-slate-200", bg: "bg-slate-300/[0.055] group-hover:bg-slate-300/[0.09]", border: "border-slate-300/[0.07] group-hover:border-slate-300/[0.11]", glow: "bg-slate-300/[0.08]" },
};

const menus: Menu[] = [
  { title: "Dashboard", url: "/dashboard", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "PURCHASING", "GUDANG"], icon: LayoutDashboard, iconTone: "emerald" },
  { title: "Dashboard Outlet", url: "/outlet/dashboard", roles: ["OUTLET_ADMIN"], icon: LayoutDashboard, iconTone: "teal" },

  { title: "FINANCE & ACCOUNTING", header: true },
  { title: "Payment", url: "/payment", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER"], icon: CreditCard, iconTone: "sky" },
  { title: "Purchase Payable / Hutang", url: "/purchase-payable", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "OUTLET_ADMIN"], icon: FileClock, iconTone: "amber" },
  { title: "Pengingat Pembayaran Hutang", url: "/pengingat-hutang", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "PURCHASING"], icon: FileClock, iconTone: "orange" },
  { title: "Petty Cash", url: "/petty-cash", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "OUTLET_ADMIN"], icon: WalletCards, iconTone: "emerald" },
  { title: "Master Account", url: "/petty-cash/accounts", roles: ["ADMIN", "ADMIN_PUSAT"], icon: WalletCards, iconTone: "violet" },

  { title: "PROCUREMENT & PURCHASING", header: true },
  { title: "Purchase Order", url: "/purchase", roles: ["ADMIN", "ADMIN_PUSAT"], icon: ShoppingCart, iconTone: "emerald" },
  { title: "Approval Purchase", url: "/purchase/approve", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "PURCHASING"], icon: ClipboardCheck, iconTone: "violet", badgeKey: "approvalPurchase" },
  { title: "Master Harga", url: "/master-harga", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "PURCHASING"], icon: Tag, iconTone: "amber" },
  { title: "Master Supplier", url: "/supplier", roles: ["ADMIN", "ADMIN_PUSAT", "PURCHASING"], icon: Truck, iconTone: "cyan" },

  { title: "WAREHOUSE & CENTRAL INVENTORY", header: true },
  { title: "Stock Pusat", url: "/stock", roles: ["ADMIN", "ADMIN_PUSAT", "GUDANG"], icon: Warehouse, iconTone: "emerald" },
  { title: "Cost Item Stock Pusat", url: "/inventory", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "GUDANG"], icon: Boxes, iconTone: "emerald" },
  { title: "Barang Masuk", url: "/barang-masuk", roles: ["ADMIN", "ADMIN_PUSAT", "GUDANG"], icon: ArrowDownToLine, iconTone: "teal", badgeKey: "barangMasuk" },
  { title: "Expired Barang Pusat", url: "/expired", roles: ["ADMIN", "ADMIN_PUSAT", "GUDANG"], icon: Package, iconTone: "rose" },
  { title: "Stock Opname Pusat", url: "/stock-opname", roles: ["ADMIN", "ADMIN_PUSAT", "GUDANG"], icon: ClipboardList, iconTone: "violet" },
  { title: "Adjustment Stock Pusat", url: "/adjustment", roles: ["ADMIN", "ADMIN_PUSAT", "GUDANG"], icon: SlidersHorizontal, iconTone: "amber" },
  { title: "History Stock Pusat", url: "/history", roles: ["ADMIN", "ADMIN_PUSAT", "GUDANG"], icon: FileClock, iconTone: "slate" },
  { title: "Waste Pusat", url: "/waste", roles: ["ADMIN", "ADMIN_PUSAT", "GUDANG"], icon: Trash2, iconTone: "rose" },
  { title: "Approval Waste Pusat", url: "/waste/approval", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER"], icon: ClipboardCheck, iconTone: "violet", badgeKey: "approvalWastePusat" },

  { title: "DELIVERY & DISTRIBUTION", header: true },
  { title: "Barang Keluar Pusat & Delivery Request", url: "/barang-keluar", roles: ["ADMIN", "ADMIN_PUSAT", "GUDANG"], icon: PackageMinus, iconTone: "orange", badgeKey: "deliveryRequest" },
  { title: "Delivery Order", url: "/pengiriman", roles: ["ADMIN", "ADMIN_PUSAT"], icon: Send, iconTone: "cyan", badgeKey: "deliveryOrder" },
  { title: "Surat Jalan", url: "/surat-jalan", roles: ["ADMIN", "ADMIN_PUSAT", "GUDANG"], icon: FileText, iconTone: "sky", badgeKey: "suratJalan" },

  { title: "MANUFACTURING & COST CONTROL", header: true },
  { title: "Menu & BOM", url: "/menu", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER"], icon: Utensils, iconTone: "amber" },
  { title: "Manufacture", url: "/manufacture", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "GUDANG", "OUTLET_ADMIN", "STAFF_OUTLET"], icon: Factory, iconTone: "orange" },
  { title: "Cost Control", url: "/cost-control", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "OUTLET_ADMIN"], icon: TrendingUp, iconTone: "teal" },

  { title: "OUTLET PROCUREMENT & MASTER", header: true },
  { title: "Master Barang Outlet", url: "/outlet/master-barang", roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"], icon: Package, iconTone: "teal" },
  { title: "Purchase Outlet", url: "/outlet/purchase", roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"], icon: ShoppingCart, iconTone: "emerald" },
  { title: "Transfer Outlet", url: "/outlet/transfer", roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"], icon: ArrowLeftRight, iconTone: "indigo" },

  { title: "OUTLET INVENTORY & STOCK CONTROL", header: true },
  { title: "Inventory Outlet", url: "/outlet/inventory", roles: ["ADMIN", "OUTLET_ADMIN"], icon: Boxes, iconTone: "emerald" },
  { title: "Stock Outlet", url: "/outlet/stock", roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"], icon: Boxes, iconTone: "emerald" },
  { title: "Stock Awal Outlet", url: "/outlet/stock-awal", roles: ["ADMIN", "ADMIN_PUSAT"], icon: Warehouse, iconTone: "amber" },
  { title: "Barang Masuk Outlet", url: "/outlet/barang-masuk", roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"], icon: ArrowDownToLine, iconTone: "teal", badgeKey: "barangMasukOutlet" },
  { title: "Barang Keluar Outlet", url: "/outlet/barang-keluar", roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"], icon: ArrowDownCircle, iconTone: "orange" },
  { title: "Waste Outlet", url: "/outlet/waste", roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"], icon: Trash2, iconTone: "rose" },
  { title: "Approval Waste Outlet", url: "/outlet/waste/approval", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER"], icon: ClipboardCheck, iconTone: "violet", badgeKey: "approvalWasteOutlet" },
  { title: "Stock Opname Outlet", url: "/outlet/stock-opname", roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"], icon: ClipboardList, iconTone: "violet" },
  { title: "Approval Stock Opname", url: "/outlet/stock-opname/approval", roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"], icon: ClipboardCheck, iconTone: "cyan", badgeKey: "approvalStockOpname" },
  { title: "Adjustment Outlet", url: "/outlet/adjustment", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "OUTLET_ADMIN"], icon: SlidersHorizontal, iconTone: "amber" },
  { title: "History Stock Outlet", url: "/outlet/history-stock", roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"], icon: FileClock, iconTone: "slate" },

  { title: "OUTLET DELIVERY & POS", header: true },
  { title: "Delivery Request To Gudang Pusat", url: "/outlet/delivery-request", roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"], icon: Truck, iconTone: "cyan" },
  { title: "POS Outlet", url: "/outlet/pos", roles: ["ADMIN", "ADMIN_PUSAT", "KASIR"], icon: ShoppingCart, iconTone: "violet" },

  { title: "OUTLET REPORTS & ANALYTICS", header: true },
  { title: "Laporan Pemakaian Items Outlet", url: "/outlet/laporan/pemakaian", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "OUTLET_ADMIN"], icon: TrendingUp, iconTone: "teal" },
  { title: "Laporan Barang Masuk Outlet", url: "/outlet/laporan/barang-masuk", roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"], icon: FileText, iconTone: "teal" },
  { title: "Laporan Purchase Outlet", url: "/outlet/laporan/purchase", roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"], icon: FileText, iconTone: "emerald" },
  { title: "Laporan Barang Keluar Outlet", url: "/outlet/laporan/barang-keluar", roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"], icon: PackageMinus, iconTone: "orange" },
  { title: "Laporan Delivery Outlet", url: "/outlet/laporan/delivery", roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"], icon: FileText, iconTone: "cyan" },
  { title: "Laporan Stock Outlet", url: "/outlet/laporan/stock", roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"], icon: FileText, iconTone: "violet" },

  { title: "MASTER DATA & HUMAN RESOURCES", header: true },
  { title: "Master Barang", url: "/master-barang", roles: ["ADMIN", "ADMIN_PUSAT", "PURCHASING"], icon: Package, iconTone: "emerald" },
  { title: "Master Customer", url: "/customer", roles: ["ADMIN", "ADMIN_PUSAT"], icon: Users, iconTone: "violet" },
  { title: "Master User", url: "/master/user", roles: ["ADMIN", "ADMIN_PUSAT", "OUTLET_ADMIN"], icon: UserCog, iconTone: "indigo" },
  { title: "Master Outlet", url: "/master/outlet", roles: ["ADMIN", "ADMIN_PUSAT"], icon: Warehouse, iconTone: "amber" },
  { title: "Master Karyawan", url: "/employee", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER"], icon: UserRound, iconTone: "rose" },

  { title: "REPORTS & ANALYTICS PUSAT", header: true },
  { title: "Laporan To Owner", url: "/laporan/owner", roles: ["ADMIN", "MANAGER"], icon: TrendingUp, iconTone: "emerald" },
  { title: "Laporan Purchase", url: "/laporan/purchase", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "PURCHASING"], icon: FileText, iconTone: "emerald" },
  { title: "Laporan Barang Masuk", url: "/laporan/barang-masuk", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "GUDANG"], icon: FileText, iconTone: "teal" },
  { title: "Laporan Barang Keluar", url: "/laporan/barang-keluar", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "GUDANG"], icon: FileText, iconTone: "orange" },
  { title: "Laporan Inventory", url: "/laporan/inventory", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER"], icon: FileText, iconTone: "emerald" },
  { title: "Laporan Supplier", url: "/laporan/supplier", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "PURCHASING"], icon: FileText, iconTone: "cyan" },
  { title: "Laporan Customer", url: "/laporan/customer", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "PURCHASING"], icon: FileText, iconTone: "violet" },
  { title: "Laporan Attendance", url: "/laporan/attendance", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER"], icon: FileText, iconTone: "sky" },
  { title: "Laporan Stock Opname", url: "/laporan/stock-opname", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "GUDANG"], icon: FileText, iconTone: "amber" },

  { title: "ATTENDANCE", header: true },
  { title: "Dashboard Absensi", url: "/attendance/dashboard", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "GUDANG"], icon: FileClock, iconTone: "cyan" },
  { title: "Attendance", url: "/attendance", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "GUDANG"], icon: CalendarCheck, iconTone: "sky" },
  { title: "Riwayat Absensi", url: "/attendance/history", roles: ["ADMIN", "ADMIN_PUSAT", "MANAGER", "GUDANG"], icon: History, iconTone: "violet" },

  { title: "SETTINGS", header: true },
  { title: "Pengaturan", url: "/pengaturan", roles: ["ADMIN", "ADMIN_PUSAT"], icon: Settings, iconTone: "slate" },
];

function normalizeCount(value: unknown): number {
  const n = Number(value ?? 0);
  return !Number.isFinite(n) || n <= 0 ? 0 : Math.floor(n);
}
function isActivePath(pathname: string, url?: string): boolean {
  return Boolean(url && (pathname === url || pathname.startsWith(`${url}/`)));
}

export default function Sidebar({ user, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const role = user?.role;
  const [pendingCounts, setPendingCounts] = useState<PendingCounts>(EMPTY_PENDING_COUNTS);
  const [menuSearch, setMenuSearch] = useState("");
  // Sengaja kosong: seluruh kelompok tertutup secara default, termasuk saat login.
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadPendingCounts = useCallback(async () => {
    if (!user?.id) { setPendingCounts(EMPTY_PENDING_COUNTS); return; }
    try {
      const response = await fetch("/api/sidebar/pending-counts", {
        method: "GET", cache: "no-store", credentials: "include",
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      });
      if (!response.ok) { console.error("SIDEBAR PENDING COUNTS HTTP ERROR:", response.status); return; }
      const data = await response.json();
      if (!data?.success) { console.error("SIDEBAR PENDING COUNTS API ERROR:", data?.message); return; }
      const c = data?.counts ?? {};
      setPendingCounts({
        approvalPurchase: normalizeCount(c.approvalPurchase),
        barangMasuk: normalizeCount(c.barangMasuk),
        deliveryOrder: normalizeCount(c.deliveryOrder),
        deliveryRequest: normalizeCount(c.deliveryRequest),
        suratJalan: normalizeCount(c.suratJalan),
        approvalWastePusat: normalizeCount(c.approvalWastePusat),
        barangMasukOutlet: normalizeCount(c.barangMasukOutlet),
        approvalWasteOutlet: normalizeCount(c.approvalWasteOutlet),
        approvalStockOpname: normalizeCount(c.approvalStockOpname),
      });
    } catch (error) { console.error("SIDEBAR PENDING COUNTS FETCH ERROR:", error); }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) { setPendingCounts(EMPTY_PENDING_COUNTS); return; }
    void loadPendingCounts();
    const id = window.setInterval(() => void loadPendingCounts(), 15000);
    return () => window.clearInterval(id);
  }, [user?.id, user?.role, user?.outletId, loadPendingCounts]);

  useEffect(() => {
    const refresh = () => void loadPendingCounts();
    window.addEventListener("erp:refresh-sidebar-counts", refresh);
    return () => window.removeEventListener("erp:refresh-sidebar-counts", refresh);
  }, [loadPendingCounts]);

  useEffect(() => {
    const visibility = () => { if (document.visibilityState === "visible") void loadPendingCounts(); };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [loadPendingCounts]);

  const roleFilteredMenus = useMemo(() => menus.filter((menu) => {
    if (menu.header) return true;
    return Boolean(menu.roles && role && menu.roles.includes(role));
  }), [role]);

  const { standaloneMenus, sections } = useMemo(() => {
    const standalone: Menu[] = [];
    const grouped: MenuSection[] = [];
    let current: MenuSection | null = null;
    for (const menu of roleFilteredMenus) {
      if (menu.header) {
        if (current?.items.length) grouped.push(current);
        current = { title: menu.title, items: [] };
      } else if (current) current.items.push(menu);
      else standalone.push(menu);
    }
    if (current?.items.length) grouped.push(current);
    return { standaloneMenus: standalone, sections: grouped };
  }, [roleFilteredMenus]);

  const query = menuSearch.trim().toLowerCase();
  const hasSearch = query.length > 0;
  const searchMatches = useCallback((menu: Menu) =>
    !query || menu.title.toLowerCase().includes(query) || Boolean(menu.url?.toLowerCase().includes(query)),
  [query]);

  const filteredStandaloneMenus = useMemo(() => standaloneMenus.filter(searchMatches), [standaloneMenus, searchMatches]);
  const filteredSections = useMemo(() => sections
    .map((section) => ({ ...section, items: section.items.filter(searchMatches) }))
    .filter((section) => section.items.length > 0), [sections, searchMatches]);
  const searchResultCount = filteredStandaloneMenus.length + filteredSections.reduce((sum, section) => sum + section.items.length, 0);

  const toggleSection = useCallback((title: string) => {
    setExpandedSections((previous) => ({ ...previous, [title]: !(previous[title] ?? false) }));
  }, []);

  // Jangan auto-expand kelompok aktif. Judul tetap terlihat dan aktif diberi aksen.
  const isSectionExpanded = useCallback((section: MenuSection) => {
    if (hasSearch) return true;
    return expandedSections[section.title] ?? false;
  }, [hasSearch, expandedSections]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menuSearch) { setMenuSearch(""); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); searchInputRef.current?.focus(); searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [menuSearch]);

  useEffect(() => { if (!open) setMenuSearch(""); }, [open]);

  const displayName = user?.fullname || user?.username || "User";
  const initials = displayName.split(" ").filter(Boolean).slice(0, 2).map((word) => word.charAt(0)).join("").toUpperCase() || "U";
  const roleLabel = role === "ADMIN_PUSAT" ? "ADMIN PUSAT" : role === "OUTLET_ADMIN" ? "ADMIN OUTLET" : role === "STAFF_OUTLET" ? "STAFF OUTLET" : role || "USER";
  const getBadgeValue = (key?: BadgeKey) => key ? normalizeCount(pendingCounts[key]) : 0;

  const renderMenuItem = (menu: Menu) => {
    if (!menu.url) return null;
    const active = isActivePath(pathname, menu.url);
    const Icon = menu.icon || Package;
    const tone = ICON_TONES[menu.iconTone || "emerald"];
    const badgeValue = getBadgeValue(menu.badgeKey);
    return (
      <Link key={menu.url} href={menu.url} onClick={() => {
        if (pathname !== menu.url) window.dispatchEvent(new CustomEvent("erp:navigation-start"));
        onClose();
      }} aria-current={active ? "page" : undefined}
        className={`group relative mb-1 flex min-h-[43px] items-center overflow-hidden rounded-xl border px-2.5 transition-all duration-200 ease-out ${
          active
            ? "border-emerald-300/15 bg-gradient-to-r from-emerald-300/[0.12] via-emerald-400/[0.07] to-transparent text-white shadow-[0_8px_25px_rgba(0,0,0,0.16)]"
            : "border-transparent text-emerald-100/60 hover:border-emerald-100/[0.08] hover:bg-emerald-100/[0.035] hover:text-white"
        }`}>
        {active && <>
          <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.8)]" />
          <span className="pointer-events-none absolute -right-8 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-emerald-400/[0.08] blur-2xl" />
        </>}
        <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border transition-all duration-300 group-hover:scale-[1.055] ${
          active ? "border-emerald-200/[0.13] bg-emerald-300/[0.14] text-emerald-200" : `${tone.bg} ${tone.border} ${tone.icon}`
        }`}>
          {!active && <span className={`pointer-events-none absolute -right-2 -top-2 h-5 w-5 rounded-full ${tone.glow} blur-md`} />}
          <Icon aria-hidden="true" size={16.5} strokeWidth={1.85} className="relative z-10 transition-transform duration-200 group-hover:scale-110" />
        </span>
        <span className={`relative ml-2.5 min-w-0 flex-1 truncate text-[10.5px] leading-4 transition-transform duration-200 group-hover:translate-x-0.5 ${active ? "font-bold text-white" : "font-medium"}`}>{menu.title}</span>
        {badgeValue > 0 && <span aria-label={`${badgeValue} pending`} className="relative mr-1 flex h-[23px] min-w-[23px] shrink-0 items-center justify-center rounded-full border border-emerald-100/30 bg-emerald-100 px-1.5 text-[9px] font-black leading-none text-[#123D2B] shadow-md">
          {badgeValue > 99 ? "99+" : badgeValue}
          <span className="absolute right-[3px] top-[3px] h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>}
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-all ${active ? "text-emerald-300/80" : "text-transparent group-hover:text-emerald-100/40"}`}>
          <ChevronRight size={13} strokeWidth={1.8} />
        </span>
      </Link>
    );
  };

  return <>
    {open && <button type="button" aria-label="Tutup sidebar" onClick={onClose} className="fixed inset-0 z-40 cursor-default bg-[#03170F]/70 backdrop-blur-[6px] transition-opacity duration-300" />}
    <aside className={`fixed left-0 top-0 z-50 flex h-dvh w-[292px] shrink-0 flex-col overflow-hidden border-r border-emerald-100/[0.09] bg-[#06251A] text-white shadow-[24px_0_90px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? "translate-x-0" : "-translate-x-full"}`}>
      {/* Premium deep emerald backdrop */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-44 -top-40 h-[470px] w-[470px] rounded-full bg-emerald-400/[0.10] blur-[135px]" />
        <div className="absolute -right-40 top-[28%] h-[390px] w-[390px] rounded-full bg-teal-300/[0.055] blur-[125px]" />
        <div className="absolute -bottom-48 -left-32 h-[440px] w-[440px] rounded-full bg-green-500/[0.07] blur-[135px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_0%,rgba(167,243,208,0.07),transparent_30%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#02150D]/25 via-transparent to-black/[0.20]" />
      </div>

      {/* BRAND + PROFILE + SEARCH */}
      <div className="relative shrink-0 border-b border-emerald-100/[0.08] px-5 pb-4 pt-5">
        <div className="flex items-start gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-emerald-200/[0.18] bg-gradient-to-br from-emerald-300/[0.20] via-emerald-100/[0.06] to-transparent shadow-lg">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(110,231,183,0.25),transparent_48%)]" />
            <span className="relative text-[10px] font-black tracking-[-0.08em] text-emerald-50">MGB</span>
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h1 className="text-[18px] font-bold leading-[1.2] tracking-[-0.04em] text-white">PT. MITRA GARAM<br />BOGATAMA</h1>
            <div className="mt-2.5 flex items-center gap-2">
              <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.85)]" />
              <p className="text-[7px] font-semibold uppercase tracking-[0.20em] text-emerald-100/50">ERP Inventory System</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup sidebar" className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-100/[0.10] bg-emerald-50/[0.035] text-emerald-100/55 transition-all hover:border-emerald-200/20 hover:bg-emerald-300/[0.08] hover:text-white active:scale-90"><X size={15} strokeWidth={1.8} /></button>
        </div>

        <div className="group relative mt-5 overflow-hidden rounded-2xl border border-emerald-100/[0.10] bg-emerald-50/[0.035] p-3 shadow-lg backdrop-blur-xl transition-all hover:border-emerald-200/[0.16] hover:bg-emerald-50/[0.05]">
          <div className="pointer-events-none absolute -left-12 -top-12 h-32 w-32 rounded-full bg-emerald-400/[0.09] blur-3xl" />
          <div className="relative flex items-center gap-3">
            <div className="relative h-10 w-10 shrink-0">
              <div className="h-10 w-10 overflow-hidden rounded-xl border border-emerald-100/[0.13] bg-emerald-300/[0.10]">
                {user?.photo ? <img src={user.photo} alt={displayName} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[10px] font-black text-emerald-50">{initials}</div>}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-[#06251A] bg-emerald-300 shadow-[0_0_9px_rgba(52,211,153,0.85)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold leading-4 text-white">{displayName}</p>
              <div className="mt-1 flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-emerald-300/70" /><p className="truncate text-[7px] font-bold uppercase tracking-[0.14em] text-emerald-100/50">{roleLabel}</p></div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200/[0.10] bg-emerald-300/[0.05] px-2 py-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /><span className="text-[6px] font-bold uppercase tracking-[0.12em] text-emerald-100/55">Online</span></div>
          </div>
        </div>

        <div className="relative mt-3.5">
          <div className={`group relative flex h-[41px] items-center overflow-hidden rounded-xl border transition-all duration-200 ${hasSearch ? "border-emerald-300/25 bg-emerald-400/[0.06] shadow-lg" : "border-emerald-100/[0.09] bg-[#03170F]/35 hover:border-emerald-100/[0.14] hover:bg-emerald-50/[0.035]"}`}>
            <span className={`ml-3 flex shrink-0 items-center justify-center ${hasSearch ? "text-emerald-300" : "text-emerald-100/40 group-focus-within:text-emerald-300"}`}><Search size={15} strokeWidth={1.9} /></span>
            <input ref={searchInputRef} type="text" value={menuSearch} onChange={(event) => setMenuSearch(event.target.value)} placeholder="Cari menu..." aria-label="Cari menu sidebar" spellCheck={false} autoComplete="off" className="min-w-0 flex-1 bg-transparent px-2.5 text-[10px] font-medium text-white outline-none placeholder:text-emerald-100/35" />
            {hasSearch ? <button type="button" aria-label="Hapus pencarian" onClick={() => { setMenuSearch(""); searchInputRef.current?.focus(); }} className="mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-emerald-100/50 transition hover:bg-emerald-50/[0.07] hover:text-white"><X size={13} strokeWidth={2} /></button> : <button type="button" aria-label="Fokus pencarian menu" onClick={() => searchInputRef.current?.focus()} className="mr-2 hidden h-6 shrink-0 items-center rounded-md border border-emerald-100/[0.08] bg-emerald-50/[0.025] px-1.5 text-[6px] font-bold tracking-[0.08em] text-emerald-100/35 hover:text-emerald-100/65 min-[1100px]:flex">CTRL K</button>}
          </div>
          {hasSearch && <div className="mt-1.5 flex items-center justify-between px-1"><span className="text-[7px] font-bold uppercase tracking-[0.14em] text-emerald-100/40">Hasil pencarian</span><span className="rounded-full border border-emerald-300/[0.10] bg-emerald-300/[0.05] px-1.5 py-0.5 text-[7px] font-bold text-emerald-300">{searchResultCount}</span></div>}
        </div>
      </div>

      {/* NAVIGATION */}
      <nav aria-label="Navigasi utama" className="relative flex-1 overflow-y-auto px-3.5 py-3.5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-100/[0.08] hover:[&::-webkit-scrollbar-thumb]:bg-emerald-100/[0.16]">
        {filteredStandaloneMenus.length > 0 && <div className="mb-3">{filteredStandaloneMenus.map(renderMenuItem)}</div>}

        {filteredSections.map((section) => {
          const expanded = isSectionExpanded(section);
          const sectionActive = section.items.some((menu) => isActivePath(pathname, menu.url));
          const sectionPending = section.items.reduce((total, menu) => total + getBadgeValue(menu.badgeKey), 0);
          return <div key={section.title} className="mb-2 overflow-hidden">
            <button type="button" onClick={() => toggleSection(section.title)} aria-expanded={expanded}
              className={`group relative flex min-h-[48px] w-full items-center gap-2.5 overflow-hidden rounded-xl border px-3 text-left transition-all duration-200 ${
                expanded || sectionActive
                  ? "border-emerald-200/[0.13] bg-gradient-to-r from-emerald-300/[0.09] via-emerald-300/[0.035] to-transparent text-white shadow-[0_5px_18px_rgba(0,0,0,0.10)]"
                  : "border-emerald-100/[0.035] text-emerald-100/65 hover:border-emerald-100/[0.10] hover:bg-emerald-50/[0.035] hover:text-white"
              }`}>
              <span className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                sectionActive || expanded ? "border-emerald-200/[0.14] bg-emerald-300/[0.10] text-emerald-200" : "border-emerald-100/[0.07] bg-emerald-50/[0.025] text-emerald-100/40 group-hover:text-emerald-100/75"
              }`}><ChevronRight size={14} strokeWidth={2} className={`transition-transform duration-300 ${expanded ? "rotate-90" : ""}`} /></span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[8px] font-extrabold uppercase leading-[1.45] tracking-[0.105em] ${sectionActive || expanded ? "text-emerald-50" : "text-inherit"}`}>{section.title}</span>
                <span className="mt-1 block text-[6.5px] font-medium uppercase tracking-[0.15em] text-emerald-100/30">{section.items.length} menu</span>
              </span>
              {sectionPending > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-emerald-100/25 bg-emerald-200 px-1 text-[8px] font-black text-[#073522] shadow-[0_0_14px_rgba(110,231,183,0.14)]">{sectionPending > 99 ? "99+" : sectionPending}</span>}
              <ChevronDown size={14} strokeWidth={1.8} className={`shrink-0 transition-transform duration-300 ${expanded ? "rotate-180 text-emerald-300" : "text-emerald-100/35 group-hover:text-emerald-100/70"}`} />
              {sectionActive && <span className="absolute bottom-2 left-[13px] h-1 w-1 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.75)]" />}
            </button>
            <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
              <div className="min-h-0 overflow-hidden">
                <div className="ml-[17px] mt-2 border-l border-emerald-100/[0.10] pl-2">{section.items.map(renderMenuItem)}</div>
              </div>
            </div>
          </div>;
        })}

        {filteredStandaloneMenus.length === 0 && filteredSections.length === 0 && <div className="flex min-h-[210px] flex-col items-center justify-center px-5 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-100/[0.09] bg-emerald-50/[0.025] text-emerald-100/40"><Search size={18} strokeWidth={1.6} /></div>
          <p className="mt-3 text-[10px] font-bold text-emerald-50/80">Menu tidak ditemukan</p>
          <p className="mt-1 max-w-[190px] text-[8px] leading-relaxed text-emerald-100/40">Tidak ada menu yang cocok dengan pencarian &quot;{menuSearch.trim()}&quot;.</p>
          <button type="button" onClick={() => setMenuSearch("")} className="mt-3 rounded-lg border border-emerald-300/[0.13] bg-emerald-300/[0.05] px-3 py-1.5 text-[8px] font-bold uppercase tracking-[0.10em] text-emerald-300 transition hover:bg-emerald-300/[0.10]">Hapus Pencarian</button>
        </div>}
      </nav>

      {/* FOOTER */}
      <div className="relative shrink-0 border-t border-emerald-100/[0.08] px-4 py-3.5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_9px_rgba(52,211,153,0.8)]" /><p className="text-[7px] font-bold uppercase tracking-[0.2em] text-emerald-50/80">MGB ERP</p></div>
            <p className="mt-1 truncate text-[7px] font-medium text-emerald-100/35">Enterprise Management</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-200/[0.10] bg-emerald-300/[0.045] px-2.5 py-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /><span className="text-[6.5px] font-bold uppercase tracking-[0.14em] text-emerald-100/50">Online</span></div>
        </div>
        <div className="mt-3 flex items-center gap-2"><div className="h-px flex-1 bg-emerald-100/[0.06]" /><div className="flex items-center gap-1 text-emerald-100/35"><Sparkles size={8} strokeWidth={1.7} /><span className="text-[5.5px] font-semibold uppercase tracking-[0.16em]">Premium ERP</span></div><div className="h-px flex-1 bg-emerald-100/[0.06]" /></div>
      </div>
    </aside>
  </>;
}
