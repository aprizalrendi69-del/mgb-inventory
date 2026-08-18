"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  Search,
  ShoppingCart,
  RefreshCw,
  CheckCircle2,
  FileText,
} from "lucide-react";

import { exportPurchasePDF } from "@/lib/exportPurchasePdf";

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type Supplier = {
  id: number;
  code: string;
  name: string;
};

type Barang = {
  id: number;
  code: string;
  barcode?: string | null;
  name: string;
  unit: string;
  purchasePrice?: number;
};

type PurchaseItem = {
  id?: number;
  barangId: number;
  barang: Barang;
  qty: number;
  price: number;
  subtotal: number;
};

type Purchase = {
  id: number;
  number: string;
  outletId: number;
  supplierId: number;
  total: number;
  remarks: string | null;
  status: string;
  purchaseDate?: string | Date | null;
  outlet: Outlet;
  supplier: Supplier;
  items: PurchaseItem[];
};

type Me = {
  id: number;
  username: string;
  fullname: string;
  role: string;
  outletId?: number | null;
};

export default function PurchaseOutletDetailPage() {
  const router = useRouter();
  const params = useParams();

  const id = String(params.id);

  // =====================================================
  // STATE
  // =====================================================

  const [purchase, setPurchase] =
    useState<Purchase | null>(null);

  const [me, setMe] =
    useState<Me | null>(null);

  const [outlets, setOutlets] =
    useState<Outlet[]>([]);

  const [suppliers, setSuppliers] =
    useState<Supplier[]>([]);

  const [barang, setBarang] =
    useState<Barang[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [approving, setApproving] =
    useState(false);

  const [exporting, setExporting] =
    useState(false);

  // =====================================================
  // FORM
  // =====================================================

  const [outletId, setOutletId] =
    useState("");

  const [supplierId, setSupplierId] =
    useState("");

  const [remarks, setRemarks] =
    useState("");

  const [barangSearch, setBarangSearch] =
    useState("");

  const [selectedBarangId, setSelectedBarangId] =
    useState("");

  const [qty, setQty] =
    useState("1");

  const [price, setPrice] =
    useState("");

  const [items, setItems] =
    useState<PurchaseItem[]>([]);

  // =====================================================
  // LOAD DATA
  // =====================================================

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);

      const [
        purchaseRes,
        outletRes,
        supplierRes,
        barangRes,
        meRes,
      ] = await Promise.all([
        fetch(
          `/api/outlet/purchase/${id}`,
          {
            cache: "no-store",
          }
        ),

        fetch("/api/outlet", {
          cache: "no-store",
        }),

        fetch("/api/master/supplier", {
          cache: "no-store",
        }),

        fetch(
          "/api/master/barang?search=",
          {
            cache: "no-store",
          }
        ),

        fetch("/api/me", {
          cache: "no-store",
        }),
      ]);

      const purchaseJson =
        await purchaseRes.json();

      const outletJson =
        await outletRes.json();

      const supplierJson =
        await supplierRes.json();

      const barangJson =
        await barangRes.json();

      let meJson: any = null;

      try {
        meJson = await meRes.json();
      } catch {
        meJson = null;
      }

      // =================================================
      // PURCHASE
      // =================================================

      if (
        !purchaseRes.ok ||
        !purchaseJson.success
      ) {
        alert(
          purchaseJson.message ||
            "Purchase Outlet tidak ditemukan"
        );

        router.push(
          "/outlet/purchase"
        );

        return;
      }

      const data =
        purchaseJson.data as Purchase;

      setPurchase(data);

      setOutletId(
        String(data.outletId)
      );

      setSupplierId(
        String(data.supplierId)
      );

      setRemarks(
        data.remarks || ""
      );

      setItems(
        data.items || []
      );

      // =================================================
      // OUTLET
      // =================================================

      if (outletJson.success) {
        setOutlets(
          outletJson.data || []
        );
      }

      // =================================================
      // SUPPLIER
      // =================================================

      if (supplierJson.success) {
        setSuppliers(
          supplierJson.data || []
        );
      }

      // =================================================
      // BARANG
      // =================================================

      if (barangJson.success) {
        setBarang(
          barangJson.data || []
        );
      }

      // =================================================
      // CURRENT USER
      // =================================================

      if (
        meJson?.success &&
        meJson?.data
      ) {
        setMe(meJson.data);
      } else if (meJson?.data) {
        setMe(meJson.data);
      } else if (meJson?.user) {
        setMe(meJson.user);
      }
    } catch (error) {
      console.error(
        "LOAD OUTLET PURCHASE DETAIL ERROR:",
        error
      );

      alert(
        "Gagal mengambil data Purchase Outlet"
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // STATUS
  // =====================================================

  const isDraft =
    purchase?.status === "DRAFT";

  // =====================================================
  // APPROVE ACCESS
  // =====================================================

  const canApprove =
    Boolean(
      isDraft &&
        (
          me?.role === "ADMIN" ||
          me?.role === "PURCHASING"
        )
    );

  // =====================================================
  // BARANG SEARCH
  // =====================================================

  const filteredBarang =
    useMemo(() => {
      const keyword =
        barangSearch
          .toLowerCase()
          .trim();

      if (!keyword) {
        return barang.slice(
          0,
          30
        );
      }

      return barang
        .filter((item) => {
          return (
            item.code
              ?.toLowerCase()
              .includes(keyword) ||
            item.name
              ?.toLowerCase()
              .includes(keyword) ||
            item.barcode
              ?.toLowerCase()
              .includes(keyword)
          );
        })
        .slice(0, 30);
    }, [
      barang,
      barangSearch,
    ]);

  // =====================================================
  // SELECTED BARANG
  // =====================================================

  const selectedBarang =
    useMemo(() => {
      return barang.find(
        (item) =>
          item.id ===
          Number(
            selectedBarangId
          )
      );
    }, [
      barang,
      selectedBarangId,
    ]);

  // =====================================================
  // FORMAT RUPIAH
  // =====================================================

  function formatRupiah(
    value: number
  ) {
    return Number(
      value || 0
    ).toLocaleString(
      "id-ID"
    );
  }

  // =====================================================
  // SELECT BARANG
  // =====================================================

  function handleSelectBarang(
    value: string
  ) {
    setSelectedBarangId(
      value
    );

    const selected =
      barang.find(
        (item) =>
          item.id ===
          Number(value)
      );

    if (selected) {
      setPrice(
        String(
          Number(
            selected.purchasePrice ||
              0
          )
        )
      );
    }
  }

  // =====================================================
  // ADD ITEM
  // =====================================================

  function addItem() {
    if (!selectedBarangId) {
      alert(
        "Pilih barang terlebih dahulu"
      );

      return;
    }

    const selected =
      barang.find(
        (item) =>
          item.id ===
          Number(
            selectedBarangId
          )
      );

    if (!selected) {
      alert(
        "Barang tidak ditemukan"
      );

      return;
    }

    const itemQty =
      Number(qty);

    const itemPrice =
      Number(price);

    if (
      !Number.isFinite(
        itemQty
      ) ||
      itemQty <= 0
    ) {
      alert(
        "Qty harus lebih dari 0"
      );

      return;
    }

    if (
      !Number.isFinite(
        itemPrice
      ) ||
      itemPrice <= 0
    ) {
      alert(
        "Harga harus lebih dari 0"
      );

      return;
    }

    const existingIndex =
      items.findIndex(
        (item) =>
          item.barangId ===
          selected.id
      );

    if (
      existingIndex >= 0
    ) {
      const updated = [
        ...items,
      ];

      const newQty =
        Number(
          updated[
            existingIndex
          ].qty
        ) + itemQty;

      updated[
        existingIndex
      ] = {
        ...updated[
          existingIndex
        ],

        qty: newQty,

        price: itemPrice,

        subtotal:
          newQty *
          itemPrice,
      };

      setItems(updated);
    } else {
      setItems([
        ...items,

        {
          barangId:
            selected.id,

          barang:
            selected,

          qty: itemQty,

          price: itemPrice,

          subtotal:
            itemQty *
            itemPrice,
        },
      ]);
    }

    setSelectedBarangId("");
    setBarangSearch("");
    setQty("1");
    setPrice("");
  }

  // =====================================================
  // UPDATE QTY
  // =====================================================

  function updateQty(
    barangId: number,
    value: string
  ) {
    const newQty =
      Number(value);

    setItems(
      (current) =>
        current.map(
          (item) => {
            if (
              item.barangId !==
              barangId
            ) {
              return item;
            }

            return {
              ...item,

              qty: newQty,

              subtotal:
                newQty *
                Number(
                  item.price
                ),
            };
          }
        )
    );
  }

  // =====================================================
  // UPDATE PRICE
  // =====================================================

  function updatePrice(
    barangId: number,
    value: string
  ) {
    const newPrice =
      Number(value);

    setItems(
      (current) =>
        current.map(
          (item) => {
            if (
              item.barangId !==
              barangId
            ) {
              return item;
            }

            return {
              ...item,

              price: newPrice,

              subtotal:
                Number(
                  item.qty
                ) *
                newPrice,
            };
          }
        )
    );
  }

  // =====================================================
  // REMOVE ITEM
  // =====================================================

  function removeItem(
    barangId: number
  ) {
    setItems(
      (current) =>
        current.filter(
          (item) =>
            item.barangId !==
            barangId
        )
    );
  }

  // =====================================================
  // TOTAL
  // =====================================================

  const total =
    useMemo(() => {
      return items.reduce(
        (sum, item) =>
          sum +
          Number(
            item.qty
          ) *
          Number(
            item.price
          ),
        0
      );
    }, [items]);

  // =====================================================
  // EXPORT PDF
  // =====================================================
  //
  // Export hanya membaca state.
  // Tidak mengubah:
  // - items
  // - supplier
  // - outlet
  // - status
  // - saving
  // - approving
  // - deleting
  //
  // Jadi aman digunakan saat edit.
  // =====================================================

  async function handleExportPDF() {
    if (!purchase) {
      alert(
        "Data Purchase Outlet belum tersedia"
      );

      return;
    }

    if (exporting) {
      return;
    }

    try {
      setExporting(true);

      // =================================================
      // SNAPSHOT DATA
      // =================================================

      const currentOutlet =
        purchase.outlet ||
        outlets.find(
          (outlet) =>
            outlet.id ===
            Number(outletId)
        ) ||
        null;

      const currentSupplier =
        purchase.supplier ||
        suppliers.find(
          (supplier) =>
            supplier.id ===
            Number(supplierId)
        ) ||
        null;

      // =================================================
      // DATA PDF
      // =================================================

      const pdfData = {
        ...purchase,

        outlet:
          currentOutlet,

        supplier:
          currentSupplier,

        items: items.map(
          (item) => ({
            ...item,

            subtotal:
              Number(
                item.qty
              ) *
              Number(
                item.price
              ),
          })
        ),

        total:
          total,
      };

      // =================================================
      // EXPORT
      // =================================================

      await Promise.resolve(
        exportPurchasePDF(
          pdfData
        )
      );
    } catch (error) {
      console.error(
        "EXPORT OUTLET PURCHASE PDF ERROR:",
        error
      );

      alert(
        "Gagal membuat PDF Purchase Outlet"
      );
    } finally {
      setExporting(false);
    }
  }

  // =====================================================
  // SAVE
  // =====================================================

  async function handleSave() {
    if (!isDraft) {
      alert(
        "Purchase Outlet ini sudah tidak dapat diedit"
      );

      return;
    }

    if (!outletId) {
      alert(
        "Outlet wajib dipilih"
      );

      return;
    }

    if (!supplierId) {
      alert(
        "Supplier wajib dipilih"
      );

      return;
    }

    if (items.length === 0) {
      alert(
        "Minimal harus ada 1 barang"
      );

      return;
    }

    const invalidItem =
      items.find(
        (item) =>
          !Number.isFinite(
            Number(item.qty)
          ) ||
          Number(item.qty) <=
            0 ||
          !Number.isFinite(
            Number(item.price)
          ) ||
          Number(item.price) <=
            0
      );

    if (invalidItem) {
      alert(
        "Qty dan harga semua barang harus valid"
      );

      return;
    }

    const ok =
      confirm(
        "Simpan perubahan Purchase Outlet?"
      );

    if (!ok) {
      return;
    }

    try {
      setSaving(true);

      const res =
        await fetch(
          `/api/outlet/purchase/${id}`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              outletId:
                Number(
                  outletId
                ),

              supplierId:
                Number(
                  supplierId
                ),

              remarks:
                remarks.trim() ||
                null,

              items:
                items.map(
                  (item) => ({
                    barangId:
                      item.barangId,

                    qty:
                      Number(
                        item.qty
                      ),

                    price:
                      Number(
                        item.price
                      ),
                  })
                ),
            }),
          }
        );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        alert(
          json.message ||
            "Gagal menyimpan perubahan"
        );

        return;
      }

      alert(
        "Purchase Outlet berhasil diperbarui"
      );

      await loadData();
    } catch (error) {
      console.error(
        "UPDATE OUTLET PURCHASE ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat menyimpan"
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // DELETE
  // =====================================================

  async function handleDelete() {
    if (!isDraft) {
      alert(
        "Purchase Outlet ini tidak dapat dihapus"
      );

      return;
    }

    const ok =
      confirm(
        `Hapus Purchase Outlet ${purchase?.number}?`
      );

    if (!ok) {
      return;
    }

    try {
      setDeleting(true);

      const res =
        await fetch(
          `/api/outlet/purchase/${id}`,
          {
            method: "DELETE",
          }
        );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        alert(
          json.message ||
            "Gagal menghapus Purchase Outlet"
        );

        return;
      }

      alert(
        "Purchase Outlet berhasil dihapus"
      );

      router.push(
        "/outlet/purchase"
      );

      router.refresh();
    } catch (error) {
      console.error(
        "DELETE OUTLET PURCHASE ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat menghapus"
      );
    } finally {
      setDeleting(false);
    }
  }

  // =====================================================
  // APPROVE
  // =====================================================

  async function handleApprove() {
    if (!purchase) {
      return;
    }

    const canUserApprove =
      me?.role === "ADMIN" ||
      me?.role === "PURCHASING";

    if (!canUserApprove) {
      alert(
        "Hanya Admin Pusat atau Purchasing yang boleh approve Purchase Outlet"
      );

      return;
    }

    if (!isDraft) {
      alert(
        "Purchase Outlet ini sudah tidak dapat diapprove"
      );

      return;
    }

    if (items.length === 0) {
      alert(
        "Purchase Outlet tidak memiliki barang"
      );

      return;
    }

    const ok =
      confirm(
        `Approve Purchase Outlet ${purchase.number}?`
      );

    if (!ok) {
      return;
    }

    try {
      setApproving(true);

      const res =
        await fetch(
          `/api/outlet/purchase/${id}/approve`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        alert(
          json.message ||
            "Gagal approve Purchase Outlet"
        );

        return;
      }

      alert(
        "Purchase Outlet berhasil diapprove"
      );

      await loadData();
    } catch (error) {
      console.error(
        "APPROVE OUTLET PURCHASE ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat approve"
      );
    } finally {
      setApproving(false);
    }
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex items-center gap-3 text-gray-500">
            <RefreshCw
              size={22}
              className="animate-spin text-[#497F70]"
            />

            Memuat Purchase Outlet...
          </div>
        </div>
      </div>
    );
  }

  if (!purchase) {
    return null;
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div className="flex items-center gap-3">

          <button
            type="button"
            onClick={() =>
              router.push(
                "/outlet/purchase"
              )
            }
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#DDE9E4] bg-white text-gray-600 shadow-sm hover:bg-[#F5F8F6]"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#497F70] text-white">
            <ShoppingCart size={23} />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-[#18352D] md:text-3xl">
              {purchase.number}
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Detail Purchase Order Outlet
            </p>
          </div>

        </div>

        <div className="flex flex-wrap items-center gap-3">

          {/* STATUS */}

          <span
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              purchase.status ===
              "DRAFT"
                ? "bg-yellow-100 text-yellow-700"
                : purchase.status ===
                  "APPROVED"
                ? "bg-blue-100 text-blue-700"
                : purchase.status ===
                  "RECEIVED"
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {purchase.status}
          </span>

          {/* =================================================
              EXPORT PDF HEADER
          ================================================= */}

          <button
            type="button"
            onClick={
              handleExportPDF
            }
            disabled={
              exporting ||
              loading
            }
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? (
              <RefreshCw
                size={17}
                className="animate-spin"
              />
            ) : (
              <FileText
                size={17}
              />
            )}

            {exporting
              ? "Membuat PDF..."
              : "Export PDF"}
          </button>

          {/* APPROVE */}

          {canApprove && (
            <button
              type="button"
              onClick={
                handleApprove
              }
              disabled={
                approving ||
                saving ||
                deleting ||
                exporting
              }
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {approving ? (
                <RefreshCw
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <CheckCircle2
                  size={17}
                />
              )}

              {approving
                ? "Approving..."
                : "Approve"}
            </button>
          )}

          {/* DELETE */}

          {isDraft && (
            <button
              type="button"
              onClick={
                handleDelete
              }
              disabled={
                deleting ||
                saving ||
                approving ||
                exporting
              }
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? (
                <RefreshCw
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <Trash2 size={17} />
              )}

              {deleting
                ? "Menghapus..."
                : "Hapus"}
            </button>
          )}

        </div>
      </div>

      <div className="space-y-6">

        {/* =================================================
            INFORMASI PO
        ================================================= */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

          <div className="border-b border-[#E5ECE9] px-5 py-4">
            <h2 className="font-semibold text-[#18352D]">
              Informasi Purchase Order
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">

            {/* NOMOR */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Nomor PO
              </label>

              <input
                value={
                  purchase.number
                }
                disabled
                className="w-full rounded-xl border border-[#D5E5DC] bg-gray-100 px-4 py-3 text-sm text-gray-500"
              />
            </div>

            {/* STATUS */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Status
              </label>

              <input
                value={
                  purchase.status
                }
                disabled
                className="w-full rounded-xl border border-[#D5E5DC] bg-gray-100 px-4 py-3 text-sm text-gray-500"
              />
            </div>

            {/* OUTLET */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Outlet
              </label>

              <select
                value={
                  outletId
                }
                disabled={
                  !isDraft
                }
                onChange={(e) =>
                  setOutletId(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm outline-none focus:border-[#497F70] disabled:bg-gray-100"
              >
                <option value="">
                  Pilih Outlet
                </option>

                {outlets.map(
                  (
                    outlet
                  ) => (
                    <option
                      key={
                        outlet.id
                      }
                      value={
                        outlet.id
                      }
                    >
                      {
                        outlet.code
                      }{" "}
                      -{" "}
                      {
                        outlet.name
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            {/* SUPPLIER */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Supplier
              </label>

              <select
                value={
                  supplierId
                }
                disabled={
                  !isDraft
                }
                onChange={(e) =>
                  setSupplierId(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm outline-none focus:border-[#497F70] disabled:bg-gray-100"
              >
                <option value="">
                  Pilih Supplier
                </option>

                {suppliers.map(
                  (
                    supplier
                  ) => (
                    <option
                      key={
                        supplier.id
                      }
                      value={
                        supplier.id
                      }
                    >
                      {
                        supplier.code
                      }{" "}
                      -{" "}
                      {
                        supplier.name
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            {/* REMARKS */}

            <div className="md:col-span-2">

              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Keterangan
              </label>

              <textarea
                value={
                  remarks
                }
                disabled={
                  !isDraft
                }
                onChange={(e) =>
                  setRemarks(
                    e.target.value
                  )
                }
                rows={3}
                className="w-full resize-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm outline-none focus:border-[#497F70] disabled:bg-gray-100"
              />

            </div>

          </div>
        </div>

        {/* =================================================
            TAMBAH BARANG
        ================================================= */}

        {isDraft && (
          <div className="rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

            <div className="border-b border-[#E5ECE9] px-5 py-4">

              <h2 className="font-semibold text-[#18352D]">
                Tambah Barang
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Tambahkan barang ke Purchase Order
              </p>

            </div>

            <div className="p-5">

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">

                {/* BARANG */}

                <div className="lg:col-span-5">

                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Barang
                  </label>

                  <div className="relative mb-2">

                    <Search
                      size={17}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                      value={
                        barangSearch
                      }
                      onChange={(
                        e
                      ) =>
                        setBarangSearch(
                          e.target
                            .value
                        )
                      }
                      placeholder="Cari kode / nama / barcode..."
                      className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-3 pl-10 pr-4 text-sm outline-none focus:border-[#497F70]"
                    />

                  </div>

                  <select
                    value={
                      selectedBarangId
                    }
                    onChange={(
                      e
                    ) =>
                      handleSelectBarang(
                        e.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm outline-none focus:border-[#497F70]"
                  >
                    <option value="">
                      Pilih Barang
                    </option>

                    {filteredBarang.map(
                      (
                        item
                      ) => (
                        <option
                          key={
                            item.id
                          }
                          value={
                            item.id
                          }
                        >
                          {
                            item.code
                          }{" "}
                          -{" "}
                          {
                            item.name
                          }
                        </option>
                      )
                    )}
                  </select>

                </div>

                {/* QTY */}

                <div className="lg:col-span-2">

                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Qty
                  </label>

                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={
                      qty
                    }
                    onChange={(
                      e
                    ) =>
                      setQty(
                        e.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm outline-none focus:border-[#497F70]"
                  />

                </div>

                {/* HARGA */}

                <div className="lg:col-span-3">

                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Harga
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={
                      price
                    }
                    onChange={(
                      e
                    ) =>
                      setPrice(
                        e.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm outline-none focus:border-[#497F70]"
                  />

                  {selectedBarang && (
                    <p className="mt-1 text-xs text-gray-400">
                      Harga terakhir: Rp{" "}
                      {formatRupiah(
                        Number(
                          selectedBarang.purchasePrice ||
                            0
                        )
                      )}
                    </p>
                  )}

                </div>

                {/* TAMBAH */}

                <div className="flex items-end lg:col-span-2">

                  <button
                    type="button"
                    onClick={
                      addItem
                    }
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#497F70] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3D6D60]"
                  >
                    <Plus
                      size={17}
                    />

                    Tambah
                  </button>

                </div>

              </div>

            </div>
          </div>
        )}

        {/* =================================================
            DETAIL BARANG
        ================================================= */}

        <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

          <div className="flex items-center justify-between border-b border-[#E5ECE9] px-5 py-4">

            <div>

              <h2 className="font-semibold text-[#18352D]">
                Detail Barang
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {items.length} barang
              </p>

            </div>

            <div className="text-right">

              <p className="text-sm text-gray-500">
                Total
              </p>

              <p className="text-xl font-bold text-[#18352D]">
                Rp{" "}
                {formatRupiah(
                  total
                )}
              </p>

            </div>

          </div>

          <div className="overflow-x-auto">

            <table className="min-w-full text-sm">

              <thead className="bg-[#F5F8F6]">

                <tr className="border-b border-[#E5ECE9]">

                  <th className="px-5 py-4 text-left">
                    No
                  </th>

                  <th className="px-5 py-4 text-left">
                    Barang
                  </th>

                  <th className="px-5 py-4 text-left">
                    Satuan
                  </th>

                  <th className="px-5 py-4 text-right">
                    Qty
                  </th>

                  <th className="px-5 py-4 text-right">
                    Harga
                  </th>

                  <th className="px-5 py-4 text-right">
                    Subtotal
                  </th>

                  {isDraft && (
                    <th className="px-5 py-4 text-center">
                      Aksi
                    </th>
                  )}

                </tr>

              </thead>

              <tbody>

                {items.map(
                  (
                    item,
                    index
                  ) => (
                    <tr
                      key={
                        item.barangId
                      }
                      className="border-b border-[#EDF2EF]"
                    >

                      <td className="px-5 py-4">
                        {
                          index + 1
                        }
                      </td>

                      <td className="px-5 py-4">

                        <div className="font-semibold text-[#18352D]">
                          {
                            item
                              .barang
                              .name
                          }
                        </div>

                        <div className="mt-1 text-xs text-gray-400">
                          {
                            item
                              .barang
                              .code
                          }
                        </div>

                      </td>

                      <td className="px-5 py-4">
                        {
                          item
                            .barang
                            .unit
                        }
                      </td>

                      <td className="px-5 py-4 text-right">

                        {isDraft ? (
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={
                              item.qty
                            }
                            onChange={(
                              e
                            ) =>
                              updateQty(
                                item.barangId,
                                e
                                  .target
                                  .value
                              )
                            }
                            className="w-24 rounded-lg border border-[#D5E5DC] px-3 py-2 text-right"
                          />
                        ) : (
                          item.qty
                        )}

                      </td>

                      <td className="px-5 py-4 text-right">

                        {isDraft ? (
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={
                              item.price
                            }
                            onChange={(
                              e
                            ) =>
                              updatePrice(
                                item.barangId,
                                e
                                  .target
                                  .value
                              )
                            }
                            className="w-36 rounded-lg border border-[#D5E5DC] px-3 py-2 text-right"
                          />
                        ) : (
                          `Rp ${formatRupiah(
                            item.price
                          )}`
                        )}

                      </td>

                      <td className="px-5 py-4 text-right font-semibold">
                        Rp{" "}
                        {formatRupiah(
                          Number(
                            item.qty
                          ) *
                            Number(
                              item.price
                            )
                        )}
                      </td>

                      {isDraft && (
                        <td className="px-5 py-4 text-center">

                          <button
                            type="button"
                            onClick={() =>
                              removeItem(
                                item.barangId
                              )
                            }
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                          >
                            <Trash2
                              size={
                                16
                              }
                            />
                          </button>

                        </td>
                      )}

                    </tr>
                  )
                )}

                {items.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        isDraft
                          ? 7
                          : 6
                      }
                      className="px-5 py-12 text-center text-gray-400"
                    >
                      Belum ada barang.
                    </td>
                  </tr>
                )}

              </tbody>

              <tfoot>

                <tr className="bg-[#F5F8F6]">

                  <td
                    colSpan={5}
                    className="px-5 py-5 text-right font-bold"
                  >
                    TOTAL
                  </td>

                  <td className="px-5 py-5 text-right text-lg font-bold text-[#18352D]">
                    Rp{" "}
                    {formatRupiah(
                      total
                    )}
                  </td>

                  {isDraft && (
                    <td />
                  )}

                </tr>

              </tfoot>

            </table>

          </div>
        </div>

        {/* =================================================
            BOTTOM ACTION
        ================================================= */}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

          {/* KEMBALI */}

          <button
            type="button"
            onClick={() =>
              router.push(
                "/outlet/purchase"
              )
            }
            className="rounded-xl border border-[#D5E5DC] bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-[#F5F8F6]"
          >
            Kembali
          </button>

          {/* EXPORT PDF */}

          <button
            type="button"
            onClick={
              handleExportPDF
            }
            disabled={
              exporting
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? (
              <RefreshCw
                size={17}
                className="animate-spin"
              />
            ) : (
              <FileText
                size={17}
              />
            )}

            {exporting
              ? "Membuat PDF..."
              : "Export PDF"}
          </button>

          {/* SAVE */}

          {isDraft && (
            <button
              type="button"
              onClick={
                handleSave
              }
              disabled={
                saving ||
                deleting ||
                approving ||
                exporting
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#497F70] px-6 py-3 text-sm font-semibold text-white hover:bg-[#3D6D60] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw
                    size={17}
                    className="animate-spin"
                  />

                  Menyimpan...
                </>
              ) : (
                <>
                  <Save
                    size={17}
                  />

                  Simpan Perubahan
                </>
              )}
            </button>
          )}

        </div>

      </div>
    </div>
  );
}