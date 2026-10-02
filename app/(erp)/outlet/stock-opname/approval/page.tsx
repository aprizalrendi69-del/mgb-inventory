"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Search,
  RefreshCw,
  ClipboardCheck,
  Package,
  CheckCircle2,
  AlertTriangle,
  Eye,
  X,
  UserCheck,
  Trash2,
  CalendarDays,
  Pencil,
  Save,
  FileDown,
  SlidersHorizontal,
} from "lucide-react";

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type Barang = {
  id: number;
  code: string;
  name: string;
  unit: string;
  category?: string | null;
  purchasePrice: number;
  sellingPrice: number;
  stock?: number | null;
};

type StockOpnameItem = {
  id: number | null;
  opnameId: number;
  barangId: number;
  systemQty: number;
  physicalQty: number;
  difference: number;
  note?: string | null;
  barang: Barang;
};

type StockOpname = {
  id: number;
  code: string;
  date: string;
  type: string;
  status: string;
  createdBy?: number | null;
  approvedBy?: number | null;
  createdAt: string;
  updatedAt: string;
  outlet: Outlet;
  items: StockOpnameItem[];
};

type LoginUser = {
  id: number;
  fullname: string;
  role: string;
  outletId?: number | null;
};

export default function OutletStockOpnameApprovalPage() {
  const [data, setData] = useState<StockOpname[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outlet, setOutlet] = useState<Outlet | null>(null);
  const [user, setUser] = useState<LoginUser | null>(null);

  const [search, setSearch] = useState("");
  const [outletFilter, setOutletFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const [selected, setSelected] = useState<StockOpname | null>(null);
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [loadingOutletMaster, setLoadingOutletMaster] = useState(false);

  const [editItems, setEditItems] = useState<
    Record<number, { physicalQty: string; note: string }>
  >({});

  const [detailSearch, setDetailSearch] = useState("");
  const [detailCategory, setDetailCategory] = useState("");
  const [pdfGenerating, setPdfGenerating] = useState(false);

  // =====================================================
  // ROLE
  // =====================================================

  const currentRole = String(user?.role || "").toUpperCase();

  const isAdminPusat = currentRole === "ADMIN";
  const isManager = currentRole === "MANAGER";
  const isOutletAdmin = currentRole === "OUTLET_ADMIN";

  // =====================================================
  // SAFE UNIQUE KEYS
  // =====================================================

  /*
   * React tidak boleh menerima key null / undefined.
   *
   * Beberapa data detail Stock Opname lama dapat mempunyai
   * id null. Karena itu key detail tidak hanya bergantung
   * kepada item.id.
   *
   * Urutan prioritas:
   * 1. ID detail database
   * 2. barangId
   * 3. index
   *
   * Ditambah opnameId agar tetap unik antar Stock Opname.
   */
  function getDetailRowKey(
    opnameId: number,
    item: StockOpnameItem,
    index: number
  ) {
    const itemId =
      item.id !== null &&
      item.id !== undefined &&
      Number.isFinite(Number(item.id))
        ? `item-${Number(item.id)}`
        : null;

    const barangId =
      Number.isFinite(Number(item.barangId)) &&
      Number(item.barangId) > 0
        ? `barang-${Number(item.barangId)}`
        : null;

    if (itemId) {
      return `opname-${opnameId}-${itemId}`;
    }

    if (barangId) {
      return `opname-${opnameId}-${barangId}-row-${index}`;
    }

    return `opname-${opnameId}-detail-${index}`;
  }

  function getOutletKey(item: Outlet, index: number) {
    const id = Number(item?.id);

    if (Number.isFinite(id) && id > 0) {
      return `outlet-${id}`;
    }

    return `outlet-fallback-${index}-${String(
      item?.code || item?.name || "unknown"
    )}`;
  }

  function getCategoryKey(category: string, index: number) {
    return `category-${index}-${category}`;
  }

  // =====================================================
  // HELPER TYPE
  // =====================================================

  function isMonthly(opname: StockOpname) {
    return String(opname.type || "").toUpperCase() === "MONTHLY";
  }

  function isWeekly(opname: StockOpname) {
    return String(opname.type || "").toUpperCase() === "WEEKLY";
  }

  function typeLabel(type: string) {
    switch (String(type || "").toUpperCase()) {
      case "MONTHLY":
        return "Bulanan";

      case "WEEKLY":
        return "Mingguan";

      default:
        return type || "-";
    }
  }

  function typeClass(type: string) {
    switch (String(type || "").toUpperCase()) {
      case "MONTHLY":
        return "bg-[#EAF3EF] text-[#497F70]";

      case "WEEKLY":
        return "bg-gray-100 text-gray-600";

      default:
        return "bg-gray-100 text-gray-500";
    }
  }

  // =====================================================
  // LOAD DATA
  // =====================================================

  async function loadData(
    customFilters?: {
      outletId?: string;
      dateFrom?: string;
      dateTo?: string;
      type?: string;
    }
  ) {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (isAdminPusat || isManager) {
        const selectedOutlet =
          customFilters?.outletId ?? outletFilter;

        const selectedDateFrom =
          customFilters?.dateFrom ?? dateFrom;

        const selectedDateTo =
          customFilters?.dateTo ?? dateTo;

        const selectedType =
          customFilters?.type ?? typeFilter;

        if (selectedOutlet) {
          params.set("outletId", selectedOutlet);
        }

        if (selectedDateFrom) {
          params.set("dateFrom", selectedDateFrom);
        }

        if (selectedDateTo) {
          params.set("dateTo", selectedDateTo);
        }

        if (
          selectedType === "WEEKLY" ||
          selectedType === "MONTHLY"
        ) {
          params.set("type", selectedType);
        }
      }

      const query = params.toString();

      const res = await fetch(
        query
          ? `/api/outlet/stock-opname/approval?${query}`
          : "/api/outlet/stock-opname/approval",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal mengambil data stock opname"
        );
      }

      setUser(json.user || null);
      setOutlet(json.outlet || null);

      setOutlets(
        Array.isArray(json.outlets)
          ? json.outlets
          : []
      );

      setData(
        Array.isArray(json.data)
          ? json.data
          : []
      );
    } catch (error: any) {
      console.error(
        "LOAD APPROVAL STOCK OPNAME ERROR:",
        error
      );

      alert(
        error?.message ||
          "Gagal mengambil data stock opname"
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // =====================================================
  // APPLY FILTER
  // =====================================================

  function handleApplyFilter() {
    if (!isAdminPusat && !isManager) {
      return;
    }

    loadData({
      outletId: outletFilter,
      dateFrom,
      dateTo,
      type: typeFilter,
    });
  }

  // =====================================================
  // RESET FILTER
  // =====================================================

  function handleResetFilter() {
    if (!isAdminPusat && !isManager) {
      return;
    }

    setOutletFilter("");
    setDateFrom("");
    setDateTo("");
    setTypeFilter("");

    loadData({
      outletId: "",
      dateFrom: "",
      dateTo: "",
      type: "",
    });
  }

  // =====================================================
  // SEARCH
  // =====================================================

  const filteredData = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    if (!keyword) {
      return data;
    }

    return data.filter((item) => {
      const text = [
        item.code,
        item.type,
        typeLabel(item.type),
        item.outlet?.code,
        item.outlet?.name,

        ...item.items.map(
          (detail) =>
            `${detail.barang?.code} ${detail.barang?.name}`
        ),
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(keyword);
    });
  }, [data, search]);

  // =====================================================
  // FORMAT
  // =====================================================

  function formatNumber(value: number) {
    return Number(value || 0).toLocaleString("id-ID");
  }

  function formatDate(value: string) {
    if (!value) {
      return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  // =====================================================
  // STATUS
  // =====================================================

  function statusLabel(status: string) {
    switch (String(status).toUpperCase()) {
      case "COUNTING":
        return "Menunggu Approval";

      case "COMPLETED":
        return "Selesai";

      case "APPROVED":
        return "Approved";

      default:
        return status || "-";
    }
  }

  function statusClass(status: string) {
    switch (String(status).toUpperCase()) {
      case "APPROVED":
        return "bg-[#E8F4EC] text-[#2F7A4F]";

      case "COUNTING":
        return "bg-[#FFF4DD] text-[#9A6A18]";

      case "COMPLETED":
        return "bg-[#EAF3EF] text-[#497F70]";

      default:
        return "bg-gray-100 text-gray-600";
    }
  }

  // =====================================================
  // SUMMARY
  // =====================================================

  const totalOpname = filteredData.length;

  const totalWaiting = filteredData.filter(
    (item) =>
      isMonthly(item) &&
      String(item.status).toUpperCase() === "COUNTING"
  ).length;

  const totalApproved = filteredData.filter(
    (item) =>
      String(item.status).toUpperCase() === "APPROVED"
  ).length;

  // =====================================================
  // DETAIL SUMMARY
  // =====================================================

  function getTotalSystem(opname: StockOpname) {
    return opname.items.reduce(
      (sum, item) =>
        sum + Number(item.systemQty || 0),
      0
    );
  }

  function getTotalPhysical(opname: StockOpname) {
    return opname.items.reduce(
      (sum, item) =>
        sum + Number(item.physicalQty || 0),
      0
    );
  }

  function getTotalDifference(opname: StockOpname) {
    return opname.items.reduce(
      (sum, item) =>
        sum + Number(item.difference || 0),
      0
    );
  }

  function getDifferenceCount(opname: StockOpname) {
    return opname.items.filter(
      (item) =>
        Number(item.difference || 0) !== 0
    ).length;
  }

  // =====================================================
  // MASTER BARANG OUTLET
  // =====================================================

  function normalizeBarang(raw: any): Barang | null {
    const id = Number(raw?.id ?? raw?.barangId);

    if (!Number.isFinite(id) || id <= 0) {
      return null;
    }

    return {
      id,
      code: String(
        raw?.code ??
          raw?.barang?.code ??
          "-"
      ),
      name: String(
        raw?.name ??
          raw?.barang?.name ??
          "-"
      ),
      unit: String(
        raw?.unit ??
          raw?.barang?.unit ??
          "-"
      ),
      category:
        raw?.category ??
        raw?.kategori ??
        raw?.barang?.category ??
        raw?.barang?.kategori ??
        null,
      purchasePrice: Number(
        raw?.purchasePrice ??
          raw?.barang?.purchasePrice ??
          0
      ),
      sellingPrice: Number(
        raw?.sellingPrice ??
          raw?.barang?.sellingPrice ??
          0
      ),
      stock:
        raw?.stock != null
          ? Number(raw.stock)
          : raw?.outletStock?.stock != null
          ? Number(raw.outletStock.stock)
          : raw?.stockQty != null
          ? Number(raw.stockQty)
          : null,
    };
  }

  async function getOutletMasterBarang(
    opname: StockOpname
  ) {
    const outletId = Number(opname.outlet?.id);

    if (!outletId) {
      return [];
    }

    const params = new URLSearchParams({
      source: "OUTLET",
      outletId: String(outletId),
    });

    const res = await fetch(
      `/api/master/barang?${params.toString()}`,
      {
        cache: "no-store",
      }
    );

    if (!res.ok) {
      throw new Error(
        "Gagal mengambil Master Barang Outlet."
      );
    }

    const json = await res.json();

    const rows = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.barang)
      ? json.barang
      : Array.isArray(json?.items)
      ? json.items
      : [];

    return rows
      .map(normalizeBarang)
      .filter(Boolean) as Barang[];
  }

  function mergeOutletMasterIntoOpname(
    opname: StockOpname,
    masterBarang: Barang[]
  ): StockOpname {
    if (!isWaitingApproval(opname)) {
      return opname;
    }

    const existingByBarangId = new Map(
      opname.items.map((item) => [
        Number(item.barangId),
        item,
      ])
    );

    const mergedItems = [...opname.items];

    for (const barang of masterBarang) {
      if (existingByBarangId.has(barang.id)) {
        continue;
      }

      const stockFromMaster =
        barang.stock != null &&
        Number.isFinite(Number(barang.stock))
          ? Number(barang.stock)
          : 0;

      mergedItems.push({
        id: -Math.abs(barang.id),
        opnameId: opname.id,
        barangId: barang.id,
        systemQty: stockFromMaster,
        physicalQty: 0,
        difference: -stockFromMaster,
        note: "",
        barang,
      });
    }

    return {
      ...opname,
      items: mergedItems,
      updatedAt: new Date().toISOString(),
    };
  }

  async function openDetail(
    opname: StockOpname
  ) {
    setDetailSearch("");
    setDetailCategory("");
    setEditing(false);
    setEditItems({});
    setSelected(opname);

    if (!isWaitingApproval(opname)) {
      return;
    }

    try {
      setLoadingOutletMaster(true);

      const masterBarang =
        await getOutletMasterBarang(opname);

      if (!masterBarang.length) {
        return;
      }

      const merged =
        mergeOutletMasterIntoOpname(
          opname,
          masterBarang
        );

      setSelected(merged);

      setData((current) =>
        current.map((item) =>
          item.id === merged.id
            ? merged
            : item
        )
      );
    } catch (error: any) {
      console.error(
        "LOAD MASTER BARANG OUTLET DETAIL ERROR:",
        error
      );

      alert(
        error?.message ||
          "Master Barang Outlet tidak dapat dimuat. Detail lama tetap ditampilkan."
      );
    } finally {
      setLoadingOutletMaster(false);
    }
  }

  const detailCategories = useMemo(() => {
    if (!selected) {
      return [];
    }

    return Array.from(
      new Set(
        selected.items
          .map((item) =>
            String(
              item.barang?.category || ""
            ).trim()
          )
          .filter(Boolean)
      )
    ).sort((a, b) =>
      a.localeCompare(b, "id")
    );
  }, [selected]);

  const filteredDetailItems = useMemo(() => {
    if (!selected) {
      return [];
    }

    const keyword =
      detailSearch.toLowerCase().trim();

    return selected.items.filter((item) => {
      const category = String(
        item.barang?.category || ""
      ).trim();

      const text = [
        item.barang?.code,
        item.barang?.name,
        item.barang?.unit,
        category,
        item.note,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !keyword ||
        text.includes(keyword);

      const matchesCategory =
        !detailCategory ||
        category === detailCategory;

      return (
        matchesSearch &&
        matchesCategory
      );
    });
  }, [
    selected,
    detailSearch,
    detailCategory,
  ]);

  // =====================================================
  // EDIT STOCK OPNAME
  // =====================================================

  function isWaitingApproval(
    opname: StockOpname | null
  ) {
    return (
      !!opname &&
      String(opname.status || "").toUpperCase() ===
        "COUNTING"
    );
  }

  function startEdit(opname: StockOpname) {
    if (!isWaitingApproval(opname)) {
      return;
    }

    const next: Record<
      number,
      {
        physicalQty: string;
        note: string;
      }
    > = {};

    opname.items.forEach(
      (item, index) => {
        /*
         * Item dengan id null perlu key edit yang aman.
         * Karena state editItems menggunakan number sebagai key,
         * gunakan barangId jika id detail belum tersedia.
         */
        const editKey =
          item.id !== null &&
          item.id !== undefined
            ? Number(item.id)
            : -Math.abs(
                Number(item.barangId) || index + 1
              );

        next[editKey] = {
          physicalQty: String(
            item.physicalQty ?? 0
          ),
          note: item.note || "",
        };
      }
    );

    /*
     * Untuk item lama dengan id null, updateEditItem akan
     * menggunakan helper ID yang sama.
     */
    setEditItems(next);
    setEditing(true);
  }

  function getEditItemKey(
    item: StockOpnameItem,
    index: number
  ) {
    if (
      item.id !== null &&
      item.id !== undefined
    ) {
      return Number(item.id);
    }

    return -Math.abs(
      Number(item.barangId) || index + 1
    );
  }

  function cancelEdit() {
    setEditing(false);
    setEditItems({});
  }

  function updateEditItem(
    itemId: number,
    field:
      | "physicalQty"
      | "note",
    value: string
  ) {
    setEditItems((current) => ({
      ...current,
      [itemId]: {
        physicalQty:
          current[itemId]
            ?.physicalQty ?? "0",
        note:
          current[itemId]?.note ?? "",
        [field]: value,
      },
    }));
  }

  async function handleSaveEdit() {
    if (
      !selected ||
      !isWaitingApproval(selected) ||
      savingEdit
    ) {
      return;
    }

    const items = selected.items.map(
      (item, index) => {
        const editKey =
          getEditItemKey(
            item,
            index
          );

        const draft =
          editItems[editKey];

        const physicalQty = Number(
          draft?.physicalQty ??
            item.physicalQty ??
            0
        );

        if (
          !Number.isFinite(
            physicalQty
          ) ||
          physicalQty < 0
        ) {
          throw new Error(
            `Qty fisik ${
              item.barang?.name ||
              "barang"
            } harus berupa angka >= 0.`
          );
        }

        return {
          id:
            item.id !== null &&
            item.id !== undefined &&
            Number(item.id) > 0
              ? Number(item.id)
              : undefined,
          barangId: item.barangId,
          physicalQty,
          note:
            draft?.note ??
            item.note ??
            "",
        };
      }
    );

    const confirmed =
      window.confirm(
        `Simpan perubahan Stock Opname ${selected.code}?\n\n` +
          `Perubahan qty fisik akan menggantikan hasil hitungan sebelumnya.\n` +
          `Status tetap Menunggu Approval sampai Admin melakukan approval.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setSavingEdit(true);

      const res = await fetch(
        "/api/outlet/stock-opname/approval",
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            opnameId: selected.id,
            items,
          }),
        }
      );

      const json = await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
            "Gagal menyimpan perubahan stock opname"
        );
      }

      const updated: StockOpname =
        json.data || {
          ...selected,
          updatedAt:
            new Date().toISOString(),
          items:
            selected.items.map(
              (item, index) => {
                const editKey =
                  getEditItemKey(
                    item,
                    index
                  );

                const draft =
                  editItems[
                    editKey
                  ];

                const physicalQty =
                  Number(
                    draft?.physicalQty ??
                      item.physicalQty ??
                      0
                  );

                return {
                  ...item,
                  physicalQty,
                  difference:
                    physicalQty -
                    Number(
                      item.systemQty || 0
                    ),
                  note:
                    draft?.note ??
                    item.note ??
                    "",
                };
              }
            ),
        };

      setData((current) =>
        current.map((item) =>
          item.id === updated.id
            ? updated
            : item
        )
      );

      setSelected(updated);
      setEditing(false);
      setEditItems({});

      alert(
        json.message ||
          "Perubahan Stock Opname berhasil disimpan. Status tetap Menunggu Approval."
      );

      await loadData();
    } catch (error: any) {
      console.error(
        "SAVE STOCK OPNAME EDIT ERROR:",
        error
      );

      alert(
        error?.message ||
          "Gagal menyimpan perubahan stock opname"
      );
    } finally {
      setSavingEdit(false);
    }
  }

  // =====================================================
  // PREMIUM PDF DETAIL
  // =====================================================

  function escapeHtml(value: unknown) {
    return String(value ?? "")
      .replaceAll(
        "&",
        "&amp;"
      )
      .replaceAll(
        "<",
        "&lt;"
      )
      .replaceAll(
        ">",
        "&gt;"
      )
      .replaceAll(
        '"',
        "&quot;"
      )
      .replaceAll(
        "'",
        "&#039;"
      );
  }

  function printDetailPdf(
    opname: StockOpname
  ) {
    if (!opname) {
      return;
    }

    try {
      setPdfGenerating(true);

      const rows =
        filteredDetailItems
          .map(
            (item, index) => {
              const difference =
                Number(
                  item.difference || 0
                );

              const category =
                item.barang
                  ?.category || "-";

              return `
                <tr>
                  <td class="center">${index + 1}</td>
                  <td>
                    <div class="code">${escapeHtml(
                      item.barang?.code
                    )}</div>
                    <div class="name">${escapeHtml(
                      item.barang?.name
                    )}</div>
                  </td>
                  <td>${escapeHtml(
                    category
                  )}</td>
                  <td class="center">${escapeHtml(
                    item.barang?.unit
                  )}</td>
                  <td class="right">${formatNumber(
                    item.systemQty
                  )}</td>
                  <td class="right">${formatNumber(
                    item.physicalQty
                  )}</td>
                  <td class="right ${
                    difference < 0
                      ? "minus"
                      : difference > 0
                      ? "plus"
                      : ""
                  }">
                    ${
                      difference > 0
                        ? "+"
                        : ""
                    }${formatNumber(
                      difference
                    )}
                  </td>
                  <td>${escapeHtml(
                    item.note || "-"
                  )}</td>
                </tr>
              `;
            }
          )
          .join("");

      const totalSystem =
        getTotalSystem(opname);

      const totalPhysical =
        getTotalPhysical(opname);

      const totalDifference =
        getTotalDifference(opname);

      const printWindow =
        window.open(
          "",
          "_blank",
          "width=1200,height=900"
        );

      if (!printWindow) {
        throw new Error(
          "Popup diblokir browser. Izinkan popup untuk mencetak PDF."
        );
      }

      printWindow.document.write(`
        <!doctype html>
        <html lang="id">
          <head>
            <meta charset="utf-8" />
            <title>${escapeHtml(
              opname.code
            )} - Detail Stock Opname</title>
            <style>
              @page {
                size: A4 landscape;
                margin: 12mm 10mm 14mm;
              }

              * {
                box-sizing: border-box;
              }

              body {
                margin: 0;
                color: #18352D;
                font-family: Arial, Helvetica, sans-serif;
                background: #ffffff;
                font-size: 10px;
              }

              .page {
                width: 100%;
              }

              .topbar {
                height: 7px;
                background: #497F70;
                border-radius: 5px 5px 0 0;
              }

              .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                padding: 18px 0 14px;
                border-bottom: 1px solid #DDE9E4;
              }

              .brand {
                display: flex;
                gap: 12px;
                align-items: center;
              }

              .brand-icon {
                width: 42px;
                height: 42px;
                border-radius: 10px;
                background: #EAF3EF;
                color: #497F70;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 19px;
                font-weight: 800;
              }

              .eyebrow {
                color: #6D827A;
                font-size: 8px;
                font-weight: 700;
                letter-spacing: 1.5px;
                text-transform: uppercase;
                margin-bottom: 4px;
              }

              h1 {
                margin: 0;
                font-size: 21px;
                line-height: 1.15;
                color: #18352D;
              }

              .subtitle {
                margin-top: 5px;
                color: #71817B;
                font-size: 9px;
              }

              .document-box {
                min-width: 190px;
                padding: 10px 12px;
                border: 1px solid #DDE9E4;
                border-radius: 9px;
                background: #FAFCFB;
              }

              .document-row {
                display: flex;
                justify-content: space-between;
                gap: 14px;
                margin: 3px 0;
              }

              .document-row span:first-child {
                color: #7A8983;
              }

              .document-row span:last-child {
                font-weight: 700;
                color: #18352D;
              }

              .summary {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 8px;
                margin: 12px 0;
              }

              .card {
                border: 1px solid #DDE9E4;
                border-radius: 8px;
                padding: 9px 10px;
                background: #fff;
              }

              .card-label {
                font-size: 7px;
                color: #7A8983;
                text-transform: uppercase;
                letter-spacing: .7px;
                font-weight: 700;
              }

              .card-value {
                margin-top: 5px;
                font-size: 14px;
                font-weight: 800;
                color: #18352D;
              }

              .table-wrap {
                border: 1px solid #DDE9E4;
                border-radius: 8px;
                overflow: hidden;
              }

              table {
                width: 100%;
                border-collapse: collapse;
              }

              thead {
                display: table-header-group;
              }

              th {
                background: #18352D;
                color: #fff;
                padding: 8px 7px;
                text-align: left;
                font-size: 8px;
                text-transform: uppercase;
                letter-spacing: .4px;
              }

              td {
                border-bottom: 1px solid #EDF2EF;
                padding: 7px;
                vertical-align: top;
                color: #35564C;
              }

              tr:nth-child(even) td {
                background: #FAFCFB;
              }

              .center {
                text-align: center;
              }

              .right {
                text-align: right;
              }

              .code {
                font-size: 8px;
                color: #497F70;
                font-weight: 700;
              }

              .name {
                margin-top: 2px;
                font-weight: 700;
                color: #18352D;
              }

              .plus {
                color: #2F7A4F;
                font-weight: 800;
              }

              .minus {
                color: #C84B4B;
                font-weight: 800;
              }

              .footer {
                margin-top: 12px;
                padding-top: 8px;
                border-top: 1px solid #DDE9E4;
                display: flex;
                justify-content: space-between;
                color: #7A8983;
                font-size: 7.5px;
              }

              .signature {
                margin-top: 22px;
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 20px;
                page-break-inside: avoid;
              }

              .signature-box {
                min-height: 55px;
                border-bottom: 1px solid #B8C8C1;
                position: relative;
              }

              .signature-label {
                position: absolute;
                bottom: -15px;
                width: 100%;
                text-align: center;
                font-size: 8px;
                color: #667770;
              }

              .note {
                margin-top: 8px;
                color: #7A8983;
                font-size: 7.5px;
              }
            </style>
          </head>

          <body>
            <div class="page">
              <div class="topbar"></div>

              <div class="header">
                <div class="brand">
                  <div class="brand-icon">MGB</div>

                  <div>
                    <div class="eyebrow">
                      Inventory Control • Stock Opname
                    </div>

                    <h1>
                      Detail Stock Opname
                    </h1>

                    <div class="subtitle">
                      ${escapeHtml(
                        opname.code
                      )} •
                      ${escapeHtml(
                        opname.outlet?.code
                      )} -
                      ${escapeHtml(
                        opname.outlet?.name
                      )}
                    </div>
                  </div>
                </div>

                <div class="document-box">
                  <div class="document-row">
                    <span>Nomor</span>
                    <span>${escapeHtml(
                      opname.code
                    )}</span>
                  </div>

                  <div class="document-row">
                    <span>Tanggal</span>
                    <span>${escapeHtml(
                      formatDate(
                        opname.date
                      )
                    )}</span>
                  </div>

                  <div class="document-row">
                    <span>Jenis</span>
                    <span>${escapeHtml(
                      typeLabel(
                        opname.type
                      )
                    )}</span>
                  </div>

                  <div class="document-row">
                    <span>Status</span>
                    <span>${escapeHtml(
                      statusLabel(
                        opname.status
                      )
                    )}</span>
                  </div>
                </div>
              </div>

              <div class="summary">
                <div class="card">
                  <div class="card-label">
                    Total Barang
                  </div>
                  <div class="card-value">
                    ${formatNumber(
                      filteredDetailItems.length
                    )}
                  </div>
                </div>

                <div class="card">
                  <div class="card-label">
                    Total Sistem
                  </div>
                  <div class="card-value">
                    ${formatNumber(
                      totalSystem
                    )}
                  </div>
                </div>

                <div class="card">
                  <div class="card-label">
                    Total Fisik
                  </div>
                  <div class="card-value">
                    ${formatNumber(
                      totalPhysical
                    )}
                  </div>
                </div>

                <div class="card">
                  <div class="card-label">
                    Total Selisih
                  </div>
                  <div class="card-value">
                    ${
                      totalDifference > 0
                        ? "+"
                        : ""
                    }${formatNumber(
                      totalDifference
                    )}
                  </div>
                </div>

                <div class="card">
                  <div class="card-label">
                    Filter
                  </div>

                  <div
                    class="card-value"
                    style="font-size:10px"
                  >
                    ${
                      detailCategory
                        ? escapeHtml(
                            detailCategory
                          )
                        : "Semua Kategori"
                    }

                    ${
                      detailSearch
                        ? ` • "${escapeHtml(
                            detailSearch
                          )}"`
                        : ""
                    }
                  </div>
                </div>
              </div>

              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style="width:4%">
                        No
                      </th>

                      <th style="width:22%">
                        Barang
                      </th>

                      <th style="width:13%">
                        Kategori
                      </th>

                      <th style="width:8%">
                        Satuan
                      </th>

                      <th style="width:10%;text-align:right">
                        Sistem
                      </th>

                      <th style="width:10%;text-align:right">
                        Fisik
                      </th>

                      <th style="width:10%;text-align:right">
                        Selisih
                      </th>

                      <th>
                        Catatan
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    ${
                      rows ||
                      `
                        <tr>
                          <td
                            colspan="8"
                            class="center"
                          >
                            Tidak ada data.
                          </td>
                        </tr>
                      `
                    }
                  </tbody>
                </table>
              </div>

              <div class="note">
                Dokumen dibuat dari detail Stock Opname pada saat dicetak.

                ${
                  isWaitingApproval(
                    opname
                  )
                    ? " Data yang masih menunggu approval dapat berubah sebelum approval final."
                    : ""
                }
              </div>

              <div class="signature">
                <div class="signature-box">
                  <div class="signature-label">
                    Dihitung / Dicek
                  </div>
                </div>

                <div class="signature-box">
                  <div class="signature-label">
                    Manager Outlet
                  </div>
                </div>

                <div class="signature-box">
                  <div class="signature-label">
                    Approval Pusat
                  </div>
                </div>
              </div>

              <div class="footer">
                <span>
                  MGB Inventory Control
                </span>

                <span>
                  Dicetak ${escapeHtml(
                    new Date().toLocaleString(
                      "id-ID"
                    )
                  )}
                </span>
              </div>
            </div>

            <script>
              window.onload = function () {
                setTimeout(function () {
                  window.print();
                }, 250);
              };
            </script>
          </body>
        </html>
      `);

      printWindow.document.close();
      printWindow.focus();
    } catch (error: any) {
      console.error(
        "PRINT STOCK OPNAME PDF ERROR:",
        error
      );

      alert(
        error?.message ||
          "Gagal membuat PDF detail stock opname."
      );
    } finally {
      setPdfGenerating(false);
    }
  }

  // =====================================================
  // APPROVE
  // ADMIN + MONTHLY + COUNTING
  // =====================================================

  async function handleApprove(
    opname: StockOpname
  ) {
    if (!isAdminPusat) {
      return;
    }

    if (!isMonthly(opname)) {
      alert(
        "Stock Opname Mingguan tidak memerlukan approval."
      );

      return;
    }

    if (
      String(opname.status).toUpperCase() !==
      "COUNTING"
    ) {
      return;
    }

    const difference =
      getTotalDifference(opname);

    const message =
      difference === 0
        ? `Approve ${opname.code}?\n\nJenis: Stock Opname Bulanan\nTidak ada selisih stock.`
        : `Approve ${opname.code}?\n\nJenis: Stock Opname Bulanan\nTotal selisih: ${
            difference > 0
              ? "+"
              : ""
          }${formatNumber(
            difference
          )}\n\nSetelah approve, stock outlet akan disesuaikan dengan stock fisik.`;

    const confirmed =
      window.confirm(message);

    if (!confirmed) {
      return;
    }

    try {
      setApproving(opname.id);

      const res = await fetch(
        "/api/outlet/stock-opname/approval",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            opnameId: opname.id,
          }),
        }
      );

      const json = await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
            "Gagal approve stock opname"
        );
      }

      alert(
        "Stock Opname Bulanan berhasil diapprove.\nStock outlet sudah diperbarui."
      );

      setSelected(null);

      await loadData();
    } catch (error: any) {
      console.error(
        "APPROVE STOCK OPNAME ERROR:",
        error
      );

      alert(
        error?.message ||
          "Gagal approve stock opname"
      );
    } finally {
      setApproving(null);
    }
  }

  // =====================================================
  // DELETE
  // ADMIN PUSAT
  // =====================================================

  async function handleDelete(
    opname: StockOpname
  ) {
    if (!isAdminPusat) {
      return;
    }

    const status =
      String(
        opname.status || ""
      ).toUpperCase();

    let warning = "";

    if (status === "APPROVED") {
      warning =
        "\n\nPERINGATAN: Stock Opname ini sudah APPROVED.";
    } else if (status === "COMPLETED") {
      warning =
        "\n\nStock Opname ini sudah selesai diproses.";
    } else if (status === "COUNTING") {
      warning =
        "\n\nStock Opname ini masih menunggu approval.";
    }

    const confirmed =
      window.confirm(
        `Hapus Stock Opname ${opname.code}?\n\n` +
          `Jenis: ${typeLabel(
            opname.type
          )}\n` +
          `Status: ${statusLabel(
            opname.status
          )}` +
          warning +
          `\n\nData stock opname dan seluruh detail barang akan dihapus.\n\nStock outlet tidak akan berubah.\n\nTindakan ini tidak dapat dibatalkan.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(opname.id);

      const res = await fetch(
        `/api/outlet/stock-opname/approval?opnameId=${opname.id}`,
        {
          method: "DELETE",
        }
      );

      const json = await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
            "Gagal menghapus stock opname"
        );
      }

      alert(
        json.message ||
          "Stock Opname berhasil dihapus."
      );

      if (
        selected?.id ===
        opname.id
      ) {
        setSelected(null);
      }

      await loadData();
    } catch (error: any) {
      console.error(
        "DELETE STOCK OPNAME ERROR:",
        error
      );

      alert(
        error?.message ||
          "Gagal menghapus stock opname"
      );
    } finally {
      setDeleting(null);
    }
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* HEADER */}

      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div className="flex items-center gap-3">

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
            <ClipboardCheck size={23} />
          </div>

          <div>

            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Approval Stock Opname
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Persetujuan hasil stock opname outlet
            </p>

            {isOutletAdmin &&
              outlet && (
                <p className="mt-1 text-xs font-semibold text-[#497F70]">
                  Outlet:{" "}
                  {outlet.code} -{" "}
                  {outlet.name}
                </p>
              )}

            {isAdminPusat && (
              <p className="mt-1 text-xs font-semibold text-[#497F70]">
                Admin Pusat
              </p>
            )}

            {isManager && (
              <p className="mt-1 text-xs font-semibold text-[#497F70]">
                Manager — Read Only
              </p>
            )}

          </div>

        </div>

        <button
          type="button"
          onClick={() =>
            loadData()
          }
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
            hover:bg-[#F5F8F6]
            disabled:opacity-50
          "
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

      </div>

      {/* SUMMARY */}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Total Opname
          </p>

          <p className="mt-2 text-2xl font-bold text-[#18352D]">
            {formatNumber(
              totalOpname
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Menunggu Approval
              </p>

              <p className="mt-2 text-2xl font-bold text-[#9A6A18]">
                {formatNumber(
                  totalWaiting
                )}
              </p>

            </div>

            <AlertTriangle
              size={21}
              className="text-[#9A6A18]"
            />

          </div>

        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Sudah Approved
              </p>

              <p className="mt-2 text-2xl font-bold text-[#2F7A4F]">
                {formatNumber(
                  totalApproved
                )}
              </p>

            </div>

            <CheckCircle2
              size={21}
              className="text-[#2F7A4F]"
            />

          </div>

        </div>

      </div>

      {/* TABLE */}

      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        {/* TOOLBAR */}

        <div className="border-b border-[#E5ECE9] px-5 py-4 md:px-6">

          <div className="flex flex-col gap-4">

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

              <div>

                <h2 className="font-semibold text-[#18352D]">
                  Daftar Stock Opname
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  {isAdminPusat
                    ? "Admin Pusat dapat filter, approve stock opname bulanan, dan menghapus semua stock opname."
                    : isManager
                    ? "Manager hanya dapat melihat data stock opname."
                    : "Anda hanya dapat melihat stock opname outlet Anda."}
                </p>

              </div>

              <div className="relative w-full md:w-80">

                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="Cari nomor opname atau barang..."
                  className="
                    w-full
                    rounded-xl
                    border
                    border-[#D5E5DC]
                    bg-[#FAFCFB]
                    py-2.5
                    pl-9
                    pr-4
                    text-sm
                    outline-none
                    focus:border-[#497F70]
                  "
                />

              </div>

            </div>

            {/* FILTER ADMIN / MANAGER */}

            {(isAdminPusat ||
              isManager) && (
              <div className="rounded-xl border border-[#DDE9E4] bg-[#F8FBF9] p-4">

                <div className="mb-3 flex items-center gap-2">

                  <CalendarDays
                    size={16}
                    className="text-[#497F70]"
                  />

                  <span className="text-sm font-semibold text-[#35564C]">
                    Filter Stock Opname
                  </span>

                  <span className="rounded-full bg-[#EAF3EF] px-2 py-0.5 text-[10px] font-bold text-[#497F70]">
                    {isAdminPusat
                      ? "ADMIN PUSAT"
                      : "MANAGER"}
                  </span>

                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-5">

                  {/* OUTLET */}

                  <div>

                    <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                      Outlet
                    </label>

                    <select
                      value={
                        outletFilter
                      }
                      onChange={(e) =>
                        setOutletFilter(
                          e.target.value
                        )
                      }
                      className="
                        w-full
                        rounded-xl
                        border
                        border-[#D5E5DC]
                        bg-white
                        px-3
                        py-2.5
                        text-sm
                        text-[#35564C]
                        outline-none
                        focus:border-[#497F70]
                      "
                    >

                      <option value="">
                        Semua Outlet
                      </option>

                      {outlets.map(
                        (item, index) => (
                          <option
                            key={getOutletKey(
                              item,
                              index
                            )}
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

                  </div>

                  {/* DATE FROM */}

                  <div>

                    <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                      Tanggal Dari
                    </label>

                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) =>
                        setDateFrom(
                          e.target.value
                        )
                      }
                      className="
                        w-full
                        rounded-xl
                        border
                        border-[#D5E5DC]
                        bg-white
                        px-3
                        py-2.5
                        text-sm
                        text-[#35564C]
                        outline-none
                        focus:border-[#497F70]
                      "
                    />

                  </div>

                  {/* DATE TO */}

                  <div>

                    <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                      Tanggal Sampai
                    </label>

                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) =>
                        setDateTo(
                          e.target.value
                        )
                      }
                      className="
                        w-full
                        rounded-xl
                        border
                        border-[#D5E5DC]
                        bg-white
                        px-3
                        py-2.5
                        text-sm
                        text-[#35564C]
                        outline-none
                        focus:border-[#497F70]
                      "
                    />

                  </div>

                  {/* TYPE */}

                  <div>

                    <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                      Jenis Stock Opname
                    </label>

                    <select
                      value={
                        typeFilter
                      }
                      onChange={(e) =>
                        setTypeFilter(
                          e.target.value
                        )
                      }
                      className="
                        w-full
                        rounded-xl
                        border
                        border-[#D5E5DC]
                        bg-white
                        px-3
                        py-2.5
                        text-sm
                        text-[#35564C]
                        outline-none
                        focus:border-[#497F70]
                      "
                    >

                      <option value="">
                        Semua Jenis
                      </option>

                      <option value="WEEKLY">
                        Mingguan
                      </option>

                      <option value="MONTHLY">
                        Bulanan
                      </option>

                    </select>

                  </div>

                  {/* BUTTON */}

                  <div className="flex items-end gap-2">

                    <button
                      type="button"
                      onClick={
                        handleApplyFilter
                      }
                      disabled={loading}
                      className="
                        flex-1
                        rounded-xl
                        bg-[#497F70]
                        px-4
                        py-2.5
                        text-sm
                        font-semibold
                        text-white
                        hover:bg-[#3F7063]
                        disabled:opacity-50
                      "
                    >
                      Terapkan
                    </button>

                    <button
                      type="button"
                      onClick={
                        handleResetFilter
                      }
                      disabled={loading}
                      className="
                        rounded-xl
                        border
                        border-[#D5E5DC]
                        bg-white
                        px-4
                        py-2.5
                        text-sm
                        font-semibold
                        text-[#35564C]
                        hover:bg-[#F5F8F6]
                        disabled:opacity-50
                      "
                    >
                      Reset
                    </button>

                  </div>

                </div>

              </div>
            )}

          </div>

        </div>

        {/* MAIN TABLE */}

        <div className="overflow-x-auto">

          <table className="min-w-[1200px] w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Tanggal
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Nomor Opname
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Jenis
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Outlet
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Barang
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Sistem
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Fisik
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Selisih
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Status
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Aksi
                </th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>

                  <td
                    colSpan={10}
                    className="px-5 py-12 text-center"
                  >

                    <RefreshCw
                      size={20}
                      className="mx-auto mb-2 animate-spin text-[#497F70]"
                    />

                    <p className="text-sm text-gray-500">
                      Memuat stock opname...
                    </p>

                  </td>

                </tr>

              ) : filteredData.length ===
                0 ? (

                <tr>

                  <td
                    colSpan={10}
                    className="px-5 py-12 text-center text-sm text-gray-400"
                  >
                    Belum ada stock opname
                  </td>

                </tr>

              ) : (

                filteredData.map(
                  (opname, opnameIndex) => {

                    const system =
                      getTotalSystem(
                        opname
                      );

                    const physical =
                      getTotalPhysical(
                        opname
                      );

                    const difference =
                      getTotalDifference(
                        opname
                      );

                    const differenceCount =
                      getDifferenceCount(
                        opname
                      );

                    const waiting =
                      isMonthly(
                        opname
                      ) &&
                      String(
                        opname.status
                      ).toUpperCase() ===
                        "COUNTING";

                    /*
                     * Pengaman tambahan jika data legacy
                     * memiliki id kosong/null.
                     */
                    const opnameRowKey =
                      Number.isFinite(
                        Number(
                          opname.id
                        )
                      ) &&
                      Number(opname.id) > 0
                        ? `opname-${Number(
                            opname.id
                          )}`
                        : `opname-fallback-${opnameIndex}-${String(
                            opname.code ||
                              opname.date ||
                              "unknown"
                          )}`;

                    return (
                      <tr
                        key={
                          opnameRowKey
                        }
                        className="
                          border-b
                          border-[#EDF2EF]
                          hover:bg-[#FAFCFB]
                        "
                      >

                        {/* TANGGAL */}

                        <td className="px-5 py-4 align-top">
                          <span className="text-[#35564C]">
                            {formatDate(
                              opname.date
                            )}
                          </span>
                        </td>

                        {/* NOMOR */}

                        <td className="px-5 py-4 align-top">

                          <div className="font-semibold text-[#18352D]">
                            {opname.code}
                          </div>

                        </td>

                        {/* TYPE */}

                        <td className="px-5 py-4 text-center align-top">

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
                              ${typeClass(
                                opname.type
                              )}
                            `}
                          >

                            <CalendarDays
                              size={13}
                            />

                            {typeLabel(
                              opname.type
                            )}

                          </span>

                        </td>

                        {/* OUTLET */}

                        <td className="px-5 py-4 align-top">

                          <div className="font-semibold text-[#18352D]">
                            {
                              opname
                                .outlet
                                ?.code
                            }
                          </div>

                          <div className="mt-1 text-xs text-gray-400">
                            {
                              opname
                                .outlet
                                ?.name
                            }
                          </div>

                        </td>

                        {/* BARANG */}

                        <td className="px-5 py-4 text-center align-top">

                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF3EF] px-3 py-1 text-xs font-semibold text-[#497F70]">

                            <Package
                              size={13}
                            />

                            {formatNumber(
                              opname
                                .items
                                .length
                            )}

                          </span>

                        </td>

                        {/* SISTEM */}

                        <td className="px-5 py-4 text-right align-top">

                          <span className="font-semibold text-gray-600">
                            {formatNumber(
                              system
                            )}
                          </span>

                        </td>

                        {/* FISIK */}

                        <td className="px-5 py-4 text-right align-top">

                          <span className="font-semibold text-[#18352D]">
                            {formatNumber(
                              physical
                            )}
                          </span>

                        </td>

                        {/* SELISIH */}

                        <td className="px-5 py-4 text-right align-top">

                          <div
                            className={`font-bold ${
                              difference > 0
                                ? "text-[#2F7A4F]"
                                : difference <
                                  0
                                ? "text-[#C84B4B]"
                                : "text-gray-400"
                            }`}
                          >

                            {difference >
                            0
                              ? "+"
                              : ""}

                            {formatNumber(
                              difference
                            )}

                          </div>

                          {differenceCount >
                            0 && (
                            <div className="mt-1 text-[11px] text-gray-400">
                              {
                                differenceCount
                              }{" "}
                              barang selisih
                            </div>
                          )}

                        </td>

                        {/* STATUS */}

                        <td className="px-5 py-4 text-center align-top">

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
                              ${statusClass(
                                opname.status
                              )}
                            `}
                          >

                            {String(
                              opname.status
                            ).toUpperCase() ===
                            "APPROVED" ? (
                              <CheckCircle2
                                size={13}
                              />
                            ) : (
                              <AlertTriangle
                                size={13}
                              />
                            )}

                            {statusLabel(
                              opname.status
                            )}

                          </span>

                        </td>

                        {/* AKSI */}

                        <td className="px-5 py-4 text-center align-top">

                          <div className="flex items-center justify-center gap-2">

                            <button
                              type="button"
                              onClick={() =>
                                openDetail(
                                  opname
                                )
                              }
                              className="
                                inline-flex
                                items-center
                                gap-1.5
                                rounded-lg
                                border
                                border-[#D5E5DC]
                                bg-white
                                px-3
                                py-2
                                text-xs
                                font-semibold
                                text-[#35564C]
                                hover:bg-[#F5F8F6]
                              "
                            >

                              <Eye
                                size={14}
                              />

                              Detail

                            </button>

                            {isAdminPusat &&
                              waiting && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleApprove(
                                      opname
                                    )
                                  }
                                  disabled={
                                    approving ===
                                      opname.id ||
                                    deleting ===
                                      opname.id
                                  }
                                  className="
                                    inline-flex
                                    items-center
                                    gap-1.5
                                    rounded-lg
                                    bg-[#497F70]
                                    px-3
                                    py-2
                                    text-xs
                                    font-semibold
                                    text-white
                                    hover:bg-[#3F7063]
                                    disabled:opacity-50
                                  "
                                >

                                  {approving ===
                                  opname.id ? (
                                    <RefreshCw
                                      size={14}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <CheckCircle2
                                      size={14}
                                    />
                                  )}

                                  Approve

                                </button>
                              )}

                            {isAdminPusat && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleDelete(
                                    opname
                                  )
                                }
                                disabled={
                                  deleting ===
                                    opname.id ||
                                  approving ===
                                    opname.id
                                }
                                title={`Hapus Stock Opname - ${statusLabel(
                                  opname.status
                                )}`}
                                className="
                                  inline-flex
                                  items-center
                                  justify-center
                                  rounded-lg
                                  border
                                  border-[#F0CACA]
                                  bg-[#FFF7F7]
                                  p-2
                                  text-[#C84B4B]
                                  hover:bg-[#FDECEC]
                                  disabled:opacity-50
                                "
                              >

                                {deleting ===
                                opname.id ? (
                                  <RefreshCw
                                    size={14}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <Trash2
                                    size={14}
                                  />
                                )}

                              </button>
                            )}

                          </div>

                        </td>

                      </tr>
                    );
                  }
                )

              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* MODAL DETAIL */}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">

            {/* HEADER */}

            <div className="flex items-center justify-between border-b border-[#E5ECE9] px-6 py-5">

              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                  <ClipboardCheck
                    size={19}
                  />
                </div>

                <div>

                  <div className="flex items-center gap-2">

                    <h2 className="font-bold text-[#18352D]">
                      {selected.code}
                    </h2>

                    <span
                      className={`
                        inline-flex
                        items-center
                        gap-1
                        rounded-full
                        px-2.5
                        py-1
                        text-[10px]
                        font-bold
                        ${typeClass(
                          selected.type
                        )}
                      `}
                    >

                      <CalendarDays
                        size={11}
                      />

                      {typeLabel(
                        selected.type
                      )}

                    </span>

                  </div>

                  <p className="text-xs text-gray-500">
                    {formatDate(
                      selected.date
                    )}
                  </p>

                </div>

              </div>

              <button
                type="button"
                onClick={() =>
                  setSelected(null)
                }
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={20} />
              </button>

            </div>

            {/* INFO */}

            <div className="border-b border-[#E5ECE9] bg-[#FAFCFB] px-6 py-4">

              <div className="grid grid-cols-2 gap-4 md:grid-cols-6">

                <div>

                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Jenis
                  </p>

                  <div className="mt-1">

                    <span
                      className={`
                        inline-flex
                        items-center
                        gap-1.5
                        rounded-full
                        px-2.5
                        py-1
                        text-xs
                        font-semibold
                        ${typeClass(
                          selected.type
                        )}
                      `}
                    >

                      <CalendarDays
                        size={12}
                      />

                      {typeLabel(
                        selected.type
                      )}

                    </span>

                  </div>

                </div>

                <div>

                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Outlet
                  </p>

                  <p className="mt-1 text-sm font-semibold text-[#18352D]">
                    {
                      selected
                        .outlet
                        ?.code
                    }
                  </p>

                  <p className="text-xs text-gray-400">
                    {
                      selected
                        .outlet
                        ?.name
                    }
                  </p>

                </div>

                <div>

                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Barang
                  </p>

                  <p className="mt-1 text-sm font-semibold text-[#18352D]">
                    {formatNumber(
                      selected
                        .items
                        .length
                    )}
                  </p>

                </div>

                <div>

                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Sistem
                  </p>

                  <p className="mt-1 text-sm font-semibold text-[#18352D]">
                    {formatNumber(
                      getTotalSystem(
                        selected
                      )
                    )}
                  </p>

                </div>

                <div>

                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Fisik
                  </p>

                  <p className="mt-1 text-sm font-semibold text-[#18352D]">
                    {formatNumber(
                      getTotalPhysical(
                        selected
                      )
                    )}
                  </p>

                </div>

                <div>

                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Selisih
                  </p>

                  <p
                    className={`mt-1 text-sm font-bold ${
                      getTotalDifference(
                        selected
                      ) === 0
                        ? "text-[#2F7A4F]"
                        : getTotalDifference(
                            selected
                          ) > 0
                        ? "text-[#2F7A4F]"
                        : "text-[#C84B4B]"
                    }`}
                  >

                    {getTotalDifference(
                      selected
                    ) > 0
                      ? "+"
                      : ""}

                    {formatNumber(
                      getTotalDifference(
                        selected
                      )
                    )}

                  </p>

                </div>

              </div>

            </div>

            {/* DETAIL FILTER */}

            <div className="border-b border-[#E5ECE9] bg-white px-6 py-4">

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

                <div>

                  <p className="text-sm font-bold text-[#18352D]">
                    Detail Barang
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    {loadingOutletMaster
                      ? "Memuat Master Barang Outlet terbaru..."
                      : `${filteredDetailItems.length} dari ${selected.items.length} barang ditampilkan`}
                  </p>

                </div>

                <div className="flex flex-col gap-2 md:flex-row">

                  <div className="relative min-w-[280px]">

                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                      value={
                        detailSearch
                      }
                      onChange={(e) =>
                        setDetailSearch(
                          e.target.value
                        )
                      }
                      placeholder="Cari kode, nama, kategori..."
                      className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-2.5 pl-9 pr-4 text-sm text-[#35564C] outline-none focus:border-[#497F70]"
                    />

                  </div>

                  <div className="relative min-w-[190px]">

                    <SlidersHorizontal
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[#497F70]"
                    />

                    <select
                      value={
                        detailCategory
                      }
                      onChange={(e) =>
                        setDetailCategory(
                          e.target.value
                        )
                      }
                      className="w-full appearance-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-2.5 pl-9 pr-8 text-sm text-[#35564C] outline-none focus:border-[#497F70]"
                    >

                      <option value="">
                        Semua Kategori
                      </option>

                      {detailCategories.map(
                        (
                          category,
                          index
                        ) => (
                          <option
                            key={getCategoryKey(
                              category,
                              index
                            )}
                            value={
                              category
                            }
                          >
                            {category}
                          </option>
                        )
                      )}

                    </select>

                  </div>

                </div>

              </div>

            </div>

            {/* DETAIL TABLE */}

            <div className="max-h-[50vh] overflow-auto">

              <table className="min-w-[1050px] w-full text-sm">

                <thead className="sticky top-0 bg-[#F5F8F6]">

                  <tr className="border-b border-[#E5ECE9]">

                    <th className="px-5 py-3 text-left font-semibold text-[#35564C]">
                      Kode
                    </th>

                    <th className="px-5 py-3 text-left font-semibold text-[#35564C]">
                      Barang
                    </th>

                    <th className="px-5 py-3 text-left font-semibold text-[#35564C]">
                      Kategori
                    </th>

                    <th className="px-5 py-3 text-center font-semibold text-[#35564C]">
                      Satuan
                    </th>

                    <th className="px-5 py-3 text-right font-semibold text-[#35564C]">
                      Sistem
                    </th>

                    <th className="px-5 py-3 text-right font-semibold text-[#35564C]">
                      Fisik
                    </th>

                    <th className="px-5 py-3 text-right font-semibold text-[#35564C]">
                      Selisih
                    </th>

                    <th className="px-5 py-3 text-left font-semibold text-[#35564C]">
                      Catatan
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {filteredDetailItems.map(
                    (
                      item,
                      index
                    ) => {

                      const difference =
                        Number(
                          item.difference ||
                            0
                        );

                      const detailKey =
                        getDetailRowKey(
                          selected.id,
                          item,
                          index
                        );

                      const editKey =
                        getEditItemKey(
                          item,
                          index
                        );

                      return (
                        <tr
                          key={
                            detailKey
                          }
                          className="border-b border-[#EDF2EF]"
                        >

                          <td className="px-5 py-3">

                            <span className="font-semibold text-[#35564C]">
                              {
                                item
                                  .barang
                                  ?.code
                              }
                            </span>

                          </td>

                          <td className="px-5 py-3">

                            <span className="font-semibold text-[#18352D]">
                              {
                                item
                                  .barang
                                  ?.name
                              }
                            </span>

                            {item.id !==
                              null &&
                              item.id <
                                0 &&
                              isWaitingApproval(
                                selected
                              ) && (
                                <span className="ml-2 inline-flex rounded-full bg-[#EAF3EF] px-2 py-0.5 text-[9px] font-bold text-[#497F70]">
                                  MASTER BARU
                                </span>
                              )}

                          </td>

                          <td className="px-5 py-3 text-left text-gray-500">
                            {item.barang
                              ?.category ||
                              "-"}
                          </td>

                          <td className="px-5 py-3 text-center text-gray-500">
                            {
                              item
                                .barang
                                ?.unit
                            }
                          </td>

                          <td className="px-5 py-3 text-right">
                            {formatNumber(
                              item.systemQty
                            )}
                          </td>

                          <td className="px-5 py-3 text-right font-semibold">

                            {editing &&
                            isWaitingApproval(
                              selected
                            ) ? (
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={
                                  editItems[
                                    editKey
                                  ]
                                    ?.physicalQty ??
                                  String(
                                    item.physicalQty ??
                                      0
                                  )
                                }
                                onChange={(
                                  e
                                ) =>
                                  updateEditItem(
                                    editKey,
                                    "physicalQty",
                                    e.target
                                      .value
                                  )
                                }
                                className="w-28 rounded-lg border border-[#BFD6CC] bg-white px-3 py-2 text-right text-sm font-semibold text-[#18352D] outline-none focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                              />
                            ) : (
                              formatNumber(
                                item.physicalQty
                              )
                            )}

                          </td>

                          <td className="px-5 py-3 text-right">

                            <span
                              className={`font-bold ${
                                difference >
                                0
                                  ? "text-[#2F7A4F]"
                                  : difference <
                                    0
                                  ? "text-[#C84B4B]"
                                  : "text-gray-400"
                              }`}
                            >

                              {difference >
                              0
                                ? "+"
                                : ""}

                              {formatNumber(
                                difference
                              )}

                            </span>

                          </td>

                          <td className="px-5 py-3 text-gray-500">

                            {editing &&
                            isWaitingApproval(
                              selected
                            ) ? (
                              <input
                                type="text"
                                value={
                                  editItems[
                                    editKey
                                  ]?.note ??
                                  item.note ??
                                  ""
                                }
                                onChange={(
                                  e
                                ) =>
                                  updateEditItem(
                                    editKey,
                                    "note",
                                    e.target
                                      .value
                                  )
                                }
                                placeholder="Catatan"
                                className="min-w-[180px] rounded-lg border border-[#BFD6CC] bg-white px-3 py-2 text-sm text-[#35564C] outline-none focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                              />
                            ) : (
                              item.note ||
                              "-"
                            )}

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>

            {/* FOOTER */}

            <div className="flex flex-col gap-3 border-t border-[#E5ECE9] bg-[#FAFCFB] px-6 py-4 md:flex-row md:items-center md:justify-between">

              <div className="flex items-center gap-2 text-xs text-gray-500">

                <UserCheck
                  size={15}
                  className="text-[#497F70]"
                />

                Status:

                <span
                  className={`
                    rounded-full
                    px-2.5
                    py-1
                    font-semibold
                    ${statusClass(
                      selected.status
                    )}
                  `}
                >
                  {statusLabel(
                    selected.status
                  )}
                </span>

              </div>

              <div className="flex items-center gap-2">

                {/* PDF */}

                <button
                  type="button"
                  onClick={() =>
                    printDetailPdf(
                      selected
                    )
                  }
                  disabled={
                    pdfGenerating
                  }
                  className="
                    inline-flex items-center gap-2 rounded-xl
                    border border-[#BFD6CC] bg-white px-4 py-2.5
                    text-sm font-semibold text-[#35564C]
                    hover:bg-[#F5F8F6] disabled:opacity-50
                  "
                >

                  {pdfGenerating ? (
                    <RefreshCw
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <FileDown
                      size={16}
                    />
                  )}

                  {pdfGenerating
                    ? "Menyiapkan..."
                    : "PDF Detail"}

                </button>

                {/* TUTUP */}

                <button
                  type="button"
                  onClick={() =>
                    setSelected(
                      null
                    )
                  }
                  className="
                    rounded-xl
                    border
                    border-[#D5E5DC]
                    bg-white
                    px-4
                    py-2.5
                    text-sm
                    font-semibold
                    text-[#35564C]
                    hover:bg-[#F5F8F6]
                  "
                >
                  Tutup
                </button>

                {/* EDIT */}

                {isWaitingApproval(
                  selected
                ) &&
                  !editing && (
                    <button
                      type="button"
                      onClick={() =>
                        startEdit(
                          selected
                        )
                      }
                      disabled={
                        savingEdit ||
                        approving ===
                          selected.id ||
                        deleting ===
                          selected.id
                      }
                      className="
                        inline-flex items-center gap-2 rounded-xl border
                        border-[#BFD6CC] bg-[#EAF3EF] px-4 py-2.5
                        text-sm font-semibold text-[#497F70]
                        hover:bg-[#DDEDE7] disabled:opacity-50
                      "
                    >
                      <Pencil
                        size={16}
                      />

                      Edit Stock Opname
                    </button>
                  )}

                {/* SAVE / CANCEL */}

                {isWaitingApproval(
                  selected
                ) &&
                  editing && (
                    <>
                      <button
                        type="button"
                        onClick={
                          cancelEdit
                        }
                        disabled={
                          savingEdit
                        }
                        className="
                          rounded-xl border border-[#D5E5DC] bg-white px-4 py-2.5
                          text-sm font-semibold text-[#35564C]
                          hover:bg-[#F5F8F6] disabled:opacity-50
                        "
                      >
                        Batal
                      </button>

                      <button
                        type="button"
                        onClick={
                          handleSaveEdit
                        }
                        disabled={
                          savingEdit
                        }
                        className="
                          inline-flex items-center gap-2 rounded-xl bg-[#497F70]
                          px-5 py-2.5 text-sm font-semibold text-white
                          hover:bg-[#3F7063] disabled:opacity-50
                        "
                      >

                        {savingEdit ? (
                          <RefreshCw
                            size={16}
                            className="animate-spin"
                          />
                        ) : (
                          <Save
                            size={16}
                          />
                        )}

                        {savingEdit
                          ? "Menyimpan..."
                          : "Simpan Perubahan"}

                      </button>
                    </>
                  )}

                {/* APPROVE */}

                {!editing &&
                  isAdminPusat &&
                  isMonthly(
                    selected
                  ) &&
                  String(
                    selected.status
                  ).toUpperCase() ===
                    "COUNTING" && (
                    <button
                      type="button"
                      onClick={() =>
                        handleApprove(
                          selected
                        )
                      }
                      disabled={
                        approving ===
                          selected.id ||
                        deleting ===
                          selected.id
                      }
                      className="
                        inline-flex
                        items-center
                        gap-2
                        rounded-xl
                        bg-[#497F70]
                        px-5
                        py-2.5
                        text-sm
                        font-semibold
                        text-white
                        hover:bg-[#3F7063]
                        disabled:opacity-50
                      "
                    >

                      {approving ===
                      selected.id ? (
                        <RefreshCw
                          size={16}
                          className="animate-spin"
                        />
                      ) : (
                        <CheckCircle2
                          size={16}
                        />
                      )}

                      Approve Stock Opname

                    </button>
                  )}

                {/* DELETE */}

                {!editing &&
                  isAdminPusat && (
                    <button
                      type="button"
                      onClick={() =>
                        handleDelete(
                          selected
                        )
                      }
                      disabled={
                        deleting ===
                          selected.id ||
                        approving ===
                          selected.id
                      }
                      className="
                        inline-flex
                        items-center
                        gap-2
                        rounded-xl
                        border
                        border-[#F0CACA]
                        bg-[#FFF7F7]
                        px-4
                        py-2.5
                        text-sm
                        font-semibold
                        text-[#C84B4B]
                        hover:bg-[#FDECEC]
                        disabled:opacity-50
                      "
                    >

                      {deleting ===
                      selected.id ? (
                        <RefreshCw
                          size={16}
                          className="animate-spin"
                        />
                      ) : (
                        <Trash2
                          size={16}
                        />
                      )}

                      Hapus

                    </button>
                  )}

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}