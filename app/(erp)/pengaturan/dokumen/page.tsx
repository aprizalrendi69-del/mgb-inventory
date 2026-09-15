"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Hash,
  Save,
  RotateCcw,
  CheckCircle2,
  Info,
  Receipt,
  Truck,
  ClipboardList,
  PackageCheck,
  Search,
} from "lucide-react";

type DocumentConfig = {
  id: string;
  name: string;
  description: string;
  prefix: string;
  example: string;
  icon: React.ReactNode;
  color: string;
};

const INITIAL_DOCUMENTS: DocumentConfig[] = [
  {
    id: "purchase",
    name: "Purchase Order",
    description: "Nomor dokumen pembelian / PO.",
    prefix: "PO",
    example: "PO-202609-00001",
    icon: <ClipboardList size={19} />,
    color: "bg-blue-50 text-blue-600",
  },
  {
    id: "goods-receipt",
    name: "Goods Receipt",
    description: "Nomor penerimaan barang dari supplier.",
    prefix: "GR",
    example: "GR-202609-00001",
    icon: <PackageCheck size={19} />,
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    id: "delivery-order",
    name: "Delivery Order",
    description: "Nomor dokumen pengiriman barang.",
    prefix: "DO",
    example: "DO-202609-00001",
    icon: <Truck size={19} />,
    color: "bg-amber-50 text-amber-600",
  },
  {
    id: "surat-jalan",
    name: "Surat Jalan",
    description: "Nomor dokumen surat jalan pengiriman.",
    prefix: "SJ",
    example: "SJ-202609-00001",
    icon: <Receipt size={19} />,
    color: "bg-purple-50 text-purple-600",
  },
];

function getCurrentPeriod() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  return `${year}${month}`;
}

function createExample(
  prefix: string
) {
  const period = getCurrentPeriod();

  return `${prefix || "DOC"}-${period}-00001`;
}

