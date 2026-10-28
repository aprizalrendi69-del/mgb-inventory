"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, RotateCcw, Save, Settings2, Monitor, CalendarDays, Coins } from "lucide-react";

type Preferences = { dateFormat: "id-ID" | "en-GB"; currency: "IDR"; compactTables: boolean; confirmBeforeDelete: boolean };
const DEFAULTS: Preferences = { dateFormat: "id-ID", currency: "IDR", compactTables: false, confirmBeforeDelete: true };
const KEY = "mgb-erp-preferences-v1";

export default function PreferensiPage() {
  const [value, setValue] = useState<Preferences>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) { const parsed = JSON.parse(raw); setValue({ ...DEFAULTS, ...parsed }); } }
    catch { /* Use defaults if browser storage is unavailable or malformed. */ }
    finally { setLoaded(true); }
  }, []);
  function save() { try { localStorage.setItem(KEY, JSON.stringify(value)); setSaved(true); window.setTimeout(() => setSaved(false), 2500); } catch { window.alert("Preferensi tidak dapat disimpan di browser ini."); } }
  function reset() { setValue(DEFAULTS); try { localStorage.removeItem(KEY); } catch {} setSaved(false); }
  return <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-9 dark:bg-slate-950"><div className="mx-auto max-w-5xl space-y-6">
    <Link href="/pengaturan" className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-emerald-700"><ArrowLeft size={15}/> Kembali ke Pengaturan</Link>
    <header className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start gap-4"><div className="rounded-2xl bg-emerald-50 p-3 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"><Settings2 size={25}/></div><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-700 dark:text-emerald-400">System preferences</p><h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Preferensi Sistem</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">Atur preferensi tampilan untuk browser yang sedang digunakan. Preferensi ini tidak mengubah perhitungan transaksi, database, atau pengaturan pengguna lain.</p></div></div></header>
    <section className="space-y-4 rounded-[26px] border border-slate-200 bg-white p-5 sm:p-7 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800"><CalendarDays size={18} className="text-emerald-700"/><div><h2 className="font-extrabold">Format lokal</h2><p className="text-xs text-slate-500">Pilihan format tanggal dan mata uang untuk referensi pengguna.</p></div></div>
      <label className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-center"><span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Format tanggal</span><select disabled={!loaded} value={value.dateFormat} onChange={(e)=>setValue(v=>({...v,dateFormat:e.target.value as Preferences["dateFormat"]}))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="id-ID">Indonesia (25 Oktober 2026)</option><option value="en-GB">Internasional (25/10/2026)</option></select></label>
      <label className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-center"><span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><Coins size={16}/> Mata uang tampilan</span><select disabled value={value.currency} className="h-11 rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800"><option value="IDR">IDR — Rupiah Indonesia</option></select></label>
      <div className="flex items-center gap-3 border-b border-t border-slate-100 py-4 dark:border-slate-800"><Monitor size={18} className="text-emerald-700"/><div><h2 className="font-extrabold">Kenyamanan tampilan</h2><p className="text-xs text-slate-500">Preferensi disimpan lokal pada browser ini.</p></div></div>
      <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800"><span><span className="block text-sm font-bold">Tabel lebih ringkas</span><span className="mt-1 block text-xs leading-5 text-slate-500">Simpan preferensi agar halaman dapat menggunakannya saat integrasi tampilan tersedia.</span></span><input type="checkbox" checked={value.compactTables} onChange={(e)=>setValue(v=>({...v,compactTables:e.target.checked}))} className="mt-1 h-4 w-4 accent-emerald-700"/></label>
      <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800"><span><span className="block text-sm font-bold">Konfirmasi sebelum penghapusan</span><span className="mt-1 block text-xs leading-5 text-slate-500">Preferensi disimpan; setiap modul tetap wajib menerapkan konfirmasi dan pemeriksaan hak aksesnya sendiri.</span></span><input type="checkbox" checked={value.confirmBeforeDelete} onChange={(e)=>setValue(v=>({...v,confirmBeforeDelete:e.target.checked}))} className="mt-1 h-4 w-4 accent-emerald-700"/></label>
      <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"><p className="text-xs text-slate-500">{saved ? <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700"><Check size={14}/> Preferensi tersimpan di browser ini.</span> : "Simpan untuk menerapkan preferensi pada browser ini."}</p><div className="flex gap-2"><button type="button" onClick={reset} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"><RotateCcw size={15}/> Reset</button><button type="button" disabled={!loaded} onClick={save} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50 dark:bg-emerald-700"><Save size={15}/> Simpan Preferensi</button></div></div>
    </section>
  </div></main>;
}
