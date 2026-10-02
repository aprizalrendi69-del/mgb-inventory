"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Search,
  RefreshCw,
  ClipboardCheck,
  Save,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CalendarDays,
  Package,
  Boxes,
  Scale,
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  UserRound,
  ShieldCheck,
  Clock3,
  CircleDot,
  ArrowRight,
  FileCheck2,
  FileDown,
  Loader2,
  Tag,
  ListFilter,
} from "lucide-react";

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type BarangCategory =
  | string
  | {
      id?: number;
      name?: string;
      code?: string;
    }
  | null;

type Barang = {
  id: number;
  code: string;
  name: string;
  unit: string;
  baseUnit?: string | null;
  conversionRate?: number | null;
  purchasePrice: number;
  sellingPrice: number;

  /*
   * Kategori dibuat fleksibel karena response API
   * bisa menggunakan salah satu bentuk berikut:
   *
   * category: "Minuman"
   * category: { name: "Minuman" }
   * kategori: { name: "Minuman" }
   * categoryName: "Minuman"
   */
  category?: BarangCategory;
  kategori?: BarangCategory;
  categoryName?: string | null;
};

type OutletStock = {
  id: number;
  outletId: number;
  barangId: number;
  stock: number;
  minimumStock: number;
  averageCost: number;
  barang: Barang;
};

type CountItem = OutletStock & {
  physicalQty: number;
  note: string;
};

type LoginUser = {
  id: number;
  fullname: string;
  role: string;
  outletId: number | null;
};

type StockOpnameType = "WEEKLY" | "MONTHLY";

