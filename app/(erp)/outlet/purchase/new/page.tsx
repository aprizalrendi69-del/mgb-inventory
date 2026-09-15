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
  CalendarDays,
  Building2,
  Store,
  CreditCard,
  FileText,
  Package,
  X,
  Receipt,
  Sparkles,
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

  hargaTerakhir?: number | null;
  hargaTerakhirTanggal?: string | null;
  hargaTerakhirPurchase?: string | null;

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

function getTodayLocalDate() {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    now.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatRupiah(value: number) {
  return Number(value || 0).toLocaleString(
    "id-ID"
  );
}

function inputClass(extra = "") {
  return `
    h-[46px]
    w-full
    rounded-xl
    border
    border-[#D5E5DC]
    bg-[#FAFCFB]
    px-4
    text-sm
    text-[#18352D]
    outline-none
    transition
    placeholder:text-gray-400
    focus:border-[#497F70]
    focus:bg-white
    focus:ring-4
    focus:ring-[#497F70]/10
    ${extra}
  `;
}

function Field({
  label,
  required,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative ${className}`}
    >
      <label className="mb-2 block text-sm font-bold text-[#35564C]">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      {children}
    </div>
  );
}

function Hint({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <p className="mt-1.5 text-[11px] leading-4 text-gray-400">
      {children}
    </p>
  );
}

function EmptyState({
  icon,
  title,
  text,
  compact = false,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact
          ? "py-3"
          : "rounded-2xl border border-dashed border-[#CFE0D7] bg-[#F8FBF9] px-5 py-12"
      }`}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
        {icon}
      </div>

      <p className="font-bold text-gray-700">
        {title}
      </p>

      <p className="mt-1 max-w-md text-xs leading-5 text-gray-400">
        {text}
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-medium text-gray-400">
        {label}
      </span>

      <span className="max-w-[190px] text-right text-xs font-bold text-[#35564C]">
        {value}
      </span>
    </div>
  );
}

