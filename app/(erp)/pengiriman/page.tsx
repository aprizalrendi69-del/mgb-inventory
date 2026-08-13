"use client";

import { useEffect, useState } from "react";
import {
  PackageCheck,
  RefreshCw,
  Truck,
  Users,
  Boxes,
  Pencil,
  Trash2,
  Send,
  Search,
} from "lucide-react";

export default function PengirimanPage() {
  const [delivery, setDelivery] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch("/api/delivery-order", {
        cache: "no-store",
      });

      const json = await res.json();

      setDelivery(
        Array.isArray(json.data) ? json.data : []
      );
    } catch (error) {
      console.error("LOAD DELIVERY ORDER ERROR:", error);
      setDelivery([]);
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // RELEASE
  // =====================================================

  async function approve(id: number) {
    const target = delivery.find(
      (item) => item.id === id
    );

    if (!target) return;

    const confirmRelease = confirm(
      `Release Delivery Order ${target.number}?\n\n` +
        `Setelah di-release:\n` +
        `- Stock akan berkurang\n` +
        `- Batch akan diproses FEFO\n` +
        `- Inventory akan diperbarui\n` +
        `- Stock Card akan dibuat\n` +
        `- Stock Mutation akan dibuat\n\n` +
        `Delivery Order yang sudah RELEASED tidak dapat diedit atau dihapus.`
    );

    if (!confirmRelease) return;

    try {
      setLoading(true);

      const res = await fetch(
        `/api/delivery-order/${id}/approve`,
        {
          method: "PUT",
        }
      );

      const json = await res.json();

      if (json.success) {
        alert(
          json.message ||
            "Delivery Order berhasil di-release"
        );

        await loadData();
      } else {
        alert(
          json.message ||
            "Gagal release Delivery Order"
        );
      }
    } catch (error) {
      console.error(
        "APPROVE DELIVERY ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat release Delivery Order"
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // EDIT
  // =====================================================

  function editDelivery(id: number) {
    window.location.href = `/barang-keluar/${id}`;
  }

  // =====================================================
  // DELETE
  // =====================================================

  async function deleteDelivery(id: number) {
    const target = delivery.find(
      (item) => item.id === id
    );

    if (!target) return;

    if (target.status !== "DRAFT") {
      alert(
        "Delivery Order yang sudah RELEASED tidak dapat dihapus."
      );
      return;
    }

    const confirmed = confirm(
      `Hapus Delivery Order ${target.number}?\n\n` +
        `Data draft dan detail barang akan dihapus.`
    );

    if (!confirmed) return;

    try {
      setLoading(true);

      const res = await fetch(
        `/api/delivery-order/${id}`,
        {
          method: "DELETE",
        }
      );

      const json = await res.json();

      if (json.success) {
        alert(
          json.message ||
            "Delivery Order berhasil dihapus"
        );

        await loadData();
      } else {
        alert(
          json.message ||
            "Gagal menghapus Delivery Order"
        );
      }
    } catch (error) {
      console.error(
        "DELETE DELIVERY ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat menghapus Delivery Order"
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // FORMAT
  // =====================================================

  function formatDate(value: any) {
    if (!value) return "-";

    return new Date(value).toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  }

  // =====================================================
  // STATUS BADGE
  // =====================================================

  function StatusBadge({
    status,
  }: {
    status: string;
  }) {
    const isReleased = status === "RELEASED";
    const isDraft = status === "DRAFT";

    return (
      <span
        className={`
          inline-flex
          items-center
          gap-1.5
          rounded-full
          px-3
          py-1
          text-xs
          font-semibold
          ${
            isReleased
              ? "bg-[#E8F5EE] text-[#2F7A58]"
              : isDraft
              ? "bg-amber-50 text-amber-700"
              : "bg-slate-100 text-slate-600"
          }
        `}
      >
        <span
          className={`
            h-1.5
            w-1.5
            rounded-full
            ${
              isReleased
                ? "bg-[#497F70]"
                : isDraft
                ? "bg-amber-500"
                : "bg-slate-400"
            }
          `}
        />

        {status || "UNKNOWN"}
      </span>
    );
  }

  // =====================================================
  // FILTER
  // =====================================================

  const filteredDelivery = delivery.filter(
    (item) => {
      const keyword =
        search.trim().toLowerCase();

      const matchesSearch =
        !keyword ||
        String(item.number || "")
          .toLowerCase()
          .includes(keyword) ||
        String(
          item.customer?.name || ""
        )
          .toLowerCase()
          .includes(keyword) ||
        String(
          item.customer?.code || ""
        )
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        !statusFilter ||
        item.status === statusFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    }
  );

  // =====================================================
  // SUMMARY
  // =====================================================

  const totalDelivery = delivery.length;

  const totalDraft = delivery.filter(
    (item) => item.status === "DRAFT"
  ).length;

  const totalReleased = delivery.filter(
    (item) => item.status === "RELEASED"
  ).length;

  const totalQty = delivery.reduce(
    (total, item) =>
      total + Number(item.totalQty || 0),
    0
  );

  return (
    <div
      className="
        min-h-screen
        bg-[#F8FBF9]
        p-6
        md:p-8
      "
    >
      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <div
        className="
          mb-7
          flex
          flex-col
          gap-4
          md:flex-row
          md:items-center
          md:justify-between
        "
      >
        <div className="flex items-center gap-3">
          <div
            className="
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-xl
              bg-[#EAF3EF]
              text-[#497F70]
              shadow-sm
            "
          >
            <Truck size={23} />
          </div>

          <div>
            <h1
              className="
                text-2xl
                font-bold
                tracking-tight
                text-[#18352D]
                md:text-3xl
              "
            >
              Delivery Order
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Kelola pengiriman barang kepada customer
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="
            inline-flex
            items-center
            justify-center
            gap-2
            rounded-xl
            border
            border-[#DDE9E4]
            bg-white
            px-4
            py-2.5
            text-sm
            font-semibold
            text-[#35564C]
            shadow-sm
            transition
            hover:bg-[#F5F8F6]
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          <RefreshCw
            size={17}
            className={
              loading
                ? "animate-spin"
                : ""
            }
          />

          Refresh
        </button>
      </div>

      {/* ================================================= */}
      {/* SUMMARY */}
      {/* ================================================= */}

      <div
        className="
          mb-6
          grid
          grid-cols-1
          gap-4
          sm:grid-cols-2
          lg:grid-cols-4
        "
      >
        {/* TOTAL */}

        <div
          className="
            rounded-2xl
            border
            border-[#DDE9E4]
            bg-white
            p-5
            shadow-sm
          "
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Total Delivery
              </p>

              <p className="mt-1 text-2xl font-bold text-[#18352D]">
                {totalDelivery}
              </p>
            </div>

            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-xl
                bg-[#EAF3EF]
                text-[#497F70]
              "
            >
              <Truck size={21} />
            </div>
          </div>
        </div>

        {/* DRAFT */}

        <div
          className="
            rounded-2xl
            border
            border-[#DDE9E4]
            bg-white
            p-5
            shadow-sm
          "
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Draft
              </p>

              <p className="mt-1 text-2xl font-bold text-amber-600">
                {totalDraft}
              </p>
            </div>

            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-xl
                bg-amber-50
                text-amber-600
              "
            >
              <PackageCheck size={21} />
            </div>
          </div>
        </div>

        {/* RELEASED */}

        <div
          className="
            rounded-2xl
            border
            border-[#DDE9E4]
            bg-white
            p-5
            shadow-sm
          "
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Released
              </p>

              <p className="mt-1 text-2xl font-bold text-[#497F70]">
                {totalReleased}
              </p>
            </div>

            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-xl
                bg-[#EAF3EF]
                text-[#497F70]
              "
            >
              <PackageCheck size={21} />
            </div>
          </div>
        </div>

        {/* QTY */}

        <div
          className="
            rounded-2xl
            border
            border-[#DDE9E4]
            bg-white
            p-5
            shadow-sm
          "
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Total Qty
              </p>

              <p className="mt-1 text-2xl font-bold text-[#18352D]">
                {totalQty.toLocaleString(
                  "id-ID"
                )}
              </p>
            </div>

            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-xl
                bg-slate-100
                text-slate-500
              "
            >
              <Boxes size={21} />
            </div>
          </div>
        </div>
      </div>

      {/* ================================================= */}
      {/* TABLE CARD */}
      {/* ================================================= */}

      <div
        className="
          overflow-hidden
          rounded-2xl
          border
          border-[#DDE9E4]
          bg-white
          shadow-sm
        "
      >
        {/* HEADER */}

        <div
          className="
            border-b
            border-[#E5ECE9]
            px-5
            py-4
            md:px-6
          "
        >
          <div
            className="
              flex
              flex-col
              gap-4
              lg:flex-row
              lg:items-center
              lg:justify-between
            "
          >
            <div className="flex items-center gap-3">
              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  bg-[#EAF3EF]
                  text-[#497F70]
                "
              >
                <Truck size={19} />
              </div>

              <div>
                <h2 className="font-semibold text-[#18352D]">
                  Daftar Delivery Order
                </h2>

                <p className="mt-0.5 text-xs text-gray-500">
                  Draft dapat diedit, dihapus, atau di-release
                </p>
              </div>
            </div>

            <div
              className="
                rounded-full
                bg-[#EAF3EF]
                px-3
                py-1
                text-xs
                font-semibold
                text-[#497F70]
              "
            >
              {filteredDelivery.length} Data
            </div>
          </div>
        </div>

        {/* FILTER */}

        <div
          className="
            border-b
            border-[#E5ECE9]
            bg-[#FAFCFB]
            px-5
            py-4
            md:px-6
          "
        >
          <div
            className="
              flex
              flex-col
              gap-3
              md:flex-row
            "
          >
            {/* SEARCH */}

            <div className="relative flex-1">
              <Search
                size={18}
                className="
                  absolute
                  left-3
                  top-1/2
                  -translate-y-1/2
                  text-gray-400
                "
              />

              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Cari nomor DO atau customer..."
                className="
                  w-full
                  rounded-xl
                  border
                  border-[#DDE9E4]
                  bg-white
                  py-2.5
                  pl-10
                  pr-4
                  text-sm
                  text-gray-700
                  outline-none
                  transition
                  placeholder:text-gray-400
                  focus:border-[#497F70]
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
              />
            </div>

            {/* STATUS */}

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
              className="
                rounded-xl
                border
                border-[#DDE9E4]
                bg-white
                px-4
                py-2.5
                text-sm
                text-gray-700
                outline-none
                focus:border-[#497F70]
                focus:ring-2
                focus:ring-[#497F70]/10
              "
            >
              <option value="">
                Semua Status
              </option>

              <option value="DRAFT">
                Draft
              </option>

              <option value="RELEASED">
                Released
              </option>
            </select>
          </div>
        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="border-b border-[#E5ECE9] bg-[#F5F8F6]">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Nomor
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Tanggal
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Customer
                </th>

                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Qty
                </th>

                <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>

                <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Aksi
                </th>
              </tr>
            </thead>

            <tbody>
              {/* LOADING */}

              {loading &&
                delivery.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center"
                    >
                      <RefreshCw
                        size={25}
                        className="mx-auto animate-spin text-[#497F70]"
                      />

                      <p className="mt-3 text-sm text-gray-500">
                        Memuat Delivery Order...
                      </p>
                    </td>
                  </tr>
                )}

              {/* EMPTY */}

              {!loading &&
                filteredDelivery.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center"
                    >
                      <div className="mx-auto flex max-w-md flex-col items-center">
                        <div
                          className="
                            flex
                            h-14
                            w-14
                            items-center
                            justify-center
                            rounded-2xl
                            bg-[#EAF3EF]
                            text-[#497F70]
                          "
                        >
                          <Truck size={27} />
                        </div>

                        <h3 className="mt-4 font-semibold text-[#35564C]">
                          Tidak ada Delivery Order
                        </h3>

                        <p className="mt-1 text-sm text-gray-400">
                          Data yang sesuai pencarian akan muncul di sini.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}

              {/* DATA */}

              {!loading &&
                filteredDelivery.map(
                  (d: any) => (
                    <tr
                      key={d.id}
                      className="
                        border-b
                        border-[#EEF3F0]
                        transition
                        hover:bg-[#FAFCFB]
                      "
                    >
                      {/* NOMOR */}

                      <td className="px-5 py-4">
                        <div className="font-semibold text-[#35564C]">
                          {d.number || "-"}
                        </div>
                      </td>

                      {/* DATE */}

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {formatDate(
                          d.deliveryDate
                        )}
                      </td>

                      {/* CUSTOMER */}

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="
                              flex
                              h-9
                              w-9
                              items-center
                              justify-center
                              rounded-lg
                              bg-[#EAF3EF]
                              text-[#497F70]
                            "
                          >
                            <Users size={17} />
                          </div>

                          <div>
                            <div className="font-medium text-gray-700">
                              {d.customer?.name ||
                                "-"}
                            </div>

                            {d.customer?.code && (
                              <div className="mt-0.5 text-xs text-gray-400">
                                {d.customer.code}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* QTY */}

                      <td className="px-5 py-4 text-right">
                        <span className="font-semibold text-gray-700">
                          {Number(
                            d.totalQty || 0
                          ).toLocaleString(
                            "id-ID"
                          )}
                        </span>
                      </td>

                      {/* STATUS */}

                      <td className="px-5 py-4 text-center">
                        <StatusBadge
                          status={
                            d.status
                          }
                        />
                      </td>

                      {/* ACTION */}

                      <td className="px-5 py-4">
                        {d.status ===
                        "DRAFT" ? (
                          <div className="flex items-center justify-center gap-2">
                            {/* EDIT */}

                            <button
                              type="button"
                              disabled={loading}
                              onClick={() =>
                                editDelivery(
                                  d.id
                                )
                              }
                              title="Edit Draft"
                              className="
                                inline-flex
                                h-9
                                w-9
                                items-center
                                justify-center
                                rounded-lg
                                border
                                border-[#DDE9E4]
                                bg-white
                                text-[#497F70]
                                shadow-sm
                                transition
                                hover:border-[#497F70]
                                hover:bg-[#EAF3EF]
                                disabled:cursor-not-allowed
                                disabled:opacity-50
                              "
                            >
                              <Pencil size={16} />
                            </button>

                            {/* DELETE */}

                            <button
                              type="button"
                              disabled={loading}
                              onClick={() =>
                                deleteDelivery(
                                  d.id
                                )
                              }
                              title="Hapus Draft"
                              className="
                                inline-flex
                                h-9
                                w-9
                                items-center
                                justify-center
                                rounded-lg
                                border
                                border-red-100
                                bg-red-50
                                text-red-500
                                shadow-sm
                                transition
                                hover:bg-red-100
                                hover:text-red-600
                                disabled:cursor-not-allowed
                                disabled:opacity-50
                              "
                            >
                              <Trash2 size={16} />
                            </button>

                            {/* RELEASE */}

                            <button
                              type="button"
                              disabled={loading}
                              onClick={() =>
                                approve(
                                  d.id
                                )
                              }
                              title="Release Delivery Order"
                              className="
                                inline-flex
                                h-9
                                items-center
                                justify-center
                                gap-1.5
                                rounded-lg
                                bg-[#497F70]
                                px-3
                                text-xs
                                font-semibold
                                text-white
                                shadow-sm
                                transition
                                hover:bg-[#3D6D60]
                                disabled:cursor-not-allowed
                                disabled:opacity-50
                              "
                            >
                              <Send size={14} />

                              Release
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <span
                              className="
                                inline-flex
                                items-center
                                gap-1.5
                                rounded-lg
                                bg-[#EAF3EF]
                                px-3
                                py-2
                                text-xs
                                font-medium
                                text-[#497F70]
                              "
                            >
                              <PackageCheck size={14} />

                              Sudah Released
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                )}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}

        <div
          className="
            flex
            flex-col
            justify-between
            gap-2
            border-t
            border-[#E5ECE9]
            bg-[#F5F8F6]
            px-5
            py-4
            text-sm
            md:flex-row
            md:items-center
            md:px-6
          "
        >
          <div className="text-gray-500">
            Menampilkan{" "}
            <span className="font-semibold text-[#18352D]">
              {filteredDelivery.length}
            </span>{" "}
            dari{" "}
            <span className="font-semibold text-[#18352D]">
              {delivery.length}
            </span>{" "}
            Delivery Order
          </div>

          <div className="flex items-center gap-2 font-medium text-[#35564C]">
            <Truck
              size={15}
              className="text-[#497F70]"
            />

            Pengiriman
          </div>
        </div>
      </div>
    </div>
  );
}