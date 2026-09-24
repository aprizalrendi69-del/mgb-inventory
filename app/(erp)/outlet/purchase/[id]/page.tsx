"use client";

import {
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  CalendarDays,
  Building2,
  UserRound,
  CreditCard,
  Package,
  ChevronDown,
  X,
  Receipt,
  Sparkles,
  Pencil,
  CircleCheck,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  History,
  MessageSquare,
  AtSign,
  Check,
  Send,
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

  purchasePrice?: number | string | null;

  hargaPembelian?: number | string | null;
  hargaDefault?: number | string | null;
  hargaTerakhir?: number | string | null;

  lastPurchasePrice?: number | string | null;
  lastPurchaseDate?: string | Date | null;

  hargaSource?: string | null;

  hargaReceiptTerakhir?: number | string | null;
  hargaReceiptTanggal?: string | Date | null;
  hargaReceiptNumber?: string | null;
  hargaReceiptInvoice?: string | null;
  hargaReceiptId?: number | null;

  hargaPurchaseTerakhir?: number | string | null;
  hargaPurchaseTanggal?: string | Date | null;
  hargaPurchaseNumber?: string | null;
  hargaPurchaseId?: number | null;

  priceInfo?: {
    purchasePrice?: number | string | null;
    lastPurchasePrice?: number | string | null;
    masterPurchasePrice?: number | string | null;
    source?: string | null;
    date?: string | Date | null;
    number?: string | null;
    id?: number | null;
  } | null;
};

type PurchaseItem = {
  id?: number;
  barangId: number;
  barang: Barang;
  qty: number | string;
  price: number | string;
  subtotal?: number | string | null;

  /*
   * Snapshot histori harga ketika item dimasukkan
   * ke form Purchase.
   */
  lastPurchasePrice?: number | string | null;
  lastPurchaseDate?: string | Date | null;
  lastPurchaseNumber?: string | null;
};

