"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  Mail,
  MapPin,
  Phone,
  Save,
  UserRound,
  Hash,
  RotateCcw,
  Loader2,
  AlertCircle,
} from "lucide-react";

type SupplierForm = {
  code: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  contactPerson: string;
  tempoDays: number;
};

const DEFAULT_FORM: SupplierForm = {
  code: "",
  name: "",
  address: "",
  city: "",
  phone: "",
  email: "",
  contactPerson: "",
  tempoDays: 30,
};

export default function EditSupplierPage() {
  const router = useRouter();
  const params = useParams();

  const id = String(params.id ?? "");

  const [form, setForm] =
    useState<SupplierForm>(DEFAULT_FORM);

  const [originalForm, setOriginalForm] =
    useState<SupplierForm>(DEFAULT_FORM);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  // =====================================================
  // HAS CHANGES
  // =====================================================

  const hasChanges = useMemo(() => {
    return (
      form.code !== originalForm.code ||
      form.name !== originalForm.name ||
      form.address !== originalForm.address ||
      form.city !== originalForm.city ||
      form.phone !== originalForm.phone ||
      form.email !== originalForm.email ||
      form.contactPerson !==
        originalForm.contactPerson ||
      form.tempoDays !== originalForm.tempoDays
    );
  }, [form, originalForm]);

  // =====================================================
  // LOAD SUPPLIER
  // =====================================================

  useEffect(() => {
    if (!id) return;

    loadSupplier();
  }, [id]);

  async function loadSupplier() {
    try {
      setLoading(true);
      setErrorMessage("");

      const res = await fetch(
        `/api/supplier/${id}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok) {
        const message =
          json.message ||
          "Gagal mengambil data supplier";

        setErrorMessage(message);
        return;
      }

      const data = json.data ?? json;

      const loadedForm: SupplierForm = {
        code: data.code ?? "",
        name: data.name ?? "",
        address: data.address ?? "",
        city: data.city ?? "",
        phone: data.phone ?? "",
        email: data.email ?? "",
        contactPerson:
          data.contactPerson ?? "",
        tempoDays:
          Number.isInteger(
            Number(data.tempoDays)
          )
            ? Number(data.tempoDays)
            : 30,
      };

      setForm(loadedForm);
      setOriginalForm(loadedForm);
    } catch (error) {
      console.error(
        "LOAD SUPPLIER ERROR:",
        error
      );

      setErrorMessage(
        "Gagal mengambil data supplier."
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // CHANGE FORM
  // =====================================================

  function change(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement
    >
  ) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,

      [name]:
        name === "tempoDays"
          ? value === ""
            ? 0
            : Number(value)
          : value,
    }));

    if (errorMessage) {
      setErrorMessage("");
    }
  }

  // =====================================================
  // RESET FORM
  // =====================================================

  function resetForm() {
    setForm(originalForm);
    setErrorMessage("");
  }

  // =====================================================
  // BACK
  // =====================================================

  function goBack() {
    if (
      hasChanges &&
      !window.confirm(
        "Ada perubahan yang belum disimpan. Yakin ingin meninggalkan halaman?"
      )
    ) {
      return;
    }

    router.push("/supplier");
  }

  // =====================================================
  // VALIDATION
  // =====================================================

  function validate(): boolean {
    if (!form.code.trim()) {
      setErrorMessage(
        "Kode supplier wajib diisi."
      );
      return false;
    }

    if (!form.name.trim()) {
      setErrorMessage(
        "Nama supplier wajib diisi."
      );
      return false;
    }

    if (
      !Number.isInteger(form.tempoDays) ||
      form.tempoDays < 0
    ) {
      setErrorMessage(
        "Tempo pembayaran harus berupa angka bulat 0 atau lebih."
      );
      return false;
    }

    if (
      form.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.email.trim()
      )
    ) {
      setErrorMessage(
        "Format email supplier tidak valid."
      );
      return false;
    }

    return true;
  }

  // =====================================================
  // SAVE
  // =====================================================

  async function save() {
    if (saving) return;

    if (!validate()) return;

    if (!hasChanges) {
      setErrorMessage(
        "Belum ada perubahan yang perlu disimpan."
      );
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");

      const payload = {
        id: Number(id),

        code: form.code.trim(),

        name: form.name.trim(),

        address:
          form.address.trim() || null,

        city:
          form.city.trim() || null,

        phone:
          form.phone.trim() || null,

        email:
          form.email.trim() || null,

        contactPerson:
          form.contactPerson.trim() ||
          null,

        tempoDays: form.tempoDays,
      };

      const res = await fetch(
        `/api/supplier/${id}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(payload),
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMessage(
          json.message ||
            "Supplier gagal diperbarui."
        );
        return;
      }

      const savedForm: SupplierForm = {
        ...form,
        code: form.code.trim(),
        name: form.name.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        contactPerson:
          form.contactPerson.trim(),
      };

      setForm(savedForm);
      setOriginalForm(savedForm);

      alert(
        "Supplier berhasil diperbarui."
      );

      router.push("/supplier");
      router.refresh();
    } catch (error) {
      console.error(
        "SAVE SUPPLIER ERROR:",
        error
      );

      setErrorMessage(
        "Terjadi kesalahan saat memperbarui supplier."
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7FAF9] p-6 md:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-6">
              <div className="h-6 w-48 animate-pulse rounded-lg bg-slate-100" />
              <div className="mt-3 h-4 w-80 animate-pulse rounded-lg bg-slate-100" />
            </div>

            <div className="space-y-6 p-6 md:p-8">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
              </div>

              <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <div className="min-h-screen bg-[#F7FAF9] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-4xl">

        {/* =================================================
            TOP HEADER
        ================================================= */}

        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">

            <button
              type="button"
              onClick={goBack}
              disabled={saving}
              className="
                flex h-11 w-11 shrink-0
                items-center justify-center
                rounded-2xl
                border border-slate-200
                bg-white
                text-slate-600
                shadow-sm
                transition
                hover:border-slate-300
                hover:bg-slate-50
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
              title="Kembali"
            >
              <ArrowLeft size={19} />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div
                  className="
                    flex h-9 w-9 shrink-0
                    items-center justify-center
                    rounded-xl
                    bg-[#E8F3EF]
                  "
                >
                  <Building2
                    size={19}
                    className="text-[#497F70]"
                  />
                </div>

                <h1 className="truncate text-xl font-semibold tracking-tight text-[#18352D] md:text-2xl">
                  Edit Supplier
                </h1>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Perbarui seluruh informasi dan
                ketentuan pembayaran supplier.
              </p>
            </div>
          </div>

          {/* STATUS */}
          <div className="hidden shrink-0 md:block">
            {hasChanges ? (
              <div
                className="
                  inline-flex items-center gap-2
                  rounded-full
                  border border-amber-200
                  bg-amber-50
                  px-3 py-1.5
                  text-xs font-medium
                  text-amber-700
                "
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Ada perubahan
              </div>
            ) : (
              <div
                className="
                  inline-flex items-center gap-2
                  rounded-full
                  border border-emerald-200
                  bg-emerald-50
                  px-3 py-1.5
                  text-xs font-medium
                  text-emerald-700
                "
              >
                <CheckCircle2 size={14} />
                Data tersimpan
              </div>
            )}
          </div>
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {errorMessage && (
          <div
            className="
              mb-5 flex items-start gap-3
              rounded-2xl
              border border-red-200
              bg-red-50
              px-4 py-3.5
              text-sm text-red-700
            "
          >
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <div className="flex-1">
              <p className="font-medium">
                Perhatian
              </p>

              <p className="mt-0.5 text-red-600">
                {errorMessage}
              </p>
            </div>
          </div>
        )}

        {/* =================================================
            FORM CARD
        ================================================= */}

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.05)]">

          {/* =================================================
              CARD HEADER
          ================================================= */}

          <div className="border-b border-slate-100 px-6 py-5 md:px-8">
            <div className="flex items-center gap-3">
              <div
                className="
                  flex h-10 w-10
                  items-center justify-center
                  rounded-xl
                  bg-[#EEF6F3]
                "
              >
                <Building2
                  size={20}
                  className="text-[#497F70]"
                />
              </div>

              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Informasi Supplier
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  Pastikan informasi supplier sudah
                  sesuai sebelum menyimpan.
                </p>
              </div>
            </div>
          </div>

          {/* =================================================
              FORM BODY
          ================================================= */}

          <div className="space-y-7 p-6 md:p-8">

            {/* =================================================
                IDENTITAS
            ================================================= */}

            <section>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-[#18352D]">
                  Identitas Supplier
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Informasi utama untuk identifikasi
                  supplier dalam sistem.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

                {/* KODE */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Kode Supplier
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <div className="relative">
                    <Hash
                      size={17}
                      className="
                        pointer-events-none
                        absolute left-3.5 top-1/2
                        -translate-y-1/2
                        text-slate-400
                      "
                    />

                    <input
                      name="code"
                      value={form.code}
                      onChange={change}
                      placeholder="Contoh: SUP-001"
                      autoComplete="off"
                      disabled={saving}
                      className="
                        w-full rounded-xl
                        border border-slate-200
                        bg-white
                        py-3 pl-10 pr-3
                        text-sm text-slate-900
                        outline-none
                        transition
                        placeholder:text-slate-400
                        hover:border-slate-300
                        focus:border-[#497F70]
                        focus:ring-4
                        focus:ring-[#497F70]/10
                        disabled:cursor-not-allowed
                        disabled:bg-slate-50
                      "
                    />
                  </div>
                </div>

                {/* NAMA */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Nama Supplier
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <div className="relative">
                    <Building2
                      size={17}
                      className="
                        pointer-events-none
                        absolute left-3.5 top-1/2
                        -translate-y-1/2
                        text-slate-400
                      "
                    />

                    <input
                      name="name"
                      value={form.name}
                      onChange={change}
                      placeholder="Nama lengkap supplier"
                      autoComplete="organization"
                      disabled={saving}
                      className="
                        w-full rounded-xl
                        border border-slate-200
                        bg-white
                        py-3 pl-10 pr-3
                        text-sm text-slate-900
                        outline-none
                        transition
                        placeholder:text-slate-400
                        hover:border-slate-300
                        focus:border-[#497F70]
                        focus:ring-4
                        focus:ring-[#497F70]/10
                        disabled:cursor-not-allowed
                        disabled:bg-slate-50
                      "
                    />
                  </div>
                </div>

              </div>
            </section>

            {/* =================================================
                CONTACT
            ================================================= */}

            <section>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-[#18352D]">
                  Kontak Supplier
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Informasi person in charge dan kontak
                  supplier.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

                {/* CONTACT PERSON */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Contact Person
                  </label>

                  <div className="relative">
                    <UserRound
                      size={17}
                      className="
                        pointer-events-none
                        absolute left-3.5 top-1/2
                        -translate-y-1/2
                        text-slate-400
                      "
                    />

                    <input
                      name="contactPerson"
                      value={
                        form.contactPerson
                      }
                      onChange={change}
                      placeholder="Nama contact person"
                      autoComplete="name"
                      disabled={saving}
                      className="
                        w-full rounded-xl
                        border border-slate-200
                        bg-white
                        py-3 pl-10 pr-3
                        text-sm text-slate-900
                        outline-none
                        transition
                        placeholder:text-slate-400
                        hover:border-slate-300
                        focus:border-[#497F70]
                        focus:ring-4
                        focus:ring-[#497F70]/10
                        disabled:cursor-not-allowed
                        disabled:bg-slate-50
                      "
                    />
                  </div>
                </div>

                {/* PHONE */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Telepon
                  </label>

                  <div className="relative">
                    <Phone
                      size={17}
                      className="
                        pointer-events-none
                        absolute left-3.5 top-1/2
                        -translate-y-1/2
                        text-slate-400
                      "
                    />

                    <input
                      name="phone"
                      value={form.phone}
                      onChange={change}
                      placeholder="Nomor telepon supplier"
                      autoComplete="tel"
                      inputMode="tel"
                      disabled={saving}
                      className="
                        w-full rounded-xl
                        border border-slate-200
                        bg-white
                        py-3 pl-10 pr-3
                        text-sm text-slate-900
                        outline-none
                        transition
                        placeholder:text-slate-400
                        hover:border-slate-300
                        focus:border-[#497F70]
                        focus:ring-4
                        focus:ring-[#497F70]/10
                        disabled:cursor-not-allowed
                        disabled:bg-slate-50
                      "
                    />
                  </div>
                </div>

                {/* EMAIL */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Email
                  </label>

                  <div className="relative">
                    <Mail
                      size={17}
                      className="
                        pointer-events-none
                        absolute left-3.5 top-1/2
                        -translate-y-1/2
                        text-slate-400
                      "
                    />

                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={change}
                      placeholder="email@supplier.com"
                      autoComplete="email"
                      disabled={saving}
                      className="
                        w-full rounded-xl
                        border border-slate-200
                        bg-white
                        py-3 pl-10 pr-3
                        text-sm text-slate-900
                        outline-none
                        transition
                        placeholder:text-slate-400
                        hover:border-slate-300
                        focus:border-[#497F70]
                        focus:ring-4
                        focus:ring-[#497F70]/10
                        disabled:cursor-not-allowed
                        disabled:bg-slate-50
                      "
                    />
                  </div>
                </div>

                {/* CITY */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Kota
                  </label>

                  <div className="relative">
                    <MapPin
                      size={17}
                      className="
                        pointer-events-none
                        absolute left-3.5 top-1/2
                        -translate-y-1/2
                        text-slate-400
                      "
                    />

                    <input
                      name="city"
                      value={form.city}
                      onChange={change}
                      placeholder="Kota supplier"
                      autoComplete="address-level2"
                      disabled={saving}
                      className="
                        w-full rounded-xl
                        border border-slate-200
                        bg-white
                        py-3 pl-10 pr-3
                        text-sm text-slate-900
                        outline-none
                        transition
                        placeholder:text-slate-400
                        hover:border-slate-300
                        focus:border-[#497F70]
                        focus:ring-4
                        focus:ring-[#497F70]/10
                        disabled:cursor-not-allowed
                        disabled:bg-slate-50
                      "
                    />
                  </div>
                </div>

              </div>
            </section>

            {/* =================================================
                ADDRESS
            ================================================= */}

            <section>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-[#18352D]">
                  Alamat
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Alamat lengkap lokasi supplier.
                </p>
              </div>

              <div className="relative">
                <MapPin
                  size={17}
                  className="
                    pointer-events-none
                    absolute left-3.5 top-3.5
                    text-slate-400
                  "
                />

                <textarea
                  name="address"
                  value={form.address}
                  onChange={change}
                  placeholder="Alamat lengkap supplier..."
                  rows={4}
                  disabled={saving}
                  className="
                    w-full resize-none rounded-xl
                    border border-slate-200
                    bg-white
                    py-3 pl-10 pr-3
                    text-sm text-slate-900
                    outline-none
                    transition
                    placeholder:text-slate-400
                    hover:border-slate-300
                    focus:border-[#497F70]
                    focus:ring-4
                    focus:ring-[#497F70]/10
                    disabled:cursor-not-allowed
                    disabled:bg-slate-50
                  "
                />
              </div>
            </section>

            {/* =================================================
                PAYMENT TERMS
            ================================================= */}

            <section>
              <div
                className="
                  overflow-hidden rounded-2xl
                  border border-[#D7E9E2]
                  bg-gradient-to-br
                  from-[#F0F8F5]
                  to-[#F8FBFA]
                "
              >
                <div className="p-5 md:p-6">

                  <div className="flex items-start gap-4">

                    <div
                      className="
                        flex h-11 w-11 shrink-0
                        items-center justify-center
                        rounded-xl
                        bg-white
                        shadow-sm
                      "
                    >
                      <Clock3
                        size={20}
                        className="text-[#497F70]"
                      />
                    </div>

                    <div className="min-w-0 flex-1">

                      <h3 className="text-sm font-semibold text-[#18352D]">
                        Ketentuan Pembayaran
                      </h3>

                      <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                        Tentukan jumlah hari tempo pembayaran
                        supplier. Perhitungan jatuh tempo
                        dilakukan berdasarkan tanggal
                        barang diterima (receipt).
                      </p>

                      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">

                        <div>
                          <label className="mb-2 block text-xs font-medium text-slate-600">
                            Tempo Pembayaran
                          </label>

                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              name="tempoDays"
                              value={
                                form.tempoDays
                              }
                              onChange={change}
                              disabled={saving}
                              className="
                                w-32 rounded-xl
                                border border-slate-200
                                bg-white
                                px-3 py-3
                                text-sm font-semibold
                                text-slate-900
                                outline-none
                                transition
                                focus:border-[#497F70]
                                focus:ring-4
                                focus:ring-[#497F70]/10
                                disabled:cursor-not-allowed
                                disabled:bg-slate-50
                              "
                            />

                            <span className="pb-3 text-sm text-slate-600">
                              hari
                            </span>
                          </div>
                        </div>

                      </div>

                      <div
                        className="
                          mt-4 rounded-xl
                          border border-white
                          bg-white/80
                          px-4 py-3
                        "
                      >
                        <p className="text-xs leading-5 text-slate-600">
                          {form.tempoDays === 0 ? (
                            <>
                              <span className="font-semibold text-[#18352D]">
                                COD / Hari Ini
                              </span>
                              {" — "}
                              Pembayaran jatuh tempo
                              pada hari penerimaan barang.
                            </>
                          ) : (
                            <>
                              <span className="font-semibold text-[#18352D]">
                                Tempo {form.tempoDays} hari
                              </span>
                              {" — "}
                              Jatuh tempo dihitung
                              {` ${form.tempoDays} hari `}
                              setelah barang diterima.
                            </>
                          )}
                        </p>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            </section>

          </div>

          {/* =================================================
              FOOTER ACTION
          ================================================= */}

          <div
            className="
              flex flex-col-reverse
              gap-3
              border-t border-slate-100
              bg-slate-50/70
              px-6 py-4
              sm:flex-row
              sm:items-center
              sm:justify-between
              md:px-8
            "
          >

            <div className="flex items-center gap-2 text-xs text-slate-500">
              {hasChanges ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Perubahan belum disimpan
                </>
              ) : (
                <>
                  <CheckCircle2
                    size={14}
                    className="text-emerald-500"
                  />
                  Tidak ada perubahan
                </>
              )}
            </div>

            <div className="flex w-full gap-3 sm:w-auto">

              {/* RESET */}
              <button
                type="button"
                onClick={resetForm}
                disabled={
                  saving || !hasChanges
                }
                className="
                  inline-flex flex-1
                  items-center justify-center
                  gap-2
                  rounded-xl
                  border border-slate-200
                  bg-white
                  px-4 py-2.5
                  text-sm font-medium
                  text-slate-600
                  shadow-sm
                  transition
                  hover:bg-slate-50
                  disabled:cursor-not-allowed
                  disabled:opacity-40
                  sm:flex-none
                "
              >
                <RotateCcw size={16} />
                Reset
              </button>

              {/* CANCEL */}
              <button
                type="button"
                onClick={goBack}
                disabled={saving}
                className="
                  hidden
                  rounded-xl
                  border border-slate-200
                  bg-white
                  px-4 py-2.5
                  text-sm font-medium
                  text-slate-600
                  transition
                  hover:bg-slate-50
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                  sm:block
                "
              >
                Batal
              </button>

              {/* SAVE */}
              <button
                type="button"
                onClick={save}
                disabled={
                  saving || !hasChanges
                }
                className="
                  inline-flex flex-1
                  items-center justify-center
                  gap-2
                  rounded-xl
                  bg-[#497F70]
                  px-5 py-2.5
                  text-sm font-semibold
                  text-white
                  shadow-sm
                  transition
                  hover:bg-[#3F6F62]
                  hover:shadow-md
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                  sm:flex-none
                "
              >
                {saving ? (
                  <>
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save size={17} />
                    Simpan Perubahan
                  </>
                )}
              </button>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}