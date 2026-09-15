"use client";

import { useEffect, useMemo, useState } from "react";

import {
  PackageMinus,
  Search,
  Plus,
  Trash2,
  Camera,
  RefreshCw,
  ShoppingCart,
  User,
  FileText,
  ScanLine,
  X,
  Store,
  CalendarDays,
  Boxes,
  ArrowRight,
  CircleCheck,
  ReceiptText,
  Warehouse,
} from "lucide-react";

import BarcodeInputScanner from "@/components/BarcodeInputScanner";
import CameraBarcodeScanner from "@/components/CameraBarcodeScanner";

export default function BarangKeluarPage() {
  const [barang, setBarang] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);

  const [customer, setCustomer] = useState("");
  const [outlet, setOutlet] = useState("");
  const [note, setNote] = useState("");

  function getTodayDate() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  const [deliveryDate, setDeliveryDate] = useState("");

  const [searchBarang, setSearchBarang] = useState("");
  const [showBarang, setShowBarang] = useState(false);
  const [selectedBarang, setSelectedBarang] = useState<any>(null);
  const [qty, setQty] = useState("");

  const [openCamera, setOpenCamera] = useState(false);

  const [scanBarang, setScanBarang] = useState<any>(null);
  const [scanQty, setScanQty] = useState("1");

  const [loadingBarang, setLoadingBarang] = useState(false);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [loadingOutlet, setLoadingOutlet] = useState(false);
  const [saving, setSaving] = useState(false);

  // =========================================================
  // INITIAL DATE
  // =========================================================

  useEffect(() => {
    setDeliveryDate(getTodayDate());
  }, []);

  // =========================================================
  // LOAD BARANG
  // =========================================================

  async function loadBarang() {
    try {
      setLoadingBarang(true);

      const res = await fetch("/api/barang", {
        cache: "no-store",
      });

      const json = await res.json();

      setBarang(Array.isArray(json) ? json : json.data || []);
    } catch (error) {
      console.error("LOAD BARANG ERROR:", error);
      setBarang([]);
    } finally {
      setLoadingBarang(false);
    }
  }

  // =========================================================
  // LOAD CUSTOMER
  // =========================================================

  async function loadCustomer() {
    try {
      setLoadingCustomer(true);

      const res = await fetch("/api/customer", {
        cache: "no-store",
      });

      const json = await res.json();

      setCustomers(Array.isArray(json) ? json : json.data || []);
    } catch (error) {
      console.error("LOAD CUSTOMER ERROR:", error);
      setCustomers([]);
    } finally {
      setLoadingCustomer(false);
    }
  }

  // =========================================================
  // LOAD OUTLET
  // =========================================================

  async function loadOutlet() {
    try {
      setLoadingOutlet(true);

      const res = await fetch("/api/outlet", {
        cache: "no-store",
      });

      const json = await res.json();

      setOutlets(Array.isArray(json) ? json : json.data || []);
    } catch (error) {
      console.error("LOAD OUTLET ERROR:", error);
      setOutlets([]);
    } finally {
      setLoadingOutlet(false);
    }
  }

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadBarang();
    loadCustomer();
    loadOutlet();
  }, []);

  // =========================================================
  // FILTER BARANG
  // =========================================================

  const filteredBarang = useMemo(() => {
    return barang
      .filter((b) => {
        const text =
          `${b.code ?? ""} ${b.name ?? ""} ${b.barcode ?? ""}`.toLowerCase();

        return text.includes(searchBarang.toLowerCase());
      })
      .slice(0, 20);
  }, [barang, searchBarang]);

  // =========================================================
  // PILIH BARANG
  // =========================================================

  function pilihBarang(data: any) {
    setSelectedBarang(data);
    setSearchBarang(`${data.code} - ${data.name}`);
    setShowBarang(false);
  }

  // =========================================================
  // TAMBAH KE CART
  // =========================================================

  function tambahKeCart(data: any, jumlah: number) {
    if (!jumlah || jumlah <= 0) {
      alert("Qty tidak valid");
      return false;
    }

    if (Number(data.stock) <= 0) {
      alert(`Stock ${data.name} sudah habis`);
      return false;
    }

    if (jumlah > Number(data.stock)) {
      alert(`Stock ${data.name} hanya ${data.stock}`);
      return false;
    }

    let berhasil = true;

    setCart((prev) => {
      const exist = prev.find((x) => x.barangId === data.id);

      if (exist) {
        const newQty = Number(exist.qty) + jumlah;

        if (newQty > Number(data.stock)) {
          alert(`Qty ${data.name} melebihi stock`);
          berhasil = false;
          return prev;
        }

        return prev.map((x) => {
          if (x.barangId === data.id) {
            return {
              ...x,
              qty: newQty,
              subtotal: newQty * Number(x.price || 0),
            };
          }

          return x;
        });
      }

      const price = Number(data.purchasePrice ?? 0);

      return [
        ...prev,
        {
          barangId: data.id,
          code: data.code,
          barcode: data.barcode,
          name: data.name,
          unit: data.unit,
          stock: Number(data.stock ?? 0),
          qty: jumlah,
          price,
          subtotal: price * jumlah,
        },
      ];
    });

    return berhasil;
  }

  // =========================================================
  // TAMBAH MANUAL
  // =========================================================

  function tambahManual() {
    if (!selectedBarang) {
      alert("Pilih barang terlebih dahulu");
      return;
    }

    const jumlah = Number(qty);

    const berhasil = tambahKeCart(selectedBarang, jumlah);

    if (berhasil) {
      setSelectedBarang(null);
      setSearchBarang("");
      setQty("");
    }
  }

  // =========================================================
  // SCAN BARCODE
  // =========================================================

  async function scanBarcode(barcode: string) {
    try {
      const cleanBarcode = barcode.trim();

      if (!cleanBarcode) {
        return;
      }

      const res = await fetch(
        `/api/barang/barcode/${encodeURIComponent(cleanBarcode)}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!json.success) {
        alert(json.message || "Barcode tidak ditemukan");
        return;
      }

      setScanBarang(json.data);
      setScanQty("1");
    } catch (error) {
      console.error("SCAN BARCODE ERROR:", error);
      alert("Barcode gagal diproses");
    }
  }

  // =========================================================
  // TAMBAH DARI SCAN
  // =========================================================

  function tambahDariScan() {
    if (!scanBarang) {
      return;
    }

    const jumlah = Number(scanQty);

    const berhasil = tambahKeCart(scanBarang, jumlah);

    if (berhasil) {
      setScanBarang(null);
      setScanQty("1");
    }
  }

  // =========================================================
  // HAPUS CART
  // =========================================================

  function hapus(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  // =========================================================
  // SIMPAN BARANG KELUAR
  // =========================================================

  async function simpan() {
    if (!deliveryDate) {
      alert("Tanggal barang keluar wajib diisi");
      return;
    }

    if (!customer) {
      alert("Pilih customer terlebih dahulu");
      return;
    }

    if (!outlet) {
      alert("Pilih outlet tujuan terlebih dahulu");
      return;
    }

    if (cart.length === 0) {
      alert("Belum ada barang");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/barang-keluar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: Number(customer),
          outletId: Number(outlet),
          note,
          deliveryDate,
          items: cart.map((item) => ({
            barangId: item.barangId,
            qty: Number(item.qty),
          })),
        }),
      });

      const json = await res.json();

      if (json.success) {
        alert(
          `Barang keluar ${json.data?.number || ""} berhasil disimpan sebagai DRAFT`
        );

        setCart([]);
        setCustomer("");
        setOutlet("");
        setNote("");
        setDeliveryDate(getTodayDate());

        await loadBarang();
      } else {
        alert(json.message || "Gagal menyimpan barang keluar");
      }
    } catch (error) {
      console.error("SIMPAN BARANG KELUAR ERROR:", error);
      alert("Terjadi kesalahan saat menyimpan barang keluar");
    } finally {
      setSaving(false);
    }
  }

  // =========================================================
  // TOTAL
  // =========================================================

  const totalQty = cart.reduce(
    (total, item) => total + Number(item.qty || 0),
    0
  );

  const totalNominal = cart.reduce(
    (total, item) => total + Number(item.subtotal || 0),
    0
  );

  // =========================================================
  // FORMAT NUMBER
  // =========================================================

  function formatNumber(value: any) {
    return Number(value ?? 0).toLocaleString("id-ID");
  }

  const selectedCustomer = customers.find(
    (item) => String(item.id) === String(customer)
  );

  const selectedOutlet = outlets.find(
    (item) => String(item.id) === String(outlet)
  );

  return (
    <div className="min-h-full bg-[#F4F7F5]">
      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <div className="border-b border-[#DCE7E2] bg-white">
        <div className="mx-auto max-w-[1600px] px-5 py-6 md:px-8 md:py-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#18352D] text-white shadow-lg shadow-[#18352D]/10">
                  <PackageMinus size={25} strokeWidth={2} />
                </div>

                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#497F70]">
                  <ArrowRight size={10} className="text-white" />
                </div>
              </div>

              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#EAF3EF] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#497F70]">
                    Inventory
                  </span>

                  <span className="text-xs font-medium text-gray-400">
                    •
                  </span>

                  <span className="text-xs font-medium text-gray-400">
                    Gudang
                  </span>
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
                  Barang Keluar
                </h1>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
                  Buat transaksi pengeluaran barang dari gudang menuju outlet
                  tujuan secara terkontrol.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-3 rounded-2xl border border-[#DCE7E2] bg-[#FAFCFB] px-4 py-3 sm:flex">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                  <ShoppingCart size={17} />
                </div>

                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                    Keranjang
                  </p>

                  <p className="text-sm font-bold text-[#18352D]">
                    {cart.length} jenis barang
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-[#DCE7E2] bg-white px-4 py-3 shadow-sm">
                <div className="h-2 w-2 rounded-full bg-[#497F70]" />

                <span className="text-xs font-semibold text-[#35564C]">
                  Draft Transaksi
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] space-y-6 px-5 py-6 md:px-8 md:py-8">
        {/* =====================================================
            TRANSACTION FLOW
        ===================================================== */}

        <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-[#DCE7E2] bg-white shadow-sm md:grid-cols-3">
          <div className="relative flex items-center gap-4 border-b border-[#E8EFEC] p-4 md:border-b-0 md:border-r md:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#18352D] text-sm font-bold text-white">
              01
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#497F70]">
                Informasi
              </p>

              <p className="mt-0.5 text-sm font-semibold text-[#18352D]">
                Tentukan tujuan transaksi
              </p>
            </div>
          </div>

          <div className="relative flex items-center gap-4 border-b border-[#E8EFEC] p-4 md:border-b-0 md:border-r md:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-sm font-bold text-[#497F70]">
              02
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#497F70]">
                Barang
              </p>

              <p className="mt-0.5 text-sm font-semibold text-[#18352D]">
                Tambahkan item keluar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 md:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-sm font-bold text-[#497F70]">
              03
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#497F70]">
                Finalisasi
              </p>

              <p className="mt-0.5 text-sm font-semibold text-[#18352D]">
                Simpan sebagai draft
              </p>
            </div>
          </div>
        </div>

        {/* =====================================================
            INFORMASI TRANSAKSI
        ===================================================== */}

        <section className="overflow-hidden rounded-2xl border border-[#DCE7E2] bg-white shadow-sm">
          <div className="border-b border-[#E5ECE9] px-5 py-5 md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                <User size={19} />
              </div>

              <div>
                <h2 className="text-sm font-bold text-[#18352D]">
                  Informasi Pengeluaran
                </h2>

                <p className="mt-0.5 text-xs text-gray-500">
                  Tentukan tanggal, customer, outlet tujuan dan keterangan
                  transaksi.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 md:p-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              {/* TANGGAL */}

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#35564C]">
                  Tanggal Barang Keluar
                  <span className="ml-1 text-red-500">*</span>
                </label>

                <div className="relative">
                  <CalendarDays
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="h-12 w-full rounded-xl border border-[#D5E2DD] bg-[#FAFCFB] py-3 pl-11 pr-4 text-sm font-medium text-gray-700 outline-none transition placeholder:text-gray-400 hover:border-[#BFD2C9] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                  />
                </div>

                <p className="mt-2 text-[11px] leading-5 text-gray-400">
                  Tanggal transaksi dapat berbeda dengan tanggal dibuat.
                </p>
              </div>

              {/* CUSTOMER */}

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#35564C]">
                  Customer
                  <span className="ml-1 text-red-500">*</span>
                </label>

                <div className="relative">
                  <User
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <select
                    className="h-12 w-full appearance-none rounded-xl border border-[#D5E2DD] bg-[#FAFCFB] px-4 pl-11 pr-10 text-sm font-medium text-gray-700 outline-none transition hover:border-[#BFD2C9] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                  >
                    <option value="">
                      {loadingCustomer
                        ? "Memuat customer..."
                        : "-- Pilih Customer --"}
                    </option>

                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code ? `${c.code} - ` : ""}
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCustomer && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[#497F70]">
                    <CircleCheck size={12} />
                    Customer terpilih
                  </div>
                )}
              </div>

              {/* OUTLET */}

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#35564C]">
                  Outlet Tujuan
                  <span className="ml-1 text-red-500">*</span>
                </label>

                <div className="relative">
                  <Store
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <select
                    className="h-12 w-full appearance-none rounded-xl border border-[#D5E2DD] bg-[#FAFCFB] px-4 pl-11 pr-10 text-sm font-medium text-gray-700 outline-none transition hover:border-[#BFD2C9] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                    value={outlet}
                    onChange={(e) => setOutlet(e.target.value)}
                  >
                    <option value="">
                      {loadingOutlet
                        ? "Memuat outlet..."
                        : "-- Pilih Outlet Tujuan --"}
                    </option>

                    {outlets
                      .filter((o) => o.active !== false)
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.code ? `${o.code} - ` : ""}
                          {o.name}
                        </option>
                      ))}
                  </select>
                </div>

                {selectedOutlet && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[#497F70]">
                    <CircleCheck size={12} />
                    Outlet tujuan terpilih
                  </div>
                )}
              </div>

              {/* KETERANGAN */}

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#35564C]">
                  Keterangan
                </label>

                <div className="relative">
                  <FileText
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    className="h-12 w-full rounded-xl border border-[#D5E2DD] bg-[#FAFCFB] py-3 pl-11 pr-4 text-sm font-medium text-gray-700 outline-none transition placeholder:text-gray-400 hover:border-[#BFD2C9] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                    placeholder="Contoh: Pengiriman ke outlet..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>

                <p className="mt-2 text-[11px] text-gray-400">
                  Opsional untuk referensi transaksi.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================
            SCANNER
        ===================================================== */}

        <section className="overflow-hidden rounded-2xl border border-[#DCE7E2] bg-white shadow-sm">
          <div className="border-b border-[#E5ECE9] px-5 py-5 md:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                  <ScanLine size={19} />
                </div>

                <div>
                  <h2 className="text-sm font-bold text-[#18352D]">
                    Scan Barcode
                  </h2>

                  <p className="mt-0.5 text-xs text-gray-500">
                    Gunakan scanner barcode atau kamera untuk menambahkan
                    barang.
                  </p>
                </div>
              </div>

              <div className="rounded-full border border-[#DCE7E2] bg-[#FAFCFB] px-3 py-1.5 text-[11px] font-semibold text-gray-500">
                Fast Entry
              </div>
            </div>
          </div>

          <div className="p-5 md:p-6">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="min-w-0 flex-1">
                <BarcodeInputScanner onScan={scanBarcode} />
              </div>

              <button
                type="button"
                onClick={() => setOpenCamera(true)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#18352D] px-6 text-sm font-bold text-white shadow-sm transition hover:bg-[#24483E] hover:shadow-md active:scale-[0.99]"
              >
                <Camera size={18} />
                Scan dengan Kamera
              </button>
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#E2ECE7] bg-[#F7FAF8] p-3.5">
              <ScanLine size={16} className="mt-0.5 shrink-0 text-[#497F70]" />

              <p className="text-xs leading-5 text-gray-500">
                Barcode akan dicari langsung ke master barang. Setelah
                ditemukan, Anda dapat menentukan qty sebelum memasukkannya ke
                daftar barang keluar.
              </p>
            </div>

            {openCamera && (
              <div className="mt-5 overflow-hidden rounded-2xl border border-[#29483F] bg-[#102A23] shadow-xl">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white">
                      <Camera size={17} />
                    </div>

                    <div>
                      <p className="text-sm font-bold text-white">
                        Scanner Kamera
                      </p>

                      <p className="mt-0.5 text-xs text-white/50">
                        Arahkan kamera ke barcode barang
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpenCamera(false)}
                    className="rounded-xl p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="p-4">
                  <CameraBarcodeScanner
                    onScan={(barcode) => {
                      setOpenCamera(false);
                      scanBarcode(barcode);
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => setOpenCamera(false)}
                    className="mt-3 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Tutup Kamera
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* =====================================================
            TAMBAH BARANG
        ===================================================== */}

        <section className="overflow-visible rounded-2xl border border-[#DCE7E2] bg-white shadow-sm">
          <div className="border-b border-[#E5ECE9] px-5 py-5 md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                <Boxes size={19} />
              </div>

              <div>
                <h2 className="text-sm font-bold text-[#18352D]">
                  Tambah Barang
                </h2>

                <p className="mt-0.5 text-xs text-gray-500">
                  Cari berdasarkan kode, nama, atau barcode.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="relative min-w-0 flex-1">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#35564C]">
                  Cari Barang
                </label>

                <div className="relative">
                  <Search
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    className="h-12 w-full rounded-xl border border-[#D5E2DD] bg-[#FAFCFB] py-3 pl-11 pr-10 text-sm font-medium outline-none transition placeholder:text-gray-400 hover:border-[#BFD2C9] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                    placeholder="Ketik kode, nama, atau barcode..."
                    value={searchBarang}
                    onFocus={() => setShowBarang(true)}
                    onChange={(e) => {
                      setSearchBarang(e.target.value);
                      setShowBarang(true);
                      setSelectedBarang(null);
                    }}
                  />

                  {searchBarang && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchBarang("");
                        setSelectedBarang(null);
                        setShowBarang(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                {showBarang && searchBarang && (
                  <div className="absolute left-0 right-0 z-40 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-[#DCE7E2] bg-white shadow-2xl shadow-[#18352D]/10">
                    <div className="sticky top-0 border-b border-[#E8EFEC] bg-white px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          Hasil Pencarian
                        </span>

                        <span className="rounded-full bg-[#EAF3EF] px-2 py-1 text-[10px] font-bold text-[#497F70]">
                          {filteredBarang.length} hasil
                        </span>
                      </div>
                    </div>

                    {loadingBarang ? (
                      <div className="flex items-center justify-center gap-2 p-7 text-sm text-gray-500">
                        <RefreshCw
                          size={16}
                          className="animate-spin text-[#497F70]"
                        />
                        Memuat barang...
                      </div>
                    ) : filteredBarang.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5F8F6] text-gray-300">
                          <PackageMinus size={23} />
                        </div>

                        <p className="text-sm font-bold text-gray-600">
                          Barang tidak ditemukan
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          Coba gunakan kode, nama, atau barcode lain.
                        </p>
                      </div>
                    ) : (
                      filteredBarang.map((b) => {
                        const stockValue = Number(b.stock ?? 0);
                        const stockEmpty = stockValue <= 0;

                        return (
                          <button
                            type="button"
                            key={b.id}
                            onClick={() => pilihBarang(b)}
                            className="group w-full border-b border-[#EDF2EF] p-4 text-left transition last:border-0 hover:bg-[#F7FAF8]"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0F5F2] text-[#497F70] transition group-hover:bg-[#EAF3EF]">
                                <PackageMinus size={17} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-[#18352D]">
                                      {b.code} - {b.name}
                                    </p>

                                    {b.barcode && (
                                      <p className="mt-1 truncate text-[11px] text-gray-400">
                                        Barcode: {b.barcode}
                                      </p>
                                    )}
                                  </div>

                                  <span
                                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                      stockEmpty
                                        ? "bg-red-50 text-red-500"
                                        : "bg-[#EAF3EF] text-[#497F70]"
                                    }`}
                                  >
                                    {stockEmpty
                                      ? "HABIS"
                                      : `STOCK ${formatNumber(stockValue)}`}
                                  </span>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
                                  <span>
                                    Satuan:{" "}
                                    <b className="text-[#35564C]">
                                      {b.unit || "-"}
                                    </b>
                                  </span>

                                  <span>
                                    Harga:{" "}
                                    <b className="text-[#35564C]">
                                      Rp {formatNumber(b.purchasePrice)}
                                    </b>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              <div className="w-full lg:w-36">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#35564C]">
                  Qty
                </label>

                <input
                  type="number"
                  min="1"
                  className="h-12 w-full rounded-xl border border-[#D5E2DD] bg-[#FAFCFB] px-4 text-sm font-semibold outline-none transition placeholder:text-gray-400 hover:border-[#BFD2C9] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                  placeholder="0"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </div>

              <button
                type="button"
                onClick={tambahManual}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#497F70] px-7 text-sm font-bold text-white shadow-sm transition hover:bg-[#3D6D60] hover:shadow-md active:scale-[0.99]"
              >
                <Plus size={18} />
                Tambah Barang
              </button>
            </div>
          </div>
        </section>

        {/* =====================================================
            CART
        ===================================================== */}

        <section className="overflow-hidden rounded-2xl border border-[#DCE7E2] bg-white shadow-sm">
          <div className="border-b border-[#E5ECE9] px-5 py-5 md:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#18352D] text-white">
                  <ShoppingCart size={18} />
                </div>

                <div>
                  <h2 className="text-sm font-bold text-[#18352D]">
                    Daftar Barang Keluar
                  </h2>

                  <p className="mt-0.5 text-xs text-gray-500">
                    Review item sebelum transaksi disimpan.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="rounded-full border border-[#DCE7E2] bg-[#FAFCFB] px-3 py-1.5 text-[11px] font-semibold text-gray-500">
                  {formatNumber(totalQty)} Qty
                </div>

                <div className="rounded-full bg-[#EAF3EF] px-3 py-1.5 text-[11px] font-bold text-[#497F70]">
                  {cart.length} Item
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-[#F7F9F8]">
                <tr className="border-b border-[#E5ECE9]">
                  <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#5C746B]">
                    Barang
                  </th>

                  <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-[#5C746B]">
                    Stock
                  </th>

                  <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-[#5C746B]">
                    Qty
                  </th>

                  <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-[#5C746B]">
                    Harga
                  </th>

                  <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-[#5C746B]">
                    Total
                  </th>

                  <th className="px-6 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-[#5C746B]">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
                          <ShoppingCart size={27} />
                        </div>

                        <p className="text-sm font-bold text-[#18352D]">
                          Keranjang masih kosong
                        </p>

                        <p className="mt-1.5 text-xs leading-5 text-gray-400">
                          Tambahkan barang menggunakan pencarian manual atau
                          scanner barcode.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  cart.map((item, index) => (
                    <tr
                      key={`${item.barangId}-${index}`}
                      className="group border-b border-[#EDF2EF] transition hover:bg-[#FBFDFC]"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F2F6F4] text-[#497F70]">
                            <PackageMinus size={17} />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-bold text-[#18352D]">
                              {item.name}
                            </p>

                            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-gray-400">
                              <span>{item.code}</span>

                              {item.barcode && (
                                <>
                                  <span>•</span>
                                  <span>{item.barcode}</span>
                                </>
                              )}

                              <span>•</span>

                              <span>{item.unit}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex min-w-[64px] justify-center rounded-lg bg-[#EAF3EF] px-3 py-1.5 text-xs font-bold text-[#497F70]">
                          {formatNumber(item.stock)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex min-w-[50px] justify-center rounded-lg bg-[#F4F7F5] px-3 py-1.5 text-xs font-bold text-[#18352D]">
                          {formatNumber(item.qty)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right text-xs font-medium text-gray-500">
                        Rp {formatNumber(item.price)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <p className="text-sm font-bold text-[#18352D]">
                          Rp {formatNumber(item.subtotal)}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => hapus(index)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-500 transition hover:border-red-200 hover:bg-red-100"
                          title="Hapus barang"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* =====================================================
            SUMMARY
        ===================================================== */}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
          <div className="rounded-2xl border border-[#DCE7E2] bg-white p-5 shadow-sm md:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                <ReceiptText size={19} />
              </div>

              <div>
                <h2 className="text-sm font-bold text-[#18352D]">
                  Ringkasan Transaksi
                </h2>

                <p className="mt-0.5 text-xs text-gray-500">
                  Informasi jumlah barang yang akan dikeluarkan.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#E5ECE9] bg-[#F8FAF9] p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Total Jenis Barang
                  </p>

                  <Boxes size={17} className="text-[#497F70]" />
                </div>

                <p className="mt-3 text-3xl font-bold tracking-tight text-[#18352D]">
                  {formatNumber(cart.length)}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  jenis item berbeda
                </p>
              </div>

              <div className="rounded-2xl border border-[#E5ECE9] bg-[#F8FAF9] p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Total Quantity
                  </p>

                  <PackageMinus size={17} className="text-[#497F70]" />
                </div>

                <p className="mt-3 text-3xl font-bold tracking-tight text-[#18352D]">
                  {formatNumber(totalQty)}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  total unit barang keluar
                </p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-[#18352D] p-6 text-white shadow-xl shadow-[#18352D]/10">
            <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/5" />
            <div className="absolute -bottom-20 -left-16 h-44 w-44 rounded-full bg-[#497F70]/20" />

            <div className="relative">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
                    Grand Total
                  </p>

                  <p className="mt-2 text-3xl font-bold tracking-tight">
                    Rp {formatNumber(totalNominal)}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                  <Warehouse size={20} className="text-[#B9D8CD]" />
                </div>
              </div>

              <div className="mb-5 h-px bg-white/10" />

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-white/50">Jenis barang</span>
                  <span className="font-semibold text-white">
                    {formatNumber(cart.length)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-white/50">Total qty</span>
                  <span className="font-semibold text-white">
                    {formatNumber(totalQty)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-white/50">Status</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 font-semibold text-[#CFE5DD]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#8BC4B2]" />
                    Draft
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={simpan}
                disabled={saving || cart.length === 0}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-[#18352D] shadow-sm transition hover:bg-[#F1F6F3] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? (
                  <>
                    <RefreshCw size={17} className="animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <PackageMinus size={17} />
                    Simpan Barang Keluar
                  </>
                )}
              </button>

              <p className="mt-3 text-center text-[10px] leading-4 text-white/35">
                Transaksi akan disimpan sebagai DRAFT setelah validasi berhasil.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          SCAN RESULT MODAL
      ===================================================== */}

      {scanBarang && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071A15]/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#DCE7E2] bg-white shadow-2xl">
            <div className="border-b border-[#E5ECE9] px-5 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                    <ScanLine size={19} />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-[#18352D]">
                      Barang Ditemukan
                    </p>

                    <p className="mt-0.5 text-xs text-gray-500">
                      Konfirmasi quantity barang
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setScanBarang(null)}
                  className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-5">
              <div className="overflow-hidden rounded-2xl border border-[#E2ECE7]">
                <div className="border-b border-[#E8EFEC] bg-[#F7FAF8] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <PackageMinus size={15} className="text-[#497F70]" />

                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#497F70]">
                      Detail Barang
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-[#EDF2EF]">
                  <div className="flex justify-between gap-4 px-4 py-3.5">
                    <span className="text-xs text-gray-400">Kode</span>

                    <span className="text-right text-xs font-bold text-[#18352D]">
                      {scanBarang.code || "-"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4 px-4 py-3.5">
                    <span className="text-xs text-gray-400">Barcode</span>

                    <span className="text-right text-xs font-medium text-gray-600">
                      {scanBarang.barcode || "-"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4 px-4 py-3.5">
                    <span className="text-xs text-gray-400">Nama</span>

                    <span className="max-w-[230px] text-right text-xs font-bold text-[#18352D]">
                      {scanBarang.name || "-"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4 px-4 py-3.5">
                    <span className="text-xs text-gray-400">Stock Tersedia</span>

                    <span className="text-right text-xs font-bold text-[#497F70]">
                      {formatNumber(scanBarang.stock)}{" "}
                      {scanBarang.unit}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#35564C]">
                  Qty Keluar
                </label>

                <input
                  type="number"
                  min="1"
                  className="h-12 w-full rounded-xl border border-[#D5E2DD] bg-[#FAFCFB] px-4 text-sm font-semibold outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                  value={scanQty}
                  onChange={(e) => setScanQty(e.target.value)}
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setScanBarang(null)}
                  className="rounded-xl border border-[#D5E2DD] bg-white px-4 py-3 text-sm font-bold text-gray-600 transition hover:bg-[#F5F8F6]"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={tambahDariScan}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#497F70] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#3D6D60]"
                >
                  <Plus size={17} />
                  Tambahkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}