export default function DokumenPage() {
  const [documents, setDocuments] =
    useState<DocumentConfig[]>(
      INITIAL_DOCUMENTS
    );

  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const filteredDocuments = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase();

    if (!keyword) {
      return documents;
    }

    return documents.filter(
      (document) =>
        document.name
          .toLowerCase()
          .includes(keyword) ||
        document.prefix
          .toLowerCase()
          .includes(keyword)
    );
  }, [documents, search]);

  function updatePrefix(
    id: string,
    value: string
  ) {
    const prefix = value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 10);

    setDocuments((current) =>
      current.map((document) =>
        document.id === id
          ? {
              ...document,
              prefix,
              example:
                createExample(prefix),
            }
          : document
      )
    );

    setSaved(false);
  }

  function resetDefaults() {
    setDocuments(
      INITIAL_DOCUMENTS.map(
        (document) => ({
          ...document,
          example: createExample(
            document.prefix
          ),
        })
      )
    );

    setSearch("");
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);

    /*
     * BELUM DIKIRIM KE DATABASE.
     *
     * Saat API konfigurasi nomor dokumen
     * sudah tersedia, bagian ini tinggal
     * dihubungkan ke endpoint tersebut.
     *
     * Untuk sekarang kita tidak mengubah
     * generator nomor transaksi existing.
     */

    await new Promise((resolve) =>
      setTimeout(resolve, 500)
    );

    setSaving(false);
    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 3000);
  }

  return (
    <main className="min-h-screen bg-[#f6f8f7] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <div className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Link
              href="/pengaturan"
              className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-slate-400 transition hover:text-[#497F70]"
            >
              <ArrowLeft size={14} />
              Pengaturan
            </Link>

            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[#18352D] text-[#b9d7cd] shadow-lg shadow-[#18352D]/15">
                <FileText size={27} />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#497F70]">
                  System Configuration
                </p>

                <h1 className="mt-1 text-3xl font-black tracking-tight text-[#18352D] sm:text-4xl">
                  Pengaturan Nomor Dokumen
                </h1>

                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  Atur prefix dan format penomoran
                  dokumen operasional MGB ERP.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetDefaults}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#dce7e2] bg-white px-4 text-sm font-bold text-[#18352D] shadow-sm transition hover:border-[#a9c6bd] hover:bg-[#f8faf9]"
            >
              <RotateCcw size={16} />
              Reset
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#18352D] px-5 text-sm font-bold text-white shadow-lg shadow-[#18352D]/15 transition hover:-translate-y-0.5 hover:bg-[#24493f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Simpan Pengaturan
                </>
              )}
            </button>
          </div>
        </div>

        {/* ================================================= */}
        {/* SUCCESS */}
        {/* ================================================= */}

        {saved && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            <CheckCircle2 size={18} />
            Pengaturan berhasil disimpan pada sesi
            ini.
          </div>
        )}

        {/* ================================================= */}
        {/* INFO */}
        {/* ================================================= */}

        <div className="mb-6 rounded-[24px] border border-[#dce7e2] bg-[#18352D] p-5 text-white shadow-[0_18px_50px_rgba(24,53,45,0.10)] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#b9d7cd]">
              <Hash size={21} />
            </div>

            <div className="flex-1">
              <p className="text-sm font-black">
                Format penomoran MGB ERP
              </p>

              <p className="mt-1 text-xs leading-5 text-white/60">
                Format preview menggunakan pola{" "}
                <span className="font-bold text-white/90">
                  PREFIX-YYYYMM-NOMOR
                </span>
                . Contoh akan mengikuti periode
                tahun dan bulan saat ini.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/40">
                Periode Aktif
              </p>

              <p className="mt-1 text-sm font-black text-[#b9d7cd]">
                {getCurrentPeriod()}
              </p>
            </div>
          </div>
        </div>

        {/* ================================================= */}
        {/* CONTENT */}
        {/* ================================================= */}

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* DOCUMENT TABLE */}

          <section className="overflow-hidden rounded-[28px] border border-[#dce7e2] bg-white shadow-[0_18px_60px_rgba(24,53,45,0.07)]">
            <div className="border-b border-[#edf1ef] p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-black text-[#18352D]">
                    Format Dokumen
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    Tentukan prefix untuk masing-masing
                    jenis dokumen.
                  </p>
                </div>

                <div className="relative w-full sm:w-[260px]">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Cari dokumen..."
                    className="h-10 w-full rounded-xl border border-[#dfe8e4] bg-[#f8faf9] pl-10 pr-3 text-xs font-medium text-[#18352D] outline-none transition focus:border-[#82a99e] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                  />
                </div>
              </div>
            </div>

            {/* DESKTOP TABLE */}

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-[#edf1ef] bg-[#fafcfb]">
                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                      Dokumen
                    </th>

                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                      Prefix
                    </th>

                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                      Contoh Nomor
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredDocuments.map(
                    (document) => (
                      <tr
                        key={document.id}
                        className="border-b border-[#f0f3f2] transition hover:bg-[#fbfdfc]"
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-xl ${document.color}`}
                            >
                              {document.icon}
                            </div>

                            <div>
                              <p className="text-sm font-black text-[#18352D]">
                                {document.name}
                              </p>

                              <p className="mt-1 text-[10px] text-slate-400">
                                {document.description}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400">
                              #
                            </span>

                            <input
                              value={
                                document.prefix
                              }
                              onChange={(
                                event
                              ) =>
                                updatePrefix(
                                  document.id,
                                  event.target
                                    .value
                                )
                              }
                              maxLength={10}
                              className="h-10 w-[110px] rounded-xl border border-[#dfe8e4] bg-[#f8faf9] px-3 text-sm font-black uppercase tracking-wider text-[#18352D] outline-none transition focus:border-[#82a99e] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                            />
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <div className="inline-flex items-center rounded-xl border border-[#e2ebe7] bg-[#f8faf9] px-4 py-2.5">
                            <span className="font-mono text-xs font-bold tracking-wide text-[#497F70]">
                              {
                                document.example
                              }
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS */}

            <div className="divide-y divide-[#edf1ef] md:hidden">
              {filteredDocuments.map(
                (document) => (
                  <div
                    key={document.id}
                    className="p-5"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${document.color}`}
                      >
                        {document.icon}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-[#18352D]">
                          {document.name}
                        </p>

                        <p className="mt-1 text-[10px] leading-5 text-slate-400">
                          {
                            document.description
                          }
                        </p>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div>
                            <p className="mb-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400">
                              Prefix
                            </p>

                            <input
                              value={
                                document.prefix
                              }
                              onChange={(
                                event
                              ) =>
                                updatePrefix(
                                  document.id,
                                  event.target
                                    .value
                                )
                              }
                              maxLength={10}
                              className="h-10 w-full rounded-xl border border-[#dfe8e4] bg-[#f8faf9] px-3 text-sm font-black uppercase text-[#18352D] outline-none focus:border-[#82a99e] focus:bg-white"
                            />
                          </div>

                          <div>
                            <p className="mb-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400">
                              Contoh
                            </p>

                            <div className="flex h-10 items-center overflow-hidden rounded-xl border border-[#e2ebe7] bg-[#f8faf9] px-3">
                              <span className="truncate font-mono text-[10px] font-bold text-[#497F70]">
                                {
                                  document.example
                                }
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            {filteredDocuments.length ===
              0 && (
              <div className="px-6 py-16 text-center">
                <Search
                  size={28}
                  className="mx-auto text-slate-300"
                />

                <p className="mt-3 text-sm font-black text-[#18352D]">
                  Dokumen tidak ditemukan
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Coba gunakan kata pencarian lain.
                </p>
              </div>
            )}

            <div className="border-t border-[#edf1ef] bg-[#fafcfb] px-5 py-4 sm:px-6">
              <div className="flex items-start gap-2">
                <Info
                  size={15}
                  className="mt-0.5 shrink-0 text-[#497F70]"
                />

                <p className="text-[10px] leading-5 text-slate-400">
                  Perubahan prefix di halaman ini
                  saat ini hanya merupakan konfigurasi
                  tampilan. Generator nomor dokumen
                  existing tidak diubah sampai
                  konfigurasi nomor dokumen di database
                  tersedia.
                </p>
              </div>
            </div>
          </section>

          {/* PREVIEW PANEL */}

          <aside className="space-y-5">
            <div className="overflow-hidden rounded-[28px] border border-[#dce7e2] bg-white shadow-[0_18px_60px_rgba(24,53,45,0.07)]">
              <div className="border-b border-[#edf1ef] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf5f2] text-[#497F70]">
                    <Hash size={19} />
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-[#18352D]">
                      Preview Format
                    </h3>

                    <p className="mt-0.5 text-[10px] text-slate-400">
                      Contoh nomor dokumen
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-5">
                {documents.map(
                  (document) => (
                    <div
                      key={document.id}
                      className="rounded-2xl border border-[#e5ece9] bg-[#f8faf9] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {document.name}
                        </span>

                        <span className="rounded-lg bg-white px-2 py-1 text-[9px] font-black text-[#497F70] shadow-sm">
                          {document.prefix ||
                            "DOC"}
                        </span>
                      </div>

                      <p className="mt-3 truncate font-mono text-xs font-bold text-[#18352D]">
                        {document.example}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-[#dce7e2] bg-[#18352D] p-6 text-white shadow-[0_18px_60px_rgba(24,53,45,0.12)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#b9d7cd]">
                <CheckCircle2 size={19} />
              </div>

              <h3 className="mt-5 text-sm font-black">
                Penomoran Konsisten
              </h3>

              <p className="mt-2 text-xs leading-6 text-white/55">
                Gunakan prefix yang singkat dan mudah
                dikenali agar dokumen lebih mudah
                dicari, dilacak, dan direferensikan
                oleh tim operasional.
              </p>

              <div className="mt-5 border-t border-white/10 pt-4">
                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/35">
                  Format
                </p>

                <p className="mt-2 font-mono text-xs font-bold text-[#b9d7cd]">
                  PREFIX - YYYYMM - 00001
                </p>
              </div>
            </div>
          </aside>
        </div>

        {/* ================================================= */}
        {/* FOOTER */}
        {/* ================================================= */}

        <div className="mt-6 flex flex-col gap-2 border-t border-[#dce7e2] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
            MGB ERP • Document Number Configuration
          </p>

          <p className="text-[10px] text-slate-400">
            PT. MITRA GARAM BOGATAMA
          </p>
        </div>
      </div>
    </main>
  );
}