export default function OutletStockOpnamePage() {
  const [data, setData] = useState<CountItem[]>([]);
  const [outlet, setOutlet] = useState<Outlet | null>(null);

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] =
    useState<number>(0);

  const [user, setUser] =
    useState<LoginUser | null>(null);

  const [opnameType, setOpnameType] =
    useState<StockOpnameType>("WEEKLY");

  const [opnameDate, setOpnameDate] = useState(() => {
    const now = new Date();

    const year = now.getFullYear();

    const month = String(
      now.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      now.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  });

  const [search, setSearch] = useState("");

  /*
   * FILTER KATEGORI
   *
   * ALL = semua kategori
   * Selain ALL = nama kategori tertentu
   */
  const [selectedCategories, setSelectedCategories] =
    useState<string[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [exportingPdf, setExportingPdf] =
    useState(false);

  const [exportingResultPdf, setExportingResultPdf] =
    useState(false);

  // =====================================================
  // DRAFT PERUBAHAN STOCK FISIK
  // =====================================================
  // Draft disimpan di browser, bukan membuat Stock Opname baru.
  // Perubahan tetap ada saat pindah halaman atau refresh.
  const [hasUnsavedChanges, setHasUnsavedChanges] =
    useState(false);

  const [draftSavedAt, setDraftSavedAt] =
    useState<string | null>(null);

  const [loadingOutlets, setLoadingOutlets] =
    useState(false);

  // =====================================================
  // ROLE
  // =====================================================

  const role = String(
    user?.role || ""
  ).toUpperCase();

  const isAdminPusat =
    role === "ADMIN";

  const isAdminOutlet =
    role === "ADMIN_OUTLET" ||
    role === "OUTLET_ADMIN";

  // =====================================================
  // GET CATEGORY NAME
  // =====================================================

  function getCategoryName(
    barang?: Barang | null
  ) {
    if (!barang) {
      return "-";
    }

    if (
      typeof barang.category ===
      "string"
    ) {
      return (
        barang.category.trim() || "-"
      );
    }

    if (
      barang.category &&
      typeof barang.category ===
        "object" &&
      barang.category.name
    ) {
      return (
        barang.category.name.trim() ||
        "-"
      );
    }

    if (
      typeof barang.kategori ===
      "string"
    ) {
      return (
        barang.kategori.trim() || "-"
      );
    }

    if (
      barang.kategori &&
      typeof barang.kategori ===
        "object" &&
      barang.kategori.name
    ) {
      return (
        barang.kategori.name.trim() ||
        "-"
      );
    }

    if (
      typeof barang.categoryName ===
      "string"
    ) {
      return (
        barang.categoryName.trim() ||
        "-"
      );
    }

    return "-";
  }

  // =====================================================
  // FORMAT BASE UNIT
  // =====================================================

  function getBaseUnit(
    barang?: Barang | null
  ) {
    if (!barang) {
      return "-";
    }

    const value =
      String(
        barang.baseUnit || ""
      ).trim();

    return value || "-";
  }

  // =====================================================
  // FORMAT KONVERSI
  // =====================================================

  function getConversionRate(
    barang?: Barang | null
  ) {
    if (!barang) {
      return "-";
    }

    const value =
      Number(
        barang.conversionRate
      );

    if (
      !Number.isFinite(value) ||
      value <= 0
    ) {
      return "-";
    }

    return formatNumber(value);
  }

  // =====================================================
  // DRAFT STORAGE HELPERS
  // =====================================================

  function getDraftOutletId(outletIdOverride?: number) {
    const candidate =
      outletIdOverride !== undefined
        ? Number(outletIdOverride)
        : Number(selectedOutletId || user?.outletId || outlet?.id || 0);

    return Number.isFinite(candidate) && candidate > 0 ? candidate : 0;
  }

  function getDraftStorageKey(outletIdOverride?: number) {
    const outletId = getDraftOutletId(outletIdOverride);
    if (!outletId) return null;

    return [
      "mgb-stock-opname-draft",
      outletId,
      opnameType,
      opnameDate,
    ].join(":");
  }

  function restoreSavedDraft(items: CountItem[], outletIdOverride?: number) {
    if (typeof window === "undefined" || items.length === 0) {
      return { items, restored: false, savedAt: null as string | null };
    }

    const key = getDraftStorageKey(outletIdOverride);
    if (!key) {
      return { items, restored: false, savedAt: null as string | null };
    }

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        return { items, restored: false, savedAt: null as string | null };
      }

      const draft = JSON.parse(raw);
      if (!draft || typeof draft !== "object" || !draft.items || typeof draft.items !== "object") {
        window.localStorage.removeItem(key);
        return { items, restored: false, savedAt: null as string | null };
      }

      const restoredItems = items.map((item) => {
        const saved = draft.items[String(item.id)];
        if (!saved || typeof saved !== "object") return item;

        const physicalQty = Number(saved.physicalQty);
        return {
          ...item,
          physicalQty:
            Number.isFinite(physicalQty) && physicalQty >= 0
              ? physicalQty
              : Number(item.stock || 0),
          note: typeof saved.note === "string" ? saved.note : item.note,
        };
      });

      return {
        items: restoredItems,
        restored: true,
        savedAt: typeof draft.savedAt === "string" ? draft.savedAt : null,
      };
    } catch (error) {
      console.error("RESTORE STOCK OPNAME DRAFT ERROR:", error);
      return { items, restored: false, savedAt: null as string | null };
    }
  }

  function clearSavedDraft(outletIdOverride?: number) {
    if (typeof window === "undefined") return;
    const key = getDraftStorageKey(outletIdOverride);
    if (!key) return;

    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error("CLEAR STOCK OPNAME DRAFT ERROR:", error);
    }
  }

  // =====================================================
  // LOAD OUTLET
  // =====================================================

  async function loadOutlets() {
    try {
      setLoadingOutlets(true);

      const res = await fetch(
        "/api/outlet",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          json.message ||
            "Gagal mengambil daftar outlet"
        );
      }

      const list =
        Array.isArray(json.data)
          ? json.data
          : Array.isArray(
              json.outlets
            )
          ? json.outlets
          : [];

      setOutlets(list);
    } catch (error: any) {
      console.error(
        "LOAD OUTLETS ERROR:",
        error
      );

      alert(
        error?.message ||
          "Gagal mengambil daftar outlet"
      );

      setOutlets([]);
    } finally {
      setLoadingOutlets(false);
    }
  }

  // =====================================================
  // LOAD STOCK OPNAME
  // =====================================================

  async function loadData(
    outletIdOverride?: number
  ) {
    try {
      setLoading(true);

      const outletId =
        outletIdOverride !== undefined
          ? outletIdOverride
          : selectedOutletId;

      let url =
        "/api/outlet/stock-opname";

      if (
        isAdminPusat &&
        outletId > 0
      ) {
        url += `?outletId=${outletId}`;
      }

      const res = await fetch(url, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal mengambil stock opname"
        );
      }

      if (json.user) {
        setUser(json.user);
      }

      if (json.outlet) {
        setOutlet(json.outlet);
      } else if (
        isAdminPusat &&
        outletId > 0
      ) {
        const selectedOutlet =
          outlets.find(
            (item) =>
              Number(item.id) ===
              Number(outletId)
          );

        setOutlet(
          selectedOutlet || null
        );
      } else {
        setOutlet(null);
      }

      const stocks: OutletStock[] =
        Array.isArray(json.data)
          ? json.data
          : [];

      const mappedData: CountItem[] =
        stocks.map((item: any) => {
          const barang = item?.barang
            ? {
                ...item.barang,
                baseUnit:
                  item.barang.baseUnit ??
                  item.barang.base_unit ??
                  item.barang.baseunit ??
                  item.barang.unitBase ??
                  null,
                conversionRate:
                  item.barang.conversionRate ??
                  item.barang.conversion_rate ??
                  item.barang.conversion ??
                  item.barang.conversionValue ??
                  null,
              }
            : item.barang;

          return {
            ...item,
            barang,
            physicalQty: Number(item.stock || 0),
            note: "",
          };
        });

      const draftOutletId =
        outletId > 0
          ? outletId
          : Number(
              json.outlet?.id ??
                json.user?.outletId ??
                0
            );

      const restoredDraft = restoreSavedDraft(
        mappedData,
        draftOutletId
      );
      setData(restoredDraft.items);
      setDraftSavedAt(restoredDraft.savedAt);
      setHasUnsavedChanges(false);

      /*
       * Saat outlet berubah,
       * filter kategori dikembalikan ke semua.
       */
      setSelectedCategories([]);
      setSearch("");
    } catch (error: any) {
      console.error(
        "LOAD OUTLET STOCK OPNAME ERROR:",
        error
      );

      alert(
        error?.message ||
          "Gagal mengambil stock opname"
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    loadData();
  }, []);

  // =====================================================
  // SET USER / LOAD OUTLET
  // =====================================================

  useEffect(() => {
    if (!user) return;

    const currentRole =
      String(
        user.role || ""
      ).toUpperCase();

    if (currentRole === "ADMIN") {
      loadOutlets();
      return;
    }

    if (
      currentRole ===
        "ADMIN_OUTLET" ||
      currentRole ===
        "OUTLET_ADMIN"
    ) {
      if (user.outletId) {
        setSelectedOutletId(
          Number(user.outletId)
        );
      }
    }
  }, [user]);

  // =====================================================
  // ADMIN OUTLET LOAD
  // =====================================================

  useEffect(() => {
    if (!user) return;

    const currentRole =
      String(
        user.role || ""
      ).toUpperCase();

    if (
      (
        currentRole ===
          "ADMIN_OUTLET" ||
        currentRole ===
          "OUTLET_ADMIN"
      ) &&
      Number(
        user.outletId || 0
      ) > 0
    ) {
      loadData(
        Number(user.outletId)
      );
    }
  }, [user?.outletId]);

  // =====================================================
  // CHANGE OUTLET
  // =====================================================

  async function handleOutletChange(
    outletId: string
  ) {
    const id = Number(outletId);

    setSelectedOutletId(id);
    setSearch("");
    setSelectedCategories([]);

    if (!id) {
      setOutlet(null);
      setData([]);
      return;
    }

    const selected =
      outlets.find(
        (item) =>
          Number(item.id) === id
      );

    setOutlet(
      selected || null
    );

    await loadData(id);
  }

  // =====================================================
  // CHANGE TYPE
  // =====================================================

  function handleTypeChange(
    type: StockOpnameType
  ) {
    if (saving) return;

    setOpnameType(type);
  }

  // =====================================================
  // CATEGORY LIST
  // =====================================================

  const categories = useMemo(() => {
    const unique = new Set<string>();

    data.forEach((item) => {
      const category =
        getCategoryName(
          item.barang
        );

      if (
        category &&
        category !== "-"
      ) {
        unique.add(category);
      }
    });

    return Array.from(unique).sort(
      (a, b) =>
        a.localeCompare(
          b,
          "id-ID",
          {
            sensitivity: "base",
          }
        )
    );
  }, [data]);

  function toggleCategory(category: string) {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category]
    );
  }

  function resetCategoryFilter() {
    setSelectedCategories([]);
  }

  // =====================================================
  // FILTER
  // =====================================================

  const filteredData = useMemo(() => {
    const keyword =
      search
        .toLowerCase()
        .trim();

    return data.filter((item) => {
      const category =
        getCategoryName(
          item.barang
        );

      const categoryMatch =
        selectedCategories.length === 0 ||
        selectedCategories.includes(category);

      if (!categoryMatch) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const text = [
        item.barang?.code,
        item.barang?.name,
        category,
        item.barang?.unit,
        item.barang?.baseUnit,
        item.barang
          ?.conversionRate,
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(keyword);
    });
  }, [
    data,
    search,
    selectedCategories,
  ]);

  // =====================================================
  // UPDATE PHYSICAL
  // =====================================================

  function updatePhysicalQty(
    stockId: number,
    value: string
  ) {
    const qty =
      value === ""
        ? 0
        : Number(value);

    setData((current) =>
      current.map((item) =>
        item.id === stockId
          ? {
              ...item,
              physicalQty:
                Number.isFinite(qty) &&
                qty >= 0
                  ? qty
                  : 0,
            }
          : item
      )
    );

    setHasUnsavedChanges(true);
  }

  // =====================================================
  // UPDATE NOTE
  // =====================================================

  function updateNote(
    stockId: number,
    value: string
  ) {
    setData((current) =>
      current.map((item) =>
        item.id === stockId
          ? {
              ...item,
              note: value,
            }
          : item
      )
    );

    setHasUnsavedChanges(true);
  }

  // =====================================================
  // FORMAT
  // =====================================================

  function formatNumber(
    value: number
  ) {
    return Number(
      value || 0
    ).toLocaleString("id-ID");
  }

  // =====================================================
  // DIFFERENCE
  // =====================================================

  function getDifference(
    item: CountItem
  ) {
    return (
      Number(
        item.physicalQty || 0
      ) -
      Number(
        item.stock || 0
      )
    );
  }

  // =====================================================
  // SUMMARY
  // =====================================================

  const totalBarang =
    data.length;

  const totalSystemQty =
    data.reduce(
      (sum, item) =>
        sum +
        Number(
          item.stock || 0
        ),
      0
    );

  const totalPhysicalQty =
    data.reduce(
      (sum, item) =>
        sum +
        Number(
          item.physicalQty || 0
        ),
      0
    );

  const totalDifference =
    data.reduce(
      (sum, item) =>
        sum +
        getDifference(item),
      0
    );

  const totalSelisihBarang =
    data.filter(
      (item) =>
        getDifference(item) !== 0
    ).length;

  const matchingItems =
    data.filter(
      (item) =>
        getDifference(item) === 0
    ).length;

  const accuracy =
    totalBarang > 0
      ? Math.round(
          (matchingItems /
            totalBarang) *
            100
        )
      : 0;

  // =====================================================
  // EXPORT PDF FORM HITUNG MANUAL
  // =====================================================

  async function handleExportManualPdf() {
    if (exportingPdf) return;

    if (filteredData.length === 0) {
      alert(
        "Tidak ada barang yang dapat dimasukkan ke Form Hitung Manual."
      );
      return;
    }

    if (isAdminPusat && selectedOutletId <= 0) {
      alert("Silakan pilih outlet terlebih dahulu.");
      return;
    }

    try {
      setExportingPdf(true);

      const { jsPDF } = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");
      const autoTable = autoTableModule.default;

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 12;

      const greenDark = [31, 76, 63];
      const green = [65, 125, 101];
      const greenLight = [235, 246, 241];
      const greenVeryLight = [247, 251, 249];
      const grayText = [82, 101, 94];
      const grayMuted = [123, 139, 132];
      const grayBorder = [218, 231, 224];
      const grayFill = [249, 251, 250];
      const manualFill = [252, 254, 253];

      const typeText =
        opnameType === "WEEKLY" ? "MINGGUAN" : "BULANAN";

      const categoryText =
        selectedCategories.length === 0
          ? "SEMUA KATEGORI"
          : selectedCategories.join(", ");

      doc.setProperties({
        title: `Form Penghitungan Manual - ${outlet?.code || "Outlet"}`,
        subject: "Form Penghitungan Manual Stock Opname",
        author: "MGB Inventory",
        creator: "MGB Inventory",
      });

      // =================================================
      // HEADER
      // Nama petugas dan tanggal TIDAK diisi otomatis.
      // =================================================
      doc.setFillColor(...greenDark);
      doc.roundedRect(
        margin,
        9,
        pageWidth - margin * 2,
        34,
        4,
        4,
        "F"
      );

      doc.setFillColor(73, 119, 101);
      doc.circle(pageWidth - 17, 17, 13, "F");
      doc.setFillColor(57, 101, 85);
      doc.circle(pageWidth - 25, 36, 9, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("FORM PENGHITUNGAN MANUAL", margin + 7, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.2);
      doc.text(
        "Lembar kerja staff untuk penghitungan fisik barang",
        margin + 7,
        26
      );

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("MGB INVENTORY", margin + 7, 35);

      doc.setTextColor(230, 244, 238);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(typeText, pageWidth - margin - 7, 20, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.text("FORM MANUAL", pageWidth - margin - 7, 26, {
        align: "right",
      });

      // =================================================
      // DOCUMENT INFORMATION
      // =================================================
      let currentY = 50;
      const infoHeight = 31;

      doc.setFillColor(...greenVeryLight);
      doc.setDrawColor(...grayBorder);
      doc.roundedRect(
        margin,
        currentY,
        pageWidth - margin * 2,
        infoHeight,
        3,
        3,
        "FD"
      );

      const infoX1 = margin + 6;
      const infoX2 = margin + 72;
      const infoX3 = margin + 137;

      doc.setTextColor(...grayMuted);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2);
      doc.text("OUTLET", infoX1, currentY + 8);
      doc.text("NAMA PETUGAS", infoX2, currentY + 8);
      doc.text("KATEGORI", infoX3, currentY + 8);

      doc.setTextColor(...greenDark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(
        outlet ? `${outlet.code} - ${outlet.name}` : "-",
        infoX1,
        currentY + 15
      );

      // Sengaja kosong agar staff mengisi manual pada kertas.
      doc.setDrawColor(175, 194, 185);
      doc.line(infoX2, currentY + 17, infoX2 + 55, currentY + 17);

      const categoryLines = doc.splitTextToSize(categoryText, 45);
      doc.text(categoryLines.slice(0, 2), infoX3, currentY + 15);

      doc.setTextColor(...grayMuted);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2);
      doc.text("TANGGAL", infoX1, currentY + 24);
      doc.text("SIKLUS", infoX2, currentY + 24);
      doc.text("JUMLAH ITEM", infoX3, currentY + 24);

      doc.setTextColor(...grayText);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2);

      // Tanggal sengaja kosong, tidak menggunakan opnameDate / tanggal hari ini.
      doc.setDrawColor(175, 194, 185);
      doc.line(infoX1, currentY + 28, infoX1 + 50, currentY + 28);

      doc.text(typeText, infoX2, currentY + 28);
      doc.text(formatNumber(filteredData.length), infoX3, currentY + 28);

      currentY += infoHeight + 8;

      // =================================================
      // INSTRUCTION
      // =================================================
      doc.setFillColor(...greenLight);
      doc.setDrawColor(210, 229, 219);
      doc.roundedRect(
        margin,
        currentY,
        pageWidth - margin * 2,
        17,
        3,
        3,
        "FD"
      );

      doc.setTextColor(...greenDark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("PETUNJUK PENGHITUNGAN", margin + 5, currentY + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2);
      doc.setTextColor(...grayText);
      doc.text(
        "Gunakan daftar referensi barang berikut. Isi jumlah Ending dan Catatan secara manual pada area kosong yang tersedia.",
        margin + 5,
        currentY + 11
      );

      currentY += 23;

      // =================================================
      // REFERENCE ITEM TABLE
      // SATU TABEL: REFERENSI + ENDING + CATATAN
      // Kode Barang ditambahkan sebagai referensi utama.
      // Tinggi baris dibuat sedang agar tetap nyaman ditulis manual tanpa membuat PDF terlalu panjang.
      // =================================================
      doc.setTextColor(...greenDark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("DAFTAR REFERENSI BARANG", margin, currentY);

      doc.setTextColor(...grayMuted);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2);
      doc.text(
        "Kode barang, kategori, nama, unit, base unit dan konversi menjadi referensi. Ending dan Catatan dikosongkan untuk pengisian manual.",
        margin,
        currentY + 5
      );

      currentY += 9;

      const referenceRows = filteredData.map((item, index) => [
        String(index + 1),
        item.barang?.code || "-",
        getCategoryName(item.barang),
        item.barang?.name || "-",
        item.barang?.unit || "-",
        getConversionRate(item.barang),
        getBaseUnit(item.barang),
        "",
        "",
      ]);

      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin, top: 10, bottom: 20 },
        head: [[
          "No",
          "Kode Barang",
          "Kategori",
          "Nama Barang",
          "Unit",
          "Konversi",
          "Base Unit",
          "Ending",
          "Catatan",
        ]],
        body: referenceRows,
        theme: "grid",
        showHead: "everyPage",
        pageBreak: "auto",
        rowPageBreak: "avoid",
        styles: {
          font: "helvetica",
          fontSize: 5.8,
          cellPadding: 1.9,
          textColor: [52, 72, 65],
          lineColor: grayBorder,
          lineWidth: 0.18,
          valign: "middle",
          overflow: "linebreak",
          minCellHeight: 9.5,
          fillColor: manualFill,
        },
        headStyles: {
          fillColor: greenDark,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 5.6,
          halign: "center",
          valign: "middle",
          cellPadding: 1.8,
          minCellHeight: 8,
          overflow: "hidden",
        },
        alternateRowStyles: { fillColor: grayFill },
        columnStyles: {
          0: { cellWidth: 7, halign: "center" },
          1: { cellWidth: 24, halign: "center", fontStyle: "bold" },
          2: { cellWidth: 29 },
          3: { cellWidth: 57, fontStyle: "bold" },
          4: { cellWidth: 15, halign: "center" },
          5: { cellWidth: 21, halign: "center" },
          6: { cellWidth: 20, halign: "center" },
          7: { cellWidth: 45, halign: "center" },
          8: { cellWidth: 55 },
        },
        didParseCell: (data: any) => {
          // Ending dan Catatan selalu kosong pada PDF.
          if (
            data.section === "body" &&
            (data.column.index === 7 || data.column.index === 8)
          ) {
            data.cell.text = [""];
            data.cell.styles.fillColor = [255, 255, 255];
            data.cell.styles.minCellHeight = 9.5;
          }
        },
        didDrawCell: (data: any) => {
          // Buat area tulis manual lebih jelas pada Ending dan Catatan.
          if (
            data.section === "body" &&
            (data.column.index === 7 || data.column.index === 8)
          ) {
            doc.setDrawColor(224, 233, 228);
            doc.setLineWidth(0.1);

            const innerPadding = 2.5;
            doc.rect(
              data.cell.x + innerPadding,
              data.cell.y + innerPadding,
              data.cell.width - innerPadding * 2,
              data.cell.height - innerPadding * 2,
              "S"
            );
          }
        },
        didDrawPage: () =>
          drawManualPdfFooter(doc, pageWidth, pageHeight, margin),
      });

      let finalY = (doc as any).lastAutoTable?.finalY || currentY + 20;

      // =================================================
      // SIGNATURE ONLY
      // =================================================
      if (finalY + 48 > pageHeight - 15) {
        doc.addPage();
        finalY = 18;
      } else {
        finalY += 9;
      }

      const signatureY = finalY;
      doc.setTextColor(...grayText);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.text("Staff Penghitung", margin + 25, signatureY, {
        align: "center",
      });
      doc.text("Supervisor / Checker", pageWidth - margin - 45, signatureY, {
        align: "center",
      });

      doc.setDrawColor(180, 194, 187);
      doc.line(
        margin + 8,
        signatureY + 21,
        margin + 70,
        signatureY + 21
      );
      doc.line(
        pageWidth - margin - 76,
        signatureY + 21,
        pageWidth - margin - 14,
        signatureY + 21
      );

      // =================================================
      // FILENAME
      // Tidak menggunakan tanggal otomatis.
      // =================================================
      const safeOutletCode = outlet?.code
        ? outlet.code
            .replace(/[^a-zA-Z0-9-_]/g, "-")
            .toUpperCase()
        : "OUTLET";

      const safeCategory =
        selectedCategories.length > 0
          ? selectedCategories
              .join("-")
              .replace(/[^a-zA-Z0-9-_]/g, "-")
              .toUpperCase()
          : "SEMUA-KATEGORI";

      doc.save(
        `form-hitung-manual-${safeOutletCode}-${safeCategory}.pdf`
      );
    } catch (error) {
      console.error("EXPORT FORM MANUAL PDF ERROR:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Gagal membuat Form Penghitungan Manual PDF"
      );
    } finally {
      setExportingPdf(false);
    }
  }

  // =====================================================
  // MANUAL PDF FOOTER HELPER
  // =====================================================

  function drawManualPdfFooter(
    doc: any,
    pageWidth: number,
    pageHeight: number,
    margin: number
  ) {
    const pageNumber =
      doc.getNumberOfPages();

    doc.setDrawColor(
      220,
      231,
      225
    );

    doc.line(
      margin,
      pageHeight - 10,
      pageWidth -
        margin,
      pageHeight - 10
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(6);

    doc.setTextColor(
      130,
      145,
      138
    );

    doc.text(
      "MGB Inventory • Form Penghitungan Manual",
      margin,
      pageHeight - 6
    );

    doc.text(
      `Halaman ${pageNumber}`,
      pageWidth -
        margin,
      pageHeight - 6,
      {
        align: "right",
      }
    );
  }

    // =====================================================
  // EXPORT PDF HASIL OPNAME KESELURUHAN
  // PDF ini selalu menggunakan SELURUH daftar barang pada
  // outlet yang sedang diperiksa, tidak mengikuti filter
  // kategori maupun pencarian di tabel.
  // =====================================================

  async function handleExportResultPdf() {
    if (exportingResultPdf) return;

    if (data.length === 0) {
      alert("Tidak ada data barang untuk dibuatkan PDF hasil opname.");
      return;
    }

    if (isAdminPusat && selectedOutletId <= 0) {
      alert("Silakan pilih outlet terlebih dahulu.");
      return;
    }

    try {
      setExportingResultPdf(true);

      const { jsPDF } = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");
      const autoTable = autoTableModule.default;

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 12;

      const greenDark = [31, 76, 63];
      const green = [65, 125, 101];
      const greenLight = [235, 246, 241];
      const greenVeryLight = [247, 251, 249];
      const grayText = [82, 101, 94];
      const grayMuted = [123, 139, 132];
      const grayBorder = [218, 231, 224];
      const grayFill = [249, 251, 250];

      const typeText =
        opnameType === "WEEKLY" ? "MINGGUAN" : "BULANAN";

      const dateText = opnameDate
        ? new Date(`${opnameDate}T00:00:00`).toLocaleDateString(
            "id-ID",
            {
              day: "2-digit",
              month: "long",
              year: "numeric",
            }
          )
        : "-";

      const resultRows = data.map((item, index) => {
        const systemQty = Number(item.stock || 0);
        const physicalQty = Number(item.physicalQty || 0);
        const difference = physicalQty - systemQty;

        return [
          String(index + 1),
          item.barang?.code || "-",
          getCategoryName(item.barang),
          item.barang?.name || "-",
          item.barang?.unit || "-",
          formatNumber(systemQty),
          formatNumber(physicalQty),
          `${difference > 0 ? "+" : ""}${formatNumber(difference)}`,
          item.note || "-",
          difference === 0 ? "SESUAI" : "SELISIH",
        ];
      });

      doc.setProperties({
        title: `Hasil Stock Opname - ${outlet?.code || "Outlet"}`,
        subject: "Hasil Stock Opname Keseluruhan",
        author: "MGB Inventory",
        creator: "MGB Inventory",
      });

      // =================================================
      // HEADER
      // =================================================
      doc.setFillColor(...greenDark);
      doc.roundedRect(
        margin,
        9,
        pageWidth - margin * 2,
        34,
        4,
        4,
        "F"
      );

      doc.setFillColor(73, 119, 101);
      doc.circle(pageWidth - 17, 17, 13, "F");
      doc.setFillColor(57, 101, 85);
      doc.circle(pageWidth - 25, 36, 9, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("HASIL STOCK OPNAME", margin + 7, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.2);
      doc.text(
        "Rekap keseluruhan daftar barang hasil pemeriksaan stock outlet",
        margin + 7,
        26
      );

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("MGB INVENTORY", margin + 7, 35);

      doc.setTextColor(230, 244, 238);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(typeText, pageWidth - margin - 7, 20, {
        align: "right",
      });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.text("HASIL OPNAME", pageWidth - margin - 7, 26, {
        align: "right",
      });

      // =================================================
      // DOCUMENT INFORMATION
      // =================================================
      let currentY = 50;
      const infoHeight = 34;

      doc.setFillColor(...greenVeryLight);
      doc.setDrawColor(...grayBorder);
      doc.roundedRect(
        margin,
        currentY,
        pageWidth - margin * 2,
        infoHeight,
        3,
        3,
        "FD"
      );

      const infoX1 = margin + 6;
      const infoX2 = margin + 72;
      const infoX3 = margin + 137;
      const infoX4 = margin + 202;

      doc.setTextColor(...grayMuted);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2);
      doc.text("OUTLET", infoX1, currentY + 8);
      doc.text("PETUGAS", infoX2, currentY + 8);
      doc.text("TANGGAL", infoX3, currentY + 8);
      doc.text("SIKLUS", infoX4, currentY + 8);

      doc.setTextColor(...greenDark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);

      doc.text(
        outlet ? `${outlet.code} - ${outlet.name}` : "-",
        infoX1,
        currentY + 15
      );

      doc.text(
        user?.fullname || "-",
        infoX2,
        currentY + 15
      );

      doc.text(dateText, infoX3, currentY + 15);
      doc.text(typeText, infoX4, currentY + 15);

      doc.setTextColor(...grayMuted);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2);
      doc.text("TOTAL BARANG", infoX1, currentY + 25);
      doc.text("STOCK SISTEM", infoX2, currentY + 25);
      doc.text("STOCK FISIK", infoX3, currentY + 25);
      doc.text("TOTAL SELISIH", infoX4, currentY + 25);

      doc.setTextColor(...grayText);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2);
      doc.text(formatNumber(totalBarang), infoX1, currentY + 30);
      doc.text(formatNumber(totalSystemQty), infoX2, currentY + 30);
      doc.text(formatNumber(totalPhysicalQty), infoX3, currentY + 30);

      const differenceLabel =
        totalDifference > 0
          ? `+${formatNumber(totalDifference)}`
          : formatNumber(totalDifference);

      doc.setTextColor(
        totalDifference === 0
          ? 55
          : totalDifference > 0
          ? 52
          : 192,
        totalDifference === 0
          ? 116
          : totalDifference > 0
          ? 118
          : 77,
        totalDifference === 0
          ? 81
          : totalDifference > 0
          ? 80
          : 77
      );
      doc.text(differenceLabel, infoX4, currentY + 30);

      currentY += infoHeight + 8;

      // =================================================
      // SUMMARY STRIP
      // =================================================
      doc.setFillColor(...greenLight);
      doc.setDrawColor(210, 229, 219);
      doc.roundedRect(
        margin,
        currentY,
        pageWidth - margin * 2,
        19,
        3,
        3,
        "FD"
      );

      doc.setTextColor(...greenDark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(
        "RINGKASAN HASIL",
        margin + 5,
        currentY + 7
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2);
      doc.setTextColor(...grayText);
      doc.text(
        `${matchingItems} barang sesuai • ${totalSelisihBarang} barang selisih • Akurasi ${accuracy}%`,
        margin + 5,
        currentY + 13
      );

      currentY += 27;

      // =================================================
      // FULL RESULT TABLE
      // =================================================
      doc.setTextColor(...greenDark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(
        "DAFTAR HASIL OPNAME KESELURUHAN",
        margin,
        currentY
      );

      doc.setTextColor(...grayMuted);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2);
      doc.text(
        "Seluruh barang pada outlet ditampilkan tanpa mengikuti filter kategori atau pencarian pada halaman.",
        margin,
        currentY + 5
      );

      currentY += 9;

      autoTable(doc, {
        startY: currentY,
        margin: {
          left: margin,
          right: margin,
          top: 10,
          bottom: 18,
        },
        head: [[
          "No",
          "Kode Barang",
          "Kategori",
          "Nama Barang",
          "Unit",
          "Stock Sistem",
          "Stock Fisik",
          "Selisih",
          "Catatan",
          "Status",
        ]],
        body: resultRows,
        theme: "grid",
        showHead: "everyPage",
        pageBreak: "auto",
        rowPageBreak: "avoid",
        styles: {
          font: "helvetica",
          fontSize: 5.7,
          cellPadding: 1.8,
          textColor: grayText,
          lineColor: grayBorder,
          lineWidth: 0.18,
          valign: "middle",
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: greenDark,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 5.6,
          halign: "center",
          valign: "middle",
          cellPadding: 1.8,
          overflow: "hidden",
        },
        alternateRowStyles: {
          fillColor: grayFill,
        },
        columnStyles: {
          0: { cellWidth: 7, halign: "center" },
          1: { cellWidth: 23, halign: "center", fontStyle: "bold" },
          2: { cellWidth: 27 },
          3: { cellWidth: 48, fontStyle: "bold" },
          4: { cellWidth: 13, halign: "center" },
          5: { cellWidth: 21, halign: "right" },
          6: { cellWidth: 21, halign: "right" },
          7: { cellWidth: 20, halign: "right", fontStyle: "bold" },
          8: { cellWidth: 44 },
          9: { cellWidth: 20, halign: "center", fontStyle: "bold" },
        },
        didParseCell: (cellData: any) => {
          if (
            cellData.section === "body" &&
            cellData.column.index === 9
          ) {
            const value = String(
              cellData.cell.raw || ""
            ).toUpperCase();

            cellData.cell.styles.fillColor =
              value === "SESUAI"
                ? [240, 248, 242]
                : [255, 249, 236];

            cellData.cell.styles.textColor =
              value === "SESUAI"
                ? [57, 114, 80]
                : [151, 110, 34];
          }

          if (
            cellData.section === "body" &&
            cellData.column.index === 7
          ) {
            const raw = String(
              cellData.cell.raw || ""
            );
            const value = Number(
              raw.replace(/\./g, "").replace(",", ".")
            );

            if (Number.isFinite(value)) {
              cellData.cell.styles.textColor =
                value === 0
                  ? [125, 139, 132]
                  : value > 0
                  ? [52, 118, 80]
                  : [192, 77, 77];
            }
          }
        },
        didDrawPage: () => {
          drawResultPdfFooter(
            doc,
            pageWidth,
            pageHeight,
            margin
          );
        },
      });

      const safeOutletCode = outlet?.code
        ? outlet.code
            .replace(/[^a-zA-Z0-9-_]/g, "-")
            .toUpperCase()
        : "OUTLET";

      const safeDate = opnameDate
        ? opnameDate.replace(/[^0-9-]/g, "")
        : "TANPA-TANGGAL";

      doc.save(
        `hasil-opname-${safeOutletCode}-${safeDate}.pdf`
      );
    } catch (error) {
      console.error(
        "EXPORT HASIL OPNAME PDF ERROR:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Gagal membuat PDF hasil stock opname"
      );
    } finally {
      setExportingResultPdf(false);
    }
  }

  // =====================================================
  // HASIL OPNAME PDF FOOTER HELPER
  // =====================================================

  function drawResultPdfFooter(
    doc: any,
    pageWidth: number,
    pageHeight: number,
    margin: number
  ) {
    const pageNumber = doc.getNumberOfPages();

    doc.setDrawColor(220, 231, 225);
    doc.setLineWidth(0.2);

    doc.line(
      margin,
      pageHeight - 10,
      pageWidth - margin,
      pageHeight - 10
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(130, 145, 138);

    doc.text(
      "MGB Inventory • Hasil Stock Opname Keseluruhan",
      margin,
      pageHeight - 6
    );

    doc.text(
      `Halaman ${pageNumber}`,
      pageWidth - margin,
      pageHeight - 6,
      {
        align: "right",
      }
    );
  }

  // =====================================================
  // SIMPAN PERUBAHAN STOCK FISIK
  // =====================================================

  function handleSaveChanges() {
    if (data.length === 0) {
      alert("Tidak ada barang untuk disimpan.");
      return;
    }

    if (isAdminPusat && selectedOutletId <= 0) {
      alert("Silakan pilih outlet terlebih dahulu.");
      return;
    }

    const outletId = getDraftOutletId();
    const key = getDraftStorageKey(outletId);

    if (!key) {
      alert("Outlet belum terdeteksi. Silakan pilih outlet terlebih dahulu.");
      return;
    }

    try {
      const savedAt = new Date().toISOString();
      const draftItems: Record<string, { physicalQty: number; note: string }> = {};

      data.forEach((item) => {
        draftItems[String(item.id)] = {
          physicalQty: Number(item.physicalQty || 0),
          note: item.note || "",
        };
      });

      window.localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          outletId,
          type: opnameType,
          date: opnameDate,
          savedAt,
          items: draftItems,
        })
      );

      setDraftSavedAt(savedAt);
      setHasUnsavedChanges(false);

      alert(
        "Perubahan Stock Fisik berhasil disimpan. Perubahan tetap tersimpan saat pindah halaman dan akan dipulihkan ketika halaman Stock Opname dibuka kembali."
      );
    } catch (error: any) {
      console.error("SAVE STOCK OPNAME DRAFT ERROR:", error);
      alert(error?.message || "Gagal menyimpan perubahan Stock Fisik.");
    }
  }

  // =====================================================
  // SAVE
  // =====================================================

  async function handleSave() {
    if (data.length === 0) {
      alert(
        "Tidak ada barang untuk dihitung"
      );
      return;
    }

    if (
      isAdminPusat &&
      selectedOutletId <= 0
    ) {
      alert(
        "Silakan pilih outlet terlebih dahulu"
      );
      return;
    }

    if (
      isAdminOutlet &&
      (
        !user?.outletId ||
        Number(
          user.outletId
        ) <= 0
      )
    ) {
      alert(
        "User outlet belum terhubung dengan outlet"
      );
      return;
    }

    const typeLabel =
      opnameType === "WEEKLY"
        ? "MINGGUAN"
        : "BULANAN";

    if (!opnameDate) {
      alert(
        "Tanggal Stock Opname wajib dipilih."
      );
      return;
    }

    const selectedDateLabel =
      new Date(
        `${opnameDate}T00:00:00`
      ).toLocaleDateString(
        "id-ID"
      );

    const approvalLabel =
      opnameType ===
      "MONTHLY"
        ? "\n\nStock Opname Bulanan akan masuk ke Approval dan belum mengubah stock outlet."
        : "\n\nStock Opname Mingguan langsung selesai dan tidak memerlukan approval.";

    const confirmed =
      window.confirm(
        `Buat Stock Opname ${typeLabel} tanggal ${selectedDateLabel}${
          outlet
            ? ` untuk ${outlet.code} - ${outlet.name}`
            : ""
        }?${approvalLabel}`
      );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);

      const payload: any = {
        type: opnameType,
        date: opnameDate,
        items: data.map(
          (item) => ({
            stockId: item.id,
            physicalQty: Number(
              item.physicalQty || 0
            ),
            note:
              item.note || null,
          })
        ),
      };

      if (isAdminPusat) {
        payload.outletId =
          selectedOutletId;
      }

      const res = await fetch(
        "/api/outlet/stock-opname",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body:
            JSON.stringify(payload),
        }
      );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
            "Gagal menyimpan stock opname"
        );
      }

      clearSavedDraft(
        isAdminPusat
          ? selectedOutletId
          : user?.outletId
          ? Number(user.outletId)
          : undefined
      );
      setDraftSavedAt(null);
      setHasUnsavedChanges(false);

      alert(
        opnameType ===
          "WEEKLY"
          ? "Stock Opname Mingguan berhasil disimpan."
          : "Stock Opname Bulanan berhasil dibuat dan menunggu approval."
      );

      await loadData(
        isAdminPusat
          ? selectedOutletId
          : user?.outletId
          ? Number(
              user.outletId
            )
          : undefined
      );
    } catch (error: any) {
      console.error(
        "SAVE OUTLET STOCK OPNAME ERROR:",
        error
      );

      alert(
        error?.message ||
          "Gagal menyimpan stock opname"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-[#F3F7F5]">
      <div className="mx-auto max-w-[1800px] p-4 md:p-6 xl:p-8">

        {/* =================================================
            PREMIUM HEADER
        ================================================= */}

        <div className="relative mb-6 overflow-hidden rounded-[28px] border border-[#DCE9E3] bg-white shadow-[0_12px_40px_rgba(28,63,51,0.07)]">

          <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#DDF2E9] blur-3xl opacity-70" />

          <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-[#EEF7F3] blur-3xl" />

          <div className="relative p-5 md:p-7">

            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">

              <div className="flex min-w-0 items-start gap-4">

                <div className="relative shrink-0">

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4D8B78] to-[#32695A] text-white shadow-[0_10px_25px_rgba(50,105,90,0.22)]">

                    <ClipboardCheck
                      size={27}
                      strokeWidth={2.1}
                    />

                  </div>

                  <div className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#75B79D]">

                    <CheckCircle2
                      size={12}
                      className="text-white"
                    />

                  </div>

                </div>

                <div className="min-w-0">

                  <div className="mb-1 flex flex-wrap items-center gap-2">

                    <span className="rounded-full bg-[#EAF5F0] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#3C7966]">
                      Inventory Control
                    </span>

                    {opnameType ===
                    "WEEKLY" ? (
                      <span className="rounded-full border border-[#DCE9E3] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#658077]">
                        Weekly Cycle
                      </span>
                    ) : (
                      <span className="rounded-full border border-[#F1DFC0] bg-[#FFF9ED] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#9A7025]">
                        Monthly Cycle
                      </span>
                    )}

                  </div>

                  <h1 className="text-2xl font-black tracking-tight text-[#17382F] md:text-[30px]">
                    Stock Opname Outlet
                  </h1>

                  <p className="mt-1 max-w-2xl text-sm leading-6 text-[#758680]">
                    Pemeriksaan dan rekonsiliasi
                    stock fisik outlet terhadap
                    stock sistem secara terkontrol.
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">

                    {outlet ? (
                      <div className="inline-flex items-center gap-2 rounded-xl border border-[#DCE9E3] bg-[#F8FBF9] px-3 py-2">

                        <Building2
                          size={15}
                          className="text-[#4D8B78]"
                        />

                        <div className="text-xs">

                          <span className="font-bold text-[#31594D]">
                            {outlet.code}
                          </span>

                          <span className="mx-1.5 text-[#B2C2BC]">
                            /
                          </span>

                          <span className="font-medium text-[#63756F]">
                            {outlet.name}
                          </span>

                        </div>

                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 rounded-xl border border-[#F0DFB8] bg-[#FFF9EC] px-3 py-2 text-xs font-semibold text-[#967027]">

                        <AlertTriangle
                          size={15}
                        />

                        Outlet belum dipilih

                      </div>
                    )}

                    {user && (
                      <div className="inline-flex items-center gap-2 rounded-xl border border-[#DCE9E3] bg-white px-3 py-2">

                        <UserRound
                          size={14}
                          className="text-[#789089]"
                        />

                        <span className="text-xs font-semibold text-[#516760]">
                          {user.fullname ||
                            "-"}
                        </span>

                        <span className="rounded-md bg-[#EDF4F1] px-1.5 py-0.5 text-[9px] font-bold text-[#527568]">
                          {role}
                        </span>

                      </div>
                    )}

                  </div>

                </div>

              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">

                <button
                  type="button"
                  onClick={() =>
                    loadData(
                      isAdminPusat
                        ? selectedOutletId
                        : user?.outletId
                        ? Number(
                            user.outletId
                          )
                        : undefined
                    )
                  }
                  disabled={
                    loading ||
                    saving ||
                    exportingPdf
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D7E5DF] bg-white px-4 text-sm font-bold text-[#3B5E53] shadow-sm transition hover:-translate-y-0.5 hover:border-[#BBD3C9] hover:bg-[#F9FCFA] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw
                    size={16}
                    className={
                      loading
                        ? "animate-spin"
                        : ""
                    }
                  />

                  Refresh
                </button>

                <button
                  type="button"
                  onClick={
                    handleExportResultPdf
                  }
                  disabled={
                    loading ||
                    saving ||
                    exportingPdf ||
                    exportingResultPdf ||
                    data.length ===
                      0 ||
                    (
                      isAdminPusat &&
                      selectedOutletId <=
                        0
                    )
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#CFE1D9] bg-[#F8FCFA] px-4 text-sm font-bold text-[#39725F] shadow-sm transition hover:-translate-y-0.5 hover:border-[#AFCDBF] hover:bg-[#EDF7F2] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exportingResultPdf ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                  />
                  ) : (
                    <FileCheck2
                      size={16}
                    />
                  )}

                  {exportingResultPdf
                    ? "Membuat PDF..."
                    : "Hasil Opname PDF"}
                </button>

                <button
                  type="button"
                  onClick={
                    handleSave
                  }
                  disabled={
                    loading ||
                    saving ||
                    exportingPdf ||
                    exportingResultPdf ||
                    data.length === 0 ||
                    (
                      isAdminPusat &&
                      selectedOutletId <=
                        0
                    )
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4D8B78] to-[#367360] px-5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(54,115,96,0.22)] transition hover:-translate-y-0.5 hover:from-[#467F6E] hover:to-[#2F6655] disabled:cursor-not-allowed disabled:from-[#AABCB5] disabled:to-[#9DADA7] disabled:shadow-none"
                >
                  {saving ? (
                    <RefreshCw
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Save
                      size={16}
                    />
                  )}

                  {saving
                    ? "Menyimpan..."
                    : "Simpan Opname"}
                </button>

              </div>

            </div>
          </div>
        </div>

        {/* =================================================
            CONTROL AREA
        ================================================= */}

        <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_1fr]">

          {isAdminPusat && (
            <div className="group relative overflow-hidden rounded-[22px] border border-[#DCE9E3] bg-white p-5 shadow-[0_8px_28px_rgba(28,63,51,0.055)]">

              <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[#EEF7F3] blur-2xl" />

              <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                <div className="flex items-start gap-3">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EDF6F2] text-[#4D8B78]">
                    <Building2
                      size={20}
                    />
                  </div>

                  <div>
                    <p className="text-sm font-extrabold text-[#193A31]">
                      Outlet Pemeriksaan
                    </p>

                    <p className="mt-1 max-w-sm text-xs leading-5 text-[#82908C]">
                      Pilih outlet yang akan
                      digunakan untuk proses
                      stock opname.
                    </p>
                  </div>

                </div>

                <div className="relative w-full md:w-[340px]">

                  <select
                    value={
                      selectedOutletId
                    }
                    onChange={(e) =>
                      handleOutletChange(
                        e.target.value
                      )
                    }
                    disabled={
                      loadingOutlets ||
                      loading ||
                      saving
                    }
                    className="h-12 w-full appearance-none rounded-xl border border-[#D2E2DB] bg-[#FAFCFB] px-4 pr-11 text-sm font-bold text-[#23473C] outline-none transition hover:border-[#BCD2C8] focus:border-[#4D8B78] focus:bg-white focus:ring-4 focus:ring-[#4D8B78]/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value={0}>
                      {loadingOutlets
                        ? "Memuat outlet..."
                        : "Pilih outlet..."}
                    </option>

                    {outlets.map(
                      (item) => (
                        <option
                          key={
                            item.id
                          }
                          value={
                            item.id
                          }
                        >
                          {item.code} -{" "}
                          {item.name}
                        </option>
                      )
                    )}

                  </select>

                  <ChevronDown
                    size={17}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#82928C]"
                  />

                </div>

              </div>
            </div>
          )}

          <div
            className={`rounded-[22px] border border-[#DCE9E3] bg-white p-5 shadow-[0_8px_28px_rgba(28,63,51,0.055)] ${
              !isAdminPusat
                ? "xl:col-span-2"
                : ""
            }`}
          >

            <div className="flex flex-col gap-5">

              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                <div className="flex items-start gap-3">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EDF6F2] text-[#4D8B78]">
                    <CalendarDays
                      size={20}
                    />
                  </div>

                  <div>
                    <p className="text-sm font-extrabold text-[#193A31]">
                      Siklus Stock Opname
                    </p>

                    <p className="mt-1 text-xs leading-5 text-[#82908C]">
                      Tentukan periode dan tanggal
                      pemeriksaan.
                    </p>
                  </div>

                </div>

                <div className="grid grid-cols-2 rounded-xl border border-[#D5E4DE] bg-[#F7FAF8] p-1">

                  <button
                    type="button"
                    onClick={() =>
                      handleTypeChange(
                        "WEEKLY"
                      )
                    }
                    disabled={saving}
                    className={`rounded-lg px-5 py-2.5 text-xs font-extrabold transition ${
                      opnameType ===
                      "WEEKLY"
                        ? "bg-white text-[#3E7764] shadow-sm ring-1 ring-[#D8E8E1]"
                        : "text-[#789088] hover:text-[#426B5D]"
                    }`}
                  >
                    Mingguan
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleTypeChange(
                        "MONTHLY"
                      )
                    }
                    disabled={saving}
                    className={`rounded-lg px-5 py-2.5 text-xs font-extrabold transition ${
                      opnameType ===
                      "MONTHLY"
                        ? "bg-white text-[#8C6721] shadow-sm ring-1 ring-[#F0DFC0]"
                        : "text-[#789088] hover:text-[#426B5D]"
                    }`}
                  >
                    Bulanan
                  </button>

                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">

                <div className="rounded-xl border border-[#E0EAE5] bg-[#FAFCFB] px-4 py-3">

                  <div className="flex items-center gap-2">

                    <CalendarDays
                      size={15}
                      className="text-[#4D8B78]"
                    />

                    <label className="text-xs font-extrabold uppercase tracking-wide text-[#527267]">
                      Tanggal Stock Opname
                    </label>

                  </div>

                  <p className="mt-1 text-[11px] leading-5 text-[#87958F]">
                    Tanggal kejadian opname
                    yang akan disimpan ke sistem.
                  </p>

                </div>

                <input
                  type="date"
                  value={opnameDate}
                  onChange={(event) =>
                    setOpnameDate(
                      event.target
                        .value
                    )
                  }
                  disabled={saving}
                  className="h-12 w-full rounded-xl border border-[#D2E2DB] bg-white px-4 text-sm font-bold text-[#23473C] outline-none transition hover:border-[#BCD2C8] focus:border-[#4D8B78] focus:ring-4 focus:ring-[#4D8B78]/10 disabled:cursor-not-allowed disabled:bg-[#F3F5F4] md:w-[190px]"
                />

              </div>

              <div
                className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-xs leading-5 ${
                  opnameType ===
                  "WEEKLY"
                    ? "border-[#D9EBDD] bg-[#F0F8F2] text-[#477452]"
                    : "border-[#F0DFC0] bg-[#FFF9ED] text-[#896821]"
                }`}
              >
                {opnameType ===
                "WEEKLY" ? (
                  <CheckCircle2
                    size={15}
                    className="mt-0.5 shrink-0"
                  />
                ) : (
                  <Clock3
                    size={15}
                    className="mt-0.5 shrink-0"
                  />
                )}

                <div>
                  {opnameType ===
                  "WEEKLY" ? (
                    <>
                      <span className="font-extrabold">
                        Stock Opname Mingguan.
                      </span>{" "}
                      Hasil opname langsung
                      selesai dan tidak
                      memerlukan approval.
                    </>
                  ) : (
                    <>
                      <span className="font-extrabold">
                        Stock Opname Bulanan.
                      </span>{" "}
                      Hasil opname akan masuk
                      approval sebelum stock
                      outlet diperbarui.
                    </>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* =================================================
            ADMIN WARNING
        ================================================= */}

        {isAdminPusat &&
          selectedOutletId <=
            0 && (
            <div className="mb-6 overflow-hidden rounded-[22px] border border-[#F0DEB7] bg-gradient-to-r from-[#FFF9EB] to-[#FFFDF7] shadow-sm">

              <div className="flex items-start gap-4 p-5">

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF0C9] text-[#A47720]">
                  <AlertTriangle
                    size={19}
                  />
                </div>

                <div className="min-w-0">
                  <p className="font-extrabold text-[#745817]">
                    Outlet belum dipilih
                  </p>

                  <p className="mt-1 text-sm leading-6 text-[#967531]">
                    Silakan pilih outlet terlebih
                    dahulu untuk menampilkan
                    stock dan melakukan Stock
                    Opname.
                  </p>
                </div>

              </div>
            </div>
          )}

        {/* =================================================
            KPI SUMMARY
        ================================================= */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <PremiumSummaryCard
            label="Total Barang"
            value={formatNumber(
              totalBarang
            )}
            description="Item terdaftar"
            icon={
              <Boxes size={20} />
            }
            accent="green"
          />

          <PremiumSummaryCard
            label="Stock Sistem"
            value={formatNumber(
              totalSystemQty
            )}
            description="Qty menurut sistem"
            icon={
              <Package size={20} />
            }
            accent="blue"
          />

          <PremiumSummaryCard
            label="Stock Fisik"
            value={formatNumber(
              totalPhysicalQty
            )}
            description="Qty hasil perhitungan"
            icon={
              <Scale size={20} />
            }
            accent="purple"
          />

          <PremiumSummaryCard
            label="Total Selisih"
            value={`${
              totalDifference > 0
                ? "+"
                : ""
            }${formatNumber(
              totalDifference
            )}`}
            description={`${totalSelisihBarang} barang berbeda`}
            icon={
              totalDifference > 0 ? (
                <TrendingUp
                  size={20}
                />
              ) : totalDifference < 0 ? (
                <TrendingDown
                  size={20}
                />
              ) : (
                <Minus size={20} />
              )
            }
            accent={
              totalDifference === 0
                ? "green"
                : "red"
            }
            valueClass={
              totalDifference === 0
                ? "text-[#2F7A4F]"
                : "text-[#C84B4B]"
            }
          />

        </div>

        {/* =================================================
            ACCURACY STRIP
        ================================================= */}

        <div className="mb-6 overflow-hidden rounded-[22px] border border-[#DCE9E3] bg-white shadow-[0_8px_28px_rgba(28,63,51,0.055)]">

          <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:px-5">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EDF7F1] text-[#3D7A63]">
                <FileCheck2
                  size={18}
                />
              </div>

              <div>
                <p className="text-sm font-extrabold text-[#23473C]">
                  Akurasi Pemeriksaan
                </p>

                <p className="text-[11px] text-[#82918B]">
                  Barang tanpa selisih terhadap
                  stock sistem
                </p>
              </div>

            </div>

            <div className="flex items-center gap-4 md:min-w-[330px]">

              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#EAF0ED]">

                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#5A9C85] to-[#37725F] transition-all duration-500"
                  style={{
                    width: `${accuracy}%`,
                  }}
                />

              </div>

              <div className="min-w-[58px] text-right">

                <span className="text-lg font-black text-[#2E6655]">
                  {accuracy}%
                </span>

              </div>

            </div>

            <div className="flex items-center gap-3 border-l-0 md:border-l md:border-[#E5ECE9] md:pl-5">

              <div className="text-right">

                <p className="text-[10px] font-bold uppercase tracking-wide text-[#9AA7A2]">
                  Sesuai
                </p>

                <p className="text-sm font-black text-[#397456]">
                  {formatNumber(
                    matchingItems
                  )}
                </p>

              </div>

              <div className="h-8 w-px bg-[#E4EBE8]" />

              <div className="text-right">

                <p className="text-[10px] font-bold uppercase tracking-wide text-[#9AA7A2]">
                  Selisih
                </p>

                <p className="text-sm font-black text-[#C05252]">
                  {formatNumber(
                    totalSelisihBarang
                  )}
                </p>

              </div>

            </div>

          </div>
        </div>

        {/* =================================================
            TABLE
        ================================================= */}

        <div className="overflow-hidden rounded-[24px] border border-[#DCE9E3] bg-white shadow-[0_12px_36px_rgba(28,63,51,0.065)]">

          <div className="border-b border-[#E4ECE8] bg-white p-5 md:px-6">

            <div className="flex flex-col gap-5">

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                <div className="flex items-start gap-3">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0F6F3] text-[#4D8B78]">
                    <Boxes
                      size={18}
                    />
                  </div>

                  <div>

                    <div className="flex flex-wrap items-center gap-2">

                      <h2 className="text-base font-extrabold text-[#193A31]">
                        Daftar Barang
                      </h2>

                      {!loading && (
                        <span className="rounded-full bg-[#EDF5F1] px-2 py-0.5 text-[10px] font-bold text-[#55776C]">
                          {formatNumber(
                            filteredData.length
                          )}{" "}
                          item
                        </span>
                      )}

                    </div>

                    <p className="mt-1 text-xs leading-5 text-[#87948F]">
                      Masukkan jumlah fisik berdasarkan
                      hasil perhitungan aktual di outlet.
                    </p>

                  </div>

                </div>

                <div className="flex flex-col gap-2 sm:flex-row">

                  {/* =================================================
                      CATEGORY FILTER — MULTI SELECT
                  ================================================= */}

                  <div className="relative w-full sm:w-auto">

                    <div className="flex min-h-11 max-w-full flex-wrap items-center gap-1.5 rounded-xl border border-[#D7E5DF] bg-[#FAFCFB] p-1.5 sm:max-w-[520px]">

                      <div className="flex shrink-0 items-center gap-1.5 px-1.5 text-[#789188]">
                        <ListFilter size={16} />
                        <span className="text-[10px] font-extrabold uppercase tracking-[0.05em]">
                          Kategori
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={resetCategoryFilter}
                        disabled={loading || saving || data.length === 0}
                        className={`rounded-lg px-2.5 py-2 text-[11px] font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          selectedCategories.length === 0
                            ? "bg-[#4D8B78] text-white shadow-sm"
                            : "text-[#5C746B] hover:bg-[#EAF5F0]"
                        }`}
                      >
                        Semua
                      </button>

                      {categories.map((category) => {
                        const active = selectedCategories.includes(category);

                        return (
                          <button
                            key={category}
                            type="button"
                            onClick={() => toggleCategory(category)}
                            disabled={loading || saving || data.length === 0}
                            className={`rounded-lg px-2.5 py-2 text-[11px] font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              active
                                ? "bg-[#4D8B78] text-white shadow-sm"
                                : "text-[#5C746B] hover:bg-[#EAF5F0]"
                            }`}
                          >
                            {category}
                          </button>
                        );
                      })}

                    </div>

                    {selectedCategories.length > 0 && (
                      <p className="mt-1.5 text-[10px] font-semibold text-[#71847C]">
                        {selectedCategories.length} kategori dipilih · klik kategori untuk memilih lebih dari satu.
                      </p>
                    )}

                  </div>

                  {/* =================================================
                      SEARCH
                  ================================================= */}

                  <div className="relative w-full sm:w-[330px]">

                    <Search
                      size={17}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A29C]"
                    />

                    <input
                      value={search}
                      onChange={(e) =>
                        setSearch(
                          e.target.value
                        )
                      }
                      placeholder="Cari kode, nama, kategori, atau satuan..."
                      className="h-11 w-full rounded-xl border border-[#D7E5DF] bg-[#FAFCFB] pl-10 pr-16 text-sm font-medium text-[#294B40] outline-none transition placeholder:text-[#A1ADA8] hover:border-[#C5D8CF] focus:border-[#4D8B78] focus:bg-white focus:ring-4 focus:ring-[#4D8B78]/10"
                    />

                    {search && (
                      <button
                        type="button"
                        onClick={() =>
                          setSearch(
                            ""
                          )
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-1 text-[11px] font-bold text-[#71837B] hover:bg-[#EDF4F1]"
                      >
                        Clear
                      </button>
                    )}

                  </div>

                </div>

              </div>

              {/* =================================================
                  FILTER INFO + PDF
              ================================================= */}

              <div className="flex flex-col gap-3 rounded-[18px] border border-[#E2ECE7] bg-[#F8FBF9] p-3.5 md:flex-row md:items-center md:justify-between">

                <div className="flex min-w-0 items-center gap-3">

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#4D8B78] shadow-sm ring-1 ring-[#E0EAE5]">
                    <Tag
                      size={15}
                    />
                  </div>

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#81938B]">
                        Filter aktif
                      </span>

                      <span className="rounded-full bg-[#EAF5F0] px-2 py-1 text-[10px] font-extrabold text-[#3D7763]">
                        {selectedCategories.length === 0
                          ? "Semua Kategori"
                          : `${selectedCategories.length} Kategori`}
                      </span>

                      {search && (
                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[#61766E] ring-1 ring-[#DCE8E2]">
                          Search: "{search}"
                        </span>
                      )}

                    </div>

                    <p className="mt-1 text-[10px] text-[#92A09A]">
                      Form Manual PDF mengikuti kategori dan pencarian aktif.
                      Perubahan Stock Fisik dapat disimpan dan dipulihkan kembali.
                    </p>

                  </div>

                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">

                  {draftSavedAt && (
                    <span className="hidden items-center gap-1.5 rounded-xl border border-[#DCE9E3] bg-white px-3 py-2 text-[10px] font-bold text-[#6F817A] lg:inline-flex">
                      <CheckCircle2 size={13} className="text-[#4D8B78]" />
                      Tersimpan {new Date(draftSavedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveChanges}
                    disabled={
                      loading ||
                      saving ||
                      data.length === 0 ||
                      (isAdminPusat && selectedOutletId <= 0)
                    }
                    className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-xs font-extrabold shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${
                      hasUnsavedChanges
                        ? "border border-[#4D8B78] bg-[#4D8B78] text-white shadow-[0_8px_18px_rgba(77,139,120,0.22)] hover:bg-[#3F7867]"
                        : "border border-[#C7DED3] bg-white text-[#39725F] hover:border-[#A9C9BA] hover:bg-[#EDF7F2]"
                    }`}
                  >
                    <Save size={15} />
                    {hasUnsavedChanges ? "Simpan Perubahan" : "Perubahan Tersimpan"}
                  </button>

                  <button
                    type="button"
                    onClick={handleExportManualPdf}
                    disabled={
                      loading ||
                      saving ||
                      exportingPdf ||
                      filteredData.length === 0 ||
                      (isAdminPusat && selectedOutletId <= 0)
                    }
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#C7DED3] bg-white px-4 text-xs font-extrabold text-[#39725F] shadow-sm transition hover:-translate-y-0.5 hover:border-[#A9C9BA] hover:bg-[#EDF7F2] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {exportingPdf ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <FileDown size={15} />
                    )}
                    {exportingPdf ? "Membuat Form..." : "PDF Form Hitung Manual"}
                  </button>

                </div>

              </div>

            </div>
          </div>

          <div className="overflow-x-auto">

            <table className="w-full min-w-[1450px] text-sm">

              <thead>
                <tr className="border-b border-[#E1EAE6] bg-[#F7FAF8]">

                  <th className="px-6 py-4 text-left text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#6A8077]">
                    Kode
                  </th>

                  <th className="px-6 py-4 text-left text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#6A8077]">
                    Kategori
                  </th>

                  <th className="px-6 py-4 text-left text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#6A8077]">
                    Barang
                  </th>

                  <th className="px-6 py-4 text-center text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#6A8077]">
                    Satuan
                  </th>

                  <th className="px-6 py-4 text-right text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#6A8077]">
                    Stock Sistem
                  </th>

                  <th className="px-6 py-4 text-right text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#6A8077]">
                    Stock Fisik
                  </th>

                  <th className="px-6 py-4 text-right text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#6A8077]">
                    Selisih
                  </th>

                  <th className="px-6 py-4 text-left text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#6A8077]">
                    Catatan
                  </th>

                  <th className="px-6 py-4 text-center text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#6A8077]">
                    Status
                  </th>

                </tr>
              </thead>

              <tbody>

                {loading ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-20 text-center"
                    >
                      <div className="mx-auto flex max-w-xs flex-col items-center">

                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EDF6F2] text-[#4D8B78]">
                          <RefreshCw
                            size={23}
                            className="animate-spin"
                          />
                        </div>

                        <p className="text-sm font-bold text-[#3D5E53]">
                          Memuat stock outlet
                        </p>

                        <p className="mt-1 text-xs text-[#98A59F]">
                          Mengambil data terbaru dari
                          sistem...
                        </p>

                      </div>
                    </td>
                  </tr>
                ) : filteredData.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-20 text-center"
                    >
                      <div className="mx-auto flex max-w-sm flex-col items-center">

                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#F2F6F4] text-[#A4B1AB]">
                          {search ||
                          selectedCategories.length > 0 ? (
                            <Search
                              size={25}
                            />
                          ) : (
                            <Package
                              size={25}
                            />
                          )}
                        </div>

                        <p className="text-sm font-extrabold text-[#516760]">
                          {search ||
                          selectedCategories.length > 0
                            ? "Barang tidak ditemukan"
                            : isAdminPusat &&
                              selectedOutletId <=
                                0
                            ? "Pilih outlet terlebih dahulu"
                            : "Belum ada stock barang"}
                        </p>

                        <p className="mt-1 text-xs leading-5 text-[#98A49F]">
                          {search ||
                          selectedCategories.length > 0
                            ? "Coba ubah kata kunci atau pilih kategori yang berbeda."
                            : isAdminPusat &&
                              selectedOutletId <=
                                0
                            ? "Pilih outlet pada panel di atas untuk menampilkan daftar stock."
                            : "Belum terdapat data stock untuk outlet yang dipilih."}
                        </p>

                        {(search ||
                          selectedCategories.length > 0) && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearch(
                                ""
                              );
                              setSelectedCategories([]);
                            }}
                            className="mt-4 rounded-xl bg-[#EDF6F2] px-4 py-2 text-xs font-extrabold text-[#3E7764] transition hover:bg-[#E2F0EA]"
                          >
                            Reset Filter
                          </button>
                        )}

                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredData.map(
                    (item) => {
                      const difference =
                        getDifference(
                          item
                        );

                      const isMatch =
                        difference ===
                        0;

                      const isSurplus =
                        difference >
                        0;

                      return (
                        <tr
                          key={item.id}
                          className="group border-b border-[#EDF2EF] transition last:border-b-0 hover:bg-[#FBFDFC]"
                        >

                          <td className="px-6 py-4 align-middle">

                            <span className="inline-flex rounded-lg bg-[#F1F6F3] px-2.5 py-1.5 font-mono text-xs font-bold text-[#42685B]">
                              {
                                item.barang
                                  .code
                              }
                            </span>

                          </td>

                          {/* KATEGORI */}

                          <td className="px-6 py-4 align-middle">

                            <div className="inline-flex items-center gap-2 rounded-lg bg-[#F5F8F6] px-2.5 py-1.5">

                              <Tag
                                size={13}
                                className="shrink-0 text-[#6F9185]"
                              />

                              <span className="max-w-[180px] truncate text-xs font-bold text-[#55736A]">
                                {getCategoryName(
                                  item.barang
                                )}
                              </span>

                            </div>

                          </td>

                          {/* BARANG */}

                          <td className="px-6 py-4 align-middle">

                            <div className="flex items-center gap-3">

                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F6F8F7] text-[#82938B] transition group-hover:bg-[#EDF6F2] group-hover:text-[#4D8B78]">
                                <Package
                                  size={16}
                                />
                              </div>

                              <div className="min-w-0">

                                <div className="font-bold text-[#23463B]">
                                  {
                                    item
                                      .barang
                                      .name
                                  }
                                </div>

                                {item
                                  .minimumStock >
                                  0 && (
                                  <div className="mt-0.5 text-[10px] text-[#9AA7A1]">
                                    Minimum stock:{" "}
                                    {formatNumber(
                                      item.minimumStock
                                    )}
                                  </div>
                                )}

                              </div>

                            </div>
                          </td>

                          {/* SATUAN */}

                          <td className="px-6 py-4 text-center align-middle">

                            <span className="text-xs font-bold uppercase text-[#74847E]">
                              {
                                item
                                  .barang
                                  .unit
                              }
                            </span>

                          </td>

                          {/* STOCK SISTEM */}

                          <td className="px-6 py-4 text-right align-middle">

                            <span className="text-sm font-bold text-[#5A6D66]">
                              {formatNumber(
                                item.stock
                              )}
                            </span>

                          </td>

                          {/* STOCK FISIK */}

                          <td className="px-6 py-4 text-right align-middle">

                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={
                                item.physicalQty
                              }
                              onChange={(e) =>
                                updatePhysicalQty(
                                  item.id,
                                  e.target
                                    .value
                                )
                              }
                              className="h-10 w-28 rounded-xl border border-[#C9DDD4] bg-white px-3 text-right text-sm font-extrabold text-[#21473B] shadow-sm outline-none transition hover:border-[#AFC9BD] focus:border-[#4D8B78] focus:ring-4 focus:ring-[#4D8B78]/10"
                            />

                          </td>

                          {/* SELISIH */}

                          <td className="px-6 py-4 text-right align-middle">

                            <div
                              className={`inline-flex min-w-[82px] items-center justify-end gap-1 rounded-lg px-2.5 py-1.5 text-xs font-black ${
                                isMatch
                                  ? "bg-[#F3F6F4] text-[#98A59F]"
                                  : isSurplus
                                  ? "bg-[#EAF7EF] text-[#347650]"
                                  : "bg-[#FFF0F0] text-[#C04D4D]"
                              }`}
                            >
                              {isMatch ? (
                                <Minus
                                  size={13}
                                />
                              ) : isSurplus ? (
                                <TrendingUp
                                  size={13}
                                />
                              ) : (
                                <TrendingDown
                                  size={13}
                                />
                              )}

                              {difference >
                              0
                                ? "+"
                                : ""}
                              {formatNumber(
                                difference
                              )}
                            </div>

                          </td>

                          {/* CATATAN */}

                          <td className="px-6 py-4 align-middle">

                            <input
                              value={
                                item.note
                              }
                              onChange={(e) =>
                                updateNote(
                                  item.id,
                                  e.target
                                    .value
                                )
                              }
                              placeholder="Tambahkan catatan..."
                              className="h-10 w-52 rounded-xl border border-[#D9E5E0] bg-[#FCFDFC] px-3 text-xs font-medium text-[#3D574E] outline-none transition placeholder:text-[#A7B1AD] hover:border-[#C8DAD2] focus:border-[#4D8B78] focus:bg-white focus:ring-4 focus:ring-[#4D8B78]/10"
                            />

                          </td>

                          {/* STATUS */}

                          <td className="px-6 py-4 text-center align-middle">

                            {isMatch ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D5EBDD] bg-[#F0F8F2] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[#397250]">
                                <CheckCircle2
                                  size={13}
                                />
                                Sesuai
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F0E1BE] bg-[#FFF9EC] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[#976E22]">
                                <AlertTriangle
                                  size={13}
                                />
                                Selisih
                              </span>
                            )}

                          </td>

                        </tr>
                      );
                    }
                  )
                )}

              </tbody>
            </table>
          </div>

          {!loading &&
            filteredData.length >
              0 && (
              <div className="border-t border-[#E2EAE7] bg-[#FAFCFB] px-5 py-4 md:px-6">

                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

                  <div className="flex items-center gap-2 text-xs text-[#82908B]">

                    <CircleDot
                      size={13}
                      className="text-[#71A18F]"
                    />

                    <span>
                      Menampilkan{" "}
                      <strong className="font-extrabold text-[#48665C]">
                        {formatNumber(
                          filteredData.length
                        )}
                      </strong>{" "}
                      dari{" "}
                      <strong className="font-extrabold text-[#48665C]">
                        {formatNumber(
                          totalBarang
                        )}
                      </strong>{" "}
                      barang
                    </span>

                  </div>

                  <div className="flex flex-wrap items-center gap-2">

                    <FooterMetric
                      label="Sistem"
                      value={formatNumber(
                        totalSystemQty
                      )}
                    />

                    <FooterMetric
                      label="Fisik"
                      value={formatNumber(
                        totalPhysicalQty
                      )}
                    />

                    <FooterMetric
                      label="Selisih"
                      value={`${
                        totalDifference >
                        0
                          ? "+"
                          : ""
                      }${formatNumber(
                        totalDifference
                      )}`}
                      valueClass={
                        totalDifference ===
                        0
                          ? "text-[#397451]"
                          : "text-[#C04D4D]"
                      }
                    />

                    <div className="hidden h-7 w-px bg-[#DCE6E2] sm:block" />

                    <div className="inline-flex items-center gap-2 rounded-lg bg-[#EEF7F2] px-3 py-2">

                      <ShieldCheck
                        size={14}
                        className="text-[#397451]"
                      />

                      <span className="text-[10px] font-bold text-[#557467]">
                        Akurasi
                      </span>

                      <span className="text-xs font-black text-[#397451]">
                        {accuracy}%
                      </span>

                    </div>

                  </div>

                </div>
              </div>
            )}

        </div>

        {!loading &&
          data.length > 0 && (
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">

            <InfoMiniCard
              icon={
                <ClipboardCheck
                  size={16}
                />
              }
              title="Pemeriksaan Fisik"
              text="Jumlah fisik menjadi dasar perbandingan dengan stock sistem."
            />

            <InfoMiniCard
              icon={
                <AlertTriangle
                  size={16}
                />
              }
              title="Periksa Selisih"
              text="Pastikan setiap perbedaan qty memiliki catatan yang jelas."
            />

            <InfoMiniCard
              icon={
                <Save size={16} />
              }
              title={
                opnameType ===
                "WEEKLY"
                  ? "Simpan & Selesai"
                  : "Simpan untuk Approval"
              }
              text={
                opnameType ===
                "WEEKLY"
                  ? "Opname mingguan akan langsung selesai setelah disimpan."
                  : "Opname bulanan menunggu approval sebelum stock diperbarui."
              }
            />

          </div>
        )}

      </div>
    </div>
  );
}