type Purchase = {
  id: number;
  number: string;
  outletId: number;
  supplierId: number;
  total: number | string;
  remarks: string | null;
  status: string;
  paymentMethod?: string | null;
  purchaseDate?: string | Date | null;
  createdAt?: string | Date | null;
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

type PriceChangeInfo = {
  previousPrice: number;
  currentPrice: number;
  difference: number;
  percentage: number;
  direction: "up" | "down";
  date?: string | Date | null;
  number?: string | null;
};

export default function PurchaseOutletDetailPage() {
  const router = useRouter();
  const params = useParams();

  const id = String(params.id);

  const [purchase, setPurchase] =
    useState<Purchase | null>(null);

  const [me, setMe] =
    useState<Me | null>(null);

  /*
   * ==========================================================
   * OUTLET ACCESS CONTROL
   * ==========================================================
   *
   * ADMIN / Admin Pusat:
   * - dapat memilih outlet mana pun.
   *
   * ADMIN_OUTLET / OUTLET_ADMIN:
   * - outlet mengikuti outletId user/session.
   * - dropdown outlet dikunci.
   * - payload save juga dipaksa menggunakan outlet user.
   */
  const normalizedRole =
    String(me?.role || "").trim().toUpperCase();

  const isOutletUser =
    normalizedRole === "ADMIN_OUTLET" ||
    normalizedRole === "OUTLET_ADMIN";

  const userOutletId =
    me?.outletId != null
      ? Number(me.outletId)
      : null;

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

  const [outletId, setOutletId] =
    useState("");

  const [supplierId, setSupplierId] =
    useState("");

  const [supplierSearch, setSupplierSearch] =
    useState("");

  const [supplierOpen, setSupplierOpen] =
    useState(false);

  const [remarks, setRemarks] =
    useState("");

  const [barangSearch, setBarangSearch] =
    useState("");

  const [selectedBarangId, setSelectedBarangId] =
    useState("");

  const [barangOpen, setBarangOpen] =
    useState(false);

  const [qty, setQty] =
    useState("1");

  const [price, setPrice] =
    useState("");

  const [items, setItems] =
    useState<PurchaseItem[]>([]);

  function toNumber(
    value: unknown
  ): number {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return 0;
    }

    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : 0;
  }

  function formatRupiah(
    value: unknown
  ) {
    return toNumber(value).toLocaleString(
      "id-ID"
    );
  }

  function formatPercent(
    value: number
  ) {
    return Math.abs(value).toLocaleString(
      "id-ID",
      {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }
    );
  }

  /*
   * ==========================================================
   * LAST PURCHASE PRICE
   * ==========================================================
   *
   * Berbeda dengan effective price.
   *
   * Fungsi ini sengaja mencari histori pembelian terakhir,
   * bukan harga master/default.
   */
  function getLastPurchasePrice(
    item?: Barang | null
  ): number {
    if (!item) {
      return 0;
    }

    const candidates = [
      item.hargaTerakhir,
      item.lastPurchasePrice,
      item.hargaReceiptTerakhir,
      item.hargaPurchaseTerakhir,
      item.priceInfo?.lastPurchasePrice,
    ];

    for (const candidate of candidates) {
      const value = toNumber(candidate);

      if (value > 0) {
        return value;
      }
    }

    return 0;
  }

  function getLastPurchaseDate(
    item?: Barang | null
  ): string | Date | null {
    if (!item) {
      return null;
    }

    return (
      item.hargaPurchaseTanggal ??
      item.hargaReceiptTanggal ??
      item.lastPurchaseDate ??
      item.priceInfo?.date ??
      null
    );
  }

  function getLastPurchaseNumber(
    item?: Barang | null
  ): string | null {
    if (!item) {
      return null;
    }

    return (
      item.hargaPurchaseNumber ??
      item.hargaReceiptNumber ??
      item.priceInfo?.number ??
      null
    );
  }

  function getPriceChangeInfo(
    item?: Barang | null,
    currentPrice?: unknown
  ): PriceChangeInfo | null {
    if (!item) {
      return null;
    }

    const previousPrice =
      getLastPurchasePrice(item);

    const current =
      toNumber(currentPrice);

    if (
      previousPrice <= 0 ||
      current <= 0
    ) {
      return null;
    }

    const difference =
      current - previousPrice;

    if (
      Math.abs(difference) <
      0.01
    ) {
      return null;
    }

    const percentage =
      (difference /
        previousPrice) *
      100;

    return {
      previousPrice,
      currentPrice: current,
      difference,
      percentage,
      direction:
        difference > 0
          ? "up"
          : "down",
      date:
        getLastPurchaseDate(
          item
        ),
      number:
        getLastPurchaseNumber(
          item
        ),
    };
  }

  /*
   * ==========================================================
   * EFFECTIVE PURCHASE PRICE
   * ==========================================================
   *
   * Prioritas:
   *
   * 1. hargaPembelian
   * 2. hargaTerakhir
   * 3. lastPurchasePrice
   * 4. hargaReceiptTerakhir
   * 5. hargaPurchaseTerakhir
   * 6. priceInfo.purchasePrice
   * 7. priceInfo.lastPurchasePrice
   * 8. hargaDefault
   * 9. purchasePrice
   */
  function getEffectivePurchasePrice(
    item?: Barang | null
  ): number {
    if (!item) {
      return 0;
    }

    const candidates = [
      item.hargaPembelian,
      item.hargaTerakhir,
      item.lastPurchasePrice,
      item.hargaReceiptTerakhir,
      item.hargaPurchaseTerakhir,
      item.priceInfo?.purchasePrice,
      item.priceInfo?.lastPurchasePrice,
      item.hargaDefault,
      item.purchasePrice,
    ];

    for (const candidate of candidates) {
      const value = toNumber(candidate);

      if (value > 0) {
        return value;
      }
    }

    return 0;
  }

  function calculateSubtotal(
    item: PurchaseItem
  ): number {
    const itemQty = toNumber(item.qty);
    const itemPrice = toNumber(item.price);

    if (
      itemQty <= 0 ||
      itemPrice <= 0
    ) {
      return 0;
    }

    return itemQty * itemPrice;
  }

  /*
   * ==========================================================
   * NORMALIZE PURCHASE ITEM
   * ==========================================================
   */
  function normalizePurchaseItem(
    item: any
  ): PurchaseItem {
    const itemQty = toNumber(item?.qty);
    const itemPrice = toNumber(item?.price);

    const rawBarang = item?.barang || {};

    const normalizedBarang: Barang = {
      id: Number(
        rawBarang?.id ??
          item?.barangId
      ),

      code:
        rawBarang?.code || "",

      barcode:
        rawBarang?.barcode || null,

      name:
        rawBarang?.name ||
        "Barang",

      unit:
        rawBarang?.unit || "",

      purchasePrice:
        rawBarang?.purchasePrice ??
        0,

      hargaPembelian:
        rawBarang?.hargaPembelian ??
        rawBarang?.hargaTerakhir ??
        rawBarang?.lastPurchasePrice ??
        rawBarang?.purchasePrice ??
        0,

      hargaDefault:
        rawBarang?.hargaDefault ??
        rawBarang?.purchasePrice ??
        0,

      hargaTerakhir:
        rawBarang?.hargaTerakhir ??
        rawBarang?.lastPurchasePrice ??
        null,

      lastPurchasePrice:
        rawBarang?.lastPurchasePrice ??
        null,

      lastPurchaseDate:
        rawBarang?.lastPurchaseDate ??
        null,

      hargaSource:
        rawBarang?.hargaSource ??
        null,

      hargaReceiptTerakhir:
        rawBarang?.hargaReceiptTerakhir ??
        null,

      hargaReceiptTanggal:
        rawBarang?.hargaReceiptTanggal ??
        null,

      hargaReceiptNumber:
        rawBarang?.hargaReceiptNumber ??
        null,

      hargaReceiptInvoice:
        rawBarang?.hargaReceiptInvoice ??
        null,

      hargaReceiptId:
        rawBarang?.hargaReceiptId ??
        null,

      hargaPurchaseTerakhir:
        rawBarang?.hargaPurchaseTerakhir ??
        null,

      hargaPurchaseTanggal:
        rawBarang?.hargaPurchaseTanggal ??
        null,

      hargaPurchaseNumber:
        rawBarang?.hargaPurchaseNumber ??
        null,

      hargaPurchaseId:
        rawBarang?.hargaPurchaseId ??
        null,

      priceInfo:
        rawBarang?.priceInfo ??
        null,
    };

    return {
      id:
        item?.id !== undefined
          ? Number(item.id)
          : undefined,

      barangId:
        Number(item?.barangId),

      barang:
        normalizedBarang,

      qty: itemQty,

      price: itemPrice,

      subtotal:
        itemQty * itemPrice,

      lastPurchasePrice:
        item?.lastPurchasePrice ??
        getLastPurchasePrice(
          normalizedBarang
        ),

      lastPurchaseDate:
        item?.lastPurchaseDate ??
        getLastPurchaseDate(
          normalizedBarang
        ),

      lastPurchaseNumber:
        item?.lastPurchaseNumber ??
        getLastPurchaseNumber(
          normalizedBarang
        ),
    };
  }

  /*
   * ==========================================================
   * NORMALIZE MASTER BARANG RESPONSE
   * ==========================================================
   */
  function normalizeMasterBarang(
    raw: any
  ): Barang | null {
    if (!raw) {
      return null;
    }

    const source =
      raw?.barang &&
      typeof raw.barang === "object"
        ? {
            ...raw.barang,
            ...raw,
          }
        : raw;

    const barangId = Number(
      source?.barangId ??
        source?.id
    );

    if (
      !Number.isFinite(barangId) ||
      barangId <= 0
    ) {
      return null;
    }

    return {
      id: barangId,

      code:
        source?.code ||
        source?.barang?.code ||
        "",

      barcode:
        source?.barcode ??
        source?.barang?.barcode ??
        null,

      name:
        source?.name ||
        source?.barang?.name ||
        "Barang",

      unit:
        source?.unit ||
        source?.barang?.unit ||
        "",

      purchasePrice:
        source?.purchasePrice ??
        source?.barang?.purchasePrice ??
        0,

      hargaPembelian:
        source?.hargaPembelian ??
        source?.barang?.hargaPembelian ??
        source?.hargaTerakhir ??
        source?.barang?.hargaTerakhir ??
        source?.lastPurchasePrice ??
        source?.barang?.lastPurchasePrice ??
        source?.purchasePrice ??
        source?.barang?.purchasePrice ??
        0,

      hargaDefault:
        source?.hargaDefault ??
        source?.barang?.hargaDefault ??
        source?.purchasePrice ??
        source?.barang?.purchasePrice ??
        0,

      hargaTerakhir:
        source?.hargaTerakhir ??
        source?.barang?.hargaTerakhir ??
        source?.lastPurchasePrice ??
        source?.barang?.lastPurchasePrice ??
        null,

      lastPurchasePrice:
        source?.lastPurchasePrice ??
        source?.barang?.lastPurchasePrice ??
        null,

      lastPurchaseDate:
        source?.lastPurchaseDate ??
        source?.barang?.lastPurchaseDate ??
        null,

      hargaSource:
        source?.hargaSource ??
        source?.barang?.hargaSource ??
        null,

      hargaReceiptTerakhir:
        source?.hargaReceiptTerakhir ??
        source?.barang?.hargaReceiptTerakhir ??
        null,

      hargaReceiptTanggal:
        source?.hargaReceiptTanggal ??
        source?.barang?.hargaReceiptTanggal ??
        null,

      hargaReceiptNumber:
        source?.hargaReceiptNumber ??
        source?.barang?.hargaReceiptNumber ??
        null,

      hargaReceiptInvoice:
        source?.hargaReceiptInvoice ??
        source?.barang?.hargaReceiptInvoice ??
        null,

      hargaReceiptId:
        source?.hargaReceiptId ??
        source?.barang?.hargaReceiptId ??
        null,

      hargaPurchaseTerakhir:
        source?.hargaPurchaseTerakhir ??
        source?.barang?.hargaPurchaseTerakhir ??
        null,

      hargaPurchaseTanggal:
        source?.hargaPurchaseTanggal ??
        source?.barang?.hargaPurchaseTanggal ??
        null,

      hargaPurchaseNumber:
        source?.hargaPurchaseNumber ??
        source?.barang?.hargaPurchaseNumber ??
        null,

      hargaPurchaseId:
        source?.hargaPurchaseId ??
        source?.barang?.hargaPurchaseId ??
        null,

      priceInfo:
        source?.priceInfo ??
        source?.barang?.priceInfo ??
        null,
    };
  }

  useEffect(() => {
    loadData();
  }, [id]);

  /*
   * ==========================================================
   * FORCE OUTLET FOR OUTLET USER
   * ==========================================================
   */
  useEffect(() => {
    if (!isOutletUser) {
      return;
    }

    if (
      userOutletId != null &&
      Number.isFinite(userOutletId) &&
      userOutletId > 0
    ) {
      setOutletId(String(userOutletId));
    }
  }, [isOutletUser, userOutletId]);

  /*
   * ==========================================================
   * LOAD DATA
   * ==========================================================
   */
  async function loadData() {
    try {
      setLoading(true);

      const [
        purchaseRes,
        outletRes,
        supplierRes,
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

      let meJson: any = null;

      try {
        meJson = await meRes.json();
      } catch {
        meJson = null;
      }

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

      const rawData =
        purchaseJson.data as Purchase;

      let barangJson: any = null;

      try {
        const masterBarangUrl =
          `/api/outlet/master-barang?search=&outletId=${encodeURIComponent(
            String(rawData.outletId)
          )}`;

        const barangRes =
          await fetch(
            masterBarangUrl,
            {
              cache: "no-store",
            }
          );

        barangJson =
          await barangRes.json();

        console.log(
          "OUTLET PURCHASE PRICE SOURCE:",
          {
            purchaseId: rawData.id,
            outletId:
              rawData.outletId,
            barangCount:
              Array.isArray(
                barangJson?.data
              )
                ? barangJson.data.length
                : 0,
          }
        );
      } catch (error) {
        console.error(
          "LOAD OUTLET MASTER BARANG ERROR:",
          error
        );

        barangJson = null;
      }

      const normalizedMasterBarang: Barang[] =
        Array.isArray(
          barangJson?.data
        )
          ? barangJson.data
              .map(
                normalizeMasterBarang
              )
              .filter(
                (
                  item
                ): item is Barang =>
                  Boolean(item)
              )
          : [];

      const masterBarangMap =
        new Map<
          number,
          Barang
        >();

      for (
        const masterItem of
          normalizedMasterBarang
      ) {
        masterBarangMap.set(
          Number(
            masterItem.id
          ),
          masterItem
        );
      }

      const normalizedItems =
        Array.isArray(
          rawData.items
        )
          ? rawData.items.map(
              (
                rawItem
              ) => {
                const normalized =
                  normalizePurchaseItem(
                    rawItem
                  );

                const masterItem =
                  masterBarangMap.get(
                    Number(
                      normalized.barangId
                    )
                  );

                const mergedBarang: Barang =
                  masterItem
                    ? {
                        ...normalized.barang,
                        ...masterItem,

                        id:
                          normalized.barangId,

                        code:
                          masterItem.code ||
                          normalized
                            .barang
                            .code,

                        barcode:
                          masterItem.barcode ??
                          normalized
                            .barang
                            .barcode,

                        name:
                          masterItem.name ||
                          normalized
                            .barang
                            .name,

                        unit:
                          masterItem.unit ||
                          normalized
                            .barang
                            .unit,
                      }
                    : normalized.barang;

                let effectivePrice =
                  toNumber(
                    normalized.price
                  );

                if (
                  effectivePrice <= 0 &&
                  rawData.status ===
                    "DRAFT"
                ) {
                  const suggestedPrice =
                    getEffectivePurchasePrice(
                      mergedBarang
                    );

                  if (
                    suggestedPrice >
                    0
                  ) {
                    effectivePrice =
                      suggestedPrice;
                  }
                }

                const normalizedQty =
                  toNumber(
                    normalized.qty
                  );

                const historicalPrice =
                  normalized.lastPurchasePrice ??
                  getLastPurchasePrice(
                    mergedBarang
                  );

                return {
                  ...normalized,

                  barang:
                    mergedBarang,

                  qty:
                    normalizedQty,

                  price:
                    effectivePrice,

                  lastPurchasePrice:
                    historicalPrice,

                  lastPurchaseDate:
                    normalized.lastPurchaseDate ??
                    getLastPurchaseDate(
                      mergedBarang
                    ),

                  lastPurchaseNumber:
                    normalized.lastPurchaseNumber ??
                    getLastPurchaseNumber(
                      mergedBarang
                    ),

                  subtotal:
                    normalizedQty *
                    effectivePrice,
                };
              }
            )
          : [];

      const data: Purchase = {
        ...rawData,

        total: toNumber(
          rawData.total
        ),

        items:
          normalizedItems,
      };

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
        normalizedItems
      );

      if (
        outletJson?.success
      ) {
        setOutlets(
          Array.isArray(
            outletJson.data
          )
            ? outletJson.data
            : []
        );
      }

      if (
        supplierJson?.success
      ) {
        setSuppliers(
          Array.isArray(
            supplierJson.data
          )
            ? supplierJson.data
            : []
        );
      }

      setBarang(
        normalizedMasterBarang
      );

      let loadedMe: Me | null = null;

      if (
        meJson?.success &&
        meJson?.data
      ) {
        loadedMe = meJson.data;
      } else if (
        meJson?.data
      ) {
        loadedMe = meJson.data;
      } else if (
        meJson?.user
      ) {
        loadedMe = meJson.user;
      }

      if (loadedMe) {
        setMe(loadedMe);

        const loadedRole =
          String(
            loadedMe.role || ""
          )
            .trim()
            .toUpperCase();

        const loadedIsOutletUser =
          loadedRole === "ADMIN_OUTLET" ||
          loadedRole === "OUTLET_ADMIN";

        if (
          loadedIsOutletUser &&
          loadedMe.outletId != null &&
          Number.isFinite(
            Number(loadedMe.outletId)
          ) &&
          Number(loadedMe.outletId) > 0
        ) {
          setOutletId(
            String(
              loadedMe.outletId
            )
          );
        }
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

  const isDraft =
    purchase?.status ===
    "DRAFT";

  const canApprove =
    Boolean(
      isDraft &&
        (
          me?.role ===
            "ADMIN" ||
          me?.role ===
            "PURCHASING"
        )
    );

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
              .includes(
                keyword
              ) ||
            item.name
              ?.toLowerCase()
              .includes(
                keyword
              ) ||
            item.barcode
              ?.toLowerCase()
              .includes(
                keyword
              )
          );
        })
        .slice(
          0,
          30
        );
    }, [
      barang,
      barangSearch,
    ]);

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

  const selectedOutlet =
    useMemo(() => {
      return (
        outlets.find(
          (outlet) =>
            outlet.id ===
            Number(
              outletId
            )
        ) ||
        purchase?.outlet ||
        null
      );
    }, [
      purchase,
      outlets,
      outletId,
    ]);

  const selectedSupplier =
    useMemo(() => {
      return (
        suppliers.find(
          (supplier) =>
            supplier.id ===
            Number(
              supplierId
            )
        ) ||
        purchase?.supplier ||
        null
      );
    }, [
      purchase,
      suppliers,
      supplierId,
    ]);

  const filteredSuppliers =
    useMemo(() => {
      const keyword = supplierSearch.trim().toLowerCase();

      if (!keyword) {
        return suppliers;
      }

      return suppliers.filter((supplier) =>
        `${supplier.code} ${supplier.name}`
          .toLowerCase()
          .includes(keyword)
      );
    }, [
      suppliers,
      supplierSearch,
    ]);

  const availableOutlets =
    useMemo(() => {
      if (!isOutletUser) {
        return outlets;
      }

      if (
        userOutletId == null ||
        !Number.isFinite(userOutletId) ||
        userOutletId <= 0
      ) {
        return [];
      }

      return outlets.filter(
        (outlet) =>
          outlet.id === userOutletId
      );
    }, [
      outlets,
      isOutletUser,
      userOutletId,
    ]);

  /*
   * ==========================================================
   * CURRENT INPUT PRICE WARNING
   * ==========================================================
   */
  const selectedPriceChange =
    useMemo(() => {
      return getPriceChangeInfo(
        selectedBarang,
        price
      );
    }, [
      selectedBarang,
      price,
    ]);

  /*
   * ==========================================================
   * CHANGED PRICE ITEMS
   * ==========================================================
   */
  const changedPriceItems =
    useMemo(() => {
      return items.filter(
        (item) => {
          const previousPrice =
            toNumber(
              item.lastPurchasePrice
            );

          const currentPrice =
            toNumber(
              item.price
            );

          return (
            previousPrice > 0 &&
            currentPrice > 0 &&
            Math.abs(
              currentPrice -
                previousPrice
            ) >= 0.01
          );
        }
      );
    }, [items]);

  const changedPriceCount =
    changedPriceItems.length;

  const total =
    useMemo(() => {
      return items.reduce(
        (
          sum,
          item
        ) =>
          sum +
          calculateSubtotal(
            item
          ),
        0
      );
    }, [items]);

  const totalQty =
    useMemo(() => {
      return items.reduce(
        (
          sum,
          item
        ) =>
          sum +
          toNumber(
            item.qty
          ),
        0
      );
    }, [items]);

  function formatPurchaseDate(
    value?:
      | string
      | Date
      | null
  ) {
    if (!value) {
      return "-";
    }

    const date =
      value instanceof Date
        ? value
        : new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "-";
    }

    return date.toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }
    );
  }

  function getStatusStyle(
    status: string
  ) {
    switch (status) {
      case "DRAFT":
        return {
          wrapper:
            "border-amber-200 bg-amber-50",
          text:
            "text-[#7650B5]",
          dot:
            "bg-[#8B63C7]",
          label:
            "Draft",
        };

      case "APPROVED":
        return {
          wrapper:
            "border-blue-200 bg-blue-50",
          text:
            "text-blue-700",
          dot:
            "bg-blue-500",
          label:
            "Approved",
        };

      case "RECEIVED":
        return {
          wrapper:
            "border-emerald-200 bg-emerald-50",
          text:
            "text-emerald-700",
          dot:
            "bg-emerald-500",
          label:
            "Received",
        };

      default:
        return {
          wrapper:
            "border-gray-200 bg-gray-50",
          text:
            "text-gray-600",
          dot:
            "bg-gray-400",
          label:
            status,
        };
    }
  }

  /*
   * ==========================================================
   * SELECT BARANG
   * ==========================================================
   */
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
      const effectivePrice =
        getEffectivePurchasePrice(
          selected
        );

      setPrice(
        effectivePrice > 0
          ? String(
              effectivePrice
            )
          : ""
      );
    } else {
      setPrice("");
    }
  }

  /*
   * ==========================================================
   * ADD ITEM
   * ==========================================================
   */
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
      toNumber(qty);

    const itemPrice =
      toNumber(price);

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

    const historicalPrice =
      getLastPurchasePrice(
        selected
      );

    const historicalDate =
      getLastPurchaseDate(
        selected
      );

    const historicalNumber =
      getLastPurchaseNumber(
        selected
      );

    if (
      existingIndex >= 0
    ) {
      const updated =
        [...items];

      const oldQty =
        toNumber(
          updated[
            existingIndex
          ].qty
        );

      const newQty =
        oldQty +
        itemQty;

      updated[
        existingIndex
      ] = {
        ...updated[
          existingIndex
        ],

        qty:
          newQty,

        price:
          itemPrice,

        lastPurchasePrice:
          historicalPrice,

        lastPurchaseDate:
          historicalDate,

        lastPurchaseNumber:
          historicalNumber,

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
            selected.id,

          barang:
            selected,

          qty:
            itemQty,

          price:
            itemPrice,

          lastPurchasePrice:
            historicalPrice,

          lastPurchaseDate:
            historicalDate,

          lastPurchaseNumber:
            historicalNumber,

          subtotal:
            itemQty *
            itemPrice,
        },
      ]);
    }

    setSelectedBarangId(
      ""
    );

    setBarangSearch(
      ""
    );

    setQty("1");

    setPrice("");

    setBarangOpen(
      false
    );
  }

  function updateQty(
    barangId: number,
    value: string
  ) {
    const newQty =
      toNumber(value);

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

            const itemPrice =
              toNumber(
                item.price
              );

            return {
              ...item,

              qty:
                newQty,

              subtotal:
                newQty *
                itemPrice,
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
      toNumber(value);

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

            const itemQty =
              toNumber(
                item.qty
              );

            return {
              ...item,

              price:
                newPrice,

              subtotal:
                itemQty *
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

  /*
   * ==========================================================
   * EXPORT PDF
   * ==========================================================
   */
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

      const currentOutlet =
        outlets.find(
          (outlet) =>
            outlet.id ===
            Number(
              isOutletUser &&
              userOutletId != null
                ? userOutletId
                : outletId
            )
        ) ||
        purchase.outlet ||
        null;

      const currentSupplier =
        purchase.supplier ||
        suppliers.find(
          (supplier) =>
            supplier.id ===
            Number(
              supplierId
            )
        ) ||
        null;

      const pdfItems =
        items.map(
          (item) => {
            const itemQty =
              toNumber(
                item.qty
              );

            const itemPrice =
              toNumber(
                item.price
              );

            return {
              ...item,

              qty:
                itemQty,

              price:
                itemPrice,

              subtotal:
                itemQty *
                itemPrice,
            };
          }
        );

      const pdfTotal =
        pdfItems.reduce(
          (
            sum,
            item
          ) =>
            sum +
            toNumber(
              item.subtotal
            ),
          0
        );

      const pdfData = {
        ...purchase,

        purchaseDate:
          purchase.purchaseDate ||
          null,

        outlet:
          currentOutlet,

        supplier:
          currentSupplier,

        remarks,

        items:
          pdfItems,

        total:
          pdfTotal,
      };

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
      setExporting(
        false
      );
    }
  }

  /*
   * ==========================================================
   * SAVE
   * ==========================================================
   */
  async function handleSave() {
    if (!isDraft) {
      alert(
        "Purchase Outlet ini sudah tidak dapat diedit"
      );
      return;
    }

    const effectiveOutletId =
      isOutletUser &&
      userOutletId != null &&
      Number.isFinite(userOutletId) &&
      userOutletId > 0
        ? String(userOutletId)
        : outletId;

    if (!effectiveOutletId) {
      alert(
        "Outlet wajib dipilih"
      );
      return;
    }

    if (isOutletUser && !userOutletId) {
      alert(
        "User outlet belum memiliki outlet yang valid"
      );
      return;
    }

    if (!supplierId) {
      alert(
        "Supplier wajib dipilih"
      );
      return;
    }

    if (
      items.length ===
      0
    ) {
      alert(
        "Minimal harus ada 1 barang"
      );
      return;
    }

    const invalidItem =
      items.find(
        (item) => {
          const itemQty =
            toNumber(
              item.qty
            );

          const itemPrice =
            toNumber(
              item.price
            );

          return (
            !Number.isFinite(
              itemQty
            ) ||
            itemQty <= 0 ||
            !Number.isFinite(
              itemPrice
            ) ||
            itemPrice <= 0
          );
        }
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

      const payloadItems =
        items.map(
          (item) => ({
            barangId:
              Number(
                item.barangId
              ),

            qty:
              toNumber(
                item.qty
              ),

            price:
              toNumber(
                item.price
              ),
          })
        );

      const res =
        await fetch(
          `/api/outlet/purchase/${id}`,
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                outletId:
                  Number(
                    effectiveOutletId
                  ),

                supplierId:
                  Number(
                    supplierId
                  ),

                remarks:
                  remarks.trim() ||
                  null,

                items:
                  payloadItems,
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
      setSaving(
        false
      );
    }
  }

  /*
   * ==========================================================
   * DELETE
   * ==========================================================
   */
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
      setDeleting(
        true
      );

      const res =
        await fetch(
          `/api/outlet/purchase/${id}`,
          {
            method:
              "DELETE",
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
      setDeleting(
        false
      );
    }
  }

  /*
   * ==========================================================
   * APPROVE
   * ==========================================================
   */
  async function handleApprove() {
    if (!purchase) {
      return;
    }

    const canUserApprove =
      me?.role ===
        "ADMIN" ||
      me?.role ===
        "PURCHASING";

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

    if (
      items.length ===
      0
    ) {
      alert(
        "Purchase Outlet tidak memiliki barang"
      );
      return;
    }

    const invalidPrice =
      items.find(
        (item) =>
          toNumber(
            item.price
          ) <= 0
      );

    if (invalidPrice) {
      alert(
        `Harga barang "${invalidPrice.barang.name}" masih 0. Silakan isi harga pembelian terlebih dahulu.`
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
      setApproving(
        true
      );

      const res =
        await fetch(
          `/api/outlet/purchase/${id}/approve`,
          {
            method:
              "POST",

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
      setApproving(
        false
      );
    }
  }

  const statusStyle =
    getStatusStyle(
      purchase?.status || ""
    );

  /*
   * ==========================================================
   * LOADING
   * ==========================================================
   */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F8F6]">
        <div className="mx-auto max-w-[1500px] p-5 md:p-8">
          <div className="animate-pulse space-y-6">
            <div className="h-32 rounded-[28px] bg-white" />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
              <div className="space-y-6">
                <div className="h-64 rounded-[26px] bg-white" />
                <div className="h-96 rounded-[26px] bg-white" />
                <div className="h-64 rounded-[26px] bg-white" />
              </div>

              <div className="h-[500px] rounded-[26px] bg-white" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!purchase) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F5F8F6] text-[#18352D]">
      <div className="mx-auto max-w-[1500px] p-5 md:p-8">

        {/* ==================================================
            PREMIUM HEADER
        ================================================== */}

        <div className="mb-6 overflow-hidden rounded-[28px] border border-[#DDE9E4] bg-white shadow-[0_12px_40px_rgba(24,53,45,0.06)]">
          <div className="relative overflow-hidden px-5 py-6 md:px-7">

            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#497F70]/5" />

            <div className="pointer-events-none absolute -bottom-32 right-20 h-64 w-64 rounded-full bg-[#497F70]/5" />

            <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">

              <div className="flex items-start gap-4">

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/outlet/purchase"
                    )
                  }
                  className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#DDE9E4] bg-[#FAFCFB] text-gray-500 transition hover:border-[#BFD3CA] hover:bg-[#F0F6F3] hover:text-[#18352D]"
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

                <div className="min-w-0">

                  <div className="mb-2 flex flex-wrap items-center gap-2">

                    <span className="rounded-full bg-[#EAF3EF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#497F70]">
                      Purchase Outlet
                    </span>

                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${statusStyle.wrapper} ${statusStyle.text}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`}
                      />

                      {statusStyle.label}
                    </span>

                    {changedPriceCount >
                      0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D8C7F5] bg-gradient-to-r from-[#F3EEFF] to-[#EAF3FF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6D45A8]">
                        <AlertTriangle
                          size={12}
                        />
                        {changedPriceCount} Harga Berubah
                      </span>
                    )}

                  </div>

                  <h1 className="truncate text-2xl font-black tracking-tight text-[#18352D] md:text-3xl">
                    {purchase.number}
                  </h1>

                  <p className="mt-1 text-sm text-gray-500">
                    Detail dan pengelolaan Purchase Order Outlet
                  </p>

                </div>

              </div>

              <div className="grid grid-cols-2 gap-3 sm:flex">

                <div className="rounded-2xl border border-[#E5ECE9] bg-[#FAFCFB] px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Items
                  </p>

                  <p className="mt-1 text-lg font-black text-[#18352D]">
                    {items.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#E5ECE9] bg-[#FAFCFB] px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Total Qty
                  </p>

                  <p className="mt-1 text-lg font-black text-[#18352D]">
                    {totalQty}
                  </p>
                </div>

                <div className="col-span-2 rounded-2xl border border-[#D8E7E0] bg-[#F2F7F4] px-5 py-3 sm:col-span-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B8178]">
                    Grand Total
                  </p>

                  <p className="mt-1 text-lg font-black text-[#497F70]">
                    Rp{" "}
                    {formatRupiah(
                      total
                    )}
                  </p>
                </div>

              </div>

            </div>
          </div>

          {/* ACTION BAR */}

          <div className="border-t border-[#E8EEEB] bg-[#FAFCFB] px-5 py-4 md:px-7">
            <div className="flex flex-wrap items-center justify-end gap-2">

              <button
                type="button"
                onClick={
                  handleExportPDF
                }
                disabled={
                  exporting
                }
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
              >
                {exporting ? (
                  <RefreshCw
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <FileText
                    size={16}
                  />
                )}

                {exporting
                  ? "Membuat PDF..."
                  : "Export PDF"}
              </button>

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
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {approving ? (
                    <RefreshCw
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <CheckCircle2
                      size={16}
                    />
                  )}

                  {approving
                    ? "Approving..."
                    : "Approve PO"}
                </button>
              )}

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
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? (
                    <RefreshCw
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Trash2
                      size={16}
                    />
                  )}

                  {deleting
                    ? "Menghapus..."
                    : "Hapus"}
                </button>
              )}

            </div>
          </div>
        </div>

        {/* ==================================================
            CONTENT
        ================================================== */}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">

          {/* ==================================================
              LEFT
          ================================================== */}

          <div className="min-w-0 space-y-6">

            {/* ==================================================
                INFORMATION CARD
            ================================================== */}

            <section className="overflow-hidden rounded-[26px] border border-[#DDE9E4] bg-white shadow-[0_8px_30px_rgba(24,53,45,0.045)]">

              <div className="border-b border-[#E8EEEB] px-5 py-5 md:px-6">

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

                    <p className="mt-0.5 text-xs text-gray-500">
                      Informasi utama dan tujuan transaksi.
                    </p>
                  </div>

                </div>

              </div>

              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 md:p-6">

                <div className="rounded-2xl border border-[#E5ECE9] bg-[#FAFCFB] p-4">

                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    <Receipt
                      size={14}
                    />
                    Nomor PO
                  </div>

                  <p className="text-sm font-black text-[#18352D]">
                    {purchase.number}
                  </p>

                </div>

                <div className="rounded-2xl border border-[#E5ECE9] bg-[#FAFCFB] p-4">

                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    <CalendarDays
                      size={14}
                    />
                    Tanggal
                  </div>

                  <p className="text-sm font-black text-[#18352D]">
                    {formatPurchaseDate(
                      purchase.purchaseDate
                    )}
                  </p>

                </div>

                <div>

                  <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#607A70]">
                    <Building2
                      size={14}
                    />
                    Outlet
                  </label>

                  <div className="relative">

                    <select
                      value={
                        outletId
                      }
                      disabled={
                        !isDraft ||
                        isOutletUser
                      }
                      onChange={(e) => {
                        if (isOutletUser) {
                          return;
                        }

                        setOutletId(
                          e.target.value
                        );
                      }}
                      className="h-12 w-full appearance-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 pr-10 text-sm font-semibold text-[#18352D] outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10 disabled:bg-gray-100 disabled:text-gray-500"
                    >
                      <option value="">
                        Pilih Outlet
                      </option>

                      {availableOutlets.map(
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

                    <ChevronDown
                      size={17}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                  </div>

                  {isOutletUser && (
                    <p className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-gray-400">
                      <ShieldAlert size={12} />
                      Outlet terkunci sesuai outlet user.
                    </p>
                  )}

                </div>

                <div>

                  <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#607A70]">
                    <UserRound
                      size={14}
                    />
                    Supplier
                  </label>

                  <div className="relative">

                    <div
                      className={`flex h-12 w-full items-center rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] transition focus-within:border-[#497F70] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#497F70]/10 ${
                        !isDraft
                          ? "bg-gray-100 text-gray-500"
                          : ""
                      }`}
                    >
                      <Search
                        size={17}
                        className="ml-4 shrink-0 text-gray-400"
                      />

                      <input
                        type="text"
                        value={
                          supplierOpen
                            ? supplierSearch
                            : selectedSupplier
                              ? `${selectedSupplier.code} - ${selectedSupplier.name}`
                              : ""
                        }
                        disabled={!isDraft}
                        placeholder="Ketik untuk cari supplier..."
                        onFocus={() => {
                          setSupplierSearch(
                            selectedSupplier
                              ? `${selectedSupplier.code} ${selectedSupplier.name}`
                              : ""
                          );
                          setSupplierOpen(true);
                        }}
                        onChange={(e) => {
                          setSupplierSearch(e.target.value);
                          setSupplierId("");
                          setSupplierOpen(true);
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            setSupplierOpen(false);
                          }, 150);
                        }}
                        className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-[#18352D] outline-none placeholder:text-gray-400 disabled:cursor-not-allowed disabled:text-gray-500"
                      />

                      {supplierId && isDraft && (
                        <button
                          type="button"
                          onClick={() => {
                            setSupplierId("");
                            setSupplierSearch("");
                            setSupplierOpen(false);
                          }}
                          className="mr-1 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                          aria-label="Hapus supplier"
                        >
                          <X size={15} />
                        </button>
                      )}

                      <ChevronDown
                        size={17}
                        className="mr-3 shrink-0 text-gray-400"
                      />
                    </div>

                    {supplierOpen && isDraft && (
                      <div className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-[#D5E5DC] bg-white p-1.5 shadow-xl">
                        {filteredSuppliers.length > 0 ? (
                          filteredSuppliers.map((supplier) => {
                            const selected =
                              Number(supplierId) === supplier.id;

                            return (
                              <button
                                key={supplier.id}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setSupplierId(String(supplier.id));
                                  setSupplierSearch(
                                    `${supplier.code} ${supplier.name}`
                                  );
                                  setSupplierOpen(false);
                                }}
                                className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm transition ${
                                  selected
                                    ? "bg-[#EAF4EF] font-bold text-[#245B4D]"
                                    : "text-[#18352D] hover:bg-[#F4F8F5]"
                                }`}
                              >
                                <span className="min-w-0">
                                  <span className="font-bold">
                                    {supplier.code}
                                  </span>{" "}
                                  <span className="text-gray-600">
                                    - {supplier.name}
                                  </span>
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-3 py-3 text-sm text-gray-400">
                            Supplier tidak ditemukan.
                          </div>
                        )}
                      </div>
                    )}

                  </div>

                </div>

                <div className="rounded-2xl border border-[#E5ECE9] bg-[#FAFCFB] p-4">

                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    <CreditCard
                      size={14}
                    />
                    Metode Pembayaran
                  </div>

                  <p className="text-sm font-black text-[#18352D]">
                    {purchase.paymentMethod ||
                      "-"}
                  </p>

                </div>

                <div className="rounded-2xl border border-[#E5ECE9] bg-[#FAFCFB] p-4">

                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    <CircleCheck
                      size={14}
                    />
                    Dibuat
                  </div>

                  <p className="text-sm font-black text-[#18352D]">
                    {formatPurchaseDate(
                      purchase.createdAt
                    )}
                  </p>

                </div>

                <div className="md:col-span-2">

                  <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#607A70]">
                    <MessageSquare
                      size={14}
                    />
                    Keterangan PO
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
                        e.target
                          .value
                      )
                    }
                    rows={4}
                    placeholder="Tambahkan komentar atau keterangan..."
                    className="w-full resize-none rounded-2xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm leading-6 text-[#18352D] outline-none transition placeholder:text-gray-400 focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10 disabled:bg-gray-100 disabled:text-gray-500"
                  />

                </div>

              </div>
            </section>

            {/* ==================================================
                ADD ITEM
            ================================================== */}

            {isDraft && (
              <section className="overflow-visible rounded-[26px] border border-[#DDE9E4] bg-white shadow-[0_8px_30px_rgba(24,53,45,0.045)]">

                <div className="border-b border-[#E8EEEB] px-5 py-5 md:px-6">

                  <div className="flex items-center gap-3">

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                      <Plus
                        size={19}
                      />
                    </div>

                    <div>
                      <h2 className="font-bold text-[#18352D]">
                        Tambah Barang
                      </h2>

                      <p className="mt-0.5 text-xs text-gray-500">
                        Harga otomatis mengambil harga pembelian terakhir outlet jika tersedia.
                      </p>
                    </div>

                  </div>

                </div>

                <div className="p-5 md:p-6">

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">

                    {/* BARANG */}

                    <div className="relative lg:col-span-5">

                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#607A70]">
                        Barang
                      </label>

                      <div className="relative">

                        <Search
                          size={17}
                          className="absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-gray-400"
                        />

                        <input
                          value={
                            barangSearch
                          }
                          onFocus={() =>
                            setBarangOpen(
                              true
                            )
                          }
                          onChange={(e) => {
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
                          placeholder="Cari kode / nama / barcode..."
                          className="h-12 w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] pl-10 pr-10 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                        />

                        {barangSearch && (
                          <button
                            type="button"
                            onClick={() => {
                              setBarangSearch(
                                ""
                              );

                              setSelectedBarangId(
                                ""
                              );

                              setPrice(
                                ""
                              );
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                          >
                            <X
                              size={15}
                            />
                          </button>
                        )}

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

                          <div className="absolute left-0 right-0 top-[78px] z-30 max-h-80 overflow-y-auto rounded-2xl border border-[#DDE9E4] bg-white p-1.5 shadow-[0_18px_50px_rgba(24,53,45,0.15)]">

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
                                  const itemPurchasePrice =
                                    getEffectivePurchasePrice(
                                      item
                                    );

                                  const itemLastPrice =
                                    getLastPurchasePrice(
                                      item
                                    );

                                  return (
                                    <button
                                      key={
                                        item.id
                                      }
                                      type="button"
                                      onClick={() => {
                                        handleSelectBarang(
                                          String(
                                            item.id
                                          )
                                        );

                                        setBarangSearch(
                                          `${item.code} - ${item.name}`
                                        );

                                        setBarangOpen(
                                          false
                                        );
                                      }}
                                      className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-3 text-left transition hover:bg-[#F2F7F4]"
                                    >

                                      <div className="min-w-0">

                                        <div className="flex items-center gap-2">

                                          <p className="truncate text-sm font-bold text-[#18352D]">
                                            {
                                              item.name
                                            }
                                          </p>

                                          {itemLastPrice >
                                            0 && (
                                            <span className="shrink-0 rounded-full bg-[#EEF5F2] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#497F70]">
                                              Histori tersedia
                                            </span>
                                          )}

                                        </div>

                                        <div className="mt-1 flex gap-2 text-xs text-gray-400">

                                          <span>
                                            {
                                              item.code
                                            }
                                          </span>

                                          <span>
                                            •
                                          </span>

                                          <span>
                                            {
                                              item.unit
                                            }
                                          </span>

                                        </div>

                                      </div>

                                      <div className="shrink-0 text-right">

                                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                                          Harga Pembelian
                                        </p>

                                        <p className="text-sm font-bold text-[#497F70]">
                                          Rp{" "}
                                          {formatRupiah(
                                            itemPurchasePrice
                                          )}
                                        </p>

                                        {item.hargaSource && (
                                          <p className="mt-0.5 text-[9px] text-gray-400">
                                            {
                                              item.hargaSource
                                            }
                                          </p>
                                        )}

                                      </div>

                                    </button>
                                  );
                                }
                              )
                            )}

                          </div>
                        </>
                      )}

                    </div>

                    {/* QTY */}

                    <div className="lg:col-span-2">

                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#607A70]">
                        Qty
                      </label>

                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={
                          qty
                        }
                        onChange={(e) =>
                          setQty(
                            e.target
                              .value
                          )
                        }
                        className="h-12 w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 text-right text-sm font-semibold outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                      />

                    </div>

                    {/* PRICE */}

                    <div className="lg:col-span-3">

                      <label className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#607A70]">
                        <span>
                          Harga Satuan
                        </span>

                        {selectedPriceChange && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black tracking-normal ${
                              selectedPriceChange.direction ===
                              "up"
                                ? "bg-[#EDE3FF] text-[#7650B5]"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {selectedPriceChange.direction ===
                            "up" ? (
                              <TrendingUp
                                size={11}
                              />
                            ) : (
                              <TrendingDown
                                size={11}
                              />
                            )}

                            {selectedPriceChange.direction ===
                            "up"
                              ? "NAIK"
                              : "TURUN"}
                          </span>
                        )}
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={
                          price
                        }
                        onChange={(e) =>
                          setPrice(
                            e.target
                              .value
                          )
                        }
                        placeholder="0"
                        className={`h-12 w-full rounded-xl border bg-[#FAFCFB] px-4 text-right text-sm font-semibold outline-none transition focus:bg-white focus:ring-4 ${
                          selectedPriceChange
                            ? selectedPriceChange.direction ===
                              "up"
                              ? "border-[#CBB4F0] focus:border-[#8B63C7] focus:ring-[#8B63C7]/10"
                              : "border-blue-300 focus:border-blue-500 focus:ring-blue-500/10"
                            : "border-[#D5E5DC] focus:border-[#497F70] focus:ring-[#497F70]/10"
                        }`}
                      />

                      {selectedBarang && (
                        <div className="mt-3 space-y-2">

                          <div className="flex items-center justify-between gap-3 text-[11px]">

                            <span className="text-gray-400">
                              Harga pembelian
                            </span>

                            <span className="font-bold text-[#497F70]">
                              Rp{" "}
                              {formatRupiah(
                                getEffectivePurchasePrice(
                                  selectedBarang
                                )
                              )}
                            </span>

                          </div>

                          {getLastPurchasePrice(
                            selectedBarang
                          ) > 0 && (
                            <div className="flex items-center justify-between gap-3 text-[11px]">

                              <span className="inline-flex items-center gap-1.5 text-gray-400">
                                <History
                                  size={12}
                                />
                                Pembelian terakhir
                              </span>

                              <span className="font-bold text-[#35564C]">
                                Rp{" "}
                                {formatRupiah(
                                  getLastPurchasePrice(
                                    selectedBarang
                                  )
                                )}
                              </span>

                            </div>
                          )}

                          {selectedBarang.hargaSource && (
                            <p className="text-[10px] text-gray-400">
                              Sumber:
                              {" "}
                              {
                                selectedBarang.hargaSource
                              }
                            </p>
                          )}

                        </div>
                      )}


                    </div>

                      {/* ==================================================
                          PREMIUM PRICE CHANGE WARNING
                      ================================================== */}

                      {selectedPriceChange && (
                        <div
                          className={`relative mt-1 w-full min-w-0 overflow-hidden lg:col-span-10 rounded-2xl border shadow-[0_12px_30px_rgba(109,69,168,0.10)] ${
                            selectedPriceChange.direction ===
                            "up"
                              ? "border-[#D8C7F5] bg-gradient-to-br from-[#F5F0FF] via-white to-[#EDF7F4]"
                              : "border-blue-200 bg-gradient-to-br from-blue-50 via-white to-sky-50"
                          }`}
                        >

                          <div
                            className={`absolute left-0 top-0 h-full w-1 ${
                              selectedPriceChange.direction ===
                              "up"
                                ? "bg-[#8B63C7]"
                                : "bg-blue-500"
                            }`}
                          />

                          <div className="p-3.5 pl-4">

                            <div className="flex items-start gap-3">

                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                  selectedPriceChange.direction ===
                                  "up"
                                    ? "bg-[#EDE3FF] text-[#7650B5]"
                                    : "bg-blue-100 text-blue-600"
                                }`}
                              >
                                {selectedPriceChange.direction ===
                                "up" ? (
                                  <TrendingUp
                                    size={17}
                                  />
                                ) : (
                                  <TrendingDown
                                    size={17}
                                  />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">

                                <div className="flex flex-wrap items-center gap-2">

                                  <p className="text-xs font-black text-[#18352D]">
                                    Perubahan Harga Terdeteksi
                                  </p>

                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black ${
                                      selectedPriceChange.direction ===
                                      "up"
                                        ? "bg-[#EDE3FF] text-[#7650B5]"
                                        : "bg-blue-100 text-blue-700"
                                    }`}
                                  >
                                    {selectedPriceChange.direction ===
                                    "up" ? (
                                      <ArrowUpRight
                                        size={11}
                                      />
                                    ) : (
                                      <ArrowDownRight
                                        size={11}
                                      />
                                    )}

                                    {selectedPriceChange.direction ===
                                    "up"
                                      ? "+"
                                      : "-"}
                                    {formatPercent(
                                      selectedPriceChange.percentage
                                    )}
                                    %
                                  </span>

                                </div>

                                <p className="mt-1 text-[10px] leading-5 text-gray-500">
                                  Harga yang Anda masukkan berbeda dari harga pembelian terakhir barang ini. Mohon periksa kembali sebelum melanjutkan.
                                </p>

                                <div className="mt-3 grid grid-cols-2 gap-2">

                                  <div className="rounded-xl border border-black/5 bg-white/80 px-3 py-2.5">

                                    <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                                      Harga terakhir
                                    </p>

                                    <p className="mt-1 text-xs font-black text-[#35564C]">
                                      Rp{" "}
                                      {formatRupiah(
                                        selectedPriceChange.previousPrice
                                      )}
                                    </p>

                                  </div>

                                  <div className="rounded-xl border border-black/5 bg-white/80 px-3 py-2.5">

                                    <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                                      Harga baru
                                    </p>

                                    <p
                                      className={`mt-1 text-xs font-black ${
                                        selectedPriceChange.direction ===
                                        "up"
                                          ? "text-[#7650B5]"
                                          : "text-blue-700"
                                      }`}
                                    >
                                      Rp{" "}
                                      {formatRupiah(
                                        selectedPriceChange.currentPrice
                                      )}
                                    </p>

                                  </div>

                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-gray-400">

                                  {selectedPriceChange.number && (
                                    <span className="inline-flex items-center gap-1">
                                      <Receipt
                                        size={10}
                                      />
                                      {
                                        selectedPriceChange.number
                                      }
                                    </span>
                                  )}

                                  {selectedPriceChange.date && (
                                    <span className="inline-flex items-center gap-1">
                                      <CalendarDays
                                        size={10}
                                      />
                                      {formatPurchaseDate(
                                        selectedPriceChange.date
                                      )}
                                    </span>
                                  )}

                                </div>

                              </div>

                            </div>

                          </div>
                        </div>

                      )}

                    {/* ADD */}

                    <div className="flex items-end lg:col-span-2">

                      <button
                        type="button"
                        onClick={
                          addItem
                        }
                        className="h-12 w-full rounded-xl bg-[#497F70] px-4 text-sm font-bold text-white shadow-lg shadow-[#497F70]/15 transition hover:-translate-y-0.5 hover:bg-[#3D6D60]"
                      >
                        <span className="inline-flex items-center justify-center gap-2">
                          <Plus
                            size={17}
                          />
                          Tambah
                        </span>
                      </button>

                    </div>

                  </div>

                </div>
              </section>
            )}

            {/* ==================================================
                ITEMS
            ================================================== */}

            <section className="overflow-hidden rounded-[26px] border border-[#DDE9E4] bg-white shadow-[0_8px_30px_rgba(24,53,45,0.045)]">

              <div className="flex flex-col gap-4 border-b border-[#E8EEEB] px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                    <ShoppingCart
                      size={19}
                    />
                  </div>

                  <div>
                    <h2 className="font-bold text-[#18352D]">
                      Detail Barang
                    </h2>

                    <p className="mt-0.5 text-xs text-gray-500">
                      {items.length} item •{" "}
                      {totalQty} total quantity
                    </p>
                  </div>

                </div>

                <div className="flex flex-wrap items-center gap-2">

                  {changedPriceCount >
                    0 && (
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">

                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EDE3FF] text-[#7650B5]">
                        <AlertTriangle
                          size={14}
                        />
                      </div>

                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-amber-600">
                          Harga berubah
                        </p>

                        <p className="text-xs font-black text-amber-800">
                          {changedPriceCount} item perlu diperiksa
                        </p>
                      </div>

                    </div>
                  )}

                  <div className="rounded-2xl bg-[#F2F7F4] px-4 py-3">

                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#70857D]">
                      Total Purchase
                    </p>

                    <p className="mt-0.5 text-xl font-black text-[#497F70]">
                      Rp{" "}
                      {formatRupiah(
                        total
                      )}
                    </p>

                  </div>

                </div>

              </div>

              <div className="overflow-x-auto">

                <table className="min-w-[950px] w-full text-sm">

                  <thead>
                    <tr className="border-b border-[#E8EEEB] bg-[#F7FAF8]">

                      <th className="w-16 px-5 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-[#607A70]">
                        No
                      </th>

                      <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-[#607A70]">
                        Barang
                      </th>

                      <th className="w-24 px-5 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-[#607A70]">
                        Unit
                      </th>

                      <th className="w-28 px-5 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-[#607A70]">
                        Qty
                      </th>

                      <th className="w-44 px-5 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-[#607A70]">
                        Harga
                      </th>

                      <th className="w-48 px-5 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-[#607A70]">
                        Subtotal
                      </th>

                      {isDraft && (
                        <th className="w-20 px-5 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-[#607A70]">
                          Aksi
                        </th>
                      )}

                    </tr>
                  </thead>

                  <tbody>

                    {items.length ===
                    0 ? (
                      <tr>
                        <td
                          colSpan={
                            isDraft
                              ? 7
                              : 6
                          }
                          className="px-6 py-16"
                        >

                          <div className="flex flex-col items-center justify-center text-center">

                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
                              <Package
                                size={26}
                              />
                            </div>

                            <p className="font-bold text-gray-700">
                              Belum ada barang
                            </p>

                            <p className="mt-1 text-xs text-gray-400">
                              Tambahkan barang melalui form di atas.
                            </p>

                          </div>

                        </td>
                      </tr>
                    ) : (
                      items.map(
                        (
                          item,
                          index
                        ) => {

                          const itemQty =
                            toNumber(
                              item.qty
                            );

                          const itemPrice =
                            toNumber(
                              item.price
                            );

                          const itemSubtotal =
                            itemQty *
                            itemPrice;

                          const itemPriceChange =
                            getPriceChangeInfo(
                              {
                                ...item.barang,
                                hargaTerakhir:
                                  item.lastPurchasePrice,
                                lastPurchasePrice:
                                  item.lastPurchasePrice,
                                lastPurchaseDate:
                                  item.lastPurchaseDate,
                                hargaPurchaseNumber:
                                  item.lastPurchaseNumber,
                              },
                              itemPrice
                            );

                          return (
                            <tr
                              key={
                                item.barangId
                              }
                              className={`group border-b border-[#EDF2EF] transition ${
                                itemPriceChange
                                  ? "bg-amber-50/30 hover:bg-amber-50/60"
                                  : "hover:bg-[#FAFCFB]"
                              }`}
                            >

                              <td className="px-5 py-5">

                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#F1F6F3] text-[11px] font-bold text-[#607A70]">
                                  {String(
                                    index +
                                      1
                                  ).padStart(
                                    2,
                                    "0"
                                  )}
                                </span>

                              </td>

                              <td className="px-5 py-5">

                                <div className="flex items-center gap-3">

                                  <div
                                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                      itemPriceChange
                                        ? "bg-[#EDE3FF] text-[#7650B5]"
                                        : "bg-[#F0F6F3] text-[#497F70]"
                                    }`}
                                  >
                                    {itemPriceChange ? (
                                      <AlertTriangle
                                        size={
                                          17
                                        }
                                      />
                                    ) : (
                                      <Package
                                        size={
                                          17
                                        }
                                      />
                                    )}
                                  </div>

                                  <div className="min-w-0">

                                    <div className="flex flex-wrap items-center gap-2">

                                      <p className="truncate font-bold text-[#18352D]">
                                        {
                                          item
                                            .barang
                                            .name
                                        }
                                      </p>

                                      {itemPriceChange && (
                                        <span
                                          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                                            itemPriceChange.direction ===
                                            "up"
                                              ? "bg-[#EDE3FF] text-[#7650B5]"
                                              : "bg-blue-100 text-blue-700"
                                          }`}
                                        >
                                          {itemPriceChange.direction ===
                                          "up" ? (
                                            <TrendingUp
                                              size={10}
                                            />
                                          ) : (
                                            <TrendingDown
                                              size={10}
                                            />
                                          )}

                                          Harga Berubah
                                        </span>
                                      )}

                                    </div>

                                    <p className="mt-1 text-xs text-gray-400">
                                      {
                                        item
                                          .barang
                                          .code
                                      }

                                      {item
                                        .barang
                                        .barcode && (
                                        <>
                                          {" "}
                                          •{" "}
                                          {
                                            item
                                              .barang
                                              .barcode
                                          }
                                        </>
                                      )}
                                    </p>

                                    {itemPriceChange && (
                                      <p className="mt-1 text-[10px] text-[#7650B5]/85">
                                        Harga terakhir Rp{" "}
                                        {formatRupiah(
                                          itemPriceChange.previousPrice
                                        )}{" "}
                                        → sekarang Rp{" "}
                                        {formatRupiah(
                                          itemPriceChange.currentPrice
                                        )}
                                      </p>
                                    )}

                                  </div>

                                </div>

                              </td>

                              <td className="px-5 py-5">

                                <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                                  {
                                    item
                                      .barang
                                      .unit
                                  }
                                </span>

                              </td>

                              <td className="px-5 py-5 text-right">

                                {isDraft ? (
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="any"
                                    value={
                                      itemQty
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      updateQty(
                                        item.barangId,
                                        e.target
                                          .value
                                      )
                                    }
                                    className="h-9 w-24 rounded-xl border border-[#D5E5DC] bg-white px-3 text-right text-xs font-semibold outline-none focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                                  />
                                ) : (
                                  <span className="font-semibold text-[#18352D]">
                                    {
                                      itemQty
                                    }
                                  </span>
                                )}

                              </td>

                              <td className="px-5 py-5 text-right">

                                {isDraft ? (
                                  <div className="flex flex-col items-end gap-1.5">

                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      value={
                                        itemPrice
                                      }
                                      onChange={(
                                        e
                                      ) =>
                                        updatePrice(
                                          item.barangId,
                                          e.target
                                            .value
                                        )
                                      }
                                      className={`h-9 w-36 rounded-xl border bg-white px-3 text-right text-xs font-semibold outline-none focus:ring-4 ${
                                        itemPriceChange
                                          ? itemPriceChange.direction ===
                                            "up"
                                            ? "border-[#CBB4F0] focus:border-[#8B63C7] focus:ring-[#8B63C7]/10"
                                            : "border-blue-300 focus:border-blue-500 focus:ring-blue-500/10"
                                          : "border-[#D5E5DC] focus:border-[#497F70] focus:ring-[#497F70]/10"
                                      }`}
                                    />

                                    {itemPriceChange && (
                                      <span
                                        className={`inline-flex items-center gap-1 text-[9px] font-bold ${
                                          itemPriceChange.direction ===
                                          "up"
                                            ? "text-[#7650B5]"
                                            : "text-blue-700"
                                        }`}
                                      >
                                        {itemPriceChange.direction ===
                                        "up" ? (
                                          <ArrowUpRight
                                            size={10}
                                          />
                                        ) : (
                                          <ArrowDownRight
                                            size={10}
                                          />
                                        )}

                                        {itemPriceChange.direction ===
                                        "up"
                                          ? "+"
                                          : "-"}
                                        {formatPercent(
                                          itemPriceChange.percentage
                                        )}
                                        %
                                      </span>
                                    )}

                                  </div>
                                ) : (
                                  <span className="font-semibold text-gray-600">
                                    Rp{" "}
                                    {formatRupiah(
                                      itemPrice
                                    )}
                                  </span>
                                )}

                              </td>

                              <td className="px-5 py-5 text-right">

                                <span className="font-black text-[#18352D]">
                                  Rp{" "}
                                  {formatRupiah(
                                    itemSubtotal
                                  )}
                                </span>

                              </td>

                              {isDraft && (
                                <td className="px-5 py-5 text-center">

                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeItem(
                                        item.barangId
                                      )
                                    }
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500 opacity-70 transition hover:bg-red-100 hover:text-red-700 group-hover:opacity-100"
                                    title="Hapus barang"
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
                          );
                        }
                      )
                    )}

                  </tbody>

                  <tfoot>

                    <tr className="bg-[#F7FAF8]">

                      <td
                        colSpan={5}
                        className="px-5 py-5 text-right text-xs font-bold uppercase tracking-wider text-[#607A70]"
                      >
                        Grand Total
                      </td>

                      <td className="px-5 py-5 text-right">

                        <span className="text-xl font-black text-[#18352D]">
                          Rp{" "}
                          {formatRupiah(
                            total
                          )}
                        </span>

                      </td>

                      {isDraft && (
                        <td />
                      )}

                    </tr>

                  </tfoot>

                </table>

              </div>

            </section>

            {/* ==================================================
                REMARKS
            ================================================== */}

            {remarks.trim() && (
              <section className="overflow-hidden rounded-[26px] border border-[#DDE9E4] bg-white shadow-[0_8px_30px_rgba(24,53,45,0.045)]">

                <div className="border-b border-[#E8EEEB] px-5 py-5 md:px-6">

                  <div className="flex items-center justify-between gap-4">

                    <div className="flex items-center gap-3">

                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                        <MessageSquare
                          size={19}
                        />
                      </div>

                      <div>
                        <h2 className="font-bold">
                          Keterangan PO
                        </h2>

                        <p className="text-xs text-gray-500">
                          Catatan yang tersimpan pada Purchase Order.
                        </p>
                      </div>

                    </div>


                  </div>

                </div>

                <div className="p-5 md:p-6">

                  <div className="rounded-2xl border border-[#E5ECE9] bg-[#FAFCFB] px-5 py-4">

                    <p className="whitespace-pre-wrap text-sm leading-6 text-gray-600">
                      {remarks}
                    </p>

                  </div>

                </div>

              </section>
            )}

          </div>

          {/* ==================================================
              RIGHT SUMMARY
          ================================================== */}

          <aside className="xl:sticky xl:top-6 xl:self-start">

            <div className="overflow-hidden rounded-[28px] border border-[#DDE9E4] bg-white shadow-[0_14px_45px_rgba(24,53,45,0.08)]">

              {/* DARK SUMMARY */}

              <div className="relative overflow-hidden bg-[#18352D] p-6 text-white">

                <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-white/5" />

                <div className="pointer-events-none absolute -bottom-20 -left-10 h-36 w-36 rounded-full bg-white/5" />

                <div className="relative">

                  <div className="flex items-center gap-3">

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                      <Sparkles
                        size={20}
                      />
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/45">
                        ORDER SUMMARY
                      </p>

                      <h2 className="font-bold">
                        Ringkasan PO
                      </h2>
                    </div>

                  </div>

                  <div className="mt-8">

                    <p className="text-xs text-white/45">
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

              </div>

              {/* SUMMARY */}

              <div className="space-y-5 p-5">

                <div className="grid grid-cols-2 gap-3">

                  <div className="rounded-2xl border border-[#E5ECE9] bg-[#FAFCFB] p-4">

                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Items
                    </p>

                    <p className="mt-1 text-xl font-black text-[#18352D]">
                      {items.length}
                    </p>

                  </div>

                  <div className="rounded-2xl border border-[#E5ECE9] bg-[#FAFCFB] p-4">

                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Qty
                    </p>

                    <p className="mt-1 text-xl font-black text-[#18352D]">
                      {totalQty}
                    </p>

                  </div>

                </div>

                {/* ==================================================
                    PREMIUM PRICE ALERT SUMMARY
                ================================================== */}

                {changedPriceCount >
                  0 && (
                  <div className="relative overflow-hidden rounded-2xl border border-[#D8C7F5] bg-gradient-to-br from-[#F5F0FF] via-white to-[#EDF7F4] p-4">

                    <div className="absolute -right-7 -top-7 h-20 w-20 rounded-full bg-[#EDE3FF]/70" />

                    <div className="relative">

                      <div className="flex items-start gap-3">

                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EDE3FF] text-[#7650B5]">
                          <ShieldAlert
                            size={18}
                          />
                        </div>

                        <div className="min-w-0">

                          <div className="flex items-center gap-2">

                            <p className="text-xs font-black text-[#18352D]">
                              Perhatian Harga
                            </p>

                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#7650B5]">
                              Review
                            </span>

                          </div>

                          <p className="mt-1 text-[10px] leading-5 text-gray-500">
                            Terdapat{" "}
                            <span className="font-black text-[#7650B5]">
                              {changedPriceCount} item
                            </span>{" "}
                            dengan harga berbeda dari pembelian terakhir.
                          </p>

                        </div>

                      </div>

                      <div className="mt-3 rounded-xl border border-[#E4D8F6] bg-white/85 px-3 py-2.5">

                        <div className="flex items-center justify-between gap-3">

                          <span className="text-[9px] font-semibold text-gray-400">
                            Status pemeriksaan
                          </span>

                          <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-[#7650B5]">
                            <AlertTriangle
                              size={11}
                            />
                            Perlu perhatian
                          </span>

                        </div>

                      </div>

                    </div>

                  </div>
                )}

                <div className="space-y-4">

                  <div className="flex items-start gap-3">

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                      <Building2
                        size={16}
                      />
                    </div>

                    <div className="min-w-0">

                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Outlet
                      </p>

                      <p className="mt-1 truncate text-sm font-bold text-[#35564C]">
                        {selectedOutlet?.name ||
                          "-"}
                      </p>

                      {selectedOutlet?.code && (
                        <p className="mt-0.5 text-[11px] text-gray-400">
                          {
                            selectedOutlet.code
                          }
                        </p>
                      )}

                    </div>

                  </div>

                  <div className="flex items-start gap-3">

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                      <UserRound
                        size={16}
                      />
                    </div>

                    <div className="min-w-0">

                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Supplier
                      </p>

                      <p className="mt-1 truncate text-sm font-bold text-[#35564C]">
                        {selectedSupplier?.name ||
                          "-"}
                      </p>

                      {selectedSupplier?.code && (
                        <p className="mt-0.5 text-[11px] text-gray-400">
                          {
                            selectedSupplier.code
                          }
                        </p>
                      )}

                    </div>

                  </div>

                  <div className="flex items-start gap-3">

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                      <CreditCard
                        size={16}
                      />
                    </div>

                    <div>

                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Pembayaran
                      </p>

                      <p className="mt-1 text-sm font-bold text-[#35564C]">
                        {purchase.paymentMethod ||
                          "-"}
                      </p>

                    </div>

                  </div>

                  <div className="flex items-start gap-3">

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                      <CalendarDays
                        size={16}
                      />
                    </div>

                    <div>

                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Tanggal
                      </p>

                      <p className="mt-1 text-sm font-bold text-[#35564C]">
                        {formatPurchaseDate(
                          purchase.purchaseDate
                        )}
                      </p>

                    </div>

                  </div>

                </div>

                <div className="border-t border-[#E8EEEB] pt-5">

                  <div className="flex items-end justify-between gap-4">

                    <div>
                      <p className="text-xs font-semibold text-gray-400">
                        Total Purchase
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        {items.length} item
                      </p>
                    </div>

                    <p className="text-xl font-black text-[#18352D]">
                      Rp{" "}
                      {formatRupiah(
                        total
                      )}
                    </p>

                  </div>

                </div>

                {/* DRAFT ACTION */}

                {isDraft && (
                  <div className="rounded-2xl border border-[#DDE9E4] bg-[#F7FAF8] p-4">

                    <div className="flex gap-3">

                      <div className="mt-0.5 text-[#497F70]">
                        <Pencil
                          size={16}
                        />
                      </div>

                      <div>

                        <p className="text-xs font-bold text-[#35564C]">
                          Mode Draft
                        </p>

                        <p className="mt-1 text-[11px] leading-5 text-gray-500">
                          PO masih dapat diedit sebelum di-approve.
                        </p>

                      </div>

                    </div>

                  </div>
                )}

                {!isDraft && (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">

                    <div className="flex gap-3">

                      <div className="mt-0.5 text-emerald-600">
                        <CheckCircle2
                          size={17}
                        />
                      </div>

                      <div>

                        <p className="text-xs font-bold text-emerald-700">
                          Purchase Order Terkunci
                        </p>

                        <p className="mt-1 text-[11px] leading-5 text-emerald-700/70">
                          PO dengan status {purchase.status} tidak dapat diedit.
                        </p>

                      </div>

                    </div>

                  </div>
                )}

                {/* MAIN ACTION */}

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
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#497F70] px-5 text-sm font-bold text-white shadow-lg shadow-[#497F70]/20 transition hover:-translate-y-0.5 hover:bg-[#3D6D60] disabled:cursor-not-allowed disabled:opacity-50"
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

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/outlet/purchase"
                    )
                  }
                  className="h-11 w-full rounded-2xl border border-[#D5E5DC] bg-white text-sm font-bold text-gray-600 transition hover:bg-[#F5F8F6]"
                >
                  Kembali ke Purchase
                </button>

              </div>
            </div>
          </aside>

        </div>

        {/* ==================================================
            MOBILE / BOTTOM ACTION
        ================================================== */}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end xl:hidden">


          <button
            type="button"
            onClick={
              handleExportPDF
            }
            disabled={
              exporting
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-bold text-white"
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

            Export PDF
          </button>

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
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#497F70] px-6 text-sm font-bold text-white"
            >
              {saving ? (
                <RefreshCw
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <Save
                  size={17}
                />
              )}

              {saving
                ? "Menyimpan..."
                : "Simpan Perubahan"}
            </button>
          )}

        </div>

        {/* ==================================================
            COMMENT / DISKUSI PURCHASE OUTLET
            Render langsung di bawah seluruh detail Purchase.
            Tidak mengubah data/database Purchase.
        ================================================== */}

        <PurchaseOutletCommentSection purchaseId={id} />

      </div>
    </div>
  );
}

