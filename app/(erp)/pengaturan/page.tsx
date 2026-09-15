"use client";

import Link from "next/link";
import {
  Building2,
  FileText,
  Warehouse,
  UsersRound,
  DatabaseBackup,
  FolderOpen,
  Settings2,
  CalendarClock,
  Info,
  ArrowUpRight,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

const menus = [
  {
    title: "Profil Perusahaan",
    icon: Building2,
    desc: "Kelola nama perusahaan, logo, alamat, NPWP, dan informasi identitas perusahaan.",
    href: "/pengaturan/perusahaan",
    category: "Perusahaan",
  },
  {
    title: "Nomor Dokumen",
    icon: FileText,
    desc: "Atur format dan penomoran otomatis untuk PO, GR, DO, Surat Jalan, dan dokumen ERP.",
    href: "/pengaturan/dokumen",
    category: "Dokumen",
  },
  {
    title: "Gudang",
    icon: Warehouse,
    desc: "Kelola master gudang dan konfigurasi lokasi penyimpanan barang.",
    href: "/pengaturan/gudang",
    category: "Inventori",
  },
  {
    title: "User & Hak Akses",
    icon: UsersRound,
    desc: "Atur user, role, permission, serta kontrol akses terhadap modul ERP.",
    href: "/pengaturan/user",
    category: "Keamanan",
  },
  {
    title: "Backup Database",
    icon: DatabaseBackup,
    desc: "Buat dan download backup database untuk menjaga keamanan data perusahaan.",
    href: "/pengaturan/backup",
    category: "Database",
  },
  {
    title: "Restore Database",
    icon: FolderOpen,
    desc: "Pulihkan database dari file backup yang tersedia dengan aman dan terkontrol.",
    href: "/pengaturan/restore",
    category: "Database",
  },
  {
    title: "Preferensi Sistem",
    icon: Settings2,
    desc: "Konfigurasi tanggal, mata uang, format tampilan, dan preferensi sistem ERP.",
    href: "/pengaturan/preferensi",
    category: "Sistem",
  },
  {
    title: "Pengaturan Expired",
    icon: CalendarClock,
    desc: "Atur warning expired, masa berlaku barang, serta mekanisme FEFO inventory.",
    href: "/pengaturan/expired",
    category: "Inventori",
  },
  {
    title: "Tentang Aplikasi",
    icon: Info,
    desc: "Informasi versi aplikasi, sistem ERP, dan detail aplikasi MGB Inventory.",
    href: "/pengaturan/about",
    category: "Informasi",
  },
];

export default function PengaturanPage() {
  return (
    <div className="min-h-screen bg-[#f5f8f7]">
      {/* BACKGROUND DECORATION */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-[420px] w-[420px] rounded-full bg-[#497F70]/5 blur-3xl" />
        <div className="absolute -left-40 top-[45%] h-[360px] w-[360px] rounded-full bg-[#18352D]/5 blur-3xl" />
      </div>

      <div className="relative p-5 md:p-8 lg:p-10">
        <div className="mx-auto max-w-[1500px]">

          {/* =====================================================
              HEADER
          ====================================================== */}
          <div className="mb-8 overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_18px_55px_rgba(24,53,45,0.08)]">
            <div className="relative">

              {/* TOP ACCENT */}
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#18352D] via-[#497F70] to-[#8db7a9]" />

              <div className="flex flex-col gap-6 p-6 md:p-8 lg:flex-row lg:items-center lg:justify-between">

                {/* TITLE */}
                <div className="flex items-start gap-4">

                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#18352D] shadow-lg shadow-[#18352D]/20">
                    <Settings2
                      size={27}
                      strokeWidth={1.8}
                      className="text-white"
                    />
                  </div>

                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#497F70]">
                        System Administration
                      </span>

                      <span className="h-1 w-1 rounded-full bg-[#497F70]" />

                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        MGB ERP
                      </span>
                    </div>

                    <h1 className="text-2xl font-black tracking-tight text-[#18352D] md:text-3xl">
                      Pengaturan Sistem
                    </h1>

                    <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
                      Kelola konfigurasi, keamanan, database, dokumen, dan
                      preferensi sistem ERP PT. Mitra Garam Bogatama.
                    </p>
                  </div>
                </div>

                {/* SYSTEM STATUS */}
                <div className="flex w-fit items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">

                  <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm">
                    <ShieldCheck
                      size={19}
                      className="text-[#497F70]"
                      strokeWidth={2}
                    />

                    <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                  </div>

                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">
                      System Status
                    </p>

                    <p className="mt-0.5 text-xs font-bold text-[#18352D]">
                      Sistem Berjalan Normal
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* =====================================================
              SECTION TITLE
          ====================================================== */}
          <div className="mb-5 flex items-end justify-between">

            <div>
              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#497F70]">
                Configuration Center
              </p>

              <h2 className="text-lg font-black tracking-tight text-[#18352D]">
                Konfigurasi ERP
              </h2>
            </div>

            <div className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-500 shadow-sm sm:block">
              {menus.length} Pengaturan
            </div>

          </div>

          {/* =====================================================
              MENU GRID
          ====================================================== */}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">

            {menus.map((menu, index) => {
              const Icon = menu.icon;

              return (
                <Link
                  key={menu.href}
                  href={menu.href}
                  className="group relative overflow-hidden rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-[0_8px_30px_rgba(24,53,45,0.045)] transition-all duration-300 hover:-translate-y-1.5 hover:border-[#497F70]/30 hover:shadow-[0_18px_45px_rgba(24,53,45,0.11)]"
                >

                  {/* DECORATIVE CIRCLE */}
                  <div className="absolute right-0 top-0 h-28 w-28 translate-x-8 -translate-y-8 rounded-full bg-[#497F70]/[0.035] transition-transform duration-500 group-hover:scale-150" />

                  {/* NUMBER */}
                  <div className="absolute right-5 top-5 text-[10px] font-black tabular-nums text-slate-200 transition-colors duration-300 group-hover:text-[#497F70]/30">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  {/* ICON */}
                  <div className="relative mb-5 flex items-center justify-between">

                    <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-[#497F70]/10 bg-[#497F70]/[0.07] text-[#497F70] transition-all duration-300 group-hover:border-[#497F70]/20 group-hover:bg-[#497F70] group-hover:text-white group-hover:shadow-lg group-hover:shadow-[#497F70]/20">
                      <Icon
                        size={23}
                        strokeWidth={1.8}
                      />
                    </div>

                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-100 bg-slate-50 text-slate-300 transition-all duration-300 group-hover:border-[#497F70]/20 group-hover:bg-[#497F70]/10 group-hover:text-[#497F70]">
                      <ArrowUpRight
                        size={15}
                        strokeWidth={2.2}
                        className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      />
                    </div>

                  </div>

                  {/* CATEGORY */}
                  <div className="mb-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.13em] text-slate-400 transition-colors group-hover:bg-[#497F70]/10 group-hover:text-[#497F70]">
                      {menu.category}
                    </span>
                  </div>

                  {/* TITLE */}
                  <h3 className="text-[17px] font-black tracking-tight text-[#18352D] transition-colors duration-300 group-hover:text-[#497F70]">
                    {menu.title}
                  </h3>

                  {/* DESCRIPTION */}
                  <p className="mt-2 min-h-[48px] text-[12px] leading-5 text-slate-500">
                    {menu.desc}
                  </p>

                  {/* FOOTER */}
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">

                    <span className="text-[10px] font-bold text-slate-400 transition-colors group-hover:text-[#497F70]">
                      Buka Pengaturan
                    </span>

                    <ChevronRight
                      size={15}
                      className="text-slate-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-[#497F70]"
                    />

                  </div>

                  {/* HOVER LINE */}
                  <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-[#497F70] transition-all duration-500 group-hover:w-full" />

                </Link>
              );
            })}

          </div>

          {/* =====================================================
              FOOTER INFO
          ====================================================== */}
          <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/70 px-5 py-4 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-3">

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#18352D]">
                <Building2
                  size={15}
                  className="text-white"
                  strokeWidth={1.8}
                />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-[#18352D]">
                  PT. Mitra Garam Bogatama
                </p>

                <p className="text-[10px] text-slate-400">
                  Enterprise Resource Planning System
                </p>
              </div>

            </div>

            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              MGB Inventory • System Configuration
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}