// =====================================================
// PREMIUM SUMMARY CARD
// =====================================================

function PremiumSummaryCard({
  label,
  value,
  description,
  icon,
  accent,
  valueClass = "text-[#193A31]",
}: {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  accent:
    | "green"
    | "blue"
    | "purple"
    | "red";
  valueClass?: string;
}) {
  const accentClasses = {
    green: {
      icon:
        "bg-[#EAF6F0] text-[#3E7B65]",
      glow:
        "bg-[#DDF1E8]",
    },

    blue: {
      icon:
        "bg-[#EDF4FA] text-[#477A9C]",
      glow:
        "bg-[#E2EEF7]",
    },

    purple: {
      icon:
        "bg-[#F2EFFA] text-[#705E99]",
      glow:
        "bg-[#ECE6F7]",
    },

    red: {
      icon:
        "bg-[#FFF0F0] text-[#C45454]",
      glow:
        "bg-[#FBE4E4]",
    },
  };

  return (
    <div className="group relative overflow-hidden rounded-[22px] border border-[#DCE9E3] bg-white p-5 shadow-[0_8px_28px_rgba(28,63,51,0.055)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(28,63,51,0.09)]">

      <div
        className={`absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl opacity-60 ${accentClasses[accent].glow}`}
      />

      <div className="relative">

        <div className="flex items-start justify-between">

          <div>

            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8A9993]">
              {label}
            </p>

            <p
              className={`mt-2 text-[28px] font-black tracking-tight ${valueClass}`}
            >
              {value}
            </p>

            <p className="mt-1 text-[11px] font-medium text-[#98A49F]">
              {description}
            </p>

          </div>

          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${accentClasses[accent].icon}`}
          >
            {icon}
          </div>

        </div>

        <div className="mt-4 h-1 overflow-hidden rounded-full bg-[#F0F3F2]">

          <div
            className={`h-full w-1/2 rounded-full transition-all duration-500 group-hover:w-3/4 ${
              accent ===
              "green"
                ? "bg-[#5C9D86]"
                : accent ===
                  "blue"
                ? "bg-[#6A98B7]"
                : accent ===
                  "purple"
                ? "bg-[#8C7BB2]"
                : "bg-[#D87575]"
            }`}
          />

        </div>

      </div>
    </div>
  );
}

// =====================================================
// FOOTER METRIC
// =====================================================

function FooterMetric({
  label,
  value,
  valueClass = "text-[#284B40]",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-[#E0E9E5] bg-white px-3 py-2">

      <p className="text-[9px] font-extrabold uppercase tracking-wide text-[#9AA7A2]">
        {label}
      </p>

      <p
        className={`mt-0.5 text-xs font-black ${valueClass}`}
      >
        {value}
      </p>

    </div>
  );
}

// =====================================================
// INFO MINI CARD
// =====================================================

function InfoMiniCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[18px] border border-[#DCE9E3] bg-white px-4 py-3.5 shadow-sm">

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EDF6F2] text-[#4D8B78]">
        {icon}
      </div>

      <div className="min-w-0">

        <p className="text-xs font-extrabold text-[#36594E]">
          {title}
        </p>

        <p className="mt-1 text-[10px] leading-4 text-[#8A9792]">
          {text}
        </p>

      </div>

      <ArrowRight
        size={13}
        className="ml-auto mt-1 shrink-0 text-[#B3C0BB]"
      />

    </div>
  );
}