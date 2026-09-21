"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Upload,
  Plus,
  Pencil,
  Trash2,
  Users,
  Clock3,
  RefreshCw,
  Search,
  X,
  MapPin,
  Phone,
  Mail,
  UserRound,
  CreditCard,
  Database,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  Loader2,
  Landmark,
  WalletCards,
  CircleDollarSign,
} from "lucide-react";

import ImportSupplierModal from "@/components/supplier/ImportSupplierModal";

type Supplier = {
  id: number;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  contactPerson: string | null;
  tempoDays: number;

  // =====================================================
  // DATA REKENING
  // =====================================================

  accountNumber?: string | null;
  accountName?: string | null;
  accountType?: string | null;

  // Compatibility jika API menggunakan nama field bank
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  bankAccountType?: string | null;

  rekeningNumber?: string | null;
  rekeningName?: string | null;
  rekeningType?: string | null;

  noRekening?: string | null;
  namaRekening?: string | null;
  jenisRekening?: string | null;
};

export default function SupplierPage() {
  const router = useRouter();

  const [supplier, setSupplier] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [openImport, setOpenImport] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // =====================================================
  // FILTER
  // =====================================================

  const [search, setSearch] = useState("");
  const [tempoFilter, setTempoFilter] = useState("ALL");

  // =====================================================
  // LOAD SUPPLIER
  // =====================================================

  async function load() {
    try {
      setLoading(true);

      const res = await fetch("/api/supplier", {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setSupplier(
          Array.isArray(json.data) ? json.data : []
        );
      } else {
        alert(
          json.message ||
            "Gagal mengambil data supplier"
        );
      }
    } catch (error) {
      console.error(error);
      alert("Gagal mengambil data supplier");
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // BACK
  // =====================================================

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  }

  // =====================================================
  // DELETE SUPPLIER
  // =====================================================

  async function hapusSupplier(id: number) {
    const target = supplier.find(
      (item) => item.id === id
    );

    const ok = confirm(
      `Yakin ingin menghapus supplier "${
        target?.name ?? ""
      }"?\n\nData yang sudah dihapus tidak dapat dikembalikan.`
    );

    if (!ok) return;

    try {
      setDeletingId(id);

      const res = await fetch(
        `/api/supplier/${id}`,
        {
          method: "DELETE",
        }
      );

      const json = await res.json();

      if (!json.success) {
        alert(
          json.message ||
            "Gagal menghapus supplier"
        );
        return;
      }

      await load();
    } catch (error) {
      console.error(error);
      alert("Gagal menghapus supplier");
    } finally {
      setDeletingId(null);
    }
  }

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    load();
  }, []);

  // =====================================================
  // HELPER REKENING
  // =====================================================

  function getAccountNumber(
    item: Supplier
  ): string {
    return (
      item.accountNumber ??
      item.bankAccountNumber ??
      item.rekeningNumber ??
      item.noRekening ??
      ""
    );
  }

  function getAccountName(
    item: Supplier
  ): string {
    return (
      item.accountName ??
      item.bankAccountName ??
      item.rekeningName ??
      item.namaRekening ??
      ""
    );
  }

  function getAccountType(
    item: Supplier
  ): string {
    return (
      item.accountType ??
      item.bankAccountType ??
      item.rekeningType ??
      item.jenisRekening ??
      ""
    );
  }

  // =====================================================
  // FILTER DATA
  // =====================================================

  const filteredSupplier = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return supplier.filter((item) => {
      const matchesSearch =
        !keyword ||
        item.code
          .toLowerCase()
          .includes(keyword) ||
        item.name
          .toLowerCase()
          .includes(keyword) ||
        (item.city ?? "")
          .toLowerCase()
          .includes(keyword) ||
        (item.contactPerson ?? "")
          .toLowerCase()
          .includes(keyword) ||
        (item.phone ?? "")
          .toLowerCase()
          .includes(keyword) ||
        (item.email ?? "")
          .toLowerCase()
          .includes(keyword) ||
        getAccountNumber(item)
          .toLowerCase()
          .includes(keyword) ||
        getAccountName(item)
          .toLowerCase()
          .includes(keyword) ||
        getAccountType(item)
          .toLowerCase()
          .includes(keyword);

      if (!matchesSearch) {
        return false;
      }

      if (tempoFilter === "ALL") {
        return true;
      }

      const tempo = Number(
        item.tempoDays ?? 30
      );

      if (tempoFilter === "COD") {
        return tempo === 0;
      }

      return tempo === Number(tempoFilter);
    });
  }, [supplier, search, tempoFilter]);

  // =====================================================
  // TEMPO OPTIONS
  // =====================================================

  const customTempoOptions = useMemo(() => {
    const standard = [0, 14, 30, 45, 60];

    return Array.from(
      new Set(
        supplier
          .map((item) =>
            Number(item.tempoDays ?? 30)
          )
          .filter(
            (tempo) =>
              !standard.includes(tempo)
          )
      )
    ).sort((a, b) => a - b);
  }, [supplier]);

  // =====================================================
  // STATISTICS
  // =====================================================

  const statistics = useMemo(() => {
    const total = supplier.length;

    const cod = supplier.filter(
      (item) =>
        Number(item.tempoDays ?? 30) === 0
    ).length;

    const tempo30 = supplier.filter(
      (item) =>
        Number(item.tempoDays ?? 30) === 30
    ).length;

    const tempoLong = supplier.filter(
      (item) =>
        Number(item.tempoDays ?? 30) >= 45
    ).length;

    const withAccount = supplier.filter(
      (item) =>
        getAccountNumber(item).trim() !== ""
    ).length;

    return {
      total,
      cod,
      tempo30,
      tempoLong,
      withAccount,
    };
  }, [supplier]);

  // =====================================================
  // RESET FILTER
  // =====================================================

  function resetFilter() {
    setSearch("");
    setTempoFilter("ALL");
  }

  const isFiltered =
    search.trim() !== "" ||
    tempoFilter !== "ALL";

  // =====================================================
  // FORMAT TEMPO
  // =====================================================

  function renderTempo(
    tempoDays:
      | number
      | null
      | undefined
  ) {
    const tempo = Number(
      tempoDays ?? 30
    );

    if (tempo === 0) {
      return (
        <span
          className="
            inline-flex
            items-center
            gap-1.5
            rounded-full
            border
            border-emerald-200
            bg-emerald-50
            px-3
            py-1.5
            text-xs
            font-bold
            text-emerald-700
          "
        >
          <Clock3 size={13} />
          COD / Hari Ini
        </span>
      );
    }

    if (tempo >= 45) {
      return (
        <span
          className="
            inline-flex
            items-center
            gap-1.5
            rounded-full
            border
            border-amber-200
            bg-amber-50
            px-3
            py-1.5
            text-xs
            font-bold
            text-amber-700
          "
        >
          <Clock3 size={13} />
          {tempo} Hari
        </span>
      );
    }

    return (
      <span
        className="
          inline-flex
          items-center
          gap-1.5
          rounded-full
          border
          border-sky-200
          bg-sky-50
          px-3
          py-1.5
          text-xs
          font-bold
          text-sky-700
        "
      >
        <Clock3 size={13} />
        {tempo} Hari
      </span>
    );
  }

  // =====================================================
  // ACCOUNT DISPLAY
  // =====================================================

  function renderAccountNumber(
    item: Supplier
  ) {
    const number = getAccountNumber(item);

    if (!number) {
      return (
        <span
          className="
            inline-flex
            items-center
            gap-1.5
            rounded-lg
            border
            border-dashed
            border-[#D9E5DE]
            bg-[#FAFCFB]
            px-2.5
            py-1.5
            text-[11px]
            font-medium
            text-[#9AA9A1]
          "
        >
          <CreditCard size={12} />
          Belum diisi
        </span>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <div
          className="
            flex
            h-8
            w-8
            shrink-0
            items-center
            justify-center
            rounded-lg
            bg-[#EDF6F1]
            text-[#497F70]
          "
        >
          <CreditCard size={15} />
        </div>

        <span
          className="
            whitespace-nowrap
            font-mono
            text-xs
            font-bold
            tracking-wide
            text-[#29483A]
          "
        >
          {number}
        </span>
      </div>
    );
  }

  function renderAccountName(
    item: Supplier
  ) {
    const name = getAccountName(item);

    if (!name) {
      return (
        <span className="text-xs text-[#A0ADA6]">
          -
        </span>
      );
    }

    return (
      <div className="min-w-[160px]">
        <p
          className="
            max-w-[220px]
            truncate
            text-xs
            font-bold
            text-[#29483A]
          "
          title={name}
        >
          {name}
        </p>

        <p
          className="
            mt-0.5
            text-[10px]
            text-[#92A198]
          "
        >
          Pemilik rekening
        </p>
      </div>
    );
  }

  function renderAccountType(
    item: Supplier
  ) {
    const type = getAccountType(item);

    if (!type) {
      return (
        <span
          className="
            text-xs
            font-medium
            text-[#A0ADA6]
          "
        >
          -
        </span>
      );
    }

    return (
      <span
        className="
          inline-flex
          items-center
          gap-1.5
          rounded-full
          border
          border-[#D8E6DE]
          bg-[#F3F8F5]
          px-3
          py-1.5
          text-[11px]
          font-bold
          text-[#497F70]
        "
      >
        <Landmark size={12} />
        {type}
      </span>
    );
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div
      className="
        min-h-screen
        bg-[#F5F8F6]
        text-[#29483A]
      "
    >
      <div className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">

        {/* =================================================
            TOP NAVIGATION
        ================================================= */}

        <div
          className="
            mb-5
            flex
            flex-wrap
            items-center
            justify-between
            gap-3
          "
        >
          <div
            className="
              flex
              items-center
              gap-2
              text-xs
              text-[#819087]
            "
          >
            <button
              type="button"
              onClick={handleBack}
              className="
                group
                inline-flex
                items-center
                gap-2
                rounded-xl
                border
                border-[#DCE7E1]
                bg-white
                px-3.5
                py-2.5
                font-semibold
                text-[#497F70]
                shadow-[0_4px_14px_rgba(41,72,58,0.04)]
                transition
                hover:border-[#BFD5C9]
                hover:bg-[#F3F8F5]
                active:scale-[0.98]
              "
            >
              <ArrowLeft
                size={16}
                className="
                  transition-transform
                  group-hover:-translate-x-0.5
                "
              />

              Kembali
            </button>

            <ChevronRight
              size={14}
              className="text-[#B3C1BA]"
            />

            <span className="font-medium">
              Master Data
            </span>

            <ChevronRight
              size={14}
              className="text-[#B3C1BA]"
            />

            <span className="font-semibold text-[#29483A]">
              Supplier
            </span>
          </div>

          <div
            className="
              hidden
              items-center
              gap-2
              rounded-full
              border
              border-[#DCE7E1]
              bg-white
              px-3
              py-1.5
              text-[11px]
              font-semibold
              text-[#6F8178]
              sm:flex
            "
          >
            <ShieldCheck
              size={14}
              className="text-[#497F70]"
            />

            Master Data Terverifikasi
          </div>
        </div>

        {/* =================================================
            HERO HEADER
        ================================================= */}

        <section
          className="
            relative
            mb-6
            overflow-hidden
            rounded-[28px]
            border
            border-[#D7E5DD]
            bg-white
            shadow-[0_14px_45px_rgba(41,72,58,0.07)]
          "
        >
          <div
            className="
              pointer-events-none
              absolute
              -right-20
              -top-24
              h-72
              w-72
              rounded-full
              bg-[#E9F4ED]
              blur-2xl
            "
          />

          <div
            className="
              pointer-events-none
              absolute
              -bottom-32
              right-40
              h-56
              w-56
              rounded-full
              bg-[#F0F7F3]
              blur-3xl
            "
          />

          <div
            className="
              relative
              flex
              flex-col
              gap-6
              p-6
              sm:p-7
              lg:flex-row
              lg:items-center
              lg:justify-between
              lg:p-8
            "
          >
            <div className="flex items-start gap-4">
              <div
                className="
                  flex
                  h-14
                  w-14
                  shrink-0
                  items-center
                  justify-center
                  rounded-2xl
                  bg-gradient-to-br
                  from-[#E9F5EE]
                  to-[#DCEDE4]
                  text-[#497F70]
                  shadow-inner
                "
              >
                <Building2 size={27} />
              </div>

              <div>
                <div
                  className="
                    mb-1.5
                    flex
                    items-center
                    gap-2
                  "
                >
                  <span
                    className="
                      inline-flex
                      items-center
                      gap-1
                      rounded-full
                      bg-[#EDF7F1]
                      px-2.5
                      py-1
                      text-[10px]
                      font-bold
                      uppercase
                      tracking-[0.12em]
                      text-[#497F70]
                    "
                  >
                    <Sparkles size={11} />
                    Master Data
                  </span>
                </div>

                <h1
                  className="
                    text-2xl
                    font-extrabold
                    tracking-tight
                    text-[#29483A]
                    sm:text-3xl
                  "
                >
                  Master Supplier
                </h1>

                <p
                  className="
                    mt-1.5
                    max-w-2xl
                    text-sm
                    leading-6
                    text-[#71827A]
                  "
                >
                  Kelola informasi supplier,
                  kontak, rekening pembayaran,
                  dan ketentuan tempo secara
                  terpusat.
                </p>
              </div>
            </div>

            <div
              className="
                flex
                flex-col
                gap-2.5
                sm:flex-row
              "
            >
              <button
                type="button"
                onClick={() =>
                  setOpenImport(true)
                }
                className="
                  group
                  inline-flex
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  border
                  border-[#CFE0D7]
                  bg-white
                  px-4
                  py-3
                  text-sm
                  font-bold
                  text-[#497F70]
                  shadow-[0_5px_16px_rgba(41,72,58,0.05)]
                  transition
                  hover:border-[#AFC9BC]
                  hover:bg-[#F5FAF7]
                  active:scale-[0.98]
                "
              >
                <Upload
                  size={17}
                  className="
                    transition-transform
                    group-hover:-translate-y-0.5
                  "
                />

                Import Excel
              </button>

              <Link
                href="/supplier/new"
                className="
                  group
                  inline-flex
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  bg-[#29483A]
                  px-5
                  py-3
                  text-sm
                  font-bold
                  text-white
                  shadow-[0_8px_22px_rgba(41,72,58,0.18)]
                  transition
                  hover:bg-[#203B30]
                  hover:shadow-[0_10px_26px_rgba(41,72,58,0.23)]
                  active:scale-[0.98]
                "
              >
                <Plus
                  size={18}
                  className="
                    transition-transform
                    group-hover:rotate-90
                  "
                />

                Supplier Baru
              </Link>
            </div>
          </div>
        </section>

        {/* =================================================
            STATISTICS
        ================================================= */}

        <section
          className="
            mb-6
            grid
            grid-cols-1
            gap-3
            sm:grid-cols-2
            xl:grid-cols-5
          "
        >
          {/* TOTAL */}

          <div
            className="
              rounded-2xl
              border
              border-[#DCE7E1]
              bg-white
              p-5
              shadow-[0_5px_20px_rgba(41,72,58,0.045)]
            "
          >
            <div className="flex items-start justify-between">
              <div>
                <p
                  className="
                    text-[11px]
                    font-bold
                    uppercase
                    tracking-[0.1em]
                    text-[#8A9991]
                  "
                >
                  Total Supplier
                </p>

                <p
                  className="
                    mt-2
                    text-3xl
                    font-extrabold
                    tracking-tight
                    text-[#29483A]
                  "
                >
                  {statistics.total}
                </p>

                <p className="mt-1 text-xs text-[#829189]">
                  Supplier terdaftar
                </p>
              </div>

              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  bg-[#EAF4EE]
                  text-[#497F70]
                "
              >
                <Database size={19} />
              </div>
            </div>
          </div>

          {/* COD */}

          <div
            className="
              rounded-2xl
              border
              border-[#DCE7E1]
              bg-white
              p-5
              shadow-[0_5px_20px_rgba(41,72,58,0.045)]
            "
          >
            <div className="flex items-start justify-between">
              <div>
                <p
                  className="
                    text-[11px]
                    font-bold
                    uppercase
                    tracking-[0.1em]
                    text-[#8A9991]
                  "
                >
                  COD
                </p>

                <p
                  className="
                    mt-2
                    text-3xl
                    font-extrabold
                    tracking-tight
                    text-emerald-700
                  "
                >
                  {statistics.cod}
                </p>

                <p className="mt-1 text-xs text-[#829189]">
                  Pembayaran hari ini
                </p>
              </div>

              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  bg-emerald-50
                  text-emerald-600
                "
              >
                <Clock3 size={19} />
              </div>
            </div>
          </div>

          {/* TEMPO 30 */}

          <div
            className="
              rounded-2xl
              border
              border-[#DCE7E1]
              bg-white
              p-5
              shadow-[0_5px_20px_rgba(41,72,58,0.045)]
            "
          >
            <div className="flex items-start justify-between">
              <div>
                <p
                  className="
                    text-[11px]
                    font-bold
                    uppercase
                    tracking-[0.1em]
                    text-[#8A9991]
                  "
                >
                  Tempo 30 Hari
                </p>

                <p
                  className="
                    mt-2
                    text-3xl
                    font-extrabold
                    tracking-tight
                    text-sky-700
                  "
                >
                  {statistics.tempo30}
                </p>

                <p className="mt-1 text-xs text-[#829189]">
                  Tempo standar
                </p>
              </div>

              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  bg-sky-50
                  text-sky-600
                "
              >
                <CreditCard size={19} />
              </div>
            </div>
          </div>

          {/* LONG TEMPO */}

          <div
            className="
              rounded-2xl
              border
              border-[#DCE7E1]
              bg-white
              p-5
              shadow-[0_5px_20px_rgba(41,72,58,0.045)]
            "
          >
            <div className="flex items-start justify-between">
              <div>
                <p
                  className="
                    text-[11px]
                    font-bold
                    uppercase
                    tracking-[0.1em]
                    text-[#8A9991]
                  "
                >
                  Tempo ≥ 45 Hari
                </p>

                <p
                  className="
                    mt-2
                    text-3xl
                    font-extrabold
                    tracking-tight
                    text-amber-700
                  "
                >
                  {statistics.tempoLong}
                </p>

                <p className="mt-1 text-xs text-[#829189]">
                  Tempo panjang
                </p>
              </div>

              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  bg-amber-50
                  text-amber-600
                "
              >
                <Clock3 size={19} />
              </div>
            </div>
          </div>

          {/* REKENING */}

          <div
            className="
              rounded-2xl
              border
              border-[#DCE7E1]
              bg-white
              p-5
              shadow-[0_5px_20px_rgba(41,72,58,0.045)]
            "
          >
            <div className="flex items-start justify-between">
              <div>
                <p
                  className="
                    text-[11px]
                    font-bold
                    uppercase
                    tracking-[0.1em]
                    text-[#8A9991]
                  "
                >
                  Rekening
                </p>

                <p
                  className="
                    mt-2
                    text-3xl
                    font-extrabold
                    tracking-tight
                    text-[#497F70]
                  "
                >
                  {statistics.withAccount}
                </p>

                <p className="mt-1 text-xs text-[#829189]">
                  Supplier punya rekening
                </p>
              </div>

              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  bg-[#EAF4EE]
                  text-[#497F70]
                "
              >
                <WalletCards size={19} />
              </div>
            </div>
          </div>
        </section>

        {/* =================================================
            TEMPO INFORMATION
        ================================================= */}

        <section
          className="
            mb-6
            overflow-hidden
            rounded-2xl
            border
            border-[#D7E5DD]
            bg-white
            shadow-[0_5px_20px_rgba(41,72,58,0.045)]
          "
        >
          <div
            className="
              flex
              flex-col
              gap-4
              p-5
              sm:flex-row
              sm:items-center
              sm:justify-between
              sm:p-6
            "
          >
            <div className="flex items-start gap-3.5">
              <div
                className="
                  flex
                  h-11
                  w-11
                  shrink-0
                  items-center
                  justify-center
                  rounded-xl
                  bg-[#EAF4EE]
                  text-[#497F70]
                "
              >
                <Clock3 size={20} />
              </div>

              <div>
                <h3
                  className="
                    text-sm
                    font-extrabold
                    text-[#29483A]
                  "
                >
                  Ketentuan Tempo Pembayaran
                </h3>

                <p
                  className="
                    mt-1
                    max-w-2xl
                    text-xs
                    leading-5
                    text-[#71827A]
                  "
                >
                  Tempo dihitung sejak tanggal
                  penerimaan barang dan digunakan
                  sebagai dasar penentuan jatuh tempo
                  pembayaran supplier.
                </p>
              </div>
            </div>

            <div
              className="
                rounded-xl
                border
                border-[#E1EAE5]
                bg-[#F7FAF8]
                px-4
                py-3
                text-xs
                leading-5
                text-[#71827A]
                sm:min-w-[330px]
                sm:text-right
              "
            >
              <span className="font-bold text-[#497F70]">
                Contoh:
              </span>{" "}
              barang diterima 5 September dengan
              tempo 30 hari → jatuh tempo 5 Oktober.
            </div>
          </div>
        </section>

        {/* =================================================
            FILTER
        ================================================= */}

        <section
          className="
            mb-6
            rounded-2xl
            border
            border-[#D7E5DD]
            bg-white
            p-5
            shadow-[0_5px_20px_rgba(41,72,58,0.045)]
            sm:p-6
          "
        >
          <div
            className="
              mb-5
              flex
              flex-col
              gap-3
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >
            <div className="flex items-center gap-3">
              <div
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-lg
                  bg-[#EAF4EE]
                  text-[#497F70]
                "
              >
                <Search size={18} />
              </div>

              <div>
                <h3
                  className="
                    text-sm
                    font-extrabold
                    text-[#29483A]
                  "
                >
                  Filter & Pencarian
                </h3>

                <p
                  className="
                    text-[11px]
                    text-[#829189]
                  "
                >
                  Cari supplier, rekening,
                  kontak, atau tempo pembayaran
                </p>
              </div>
            </div>

            {isFiltered && (
              <span
                className="
                  inline-flex
                  w-fit
                  items-center
                  gap-1.5
                  rounded-full
                  border
                  border-[#CDE1D5]
                  bg-[#EDF7F1]
                  px-3
                  py-1.5
                  text-[11px]
                  font-bold
                  text-[#497F70]
                "
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#497F70]" />
                Filter aktif
              </span>
            )}
          </div>

          <div
            className="
              grid
              grid-cols-1
              gap-4
              lg:grid-cols-[minmax(0,1fr)_240px_auto]
              lg:items-end
            "
          >
            {/* SEARCH */}

            <div>
              <label
                className="
                  mb-2
                  block
                  text-[11px]
                  font-bold
                  uppercase
                  tracking-[0.08em]
                  text-[#7C8D84]
                "
              >
                Pencarian Supplier
              </label>

              <div className="relative">
                <Search
                  size={17}
                  className="
                    pointer-events-none
                    absolute
                    left-3.5
                    top-1/2
                    -translate-y-1/2
                    text-[#9AABA2]
                  "
                />

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Kode, nama, kota, contact, rekening, telepon..."
                  className="
                    h-11
                    w-full
                    rounded-xl
                    border
                    border-[#D7E5DD]
                    bg-[#FAFCFB]
                    pl-10
                    pr-10
                    text-sm
                    text-[#29483A]
                    outline-none
                    transition
                    placeholder:text-[#A1AEA8]
                    focus:border-[#6D9D8C]
                    focus:bg-white
                    focus:ring-4
                    focus:ring-[#497F70]/8
                  "
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                    className="
                      absolute
                      right-3
                      top-1/2
                      flex
                      -translate-y-1/2
                      items-center
                      justify-center
                      rounded-lg
                      p-1
                      text-[#91A39A]
                      transition
                      hover:bg-[#EDF4F0]
                      hover:text-[#29483A]
                    "
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* TEMPO */}

            <div>
              <label
                className="
                  mb-2
                  block
                  text-[11px]
                  font-bold
                  uppercase
                  tracking-[0.08em]
                  text-[#7C8D84]
                "
              >
                Tempo Pembayaran
              </label>

              <div className="relative">
                <Clock3
                  size={16}
                  className="
                    pointer-events-none
                    absolute
                    left-3
                    top-1/2
                    -translate-y-1/2
                    text-[#78988A]
                  "
                />

                <select
                  value={tempoFilter}
                  onChange={(e) =>
                    setTempoFilter(
                      e.target.value
                    )
                  }
                  className="
                    h-11
                    w-full
                    appearance-none
                    rounded-xl
                    border
                    border-[#D7E5DD]
                    bg-[#FAFCFB]
                    px-10
                    text-sm
                    font-medium
                    text-[#29483A]
                    outline-none
                    transition
                    focus:border-[#6D9D8C]
                    focus:bg-white
                    focus:ring-4
                    focus:ring-[#497F70]/8
                  "
                >
                  <option value="ALL">
                    Semua Tempo
                  </option>

                  <option value="COD">
                    COD / 0 Hari
                  </option>

                  <option value="14">
                    14 Hari
                  </option>

                  <option value="30">
                    30 Hari
                  </option>

                  <option value="45">
                    45 Hari
                  </option>

                  <option value="60">
                    60 Hari
                  </option>

                  {customTempoOptions.map(
                    (tempo) => (
                      <option
                        key={tempo}
                        value={String(tempo)}
                      >
                        {tempo} Hari
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            {/* RESET */}

            <button
              type="button"
              onClick={resetFilter}
              disabled={!isFiltered}
              className="
                inline-flex
                h-11
                items-center
                justify-center
                gap-2
                rounded-xl
                border
                border-[#D7E5DD]
                bg-white
                px-5
                text-sm
                font-bold
                text-[#497F70]
                shadow-sm
                transition
                hover:bg-[#F3F8F5]
                active:scale-[0.98]
                disabled:cursor-not-allowed
                disabled:opacity-35
              "
            >
              <RefreshCw size={16} />
              Reset
            </button>
          </div>

          {/* FILTER RESULT */}

          <div
            className="
              mt-5
              flex
              flex-wrap
              items-center
              justify-between
              gap-2
              border-t
              border-[#EDF2EF]
              pt-4
              text-xs
              text-[#829189]
            "
          >
            <span>
              Menampilkan{" "}
              <strong className="font-extrabold text-[#29483A]">
                {filteredSupplier.length}
              </strong>{" "}
              dari{" "}
              <strong className="font-extrabold text-[#29483A]">
                {supplier.length}
              </strong>{" "}
              supplier
            </span>

            {isFiltered && (
              <button
                type="button"
                onClick={resetFilter}
                className="
                  font-bold
                  text-[#497F70]
                  transition
                  hover:text-[#29483A]
                  hover:underline
                "
              >
                Hapus semua filter
              </button>
            )}
          </div>
        </section>

        {/* =================================================
            TABLE
        ================================================= */}

        <section
          className="
            overflow-hidden
            rounded-2xl
            border
            border-[#D7E5DD]
            bg-white
            shadow-[0_8px_28px_rgba(41,72,58,0.055)]
          "
        >
          {/* TABLE HEADER */}

          <div
            className="
              flex
              flex-col
              gap-4
              border-b
              border-[#E8EFEB]
              p-5
              sm:flex-row
              sm:items-center
              sm:justify-between
              sm:p-6
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
                  bg-[#EAF4EE]
                  text-[#497F70]
                "
              >
                <Users size={19} />
              </div>

              <div>
                <h2
                  className="
                    text-sm
                    font-extrabold
                    text-[#29483A]
                  "
                >
                  Data Supplier
                </h2>

                <p
                  className="
                    mt-0.5
                    text-xs
                    text-[#829189]
                  "
                >
                  {filteredSupplier.length} supplier
                  ditampilkan
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="
                inline-flex
                w-fit
                items-center
                gap-2
                rounded-xl
                border
                border-[#D7E5DD]
                bg-[#FAFCFB]
                px-3.5
                py-2.5
                text-xs
                font-bold
                text-[#497F70]
                transition
                hover:bg-[#F0F6F3]
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              <RefreshCw
                size={15}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh Data
            </button>
          </div>

          {/* TABLE */}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1780px] border-collapse">
              <thead>
                <tr
                  className="
                    border-b
                    border-[#DDE9E2]
                    bg-[#F4F8F5]
                  "
                >
                  <th
                    className="
                      whitespace-nowrap
                      px-5
                      py-4
                      text-left
                      text-[10px]
                      font-extrabold
                      uppercase
                      tracking-[0.1em]
                      text-[#71827A]
                    "
                  >
                    Kode
                  </th>

                  <th
                    className="
                      whitespace-nowrap
                      px-5
                      py-4
                      text-left
                      text-[10px]
                      font-extrabold
                      uppercase
                      tracking-[0.1em]
                      text-[#71827A]
                    "
                  >
                    Supplier
                  </th>

                  <th
                    className="
                      whitespace-nowrap
                      px-5
                      py-4
                      text-left
                      text-[10px]
                      font-extrabold
                      uppercase
                      tracking-[0.1em]
                      text-[#71827A]
                    "
                  >
                    Kota
                  </th>

                  <th
                    className="
                      whitespace-nowrap
                      px-5
                      py-4
                      text-left
                      text-[10px]
                      font-extrabold
                      uppercase
                      tracking-[0.1em]
                      text-[#71827A]
                    "
                  >
                    Contact
                  </th>

                  <th
                    className="
                      whitespace-nowrap
                      px-5
                      py-4
                      text-left
                      text-[10px]
                      font-extrabold
                      uppercase
                      tracking-[0.1em]
                      text-[#71827A]
                    "
                  >
                    Telepon
                  </th>

                  <th
                    className="
                      whitespace-nowrap
                      px-5
                      py-4
                      text-left
                      text-[10px]
                      font-extrabold
                      uppercase
                      tracking-[0.1em]
                      text-[#71827A]
                    "
                  >
                    Email
                  </th>

                  {/* =================================================
                      REKENING
                  ================================================= */}

                  <th
                    className="
                      whitespace-nowrap
                      px-5
                      py-4
                      text-left
                      text-[10px]
                      font-extrabold
                      uppercase
                      tracking-[0.1em]
                      text-[#497F70]
                    "
                  >
                    No. Rekening
                  </th>

                  <th
                    className="
                      whitespace-nowrap
                      px-5
                      py-4
                      text-left
                      text-[10px]
                      font-extrabold
                      uppercase
                      tracking-[0.1em]
                      text-[#497F70]
                    "
                  >
                    Nama Rekening
                  </th>

                  <th
                    className="
                      whitespace-nowrap
                      px-5
                      py-4
                      text-left
                      text-[10px]
                      font-extrabold
                      uppercase
                      tracking-[0.1em]
                      text-[#497F70]
                    "
                  >
                    Jenis Rekening
                  </th>

                  <th
                    className="
                      whitespace-nowrap
                      px-5
                      py-4
                      text-center
                      text-[10px]
                      font-extrabold
                      uppercase
                      tracking-[0.1em]
                      text-[#71827A]
                    "
                  >
                    Tempo
                  </th>

                  <th
                    className="
                      whitespace-nowrap
                      px-5
                      py-4
                      text-center
                      text-[10px]
                      font-extrabold
                      uppercase
                      tracking-[0.1em]
                      text-[#71827A]
                    "
                  >
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody>
                {/* LOADING */}

                {loading ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="p-16"
                    >
                      <div
                        className="
                          flex
                          flex-col
                          items-center
                          justify-center
                          gap-3
                        "
                      >
                        <div
                          className="
                            flex
                            h-12
                            w-12
                            items-center
                            justify-center
                            rounded-2xl
                            bg-[#EAF4EE]
                            text-[#497F70]
                          "
                        >
                          <Loader2
                            size={22}
                            className="animate-spin"
                          />
                        </div>

                        <div className="text-center">
                          <p
                            className="
                              text-sm
                              font-bold
                              text-[#29483A]
                            "
                          >
                            Memuat data supplier
                          </p>

                          <p
                            className="
                              mt-1
                              text-xs
                              text-[#829189]
                            "
                          >
                            Mohon tunggu sebentar...
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : filteredSupplier.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="p-16"
                    >
                      <div
                        className="
                          mx-auto
                          flex
                          max-w-md
                          flex-col
                          items-center
                          justify-center
                          text-center
                        "
                      >
                        <div
                          className="
                            mb-4
                            flex
                            h-16
                            w-16
                            items-center
                            justify-center
                            rounded-2xl
                            bg-[#F0F5F2]
                            text-[#91A39A]
                          "
                        >
                          {supplier.length === 0 ? (
                            <Building2 size={28} />
                          ) : (
                            <Search size={28} />
                          )}
                        </div>

                        <p
                          className="
                            text-base
                            font-extrabold
                            text-[#29483A]
                          "
                        >
                          {supplier.length === 0
                            ? "Belum ada data supplier"
                            : "Supplier tidak ditemukan"}
                        </p>

                        <p
                          className="
                            mt-1.5
                            text-xs
                            leading-5
                            text-[#829189]
                          "
                        >
                          {supplier.length === 0
                            ? "Tambahkan supplier baru atau import data dari Excel."
                            : "Coba ubah kata kunci atau filter tempo pembayaran."}
                        </p>

                        {supplier.length ===
                        0 ? (
                          <Link
                            href="/supplier/new"
                            className="
                              mt-5
                              inline-flex
                              items-center
                              gap-2
                              rounded-xl
                              bg-[#29483A]
                              px-4
                              py-2.5
                              text-xs
                              font-bold
                              text-white
                              transition
                              hover:bg-[#203B30]
                            "
                          >
                            <Plus size={15} />
                            Tambah Supplier
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={
                              resetFilter
                            }
                            className="
                              mt-5
                              inline-flex
                              items-center
                              gap-2
                              rounded-xl
                              border
                              border-[#D7E5DD]
                              bg-white
                              px-4
                              py-2.5
                              text-xs
                              font-bold
                              text-[#497F70]
                              transition
                              hover:bg-[#F2F7F4]
                            "
                          >
                            <RefreshCw
                              size={15}
                            />
                            Reset Filter
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSupplier.map(
                    (item, index) => (
                      <tr
                        key={item.id}
                        className="
                          group
                          border-b
                          border-[#EDF2EF]
                          transition
                          last:border-b-0
                          hover:bg-[#FAFCFB]
                        "
                      >
                        {/* KODE */}

                        <td className="px-5 py-4">
                          <span
                            className="
                              inline-flex
                              rounded-lg
                              border
                              border-[#DDE8E2]
                              bg-[#F7FAF8]
                              px-2.5
                              py-1.5
                              font-mono
                              text-xs
                              font-bold
                              text-[#497F70]
                            "
                          >
                            {item.code}
                          </span>
                        </td>

                        {/* SUPPLIER */}

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="
                                flex
                                h-10
                                w-10
                                shrink-0
                                items-center
                                justify-center
                                rounded-xl
                                bg-[#EAF4EE]
                                text-sm
                                font-extrabold
                                text-[#497F70]
                              "
                            >
                              {item.name
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div className="min-w-0">
                              <p
                                className="
                                  max-w-[250px]
                                  truncate
                                  text-sm
                                  font-extrabold
                                  text-[#29483A]
                                "
                              >
                                {item.name}
                              </p>

                              <p
                                className="
                                  mt-0.5
                                  flex
                                  items-center
                                  gap-1
                                  text-[11px]
                                  text-[#8A9991]
                                "
                              >
                                <Building2
                                  size={11}
                                />

                                Supplier #{index + 1}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* KOTA */}

                        <td className="px-5 py-4">
                          <div
                            className="
                              flex
                              items-center
                              gap-2
                              text-sm
                              text-[#53675D]
                            "
                          >
                            <MapPin
                              size={15}
                              className="shrink-0 text-[#8BA196]"
                            />

                            <span className="max-w-[150px] truncate">
                              {item.city ?? "-"}
                            </span>
                          </div>
                        </td>

                        {/* CONTACT */}

                        <td className="px-5 py-4">
                          <div
                            className="
                              flex
                              items-center
                              gap-2
                              text-sm
                              text-[#53675D]
                            "
                          >
                            <UserRound
                              size={15}
                              className="shrink-0 text-[#8BA196]"
                            />

                            <span className="max-w-[150px] truncate">
                              {item.contactPerson ??
                                "-"}
                            </span>
                          </div>
                        </td>

                        {/* PHONE */}

                        <td className="px-5 py-4">
                          <div
                            className="
                              flex
                              items-center
                              gap-2
                              text-sm
                              text-[#53675D]
                            "
                          >
                            <Phone
                              size={15}
                              className="shrink-0 text-[#8BA196]"
                            />

                            <span>
                              {item.phone ??
                                "-"}
                            </span>
                          </div>
                        </td>

                        {/* EMAIL */}

                        <td className="px-5 py-4">
                          <div
                            className="
                              flex
                              max-w-[220px]
                              items-center
                              gap-2
                              text-sm
                              text-[#53675D]
                            "
                          >
                            <Mail
                              size={15}
                              className="shrink-0 text-[#8BA196]"
                            />

                            <span className="truncate">
                              {item.email ??
                                "-"}
                            </span>
                          </div>
                        </td>

                        {/* =================================================
                            NO REKENING
                        ================================================= */}

                        <td className="px-5 py-4">
                          {renderAccountNumber(item)}
                        </td>

                        {/* =================================================
                            NAMA REKENING
                        ================================================= */}

                        <td className="px-5 py-4">
                          {renderAccountName(item)}
                        </td>

                        {/* =================================================
                            JENIS REKENING
                        ================================================= */}

                        <td className="px-5 py-4">
                          {renderAccountType(item)}
                        </td>

                        {/* TEMPO */}

                        <td className="px-5 py-4 text-center">
                          {renderTempo(
                            item.tempoDays
                          )}
                        </td>

                        {/* ACTION */}

                        <td className="px-5 py-4">
                          <div
                            className="
                              flex
                              items-center
                              justify-center
                              gap-2
                            "
                          >
                            <Link
                              href={`/supplier/${item.id}/edit`}
                              title="Edit supplier"
                              className="
                                inline-flex
                                items-center
                                justify-center
                                gap-1.5
                                rounded-xl
                                border
                                border-[#E7DDBB]
                                bg-[#FFFDF5]
                                px-3
                                py-2
                                text-xs
                                font-bold
                                text-[#967C3E]
                                transition
                                hover:border-[#D9C990]
                                hover:bg-[#FAF5E7]
                                active:scale-[0.97]
                              "
                            >
                              <Pencil size={14} />
                              Edit
                            </Link>

                            <button
                              type="button"
                              onClick={() =>
                                hapusSupplier(
                                  item.id
                                )
                              }
                              disabled={
                                deletingId ===
                                item.id
                              }
                              title="Hapus supplier"
                              className="
                                inline-flex
                                items-center
                                justify-center
                                gap-1.5
                                rounded-xl
                                border
                                border-[#EBCFC9]
                                bg-[#FFF8F6]
                                px-3
                                py-2
                                text-xs
                                font-bold
                                text-[#A45447]
                                transition
                                hover:border-[#DDB6AF]
                                hover:bg-[#FCEFEB]
                                active:scale-[0.97]
                                disabled:cursor-not-allowed
                                disabled:opacity-50
                              "
                            >
                              {deletingId ===
                              item.id ? (
                                <Loader2
                                  size={14}
                                  className="animate-spin"
                                />
                              ) : (
                                <Trash2
                                  size={14}
                                />
                              )}

                              {deletingId ===
                              item.id
                                ? "Menghapus"
                                : "Hapus"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* TABLE FOOTER */}

          {!loading &&
            filteredSupplier.length >
              0 && (
              <div
                className="
                  flex
                  flex-col
                  gap-2
                  border-t
                  border-[#E8EFEB]
                  bg-[#FAFCFB]
                  px-5
                  py-3.5
                  text-[11px]
                  text-[#829189]
                  sm:flex-row
                  sm:items-center
                  sm:justify-between
                "
              >
                <span>
                  Menampilkan{" "}
                  <strong className="text-[#29483A]">
                    {filteredSupplier.length}
                  </strong>{" "}
                  supplier
                </span>

                <span className="flex items-center gap-1.5">
                  <ShieldCheck
                    size={13}
                    className="text-[#497F70]"
                  />

                  Data supplier, rekening,
                  dan tempo terintegrasi
                  dengan modul pembelian
                </span>
              </div>
            )}
        </section>

        {/* =================================================
            BOTTOM INFO
        ================================================= */}

        <div
          className="
            mt-5
            flex
            items-center
            justify-center
            gap-2
            text-[10px]
            font-medium
            uppercase
            tracking-[0.12em]
            text-[#A0ADA6]
          "
        >
          <AlertTriangle size={12} />

          Pastikan data supplier, rekening,
          dan tempo pembayaran selalu diperbarui
        </div>
      </div>

      {/* =================================================
          IMPORT MODAL
      ================================================= */}

      <ImportSupplierModal
        open={openImport}
        onClose={() =>
          setOpenImport(false)
        }
        onSuccess={load}
      />
    </div>
  );
}