type User = {
  id: number;
  fullname: string;
  role: string;
  outletId?: number | null;
  active?: boolean;
};

type Mention = {
  id: number;
  userId: number;
  createdAt: string;
  user: User;
};

type Comment = {
  id: number;
  comment: string;
  createdAt: string;
  user: User;
  mentions?: Mention[];

  // Foto komentar. Backend dapat mengembalikan salah satu nama field berikut.
  photo?: string | null;
  photoUrl?: string | null;
  imageUrl?: string | null;
  attachmentUrl?: string | null;
  image?: string | null;
  fileUrl?: string | null;
  filePath?: string | null;
};

type CommentPurchase = {
  id: number;
  number: string;
  outletId: number;
  outlet?: {
    id: number;
    code: string;
    name: string;
  } | null;
};

type SelectedMention = {
  id: number;
  fullname: string;
  token: string;
};

type MeApiResponse = {
  success?: boolean;
  data?: {
    id?: number;
    fullname?: string;
    name?: string;
    username?: string;
    role?: string;
    outletId?: number | null;
  };
  user?: {
    id?: number;
    fullname?: string;
    name?: string;
    username?: string;
    role?: string;
    outletId?: number | null;
  };
  id?: number;
};

// =====================================================
// COMPONENT
// =====================================================