export default function PurchaseOutletNewPage() {
  const router = useRouter();

  const [me, setMe] =
    useState<Me | null>(null);

  const [outlets, setOutlets] =
    useState<Outlet[]>([]);

  const [suppliers, setSuppliers] =
    useState<Supplier[]>([]);

  const [outletBarang, setOutletBarang] =
    useState<OutletBarang[]>([]);

  const [outletId, setOutletId] =
    useState("");

  const [supplierId, setSupplierId] =
    useState("");

  const [paymentMethod, setPaymentMethod] =
    useState("");

  const [purchaseDate, setPurchaseDate] =
    useState(getTodayLocalDate());

  const [remarks, setRemarks] =
    useState("");

  const [supplierSearch, setSupplierSearch] =
    useState("");

  const [supplierOpen, setSupplierOpen] =
    useState(false);

  const [barangSearch, setBarangSearch] =
    useState("");

  const [barangOpen, setBarangOpen] =
    useState(false);

  const [selectedBarangId, setSelectedBarangId] =
    useState("");

  const [qty, setQty] =
    useState("1");

  const [price, setPrice] =
    useState("");

  const [items, setItems] =
    useState<PurchaseItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [loadingBarang, setLoadingBarang] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const isAdminPusat =
    me?.role === "ADMIN";

  const isPurchasing =
    me?.role === "PURCHASING";

  const isOutletAdmin =
    me?.role === "OUTLET_ADMIN";

  const canChooseOutlet =
    isAdminPusat ||
    isPurchasing;

  useEffect(() => {
    loadMaster();
  }, []);

  async function loadMaster() {
    try {
      setLoading(true);

      const [
        meRes,
        supplierRes,
      ] = await Promise.all([
        fetch("/api/me", {
          cache: "no-store",
        }),

        fetch("/api/master/supplier", {
          cache: "no-store",
        }),
      ]);

      let meJson: any = null;
      let supplierJson: any = null;

      try {
        meJson =
          await meRes.json();
      } catch {
        meJson = null;
      }

      try {
        supplierJson =
          await supplierRes.json();
      } catch {
        supplierJson = null;
      }

      let currentUser: Me | null =
        null;

      if (
        meJson?.success &&
        meJson?.data
      ) {
        currentUser =
          meJson.data;
      } else if (
        meJson?.data
      ) {
        currentUser =
          meJson.data;
      } else if (
        meJson?.user
      ) {
        currentUser =
          meJson.user;
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

      if (
        supplierJson?.success
      ) {
        setSuppliers(
          supplierJson.data || []
        );
      }

      if (
        currentUser.role ===
          "ADMIN" ||
        currentUser.role ===
          "PURCHASING"
      ) {
        const outletRes =
          await fetch(
            "/api/outlet",
            {
              cache:
                "no-store",
            }
          );

        let outletJson: any =
          null;

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
            outletJson.data ||
              []
          );
        } else {
          setOutlets([]);

          alert(
            outletJson?.message ||
              "Gagal mengambil data outlet"
          );
        }

        setOutletId("");
      } else if (
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

  const filteredSuppliers =
    useMemo(() => {
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
        .filter(
          (supplier) => {
            return (
              supplier.code
                ?.toLowerCase()
                .includes(
                  keyword
                ) ||
              supplier.name
                ?.toLowerCase()
                .includes(
                  keyword
                )
            );
          }
        )
        .slice(0, 50);
    }, [
      suppliers,
      supplierSearch,
    ]);

  const selectedSupplier =
    useMemo(() => {
      return suppliers.find(
        (supplier) =>
          supplier.id ===
          Number(
            supplierId
          )
      );
    }, [
      suppliers,
      supplierId,
    ]);

  function handleSelectSupplier(
    supplier: Supplier
  ) {
    setSupplierId(
      String(
        supplier.id
      )
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
            cache:
              "no-store",
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
        setOutletBarang([]);

        alert(
          json?.message ||
            "Gagal mengambil barang outlet"
        );

        return;
      }

      const activeBarang =
        (
          json.data || []
        ).filter(
          (
            item: OutletBarang
          ) =>
            item.aktif ===
            true
        );

      setOutletBarang(
        activeBarang
      );

      setSelectedBarangId("");
      setBarangSearch("");
      setBarangOpen(false);
      setPrice("");
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

  const filteredBarang =
    useMemo(() => {
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
              .includes(
                keyword
              ) ||
            barang.name
              ?.toLowerCase()
              .includes(
                keyword
              ) ||
            barang.barcode
              ?.toLowerCase()
              .includes(
                keyword
              )
          );
        })
        .slice(0, 50);
    }, [
      outletBarang,
      barangSearch,
    ]);

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

  function getDefaultPurchasePrice(
    item: OutletBarang
  ) {
    const hargaTerakhir =
      Number(
        item.hargaTerakhir ??
          0
      );

    const hargaMasterOutlet =
      Number(
        item.harga ??
          0
      );

    const hargaMasterPusat =
      Number(
        item.barang
          .purchasePrice ??
          0
      );

    if (
      Number.isFinite(
        hargaTerakhir
      ) &&
      hargaTerakhir > 0
    ) {
      return hargaTerakhir;
    }

    if (
      Number.isFinite(
        hargaMasterOutlet
      ) &&
      hargaMasterOutlet > 0
    ) {
      return hargaMasterOutlet;
    }

    if (
      Number.isFinite(
        hargaMasterPusat
      ) &&
      hargaMasterPusat > 0
    ) {
      return hargaMasterPusat;
    }

    return 0;
  }

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

    const hargaDefault =
      getDefaultPurchasePrice(
        item
      );

    setPrice(
      String(
        hargaDefault
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
        ].qty +
        itemQty;

      updated[
        existingIndex
      ] = {
        ...updated[
          existingIndex
        ],
        qty: newQty,
        price:
          itemPrice,
        subtotal:
          newQty *
          itemPrice,
      };

      setItems(
        updated
      );
    } else {
      setItems([
        ...items,
        {
          barangId:
            selected
              .barang
              .id,

          barang:
            selected.barang,

          qty: itemQty,

          price:
            itemPrice,

          subtotal:
            itemQty *
            itemPrice,
        },
      ]);
    }

    clearBarang();
    setQty("1");
  }

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
                item.price,
            };
          }
        )
    );
  }

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
              price:
                newPrice,
              subtotal:
                item.qty *
                newPrice,
            };
          }
        )
    );
  }

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

  const total =
    useMemo(() => {
      return items.reduce(
        (
          sum,
          item
        ) =>
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

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!outletId) {
      alert(
        canChooseOutlet
          ? "Outlet wajib dipilih"
          : "Outlet user belum ditentukan"
      );

      return;
    }

    if (
      isOutletAdmin &&
      me?.outletId &&
      Number(
        outletId
      ) !==
        Number(
          me.outletId
        )
    ) {
      alert(
        "Outlet Purchase Order tidak sesuai dengan outlet user"
      );

      return;
    }

    if (!purchaseDate) {
      alert(
        "Tanggal Purchase Order wajib diisi"
      );

      return;
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        purchaseDate
      )
    ) {
      alert(
        "Format tanggal Purchase Order tidak valid"
      );

      return;
    }

    const parsedDate =
      new Date(
        `${purchaseDate}T00:00:00`
      );

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      alert(
        "Tanggal Purchase Order tidak valid"
      );

      return;
    }

    if (!supplierId) {
      alert(
        "Supplier wajib dipilih"
      );

      return;
    }

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

    if (
      items.length ===
      0
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
            Number(
              item.qty
            )
          ) ||
          Number(
            item.qty
          ) <= 0 ||
          !Number.isFinite(
            Number(
              item.price
            )
          ) ||
          Number(
            item.price
          ) <= 0
      );

    if (invalidItem) {
      alert(
        "Qty dan harga semua barang harus valid"
      );

      return;
    }

    const ok =
      confirm(
        `Simpan Purchase Order Outlet dengan tanggal ${parsedDate.toLocaleDateString(
          "id-ID",
          {
            day: "2-digit",
            month:
              "long",
            year:
              "numeric",
          }
        )}?`
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
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                outletId:
                  Number(
                    outletId
                  ),

                supplierId:
                  Number(
                    supplierId
                  ),

                purchaseDate,

                paymentMethod,

                remarks:
                  remarks.trim() ||
                  null,

                items:
                  items.map(
                    (
                      item
                    ) => ({
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

      let json: any =
        null;

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

  /*
  ==========================================================
  LOADING
  ==========================================================
  */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F8F6]">
        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-6">
            <div className="h-28 rounded-[28px] bg-white shadow-sm" />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
              <div className="space-y-6">
                <div className="h-80 rounded-[26px] bg-white shadow-sm" />
                <div className="h-72 rounded-[26px] bg-white shadow-sm" />
                <div className="h-96 rounded-[26px] bg-white shadow-sm" />
              </div>

              <div className="h-[500px] rounded-[26px] bg-white shadow-sm" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F8F6] text-[#18352D]">
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">

        {/* ==================================================
            HEADER
        ================================================== */}

        <header className="mb-6 overflow-hidden rounded-[28px] border border-[#DDE9E4] bg-white shadow-[0_12px_40px_rgba(24,53,45,0.06)]">

          <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-start gap-4">

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/outlet/purchase"
                  )
                }
                className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#DDE9E4] bg-[#FAFCFB] text-gray-600 transition hover:bg-[#F0F6F3] hover:text-[#18352D]"
              >
                <ArrowLeft
                  size={19}
                />
              </button>

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#497F70] text-white shadow-lg shadow-[#497F70]/20">
                <Receipt
                  size={22}
                />
              </div>

              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">

                  <span className="rounded-full bg-[#EAF3EF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#497F70]">
                    Purchase Workspace
                  </span>

                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">
                    Draft
                  </span>

                </div>

                <h1 className="text-2xl font-black tracking-tight text-[#18352D] sm:text-3xl">
                  Purchase Outlet Baru
                </h1>

                <p className="mt-1 text-sm text-gray-500">
                  Buat Purchase Order untuk kebutuhan operasional outlet.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex">

              <div className="min-w-[105px] rounded-2xl border border-[#E5ECE9] bg-[#FAFCFB] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Items
                </p>

                <p className="mt-0.5 text-lg font-black text-[#18352D]">
                  {items.length}
                </p>
              </div>

              <div className="min-w-[145px] rounded-2xl border border-[#E5ECE9] bg-[#FAFCFB] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Total
                </p>

                <p className="mt-0.5 text-lg font-black text-[#18352D]">
                  Rp{" "}
                  {formatRupiah(
                    total
                  )}
                </p>
              </div>

            </div>
          </div>
        </header>

        <form
          onSubmit={
            handleSubmit
          }
        >

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">

            {/* ==================================================
                MAIN CONTENT
            ================================================== */}

            <main className="min-w-0 space-y-6">

              {/* ==================================================
                  INFORMATION
              ================================================== */}

              <section className="overflow-visible rounded-[26px] border border-[#DDE9E4] bg-white shadow-[0_8px_30px_rgba(24,53,45,0.045)]">

                <div className="border-b border-[#E8EEEB] px-5 py-5 sm:px-6">

                  <div className="flex items-center gap-3">

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                      <FileText
                        size={19}
                      />
                    </div>

                    <div>
                      <h2 className="font-bold text-[#18352D]">
                        Informasi Purchase Order
                      </h2>

                      <p className="text-xs text-gray-500">
                        Atur tujuan pembelian dan informasi transaksi.
                      </p>
                    </div>

                  </div>
                </div>

                <div
                  className={`grid grid-cols-1 gap-5 p-5 sm:p-6 ${
                    canChooseOutlet
                      ? "md:grid-cols-2"
                      : "md:grid-cols-1"
                  }`}
                >

                  {/* DATE */}

                  <Field
                    label="Tanggal Purchase Order"
                    required
                  >
                    <div className="relative">

                      <CalendarDays
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                        size={17}
                      />

                      <input
                        type="date"
                        value={
                          purchaseDate
                        }
                        onChange={(
                          e
                        ) =>
                          setPurchaseDate(
                            e.target
                              .value
                          )
                        }
                        required
                        className={inputClass(
                          "pl-10"
                        )}
                      />

                    </div>

                    <Hint>
                      Tanggal resmi Purchase Order.
                    </Hint>
                  </Field>

                  {/* OUTLET */}

                  {canChooseOutlet && (
                    <Field
                      label="Outlet"
                      required
                    >
                      <div className="relative">

                        <Store
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                          size={17}
                        />

                        <select
                          value={
                            outletId
                          }
                          onChange={(
                            e
                          ) =>
                            setOutletId(
                              e.target
                                .value
                            )
                          }
                          className={inputClass(
                            "pl-10"
                          )}
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

                      {isPurchasing && (
                        <Hint>
                          Purchasing dapat membuat Purchase Order untuk outlet mana pun.
                        </Hint>
                      )}
                    </Field>
                  )}

                  {/* SUPPLIER */}

                  <Field
                    label="Supplier"
                    required
                  >
                    <div className="relative">

                      <Search
                        className="absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-gray-400"
                        size={17}
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
                        placeholder="Cari kode atau nama supplier..."
                        className={inputClass(
                          "pl-10 pr-20"
                        )}
                      />

                      {supplierSearch && (
                        <button
                          type="button"
                          onClick={
                            clearSupplier
                          }
                          className="absolute right-9 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-700"
                        >
                          <X
                            size={15}
                          />
                        </button>
                      )}

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

                        <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-[#DDE9E4] bg-white p-1.5 shadow-[0_18px_50px_rgba(24,53,45,0.15)]">

                          {filteredSuppliers.length ===
                          0 ? (
                            <div className="px-4 py-8 text-center text-sm text-gray-400">
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
                                  className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition hover:bg-[#F2F7F4]"
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
                      <Hint>
                        Supplier dipilih:{" "}
                        {
                          selectedSupplier.code
                        }{" "}
                        —{" "}
                        {
                          selectedSupplier.name
                        }
                      </Hint>
                    )}
                  </Field>

                  {/* PAYMENT */}

                  <Field
                    label="Metode Pembayaran"
                    required
                  >
                    <div className="relative">

                      <CreditCard
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                        size={17}
                      />

                      <select
                        value={
                          paymentMethod
                        }
                        onChange={(
                          e
                        ) =>
                          setPaymentMethod(
                            e.target
                              .value
                          )
                        }
                        className={inputClass(
                          "pl-10"
                        )}
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

                    </div>

                    <Hint>
                      Digunakan pada proses pembayaran setelah PO disetujui.
                    </Hint>
                  </Field>

                  {/* REMARKS */}

                  <div className="md:col-span-2">

                    <Field label="Keterangan">

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
                        placeholder="Tambahkan catatan atau kebutuhan khusus..."
                        className={`${inputClass()} resize-none`}
                      />

                    </Field>

                  </div>

                </div>
              </section>

              {/* ==================================================
                  ADD ITEM
              ================================================== */}

              <section className="overflow-visible rounded-[26px] border border-[#DDE9E4] bg-white shadow-[0_8px_30px_rgba(24,53,45,0.045)]">

                <div className="border-b border-[#E8EEEB] px-5 py-5 sm:px-6">

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                    <div className="flex items-center gap-3">

                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                        <Package
                          size={19}
                        />
                      </div>

                      <div>
                        <h2 className="font-bold">
                          Tambah Barang
                        </h2>

                        <p className="text-xs text-gray-500">
                          Pilih barang yang terdaftar di Master Barang Outlet.
                        </p>
                      </div>

                    </div>

                    {outletId &&
                      !loadingBarang && (
                        <span className="rounded-full bg-[#F1F6F3] px-3 py-1.5 text-xs font-semibold text-[#497F70]">
                          {
                            outletBarang.length
                          }{" "}
                          barang tersedia
                        </span>
                      )}

                  </div>
                </div>

                <div className="p-5 sm:p-6">

                  {!outletId ? (
                    <EmptyState
                      icon={
                        <Store
                          size={27}
                        />
                      }
                      title="Pilih outlet terlebih dahulu"
                      text="Daftar barang akan muncul setelah outlet dipilih."
                    />
                  ) : loadingBarang ? (
                    <div className="flex items-center justify-center gap-3 rounded-2xl border border-[#E5ECE9] bg-[#FAFCFB] py-12 text-sm text-gray-500">
                      <RefreshCw
                        size={19}
                        className="animate-spin text-[#497F70]"
                      />

                      Memuat barang outlet...
                    </div>
                  ) : outletBarang.length ===
                    0 ? (
                    <EmptyState
                      icon={
                        <Package
                          size={27}
                        />
                      }
                      title="Belum ada barang di outlet ini"
                      text="Tambahkan barang terlebih dahulu melalui Master Barang Outlet."
                    />
                  ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">

                      {/* BARANG */}

                      <div className="relative lg:col-span-5">

                        <Field label="Barang">

                          <div className="relative">

                            <Search
                              className="absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-gray-400"
                              size={17}
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
                              placeholder="Kode / nama / barcode..."
                              className={inputClass(
                                "pl-10 pr-10"
                              )}
                            />

                            <ChevronDown
                              size={
                                17
                              }
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

                              <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-[#DDE9E4] bg-white p-1.5 shadow-[0_18px_50px_rgba(24,53,45,0.15)]">

                                {filteredBarang.length ===
                                0 ? (
                                  <div className="px-4 py-8 text-center text-sm text-gray-400">
                                    Barang tidak ditemukan
                                  </div>
                                ) : (
                                  filteredBarang.map(
                                    (
                                      item
                                    ) => {

                                      const displayPrice =
                                        getDefaultPurchasePrice(
                                          item
                                        );

                                      const hasLatestPrice =
                                        Number(
                                          item.hargaTerakhir ??
                                            0
                                        ) >
                                        0;

                                      return (
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
                                          className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-[#F2F7F4]"
                                        >

                                          <div className="min-w-0">

                                            <div className="truncate font-semibold text-[#18352D]">
                                              {
                                                item
                                                  .barang
                                                  .name
                                              }
                                            </div>

                                            <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-gray-400">

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

                                          <div className="shrink-0 text-right">

                                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                              {hasLatestPrice
                                                ? "Harga terakhir"
                                                : "Harga master"}
                                            </div>

                                            <div className="text-sm font-bold text-[#497F70]">
                                              Rp{" "}
                                              {formatRupiah(
                                                displayPrice
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
                                              className="shrink-0 text-[#497F70]"
                                            />
                                          )}

                                        </button>
                                      );
                                    }
                                  )
                                )}

                              </div>
                            </>
                          )}

                        </Field>

                      </div>

                      {/* QTY */}

                      <Field
                        label="Qty"
                        className="lg:col-span-2"
                      >
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
                          className={`${inputClass()} text-right`}
                        />
                      </Field>

                      {/* PRICE */}

                      <Field
                        label="Harga"
                        className="lg:col-span-3"
                      >

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
                          className={`${inputClass()} text-right`}
                        />

                        {selectedOutletBarang && (
                          <div className="mt-2 rounded-xl bg-[#F6FAF8] px-3 py-2">

                            {Number(
                              selectedOutletBarang.hargaTerakhir ??
                                0
                            ) >
                            0 ? (
                              <>
                                <p className="text-xs font-semibold text-[#497F70]">
                                  Harga terakhir: Rp{" "}
                                  {formatRupiah(
                                    Number(
                                      selectedOutletBarang.hargaTerakhir
                                    )
                                  )}
                                </p>

                                <p className="mt-0.5 text-[11px] text-gray-400">
                                  PO{" "}
                                  {selectedOutletBarang.hargaTerakhirPurchase ||
                                    "-"}{" "}
                                  •{" "}
                                  {selectedOutletBarang.hargaTerakhirTanggal
                                    ? new Date(
                                        selectedOutletBarang.hargaTerakhirTanggal
                                      ).toLocaleDateString(
                                        "id-ID"
                                      )
                                    : "-"}
                                </p>
                              </>
                            ) : (
                              <p className="text-xs text-gray-400">
                                Belum ada histori pembelian. Menggunakan harga master.
                              </p>
                            )}

                          </div>
                        )}

                      </Field>

                      {/* ADD BUTTON */}

                      <div className="flex items-end lg:col-span-2">

                        <button
                          type="button"
                          onClick={
                            addItem
                          }
                          className="inline-flex h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#497F70] px-4 text-sm font-bold text-white shadow-lg shadow-[#497F70]/15 transition hover:-translate-y-0.5 hover:bg-[#3D6D60]"
                        >
                          <Plus
                            size={
                              17
                            }
                          />

                          Tambah
                        </button>

                      </div>

                    </div>
                  )}

                </div>
              </section>

              {/* ==================================================
                  DETAIL TABLE
              ================================================== */}

              <section className="overflow-hidden rounded-[26px] border border-[#DDE9E4] bg-white shadow-[0_8px_30px_rgba(24,53,45,0.045)]">

                <div className="flex flex-col gap-3 border-b border-[#E8EEEB] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">

                  <div className="flex items-center gap-3">

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                      <ShoppingCart
                        size={19}
                      />
                    </div>

                    <div>
                      <h2 className="font-bold">
                        Detail Barang
                      </h2>

                      <p className="text-xs text-gray-500">
                        {
                          items.length
                        }{" "}
                        barang ditambahkan ke Purchase Order.
                      </p>
                    </div>

                  </div>

                  <div className="text-left sm:text-right">

                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Total Purchase Order
                    </p>

                    <p className="text-xl font-black tracking-tight text-[#18352D]">
                      Rp{" "}
                      {formatRupiah(
                        total
                      )}
                    </p>

                  </div>

                </div>

                <div className="overflow-x-auto">

                  <table className="w-full min-w-[820px] text-sm">

                    <thead className="bg-[#F7FAF8]">

                      <tr className="border-b border-[#E8EEEB]">

                        <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#607A70]">
                          No
                        </th>

                        <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#607A70]">
                          Barang
                        </th>

                        <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#607A70]">
                          Satuan
                        </th>

                        <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-[#607A70]">
                          Qty
                        </th>

                        <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-[#607A70]">
                          Harga
                        </th>

                        <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-[#607A70]">
                          Subtotal
                        </th>

                        <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-[#607A70]">
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
                            className="px-5 py-16"
                          >
                            <EmptyState
                              icon={
                                <ShoppingCart
                                  size={
                                    27
                                  }
                                />
                              }
                              title="Belum ada barang"
                              text="Tambahkan barang menggunakan form di atas."
                              compact
                            />
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
                              className="border-b border-[#EDF2EF] transition hover:bg-[#FAFCFB]"
                            >

                              <td className="px-5 py-4 text-gray-400">
                                {String(
                                  index +
                                    1
                                ).padStart(
                                  2,
                                  "0"
                                )}
                              </td>

                              <td className="px-5 py-4">

                                <div className="font-bold text-[#18352D]">
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
                                {item.barang.unit ||
                                  "-"}
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
                                  className="w-24 rounded-xl border border-[#D5E5DC] bg-white px-3 py-2 text-right text-sm outline-none transition focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
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
                                  className="w-36 rounded-xl border border-[#D5E5DC] bg-white px-3 py-2 text-right text-sm outline-none transition focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                                />

                              </td>

                              <td className="px-5 py-4 text-right font-black text-[#18352D]">
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
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500 transition hover:bg-red-100 hover:text-red-700"
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

                        <tr className="bg-[#F7FAF8]">

                          <td
                            colSpan={
                              5
                            }
                            className="px-5 py-5 text-right text-sm font-bold text-[#18352D]"
                          >
                            TOTAL
                          </td>

                          <td className="px-5 py-5 text-right text-lg font-black text-[#18352D]">
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
              </section>

            </main>

            {/* ==================================================
                RIGHT SUMMARY
            ================================================== */}

            <aside className="lg:sticky lg:top-6 lg:self-start">

              <div className="overflow-hidden rounded-[26px] border border-[#DDE9E4] bg-white shadow-[0_12px_40px_rgba(24,53,45,0.07)]">

                {/* SUMMARY HEADER */}

                <div className="bg-[#18352D] p-6 text-white">

                  <div className="flex items-center gap-3">

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                      <Sparkles
                        size={
                          20
                        }
                      />
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/50">
                        ORDER SUMMARY
                      </p>

                      <h2 className="font-bold">
                        Ringkasan Purchase
                      </h2>
                    </div>

                  </div>

                  <div className="mt-7">

                    <p className="text-xs text-white/50">
                      Grand Total
                    </p>

                    <p className="mt-1 break-words text-3xl font-black tracking-tight">
                      Rp{" "}
                      {formatRupiah(
                        total
                      )}
                    </p>

                  </div>

                </div>

                {/* SUMMARY BODY */}

                <div className="space-y-4 p-5">

                  <SummaryRow
                    label="Jumlah barang"
                    value={`${items.length} item`}
                  />

                  <SummaryRow
                    label="Supplier"
                    value={
                      selectedSupplier?.name ||
                      "Belum dipilih"
                    }
                  />

                  <SummaryRow
                    label="Outlet"
                    value={
                      outletId
                        ? outlets.find(
                            (
                              outlet
                            ) =>
                              outlet.id ===
                              Number(
                                outletId
                              )
                          )?.name ||
                          (isOutletAdmin
                            ? "Outlet user"
                            : "-")
                        : "Belum dipilih"
                    }
                  />

                  <SummaryRow
                    label="Pembayaran"
                    value={
                      paymentMethod ||
                      "Belum dipilih"
                    }
                  />

                  <div className="border-t border-[#E8EEEB] pt-4">

                    <div className="flex items-end justify-between gap-4">

                      <span className="text-sm font-semibold text-gray-500">
                        Total PO
                      </span>

                      <span className="text-xl font-black text-[#18352D]">
                        Rp{" "}
                        {formatRupiah(
                          total
                        )}
                      </span>

                    </div>

                  </div>

                  {/* NOTICE */}

                  <div className="rounded-2xl bg-[#F5F9F7] p-4">

                    <div className="flex gap-3">

                      <div className="mt-0.5 text-[#497F70]">
                        <Building2
                          size={
                            17
                          }
                        />
                      </div>

                      <div>

                        <p className="text-xs font-bold text-[#35564C]">
                          Sebelum disimpan
                        </p>

                        <p className="mt-1 text-xs leading-5 text-gray-500">
                          Pastikan outlet, supplier, harga, qty, dan metode pembayaran sudah benar.
                        </p>

                      </div>

                    </div>

                  </div>

                  {/* SAVE */}

                  <button
                    type="submit"
                    disabled={
                      saving ||
                      !outletId ||
                      !supplierId ||
                      !purchaseDate ||
                      !paymentMethod ||
                      items.length ===
                        0
                    }
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#497F70] px-5 text-sm font-bold text-white shadow-lg shadow-[#497F70]/20 transition hover:-translate-y-0.5 hover:bg-[#3D6D60] disabled:cursor-not-allowed disabled:opacity-40"
                  >

                    {saving ? (
                      <>
                        <RefreshCw
                          size={
                            17
                          }
                          className="animate-spin"
                        />

                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Save
                          size={
                            17
                          }
                        />

                        Simpan Purchase Outlet
                      </>
                    )}

                  </button>

                  {/* CANCEL */}

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
                    className="h-11 w-full rounded-2xl border border-[#D5E5DC] bg-white text-sm font-bold text-gray-700 transition hover:bg-[#F5F8F6] disabled:opacity-50"
                  >
                    Batal
                  </button>

                </div>
              </div>
            </aside>

          </div>
        </form>
      </div>
    </div>
  );
}