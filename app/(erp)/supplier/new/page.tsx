"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Clock3,
  Save,
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

export default function NewSupplier() {
  const router = useRouter();

  const [form, setForm] =
    useState<SupplierForm>({
      code: "",
      name: "",
      address: "",
      city: "",
      phone: "",
      email: "",
      contactPerson: "",
      tempoDays: 30,
    });

  const [saving, setSaving] =
    useState(false);

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
  }

  // =====================================================
  // SIMPAN
  // =====================================================

  async function simpan() {
    if (!form.code.trim()) {
      alert("Kode supplier wajib diisi");
      return;
    }

    if (!form.name.trim()) {
      alert("Nama supplier wajib diisi");
      return;
    }

    if (
      !Number.isInteger(
        form.tempoDays
      ) ||
      form.tempoDays < 0
    ) {
      alert(
        "Tempo pembayaran harus berupa angka bulat 0 atau lebih"
      );
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(
        "/api/supplier",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            code: form.code.trim(),
            name: form.name.trim(),

            address:
              form.address.trim() ||
              null,

            city:
              form.city.trim() ||
              null,

            phone:
              form.phone.trim() ||
              null,

            email:
              form.email.trim() ||
              null,

            contactPerson:
              form.contactPerson.trim() ||
              null,

            tempoDays:
              form.tempoDays,
          }),
        }
      );

      const json =
        await res.json();

      if (!res.ok || !json.success) {
        alert(
          json.message ||
            "Supplier gagal disimpan"
        );
        return;
      }

      alert(
        "Supplier berhasil ditambahkan"
      );

      router.push("/supplier");
      router.refresh();
    } catch (error) {
      console.error(
        "CREATE SUPPLIER ERROR:",
        error
      );

      alert(
        "Gagal menambahkan supplier"
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <div className="min-h-screen bg-[#F8FBF9] p-6 md:p-8">
      <div className="max-w-3xl mx-auto">

        {/* HEADER */}
        <div className="flex items-center gap-4 mb-6">

          <button
            type="button"
            onClick={() =>
              router.push("/supplier")
            }
            className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50"
          >
            <ArrowLeft
              size={19}
              className="text-gray-600"
            />
          </button>

          <div>
            <div className="flex items-center gap-2">

              <Building2
                size={22}
                className="text-blue-600"
              />

              <h1 className="text-2xl font-bold text-gray-900">
                Supplier Baru
              </h1>

            </div>

            <p className="text-sm text-gray-500 mt-1">
              Tambahkan supplier baru ke master
              supplier.
            </p>
          </div>

        </div>

        {/* FORM */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">

          <div className="p-6 space-y-5">

            {/* KODE + NAMA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kode Supplier
                </label>

                <input
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                  name="code"
                  value={form.code}
                  onChange={change}
                  placeholder="Contoh: SUP-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nama Supplier
                </label>

                <input
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                  name="name"
                  value={form.name}
                  onChange={change}
                  placeholder="Nama Supplier"
                />
              </div>

            </div>

            {/* PIC + TELEPON */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Person / PIC
                </label>

                <input
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                  name="contactPerson"
                  value={
                    form.contactPerson
                  }
                  onChange={change}
                  placeholder="Nama PIC"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telepon
                </label>

                <input
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                  name="phone"
                  value={form.phone}
                  onChange={change}
                  placeholder="Nomor Telepon"
                />
              </div>

            </div>

            {/* EMAIL + KOTA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>

                <input
                  type="email"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                  name="email"
                  value={form.email}
                  onChange={change}
                  placeholder="Email Supplier"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kota
                </label>

                <input
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                  name="city"
                  value={form.city}
                  onChange={change}
                  placeholder="Kota"
                />
              </div>

            </div>

            {/* ALAMAT */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alamat
              </label>

              <textarea
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-y"
                name="address"
                value={form.address}
                onChange={change}
                placeholder="Alamat Supplier"
              />
            </div>

            {/* TEMPO */}
            <div className="border border-blue-100 bg-blue-50 rounded-xl p-4">

              <div className="flex items-start gap-3">

                <Clock3
                  size={20}
                  className="text-blue-600 mt-0.5"
                />

                <div className="flex-1">

                  <label className="block text-sm font-semibold text-gray-800 mb-1">
                    Tempo Pembayaran
                  </label>

                  <p className="text-xs text-gray-500 mb-3">
                    Jatuh tempo dihitung sejak
                    tanggal barang diterima
                    (receipt), bukan dari tanggal
                    PO.
                  </p>

                  <div className="flex items-center gap-3">

                    <input
                      type="number"
                      min={0}
                      step={1}
                      name="tempoDays"
                      value={form.tempoDays}
                      onChange={change}
                      className="w-32 border border-gray-300 rounded-xl px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <span className="text-sm text-gray-600">
                      hari
                    </span>

                  </div>

                  <div className="mt-3 text-xs text-gray-500">

                    {form.tempoDays === 0
                      ? "0 hari = COD / jatuh tempo pada hari penerimaan."
                      : `Jatuh tempo ${form.tempoDays} hari setelah barang diterima.`}

                  </div>

                </div>

              </div>

            </div>

          </div>

          {/* FOOTER */}
          <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">

            <button
              type="button"
              onClick={() =>
                router.push("/supplier")
              }
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={simpan}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={18} />

              {saving
                ? "Menyimpan..."
                : "Simpan Supplier"}
            </button>

          </div>

        </div>
      </div>
    </div>
  );
}