function PurchaseOutletCommentSection({
  purchaseId,
}: {
  purchaseId: string | number;
}) {
  const router = useRouter();
  const id = String(purchaseId);

  const textareaRef =
    useRef<HTMLTextAreaElement | null>(null);

  // =====================================================
  // STATE
  // =====================================================

  const [purchase, setPurchase] =
    useState<CommentPurchase | null>(null);

  const [comments, setComments] =
    useState<Comment[]>([]);

  const [comment, setComment] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  // =====================================================
  // CURRENT USER
  // =====================================================

  const [currentUserId, setCurrentUserId] =
    useState<number | null>(null);

  const [loadingCurrentUser, setLoadingCurrentUser] =
    useState(false);

  const [deletingCommentId, setDeletingCommentId] =
    useState<number | null>(null);

  // =====================================================
  // MENTION STATE
  // =====================================================

  const [mentionUsers, setMentionUsers] =
    useState<User[]>([]);

  const [mentionLoading, setMentionLoading] =
    useState(false);

  const [showMentionDropdown, setShowMentionDropdown] =
    useState(false);

  const [mentionQuery, setMentionQuery] =
    useState("");

  const [mentionStart, setMentionStart] =
    useState<number | null>(null);

  const [selectedMentions, setSelectedMentions] =
    useState<SelectedMention[]>([]);

  const [activeMentionIndex, setActiveMentionIndex] =
    useState(0);

  // =====================================================
  // LOAD
  // =====================================================

  useEffect(() => {
    void loadData();
    void loadMentionUsers();
    void loadCurrentUser();
  }, [id]);

  // =====================================================
  // LOAD CURRENT USER
  // =====================================================

  async function loadCurrentUser() {
    try {
      setLoadingCurrentUser(true);

      const res = await fetch("/api/me", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        setCurrentUserId(null);
        return;
      }

      const json =
        (await res.json()) as MeApiResponse;

      const user =
        json.data ||
        json.user ||
        json;

      const userId = Number(user?.id);

      if (
        Number.isInteger(userId) &&
        userId > 0
      ) {
        setCurrentUserId(userId);
      } else {
        setCurrentUserId(null);
      }
    } catch (error) {
      console.error(
        "LOAD CURRENT USER ERROR:",
        error
      );

      setCurrentUserId(null);
    } finally {
      setLoadingCurrentUser(false);
    }
  }

  // =====================================================
  // LOAD DATA
  // =====================================================

  async function loadData() {
    try {
      setLoading(true);

      // ===============================================
      // PURCHASE
      // ===============================================

      const purchaseRes =
        await fetch(
          `/api/outlet/purchase/${id}`,
          {
            cache: "no-store",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          }
        );

      const purchaseJson =
        await purchaseRes.json();

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

      setPurchase(
        purchaseJson.data
      );

      // ===============================================
      // COMMENTS
      // ===============================================

      const commentRes =
        await fetch(
          `/api/outlet/purchase/${id}/comment`,
          {
            method: "GET",
            cache: "no-store",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          }
        );

      const commentJson =
        await commentRes.json();

      if (
        !commentRes.ok ||
        !commentJson.success
      ) {
        alert(
          commentJson.message ||
            "Gagal mengambil komentar"
        );

        return;
      }

      // =================================================
      // IMPORTANT
      // API COMMENT JUGA MENGEMBALIKAN currentUserId
      // =================================================

      const apiCurrentUserId =
        Number(
          commentJson.currentUserId
        );

      if (
        Number.isInteger(
          apiCurrentUserId
        ) &&
        apiCurrentUserId > 0
      ) {
        setCurrentUserId(
          apiCurrentUserId
        );
      }

      // =================================================
      // NORMALIZE COMMENTS
      // =================================================

      const rawComments =
        Array.isArray(
          commentJson.data
        )
          ? commentJson.data
          : [];

      const normalizedComments: Comment[] =
        rawComments.map(
          (item: any) => ({
            ...item,

            id: Number(
              item?.id
            ),

            user: item?.user
              ? {
                  ...item.user,
                  id: Number(
                    item.user.id
                  ),
                }
              : item.user,

            photo:
              item?.photo ??
              item?.photoUrl ??
              item?.imageUrl ??
              item?.attachmentUrl ??
              item?.image ??
              item?.fileUrl ??
              item?.filePath ??
              null,

            photoUrl:
              item?.photoUrl ??
              null,

            imageUrl:
              item?.imageUrl ??
              null,

            attachmentUrl:
              item?.attachmentUrl ??
              null,

            mentions:
              Array.isArray(
                item?.mentions
              )
                ? item.mentions.map(
                    (mention: any) => ({
                      ...mention,
                      id: Number(
                        mention?.id
                      ),
                      userId: Number(
                        mention?.userId
                      ),
                      user:
                        mention?.user
                          ? {
                              ...mention.user,
                              id: Number(
                                mention.user.id
                              ),
                            }
                          : mention.user,
                    })
                  )
                : [],
          })
        );

      setComments(
        normalizedComments
      );
    } catch (error) {
      console.error(
        "LOAD OUTLET PURCHASE COMMENT ERROR:",
        error
      );

      alert(
        "Gagal mengambil data komentar Purchase Outlet"
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // DELETE COMMENT
  // =====================================================

  async function handleDeleteComment(
    item: Comment
  ) {
    const commentUserId =
      Number(
        item?.user?.id
      );

    const loggedInUserId =
      Number(
        currentUserId
      );

    // =================================================
    // USER BELUM TERBACA
    // =================================================

    if (loadingCurrentUser) {
      alert(
        "Data user sedang dimuat. Silakan coba lagi."
      );
      return;
    }

    // =================================================
    // SESSION USER TIDAK TERSEDIA
    // =================================================

    if (
      !Number.isInteger(
        loggedInUserId
      ) ||
      loggedInUserId <= 0
    ) {
      alert(
        "Data user belum tersedia. Silakan login ulang atau refresh halaman."
      );
      return;
    }

    // =================================================
    // HANYA PEMILIK KOMENTAR
    // =================================================

    if (
      !Number.isInteger(
        commentUserId
      ) ||
      commentUserId !==
        loggedInUserId
    ) {
      alert(
        "Anda hanya dapat menghapus komentar yang Anda buat."
      );
      return;
    }

    // =================================================
    // PREVENT DOUBLE DELETE
    // =================================================

    if (
      deletingCommentId !== null
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Hapus komentar ini?\n\nKomentar yang sudah dihapus tidak dapat dikembalikan."
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingCommentId(
        Number(item.id)
      );

      const deleteUrl =
        `/api/outlet/purchase/${encodeURIComponent(
          id
        )}/comment/${encodeURIComponent(
          String(item.id)
        )}`;

      const res =
        await fetch(
          deleteUrl,
          {
            method: "DELETE",
            credentials: "include",
            cache: "no-store",
            headers: {
              Accept:
                "application/json",
            },
          }
        );

      const json =
        await res.json().catch(
          () => null
        );

      if (
        !res.ok ||
        !json?.success
      ) {
        alert(
          json?.message ||
            "Gagal menghapus komentar"
        );

        return;
      }

      // =================================================
      // REMOVE FROM UI
      // =================================================

      setComments(
        (current) =>
          current.filter(
            (commentItem) =>
              Number(
                commentItem.id
              ) !==
              Number(item.id)
          )
      );
    } catch (error) {
      console.error(
        "DELETE OUTLET PURCHASE COMMENT ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat menghapus komentar."
      );
    } finally {
      setDeletingCommentId(
        null
      );
    }
  }

  // =====================================================
  // LOAD MENTION USERS
  // =====================================================

  async function loadMentionUsers() {
    try {
      setMentionLoading(true);

      const res =
        await fetch(
          "/api/user/online",
          {
            cache: "no-store",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          }
        );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        return;
      }

      const rawUsers =
        Array.isArray(
          json.data
        )
          ? json.data
          : Array.isArray(
                json.users
              )
            ? json.users
            : [];

      const normalized: User[] =
        rawUsers
          .map(
            (item: any) => ({
              id: Number(
                item?.id
              ),

              fullname:
                String(
                  item?.fullname ??
                    item?.name ??
                    item?.username ??
                    "User"
                ),

              role:
                String(
                  item?.role ??
                    "-"
                ),

              outletId:
                item?.outletId ??
                null,

              active:
                item?.active ??
                true,
            })
          )
          .filter(
            (item: User) =>
              Number.isInteger(
                item.id
              ) &&
              item.id > 0 &&
              item.active !== false
          );

      const unique =
        Array.from(
          new Map(
            normalized.map(
              (item) => [
                item.id,
                item,
              ]
            )
          ).values()
        );

      setMentionUsers(
        unique
      );
    } catch (error) {
      console.error(
        "LOAD MENTION USERS ERROR:",
        error
      );
    } finally {
      setMentionLoading(false);
    }
  }

  // =====================================================
  // FILTER MENTION USERS
  // =====================================================

  const filteredMentionUsers =
    useMemo(() => {
      const query =
        mentionQuery
          .trim()
          .toLowerCase();

      return mentionUsers
        .filter(
          (user) =>
            !selectedMentions.some(
              (selected) =>
                selected.id ===
                user.id
            )
        )
        .filter(
          (user) => {
            if (!query) {
              return true;
            }

            return (
              user.fullname
                .toLowerCase()
                .includes(query) ||
              user.role
                .toLowerCase()
                .includes(query)
            );
          }
        )
        .slice(0, 8);
    }, [
      mentionUsers,
      mentionQuery,
      selectedMentions,
    ]);

  // =====================================================
  // DETECT MENTION
  // =====================================================

  function detectMention(
    value: string,
    cursorPosition: number
  ) {
    const beforeCursor =
      value.slice(
        0,
        cursorPosition
      );

    const match =
      beforeCursor.match(
        /(^|\s)@([^\s@]*)$/
      );

    if (!match) {
      setShowMentionDropdown(
        false
      );

      setMentionStart(
        null
      );

      return;
    }

    const query =
      match[2] || "";

    const start =
      cursorPosition -
      query.length -
      1;

    setMentionStart(
      start
    );

    setMentionQuery(
      query
    );

    setActiveMentionIndex(
      0
    );

    setShowMentionDropdown(
      true
    );
  }

  // =====================================================
  // COMMENT CHANGE
  // =====================================================

  function handleCommentChange(
    value: string,
    cursorPosition: number
  ) {
    setComment(
      value
    );

    detectMention(
      value,
      cursorPosition
    );
  }

  // =====================================================
  // TEXTAREA CLICK
  // =====================================================

  function handleTextareaClick() {
    const textarea =
      textareaRef.current;

    if (!textarea) {
      return;
    }

    detectMention(
      textarea.value,
      textarea.selectionStart
    );
  }

  // =====================================================
  // TEXTAREA KEYUP
  // =====================================================

  function handleTextareaKeyUp(
    e: KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      e.key === "ArrowUp" ||
      e.key === "ArrowDown" ||
      e.key === "Enter" ||
      e.key === "Escape"
    ) {
      return;
    }

    const textarea =
      textareaRef.current;

    if (!textarea) {
      return;
    }

    detectMention(
      textarea.value,
      textarea.selectionStart
    );
  }

  // =====================================================
  // SELECT MENTION
  // =====================================================

  function selectMention(
    user: User
  ) {
    const textarea =
      textareaRef.current;

    if (
      !textarea ||
      mentionStart === null
    ) {
      return;
    }

    const cursorPosition =
      textarea.selectionStart;

    const beforeMention =
      comment.slice(
        0,
        mentionStart
      );

    const afterCursor =
      comment.slice(
        cursorPosition
      );

    const token =
      `@${user.fullname}`;

    const nextComment =
      `${beforeMention}${token} ${afterCursor}`;

    setComment(
      nextComment
    );

    setSelectedMentions(
      (current) => [
        ...current,
        {
          id: user.id,
          fullname:
            user.fullname,
          token,
        },
      ]
    );

    setShowMentionDropdown(
      false
    );

    setMentionQuery(
      ""
    );

    setMentionStart(
      null
    );

    setActiveMentionIndex(
      0
    );

    requestAnimationFrame(
      () => {
        const nextPosition =
          beforeMention.length +
          token.length +
          1;

        textarea.focus();

        textarea.setSelectionRange(
          nextPosition,
          nextPosition
        );
      }
    );
  }

  // =====================================================
  // REMOVE SELECTED MENTION
  // =====================================================

  function removeMention(
    mention: SelectedMention
  ) {
    const index =
      comment.indexOf(
        mention.token
      );

    if (index === -1) {
      setSelectedMentions(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              mention.id
          )
      );

      return;
    }

    const before =
      comment.slice(
        0,
        index
      );

    const after =
      comment.slice(
        index +
          mention.token.length
      );

    const nextComment =
      `${before}${after}`
        .replace(
          `${mention.token} `,
          ""
        )
        .replace(
          `${mention.token}`,
          ""
        );

    setComment(
      nextComment
    );

    setSelectedMentions(
      (current) =>
        current.filter(
          (item) =>
            item.id !==
            mention.id
        )
    );
  }

  // =====================================================
  // GET VALID MENTION IDS
  // =====================================================

  function getValidMentionIds(
    text: string
  ) {
    return selectedMentions
      .filter(
        (mention) =>
          text.includes(
            mention.token
          )
      )
      .map(
        (mention) =>
          mention.id
      );
  }

  // =====================================================
  // MENTION KEYBOARD
  // =====================================================

  function handleMentionKeyDown(
    e: KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      !showMentionDropdown ||
      filteredMentionUsers.length ===
        0
    ) {
      return;
    }

    if (
      e.key === "ArrowDown"
    ) {
      e.preventDefault();

      setActiveMentionIndex(
        (current) =>
          current >=
          filteredMentionUsers.length -
            1
            ? 0
            : current + 1
      );

      return;
    }

    if (
      e.key === "ArrowUp"
    ) {
      e.preventDefault();

      setActiveMentionIndex(
        (current) =>
          current <= 0
            ? filteredMentionUsers.length -
              1
            : current - 1
      );

      return;
    }

    if (
      e.key === "Enter"
    ) {
      e.preventDefault();

      const selected =
        filteredMentionUsers[
          activeMentionIndex
        ];

      if (selected) {
        selectMention(
          selected
        );
      }

      return;
    }

    if (
      e.key === "Escape"
    ) {
      e.preventDefault();

      setShowMentionDropdown(
        false
      );

      return;
    }
  }

  // =====================================================
  // FORMAT DATE
  // =====================================================

  function formatDate(
    value: string
  ) {
    try {
      return new Date(
        value
      ).toLocaleString(
        "id-ID",
        {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      );
    } catch {
      return value;
    }
  }

  // =====================================================
  // ROLE LABEL
  // =====================================================

  function roleLabel(
    role: string
  ) {
    switch (role) {
      case "ADMIN":
        return "Admin";

      case "MANAGER":
        return "Manager";

      case "PURCHASING":
        return "Purchasing";

      case "OUTLET_ADMIN":
        return "Outlet Admin";

      case "KASIR":
        return "Kasir";

      case "STAFF_MANUFACTURE":
        return "Staff Manufacture";

      default:
        return role;
    }
  }

  // =====================================================
  // ESCAPE REGEX
  // =====================================================

  function escapeRegExp(
    value: string
  ) {
    return value.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
  }

  // =====================================================
  // COMMENT PHOTO / IMAGE
  // =====================================================
  // Backend versi berbeda dapat menggunakan nama field foto yang berbeda.
  // Helper ini menjaga kompatibilitas tanpa mengubah struktur komentar lama.

  function getCommentPhotoUrl(
    item: Comment
  ): string | null {
    const candidates = [
      item?.photo,
      item?.photoUrl,
      item?.imageUrl,
      item?.attachmentUrl,
      item?.image,
      item?.fileUrl,
      item?.filePath,
    ];

    for (const candidate of candidates) {
      if (typeof candidate !== "string") {
        continue;
      }

      const value = candidate.trim();

      if (!value) {
        continue;
      }

      // Data URL / URL absolut langsung dipakai.
      if (
        value.startsWith("data:") ||
        value.startsWith("blob:") ||
        value.startsWith("http://") ||
        value.startsWith("https://") ||
        value.startsWith("/")
      ) {
        return value;
      }

      // Path relatif dari backend dibuat menjadi URL root.
      return `/${value.replace(/^\/+/, "")}`;
    }

    return null;
  }

  function isImageFileUrl(
    url: string
  ): boolean {
    if (url.startsWith("data:image/")) {
      return true;
    }

    const cleanUrl = url
      .split("?")[0]
      .split("#")[0]
      .toLowerCase();

    return /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif)$/i.test(
      cleanUrl
    );
  }

  // =====================================================
  // RENDER COMMENT WITH MENTIONS
  // =====================================================

  function renderCommentText(
    item: Comment
  ) {
    const mentions =
      item.mentions || [];

    if (
      mentions.length ===
      0
    ) {
      return item.comment;
    }

    const mentionNames =
      mentions
        .map(
          (mention) =>
            `@${mention.user.fullname}`
        )
        .filter(Boolean);

    if (
      mentionNames.length ===
      0
    ) {
      return item.comment;
    }

    const pattern =
      new RegExp(
        `(${mentionNames
          .map(escapeRegExp)
          .join("|")})`,
        "gi"
      );

    const parts =
      item.comment.split(
        pattern
      );

    return parts.map(
      (part, index) => {
        const isMention =
          mentionNames.some(
            (name) =>
              name.toLowerCase() ===
              part.toLowerCase()
          );

        if (!isMention) {
          return (
            <span
              key={index}
            >
              {part}
            </span>
          );
        }

        return (
          <span
            key={index}
            className="rounded-md bg-[#EAF3EF] px-1.5 py-0.5 font-semibold text-[#497F70]"
          >
            {part}
          </span>
        );
      }
    );
  }

  // =====================================================
  // SEND COMMENT
  // =====================================================

  async function handleSendComment() {
    const value =
      comment.trim();

    if (!value) {
      alert(
        "Komentar tidak boleh kosong"
      );

      return;
    }

    if (
      value.length > 2000
    ) {
      alert(
        "Komentar maksimal 2000 karakter"
      );

      return;
    }

    if (sending) {
      return;
    }

    try {
      setSending(true);

      const mentionedUserIds =
        getValidMentionIds(
          value
        );

      const res =
        await fetch(
          `/api/outlet/purchase/${id}/comment`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
            },
            body: JSON.stringify({
              comment: value,
              mentionedUserIds,
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
            "Gagal menambahkan komentar"
        );

        return;
      }

      if (json.data) {
        const newComment =
          {
            ...json.data,
            id: Number(
              json.data.id
            ),
            user:
              json.data.user
                ? {
                    ...json.data.user,
                    id: Number(
                      json.data.user.id
                    ),
                  }
                : json.data.user,
            photo:
              json.data.photo ??
              json.data.photoUrl ??
              json.data.imageUrl ??
              json.data.attachmentUrl ??
              json.data.image ??
              json.data.fileUrl ??
              json.data.filePath ??
              null,
            photoUrl:
              json.data.photoUrl ??
              null,
            imageUrl:
              json.data.imageUrl ??
              null,
            attachmentUrl:
              json.data.attachmentUrl ??
              null,
          };

        setComments(
          (current) => [
            ...current,
            newComment,
          ]
        );
      } else {
        await loadData();
      }

      setComment("");

      setSelectedMentions(
        []
      );

      setShowMentionDropdown(
        false
      );

      setMentionQuery(
        ""
      );

      setMentionStart(
        null
      );
    } catch (error) {
      console.error(
        "SEND OUTLET PURCHASE COMMENT ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat menambahkan komentar"
      );
    } finally {
      setSending(false);
    }
  }

  // =====================================================
  // ENTER TO SEND / MENTION NAVIGATION
  // =====================================================

  function handleKeyDown(
    e: KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      showMentionDropdown &&
      filteredMentionUsers.length >
        0
    ) {
      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "Enter" ||
        e.key === "Escape"
      ) {
        handleMentionKeyDown(
          e
        );

        return;
      }
    }

    if (
      e.key === "Enter" &&
      !e.shiftKey
    ) {
      e.preventDefault();

      void handleSendComment();
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

            Memuat komentar Purchase Outlet...
          </div>
        </div>
      </div>
    );
  }

  // =====================================================
  // PURCHASE NOT FOUND
  // =====================================================

  if (!purchase) {
    return null;
  }

  // =====================================================
  // PAGE — HANYA KOTAK COMMENT / DISKUSI
  // =====================================================

  return (
    <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">
  {/* HEADER */}

  <div className="flex items-center justify-between border-b border-[#E5ECE9] px-5 py-4">
    <div>
      <h2 className="font-semibold text-[#18352D]">
        Comment / Diskusi
      </h2>

      <p className="mt-1 text-sm text-gray-500">
        {comments.length} komentar
      </p>
    </div>

    <button
      type="button"
      onClick={() =>
        void loadData()
      }
      disabled={loading}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#DDE9E4] bg-white text-gray-500 transition hover:bg-[#F5F8F6] disabled:opacity-50"
      title="Refresh komentar"
    >
      <RefreshCw
        size={16}
        className={
          loading
            ? "animate-spin"
            : ""
        }
      />
    </button>
  </div>

  {/* =================================================
      COMMENT LIST
  ================================================= */}

  <div className="max-h-[520px] overflow-y-auto px-5 py-5">
    {comments.length ===
    0 ? (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F0F6F3] text-[#497F70]">
          <MessageSquare
            size={25}
          />
        </div>

        <p className="font-medium text-gray-600">
          Belum ada komentar
        </p>

        <p className="mt-1 text-sm text-gray-400">
          Tambahkan komentar untuk Purchase Order ini.
        </p>
      </div>
    ) : (
      <div className="space-y-4">
        {comments.map(
          (item) => {
            const commentUserId =
              Number(
                item?.user?.id
              );

            const isOwnComment =
              currentUserId !==
                null &&
              Number.isInteger(
                commentUserId
              ) &&
              commentUserId ===
                Number(
                  currentUserId
                );

            const isDeleting =
              deletingCommentId ===
              Number(
                item.id
              );

            return (
              <div
                key={
                  item.id
                }
                className="rounded-xl border border-[#E5ECE9] bg-[#FAFCFB] p-4 transition hover:border-[#D5E5DC] hover:shadow-sm"
              >
                {/* USER HEADER */}

                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    {/* AVATAR */}

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#497F70] text-sm font-bold text-white shadow-sm">
                      {item.user?.fullname
                        ?.charAt(
                          0
                        )
                        ?.toUpperCase() ||
                        "U"}
                    </div>

                    {/* USER INFO */}

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-[#18352D]">
                          {
                            item
                              .user
                              ?.fullname
                          }
                        </p>

                        {/* OWN COMMENT BADGE */}

                        {isOwnComment && (
                          <span className="inline-flex items-center rounded-full border border-[#D5E5DC] bg-[#EAF3EF] px-2 py-0.5 text-[10px] font-semibold text-[#497F70]">
                            Anda
                          </span>
                        )}
                      </div>

                      <p className="mt-0.5 text-xs text-gray-400">
                        {roleLabel(
                          item
                            .user
                            ?.role ||
                            "-"
                        )}
                      </p>
                    </div>
                  </div>

                  {/* =================================================
                      RIGHT SIDE
                      DATE + DELETE
                  ================================================= */}

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="hidden text-xs text-gray-400 sm:block">
                      {formatDate(
                        item.createdAt
                      )}
                    </span>

                    {/* DELETE BUTTON
                        ALWAYS VISIBLE FOR OWN COMMENT */}

                    {isOwnComment && (
                      <button
                        type="button"
                        onClick={() =>
                          void handleDeleteComment(
                            item
                          )
                        }
                        disabled={
                          isDeleting
                        }
                        title="Hapus komentar"
                        aria-label="Hapus komentar"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-[#E7D2D2] bg-[#FFF8F8] text-[#B45B5B] opacity-100 shadow-[0_3px_10px_rgba(150,70,70,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#D9BABA] hover:bg-[#FFF0F0] hover:text-[#A54545] hover:shadow-[0_7px_18px_rgba(150,70,70,0.12)] active:translate-y-0 active:scale-95 disabled:cursor-wait disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <RefreshCw
                            size={
                              15
                            }
                            strokeWidth={
                              2
                            }
                            className="animate-spin"
                          />
                        ) : (
                          <Trash2
                            size={
                              15
                            }
                            strokeWidth={
                              1.9
                            }
                          />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* MOBILE DATE */}

                <div className="mt-2 sm:hidden">
                  <span className="text-[11px] text-gray-400">
                    {formatDate(
                      item.createdAt
                    )}
                  </span>
                </div>

                {/* COMMENT */}

                <div className="mt-3 rounded-lg bg-white px-4 py-3 text-sm leading-6 text-gray-700 whitespace-pre-wrap shadow-[0_1px_3px_rgba(24,53,45,0.02)]">
                  {renderCommentText(
                    item
                  )}
                </div>

                {/* COMMENT PHOTO */}

                {(() => {
                  const photoUrl =
                    getCommentPhotoUrl(
                      item
                    );

                  if (!photoUrl) {
                    return null;
                  }

                  if (!isImageFileUrl(photoUrl)) {
                    return (
                      <a
                        href={photoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-3 py-2 text-xs font-semibold text-[#497F70] transition hover:bg-[#F2F7F4]"
                      >
                        <FileText size={15} />
                        Lihat lampiran
                      </a>
                    );
                  }

                  return (
                    <a
                      href={photoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="group mt-3 block w-fit max-w-full overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm transition hover:border-[#BFD3CA] hover:shadow-md"
                      title="Buka foto komentar"
                    >
                      <img
                        src={photoUrl}
                        alt="Foto komentar"
                        className="block max-h-[360px] max-w-full object-contain transition duration-200 group-hover:scale-[1.01]"
                        loading="lazy"
                        onError={(e) => {
                          const wrapper =
                            e.currentTarget.parentElement;

                          if (wrapper) {
                            wrapper.style.display =
                              "none";
                          }
                        }}
                      />
                    </a>
                  );
                })()}

                {/* MENTIONS */}

                {item.mentions &&
                  item.mentions
                    .length >
                    0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-[11px] font-medium text-gray-400">
                        Mention:
                      </span>

                      {item.mentions.map(
                        (
                          mention
                        ) => (
                          <span
                            key={
                              mention.id
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-[#D5E5DC] bg-[#EAF3EF] px-2.5 py-1 text-[11px] font-medium text-[#497F70]"
                          >
                            <AtSign
                              size={
                                11
                              }
                            />

                            {
                              mention
                                .user
                                ?.fullname
                            }
                          </span>
                        )
                      )}
                    </div>
                  )}
              </div>
            );
          }
        )}
      </div>
    )}
  </div>

  {/* =================================================
      INPUT
  ================================================= */}

  <div className="border-t border-[#E5ECE9] bg-[#FAFCFB] p-5">
    <label className="mb-2 block text-sm font-semibold text-gray-700">
      Tambahkan Komentar
    </label>

    {/* SELECTED MENTIONS */}

    {selectedMentions.length >
      0 && (
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-400">
          Mention:
        </span>

        {selectedMentions.map(
          (mention) => (
            <span
              key={
                mention.id
              }
              className="inline-flex items-center gap-1.5 rounded-full border border-[#CFE1D8] bg-[#EAF3EF] px-2.5 py-1 text-xs font-medium text-[#497F70]"
            >
              <AtSign
                size={12}
              />

              {
                mention.fullname
              }

              <button
                type="button"
                onClick={() =>
                  removeMention(
                    mention
                  )
                }
                className="ml-0.5 rounded-full p-0.5 text-[#497F70] transition hover:bg-[#D8EAE2]"
                title={`Hapus mention ${mention.fullname}`}
              >
                <X
                  size={12}
                />
              </button>
            </span>
          )
        )}
      </div>
    )}

    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="relative flex-1">
        <textarea
          ref={
            textareaRef
          }
          value={
            comment
          }
          onChange={(e) =>
            handleCommentChange(
              e.target.value,
              e.target
                .selectionStart
            )
          }
          onClick={
            handleTextareaClick
          }
          onKeyUp={
            handleTextareaKeyUp
          }
          onKeyDown={
            handleKeyDown
          }
          disabled={
            sending
          }
          rows={3}
          maxLength={2000}
          placeholder="Tulis komentar... ketik @ untuk mention user"
          className="w-full resize-none rounded-xl border border-[#D5E5DC] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10 disabled:bg-gray-100"
        />

        {/* =================================================
            MENTION DROPDOWN
        ================================================= */}

        {showMentionDropdown && (
          <div className="absolute bottom-full left-0 z-[10020] mb-2 w-full max-w-[380px] overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E5ECE9] bg-[#FAFCFB] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                  <AtSign
                    size={14}
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold text-[#18352D]">
                    Mention User
                  </p>

                  <p className="text-[10px] text-gray-400">
                    Pilih user yang ingin diberi mention
                  </p>
                </div>
              </div>

              {mentionQuery && (
                <span className="rounded-full bg-[#F0F6F3] px-2 py-1 text-[10px] font-medium text-[#497F70]">
                  @{mentionQuery}
                </span>
              )}
            </div>

            {mentionLoading ? (
              <div className="flex items-center justify-center px-4 py-6 text-xs text-gray-500">
                <RefreshCw
                  size={14}
                  className="mr-2 animate-spin text-[#497F70]"
                />
                Memuat user...
              </div>
            ) : filteredMentionUsers.length ===
              0 ? (
              <div className="px-4 py-6 text-center">
                <UserRound
                  size={20}
                  className="mx-auto mb-2 text-gray-300"
                />

                <p className="text-xs font-medium text-gray-500">
                  User tidak ditemukan
                </p>

                <p className="mt-1 text-[10px] text-gray-400">
                  Coba ketik nama user yang berbeda.
                </p>
              </div>
            ) : (
              <div className="max-h-[280px] overflow-y-auto p-2">
                {filteredMentionUsers.map(
                  (
                    user,
                    index
                  ) => (
                    <button
                      key={
                        user.id
                      }
                      type="button"
                      onMouseDown={(
                        e
                      ) => {
                        e.preventDefault();

                        selectMention(
                          user
                        );
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                        index ===
                        activeMentionIndex
                          ? "bg-[#EAF3EF]"
                          : "hover:bg-[#F5F8F6]"
                      }`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#497F70] text-xs font-bold text-white">
                        {user.fullname
                          ?.charAt(
                            0
                          )
                          ?.toUpperCase() ||
                          "U"}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#18352D]">
                          {
                            user.fullname
                          }
                        </p>

                        <p className="truncate text-[11px] text-gray-400">
                          {roleLabel(
                            user.role
                          )}

                          {user.outletId
                            ? ` · Outlet #${user.outletId}`
                            : " · Pusat"}
                        </p>
                      </div>

                      {index ===
                        activeMentionIndex && (
                        <Check
                          size={
                            16
                          }
                          className="shrink-0 text-[#497F70]"
                        />
                      )}
                    </button>
                  )
                )}
              </div>
            )}

            <div className="border-t border-[#E5ECE9] bg-[#FAFCFB] px-4 py-2">
              <p className="text-[10px] text-gray-400">
                ↑ ↓ navigasi · Enter pilih · Esc tutup
              </p>
            </div>
          </div>
        )}

        <div className="mt-1 flex justify-between">
          <p className="text-xs text-gray-400">
            Enter untuk kirim · Shift + Enter untuk baris baru · @ untuk mention
          </p>

          <p className="text-xs text-gray-400">
            {comment.length}/2000
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() =>
          void handleSendComment()
        }
        disabled={
          sending ||
          !comment.trim()
        }
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#497F70] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3D6D60] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending ? (
          <>
            <RefreshCw
              size={17}
              className="animate-spin"
            />
            Mengirim...
          </>
        ) : (
          <>
            <Send
              size={17}
            />
            Kirim
          </>
        )}
      </button>
    </div>
  </div>
</div>
  );

}