"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Building2, FileText, Warehouse, UsersRound, DatabaseBackup, FolderOpen,
  Settings2, CalendarClock, Info, ArrowUpRight, Search, ShieldCheck,
  SlidersHorizontal, CheckCircle2, AlertTriangle, Sparkles,
} from "lucide-react";

type SettingMenu = {
  title: string; icon: typeof Building2; desc: string; href: string;
  category: string; status: "ready" | "partial" | "pending";
};

const menus: SettingMenu[] = [
  { title: "Profil Perusahaan", icon: Building2, desc: "Identitas legal, logo, alamat, kontak, NPWP, dan informasi yang dicetak pada dokumen.", href: "/pengaturan/perusahaan", category: "Perusahaan", status: "ready" },
  { title: "Nomor Dokumen", icon: FileText, desc: "Konfigurasi awalan dan periode nomor dokumen. Integrasi ke semua generator nomor perlu diverifikasi per modul.", href: "/pengaturan/dokumen", category: "Dokumen", status: "partial" },
  { title: "Gudang", icon: Warehouse, desc: "Lokasi dan sumber persediaan. Modul pengaturan gudang khusus belum tersedia.", href: "/pengaturan/gudang", category: "Inventori", status: "pending" },
  { title: "User & Hak Akses", icon: UsersRound, desc: "Kelola akun, status aktif, outlet, dan role pengguna.", href: "/pengaturan/user", category: "Keamanan", status: "ready" },
  { title: "Backup Database", icon: DatabaseBackup, desc: "Buat salinan database sebelum pembaruan atau pemeliharaan.", href: "/pengaturan/backup", category: "Database", status: "partial" },
  { title: "Restore Database", icon: FolderOpen, desc: "Pemulihan data berisiko tinggi; halaman ini harus memvalidasi backup sebelum mengganti database.", href: "/pengaturan/restore", category: "Database", status: "pending" },
  { title: "Preferensi Sistem", icon: Settings2, desc: "Preferensi tampilan dan format lokal untuk browser ini.", href: "/pengaturan/preferensi", category: "Sistem", status: "ready" },
  { title: "Pengaturan Expired", icon: CalendarClock, desc: "Atur batas peringatan kedaluwarsa per barang menggunakan nilai expiredWarning.", href: "/pengaturan/expired", category: "Inventori", status: "partial" },
  { title: "Tentang Aplikasi", icon: Info, desc: "Informasi aplikasi dan lingkungan versi yang sedang digunakan.", href: "/pengaturan/about", category: "Informasi", status: "ready" },
];

const statusLabel = { ready: "Tersedia", partial: "Perlu verifikasi", pending: "Belum tersedia" };
const statusStyle = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  partial: "border-amber-200 bg-amber-50 text-amber-700",
  pending: "border-slate-200 bg-slate-100 text-slate-500",
};

export default function PengaturanPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Semua");
  const categories = ["Semua", ...Array.from(new Set(menus.map((m) => m.category)))];
  const filtered = useMemo(() => menus.filter((m) =>
    (category === "Semua" || m.category === category) &&
    `${m.title} ${m.desc} ${m.category}`.toLowerCase().includes(search.trim().toLowerCase())
  ), [search, category]);
  const readyCount = menus.filter((m) => m.status === "ready").length;
  const reviewCount = menus.filter((m) => m.status !== "ready").length;

  return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-800 sm:px-6 lg:px-9 dark:bg-slate-950 dark:text-slate-100">
    <div className="mx-auto max-w-[1500px] space-y-7">
      <section className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,.08)] dark:border-slate-800 dark:bg-slate-900">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-900 via-emerald-700 to-teal-300 dark:from-slate-500 dark:via-emerald-500 dark:to-teal-300" />
        <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative grid gap-7 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end lg:p-10">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.18em] text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"><Sparkles size={13}/> Control center · MGB ERP</div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Pengaturan Sistem</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">Satu tempat untuk mengelola identitas perusahaan, dokumen, inventori, pengguna, dan preferensi. Status di bawah dibuat transparan agar modul yang belum selesai tidak terlihat seolah-olah sudah aktif.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/40"><div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={16}/><span className="text-[10px] font-bold uppercase tracking-wider">Tersedia</span></div><p className="mt-2 text-3xl font-black tabular-nums">{readyCount}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">modul siap digunakan</p></div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/30"><div className="flex items-center gap-2 text-amber-700 dark:text-amber-300"><AlertTriangle size={16}/><span className="text-[10px] font-bold uppercase tracking-wider">Tinjau</span></div><p className="mt-2 text-3xl font-black tabular-nums">{reviewCount}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">modul perlu tindak lanjut</p></div>
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-700 dark:text-emerald-400">Configuration directory</p><h2 className="mt-1 text-xl font-extrabold">Semua konfigurasi</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{filtered.length} dari {menus.length} modul ditampilkan</p></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative block"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Cari pengaturan..." className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 sm:w-64 dark:border-slate-700 dark:bg-slate-900"/></label>
          <label className="relative flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"><SlidersHorizontal size={15} className="text-slate-400"/><select value={category} onChange={(e)=>setCategory(e.target.value)} className="max-w-[180px] bg-transparent text-sm outline-none">{categories.map((c)=><option key={c} value={c}>{c}</option>)}</select></label>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((menu, index) => { const Icon = menu.icon; return <Link key={menu.href} href={menu.href} className="group relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-[0_18px_45px_rgba(15,23,42,.10)] focus:outline-none focus:ring-4 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-700">
          <div className="absolute right-0 top-0 h-28 w-28 translate-x-8 -translate-y-8 rounded-full bg-emerald-500/[.04] transition group-hover:scale-150"/>
          <div className="relative flex items-start justify-between gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"><Icon size={22}/></div><span className="text-xs font-black tracking-widest text-slate-300 dark:text-slate-600">{String(index+1).padStart(2,"0")}</span></div>
          <div className="relative mt-5 flex items-center justify-between gap-2"><h3 className="text-base font-extrabold">{menu.title}</h3><ArrowUpRight size={17} className="shrink-0 text-slate-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-emerald-600"/></div>
          <p className="relative mt-2 min-h-[60px] text-sm leading-6 text-slate-500 dark:text-slate-400">{menu.desc}</p>
          <div className="relative mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800"><span className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">{menu.category}</span><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusStyle[menu.status]}`}>{statusLabel[menu.status]}</span></div>
        </Link>; })}
        {filtered.length===0 && <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-12 text-center text-sm text-slate-500">Tidak ada pengaturan yang cocok dengan pencarian.</div>}
      </section>
      <p className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600"/>Pengaturan database dan restore memiliki risiko terhadap data operasional. Jangan mengganti atau memulihkan database produksi tanpa backup teruji dan pemeriksaan akses.</p>
    </div>
  </main>;
}
