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
  MessageSquare,
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

  /*
   * Harga pembelian outlet.
   * Backend /api/outlet/master-barang dapat mengirim
   * beberapa field harga berikut.
   */
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

export default function PurchaseOutletDetailPage() {
  const router = useRouter();
  const params = useParams();

  const id = String(params.id);

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
   *
   * Hanya mengambil harga > 0.
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
    };
  }

  /*
   * ==========================================================
   * NORMALIZE MASTER BARANG RESPONSE
   * ==========================================================
   *
   * Backend bisa mengirim:
   *
   * {
   *   id,
   *   barangId,
   *   barang: {...}
   * }
   *
   * atau langsung:
   *
   * {
   *   id,
   *   code,
   *   name,
   *   ...
   * }
   *
   * Fungsi ini menangani keduanya.
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
   * LOAD DATA
   * ==========================================================
   */
  async function loadData() {
    try {
      setLoading(true);

      /*
       * Purchase harus didapat terlebih dahulu karena
       * outletId berasal dari Purchase tersebut.
       */
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

      /*
       * ========================================================
       * AMBIL MASTER BARANG KHUSUS OUTLET
       * ========================================================
       *
       * JANGAN gunakan:
       *
       * /api/master/barang
       *
       * karena endpoint tersebut tidak membawa histori
       * harga pembelian outlet.
       */
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

      /*
       * ========================================================
       * NORMALIZE MASTER BARANG
       * ========================================================
       */
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

      /*
       * Map harga berdasarkan barangId.
       */
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

      /*
       * ========================================================
       * NORMALIZE PURCHASE ITEMS
       * ========================================================
       */
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

                /*
                 * Gabungkan informasi barang dari
                 * Purchase + Master Barang Outlet.
                 *
                 * Data purchase item tetap menjadi dasar,
                 * tetapi metadata harga outlet ditambahkan.
                 */
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

                /*
                 * PENTING:
                 *
                 * Jika PurchaseItem lama tersimpan price = 0
                 * dan PO masih DRAFT, gunakan harga pembelian
                 * outlet sebagai fallback.
                 *
                 * Harga > 0 yang sudah tersimpan TIDAK ditimpa.
                 */
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

                return {
                  ...normalized,

                  barang:
                    mergedBarang,

                  qty:
                    normalizedQty,

                  price:
                    effectivePrice,

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

      /*
       * Gunakan master barang outlet.
       */
      setBarang(
        normalizedMasterBarang
      );

      if (
        meJson?.success &&
        meJson?.data
      ) {
        setMe(meJson.data);
      } else if (
        meJson?.data
      ) {
        setMe(meJson.data);
      } else if (
        meJson?.user
      ) {
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
        purchase?.outlet ||
        outlets.find(
          (outlet) =>
            outlet.id ===
            Number(
              outletId
            )
        ) ||
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
        purchase?.supplier ||
        suppliers.find(
          (supplier) =>
            supplier.id ===
            Number(
              supplierId
            )
        ) ||
        null
      );
    }, [
      purchase,
      suppliers,
      supplierId,
    ]);

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
            "text-amber-700",
          dot:
            "bg-amber-500",
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

  function handleOpenComment() {
    router.push(
      `/outlet/purchase/${id}/comment`
    );
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
        purchase.outlet ||
        outlets.find(
          (outlet) =>
            outlet.id ===
            Number(
              outletId
            )
        ) ||
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

    /*
     * Pastikan tidak ada harga 0 ketika approve.
     */
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
                  handleOpenComment
                }
                disabled={
                  saving ||
                  deleting ||
                  approving ||
                  exporting
                }
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 text-xs font-bold text-[#35564C] transition hover:bg-[#F0F6F3] disabled:opacity-50"
              >
                <MessageSquare
                  size={16}
                />
                Comment
              </button>

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

                {/* NUMBER */}

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

                {/* DATE */}

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

                {/* OUTLET */}

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
                        !isDraft
                      }
                      onChange={(e) =>
                        setOutletId(
                          e.target
                            .value
                        )
                      }
                      className="h-12 w-full appearance-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 pr-10 text-sm font-semibold text-[#18352D] outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10 disabled:bg-gray-100 disabled:text-gray-500"
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

                    <ChevronDown
                      size={17}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                  </div>

                </div>

                {/* SUPPLIER */}

                <div>

                  <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#607A70]">
                    <UserRound
                      size={14}
                    />
                    Supplier
                  </label>

                  <div className="relative">

                    <select
                      value={
                        supplierId
                      }
                      disabled={
                        !isDraft
                      }
                      onChange={(e) =>
                        setSupplierId(
                          e.target
                            .value
                        )
                      }
                      className="h-12 w-full appearance-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 pr-10 text-sm font-semibold text-[#18352D] outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10 disabled:bg-gray-100 disabled:text-gray-500"
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

                    <ChevronDown
                      size={17}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                  </div>

                </div>

                {/* PAYMENT */}

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

                {/* CREATED */}

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

                {/* REMARKS */}

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

                                        <p className="truncate text-sm font-bold text-[#18352D]">
                                          {
                                            item.name
                                          }
                                        </p>

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

                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#607A70]">
                        Harga Satuan
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
                        className="h-12 w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 text-right text-sm font-semibold outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                      />

                      {selectedBarang && (
                        <div className="mt-2 space-y-1">

                          <p className="text-[11px] text-gray-400">
                            Harga pembelian:
                            {" "}
                            <span className="font-bold text-[#497F70]">
                              Rp{" "}
                              {formatRupiah(
                                getEffectivePurchasePrice(
                                  selectedBarang
                                )
                              )}
                            </span>
                          </p>

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

              <div className="overflow-x-auto">

                <table className="min-w-[900px] w-full text-sm">

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

                          return (
                            <tr
                              key={
                                item.barangId
                              }
                              className="group border-b border-[#EDF2EF] transition hover:bg-[#FAFCFB]"
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

                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0F6F3] text-[#497F70]">
                                    <Package
                                      size={
                                        17
                                      }
                                    />
                                  </div>

                                  <div className="min-w-0">

                                    <p className="truncate font-bold text-[#18352D]">
                                      {
                                        item
                                          .barang
                                          .name
                                      }
                                    </p>

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
                                    className="h-9 w-36 rounded-xl border border-[#D5E5DC] bg-white px-3 text-right text-xs font-semibold outline-none focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                                  />
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

                    <button
                      type="button"
                      onClick={
                        handleOpenComment
                      }
                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-3 text-xs font-bold text-[#497F70] hover:bg-[#F0F6F3]"
                    >
                      <MessageSquare
                        size={15}
                      />
                      Comment
                    </button>

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
              handleOpenComment
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-5 text-sm font-bold text-[#497F70]"
          >
            <MessageSquare
              size={17}
            />
            Comment
          </button>

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

      </div>
    </div>
  );
}