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
    <div
      className="min-h-full bg-[#F3F7F4]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 8% 0%, rgba(111,128,108,0.07), transparent 26%), radial-gradient(circle at 92% 18%, rgba(183,154,99,0.055), transparent 22%)",
      }}
    >
      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <div className="border-b border-[#DDE8E1] bg-[#F8FBF9]">
        <div className="mx-auto max-w-[1600px] px-5 py-6 md:px-8 md:py-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[#173A2F] text-white shadow-[0_12px_28px_rgba(28,40,34,0.12)]">
                  <PackageMinus size={25} strokeWidth={2} />
                </div>

                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#5F8A72]">
                  <ArrowRight size={10} className="text-white" />
                </div>
              </div>

              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#EEF1EA] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#5F8A72]">
                    Inventory
                  </span>

                  <span className="text-xs font-medium text-gray-400">
                    •
                  </span>

                  <span className="text-xs font-medium text-gray-400">
                    Gudang
                  </span>
                </div>

                <h1 className="text-2xl font-semibold tracking-[-0.025em] text-[#173A2F] md:text-3xl">
                  Barang Keluar
                </h1>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
                  Buat transaksi pengeluaran barang dari gudang menuju outlet
                  tujuan secara terkontrol.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-3 rounded-[22px] border border-[#DDE8E1] bg-[#FAF9F6] px-4 py-3 sm:flex">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF1EA] text-[#5F8A72]">
                  <ShoppingCart size={17} />
                </div>

                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                    Keranjang
                  </p>

                  <p className="text-sm font-bold text-[#173A2F]">
                    {cart.length} jenis barang
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-[22px] border border-[#DDE8E1] bg-white px-4 py-3 shadow-[0_8px_30px_rgba(23,58,47,0.055)]">
                <div className="h-2 w-2 rounded-full bg-[#5F8A72]" />

                <span className="text-xs font-semibold text-[#44564A]">
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

        <div className="grid grid-cols-1 overflow-hidden rounded-[22px] border border-[#DDE8E1] bg-white/95 shadow-[0_8px_30px_rgba(23,58,47,0.055)] backdrop-blur-[2px] md:grid-cols-3">
          <div className="relative flex items-center gap-4 border-b border-[#ECE8E0] p-4 md:border-b-0 md:border-r md:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#173A2F] text-sm font-bold text-white">
              01
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#5F8A72]">
                Informasi
              </p>

              <p className="mt-0.5 text-sm font-semibold text-[#173A2F]">
                Tentukan tujuan transaksi
              </p>
            </div>
          </div>

          <div className="relative flex items-center gap-4 border-b border-[#ECE8E0] p-4 md:border-b-0 md:border-r md:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF1EA] text-sm font-bold text-[#5F8A72]">
              02
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#5F8A72]">
                Barang
              </p>

              <p className="mt-0.5 text-sm font-semibold text-[#173A2F]">
                Tambahkan item keluar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 md:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF1EA] text-sm font-bold text-[#5F8A72]">
              03
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#5F8A72]">
                Finalisasi
              </p>

              <p className="mt-0.5 text-sm font-semibold text-[#173A2F]">
                Simpan sebagai draft
              </p>
            </div>
          </div>
        </div>

        {/* =====================================================
            INFORMASI TRANSAKSI
        ===================================================== */}

        <section className="overflow-hidden rounded-[22px] border border-[#DDE8E1] bg-white/95 shadow-[0_8px_30px_rgba(23,58,47,0.055)] backdrop-blur-[2px]">
          <div className="border-b border-[#E7E3DB] px-5 py-5 md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF1EA] text-[#5F8A72]">
                <User size={19} />
              </div>

              <div>
                <h2 className="text-sm font-bold text-[#173A2F]">
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
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#44564A]">
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
                    className="h-12 w-full rounded-xl border border-[#DDD8CE] bg-[#FAF9F6] py-3 pl-11 pr-4 text-sm font-medium text-gray-700 outline-none transition placeholder:text-gray-400 hover:border-[#9DB9A8] focus:border-[#5F8A72] focus:bg-white focus:ring-4 focus:ring-[#5F8A72]/10"
                  />
                </div>

                <p className="mt-2 text-[11px] leading-5 text-gray-400">
                  Tanggal transaksi dapat berbeda dengan tanggal dibuat.
                </p>
              </div>

              {/* CUSTOMER */}

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#44564A]">
                  Customer
                  <span className="ml-1 text-red-500">*</span>
                </label>

                <div className="relative">
                  <User
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <select
                    className="h-12 w-full appearance-none rounded-xl border border-[#DDD8CE] bg-[#FAF9F6] px-4 pl-11 pr-10 text-sm font-medium text-gray-700 outline-none transition hover:border-[#9DB9A8] focus:border-[#5F8A72] focus:bg-white focus:ring-4 focus:ring-[#5F8A72]/10"
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
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[#5F8A72]">
                    <CircleCheck size={12} />
                    Customer terpilih
                  </div>
                )}
              </div>

              {/* OUTLET */}

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#44564A]">
                  Outlet Tujuan
                  <span className="ml-1 text-red-500">*</span>
                </label>

                <div className="relative">
                  <Store
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <select
                    className="h-12 w-full appearance-none rounded-xl border border-[#DDD8CE] bg-[#FAF9F6] px-4 pl-11 pr-10 text-sm font-medium text-gray-700 outline-none transition hover:border-[#9DB9A8] focus:border-[#5F8A72] focus:bg-white focus:ring-4 focus:ring-[#5F8A72]/10"
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
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[#5F8A72]">
                    <CircleCheck size={12} />
                    Outlet tujuan terpilih
                  </div>
                )}
              </div>

              {/* KETERANGAN */}

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#44564A]">
                  Keterangan
                </label>

                <div className="relative">
                  <FileText
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    className="h-12 w-full rounded-xl border border-[#DDD8CE] bg-[#FAF9F6] py-3 pl-11 pr-4 text-sm font-medium text-gray-700 outline-none transition placeholder:text-gray-400 hover:border-[#9DB9A8] focus:border-[#5F8A72] focus:bg-white focus:ring-4 focus:ring-[#5F8A72]/10"
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

        <section className="overflow-hidden rounded-[22px] border border-[#DDE8E1] bg-white/95 shadow-[0_8px_30px_rgba(23,58,47,0.055)] backdrop-blur-[2px]">
          <div className="border-b border-[#E7E3DB] px-5 py-5 md:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF1EA] text-[#5F8A72]">
                  <ScanLine size={19} />
                </div>

                <div>
                  <h2 className="text-sm font-bold text-[#173A2F]">
                    Scan Barcode
                  </h2>

                  <p className="mt-0.5 text-xs text-gray-500">
                    Gunakan scanner barcode atau kamera untuk menambahkan
                    barang.
                  </p>
                </div>
              </div>

              <div className="rounded-full border border-[#DED5C3] bg-[#F8F3E8] px-3 py-1.5 text-[11px] font-semibold text-[#756A55]">
                Fast Entry
              </div>
            </div>
          </div>

          <div className="p-5 md:p-6">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="min-w-0 flex-1 [&_button]:!border-[#9DB9A8] [&_button]:!bg-[#173A2F] [&_button]:!text-white [&_button:hover]:!bg-[#285744] [&_button]:!shadow-none [&_button]:!ring-0">
                <BarcodeInputScanner onScan={scanBarcode} />
              </div>

              <button
                type="button"
                onClick={() => setOpenCamera(true)}
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#86A995] bg-[#E8F1EB] px-6 text-sm font-bold text-[#254D3D] shadow-[0_6px_18px_rgba(82,70,45,0.08)] transition duration-200 hover:border-[#9E8C69] hover:bg-[#DCEAE1] hover:shadow-[0_10px_24px_rgba(82,70,45,0.12)] active:scale-[0.99]"
              >
                <Camera size={18} />
                Scan dengan Kamera
              </button>
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#E5E1D8] bg-[#F5F4F0] p-3.5">
              <ScanLine size={16} className="mt-0.5 shrink-0 text-[#5F8A72]" />

              <p className="text-xs leading-5 text-gray-500">
                Barcode akan dicari langsung ke master barang. Setelah
                ditemukan, Anda dapat menentukan qty sebelum memasukkannya ke
                daftar barang keluar.
              </p>
            </div>

            {openCamera && (
              <div className="mt-5 overflow-hidden rounded-[22px] border border-[#4A584E] bg-[#202A24] shadow-xl">
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

        <section className="overflow-visible rounded-[22px] border border-[#DDE8E1] bg-white shadow-[0_8px_30px_rgba(23,58,47,0.055)]">
          <div className="border-b border-[#E7E3DB] px-5 py-5 md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF1EA] text-[#5F8A72]">
                <Boxes size={19} />
              </div>

              <div>
                <h2 className="text-sm font-bold text-[#173A2F]">
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
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#44564A]">
                  Cari Barang
                </label>

                <div className="relative">
                  <Search
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    className="h-12 w-full rounded-xl border border-[#DDD8CE] bg-[#FAF9F6] py-3 pl-11 pr-10 text-sm font-medium outline-none transition placeholder:text-gray-400 hover:border-[#9DB9A8] focus:border-[#5F8A72] focus:bg-white focus:ring-4 focus:ring-[#5F8A72]/10"
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
                  <div className="absolute left-0 right-0 z-40 mt-2 max-h-80 overflow-y-auto rounded-[22px] border border-[#DDE8E1] bg-white shadow-2xl shadow-black/5">
                    <div className="sticky top-0 border-b border-[#ECE8E0] bg-white px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          Hasil Pencarian
                        </span>

                        <span className="rounded-full bg-[#EEF1EA] px-2 py-1 text-[10px] font-bold text-[#5F8A72]">
                          {filteredBarang.length} hasil
                        </span>
                      </div>
                    </div>

                    {loadingBarang ? (
                      <div className="flex items-center justify-center gap-2 p-7 text-sm text-gray-500">
                        <RefreshCw
                          size={16}
                          className="animate-spin text-[#5F8A72]"
                        />
                        Memuat barang...
                      </div>
                    ) : filteredBarang.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F3F1EB] text-gray-300">
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
                            className="group w-full border-b border-[#EEEAE2] p-4 text-left transition last:border-0 hover:bg-[#F5F4F0]"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0EEE7] text-[#5F8A72] transition group-hover:bg-[#EEF1EA]">
                                <PackageMinus size={17} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-[#173A2F]">
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
                                        : "bg-[#EEF1EA] text-[#5F8A72]"
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
                                    <b className="text-[#44564A]">
                                      {b.unit || "-"}
                                    </b>
                                  </span>

                                  <span>
                                    Harga:{" "}
                                    <b className="text-[#44564A]">
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
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#44564A]">
                  Qty
                </label>

                <input
                  type="number"
                  min="1"
                  className="h-12 w-full rounded-xl border border-[#DDD8CE] bg-[#FAF9F6] px-4 text-sm font-semibold outline-none transition placeholder:text-gray-400 hover:border-[#9DB9A8] focus:border-[#5F8A72] focus:bg-white focus:ring-4 focus:ring-[#5F8A72]/10"
                  placeholder="0"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </div>

              <button
                type="button"
                onClick={tambahManual}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#173A2F] px-7 text-sm font-bold text-white shadow-[0_8px_30px_rgba(23,58,47,0.055)] transition hover:bg-[#285744] hover:shadow-md active:scale-[0.99]"
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

        <section className="overflow-hidden rounded-[22px] border border-[#DDE8E1] bg-white/95 shadow-[0_8px_30px_rgba(23,58,47,0.055)] backdrop-blur-[2px]">
          <div className="border-b border-[#E7E3DB] px-5 py-5 md:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#173A2F] text-white">
                  <ShoppingCart size={18} />
                </div>

                <div>
                  <h2 className="text-sm font-bold text-[#173A2F]">
                    Daftar Barang Keluar
                  </h2>

                  <p className="mt-0.5 text-xs text-gray-500">
                    Review item sebelum transaksi disimpan.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="rounded-full border border-[#DED5C3] bg-[#F8F3E8] px-3 py-1.5 text-[11px] font-semibold text-[#756A55]">
                  {formatNumber(totalQty)} Qty
                </div>

                <div className="rounded-full bg-[#EEF1EA] px-3 py-1.5 text-[11px] font-bold text-[#5F8A72]">
                  {cart.length} Item
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-[#F6F4EF]">
                <tr className="border-b border-[#E7E3DB]">
                  <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#657167]">
                    Barang
                  </th>

                  <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-[#657167]">
                    Stock
                  </th>

                  <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-[#657167]">
                    Qty
                  </th>

                  <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-[#657167]">
                    Harga
                  </th>

                  <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-[#657167]">
                    Total
                  </th>

                  <th className="px-6 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-[#657167]">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF1EA] text-[#5F8A72]">
                          <ShoppingCart size={27} />
                        </div>

                        <p className="text-sm font-bold text-[#173A2F]">
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
                      className="group border-b border-[#EEEAE2] transition hover:bg-[#FCFAF6]"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F1EFE9] text-[#5F8A72]">
                            <PackageMinus size={17} />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-bold text-[#173A2F]">
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
                        <span className="inline-flex min-w-[64px] justify-center rounded-lg bg-[#EEF1EA] px-3 py-1.5 text-xs font-bold text-[#5F8A72]">
                          {formatNumber(item.stock)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex min-w-[50px] justify-center rounded-lg bg-[#F3F7F4] px-3 py-1.5 text-xs font-bold text-[#173A2F]">
                          {formatNumber(item.qty)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right text-xs font-medium text-gray-500">
                        Rp {formatNumber(item.price)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <p className="text-sm font-bold text-[#173A2F]">
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
          <div className="rounded-[22px] border border-[#DDE8E1] bg-white p-5 shadow-[0_8px_30px_rgba(23,58,47,0.055)] md:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF1EA] text-[#5F8A72]">
                <ReceiptText size={19} />
              </div>

              <div>
                <h2 className="text-sm font-bold text-[#173A2F]">
                  Ringkasan Transaksi
                </h2>

                <p className="mt-0.5 text-xs text-gray-500">
                  Informasi jumlah barang yang akan dikeluarkan.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-[22px] border border-[#E7E3DB] bg-[#F7F5F0] p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Total Jenis Barang
                  </p>

                  <Boxes size={17} className="text-[#5F8A72]" />
                </div>

                <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#173A2F]">
                  {formatNumber(cart.length)}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  jenis item berbeda
                </p>
              </div>

              <div className="rounded-[22px] border border-[#E7E3DB] bg-[#F7F5F0] p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Total Quantity
                  </p>

                  <PackageMinus size={17} className="text-[#5F8A72]" />
                </div>

                <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#173A2F]">
                  {formatNumber(totalQty)}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  total unit barang keluar
                </p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[22px] bg-[#173A2F] p-6 text-white shadow-[0_18px_45px_rgba(28,40,34,0.16)]">
            <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/5" />
            <div className="absolute -bottom-20 -left-16 h-44 w-44 rounded-full bg-[#5F8A72]/20" />

            <div className="relative">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
                    Grand Total
                  </p>

                  <p className="mt-2 text-3xl font-semibold tracking-[-0.03em]">
                    Rp {formatNumber(totalNominal)}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-[22px] bg-white/10">
                  <Warehouse size={20} className="text-[#C9D2C5]" />
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
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 font-semibold text-[#D8DFD3]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#8BC4B2]" />
                    Draft
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={simpan}
                disabled={saving || cart.length === 0}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#D8C9A8] bg-[#E8F1EB] px-5 py-3.5 text-sm font-bold text-[#254D3D] shadow-[0_8px_24px_rgba(82,70,45,0.10)] transition hover:border-[#BBAA86] hover:bg-[#DCEAE1] hover:shadow-[0_12px_28px_rgba(82,70,45,0.14)] disabled:cursor-not-allowed disabled:opacity-40"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141B17]/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[22px] border border-[#DDE8E1] bg-white shadow-2xl">
            <div className="border-b border-[#E7E3DB] px-5 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF1EA] text-[#5F8A72]">
                    <ScanLine size={19} />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-[#173A2F]">
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
              <div className="overflow-hidden rounded-[22px] border border-[#E5E1D8]">
                <div className="border-b border-[#ECE8E0] bg-[#F5F4F0] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <PackageMinus size={15} className="text-[#5F8A72]" />

                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F8A72]">
                      Detail Barang
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-[#EDF2EF]">
                  <div className="flex justify-between gap-4 px-4 py-3.5">
                    <span className="text-xs text-gray-400">Kode</span>

                    <span className="text-right text-xs font-bold text-[#173A2F]">
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

                    <span className="max-w-[230px] text-right text-xs font-bold text-[#173A2F]">
                      {scanBarang.name || "-"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4 px-4 py-3.5">
                    <span className="text-xs text-gray-400">Stock Tersedia</span>

                    <span className="text-right text-xs font-bold text-[#5F8A72]">
                      {formatNumber(scanBarang.stock)}{" "}
                      {scanBarang.unit}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#44564A]">
                  Qty Keluar
                </label>

                <input
                  type="number"
                  min="1"
                  className="h-12 w-full rounded-xl border border-[#DDD8CE] bg-[#FAF9F6] px-4 text-sm font-semibold outline-none transition focus:border-[#5F8A72] focus:bg-white focus:ring-4 focus:ring-[#5F8A72]/10"
                  value={scanQty}
                  onChange={(e) => setScanQty(e.target.value)}
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setScanBarang(null)}
                  className="rounded-xl border border-[#DDD8CE] bg-white px-4 py-3 text-sm font-bold text-gray-600 transition hover:bg-[#F3F1EB]"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={tambahDariScan}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5F8A72] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#285744]"
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