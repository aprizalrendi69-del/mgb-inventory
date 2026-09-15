"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe2,
  FileText,
  UserRound,
  Image as ImageIcon,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  PencilLine,
} from "lucide-react";

type CompanyData = {
  id?: number;
  name?: string;
  logo?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  npwp?: string;
  director?: string;
  footer?: string;
};

export default function CompanyPage() {
  const [data, setData] = useState<CompanyData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/company", {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setData(json.data ?? {});
      } else {
        setError(json.message || "Gagal mengambil data perusahaan.");
      }
    } catch (err) {
      console.error(err);
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateField(
    field: keyof CompanyData,
    value: string
  ) {
    setData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function save() {
    try {
      setSaving(true);
      setMessage("");
      setError("");

      const res = await fetch("/api/company", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (json.success) {
        setMessage("Profil perusahaan berhasil disimpan.");

        if (json.data) {
          setData(json.data);
        }

        setTimeout(() => {
          setMessage("");
        }, 4000);
      } else {
        setError(json.message || "Gagal menyimpan data.");
      }
    } catch (err) {
      console.error(err);
      setError("Tidak dapat menyimpan data ke server.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f8f7] p-5 md:p-8 lg:p-10">
        <div className="mx-auto max-w-[1500px]">

          <div className="flex min-h-[500px] items-center justify-center rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#18352D]">
                <Loader2
                  size={25}
                  className="animate-spin text-white"
                />
              </div>

              <div className="text-center">
                <p className="text-sm font-black text-[#18352D]">
                  Memuat Profil Perusahaan
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Mohon tunggu sebentar...
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f8f7]">

      {/* =====================================================
          BACKGROUND DECORATION
      ====================================================== */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-[420px] w-[420px] rounded-full bg-[#497F70]/5 blur-3xl" />
        <div className="absolute -left-40 top-[50%] h-[360px] w-[360px] rounded-full bg-[#18352D]/5 blur-3xl" />
      </div>

      <div className="relative p-5 md:p-8 lg:p-10">
        <div className="mx-auto max-w-[1500px]">

          {/* =====================================================
              HEADER
          ====================================================== */}
          <div className="mb-8 overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_18px_55px_rgba(24,53,45,0.08)]">

            <div className="relative">

              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#18352D] via-[#497F70] to-[#8db7a9]" />

              <div className="flex flex-col gap-5 p-6 md:p-8 lg:flex-row lg:items-center lg:justify-between">

                <div className="flex items-start gap-4">

                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#18352D] shadow-lg shadow-[#18352D]/20">
                    <Building2
                      size={27}
                      strokeWidth={1.8}
                      className="text-white"
                    />
                  </div>

                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#497F70]">
                        Company Configuration
                      </span>

                      <span className="h-1 w-1 rounded-full bg-[#497F70]" />

                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        MGB ERP
                      </span>
                    </div>

                    <h1 className="text-2xl font-black tracking-tight text-[#18352D] md:text-3xl">
                      Profil Perusahaan
                    </h1>

                    <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
                      Kelola informasi identitas perusahaan yang digunakan
                      pada dokumen, laporan, invoice, dan kebutuhan cetak ERP.
                    </p>
                  </div>

                </div>

                <div className="flex w-fit items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm">
                    <CheckCircle2
                      size={19}
                      className="text-[#497F70]"
                      strokeWidth={2}
                    />
                  </div>

                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">
                      Company Profile
                    </p>

                    <p className="mt-0.5 text-xs font-bold text-[#18352D]">
                      Konfigurasi Aktif
                    </p>
                  </div>

                </div>

              </div>
            </div>
          </div>

          {/* =====================================================
              ALERT
          ====================================================== */}
          {message && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-800 shadow-sm">
              <CheckCircle2
                size={19}
                className="shrink-0"
              />

              <span className="font-semibold">
                {message}
              </span>
            </div>
          )}

          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700 shadow-sm">
              <AlertCircle
                size={19}
                className="shrink-0"
              />

              <span className="font-semibold">
                {error}
              </span>
            </div>
          )}

          {/* =====================================================
              MAIN CONTENT
          ====================================================== */}
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">

            {/* ===================================================
                LOGO CARD
            ==================================================== */}
            <div className="h-fit overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(24,53,45,0.045)]">

              <div className="border-b border-slate-100 px-6 py-5">
                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#497F70]/10 text-[#497F70]">
                    <ImageIcon
                      size={19}
                      strokeWidth={1.8}
                    />
                  </div>

                  <div>
                    <h2 className="text-sm font-black text-[#18352D]">
                      Logo Perusahaan
                    </h2>

                    <p className="mt-0.5 text-[10px] text-slate-400">
                      Identitas visual perusahaan
                    </p>
                  </div>

                </div>
              </div>

              <div className="p-6">

                {/* LOGO PREVIEW */}
                <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[22px] border border-slate-200 bg-gradient-to-br from-slate-50 to-white">

                  <div className="absolute inset-4 rounded-[18px] border border-dashed border-slate-200" />

                  <img
                    src={data.logo || "/no-image.png"}
                    alt="Logo perusahaan"
                    className="relative z-10 max-h-[70%] max-w-[78%] object-contain"
                    onError={(e) => {
                      e.currentTarget.src = "/no-image.png";
                    }}
                  />

                  <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-white/80 bg-white/90 px-3 py-2 text-center shadow-sm backdrop-blur-sm">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      Logo Preview
                    </p>
                  </div>

                </div>

                {/* LOGO PATH */}
                <div className="mt-5">

                  <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Path Logo
                  </label>

                  <div className="relative">
                    <ImageIcon
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
                    />

                    <input
                      type="text"
                      placeholder="/uploads/logo.png"
                      value={data.logo ?? ""}
                      onChange={(e) =>
                        updateField("logo", e.target.value)
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-xs font-medium text-slate-700 outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                    />
                  </div>

                  <p className="mt-2 text-[10px] leading-5 text-slate-400">
                    Upload logo ke folder{" "}
                    <span className="font-bold text-slate-500">
                      public/uploads
                    </span>
                    , kemudian masukkan path seperti:
                    <span className="ml-1 font-bold text-[#497F70]">
                      /uploads/logo.png
                    </span>
                  </p>

                </div>

              </div>
            </div>

            {/* ===================================================
                COMPANY INFORMATION
            ==================================================== */}
            <div className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(24,53,45,0.045)]">

              {/* CARD HEADER */}
              <div className="border-b border-slate-100 px-6 py-5 md:px-7">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#497F70]/10 text-[#497F70]">
                    <PencilLine
                      size={19}
                      strokeWidth={1.8}
                    />
                  </div>

                  <div>
                    <h2 className="text-sm font-black text-[#18352D]">
                      Informasi Perusahaan
                    </h2>

                    <p className="mt-0.5 text-[10px] text-slate-400">
                      Informasi resmi perusahaan
                    </p>
                  </div>

                </div>

              </div>

              <div className="space-y-7 p-6 md:p-7">

                {/* ===============================================
                    IDENTITAS
                ================================================ */}
                <section>

                  <div className="mb-4 flex items-center gap-2">
                    <Building2
                      size={15}
                      className="text-[#497F70]"
                    />

                    <h3 className="text-[11px] font-black uppercase tracking-widest text-[#18352D]">
                      Identitas
                    </h3>

                    <div className="h-px flex-1 bg-slate-100" />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">

                    <FormField
                      label="Nama Perusahaan"
                      value={data.name}
                      placeholder="PT. Mitra Garam Bogatama"
                      onChange={(value) =>
                        updateField("name", value)
                      }
                      icon={<Building2 size={15} />}
                    />

                    <FormField
                      label="NPWP"
                      value={data.npwp}
                      placeholder="00.000.000.0-000.000"
                      onChange={(value) =>
                        updateField("npwp", value)
                      }
                      icon={<FileText size={15} />}
                    />

                    <FormField
                      label="Direktur"
                      value={data.director}
                      placeholder="Nama Direktur"
                      onChange={(value) =>
                        updateField("director", value)
                      }
                      icon={<UserRound size={15} />}
                    />

                  </div>

                </section>

                {/* ===============================================
                    ALAMAT
                ================================================ */}
                <section>

                  <div className="mb-4 flex items-center gap-2">
                    <MapPin
                      size={15}
                      className="text-[#497F70]"
                    />

                    <h3 className="text-[11px] font-black uppercase tracking-widest text-[#18352D]">
                      Alamat Perusahaan
                    </h3>

                    <div className="h-px flex-1 bg-slate-100" />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">

                    <div className="md:col-span-2">
                      <FormField
                        label="Alamat"
                        value={data.address}
                        placeholder="Alamat lengkap perusahaan"
                        onChange={(value) =>
                          updateField("address", value)
                        }
                        icon={<MapPin size={15} />}
                      />
                    </div>

                    <FormField
                      label="Kota"
                      value={data.city}
                      placeholder="Kota"
                      onChange={(value) =>
                        updateField("city", value)
                      }
                    />

                    <FormField
                      label="Provinsi"
                      value={data.province}
                      placeholder="Provinsi"
                      onChange={(value) =>
                        updateField("province", value)
                      }
                    />

                    <FormField
                      label="Kode Pos"
                      value={data.postalCode}
                      placeholder="00000"
                      onChange={(value) =>
                        updateField("postalCode", value)
                      }
                    />

                  </div>

                </section>

                {/* ===============================================
                    KONTAK
                ================================================ */}
                <section>

                  <div className="mb-4 flex items-center gap-2">
                    <Phone
                      size={15}
                      className="text-[#497F70]"
                    />

                    <h3 className="text-[11px] font-black uppercase tracking-widest text-[#18352D]">
                      Kontak
                    </h3>

                    <div className="h-px flex-1 bg-slate-100" />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">

                    <FormField
                      label="Telepon"
                      value={data.phone}
                      placeholder="08xxxxxxxxxx"
                      onChange={(value) =>
                        updateField("phone", value)
                      }
                      icon={<Phone size={15} />}
                    />

                    <FormField
                      label="Email"
                      value={data.email}
                      placeholder="email@perusahaan.com"
                      onChange={(value) =>
                        updateField("email", value)
                      }
                      icon={<Mail size={15} />}
                    />

                    <FormField
                      label="Website"
                      value={data.website}
                      placeholder="https://website.com"
                      onChange={(value) =>
                        updateField("website", value)
                      }
                      icon={<Globe2 size={15} />}
                    />

                  </div>

                </section>

                {/* ===============================================
                    PRINT
                ================================================ */}
                <section>

                  <div className="mb-4 flex items-center gap-2">
                    <FileText
                      size={15}
                      className="text-[#497F70]"
                    />

                    <h3 className="text-[11px] font-black uppercase tracking-widest text-[#18352D]">
                      Dokumen & Print
                    </h3>

                    <div className="h-px flex-1 bg-slate-100" />
                  </div>

                  <div>

                    <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Footer Print
                    </label>

                    <textarea
                      rows={4}
                      placeholder="Footer yang akan digunakan pada dokumen cetak..."
                      value={data.footer ?? ""}
                      onChange={(e) =>
                        updateField("footer", e.target.value)
                      }
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium leading-5 text-slate-700 outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                    />

                    <p className="mt-2 text-[10px] text-slate-400">
                      Footer ini dapat digunakan sebagai informasi
                      tambahan pada dokumen yang dicetak oleh sistem.
                    </p>

                  </div>

                </section>

              </div>

              {/* ===============================================
                  ACTION FOOTER
              ================================================ */}
              <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between md:px-7">

                <div className="text-[10px] leading-5 text-slate-400">
                  Pastikan informasi perusahaan sudah benar sebelum
                  menyimpan perubahan.
                </div>

                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#18352D] px-6 text-xs font-black text-white shadow-lg shadow-[#18352D]/15 transition-all hover:-translate-y-0.5 hover:bg-[#497F70] hover:shadow-[#497F70]/20 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {saving ? (
                    <>
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save
                        size={16}
                        strokeWidth={2}
                        className="transition-transform group-hover:scale-110"
                      />
                      Simpan Perubahan
                    </>
                  )}
                </button>

              </div>

            </div>

          </div>

          {/* =====================================================
              FOOTER
          ====================================================== */}
          <div className="mt-6 flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white/70 px-5 py-4 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-2">
              <Building2
                size={14}
                className="text-[#497F70]"
              />

              <span className="text-[10px] font-bold text-slate-500">
                PT. Mitra Garam Bogatama
              </span>
            </div>

            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Company Configuration • MGB Inventory
            </span>

          </div>

        </div>
      </div>
    </div>
  );
}

/* ============================================================
   FORM FIELD COMPONENT
============================================================ */

function FormField({
  label,
  value,
  placeholder,
  onChange,
  icon,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  onChange: (value: string) => void;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">
        {label}
      </label>

      <div className="relative">

        {icon && (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300">
            {icon}
          </div>
        )}

        <input
          type="text"
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pr-3 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10 ${
            icon ? "pl-10" : "pl-3"
          }`}
        />

      </div>
    </div>
  );
}