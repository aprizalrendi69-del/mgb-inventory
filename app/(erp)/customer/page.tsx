"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  UserRoundPlus,
  Search,
  RefreshCw,
  MapPin,
  Phone,
  Mail,
  UserRound,
  Hash,
  Loader2,
  ChevronRight,
  Database,
  AlertCircle,
} from "lucide-react";

type Customer = {
  id: number;
  code?: string | null;
  name?: string | null;
  city?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
};

export default function CustomerPage() {
  const [customer, setCustomer] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const res = await fetch("/api/customer", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || "Gagal mengambil data customer"
        );
      }

      setCustomer(Array.isArray(json.data) ? json.data : []);
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Gagal mengambil data customer"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  async function hapusCustomer(id: number) {
    const selected = customer.find((item) => item.id === id);

    const ok = confirm(
      `Yakin ingin menghapus customer${
        selected?.name ? ` "${selected.name}"` : ""
      }?\n\nData yang sudah dihapus tidak dapat ditampilkan kembali melalui halaman ini.`
    );

    if (!ok) return;

    try {
      setDeletingId(id);

      const res = await fetch(`/api/customer/${id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || "Gagal menghapus customer"
        );
      }

      await load(true);

      alert(json.message || "Customer berhasil dihapus");
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Gagal menghapus customer"
      );
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  const filteredCustomer = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return customer;

    return customer.filter((c) => {
      return [
        c.code,
        c.name,
        c.city,
        c.contactPerson,
        c.phone,
        c.email,
      ].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(keyword)
      );
    });
  }, [customer, search]);

  return (
    <div className="min-h-screen bg-[#F6FAF8] p-4 md:p-6 lg:p-8">
      {/* =====================================================
          HEADER
      ====================================================== */}
      <div className="mb-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div
              className="
                flex h-14 w-14 shrink-0 items-center justify-center
                rounded-2xl
                bg-[#E7F2ED]
                shadow-sm
              "
            >
              <Users
                size={27}
                strokeWidth={2}
                className="text-[#497F70]"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#497F70]">
                  Master Data
                </span>

                <ChevronRight
                  size={13}
                  className="text-[#A0B4AA]"
                />

                <span className="text-[11px] font-medium text-[#8A9B93]">
                  Customer
                </span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-[#203D32] md:text-3xl">
                Master Customer
              </h1>

              <p className="mt-1 text-sm text-[#71827A]">
                Kelola informasi customer perusahaan secara terpusat.
              </p>
            </div>
          </div>

          <Link
            href="/customer/new"
            className="
              group inline-flex items-center justify-center gap-2
              rounded-xl
              bg-[#497F70]
              px-5 py-3
              text-sm font-semibold text-white
              shadow-[0_8px_20px_rgba(73,127,112,0.18)]
              transition-all
              hover:-translate-y-0.5
              hover:bg-[#3E6E61]
              hover:shadow-[0_10px_24px_rgba(73,127,112,0.25)]
            "
          >
            <Plus
              size={18}
              strokeWidth={2.4}
            />

            Tambah Customer
          </Link>
        </div>
      </div>

      {/* =====================================================
          SUMMARY CARDS
      ====================================================== */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div
          className="
            rounded-2xl border border-[#D9E7E0]
            bg-white
            p-5
            shadow-[0_4px_20px_rgba(31,61,50,0.04)]
          "
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#81918A]">
                Total Customer
              </p>

              <p className="mt-2 text-2xl font-bold text-[#29483A]">
                {customer.length}
              </p>

              <p className="mt-1 text-xs text-[#8A9B93]">
                Data customer terdaftar
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E8F3EC]">
              <Users
                size={21}
                className="text-[#497F70]"
              />
            </div>
          </div>
        </div>

        <div
          className="
            rounded-2xl border border-[#D9E7E0]
            bg-white
            p-5
            shadow-[0_4px_20px_rgba(31,61,50,0.04)]
          "
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#81918A]">
                Ditampilkan
              </p>

              <p className="mt-2 text-2xl font-bold text-[#29483A]">
                {filteredCustomer.length}
              </p>

              <p className="mt-1 text-xs text-[#8A9B93]">
                Hasil pencarian saat ini
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F0F4F2]">
              <Database
                size={20}
                className="text-[#667B72]"
              />
            </div>
          </div>
        </div>

        <div
          className="
            hidden rounded-2xl border border-[#D9E7E0]
            bg-white p-5
            shadow-[0_4px_20px_rgba(31,61,50,0.04)]
            xl:block
          "
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#81918A]">
                Status Data
              </p>

              <p className="mt-2 text-lg font-bold text-[#29483A]">
                Master Aktif
              </p>

              <p className="mt-1 text-xs text-[#8A9B93]">
                Database customer siap digunakan
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E8F3EC]">
              <UserRoundPlus
                size={20}
                className="text-[#497F70]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          MAIN CARD
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
        {/* Toolbar */}
        <div
          className="
            border-b border-[#E5EEE9]
            bg-[#FBFDFC]
            p-4 md:p-5
          "
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F3EC]">
                <UserRoundPlus
                  size={19}
                  className="text-[#497F70]"
                />
              </div>

              <div>
                <h2 className="text-sm font-bold text-[#29483A]">
                  Data Customer
                </h2>

                <p className="text-xs text-[#81918A]">
                  {filteredCustomer.length} data ditampilkan
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {/* Search */}
              <div className="relative min-w-0 sm:w-[320px]">
                <Search
                  size={17}
                  className="
                    absolute left-3 top-1/2
                    -translate-y-1/2
                    text-[#91A39A]
                  "
                />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari customer..."
                  className="
                    h-10 w-full rounded-xl
                    border border-[#D8E5DF]
                    bg-white
                    pl-10 pr-4
                    text-sm text-[#29483A]
                    outline-none
                    transition
                    placeholder:text-[#A2B0AA]
                    focus:border-[#497F70]
                    focus:ring-4
                    focus:ring-[#497F70]/10
                  "
                />
              </div>

              {/* Refresh */}
              <button
                type="button"
                onClick={() => load(true)}
                disabled={refreshing}
                title="Refresh data"
                className="
                  inline-flex h-10 items-center justify-center gap-2
                  rounded-xl
                  border border-[#D8E5DF]
                  bg-white
                  px-4
                  text-sm font-semibold text-[#50655C]
                  transition
                  hover:border-[#B9D0C6]
                  hover:bg-[#F4F8F6]
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >
                <RefreshCw
                  size={16}
                  className={refreshing ? "animate-spin" : ""}
                />

                <span className="hidden sm:inline">
                  Refresh
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* =====================================================
            TABLE
        ====================================================== */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] border-collapse">
            <thead>
              <tr className="border-b border-[#DDEAE3] bg-[#EEF6F1]">
                <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#5D7469]">
                  Kode
                </th>

                <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#5D7469]">
                  Customer
                </th>

                <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#5D7469]">
                  Kota
                </th>

                <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#5D7469]">
                  Contact Person
                </th>

                <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#5D7469]">
                  Telepon
                </th>

                <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#5D7469]">
                  Email
                </th>

                <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-[#5D7469]">
                  Aksi
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-16"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <Loader2
                        size={28}
                        className="animate-spin text-[#497F70]"
                      />

                      <p className="mt-3 text-sm font-medium text-[#667B72]">
                        Memuat data customer...
                      </p>

                      <p className="mt-1 text-xs text-[#97A69F]">
                        Mohon tunggu sebentar
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredCustomer.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-16"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0F5F2]">
                        {search ? (
                          <Search
                            size={24}
                            className="text-[#7E9389]"
                          />
                        ) : (
                          <Users
                            size={24}
                            className="text-[#7E9389]"
                          />
                        )}
                      </div>

                      <p className="mt-4 text-sm font-semibold text-[#4E625A]">
                        {search
                          ? "Customer tidak ditemukan"
                          : "Belum ada data customer"}
                      </p>

                      <p className="mt-1 text-xs text-[#91A19A]">
                        {search
                          ? "Coba gunakan kata kunci pencarian lain."
                          : "Tambahkan customer baru untuk memulai."}
                      </p>

                      {!search && (
                        <Link
                          href="/customer/new"
                          className="
                            mt-4 inline-flex items-center gap-2
                            rounded-xl bg-[#497F70]
                            px-4 py-2.5
                            text-xs font-semibold text-white
                            transition hover:bg-[#3E6E61]
                          "
                        >
                          <Plus size={15} />
                          Tambah Customer
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomer.map((c) => (
                  <tr
                    key={c.id}
                    className="
                      group
                      border-b border-[#EDF2EF]
                      transition-colors
                      hover:bg-[#F8FBF9]
                    "
                  >
                    {/* KODE */}
                    <td className="px-5 py-4">
                      <div className="inline-flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F1F6F3]">
                          <Hash
                            size={14}
                            className="text-[#6D8379]"
                          />
                        </div>

                        <span className="text-sm font-semibold text-[#41574E]">
                          {c.code || "-"}
                        </span>
                      </div>
                    </td>

                    {/* NAMA */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E8F3EC]">
                          <UserRound
                            size={17}
                            className="text-[#497F70]"
                          />
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-[#29483A]">
                            {c.name || "-"}
                          </p>

                          <p className="mt-0.5 text-[11px] text-[#95A49E]">
                            Customer
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* KOTA */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <MapPin
                          size={15}
                          className="text-[#799188]"
                        />

                        <span className="text-sm text-[#53675E]">
                          {c.city || "-"}
                        </span>
                      </div>
                    </td>

                    {/* CONTACT */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <UserRound
                          size={15}
                          className="text-[#799188]"
                        />

                        <span className="text-sm text-[#53675E]">
                          {c.contactPerson || "-"}
                        </span>
                      </div>
                    </td>

                    {/* TELEPON */}
                    <td className="px-5 py-4">
                      {c.phone ? (
                        <div className="flex items-center gap-2">
                          <Phone
                            size={15}
                            className="text-[#799188]"
                          />

                          <span className="text-sm text-[#53675E]">
                            {c.phone}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-[#A0ADA7]">
                          -
                        </span>
                      )}
                    </td>

                    {/* EMAIL */}
                    <td className="px-5 py-4">
                      {c.email ? (
                        <div className="flex max-w-[230px] items-center gap-2">
                          <Mail
                            size={15}
                            className="shrink-0 text-[#799188]"
                          />

                          <span className="truncate text-sm text-[#53675E]">
                            {c.email}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-[#A0ADA7]">
                          -
                        </span>
                      )}
                    </td>

                    {/* AKSI */}
                    <td className="px-5 py-4">
                      <div className="flex justify-center gap-2">
                        <Link
                          href={`/customer/${c.id}/edit`}
                          className="
                            inline-flex items-center gap-1.5
                            rounded-xl
                            border border-[#E5DDBF]
                            bg-[#FBF8EC]
                            px-3 py-2
                            text-xs font-semibold text-[#8B743A]
                            transition
                            hover:border-[#D9CCA5]
                            hover:bg-[#F5F0DE]
                          "
                        >
                          <Pencil size={14} />
                          Edit
                        </Link>

                        <button
                          type="button"
                          onClick={() =>
                            hapusCustomer(c.id)
                          }
                          disabled={deletingId === c.id}
                          className="
                            inline-flex items-center gap-1.5
                            rounded-xl
                            border border-[#E9D1CC]
                            bg-[#FCF2F0]
                            px-3 py-2
                            text-xs font-semibold text-[#A45447]
                            transition
                            hover:border-[#DFBEB8]
                            hover:bg-[#F8E7E3]
                            disabled:cursor-not-allowed
                            disabled:opacity-50
                          "
                        >
                          {deletingId === c.id ? (
                            <Loader2
                              size={14}
                              className="animate-spin"
                            />
                          ) : (
                            <Trash2 size={14} />
                          )}

                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        {!loading && customer.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-[#E5EEE9] bg-[#FBFDFC] px-5 py-4 text-xs text-[#81918A] sm:flex-row sm:items-center sm:justify-between">
            <span>
              Menampilkan{" "}
              <span className="font-semibold text-[#53675E]">
                {filteredCustomer.length}
              </span>{" "}
              dari{" "}
              <span className="font-semibold text-[#53675E]">
                {customer.length}
              </span>{" "}
              customer
            </span>

            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#497F70]" />
              Data tersinkron dengan database
            </span>
          </div>
        )}
      </div>
    </div>
  );
}