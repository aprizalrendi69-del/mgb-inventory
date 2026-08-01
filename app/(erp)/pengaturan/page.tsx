"use client";

import Link from "next/link";

const menus = [
  {
    title: "Profil Perusahaan",
    icon: "🏢",
    desc: "Nama perusahaan, logo, alamat, NPWP",
    href: "/pengaturan/perusahaan",
  },
  {
    title: "Nomor Dokumen",
    icon: "📄",
    desc: "Format nomor PO, GR, DO, SJ",
    href: "/pengaturan/dokumen",
  },
  {
    title: "Gudang",
    icon: "🏬",
    desc: "Master Gudang",
    href: "/pengaturan/gudang",
  },
  {
    title: "User & Hak Akses",
    icon: "👤",
    desc: "Role dan Permission",
    href: "/pengaturan/user",
  },
  {
    title: "Backup Database",
    icon: "💾",
    desc: "Download Database",
    href: "/pengaturan/backup",
  },
  {
    title: "Restore Database",
    icon: "📂",
    desc: "Restore Database",
    href: "/pengaturan/restore",
  },
  {
    title: "Preferensi Sistem",
    icon: "⚙️",
    desc: "Tanggal, Mata Uang, Tema",
    href: "/pengaturan/preferensi",
  },
  {
    title: "Pengaturan Expired",
    icon: "📅",
    desc: "Warning Expired & FEFO",
    href: "/pengaturan/expired",
  },
  {
    title: "Tentang Aplikasi",
    icon: "ℹ️",
    desc: "Informasi ERP",
    href: "/pengaturan/about",
  },
];

export default function PengaturanPage() {
  return (
    <div className="p-8">

      <h1 className="text-3xl font-bold mb-2">
        Pengaturan Sistem
      </h1>

      <p className="text-gray-500 mb-8">
        Konfigurasi ERP PT. Mitra Garam Bogatama
      </p>

      <div className="grid md:grid-cols-3 gap-6">

        {menus.map((menu) => (

          <Link
            key={menu.href}
            href={menu.href}
            className="bg-white rounded-xl shadow hover:shadow-xl transition p-6 border hover:border-blue-500"
          >

            <div className="text-5xl mb-4">
              {menu.icon}
            </div>

            <h2 className="text-xl font-bold">
              {menu.title}
            </h2>

            <p className="text-gray-500 mt-2">
              {menu.desc}
            </p>

          </Link>

        ))}

      </div>

    </div>
  );
}