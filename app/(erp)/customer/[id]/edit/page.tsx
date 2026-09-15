"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Hash,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Save,
  UserRound,
  UserRoundPen,
  Users,
} from "lucide-react";

type CustomerForm = {
  code: string;
  name: string;
  city: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
};

const DEFAULT_FORM: CustomerForm = {
  code: "",
  name: "",
  city: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
};

export default function EditCustomerPage() {
  const router = useRouter();
  const params = useParams();

  const id = params.id;

  const [form, setForm] =
    useState<CustomerForm>(DEFAULT_FORM);

  const [originalForm, setOriginalForm] =
    useState<CustomerForm>(DEFAULT_FORM);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  const hasChanges = useMemo(() => {
    return (
      JSON.stringify(form) !==
      JSON.stringify(originalForm)
    );
  }, [form, originalForm]);

  useEffect(() => {
    loadCustomer();
  }, [id]);

  async function loadCustomer() {
    try {
      setLoading(true);
      setErrorMessage("");

      const res = await fetch(
        `/api/customer/${id}`,
        {
          cache: "no-store",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.message ||
            "Gagal mengambil data customer"
        );
      }

      /*
       * Mendukung:
       * { success: true, data: {...} }
       *
       * maupun:
       * {...}
       */
      const customer =
        data?.data ?? data;

      if (!customer) {
        throw new Error(
          "Data customer tidak ditemukan"
        );
      }

      const loadedForm: CustomerForm = {
        code: customer.code ?? "",
        name: customer.name ?? "",
        city: customer.city ?? "",
        contactPerson:
          customer.contactPerson ?? "",
        phone: customer.phone ?? "",
        email: customer.email ?? "",
        address: customer.address ?? "",
      };

      setForm(loadedForm);
      setOriginalForm(loadedForm);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal mengambil data customer"
      );
    } finally {
      setLoading(false);
    }
  }

  function change(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement
    >
  ) {
    const { name, value } = e.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    if (errorMessage) {
      setErrorMessage("");
    }
  }

  function resetForm() {
    if (!hasChanges) return;

    const ok = confirm(
      "Kembalikan seluruh perubahan ke data awal?"
    );

    if (!ok) return;

    setForm(originalForm);
    setErrorMessage("");
  }

  function goBack() {
    if (hasChanges) {
      const ok = confirm(
        "Ada perubahan yang belum disimpan.\n\nYakin ingin meninggalkan halaman ini?"
      );

      if (!ok) return;
    }

    router.push("/customer");
  }

  async function save() {
    const code = form.code.trim();
    const name = form.name.trim();
    const city = form.city.trim();
    const contactPerson =
      form.contactPerson.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();
    const address = form.address.trim();

    if (!code) {
      setErrorMessage(
        "Kode customer wajib diisi."
      );
      return;
    }

    if (!name) {
      setErrorMessage(
        "Nama customer wajib diisi."
      );
      return;
    }

    if (email) {
      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(email)) {
        setErrorMessage(
          "Format email customer tidak valid."
        );
        return;
      }
    }

    try {
      setSaving(true);
      setErrorMessage("");

      /*
       * Tetap menggunakan PUT sesuai API
       * customer yang digunakan sebelumnya.
       */
      const payload = {
        code,
        name,
        city: city || null,
        contactPerson:
          contactPerson || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
      };

      const res = await fetch(
        `/api/customer/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.message ||
            "Customer gagal diperbarui"
        );
      }

      setOriginalForm({
        code,
        name,
        city,
        contactPerson,
        phone,
        email,
        address,
      });

      alert(
        data.message ||
          "Customer berhasil diperbarui"
      );

      router.push("/customer");
      router.refresh();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal memperbarui customer"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6FAF8] p-4 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-[#E4EEE9]" />

          <div className="rounded-2xl border border-[#D9E7E0] bg-white p-6 shadow-sm">
            <div className="space-y-5">
              <div className="h-16 animate-pulse rounded-xl bg-[#F1F6F3]" />
              <div className="grid gap-5 md:grid-cols-2">
                <div className="h-20 animate-pulse rounded-xl bg-[#F1F6F3]" />
                <div className="h-20 animate-pulse rounded-xl bg-[#F1F6F3]" />
                <div className="h-20 animate-pulse rounded-xl bg-[#F1F6F3]" />
                <div className="h-20 animate-pulse rounded-xl bg-[#F1F6F3]" />
              </div>
              <div className="h-24 animate-pulse rounded-xl bg-[#F1F6F3]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6FAF8] p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        {/* =====================================================
            TOP HEADER
        ====================================================== */}
        <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={goBack}
              className="
                flex h-11 w-11 shrink-0 items-center justify-center
                rounded-xl
                border border-[#D8E5DF]
                bg-white
                text-[#53675E]
                shadow-sm
                transition
                hover:border-[#BFD2C9]
                hover:bg-[#F5F9F7]
              "
              title="Kembali"
            >
              <ArrowLeft size={19} />
            </button>

            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#497F70]">
                  Master Data
                </span>

                <span className="text-[#A0B0A9]">
                  /
                </span>

                <span className="text-[11px] font-medium text-[#8A9B93]">
                  Customer
                </span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-[#203D32] md:text-3xl">
                Edit Customer
              </h1>

              <p className="mt-1 text-sm text-[#71827A]">
                Perbarui seluruh informasi customer.
              </p>
            </div>
          </div>

          {hasChanges && (
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#FFF8E7] px-3 py-2 text-xs font-semibold text-[#927B3D]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C7A94B]" />
              Ada perubahan belum disimpan
            </div>
          )}
        </div>

        {/* =====================================================
            ERROR
        ====================================================== */}
        {errorMessage && (
          <div
            className="
              mb-6 flex items-start gap-3
              rounded-2xl
              border border-[#E7C9C4]
              bg-[#FFF6F4]
              p-4
            "
          >
            <AlertCircle
              size={19}
              className="mt-0.5 shrink-0 text-[#A45447]"
            />

            <div>
              <p className="text-sm font-semibold text-[#8D463C]">
                Tidak dapat memproses data
              </p>

              <p className="mt-0.5 text-xs text-[#A7655C]">
                {errorMessage}
              </p>
            </div>
          </div>
        )}

        {/* =====================================================
            FORM CARD
        ====================================================== */}
        <div
          className="
            overflow-hidden
            rounded-2xl
            border border-[#D7E5DE]
            bg-white
            shadow-[0_8px_30px_rgba(31,61,50,0.05)]
          "
        >
          {/* CARD HEADER */}
          <div className="border-b border-[#E5EEE9] bg-[#FBFDFC] px-5 py-5 md:px-7">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E8F3EC]">
                <UserRoundPen
                  size={21}
                  className="text-[#497F70]"
                />
              </div>

              <div>
                <h2 className="text-sm font-bold text-[#29483A]">
                  Informasi Customer
                </h2>

                <p className="mt-0.5 text-xs text-[#81918A]">
                  Lengkapi data customer sesuai informasi terbaru.
                </p>
              </div>
            </div>
          </div>

          {/* FORM */}
          <div className="p-5 md:p-7">
            <div className="grid gap-6 md:grid-cols-2">
              {/* KODE */}
              <div>
                <label
                  htmlFor="code"
                  className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#5C7168]"
                >
                  <Hash size={14} />
                  Kode Customer
                  <span className="text-[#A45447]">
                    *
                  </span>
                </label>

                <input
                  id="code"
                  name="code"
                  value={form.code}
                  onChange={change}
                  placeholder="Contoh: CUST-001"
                  className="
                    h-12 w-full rounded-xl
                    border border-[#D8E5DF]
                    bg-white
                    px-4
                    text-sm font-medium text-[#29483A]
                    outline-none
                    transition
                    placeholder:text-[#A6B2AC]
                    focus:border-[#497F70]
                    focus:ring-4
                    focus:ring-[#497F70]/10
                  "
                />
              </div>

              {/* NAMA */}
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#5C7168]"
                >
                  <UserRound size={14} />
                  Nama Customer
                  <span className="text-[#A45447]">
                    *
                  </span>
                </label>

                <input
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={change}
                  placeholder="Nama perusahaan / customer"
                  className="
                    h-12 w-full rounded-xl
                    border border-[#D8E5DF]
                    bg-white
                    px-4
                    text-sm font-medium text-[#29483A]
                    outline-none
                    transition
                    placeholder:text-[#A6B2AC]
                    focus:border-[#497F70]
                    focus:ring-4
                    focus:ring-[#497F70]/10
                  "
                />
              </div>

              {/* KOTA */}
              <div>
                <label
                  htmlFor="city"
                  className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#5C7168]"
                >
                  <MapPin size={14} />
                  Kota
                </label>

                <input
                  id="city"
                  name="city"
                  value={form.city}
                  onChange={change}
                  placeholder="Contoh: Jakarta"
                  className="
                    h-12 w-full rounded-xl
                    border border-[#D8E5DF]
                    bg-white
                    px-4
                    text-sm text-[#29483A]
                    outline-none
                    transition
                    placeholder:text-[#A6B2AC]
                    focus:border-[#497F70]
                    focus:ring-4
                    focus:ring-[#497F70]/10
                  "
                />
              </div>

              {/* CONTACT PERSON */}
              <div>
                <label
                  htmlFor="contactPerson"
                  className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#5C7168]"
                >
                  <Users size={14} />
                  Contact Person
                </label>

                <input
                  id="contactPerson"
                  name="contactPerson"
                  value={form.contactPerson}
                  onChange={change}
                  placeholder="Nama PIC customer"
                  className="
                    h-12 w-full rounded-xl
                    border border-[#D8E5DF]
                    bg-white
                    px-4
                    text-sm text-[#29483A]
                    outline-none
                    transition
                    placeholder:text-[#A6B2AC]
                    focus:border-[#497F70]
                    focus:ring-4
                    focus:ring-[#497F70]/10
                  "
                />
              </div>

              {/* PHONE */}
              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#5C7168]"
                >
                  <Phone size={14} />
                  Telepon
                </label>

                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={change}
                  placeholder="Contoh: 08123456789"
                  className="
                    h-12 w-full rounded-xl
                    border border-[#D8E5DF]
                    bg-white
                    px-4
                    text-sm text-[#29483A]
                    outline-none
                    transition
                    placeholder:text-[#A6B2AC]
                    focus:border-[#497F70]
                    focus:ring-4
                    focus:ring-[#497F70]/10
                  "
                />
              </div>

              {/* EMAIL */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#5C7168]"
                >
                  <Mail size={14} />
                  Email
                </label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={change}
                  placeholder="customer@email.com"
                  className="
                    h-12 w-full rounded-xl
                    border border-[#D8E5DF]
                    bg-white
                    px-4
                    text-sm text-[#29483A]
                    outline-none
                    transition
                    placeholder:text-[#A6B2AC]
                    focus:border-[#497F70]
                    focus:ring-4
                    focus:ring-[#497F70]/10
                  "
                />
              </div>

              {/* ADDRESS */}
              <div className="md:col-span-2">
                <label
                  htmlFor="address"
                  className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#5C7168]"
                >
                  <MapPin size={14} />
                  Alamat
                </label>

                <textarea
                  id="address"
                  name="address"
                  value={form.address}
                  onChange={change}
                  rows={4}
                  placeholder="Alamat lengkap customer"
                  className="
                    w-full resize-none rounded-xl
                    border border-[#D8E5DF]
                    bg-white
                    px-4 py-3
                    text-sm leading-6 text-[#29483A]
                    outline-none
                    transition
                    placeholder:text-[#A6B2AC]
                    focus:border-[#497F70]
                    focus:ring-4
                    focus:ring-[#497F70]/10
                  "
                />
              </div>
            </div>
          </div>

          {/* =====================================================
              FOOTER ACTION
          ====================================================== */}
          <div
            className="
              flex flex-col-reverse gap-3
              border-t border-[#E5EEE9]
              bg-[#FBFDFC]
              p-5
              sm:flex-row
              sm:items-center
              sm:justify-between
              md:px-7
            "
          >
            <div className="flex gap-2">
              <button
                type="button"
                onClick={goBack}
                disabled={saving}
                className="
                  inline-flex items-center justify-center gap-2
                  rounded-xl
                  border border-[#D8E5DF]
                  bg-white
                  px-4 py-2.5
                  text-sm font-semibold text-[#53675E]
                  transition
                  hover:bg-[#F4F8F6]
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                <ArrowLeft size={16} />
                Batal
              </button>

              <button
                type="button"
                onClick={resetForm}
                disabled={!hasChanges || saving}
                className="
                  inline-flex items-center justify-center gap-2
                  rounded-xl
                  border border-[#D8E5DF]
                  bg-white
                  px-4 py-2.5
                  text-sm font-semibold text-[#53675E]
                  transition
                  hover:bg-[#F4F8F6]
                  disabled:cursor-not-allowed
                  disabled:opacity-40
                "
              >
                <RotateCcw size={15} />
                Reset
              </button>
            </div>

            <button
              type="button"
              onClick={save}
              disabled={
                saving ||
                !hasChanges ||
                !form.code.trim() ||
                !form.name.trim()
              }
              className="
                inline-flex items-center justify-center gap-2
                rounded-xl
                bg-[#497F70]
                px-5 py-2.5
                text-sm font-semibold text-white
                shadow-[0_7px_18px_rgba(73,127,112,0.18)]
                transition-all
                hover:-translate-y-0.5
                hover:bg-[#3E6E61]
                disabled:cursor-not-allowed
                disabled:opacity-50
                disabled:hover:translate-y-0
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

        {/* INFO */}
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#DDE9E3] bg-[#F4F9F6] p-4">
          <CheckCircle2
            size={18}
            className="mt-0.5 shrink-0 text-[#497F70]"
          />

          <div>
            <p className="text-xs font-semibold text-[#4C655A]">
              Informasi perubahan
            </p>

            <p className="mt-1 text-xs leading-5 text-[#81918A]">
              Pastikan kode dan nama customer sudah benar sebelum menyimpan perubahan.
              Field lainnya dapat dikosongkan apabila belum tersedia.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}