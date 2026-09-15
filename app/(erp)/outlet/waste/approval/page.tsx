"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";

type Waste = {
  id: number;
  number: string;
  trxDate: string;
  outletId: number;
  outlet?: {
    id: number;
    code: string;
    name: string;
  } | null;
  barangId: number;
  barang?: {
    id: number;
    code: string;
    name: string;
    category: string | null;
    unit: string | null;
  } | null;
  type: string;
  status: string;
  qtyProcessed: number;
  wasteQty: number;
  netQty: number;
  unitCost: number;
  totalCost: number;
  note: string | null;
  user?: {
    id: number;
    username: string;
    fullname: string | null;
  } | null;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function WasteApprovalPage() {
  const [data, setData] = useState<Waste[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/outlet/waste?month=all&status=PENDING",
        {
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Gagal mengambil data Waste."
        );
      }

      const pending = Array.isArray(result.data)
        ? result.data.filter(
            (item: Waste) => item.status === "PENDING"
          )
        : [];

      setData(pending);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengambil data Waste."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredData = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return data;

    return data.filter((item) => {
      return [
        item.number,
        item.outlet?.code,
        item.outlet?.name,
        item.barang?.code,
        item.barang?.name,
        item.type,
        item.user?.fullname,
        item.note,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(keyword)
        );
    });
  }, [data, search]);

  const totalWasteQty = useMemo(
    () =>
      filteredData.reduce(
        (sum, item) => sum + Number(item.wasteQty || 0),
        0
      ),
    [filteredData]
  );

  const totalWasteValue = useMemo(
    () =>
      filteredData.reduce(
        (sum, item) => sum + Number(item.totalCost || 0),
        0
      ),
    [filteredData]
  );

  async function handleApprove(id: number) {
    const item = data.find((row) => row.id === id);

    if (!item) return;

    const confirmed = window.confirm(
      `Approve Waste ${item.number}?\n\n` +
        `Barang: ${item.barang?.name || "-"}\n` +
        `Waste: ${formatNumber(item.wasteQty)} ${
          item.barang?.unit || ""
        }\n` +
        `Nilai: ${formatCurrency(item.totalCost)}`
    );

    if (!confirmed) return;

    try {
      setApprovingId(id);
      setError("");
      setSuccess("");

      const response = await fetch(
        `/api/outlet/waste/${id}/approve`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Gagal approve Waste."
        );
      }

      setData((current) =>
        current.filter((row) => row.id !== id)
      );

      setSuccess(
        `Waste ${item.number} berhasil di-approve.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal approve Waste."
      );
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <div className="min-h-full bg-[#F5F8F6] p-6">
      {/* HEADER */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#527A6B] text-white">
              <CheckCircle2 size={18} />
            </div>

            <h1 className="text-[22px] font-bold text-[#263B34]">
              Approval Waste Outlet
            </h1>
          </div>

          <p className="text-[12px] text-[#71847C]">
            Review dan approve transaksi Waste Outlet yang masih
            berstatus PENDING.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="
            inline-flex
            h-10
            items-center
            justify-center
            gap-2
            rounded-lg
            border
            border-[#C8D7D1]
            bg-white
            px-4
            text-[12px]
            font-bold
            text-[#527A6B]
            shadow-sm
            transition
            hover:bg-[#F0F5F2]
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          <RefreshCw
            size={15}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {/* ALERT */}
      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <XCircle size={18} className="mt-0.5 shrink-0" />

          <div>
            <p className="text-[12px] font-bold">
              Terjadi kesalahan
            </p>
            <p className="mt-0.5 text-[11px]">
              {error}
            </p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />

          <div>
            <p className="text-[12px] font-bold">
              Berhasil
            </p>
            <p className="mt-0.5 text-[11px]">
              {success}
            </p>
          </div>
        </div>
      )}

      {/* SUMMARY */}
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-[#D9E3DE] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#81928B]">
                Pending
              </p>

              <p className="mt-1 text-[24px] font-bold text-[#263B34]">
                {formatNumber(filteredData.length)}
              </p>

              <p className="text-[10px] text-[#8A9A94]">
                transaksi menunggu approval
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF4D8] text-[#B98516]">
              <Clock3 size={19} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#D9E3DE] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#81928B]">
                Total Waste
              </p>

              <p className="mt-1 text-[24px] font-bold text-[#263B34]">
                {formatNumber(totalWasteQty)}
              </p>

              <p className="text-[10px] text-[#8A9A94]">
                qty waste pending
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FDECEC] text-[#C75B5B]">
              <PackageMinusIcon />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#D9E3DE] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#81928B]">
                Nilai Waste
              </p>

              <p className="mt-1 text-[20px] font-bold text-[#263B34]">
                {formatCurrency(totalWasteValue)}
              </p>

              <p className="text-[10px] text-[#8A9A94]">
                nilai cost pending
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E9F3EF] text-[#527A6B]">
              <CheckCircle2 size={19} />
            </div>
          </div>
        </div>
      </div>

      {/* TABLE CARD */}
      <div className="overflow-hidden rounded-xl border border-[#D9E3DE] bg-white shadow-sm">
        {/* TOOLBAR */}
        <div className="flex flex-col gap-3 border-b border-[#E1E9E5] p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-[14px] font-bold text-[#263B34]">
              Waste Menunggu Approval
            </h2>

            <p className="mt-0.5 text-[10px] text-[#84948E]">
              Hanya transaksi dengan status PENDING yang
              ditampilkan.
            </p>
          </div>

          <div className="relative w-full md:w-[300px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B9C95]"
            />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor, outlet, barang..."
              className="
                h-9
                w-full
                rounded-lg
                border
                border-[#CDDAD4]
                bg-[#FAFCFB]
                pl-9
                pr-3
                text-[11px]
                text-[#263B34]
                outline-none
                transition
                focus:border-[#527A6B]
                focus:ring-2
                focus:ring-[#527A6B]/10
              "
            />
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse">
            <thead>
              <tr className="border-b border-[#DDE7E2] bg-[#F6F9F7]">
                <th className="px-4 py-3 text-left text-[9px] font-bold uppercase tracking-[0.1em] text-[#74867F]">
                  No
                </th>

                <th className="px-4 py-3 text-left text-[9px] font-bold uppercase tracking-[0.1em] text-[#74867F]">
                  Transaksi
                </th>

                <th className="px-4 py-3 text-left text-[9px] font-bold uppercase tracking-[0.1em] text-[#74867F]">
                  Outlet
                </th>

                <th className="px-4 py-3 text-left text-[9px] font-bold uppercase tracking-[0.1em] text-[#74867F]">
                  Barang
                </th>

                <th className="px-4 py-3 text-right text-[9px] font-bold uppercase tracking-[0.1em] text-[#74867F]">
                  Qty Proses
                </th>

                <th className="px-4 py-3 text-right text-[9px] font-bold uppercase tracking-[0.1em] text-[#74867F]">
                  Waste
                </th>

                <th className="px-4 py-3 text-right text-[9px] font-bold uppercase tracking-[0.1em] text-[#74867F]">
                  Net Qty
                </th>

                <th className="px-4 py-3 text-right text-[9px] font-bold uppercase tracking-[0.1em] text-[#74867F]">
                  Nilai Waste
                </th>

                <th className="px-4 py-3 text-left text-[9px] font-bold uppercase tracking-[0.1em] text-[#74867F]">
                  Dibuat Oleh
                </th>

                <th className="px-4 py-3 text-center text-[9px] font-bold uppercase tracking-[0.1em] text-[#74867F]">
                  Status
                </th>

                <th className="px-4 py-3 text-center text-[9px] font-bold uppercase tracking-[0.1em] text-[#74867F]">
                  Aksi
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-14 text-center"
                  >
                    <RefreshCw
                      size={22}
                      className="mx-auto animate-spin text-[#527A6B]"
                    />

                    <p className="mt-3 text-[11px] font-semibold text-[#71847C]">
                      Memuat data Waste...
                    </p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-14 text-center"
                  >
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF2EE] text-[#527A6B]">
                      <CheckCircle2 size={23} />
                    </div>

                    <p className="mt-3 text-[12px] font-bold text-[#344A42]">
                      Tidak ada Waste Pending
                    </p>

                    <p className="mt-1 text-[10px] text-[#899993]">
                      Semua transaksi Waste sudah diproses.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredData.map((item, index) => {
                  const approving =
                    approvingId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className="
                        border-b
                        border-[#E8EFEC]
                        transition
                        hover:bg-[#F8FBF9]
                      "
                    >
                      <td className="px-4 py-3 text-[11px] font-semibold text-[#71847C]">
                        {index + 1}
                      </td>

                      <td className="px-4 py-3">
                        <p className="text-[11px] font-bold text-[#344A42]">
                          {item.number}
                        </p>

                        <p className="mt-0.5 text-[9px] text-[#8A9A94]">
                          {formatDate(item.trxDate)}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <p className="text-[11px] font-bold text-[#344A42]">
                          {item.outlet?.name || "-"}
                        </p>

                        <p className="mt-0.5 text-[9px] text-[#8A9A94]">
                          {item.outlet?.code || "-"}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <p className="text-[11px] font-bold text-[#344A42]">
                          {item.barang?.name || "-"}
                        </p>

                        <p className="mt-0.5 text-[9px] text-[#8A9A94]">
                          {item.barang?.code || "-"}
                          {item.barang?.category
                            ? ` • ${item.barang.category}`
                            : ""}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className="text-[11px] font-bold text-[#344A42]">
                          {formatNumber(item.qtyProcessed)}
                        </span>

                        <span className="ml-1 text-[9px] text-[#899993]">
                          {item.barang?.unit || ""}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex rounded-md bg-[#FDECEC] px-2 py-1 text-[11px] font-bold text-[#C75B5B]">
                          {formatNumber(item.wasteQty)}
                        </span>

                        <span className="ml-1 text-[9px] text-[#899993]">
                          {item.barang?.unit || ""}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className="text-[11px] font-bold text-[#344A42]">
                          {formatNumber(item.netQty)}
                        </span>

                        <span className="ml-1 text-[9px] text-[#899993]">
                          {item.barang?.unit || ""}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <p className="text-[11px] font-bold text-[#344A42]">
                          {formatCurrency(item.totalCost)}
                        </p>

                        <p className="mt-0.5 text-[9px] text-[#899993]">
                          @ {formatCurrency(item.unitCost)}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <p className="max-w-[130px] truncate text-[11px] font-semibold text-[#344A42]">
                          {item.user?.fullname ||
                            item.user?.username ||
                            "-"}
                        </p>

                        {item.note && (
                          <p
                            title={item.note}
                            className="mt-0.5 max-w-[130px] truncate text-[9px] text-[#899993]"
                          >
                            {item.note}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF4D8] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-[#A87512]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#D59B25]" />
                          PENDING
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            handleApprove(item.id)
                          }
                          disabled={approving}
                          className="
                            inline-flex
                            h-8
                            items-center
                            justify-center
                            gap-1.5
                            rounded-lg
                            bg-[#527A6B]
                            px-3
                            text-[10px]
                            font-bold
                            text-white
                            shadow-sm
                            transition
                            hover:bg-[#456B5D]
                            disabled:cursor-not-allowed
                            disabled:opacity-60
                          "
                        >
                          {approving ? (
                            <RefreshCw
                              size={13}
                              className="animate-spin"
                            />
                          ) : (
                            <CheckCircle2 size={13} />
                          )}

                          {approving
                            ? "Proses..."
                            : "Approve"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        {!loading && filteredData.length > 0 && (
          <div className="flex items-center justify-between border-t border-[#E1E9E5] bg-[#FAFCFB] px-4 py-3">
            <p className="text-[10px] text-[#81928B]">
              Menampilkan{" "}
              <span className="font-bold text-[#527A6B]">
                {filteredData.length}
              </span>{" "}
              transaksi pending
            </p>

            <p className="text-[10px] text-[#81928B]">
              Total Waste:{" "}
              <span className="font-bold text-[#C75B5B]">
                {formatNumber(totalWasteQty)}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PackageMinusIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16.5 9.4 7.55 4.48" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
      <path d="M16 16h4" />
    </svg>
  );
}