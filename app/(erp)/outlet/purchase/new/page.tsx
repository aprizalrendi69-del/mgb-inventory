"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  ShoppingCart,
  Save,
  RefreshCw,
  ChevronDown,
  Check,
} from "lucide-react";

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

type OutletBarang = {
  id: number;
  harga: number | null;
  aktif: boolean;
  outlet: Outlet;
  barang: Barang;
};

type PurchaseItem = {
  barangId: number;
  barang: Barang;
  qty: number;
  price: number;
  subtotal: number;
};

type Me = {
  id: number;
  username: string;
  fullname: string;
  role: string;
  outletId?: number | null;
};

const PAYMENT_METHODS = [
  "CASH",
  "TRANSFER",
  "COD",
  "CBD",
  "TEMPO",
] as const;

export default function PurchaseOutletNewPage() {
  const router = useRouter();

  const [me, setMe] = useState<Me | null>(null);

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [outletBarang, setOutletBarang] = useState<
    OutletBarang[]
  >([]);

  const [outletId, setOutletId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState("");
  const [remarks, setRemarks] = useState("");

  // Supplier dropdown
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierOpen, setSupplierOpen] = useState(false);

  // Barang dropdown
  const [barangSearch, setBarangSearch] = useState("");
  const [barangOpen, setBarangOpen] = useState(false);
  const [selectedBarangId, setSelectedBarangId] =
    useState("");

  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");

  const [items, setItems] = useState<PurchaseItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingBarang, setLoadingBarang] =
    useState(false);
  const [saving, setSaving] = useState(false);

  // =========================================================
  // ROLE
  // =========================================================

  const isAdminPusat =
    me?.role === "ADMIN";

  const isPurchasing =
    me?.role === "PURCHASING";

  const isOutletAdmin =
    me?.role === "OUTLET_ADMIN";

  /*
   * ADMIN + PURCHASING
   * adalah user pusat dan boleh memilih outlet.
   *
   * OUTLET_ADMIN
   * hanya boleh menggunakan outlet dari session.
   */
  const canChooseOutlet =
    isAdminPusat ||
    isPurchasing;

  // =========================================================
  // LOAD USER + MASTER
  // =========================================================

  useEffect(() => {
    loadMaster();
  }, []);

  async function loadMaster() {
    try {
      setLoading(true);

      const [meRes, supplierRes] =
        await Promise.all([
          fetch("/api/me", {
            cache: "no-store",
          }),

          fetch("/api/master/supplier", {
            cache: "no-store",
          }),
        ]);

      let meJson: any = null;

      try {
        meJson = await meRes.json();
      } catch {
        meJson = null;
      }

      let supplierJson: any = null;

      try {
        supplierJson =
          await supplierRes.json();
      } catch {
        supplierJson = null;
      }

      // =====================================================
      // USER
      // =====================================================

      let currentUser: Me | null = null;

      if (
        meJson?.success &&
        meJson?.data
      ) {
        currentUser = meJson.data;
      } else if (meJson?.data) {
        currentUser = meJson.data;
      } else if (meJson?.user) {
        currentUser = meJson.user;
      }

      if (!currentUser) {
        alert(
          "Data user tidak ditemukan"
        );

        router.push(
          "/outlet/purchase"
        );

        return;
      }

      setMe(currentUser);

      // =====================================================
      // VALIDASI ROLE
      // =====================================================

      const allowedRoles = [
        "ADMIN",
        "PURCHASING",
        "OUTLET_ADMIN",
      ];

      if (
        !allowedRoles.includes(
          currentUser.role
        )
      ) {
        alert(
          "Anda tidak memiliki akses membuat Purchase Outlet"
        );

        router.push(
          "/outlet/purchase"
        );

        return;
      }

      // =====================================================
      // SUPPLIER
      // =====================================================

      if (
        supplierJson?.success
      ) {
        setSuppliers(
          supplierJson.data || []
        );
      }

      // =====================================================
      // USER PUSAT
      //
      // ADMIN + PURCHASING
      // boleh memilih outlet.
      // =====================================================

      if (
        currentUser.role === "ADMIN" ||
        currentUser.role === "PURCHASING"
      ) {
        const outletRes =
          await fetch(
            "/api/outlet",
            {
              cache: "no-store",
            }
          );

        let outletJson: any = null;

        try {
          outletJson =
            await outletRes.json();
        } catch {
          outletJson = null;
        }

        if (
          outletJson?.success
        ) {
          setOutlets(
            outletJson.data || []
          );
        } else {
          setOutlets([]);

          alert(
            outletJson?.message ||
              "Gagal mengambil data outlet"
          );
        }

        /*
         * User pusat harus memilih outlet
         * secara manual.
         */
        setOutletId("");
      }

      // =====================================================
      // OUTLET ADMIN
      //
      // Outlet otomatis dari session.
      // =====================================================

      else if (
        currentUser.role ===
        "OUTLET_ADMIN"
      ) {
        if (
          !currentUser.outletId
        ) {
          alert(
            "User Anda belum terhubung ke outlet."
          );

          router.push(
            "/outlet/purchase"
          );

          return;
        }

        setOutletId(
          String(
            currentUser.outletId
          )
        );
      }
    } catch (error) {
      console.error(
        "LOAD MASTER OUTLET PURCHASE ERROR:",
        error
      );

      alert(
        "Gagal mengambil data master"
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // FILTER SUPPLIER
  // =========================================================

  const filteredSuppliers = useMemo(() => {
    const keyword =
      supplierSearch
        .toLowerCase()
        .trim();

    if (!keyword) {
      return suppliers.slice(
        0,
        50
      );
    }

    return suppliers
      .filter((supplier) => {
        return (
          supplier.code
            ?.toLowerCase()
            .includes(keyword) ||
          supplier.name
            ?.toLowerCase()
            .includes(keyword)
        );
      })
      .slice(0, 50);
  }, [
    suppliers,
    supplierSearch,
  ]);

  // =========================================================
  // SELECTED SUPPLIER
  // =========================================================

  const selectedSupplier = useMemo(() => {
    return suppliers.find(
      (supplier) =>
        supplier.id ===
        Number(supplierId)
    );
  }, [
    suppliers,
    supplierId,
  ]);

  // =========================================================
  // PILIH SUPPLIER
  // =========================================================

  function handleSelectSupplier(
    supplier: Supplier
  ) {
    setSupplierId(
      String(supplier.id)
    );

    setSupplierSearch(
      `${supplier.code} - ${supplier.name}`
    );

    setSupplierOpen(false);
  }

  function clearSupplier() {
    setSupplierId("");
    setSupplierSearch("");
    setSupplierOpen(false);
  }

  // =========================================================
  // LOAD BARANG BERDASARKAN OUTLET
  // =========================================================

  useEffect(() => {
    if (!outletId) {
      setOutletBarang([]);
      setSelectedBarangId("");
      setBarangSearch("");
      setBarangOpen(false);
      setPrice("");
      setItems([]);

      return;
    }

    loadOutletBarang(
      outletId
    );
  }, [outletId]);

  async function loadOutletBarang(
    selectedOutletId: string
  ) {
    try {
      setLoadingBarang(true);

      const params =
        new URLSearchParams();

      params.set(
        "outletId",
        selectedOutletId
      );

      const res =
        await fetch(
          `/api/outlet/master-barang?${params.toString()}`,
          {
            cache: "no-store",
          }
        );

      let json: any = null;

      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (
        !res.ok ||
        !json?.success
      ) {
        setOutletBarang([]);

        alert(
          json?.message ||
            "Gagal mengambil barang outlet"
        );

        return;
      }

      const activeBarang =
        (json.data || []).filter(
          (
            item: OutletBarang
          ) =>
            item.aktif === true
        );

      setOutletBarang(
        activeBarang
      );

      setSelectedBarangId("");
      setBarangSearch("");
      setBarangOpen(false);
      setPrice("");

      /*
       * Ketika outlet berubah,
       * item PO lama harus dikosongkan
       * supaya tidak tercampur dengan outlet sebelumnya.
       */
      setItems([]);
    } catch (error) {
      console.error(
        "LOAD OUTLET BARANG ERROR:",
        error
      );

      setOutletBarang([]);

      alert(
        "Gagal mengambil master barang outlet"
      );
    } finally {
      setLoadingBarang(false);
    }
  }

  // =========================================================
  // FILTER BARANG
  // =========================================================

  const filteredBarang = useMemo(() => {
    const keyword =
      barangSearch
        .toLowerCase()
        .trim();

    if (!keyword) {
      return outletBarang.slice(
        0,
        50
      );
    }

    return outletBarang
      .filter((item) => {
        const barang =
          item.barang;

        return (
          barang.code
            ?.toLowerCase()
            .includes(keyword) ||
          barang.name
            ?.toLowerCase()
            .includes(keyword) ||
          barang.barcode
            ?.toLowerCase()
            .includes(keyword)
        );
      })
      .slice(0, 50);
  }, [
    outletBarang,
    barangSearch,
  ]);

  // =========================================================
  // BARANG TERPILIH
  // =========================================================

  const selectedOutletBarang =
    useMemo(() => {
      return outletBarang.find(
        (item) =>
          item.barang.id ===
          Number(
            selectedBarangId
          )
      );
    }, [
      outletBarang,
      selectedBarangId,
    ]);

  // =========================================================
  // PILIH BARANG
  // =========================================================

  function handleSelectBarang(
    item: OutletBarang
  ) {
    setSelectedBarangId(
      String(
        item.barang.id
      )
    );

    setBarangSearch(
      `${item.barang.code} - ${item.barang.name}`
    );

    setPrice(
      String(
        Number(
          item.harga || 0
        )
      )
    );

    setBarangOpen(false);
  }

  function clearBarang() {
    setSelectedBarangId("");
    setBarangSearch("");
    setPrice("");
    setBarangOpen(false);
  }

  // =========================================================
  // TAMBAH ITEM
  // =========================================================

  function addItem() {
    if (!outletId) {
      alert(
        "Outlet belum ditentukan"
      );

      return;
    }

    if (!selectedBarangId) {
      alert(
        "Pilih barang terlebih dahulu"
      );

      return;
    }

    const selected =
      outletBarang.find(
        (item) =>
          item.barang.id ===
          Number(
            selectedBarangId
          )
      );

    if (!selected) {
      alert(
        "Barang tidak ditemukan di outlet"
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
          selected.barang.id
      );

    if (
      existingIndex >= 0
    ) {
      const updated =
        [...items];

      const newQty =
        updated[
          existingIndex
        ].qty + itemQty;

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
            selected.barang.id,

          barang:
            selected.barang,

          qty: itemQty,

          price: itemPrice,

          subtotal:
            itemQty *
            itemPrice,
        },
      ]);
    }

    clearBarang();
    setQty("1");
  }

  // =========================================================
  // UPDATE QTY
  // =========================================================

  function updateQty(
    barangId: number,
    value: string
  ) {
    const newQty =
      Number(value);

    setItems((current) =>
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
              item.price,
          };
        }
      )
    );
  }

  // =========================================================
  // UPDATE PRICE
  // =========================================================

  function updatePrice(
    barangId: number,
    value: string
  ) {
    const newPrice =
      Number(value);

    setItems((current) =>
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
              item.qty *
              newPrice,
          };
        }
      )
    );
  }

  // =========================================================
  // HAPUS ITEM
  // =========================================================

  function removeItem(
    barangId: number
  ) {
    setItems((current) =>
      current.filter(
        (item) =>
          item.barangId !==
          barangId
      )
    );
  }

  // =========================================================
  // TOTAL
  // =========================================================

  const total = useMemo(() => {
    return items.reduce(
      (sum, item) =>
        sum +
        Number(item.qty) *
          Number(item.price),
      0
    );
  }, [items]);

  // =========================================================
  // FORMAT RUPIAH
  // =========================================================

  function formatRupiah(
    value: number
  ) {
    return Number(
      value || 0
    ).toLocaleString(
      "id-ID"
    );
  }

  // =========================================================
  // SUBMIT PO
  // =========================================================

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    // =======================================================
    // VALIDASI OUTLET
    // =======================================================

    if (!outletId) {
      alert(
        canChooseOutlet
          ? "Outlet wajib dipilih"
          : "Outlet user belum ditentukan"
      );

      return;
    }

    /*
     * Hanya OUTLET_ADMIN yang dikunci
     * ke outlet dari session.
     *
     * ADMIN dan PURCHASING bebas memilih
     * outlet sesuai kebutuhan.
     */
    if (
      isOutletAdmin &&
      me?.outletId &&
      Number(outletId) !==
        Number(me.outletId)
    ) {
      alert(
        "Outlet Purchase Order tidak sesuai dengan outlet user"
      );

      return;
    }

    // =======================================================
    // VALIDASI SUPPLIER
    // =======================================================

    if (!supplierId) {
      alert(
        "Supplier wajib dipilih"
      );

      return;
    }

    // =======================================================
    // VALIDASI PAYMENT METHOD
    // =======================================================

    if (!paymentMethod) {
      alert(
        "Metode pembayaran wajib dipilih"
      );

      return;
    }

    if (
      !PAYMENT_METHODS.includes(
        paymentMethod as
          (typeof PAYMENT_METHODS)[number]
      )
    ) {
      alert(
        "Metode pembayaran tidak valid"
      );

      return;
    }

    // =======================================================
    // VALIDASI ITEM
    // =======================================================

    if (
      items.length === 0
    ) {
      alert(
        "Minimal tambahkan 1 barang"
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

    const ok = confirm(
      "Simpan Purchase Order Outlet ini?"
    );

    if (!ok) {
      return;
    }

    try {
      setSaving(true);

      const res =
        await fetch(
          "/api/outlet/purchase",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              /*
               * ADMIN / PURCHASING
               * -> outlet pilihan user pusat
               *
               * OUTLET_ADMIN
               * -> API akan tetap mengabaikan
               *    outletId frontend dan memakai
               *    outletId dari session.
               */
              outletId:
                Number(
                  outletId
                ),

              supplierId:
                Number(
                  supplierId
                ),

              paymentMethod,

              remarks:
                remarks.trim() ||
                null,

              items: items.map(
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

      let json: any = null;

      try {
        json =
          await res.json();
      } catch {
        json = null;
      }

      if (
        !res.ok ||
        !json?.success
      ) {
        alert(
          json?.message ||
            "Gagal membuat Purchase Order Outlet"
        );

        return;
      }

      alert(
        "Purchase Order Outlet berhasil dibuat"
      );

      router.push(
        "/outlet/purchase"
      );

      router.refresh();
    } catch (error) {
      console.error(
        "CREATE OUTLET PURCHASE ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat membuat Purchase Order Outlet"
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex items-center gap-3 text-gray-500">
            <RefreshCw
              size={22}
              className="animate-spin text-[#497F70]"
            />

            Memuat data...
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div className="flex items-center gap-3">

          <button
            type="button"
            onClick={() =>
              router.push(
                "/outlet/purchase"
              )
            }
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#DDE9E4] bg-white text-gray-600 shadow-sm transition hover:bg-[#F5F8F6]"
          >
            <ArrowLeft
              size={20}
            />
          </button>

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
            <ShoppingCart
              size={23}
            />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Purchase Outlet Baru
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Buat Purchase Order untuk outlet
            </p>
          </div>

        </div>

      </div>

      <form
        onSubmit={
          handleSubmit
        }
        className="space-y-6"
      >

        {/* ===================================================
            INFORMASI PO
        =================================================== */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

          <div className="border-b border-[#E5ECE9] px-5 py-4">

            <h2 className="font-semibold text-[#18352D]">
              Informasi Purchase Order
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {canChooseOutlet
                ? "Tentukan outlet, supplier, dan metode pembayaran"
                : "Tentukan supplier dan metode pembayaran untuk Purchase Order outlet"}
            </p>

          </div>

          <div
            className={`grid grid-cols-1 gap-5 p-5 ${
              canChooseOutlet
                ? "md:grid-cols-2"
                : "md:grid-cols-1"
            }`}
          >

            {/* =================================================
                OUTLET
                ADMIN + PURCHASING
            ================================================= */}

            {canChooseOutlet && (
              <div>

                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Outlet
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </label>

                <select
                  value={
                    outletId
                  }
                  onChange={(
                    e
                  ) =>
                    setOutletId(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
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

                {isPurchasing && (
                  <p className="mt-1 text-xs text-gray-400">
                    Purchasing dapat membuat Purchase Order untuk outlet mana pun.
                  </p>
                )}

              </div>
            )}

            {/* =================================================
                SUPPLIER
            ================================================= */}

            <div className="relative">

              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Supplier
                <span className="ml-1 text-red-500">
                  *
                </span>
              </label>

              <div className="relative">

                <Search
                  size={17}
                  className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="text"
                  value={
                    supplierSearch
                  }
                  onFocus={() =>
                    setSupplierOpen(
                      true
                    )
                  }
                  onChange={(
                    e
                  ) => {
                    setSupplierSearch(
                      e.target
                        .value
                    );

                    setSupplierId(
                      ""
                    );

                    setSupplierOpen(
                      true
                    );
                  }}
                  placeholder="Ketik kode / nama supplier..."
                  className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-3 pl-10 pr-10 text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                />

                <ChevronDown
                  size={17}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition ${
                    supplierOpen
                      ? "rotate-180"
                      : ""
                  }`}
                />

              </div>

              {supplierOpen && (
                <>

                  <div
                    className="fixed inset-0 z-20"
                    onClick={() =>
                      setSupplierOpen(
                        false
                      )
                    }
                  />

                  <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-xl border border-[#D5E5DC] bg-white p-1 shadow-xl">

                    {filteredSuppliers.length ===
                    0 ? (
                      <div className="px-4 py-6 text-center text-sm text-gray-400">
                        Supplier tidak ditemukan
                      </div>
                    ) : (
                      filteredSuppliers.map(
                        (
                          supplier
                        ) => (
                          <button
                            key={
                              supplier.id
                            }
                            type="button"
                            onClick={() =>
                              handleSelectSupplier(
                                supplier
                              )
                            }
                            className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left transition hover:bg-[#F3F8F5]"
                          >

                            <div>

                              <div className="font-semibold text-[#18352D]">
                                {
                                  supplier.name
                                }
                              </div>

                              <div className="mt-0.5 text-xs text-gray-400">
                                {
                                  supplier.code
                                }
                              </div>

                            </div>

                            {supplierId ===
                              String(
                                supplier.id
                              ) && (
                              <Check
                                size={
                                  18
                                }
                                className="text-[#497F70]"
                              />
                            )}

                          </button>
                        )
                      )
                    )}

                  </div>

                </>
              )}

              {selectedSupplier && (
                <p className="mt-1 text-xs text-[#497F70]">
                  Supplier dipilih:{" "}
                  {
                    selectedSupplier.code
                  }{" "}
                  -{" "}
                  {
                    selectedSupplier.name
                  }
                </p>
              )}

            </div>

            {/* =================================================
                METODE PEMBAYARAN
            ================================================= */}

            <div
              className={
                canChooseOutlet
                  ? ""
                  : "md:max-w-xl"
              }
            >

              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Metode Pembayaran
                <span className="ml-1 text-red-500">
                  *
                </span>
              </label>

              <select
                value={
                  paymentMethod
                }
                onChange={(
                  e
                ) =>
                  setPaymentMethod(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
              >

                <option value="">
                  Pilih Metode Pembayaran
                </option>

                {PAYMENT_METHODS.map(
                  (
                    method
                  ) => (
                    <option
                      key={
                        method
                      }
                      value={
                        method
                      }
                    >
                      {
                        method
                      }
                    </option>
                  )
                )}

              </select>

              <p className="mt-1 text-xs text-gray-400">
                Metode ini akan digunakan pada proses Payment setelah PO disetujui.
              </p>

            </div>

            {/* =================================================
                KETERANGAN
            ================================================= */}

            <div className="md:col-span-2">

              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Keterangan
              </label>

              <textarea
                value={
                  remarks
                }
                onChange={(
                  e
                ) =>
                  setRemarks(
                    e.target
                      .value
                  )
                }
                rows={3}
                placeholder="Keterangan Purchase Order..."
                className="w-full resize-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
              />

            </div>

          </div>

        </div>

        {/* =====================================================
            TAMBAH BARANG
        ===================================================== */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

          <div className="border-b border-[#E5ECE9] px-5 py-4">

            <h2 className="font-semibold text-[#18352D]">
              Tambah Barang
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Barang diambil dari Master Barang Outlet
            </p>

          </div>

          <div className="p-5">

            {!outletId ? (

              <div className="rounded-xl border border-dashed border-[#CFE0D7] bg-[#F8FBF9] p-8 text-center">

                <ShoppingCart
                  size={30}
                  className="mx-auto mb-2 text-[#497F70]"
                />

                <p className="font-semibold text-gray-700">
                  Pilih outlet terlebih dahulu
                </p>

                <p className="mt-1 text-sm text-gray-400">
                  Daftar barang akan muncul setelah outlet dipilih.
                </p>

              </div>

            ) : loadingBarang ? (

              <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">

                <RefreshCw
                  size={18}
                  className="animate-spin text-[#497F70]"
                />

                Memuat barang outlet...

              </div>

            ) : outletBarang.length ===
              0 ? (

              <div className="rounded-xl border border-dashed border-[#CFE0D7] bg-[#F8FBF9] p-8 text-center">

                <ShoppingCart
                  size={30}
                  className="mx-auto mb-2 text-gray-300"
                />

                <p className="font-semibold text-gray-600">
                  Belum ada barang di outlet ini
                </p>

                <p className="mt-1 text-sm text-gray-400">
                  Tambahkan barang terlebih dahulu melalui Master Barang Outlet.
                </p>

              </div>

            ) : (

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">

                {/* BARANG */}

                <div className="relative lg:col-span-5">

                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Barang
                  </label>

                  <div className="relative">

                    <Search
                      size={17}
                      className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400"
                    />

                    <input
                      type="text"
                      value={
                        barangSearch
                      }
                      onFocus={() =>
                        setBarangOpen(
                          true
                        )
                      }
                      onChange={(
                        e
                      ) => {
                        setBarangSearch(
                          e.target
                            .value
                        );

                        setSelectedBarangId(
                          ""
                        );

                        setPrice(
                          ""
                        );

                        setBarangOpen(
                          true
                        );
                      }}
                      placeholder="Ketik kode / nama / barcode..."
                      className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-3 pl-10 pr-10 text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                    />

                    <ChevronDown
                      size={17}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition ${
                        barangOpen
                          ? "rotate-180"
                          : ""
                      }`}
                    />

                  </div>

                  {barangOpen && (
                    <>

                      <div
                        className="fixed inset-0 z-20"
                        onClick={() =>
                          setBarangOpen(
                            false
                          )
                        }
                      />

                      <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-xl border border-[#D5E5DC] bg-white p-1 shadow-xl">

                        {filteredBarang.length ===
                        0 ? (

                          <div className="px-4 py-6 text-center text-sm text-gray-400">
                            Barang tidak ditemukan
                          </div>

                        ) : (

                          filteredBarang.map(
                            (
                              item
                            ) => (
                              <button
                                key={
                                  item
                                    .barang
                                    .id
                                }
                                type="button"
                                onClick={() =>
                                  handleSelectBarang(
                                    item
                                  )
                                }
                                className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left transition hover:bg-[#F3F8F5]"
                              >

                                <div className="min-w-0">

                                  <div className="font-semibold text-[#18352D]">
                                    {
                                      item
                                        .barang
                                        .name
                                    }
                                  </div>

                                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-gray-400">

                                    <span>
                                      {
                                        item
                                          .barang
                                          .code
                                      }
                                    </span>

                                    <span>
                                      •
                                    </span>

                                    <span>
                                      {
                                        item
                                          .barang
                                          .unit
                                      }
                                    </span>

                                    {item
                                      .barang
                                      .barcode && (
                                      <>
                                        <span>
                                          •
                                        </span>

                                        <span>
                                          {
                                            item
                                              .barang
                                              .barcode
                                          }
                                        </span>
                                      </>
                                    )}

                                  </div>

                                </div>

                                <div className="ml-3 shrink-0 text-right">

                                  <div className="text-xs text-gray-400">
                                    Harga
                                  </div>

                                  <div className="text-sm font-semibold text-[#497F70]">
                                    Rp{" "}
                                    {formatRupiah(
                                      Number(
                                        item
                                          .harga ||
                                          0
                                      )
                                    )}
                                  </div>

                                </div>

                                {selectedBarangId ===
                                  String(
                                    item
                                      .barang
                                      .id
                                  ) && (
                                  <Check
                                    size={
                                      18
                                    }
                                    className="ml-2 shrink-0 text-[#497F70]"
                                  />
                                )}

                              </button>
                            )
                          )

                        )}

                      </div>

                    </>
                  )}

                  <p className="mt-1 text-xs text-gray-400">
                    {
                      outletBarang.length
                    }{" "}
                    barang tersedia
                  </p>

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
                    placeholder="0"
                    className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm outline-none focus:border-[#497F70]"
                  />

                  {selectedOutletBarang && (
                    <p className="mt-1 text-xs text-gray-400">
                      Harga master: Rp{" "}
                      {formatRupiah(
                        Number(
                          selectedOutletBarang.harga ||
                            0
                        )
                      )}
                    </p>
                  )}

                </div>

                {/* BUTTON */}

                <div className="flex items-end lg:col-span-2">

                  <button
                    type="button"
                    onClick={
                      addItem
                    }
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#497F70] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#3D6D60]"
                  >
                    <Plus
                      size={17}
                    />
                    Tambah
                  </button>

                </div>

              </div>

            )}

          </div>

        </div>

        {/* =====================================================
            DETAIL BARANG
        ===================================================== */}

        <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

          <div className="flex flex-col gap-1 border-b border-[#E5ECE9] px-5 py-4 md:flex-row md:items-center md:justify-between">

            <div>

              <h2 className="font-semibold text-[#18352D]">
                Detail Barang
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {
                  items.length
                }{" "}
                barang ditambahkan
              </p>

            </div>

            <div className="text-right">

              <p className="text-sm text-gray-500">
                Total Purchase Order
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

                  <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                    No
                  </th>

                  <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                    Barang
                  </th>

                  <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                    Satuan
                  </th>

                  <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                    Qty
                  </th>

                  <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                    Harga
                  </th>

                  <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                    Subtotal
                  </th>

                  <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                    Aksi
                  </th>

                </tr>

              </thead>

              <tbody>

                {items.length ===
                0 ? (

                  <tr>

                    <td
                      colSpan={
                        7
                      }
                      className="px-5 py-14 text-center"
                    >

                      <div className="flex flex-col items-center">

                        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF3EF] text-[#497F70]">

                          <ShoppingCart
                            size={
                              25
                            }
                          />

                        </div>

                        <p className="font-semibold text-gray-700">
                          Belum ada barang
                        </p>

                        <p className="mt-1 text-sm text-gray-400">
                          Tambahkan barang menggunakan form di atas.
                        </p>

                      </div>

                    </td>

                  </tr>

                ) : (

                  items.map(
                    (
                      item,
                      index
                    ) => (

                      <tr
                        key={
                          item.barangId
                        }
                        className="border-b border-[#EDF2EF] hover:bg-[#FAFCFB]"
                      >

                        <td className="px-5 py-4 text-gray-500">
                          {
                            index +
                            1
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

                        <td className="px-5 py-4 text-gray-600">
                          {
                            item
                              .barang
                              .unit ||
                            "-"
                          }
                        </td>

                        <td className="px-5 py-4">

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
                            className="w-24 rounded-lg border border-[#D5E5DC] bg-white px-3 py-2 text-right text-sm outline-none focus:border-[#497F70]"
                          />

                        </td>

                        <td className="px-5 py-4">

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
                            className="w-36 rounded-lg border border-[#D5E5DC] bg-white px-3 py-2 text-right text-sm outline-none focus:border-[#497F70]"
                          />

                        </td>

                        <td className="px-5 py-4 text-right font-semibold text-[#18352D]">
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

                        <td className="px-5 py-4 text-center">

                          <button
                            type="button"
                            onClick={() =>
                              removeItem(
                                item.barangId
                              )
                            }
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100"
                            title="Hapus barang"
                          >
                            <Trash2
                              size={
                                16
                              }
                            />
                          </button>

                        </td>

                      </tr>

                    )
                  )

                )}

              </tbody>

              {items.length >
                0 && (

                <tfoot>

                  <tr className="bg-[#F5F8F6]">

                    <td
                      colSpan={
                        5
                      }
                      className="px-5 py-5 text-right font-bold text-[#18352D]"
                    >
                      TOTAL
                    </td>

                    <td className="px-5 py-5 text-right text-lg font-bold text-[#18352D]">
                      Rp{" "}
                      {formatRupiah(
                        total
                      )}
                    </td>

                    <td />

                  </tr>

                </tfoot>

              )}

            </table>

          </div>

        </div>

        {/* =====================================================
            ACTION
        ===================================================== */}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

          <button
            type="button"
            onClick={() =>
              router.push(
                "/outlet/purchase"
              )
            }
            disabled={
              saving
            }
            className="rounded-xl border border-[#D5E5DC] bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-[#F5F8F6] disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={
              saving ||
              !outletId ||
              !supplierId ||
              !paymentMethod ||
              items.length === 0
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#497F70] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3D6D60] disabled:cursor-not-allowed disabled:opacity-50"
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

                Simpan Purchase Outlet
              </>
            )}

          </button>

        </div>

      </form>

    </div>
  );
}