"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";

import BarcodeInputScanner from "@/components/BarcodeInputScanner";
import CameraBarcodeScanner from "@/components/CameraBarcodeScanner";

export default function BarangKeluarPage() {
  const [barang, setBarang] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);

  const [customer, setCustomer] = useState("");
  const [note, setNote] = useState("");

  const [searchBarang, setSearchBarang] = useState("");
  const [showBarang, setShowBarang] = useState(false);
  const [selectedBarang, setSelectedBarang] = useState<any>(null);

  const [qty, setQty] = useState("");

  const [openCamera, setOpenCamera] = useState(false);
  const [scanBarang, setScanBarang] = useState<any>(null);
  const [scanQty, setScanQty] = useState("1");

  const [loadingBarang, setLoadingBarang] = useState(false);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [saving, setSaving] = useState(false);

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

      setBarang(
        Array.isArray(json)
          ? json
          : json.data || []
      );
    } catch (err) {
      console.error("LOAD BARANG ERROR:", err);
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

      setCustomers(
        Array.isArray(json)
          ? json
          : json.data || []
      );
    } catch (err) {
      console.error("LOAD CUSTOMER ERROR:", err);
      setCustomers([]);
    } finally {
      setLoadingCustomer(false);
    }
  }

  useEffect(() => {
    loadBarang();
    loadCustomer();
  }, []);

  // =========================================================
  // FILTER BARANG
  // =========================================================

  const filteredBarang = barang
    .filter((b) => {
      const text =
        `${b.code ?? ""} ${b.name ?? ""} ${b.barcode ?? ""}`
          .toLowerCase();

      return text.includes(
        searchBarang.toLowerCase()
      );
    })
    .slice(0, 20);

  // =========================================================
  // PILIH BARANG
  // =========================================================

  function pilihBarang(data: any) {
    setSelectedBarang(data);

    setSearchBarang(
      `${data.code} - ${data.name}`
    );

    setShowBarang(false);
  }

  // =========================================================
  // TAMBAH KE CART
  // =========================================================

  function tambahKeCart(
    data: any,
    jumlah: number
  ) {
    if (!jumlah || jumlah <= 0) {
      alert("Qty tidak valid");
      return false;
    }

    if (Number(data.stock) <= 0) {
      alert(`Stock ${data.name} sudah habis`);
      return false;
    }

    if (jumlah > Number(data.stock)) {
      alert(
        `Stock ${data.name} hanya ${data.stock}`
      );

      return false;
    }

    let berhasil = true;

    setCart((prev) => {
      const exist = prev.find(
        (x) => x.barangId === data.id
      );

      if (exist) {
        const newQty =
          exist.qty + jumlah;

        if (
          newQty >
          Number(data.stock)
        ) {
          alert(
            `Qty ${data.name} melebihi stock`
          );

          berhasil = false;
          return prev;
        }

        return prev.map((x) => {
          if (x.barangId === data.id) {
            return {
              ...x,
              qty: newQty,
              subtotal:
                newQty * x.price,
            };
          }

          return x;
        });
      }

      const price = Number(
        data.purchasePrice ?? 0
      );

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

    const berhasil = tambahKeCart(
      selectedBarang,
      jumlah
    );

    if (berhasil) {
      setSelectedBarang(null);
      setSearchBarang("");
      setQty("");
    }
  }

  // =========================================================
  // SCAN BARCODE
  // =========================================================

  async function scanBarcode(
    barcode: string
  ) {
    try {
      const cleanBarcode =
        barcode.trim();

      if (!cleanBarcode) {
        return;
      }

      const res = await fetch(
        `/api/barang/barcode/${encodeURIComponent(
          cleanBarcode
        )}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!json.success) {
        alert(
          json.message ||
            "Barcode tidak ditemukan"
        );

        return;
      }

      setScanBarang(json.data);
      setScanQty("1");
    } catch (err) {
      console.error(
        "SCAN BARCODE ERROR:",
        err
      );

      alert(
        "Barcode gagal diproses"
      );
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

    const berhasil = tambahKeCart(
      scanBarang,
      jumlah
    );

    if (berhasil) {
      setScanBarang(null);
      setScanQty("1");
    }
  }

  // =========================================================
  // HAPUS CART
  // =========================================================

  function hapus(index: number) {
    setCart((prev) =>
      prev.filter(
        (_, i) => i !== index
      )
    );
  }

  // =========================================================
  // SIMPAN BARANG KELUAR
  // =========================================================

  async function simpan() {
    if (!customer) {
      alert("Pilih customer terlebih dahulu");
      return;
    }

    if (cart.length === 0) {
      alert("Belum ada barang");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(
        "/api/barang-keluar",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            customerId: Number(customer),
            note,
            items: cart.map((item) => ({
              barangId:
                item.barangId,
              qty: item.qty,
            })),
          }),
        }
      );

      const json = await res.json();

      if (json.success) {
        alert(
          "Barang keluar berhasil disimpan"
        );

        setCart([]);
        setCustomer("");
        setNote("");

        await loadBarang();
      } else {
        alert(
          json.message ||
            "Gagal menyimpan barang keluar"
        );
      }
    } catch (error) {
      console.error(
        "SIMPAN BARANG KELUAR ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat menyimpan barang keluar"
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================================================
  // TOTAL
  // =========================================================

  const totalQty = cart.reduce(
    (total, item) =>
      total + Number(item.qty || 0),
    0
  );

  const totalNominal = cart.reduce(
    (total, item) =>
      total +
      Number(item.subtotal || 0),
    0
  );

  // =========================================================
  // FORMAT
  // =========================================================

  function formatNumber(value: any) {
    return Number(
      value ?? 0
    ).toLocaleString("id-ID");
  }

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div className="flex items-center gap-3">

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
            <PackageMinus size={23} />
          </div>

          <div>

            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Barang Keluar
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Proses pengeluaran barang dari gudang
            </p>

          </div>

        </div>

        <div className="flex items-center gap-2 rounded-xl border border-[#DDE9E4] bg-white px-4 py-2.5 text-sm text-gray-500 shadow-sm">

          <ShoppingCart
            size={17}
            className="text-[#497F70]"
          />

          <span>
            {cart.length} jenis barang
          </span>

        </div>

      </div>

      {/* ================================================= */}
      {/* MAIN CARD */}
      {/* ================================================= */}

      <div className="space-y-6">

        {/* ================================================= */}
        {/* CUSTOMER & KETERANGAN */}
        {/* ================================================= */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm md:p-6">

          <div className="mb-5 flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <User size={19} />
            </div>

            <div>

              <h2 className="font-semibold text-[#18352D]">
                Informasi Pengeluaran
              </h2>

              <p className="text-xs text-gray-500">
                Tentukan customer dan keterangan transaksi
              </p>

            </div>

          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

            {/* CUSTOMER */}

            <div>

              <label className="mb-2 block text-sm font-semibold text-[#35564C]">
                Customer
                <span className="ml-1 text-red-500">
                  *
                </span>
              </label>

              <select
                className="
                  w-full
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  px-4
                  py-3
                  text-sm
                  text-gray-700
                  outline-none
                  transition
                  focus:border-[#497F70]
                  focus:bg-white
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
                value={customer}
                onChange={(e) =>
                  setCustomer(
                    e.target.value
                  )
                }
              >

                <option value="">
                  -- Pilih Customer --
                </option>

                {customers.map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                  >
                    {c.code
                      ? `${c.code} - `
                      : ""}
                    {c.name}
                  </option>
                ))}

              </select>

            </div>

            {/* KETERANGAN */}

            <div>

              <label className="mb-2 block text-sm font-semibold text-[#35564C]">
                Keterangan
              </label>

              <div className="relative">

                <FileText
                  size={17}
                  className="
                    absolute
                    left-3
                    top-1/2
                    -translate-y-1/2
                    text-gray-400
                  "
                />

                <input
                  className="
                    w-full
                    rounded-xl
                    border
                    border-[#D5E5DC]
                    bg-[#FAFCFB]
                    py-3
                    pl-10
                    pr-4
                    text-sm
                    text-gray-700
                    outline-none
                    transition
                    placeholder:text-gray-400
                    focus:border-[#497F70]
                    focus:bg-white
                    focus:ring-2
                    focus:ring-[#497F70]/10
                  "
                  placeholder="Contoh: Pengiriman ke customer..."
                  value={note}
                  onChange={(e) =>
                    setNote(
                      e.target.value
                    )
                  }
                />

              </div>

            </div>

          </div>

        </div>

        {/* ================================================= */}
        {/* SCANNER */}
        {/* ================================================= */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm md:p-6">

          <div className="mb-5 flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <ScanLine size={19} />
            </div>

            <div>

              <h2 className="font-semibold text-[#18352D]">
                Scan Barcode
              </h2>

              <p className="text-xs text-gray-500">
                Scan menggunakan scanner atau kamera
              </p>

            </div>

          </div>

          <div className="flex flex-col gap-3 lg:flex-row">

            <div className="flex-1">

              <BarcodeInputScanner
                onScan={scanBarcode}
              />

            </div>

            <button
              type="button"
              onClick={() =>
                setOpenCamera(true)
              }
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-[#497F70]
                px-5
                py-3
                text-sm
                font-semibold
                text-white
                shadow-sm
                transition
                hover:bg-[#3D6D60]
              "
            >

              <Camera size={18} />

              Kamera

            </button>

          </div>

          {/* CAMERA */}

          {openCamera && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-[#DDE9E4] bg-[#18352D] p-4">

              <div className="mb-3 flex items-center justify-between">

                <div>

                  <p className="font-semibold text-white">
                    Scan Barcode
                  </p>

                  <p className="text-xs text-white/60">
                    Arahkan kamera ke barcode barang
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setOpenCamera(false)
                  }
                  className="
                    rounded-lg
                    p-2
                    text-white/70
                    transition
                    hover:bg-white/10
                    hover:text-white
                  "
                >
                  <X size={18} />
                </button>

              </div>

              <CameraBarcodeScanner
                onScan={(barcode) => {
                  setOpenCamera(false);
                  scanBarcode(barcode);
                }}
              />

              <button
                type="button"
                onClick={() =>
                  setOpenCamera(false)
                }
                className="
                  mt-3
                  w-full
                  rounded-xl
                  border
                  border-white/20
                  bg-white/10
                  px-4
                  py-2.5
                  text-sm
                  font-medium
                  text-white
                  transition
                  hover:bg-white/20
                "
              >
                Tutup Kamera
              </button>

            </div>
          )}

        </div>

        {/* ================================================= */}
        {/* SEARCH BARANG */}
        {/* ================================================= */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm md:p-6">

          <div className="mb-5 flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Search size={19} />
            </div>

            <div>

              <h2 className="font-semibold text-[#18352D]">
                Tambah Barang
              </h2>

              <p className="text-xs text-gray-500">
                Cari barang berdasarkan kode, nama, atau barcode
              </p>

            </div>

          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-end">

            {/* SEARCH */}

            <div className="relative flex-1">

              <label className="mb-2 block text-sm font-semibold text-[#35564C]">
                Cari Barang
              </label>

              <div className="relative">

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
                  className="
                    w-full
                    rounded-xl
                    border
                    border-[#D5E5DC]
                    bg-[#FAFCFB]
                    py-3
                    pl-10
                    pr-4
                    text-sm
                    outline-none
                    transition
                    focus:border-[#497F70]
                    focus:bg-white
                    focus:ring-2
                    focus:ring-[#497F70]/10
                  "
                  placeholder="Ketik kode, nama, atau barcode..."
                  value={searchBarang}
                  onFocus={() =>
                    setShowBarang(true)
                  }
                  onChange={(e) => {
                    setSearchBarang(
                      e.target.value
                    );

                    setShowBarang(true);
                    setSelectedBarang(null);
                  }}
                />

              </div>

              {/* DROPDOWN */}

              {showBarang &&
                searchBarang && (
                  <div className="
                    absolute
                    left-0
                    right-0
                    z-40
                    mt-2
                    max-h-72
                    overflow-y-auto
                    rounded-xl
                    border
                    border-[#DDE9E4]
                    bg-white
                    shadow-lg
                  ">

                    {loadingBarang ? (
                      <div className="flex items-center justify-center gap-2 p-5 text-sm text-gray-500">

                        <RefreshCw
                          size={16}
                          className="animate-spin text-[#497F70]"
                        />

                        Memuat barang...

                      </div>
                    ) : filteredBarang.length ===
                      0 ? (
                      <div className="p-5 text-center">

                        <PackageMinus
                          size={28}
                          className="mx-auto mb-2 text-gray-300"
                        />

                        <p className="text-sm font-medium text-gray-600">
                          Barang tidak ditemukan
                        </p>

                      </div>
                    ) : (
                      filteredBarang.map(
                        (b) => (
                          <button
                            type="button"
                            key={b.id}
                            onClick={() =>
                              pilihBarang(b)
                            }
                            className="
                              w-full
                              border-b
                              border-[#EDF2EF]
                              p-3
                              text-left
                              transition
                              last:border-0
                              hover:bg-[#F5F8F6]
                            "
                          >

                            <div className="font-semibold text-[#18352D]">
                              {b.code} -{" "}
                              {b.name}
                            </div>

                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">

                              <span>
                                Stock{" "}
                                <b className="text-[#35564C]">
                                  {b.stock}
                                </b>
                              </span>

                              <span>
                                {b.unit}
                              </span>

                              <span>
                                Rp{" "}
                                {formatNumber(
                                  b.purchasePrice
                                )}
                              </span>

                            </div>

                          </button>
                        )
                      )
                    )}

                  </div>
                )}

            </div>

            {/* QTY */}

            <div className="w-full md:w-32">

              <label className="mb-2 block text-sm font-semibold text-[#35564C]">
                Qty
              </label>

              <input
                type="number"
                min="1"
                className="
                  w-full
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  px-4
                  py-3
                  text-sm
                  outline-none
                  transition
                  focus:border-[#497F70]
                  focus:bg-white
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
                placeholder="0"
                value={qty}
                onChange={(e) =>
                  setQty(e.target.value)
                }
              />

            </div>

            {/* TAMBAH */}

            <button
              type="button"
              onClick={tambahManual}
              className="
                inline-flex
                h-[46px]
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-[#497F70]
                px-5
                text-sm
                font-semibold
                text-white
                shadow-sm
                transition
                hover:bg-[#3D6D60]
              "
            >

              <Plus size={18} />

              Tambah

            </button>

          </div>

        </div>

        {/* ================================================= */}
        {/* CART */}
        {/* ================================================= */}

        <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

          <div className="border-b border-[#E5ECE9] px-5 py-4 md:px-6">

            <div className="flex items-center justify-between">

              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                  <ShoppingCart size={19} />
                </div>

                <div>

                  <h2 className="font-semibold text-[#18352D]">
                    Daftar Barang Keluar
                  </h2>

                  <p className="text-xs text-gray-500">
                    Barang yang akan dikeluarkan dari gudang
                  </p>

                </div>

              </div>

              <div className="rounded-full bg-[#EAF3EF] px-3 py-1 text-xs font-semibold text-[#497F70]">
                {cart.length} Item
              </div>

            </div>

          </div>

          <div className="overflow-x-auto">

            <table className="min-w-[850px] w-full text-sm">

              <thead className="bg-[#F5F8F6]">

                <tr className="border-b border-[#E5ECE9]">

                  <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                    Barang
                  </th>

                  <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                    Stock
                  </th>

                  <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                    Qty
                  </th>

                  <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                    Harga
                  </th>

                  <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                    Total
                  </th>

                  <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                    Aksi
                  </th>

                </tr>

              </thead>

              <tbody>

                {cart.length === 0 ? (
                  <tr>

                    <td
                      colSpan={6}
                      className="px-5 py-14 text-center"
                    >

                      <div className="flex flex-col items-center">

                        <div className="
                          mb-3
                          flex
                          h-14
                          w-14
                          items-center
                          justify-center
                          rounded-full
                          bg-[#EAF3EF]
                          text-[#497F70]
                        ">
                          <ShoppingCart size={25} />
                        </div>

                        <p className="font-semibold text-gray-700">
                          Belum ada barang
                        </p>

                        <p className="mt-1 text-sm text-gray-400">
                          Tambahkan barang menggunakan pencarian atau scanner.
                        </p>

                      </div>

                    </td>

                  </tr>
                ) : (
                  cart.map(
                    (item, index) => (
                      <tr
                        key={`${item.barangId}-${index}`}
                        className="
                          border-b
                          border-[#EDF2EF]
                          transition
                          hover:bg-[#FAFCFB]
                        "
                      >

                        {/* BARANG */}

                        <td className="px-5 py-4">

                          <div className="font-semibold text-[#18352D]">
                            {item.name}
                          </div>

                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-400">

                            <span>
                              {item.code}
                            </span>

                            {item.barcode && (
                              <>
                                <span>•</span>
                                <span>
                                  {item.barcode}
                                </span>
                              </>
                            )}

                            <span>•</span>

                            <span>
                              {item.unit}
                            </span>

                          </div>

                        </td>

                        {/* STOCK */}

                        <td className="px-5 py-4 text-center">

                          <span className="
                            inline-flex
                            rounded-full
                            bg-[#EAF3EF]
                            px-3
                            py-1
                            text-xs
                            font-semibold
                            text-[#497F70]
                          ">
                            {formatNumber(
                              item.stock
                            )}
                          </span>

                        </td>

                        {/* QTY */}

                        <td className="px-5 py-4 text-center">

                          <span className="font-semibold text-[#18352D]">
                            {formatNumber(
                              item.qty
                            )}
                          </span>

                        </td>

                        {/* HARGA */}

                        <td className="whitespace-nowrap px-5 py-4 text-right text-gray-600">

                          Rp{" "}
                          {formatNumber(
                            item.price
                          )}

                        </td>

                        {/* TOTAL */}

                        <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-[#18352D]">

                          Rp{" "}
                          {formatNumber(
                            item.subtotal
                          )}

                        </td>

                        {/* AKSI */}

                        <td className="px-5 py-4 text-center">

                          <button
                            type="button"
                            onClick={() =>
                              hapus(index)
                            }
                            className="
                              inline-flex
                              items-center
                              justify-center
                              rounded-lg
                              bg-red-50
                              p-2
                              text-red-500
                              transition
                              hover:bg-red-100
                            "
                            title="Hapus barang"
                          >

                            <Trash2 size={16} />

                          </button>

                        </td>

                      </tr>
                    )
                  )
                )}

              </tbody>

            </table>

          </div>

        </div>

        {/* ================================================= */}
        {/* SUMMARY */}
        {/* ================================================= */}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

          {/* INFO */}

          <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm lg:col-span-2">

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              <div className="rounded-xl bg-[#F5F8F6] p-4">

                <p className="text-sm text-gray-500">
                  Total Jenis Barang
                </p>

                <p className="mt-1 text-2xl font-bold text-[#18352D]">
                  {cart.length}
                </p>

              </div>

              <div className="rounded-xl bg-[#F5F8F6] p-4">

                <p className="text-sm text-gray-500">
                  Total Qty
                </p>

                <p className="mt-1 text-2xl font-bold text-[#18352D]">
                  {formatNumber(totalQty)}
                </p>

              </div>

            </div>

          </div>

          {/* TOTAL */}

          <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <span className="text-sm text-gray-500">
                Total Nilai Barang
              </span>

              <span className="text-xl font-bold text-[#18352D]">
                Rp{" "}
                {formatNumber(
                  totalNominal
                )}
              </span>

            </div>

            <button
              type="button"
              onClick={simpan}
              disabled={
                saving ||
                cart.length === 0
              }
              className="
                mt-5
                inline-flex
                w-full
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-[#497F70]
                px-5
                py-3.5
                text-sm
                font-semibold
                text-white
                shadow-sm
                transition
                hover:bg-[#3D6D60]
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
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
                  <PackageMinus size={17} />

                  Simpan Barang Keluar
                </>
              )}

            </button>

          </div>

        </div>

      </div>

      {/* ================================================= */}
      {/* MODAL HASIL SCAN */}
      {/* ================================================= */}

      {scanBarang && (
        <div className="
          fixed
          inset-0
          z-50
          flex
          items-center
          justify-center
          bg-black/50
          p-4
        ">

          <div className="
            w-full
            max-w-md
            overflow-hidden
            rounded-2xl
            border
            border-[#DDE9E4]
            bg-white
            shadow-2xl
          ">

            <div className="flex items-center justify-between border-b border-[#E5ECE9] px-5 py-4">

              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                  <ScanLine size={19} />
                </div>

                <div>

                  <h2 className="font-semibold text-[#18352D]">
                    Barang Ditemukan
                  </h2>

                  <p className="text-xs text-gray-500">
                    Konfirmasi qty barang
                  </p>

                </div>

              </div>

              <button
                type="button"
                onClick={() =>
                  setScanBarang(null)
                }
                className="
                  rounded-lg
                  p-2
                  text-gray-400
                  transition
                  hover:bg-gray-100
                  hover:text-gray-600
                "
              >
                <X size={18} />
              </button>

            </div>

            <div className="p-5">

              <div className="space-y-3 rounded-xl bg-[#F5F8F6] p-4">

                <div className="flex justify-between gap-4">

                  <span className="text-sm text-gray-500">
                    Kode
                  </span>

                  <span className="text-right text-sm font-semibold text-[#18352D]">
                    {scanBarang.code ||
                      "-"}
                  </span>

                </div>

                <div className="flex justify-between gap-4">

                  <span className="text-sm text-gray-500">
                    Barcode
                  </span>

                  <span className="text-right text-sm font-medium text-gray-700">
                    {scanBarang.barcode ||
                      "-"}
                  </span>

                </div>

                <div className="flex justify-between gap-4">

                  <span className="text-sm text-gray-500">
                    Nama
                  </span>

                  <span className="text-right text-sm font-semibold text-[#18352D]">
                    {scanBarang.name ||
                      "-"}
                  </span>

                </div>

                <div className="flex justify-between gap-4">

                  <span className="text-sm text-gray-500">
                    Stock
                  </span>

                  <span className="text-right text-sm font-semibold text-[#497F70]">
                    {formatNumber(
                      scanBarang.stock
                    )}{" "}
                    {scanBarang.unit}
                  </span>

                </div>

              </div>

              <div className="mt-5">

                <label className="mb-2 block text-sm font-semibold text-[#35564C]">
                  Qty Keluar
                </label>

                <input
                  type="number"
                  min="1"
                  className="
                    w-full
                    rounded-xl
                    border
                    border-[#D5E5DC]
                    bg-[#FAFCFB]
                    px-4
                    py-3
                    text-sm
                    outline-none
                    transition
                    focus:border-[#497F70]
                    focus:bg-white
                    focus:ring-2
                    focus:ring-[#497F70]/10
                  "
                  value={scanQty}
                  onChange={(e) =>
                    setScanQty(
                      e.target.value
                    )
                  }
                />

              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">

                <button
                  type="button"
                  onClick={() =>
                    setScanBarang(null)
                  }
                  className="
                    rounded-xl
                    border
                    border-[#D5E5DC]
                    bg-white
                    px-4
                    py-3
                    text-sm
                    font-semibold
                    text-gray-600
                    transition
                    hover:bg-[#F5F8F6]
                  "
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={tambahDariScan}
                  className="
                    inline-flex
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-[#497F70]
                    px-4
                    py-3
                    text-sm
                    font-semibold
                    text-white
                    transition
                    hover:bg-[#3D6D60]
                  "
                >

                  <Plus size={17} />

                  Tambah
                </button>

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}