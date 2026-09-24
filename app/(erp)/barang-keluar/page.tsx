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
  ClipboardList,
  Check,
  Eye,
  Truck,
  Clock3,
  ChevronDown,
  ChevronUp,
  Pencil,
  Save,
  AlertTriangle,
  PackageCheck,
  PackageX,
  Download,
  MessageCircle,
} from "lucide-react";

import BarcodeInputScanner from "@/components/BarcodeInputScanner";
import CameraBarcodeScanner from "@/components/CameraBarcodeScanner";
import { jsPDF } from "jspdf";

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
  // DELIVERY REQUEST
  // =========================================================

  const [deliveryRequests, setDeliveryRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestStatusFilter, setRequestStatusFilter] = useState("ALL");

  const [requestDetail, setRequestDetail] = useState<any>(null);
  const [showRequestDetail, setShowRequestDetail] = useState(false);

  const [processingRequestId, setProcessingRequestId] = useState<number | null>(
    null
  );

  const [expandedRequestId, setExpandedRequestId] = useState<number | null>(
    null
  );

  // =========================================================
  // EDIT DELIVERY REQUEST
  // =========================================================

  const [editingRequest, setEditingRequest] = useState(false);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [savingRequestEdit, setSavingRequestEdit] = useState(false);
  const [deletingRequest, setDeletingRequest] = useState(false);

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
  // LOAD DELIVERY REQUEST
  // =========================================================

  async function loadDeliveryRequests() {
    try {
      setLoadingRequests(true);

      const params = new URLSearchParams();

      if (requestStatusFilter !== "ALL") {
        params.set("status", requestStatusFilter);
      }

      const query = params.toString();

      const res = await fetch(
        `/api/delivery-request${query ? `?${query}` : ""}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || "Gagal mengambil Delivery Request"
        );
      }

      const data = Array.isArray(json.data) ? json.data : [];

      // REQUEST YANG SUDAH MASUK PROSES / SELESAI TIDAK DITAMPILKAN.
      // APPROVED tetap ditampilkan karena masih perlu diproses menjadi Delivery Order.
      const visibleData = data.filter(
        (request: any) =>
          request?.status !== "PROCESSING" &&
          request?.status !== "COMPLETED"
      );

      setDeliveryRequests(visibleData);
    } catch (error) {
      console.error("LOAD DELIVERY REQUEST ERROR:", error);
      setDeliveryRequests([]);
    } finally {
      setLoadingRequests(false);
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

  useEffect(() => {
    loadDeliveryRequests();
  }, [requestStatusFilter]);

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
  // GET STOCK PUSAT
  // =========================================================

  function getCentralStock(item: any) {
    const masterBarang = barang.find(
      (b) => Number(b.id) === Number(item?.barangId)
    );

    const stock =
      item?.barang?.stock ??
      masterBarang?.stock ??
      item?.stock ??
      0;

    return Number(stock || 0);
  }

  // Stock untuk item yang sedang diedit di Delivery Request.
  // Prioritas tetap mengikuti sumber stock pusat yang sama dengan detail request.
  function getEditItemStock(item: any) {
    if (!item) {
      return 0;
    }

    const originalItem = (requestDetail?.items || []).find(
      (requestItem: any) =>
        Number(requestItem?.id) === Number(item?.id)
    );

    return getCentralStock({
      ...(originalItem || {}),
      barangId: item?.barangId,
    });
  }

  // =========================================================
  // STOCK STATUS
  // =========================================================

  function getStockStatus(item: any) {
    const stock = getCentralStock(item);
    const requestQty = Number(item?.qty || 0);

    if (stock <= 0) {
      return {
        type: "EMPTY",
        label: "STOCK KOSONG",
        className: "bg-red-50 text-red-600 border-red-200",
        icon: PackageX,
      };
    }

    if (stock < requestQty) {
      return {
        type: "INSUFFICIENT",
        label: "STOCK KURANG",
        className: "bg-amber-50 text-amber-700 border-amber-200",
        icon: AlertTriangle,
      };
    }

    return {
      type: "ENOUGH",
      label: "STOCK CUKUP",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: PackageCheck,
    };
  }

  // =========================================================
  // REQUEST HAS EMPTY STOCK
  // =========================================================

  function requestHasEmptyStock(request: any) {
    return (request?.items || []).some(
      (item: any) => getCentralStock(item) <= 0
    );
  }

  // =========================================================
  // REQUEST HAS INSUFFICIENT STOCK
  // =========================================================

  function requestHasInsufficientStock(request: any) {
    return (request?.items || []).some(
      (item: any) => getCentralStock(item) < Number(item?.qty || 0)
    );
  }

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
    if (!data) {
      alert("Barang tidak ditemukan");
      return false;
    }

    if (!Number.isFinite(jumlah) || jumlah <= 0) {
      alert("Qty tidak valid");
      return false;
    }

    const availableStock = getCentralStock(data);

    if (availableStock <= 0) {
      alert(`Stock ${data.name} sudah habis`);
      return false;
    }

    if (jumlah > availableStock) {
      alert(
        `Stock ${data.name} hanya ${formatNumber(availableStock)} ${getRequestItemUnit(data)}`
      );
      return false;
    }

    const existing = cart.find(
      (item) => Number(item?.barangId) === Number(data?.id)
    );

    const nextQty = existing
      ? Number(existing.qty || 0) + jumlah
      : jumlah;

    if (nextQty > availableStock) {
      alert(
        `Qty ${data.name} melebihi stock pusat. Maksimal ${formatNumber(
          availableStock
        )} ${getRequestItemUnit(data)}.`
      );
      return false;
    }

    const price = Number(data.purchasePrice ?? 0);
    const unit = getRequestItemUnit(data);

    setCart((prev) => {
      const exist = prev.find(
        (item) => Number(item?.barangId) === Number(data?.id)
      );

      if (exist) {
        return prev.map((item) =>
          Number(item?.barangId) === Number(data?.id)
            ? {
                ...item,
                qty: nextQty,
                stock: availableStock,
                unit,
                subtotal: nextQty * Number(item.price || 0),
              }
            : item
        );
      }

      return [
        ...prev,
        {
          barangId: data.id,
          code: data.code,
          barcode: data.barcode,
          name: data.name,
          unit,
          stock: availableStock,
          qty: jumlah,
          price,
          subtotal: price * jumlah,
        },
      ];
    });

    return true;
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
  // APPROVE DELIVERY REQUEST
  // =========================================================

  async function approveDeliveryRequest(id: number) {
    const request = deliveryRequests.find(
      (item) => Number(item.id) === Number(id)
    );

    if (request && requestHasInsufficientStock(request)) {
      const yakin = confirm(
        "Delivery Request ini memiliki item dengan stock pusat kurang atau kosong.\n\n" +
          "Anda tetap ingin APPROVE request ini?"
      );

      if (!yakin) {
        return;
      }
    } else {
      const yakin = confirm(
        "Approve Delivery Request ini?\n\nApprove tidak akan mengurangi stock pusat."
      );

      if (!yakin) {
        return;
      }
    }

    try {
      setProcessingRequestId(id);

      const res = await fetch(`/api/delivery-request/${id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || "Gagal approve Delivery Request"
        );
      }

      alert(json.message || "Delivery Request berhasil di-approve");

      await loadDeliveryRequests();
    } catch (error: any) {
      console.error("APPROVE DELIVERY REQUEST ERROR:", error);

      alert(error?.message || "Gagal approve Delivery Request");
    } finally {
      setProcessingRequestId(null);
    }
  }

  // =========================================================
  // PROCESS DELIVERY REQUEST
  // =========================================================

  async function processDeliveryRequest(id: number) {
    const request = deliveryRequests.find(
      (item) => Number(item.id) === Number(id)
    );

    if (request && requestHasInsufficientStock(request)) {
      alert(
        "Delivery Request belum dapat diproses karena stock pusat tidak mencukupi.\n\n" +
          "Silakan edit qty request terlebih dahulu agar sesuai dengan stock pusat."
      );
      return;
    }

    const yakin = confirm(
      "Proses Delivery Request ini menjadi Delivery Order DRAFT?\n\n" +
        "Stock pusat belum akan berkurang."
    );

    if (!yakin) {
      return;
    }

    try {
      setProcessingRequestId(id);

      const res = await fetch(`/api/delivery-request/${id}/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || "Gagal membuat Delivery Order"
        );
      }

      const delivery = json.data?.delivery;

      setDeliveryRequests((prev) =>
        prev.filter((request) => request.id !== id)
      );

      if (requestDetail?.id === id) {
        setShowRequestDetail(false);
        setRequestDetail(null);
      }

      if (expandedRequestId === id) {
        setExpandedRequestId(null);
      }

      alert(
        `Delivery Request berhasil diproses.\n\n` +
          `Delivery: ${delivery?.number || "-"}\n` +
          `Status: DRAFT\n\n` +
          `Request sudah dipindahkan ke proses Delivery.\n` +
          `Stock pusat belum berkurang.`
      );

      await loadDeliveryRequests();

      // Setelah PROSES, tetap di halaman Delivery Request.
      // Tidak ada redirect / confirm untuk membuka halaman detail Delivery.
    } catch (error: any) {
      console.error("PROCESS DELIVERY REQUEST ERROR:", error);

      alert(error?.message || "Gagal memproses Delivery Request");
    } finally {
      setProcessingRequestId(null);
    }
  }

  // =========================================================
  // BUKA DELIVERY
  // =========================================================

  function bukaDelivery(deliveryId: number) {
    if (!deliveryId) {
      alert("Delivery ID tidak ditemukan");
      return;
    }

    window.location.href = `/barang-keluar/${deliveryId}`;
  }

  // =========================================================
  // DETAIL REQUEST
  // =========================================================

  function openRequestDetail(request: any) {
    setRequestDetail(request);
    setEditItems(
      (request?.items || []).map((item: any) => ({
        id: item.id,
        barangId: item.barangId,
        qty: Number(item.qty || 0),
        note: item.note || "",
      }))
    );
    setEditingRequest(false);
    setShowRequestDetail(true);
  }

  // =========================================================
  // START EDIT
  // =========================================================

  function startEditRequest() {
    if (!requestDetail) {
      return;
    }

    setEditItems(
      (requestDetail.items || []).map((item: any) => ({
        id: item.id,
        barangId: item.barangId,
        qty: Number(item.qty || 0),
        note: item.note || "",
      }))
    );

    setEditingRequest(true);
  }

  // =========================================================
  // CANCEL EDIT
  // =========================================================

  function cancelEditRequest() {
    if (!requestDetail) {
      return;
    }

    setEditItems(
      (requestDetail.items || []).map((item: any) => ({
        id: item.id,
        barangId: item.barangId,
        qty: Number(item.qty || 0),
        note: item.note || "",
      }))
    );

    setEditingRequest(false);
  }

  // =========================================================
  // UPDATE EDIT ITEM QTY
  // =========================================================

  function updateEditItemQty(itemId: number, value: string) {
    const numericValue = value === "" ? 0 : Number(value);

    setEditItems((prev) =>
      prev.map((item) =>
        Number(item.id) === Number(itemId)
          ? {
              ...item,
              qty: numericValue,
            }
          : item
      )
    );
  }

  // =========================================================
  // HAPUS ITEM DELIVERY REQUEST SAAT EDIT
  // =========================================================

  function removeEditItem(itemId: number) {
    if (!requestDetail) {
      return;
    }

    if (editItems.length <= 1) {
      alert(
        "Delivery Request harus memiliki minimal satu barang."
      );
      return;
    }

    const target = editItems.find(
      (item) => Number(item.id) === Number(itemId)
    );

    if (!target) {
      return;
    }

    const masterBarang = barang.find(
      (b) => Number(b.id) === Number(target.barangId)
    );

    const yakin = confirm(
      `Hapus item "${masterBarang?.name || `Barang #${target.barangId}`}" dari Delivery Request?\n\n` +
        "Item akan dihapus dari request setelah perubahan disimpan."
    );

    if (!yakin) {
      return;
    }

    setEditItems((prev) =>
      prev.filter(
        (item) => Number(item.id) !== Number(itemId)
      )
    );
  }

  // =========================================================
  // SAVE EDIT DELIVERY REQUEST
  // =========================================================

  async function saveRequestEdit() {
    if (!requestDetail) {
      return;
    }

    if (!["PENDING", "APPROVED"].includes(requestDetail.status)) {
      alert(
        "Delivery Request dengan status ini tidak dapat diedit."
      );
      return;
    }

    if (editItems.length === 0) {
      alert("Delivery Request harus memiliki minimal satu barang.");
      return;
    }

    // EDIT REQUEST TIDAK MELAKUKAN VALIDASI STOCK.
    // Perubahan qty/item langsung disimpan. Validasi stock dilakukan
    // ketika request benar-benar diproses menjadi Delivery.
    for (const item of editItems) {
      if (!item.qty || Number(item.qty) <= 0) {
        alert("Qty setiap barang harus lebih dari 0.");
        return;
      }
    }

    const yakin = confirm(
      "Simpan perubahan Delivery Request?\n\n" +
        "Qty akan diperbarui dan item yang dihapus akan dikeluarkan dari request."
    );

    if (!yakin) {
      return;
    }

    try {
      setSavingRequestEdit(true);

      const res = await fetch(
        `/api/delivery-request/${requestDetail.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            items: editItems.map((item) => ({
              id: item.id,
              barangId: Number(item.barangId),
              qty: Number(item.qty),
              note: item.note || "",
            })),
          }),
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || "Gagal mengubah Delivery Request"
        );
      }

      const updatedRequest = json.data || json.request;

      alert(
        json.message ||
          "Perubahan Delivery Request berhasil disimpan."
      );

      setEditingRequest(false);

      if (updatedRequest) {
        setRequestDetail(updatedRequest);
        setEditItems(
          (updatedRequest.items || []).map((item: any) => ({
            id: item.id,
            barangId: item.barangId,
            qty: Number(item.qty || 0),
            note: item.note || "",
          }))
        );
      }

      await loadBarang();
      await loadDeliveryRequests();
    } catch (error: any) {
      console.error("SAVE DELIVERY REQUEST EDIT ERROR:", error);

      alert(
        error?.message ||
          "Gagal mengubah Delivery Request"
      );
    } finally {
      setSavingRequestEdit(false);
    }
  }

  // =========================================================
  // DELETE DELIVERY REQUEST
  // =========================================================

  async function deleteDeliveryRequest(request: any) {
    if (!request) {
      return;
    }

    if (!["PENDING", "APPROVED"].includes(request.status)) {
      alert(
        "Delivery Request dengan status ini tidak dapat dihapus."
      );
      return;
    }

    // DELETE REQUEST TIDAK TERGANTUNG PADA STOCK.
    // Selama status PENDING/APPROVED, request dapat langsung dihapus.
    const yakin = confirm(
      `Hapus Delivery Request ${getRequestNumber(request)}?\\n\\n` +
        `Request beserta seluruh item di dalamnya akan dihapus.`
    );

    if (!yakin) {
      return;
    }

    try {
      setDeletingRequest(true);

      const res = await fetch(
        `/api/delivery-request/${request.id}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || "Gagal menghapus Delivery Request"
        );
      }

      alert(
        json.message ||
          "Delivery Request berhasil dihapus."
      );

      setShowRequestDetail(false);
      setRequestDetail(null);
      setEditingRequest(false);
      setEditItems([]);

      setDeliveryRequests((prev) =>
        prev.filter(
          (item) => Number(item.id) !== Number(request.id)
        )
      );

      await loadDeliveryRequests();
    } catch (error: any) {
      console.error("DELETE DELIVERY REQUEST ERROR:", error);

      alert(
        error?.message ||
          "Gagal menghapus Delivery Request"
      );
    } finally {
      setDeletingRequest(false);
    }
  }

  // =========================================================
  // STATUS STYLE
  // =========================================================

  function getRequestStatusStyle(status: string) {
    switch (status) {
      case "PENDING":
        return {
          wrapper: "border-amber-200 bg-amber-50",
          text: "text-amber-700",
          dot: "bg-amber-500",
          label: "PENDING",
        };

      case "APPROVED":
        return {
          wrapper: "border-blue-200 bg-blue-50",
          text: "text-blue-700",
          dot: "bg-blue-500",
          label: "APPROVED",
        };

      case "PROCESSING":
        return {
          wrapper: "border-violet-200 bg-violet-50",
          text: "text-violet-700",
          dot: "bg-violet-500",
          label: "PROCESSING",
        };

      case "COMPLETED":
        return {
          wrapper: "border-emerald-200 bg-emerald-50",
          text: "text-emerald-700",
          dot: "bg-emerald-500",
          label: "COMPLETED",
        };

      case "REJECTED":
        return {
          wrapper: "border-red-200 bg-red-50",
          text: "text-red-700",
          dot: "bg-red-500",
          label: "REJECTED",
        };

      case "CANCELLED":
        return {
          wrapper: "border-gray-200 bg-gray-50",
          text: "text-gray-600",
          dot: "bg-gray-400",
          label: "CANCELLED",
        };

      default:
        return {
          wrapper: "border-gray-200 bg-gray-50",
          text: "text-gray-600",
          dot: "bg-gray-400",
          label: status || "-",
        };
    }
  }

  // =========================================================
  // REQUEST NUMBER
  // =========================================================

  function getRequestNumber(request: any) {
    return (
      request?.number ||
      `DR-${String(request?.id ?? "").padStart(5, "0")}`
    );
  }

  // =========================================================
  // REQUEST OUTLET
  // =========================================================

  function getRequestOutlet(request: any) {
    return (
      request?.outlet?.name ||
      request?.outlet?.code ||
      `Outlet #${request?.outletId ?? "-"}`
    );
  }

  // =========================================================
  // REQUEST CREATOR
  // =========================================================

  function getRequestCreator(request: any) {
    return (
      request?.createdBy?.fullname ||
      request?.createdBy?.username ||
      "-"
    );
  }

  // =========================================================
  // REQUEST TOTAL QTY
  // =========================================================

  function getRequestTotalQty(request: any) {
    return (request?.items || []).reduce(
      (total: number, item: any) =>
        total + Number(item.qty || 0),
      0
    );
  }

  // =========================================================
  // REQUEST ITEM UNIT
  // =========================================================

  function getRequestItemUnit(item: any) {
    const unit =
      item?.barang?.baseUnit ??
      item?.baseUnit ??
      item?.unit ??
      item?.barang?.unit ??
      "";

    return String(unit).trim() || "-";
  }

  // =========================================================
  // WHATSAPP DELIVERY REQUEST
  // =========================================================

  function isWhatsAppEligibleRequest(request: any) {
    const status = String(request?.status || "").trim().toUpperCase();
    return status === "DRAFT" || status === "PENDING";
  }

  function getWhatsAppStockMark(item: any) {
    const stock = getCentralStock(item);
    const requested = Number(item?.qty || 0);

    return stock >= requested && requested > 0 ? "✅" : "❌";
  }

  function getWhatsAppStockStatus(item: any) {
    const stock = getCentralStock(item);
    const requested = Number(item?.qty || 0);

    if (stock >= requested && requested > 0) {
      return "TERSEDIA";
    }

    if (stock > 0) {
      return "KURANG";
    }

    return "KOSONG";
  }

  function getWhatsAppRequestDate(request: any) {
    return formatDate(
      request?.requestDate ||
        request?.requestedAt ||
        request?.createdAt
    );
  }

  function sortDeliveryRequestsForWhatsApp(requests: any[]) {
    return [...requests].sort((a: any, b: any) => {
      const outletCompare = getRequestOutlet(a).localeCompare(
        getRequestOutlet(b),
        "id"
      );

      if (outletCompare !== 0) {
        return outletCompare;
      }

      const dateA = new Date(
        a?.requestDate ||
          a?.requestedAt ||
          a?.createdAt ||
          0
      ).getTime();

      const dateB = new Date(
        b?.requestDate ||
          b?.requestedAt ||
          b?.createdAt ||
          0
      ).getTime();

      if (dateA !== dateB) {
        return dateA - dateB;
      }

      return getRequestNumber(a).localeCompare(
        getRequestNumber(b),
        "id",
        { numeric: true }
      );
    });
  }

  function buildDeliveryRequestWhatsAppMessage(request: any) {
    if (!isWhatsAppEligibleRequest(request)) {
      return "";
    }

    const items = Array.isArray(request?.items)
      ? request.items
      : [];

    if (!items.length) {
      return "";
    }

    const itemLines = items.map((item: any) => {
      const itemName =
        item?.barang?.name ||
        `Barang #${item?.barangId ?? "-"}`;

      const qty = Number(item?.qty || 0);
      const unit = getRequestItemUnit(item);
      const stock = getCentralStock(item);
      const note =
        typeof item?.note === "string"
          ? item.note.trim()
          : "";

      return [
        `${getWhatsAppStockMark(item)} ${itemName}`,
        `   Request (${formatNumber(qty)} ${unit}) • Stock Pusat (${formatNumber(stock)} ${unit}) • ${getWhatsAppStockStatus(item)}`,
        note ? `   ↳ Catatan : ${note}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    });

    return [
      "📦 *DELIVERY REQUEST*",
      `*${getRequestOutlet(request)}* • ${getRequestNumber(request)}`,
      `📅 ${getWhatsAppRequestDate(request)} • ${String(
        request?.status || "-"
      ).toUpperCase()}`,
      "",
      itemLines.join("\n"),
      "",
      `*${items.length} jenis • ${formatNumber(
        getRequestTotalQty(request)
      )} qty*`,
      "",
      "MGB ERP • Gudang Pusat",
    ].join("\n");
  }

  async function loadAllDeliveryRequestsForWhatsApp() {
    const res = await fetch("/api/delivery-request", {
      cache: "no-store",
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(
        json.message ||
          "Gagal mengambil seluruh Delivery Request."
      );
    }

    const allRequests = Array.isArray(json.data)
      ? json.data
      : [];

    // WhatsApp HANYA mengirim request yang masih aktif:
    // DRAFT atau PENDING. APPROVED / PROCESSING / COMPLETED /
    // REJECTED / CANCELLED tidak ikut dikirim.
    const eligibleRequests = allRequests.filter(
      (request: any) =>
        isWhatsAppEligibleRequest(request) &&
        Array.isArray(request?.items) &&
        request.items.length > 0
    );

    // Hindari request ganda apabila API mengembalikan record
    // yang sama lebih dari satu kali.
    const uniqueRequests = Array.from(
      new Map(
        eligibleRequests.map((request: any) => [
          String(request?.id ?? getRequestNumber(request)),
          request,
        ])
      ).values()
    );

    return uniqueRequests;
  }

  function buildAllDeliveryRequestsWhatsAppMessage(
    requests: any[]
  ) {
    const validRequests = sortDeliveryRequestsForWhatsApp(
      requests.filter(
        (request: any) =>
          isWhatsAppEligibleRequest(request) &&
          Array.isArray(request?.items) &&
          request.items.length > 0
      )
    );

    if (!validRequests.length) {
      return "";
    }

    const groups = new Map<
      string,
      { name: string; requests: any[] }
    >();

    for (const request of validRequests) {
      const name = getRequestOutlet(request);
      const key = name.trim().toLowerCase();

      if (!groups.has(key)) {
        groups.set(key, {
          name,
          requests: [],
        });
      }

      groups.get(key)!.requests.push(request);
    }

    const outletGroups = [...groups.values()];

    const totalItems = validRequests.reduce(
      (total, request) =>
        total + request.items.length,
      0
    );

    const totalQty = validRequests.reduce(
      (total, request) =>
        total + getRequestTotalQty(request),
      0
    );

    const availableItems = validRequests.reduce(
      (total, request) =>
        total +
        request.items.filter(
          (item: any) =>
            getCentralStock(item) >=
              Number(item?.qty || 0) &&
            Number(item?.qty || 0) > 0
        ).length,
      0
    );

    const message: string[] = [
      "📦 *DELIVERY REQUEST OUTLET*",
      "*MGB ERP • GUDANG PUSAT*",
      "",
      `🏪 ${outletGroups.length} outlet • 📋 ${validRequests.length} request`,
      `📦 ${totalItems} jenis • 🔢 ${formatNumber(totalQty)} qty`,
      "",
      "━━━━━━━━━━━━━━━━━━",
    ];

    outletGroups.forEach((group, outletIndex) => {
      message.push(
        `*${outletIndex + 1}. ${group.name}*`
      );

      group.requests.forEach((request: any) => {
        message.push(
          "",
          `📋 *${getRequestNumber(request)}* • ${getWhatsAppRequestDate(
            request
          )} • ${String(request?.status || "-").toUpperCase()}`
        );

        request.items.forEach((item: any) => {
          const itemName =
            item?.barang?.name ||
            `Barang #${item?.barangId ?? "-"}`;

          const qty = Number(item?.qty || 0);
          const unit = getRequestItemUnit(item);
          const stock = getCentralStock(item);
          const note =
            typeof item?.note === "string"
              ? item.note.trim()
              : "";

          message.push(
            `${getWhatsAppStockMark(item)} ${itemName}`,
            `   Request (${formatNumber(qty)} ${unit}) • Stock Pusat (${formatNumber(stock)} ${unit}) • ${getWhatsAppStockStatus(item)}`,
            ...(note ? [`   ↳ Catatan : ${note}`] : [])
          );
        });

        message.push(
          `   _${request.items.length} jenis • ${formatNumber(
            getRequestTotalQty(request)
          )} qty_`
        );
      });

      if (outletIndex < outletGroups.length - 1) {
        message.push("", "━━━━━━━━━━━━━━━━━━");
      }
    });

    message.push(
      "",
      "━━━━━━━━━━━━━━━━━━",
      `📊 *Stock: ${availableItems}/${totalItems} item cukup*`,
      "❌ = stock kosong / kurang",
      "",
      "_Pesan otomatis dari MGB ERP._"
    );

    return message.join("\n");
  }

  function openWhatsAppDeliveryRequest(request: any) {
    if (!request) {
      alert("Delivery Request tidak ditemukan.");
      return;
    }

    if (!isWhatsAppEligibleRequest(request)) {
      alert(
        "WhatsApp hanya dapat digunakan untuk Delivery Request dengan status DRAFT atau PENDING."
      );
      return;
    }

    const message =
      buildDeliveryRequestWhatsAppMessage(request);

    if (!message) {
      alert(
        "Tidak ada detail barang pada Delivery Request."
      );
      return;
    }

    const whatsappUrl =
      `https://web.whatsapp.com/send?text=${encodeURIComponent(
        message
      )}`;

    window.open(
      whatsappUrl,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function openWhatsAppAllDeliveryRequests() {
    const whatsappWindow = window.open(
      "about:blank",
      "_blank"
    );

    try {
      const requests =
        await loadAllDeliveryRequestsForWhatsApp();

      const message =
        buildAllDeliveryRequestsWhatsAppMessage(
          requests
        );

      if (!message) {
        whatsappWindow?.close();

        alert(
          "Tidak ada Delivery Request DRAFT / PENDING dengan detail barang yang dapat dikirim."
        );

        return;
      }

      const whatsappUrl =
        `https://web.whatsapp.com/send?text=${encodeURIComponent(
          message
        )}`;

      if (whatsappWindow) {
        whatsappWindow.location.href =
          whatsappUrl;
        whatsappWindow.focus();
      } else {
        window.open(
          whatsappUrl,
          "_blank",
          "noopener,noreferrer"
        );
      }
    } catch (error: any) {
      whatsappWindow?.close();

      console.error(
        "WHATSAPP ALL DELIVERY REQUEST ERROR:",
        error
      );

      alert(
        error?.message ||
          "Gagal mengambil Delivery Request untuk WhatsApp."
      );
    }
  }

  // =========================================================
  // FORMAT DATE
  // =========================================================

  function formatDate(value: any) {
    if (!value) {
      return "-";
    }

    try {
      return new Date(value).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "-";
    }
  }

  // =========================================================
  // DOWNLOAD SEMUA DELIVERY REQUEST DRAFT / PENDING
  // =========================================================

  async function downloadDraftDeliveryRequestsPDF() {
    try {
      const res = await fetch("/api/delivery-request?status=PENDING", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || "Gagal mengambil Delivery Request Draft"
        );
      }

      const requests = Array.isArray(json.data)
        ? json.data.filter(
            (request: any) =>
              String(request?.status || "").toUpperCase() === "PENDING"
          )
        : [];

      if (requests.length === 0) {
        alert("Tidak ada Delivery Request Draft yang dapat di-download.");
        return;
      }

      // =========================================================
      // SORT:
      // 1. Outlet
      // 2. Tanggal request
      // 3. Nomor / ID DR
      // =========================================================

      requests.sort((a: any, b: any) => {
        const outletA = getRequestOutlet(a).toLowerCase();
        const outletB = getRequestOutlet(b).toLowerCase();

        if (outletA !== outletB) {
          return outletA.localeCompare(outletB, "id");
        }

        const dateA = new Date(
          a?.requestDate || a?.createdAt || 0
        ).getTime();

        const dateB = new Date(
          b?.requestDate || b?.createdAt || 0
        ).getTime();

        if (dateA !== dateB) {
          return dateA - dateB;
        }

        return getRequestNumber(a).localeCompare(
          getRequestNumber(b),
          "id",
          { numeric: true }
        );
      });

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;

      const darkGreen = [4, 28, 23] as const;
      const green = [47, 91, 74] as const;
      const softGreen = [238, 245, 241] as const;
      const line = [214, 226, 220] as const;
      const muted = [105, 116, 109] as const;
      const red = [177, 54, 54] as const;
      const amber = [170, 111, 20] as const;

      let cursorY = 16;

      const drawFooter = () => {
        doc.setDrawColor(...line);
        doc.line(
          margin,
          pageHeight - 13,
          pageWidth - margin,
          pageHeight - 13
        );

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...muted);

        doc.text(
          "MGB ERP • Delivery Request Draft • Dokumen internal",
          margin,
          pageHeight - 8
        );

        doc.text(
          `Halaman ${doc.getNumberOfPages()}`,
          pageWidth - margin,
          pageHeight - 8,
          { align: "right" }
        );
      };

      const drawPageHeader = (request: any) => {
        const requestNumber = getRequestNumber(request);

        doc.setFillColor(...darkGreen);
        doc.roundedRect(
          margin,
          cursorY,
          contentWidth,
          14,
          3,
          3,
          "F"
        );

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text("MGB ERP", margin + 5, cursorY + 5.7);

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.text(
          "DELIVERY REQUEST DRAFT",
          pageWidth - margin - 5,
          cursorY + 5.7,
          { align: "right" }
        );

        doc.setFontSize(6.8);
        doc.text(
          requestNumber,
          pageWidth - margin - 5,
          cursorY + 10,
          { align: "right" }
        );

        cursorY += 19;
      };

      const ensureSpace = (
        heightNeeded: number,
        request: any
      ) => {
        if (cursorY + heightNeeded > pageHeight - 19) {
          drawFooter();
          doc.addPage();
          cursorY = 18;
          drawPageHeader(request);
          return true;
        }

        return false;
      };

      const getItemStatus = (item: any) => {
        const stock = getCentralStock(item);
        const requested = Number(item?.qty || 0);

        if (stock <= 0) {
          return {
            label: "STOCK KOSONG",
            detail: "Barang tidak tersedia di Gudang Pusat.",
            color: red,
          };
        }

        if (stock < requested) {
          return {
            label: "STOCK KURANG",
            detail: `Stock tersedia ${formatNumber(stock)} ${getRequestItemUnit(item)}.`,
            color: amber,
          };
        }

        return {
          label: "STOCK CUKUP",
          detail: "Stock pusat mencukupi kebutuhan request.",
          color: green,
        };
      };

      const drawTableHeader = () => {
        const columns = [
          { title: "NO", width: 9 },
          { title: "BARANG / KODE", width: 53 },
          { title: "REQUEST", width: 19 },
          { title: "STOCK", width: 18 },
          { title: "SATUAN", width: 19 },
          { title: "STATUS", width: 31 },
          {
            title: "KETERANGAN BARANG",
            width: contentWidth - 149,
          },
        ];

        doc.setFillColor(...darkGreen);
        doc.roundedRect(
          margin,
          cursorY,
          contentWidth,
          10,
          2,
          2,
          "F"
        );

        let x = margin;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(255, 255, 255);

        for (const column of columns) {
          doc.text(
            column.title,
            x + column.width / 2,
            cursorY + 6.4,
            { align: "center" }
          );

          x += column.width;
        }

        cursorY += 11;

        return columns;
      };

      const drawRequest = (request: any, requestIndex: number) => {
        const requestNumber = getRequestNumber(request);
        const outletName = getRequestOutlet(request);
        const customerName =
          request?.customer?.name ||
          request?.customer?.fullname ||
          request?.customerName ||
          request?.delivery?.customer?.name ||
          request?.delivery?.customer?.fullname ||
          "-";
        const creatorName = getRequestCreator(request);
        const requestDate = formatDate(request?.requestDate);
        const createdAt = formatDate(request?.createdAt);
        const items = Array.isArray(request?.items)
          ? request.items
          : [];

        // Setiap DR dimulai sebagai section baru.
        if (requestIndex > 0) {
          drawFooter();
          doc.addPage();
          cursorY = 16;
        }

        // =======================================================
        // COVER / REQUEST HEADER
        // =======================================================

        doc.setFillColor(...darkGreen);
        doc.roundedRect(
          margin,
          cursorY,
          contentWidth,
          30,
          5,
          5,
          "F"
        );

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(17);
        doc.text(
          "DELIVERY REQUEST",
          margin + 7,
          cursorY + 10
        );

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text(
          "Draft / Pending • Permintaan pengiriman barang",
          margin + 7,
          cursorY + 16
        );

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(
          requestNumber,
          pageWidth - margin - 7,
          cursorY + 10,
          { align: "right" }
        );

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text(
          `Dibuat: ${createdAt}`,
          pageWidth - margin - 7,
          cursorY + 16,
          { align: "right" }
        );

        doc.setFontSize(7);
        doc.text(
          `Draft ke-${requestIndex + 1} dari ${requests.length}`,
          pageWidth - margin - 7,
          cursorY + 22,
          { align: "right" }
        );

        cursorY += 37;

        // =======================================================
        // SUMMARY CARDS
        // =======================================================

        const cardGap = 4;
        const cardWidth = (contentWidth - cardGap * 2) / 3;

        const drawCard = (
          x: number,
          label: string,
          value: string,
          accent: readonly [number, number, number]
        ) => {
          doc.setFillColor(248, 250, 249);
          doc.setDrawColor(...line);
          doc.roundedRect(
            x,
            cursorY,
            cardWidth,
            23,
            3,
            3,
            "FD"
          );

          doc.setFont("helvetica", "bold");
          doc.setFontSize(6.8);
          doc.setTextColor(...muted);
          doc.text(
            label.toUpperCase(),
            x + 4,
            cursorY + 6
          );

          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(...accent);

          const valueLines = doc.splitTextToSize(
            value || "-",
            cardWidth - 8
          );

          doc.text(
            valueLines.slice(0, 2),
            x + 4,
            cursorY + 13
          );
        };

        drawCard(
          margin,
          "OUTLET / TUJUAN",
          outletName,
          green
        );

        drawCard(
          margin + cardWidth + cardGap,
          "CUSTOMER",
          customerName,
          green
        );

        drawCard(
          margin + (cardWidth + cardGap) * 2,
          "STATUS REQUEST",
          "DRAFT / PENDING",
          darkGreen
        );

        cursorY += 30;

        // =======================================================
        // INFORMATION BLOCK
        // =======================================================

        ensureSpace(48, request);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...darkGreen);
        doc.text(
          "INFORMASI REQUEST",
          margin,
          cursorY
        );

        cursorY += 5;

        const infoRows = [
          [
            "Nomor Request",
            requestNumber,
            "Tanggal Request",
            requestDate,
          ],
          [
            "Outlet / Tujuan",
            outletName,
            "Customer",
            customerName,
          ],
          [
            "Dibuat Oleh",
            creatorName,
            "Dibuat Pada",
            createdAt,
          ],
          [
            "Status Request",
            "PENDING / DRAFT",
            "Delivery Order",
            request?.delivery?.number || "-",
          ],
          [
            "Total Item",
            `${items.length} jenis barang`,
            "Total Quantity",
            `${formatNumber(
              getRequestTotalQty(request)
            )} Qty`,
          ],
        ];

        const infoCol = contentWidth / 2;

        for (const row of infoRows) {
          ensureSpace(11, request);

          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(...line);
          doc.roundedRect(
            margin,
            cursorY,
            contentWidth,
            9.5,
            1.8,
            1.8,
            "FD"
          );

          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(...muted);
          doc.text(
            row[0],
            margin + 4,
            cursorY + 6
          );

          doc.setFont("helvetica", "normal");
          doc.setTextColor(...darkGreen);
          doc.text(
            doc
              .splitTextToSize(
                row[1] || "-",
                48
              )
              .slice(0, 2),
            margin + 31,
            cursorY + 6
          );

          if (row[2]) {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...muted);
            doc.text(
              row[2],
              margin + infoCol + 4,
              cursorY + 6
            );

            doc.setFont("helvetica", "normal");
            doc.setTextColor(...darkGreen);
            doc.text(
              doc
                .splitTextToSize(
                  row[3] || "-",
                  48
                )
                .slice(0, 2),
              margin + infoCol + 31,
              cursorY + 6
            );
          }

          cursorY += 11;
        }

        cursorY += 3;

        // =======================================================
        // DETAIL BARANG
        // =======================================================

        ensureSpace(34, request);

        doc.setFillColor(...softGreen);
        doc.roundedRect(
          margin,
          cursorY,
          contentWidth,
          12,
          3,
          3,
          "F"
        );

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...darkGreen);
        doc.text(
          "DETAIL BARANG & VALIDASI STOCK",
          margin + 5,
          cursorY + 7.5
        );

        cursorY += 17;

        const columns = drawTableHeader();

        items.forEach((item: any, itemIndex: number) => {
          const stock = getCentralStock(item);
          const unit = getRequestItemUnit(item);
          const status = getItemStatus(item);
          const itemName =
            item?.barang?.name ||
            `Barang #${item?.barangId ?? "-"}`;
          const code = item?.barang?.code || "-";
          const requested = formatNumber(item?.qty);

          const note =
            item?.note?.trim() ||
            (stock <= 0
              ? "Keterangan: STOCK KOSONG. Barang belum dapat dipenuhi dari Gudang Pusat."
              : stock < Number(item?.qty || 0)
                ? `Keterangan: STOCK KURANG. ${status.detail}`
                : "Tidak ada keterangan tambahan.");

          const nameLines = doc.splitTextToSize(
            `${itemName}\n${code}`,
            columns[1].width - 5
          );

          const noteLines = doc.splitTextToSize(
            note,
            columns[6].width - 5
          );

          const rowHeight = Math.max(
            14,
            Math.min(
              34,
              Math.max(
                nameLines.length * 3.5 + 6,
                noteLines.length * 3.5 + 6
              )
            )
          );

          if (
            cursorY + rowHeight >
            pageHeight - 19
          ) {
            drawFooter();
            doc.addPage();
            cursorY = 18;
            drawPageHeader(request);
            const continuedColumns = drawTableHeader();

            // Update column reference for continued page.
            columns.splice(
              0,
              columns.length,
              ...continuedColumns
            );
          }

          doc.setFillColor(
            itemIndex % 2 === 0 ? 252 : 247,
            itemIndex % 2 === 0 ? 254 : 250,
            itemIndex % 2 === 0 ? 253 : 249
          );

          doc.setDrawColor(...line);
          doc.rect(
            margin,
            cursorY,
            contentWidth,
            rowHeight,
            "FD"
          );

          let x = margin;

          const cells = [
            String(itemIndex + 1),
            nameLines,
            requested,
            formatNumber(stock),
            unit,
            status.label,
            noteLines,
          ];

          cells.forEach(
            (cell, cellIndex) => {
              const col = columns[cellIndex];

              if (cellIndex === 5) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(6.5);
                doc.setTextColor(...status.color);
              } else {
                doc.setFont(
                  "helvetica",
                  cellIndex === 1
                    ? "bold"
                    : "normal"
                );
                doc.setFontSize(
                  cellIndex === 1
                    ? 6.8
                    : 6.5
                );
                doc.setTextColor(
                  ...(cellIndex === 1
                    ? darkGreen
                    : muted)
                );
              }

              const linesToDraw = Array.isArray(cell)
                ? cell
                : [String(cell)];

              const yStart = cursorY + 5.2;

              if (
                cellIndex === 0 ||
                [2, 3, 4, 5].includes(cellIndex)
              ) {
                doc.text(
                  linesToDraw.slice(0, 5),
                  x + col.width / 2,
                  yStart,
                  { align: "center" }
                );
              } else {
                doc.text(
                  linesToDraw.slice(0, 8),
                  x + 2.5,
                  yStart
                );
              }

              x += col.width;
            }
          );

          cursorY += rowHeight;
        });

        // =======================================================
        // REMARKS
        // =======================================================

        cursorY += 7;
        ensureSpace(31, request);

        doc.setFillColor(248, 250, 249);
        doc.setDrawColor(...line);
        doc.roundedRect(
          margin,
          cursorY,
          contentWidth,
          27,
          3,
          3,
          "FD"
        );

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...darkGreen);
        doc.text(
          "KETERANGAN REQUEST",
          margin + 5,
          cursorY + 7
        );

        const remarks =
          request?.remarks?.trim() ||
          "Tidak ada keterangan tambahan dari pemohon.";

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...muted);
        doc.text(
          doc
            .splitTextToSize(
              remarks,
              contentWidth - 10
            )
            .slice(0, 6),
          margin + 5,
          cursorY + 13
        );

        cursorY += 34;

        // =======================================================
        // RINGKASAN VALIDASI
        // =======================================================

        const emptyCount = items.filter(
          (item: any) =>
            getCentralStock(item) <= 0
        ).length;

        const insufficientCount = items.filter(
          (item: any) =>
            getCentralStock(item) > 0 &&
            getCentralStock(item) <
              Number(item?.qty || 0)
        ).length;

        const enoughCount = items.filter(
          (item: any) =>
            getCentralStock(item) >=
            Number(item?.qty || 0)
        ).length;

        ensureSpace(31, request);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...darkGreen);
        doc.text(
          "RINGKASAN VALIDASI",
          margin,
          cursorY
        );

        cursorY += 5;

        const summaryWidth =
          (contentWidth - 8) / 3;

        const summary = [
          ["STOCK CUKUP", enoughCount, green],
          [
            "STOCK KURANG",
            insufficientCount,
            amber,
          ],
          ["STOCK KOSONG", emptyCount, red],
        ] as const;

        summary.forEach(
          ([label, count, color], index) => {
            const x =
              margin +
              index * (summaryWidth + 4);

            doc.setFillColor(250, 252, 251);
            doc.setDrawColor(...line);
            doc.roundedRect(
              x,
              cursorY,
              summaryWidth,
              19,
              3,
              3,
              "FD"
            );

            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.5);
            doc.setTextColor(...muted);
            doc.text(
              label,
              x + 4,
              cursorY + 6
            );

            doc.setFontSize(12);
            doc.setTextColor(...color);
            doc.text(
              String(count),
              x + 4,
              cursorY + 14
            );
          }
        );

        cursorY += 25;

        // =======================================================
        // REQUEST SEPARATOR
        // =======================================================

        if (requestIndex < requests.length - 1) {
          doc.setDrawColor(...line);
          doc.line(
            margin,
            Math.min(cursorY, pageHeight - 25),
            pageWidth - margin,
            Math.min(cursorY, pageHeight - 25)
          );
        }
      };

      // =========================================================
      // RENDER SEMUA DRAFT REQUEST
      // =========================================================

      requests.forEach((request: any, index: number) => {
        drawRequest(request, index);
      });

      drawFooter();

      const today = new Date();
      const dateStamp =
        `${today.getFullYear()}${String(
          today.getMonth() + 1
        ).padStart(2, "0")}${String(
          today.getDate()
        ).padStart(2, "0")}`;

      doc.save(
        `Delivery-Request-Draft-All-Outlets-${dateStamp}.pdf`
      );
    } catch (error: any) {
      console.error(
        "DOWNLOAD ALL DELIVERY REQUEST PDF ERROR:",
        error
      );

      alert(
        error?.message ||
          "PDF Delivery Request Draft gagal dibuat. Silakan coba lagi."
      );
    }
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
          `Barang keluar ${
            json.data?.number || ""
          } berhasil disimpan sebagai DRAFT`
        );

        setCart([]);
        setCustomer("");
        setOutlet("");
        setNote("");
        setDeliveryDate(getTodayDate());

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
      total + Number(item.subtotal || 0),
    0
  );

  // =========================================================
  // FORMAT NUMBER
  // =========================================================

  function formatNumber(value: any) {
    return Number(value ?? 0).toLocaleString("id-ID");
  }

  const selectedCustomer = customers.find(
    (item) =>
      String(item.id) === String(customer)
  );

  const selectedOutlet = outlets.find(
    (item) =>
      String(item.id) === String(outlet)
  );

  // =========================================================
  // RENDER
  // =========================================================

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
                  <PackageMinus
                    size={25}
                    strokeWidth={2}
                  />
                </div>

                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#5F8A72]">
                  <ArrowRight
                    size={10}
                    className="text-white"
                  />
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
                  Kelola barang keluar pusat, termasuk
                  Delivery Request dari outlet yang akan
                  diproses menjadi Delivery Order.
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
                  Gudang Pusat
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] space-y-6 px-5 py-6 md:px-8 md:py-8">
        {/* =====================================================
            DELIVERY REQUEST OUTLET
        ===================================================== */}

        <section className="overflow-hidden rounded-[22px] border border-[#DDE8E1] bg-white/95 shadow-[0_8px_30px_rgba(23,58,47,0.055)]">
          <div className="border-b border-[#E7E3DB] px-5 py-5 md:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#173A2F] text-white">
                  <ClipboardList size={20} />
                </div>

                <div>
                  <h2 className="text-sm font-bold text-[#173A2F]">
                    Request Pengiriman Outlet
                  </h2>

                  <p className="mt-0.5 text-xs text-gray-500">
                    Request dari outlet masuk ke sini sebelum
                    diproses menjadi Delivery Order.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={requestStatusFilter}
                  onChange={(e) =>
                    setRequestStatusFilter(e.target.value)
                  }
                  className="h-10 rounded-xl border border-[#DDD8CE] bg-[#FAF9F6] px-3 text-xs font-semibold text-[#44564A] outline-none transition focus:border-[#5F8A72] focus:bg-white focus:ring-4 focus:ring-[#5F8A72]/10"
                >
                  <option value="ALL">
                    Semua Status
                  </option>

                  <option value="PENDING">
                    Pending
                  </option>

                  <option value="APPROVED">
                    Approved
                  </option>

                  <option value="PROCESSING">
                    Processing
                  </option>

                  <option value="COMPLETED">
                    Completed
                  </option>

                  <option value="REJECTED">
                    Rejected
                  </option>

                  <option value="CANCELLED">
                    Cancelled
                  </option>
                </select>

                <button
                  type="button"
                  onClick={loadDeliveryRequests}
                  disabled={loadingRequests}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#DDE8E1] bg-white px-4 text-xs font-bold text-[#44564A] transition hover:bg-[#F3F7F4] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw
                    size={14}
                    className={
                      loadingRequests
                        ? "animate-spin"
                        : ""
                    }
                  />

                  Refresh
                </button>

                <button
                  type="button"
                  onClick={openWhatsAppAllDeliveryRequests}
                  disabled={loadingRequests}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-xs font-bold text-emerald-700 shadow-[0_8px_20px_rgba(16,185,129,0.08)] transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Kirim seluruh Delivery Request dari semua outlet ke WhatsApp Web"
                >
                  <MessageCircle size={14} />
                  WhatsApp Semua Request
                </button>

                <button
                  type="button"
                  onClick={downloadDraftDeliveryRequestsPDF}
                  disabled={loadingRequests}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#173A2F] px-4 text-xs font-bold text-white shadow-[0_8px_20px_rgba(23,58,47,0.12)] transition hover:bg-[#285744] disabled:cursor-not-allowed disabled:opacity-50"
                  title="Download semua Delivery Request yang masih Draft / Pending dari seluruh outlet yang dapat diakses"
                >
                  <Download size={14} />
                  Download PDF
                </button>
              </div>
            </div>
          </div>

          <div className="p-5 md:p-6">
            {loadingRequests ? (
              <div className="flex min-h-[180px] items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <RefreshCw
                    size={17}
                    className="animate-spin text-[#5F8A72]"
                  />

                  Memuat Delivery Request...
                </div>
              </div>
            ) : deliveryRequests.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-[#DDE8E1] bg-[#F8FAF8] px-6 py-12 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF1EA] text-[#5F8A72]">
                  <ClipboardList size={24} />
                </div>

                <p className="text-sm font-bold text-[#173A2F]">
                  Belum ada Delivery Request
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  Request pengiriman yang dibuat oleh outlet
                  akan muncul di sini.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {deliveryRequests.map((request) => {
                  const statusStyle =
                    getRequestStatusStyle(
                      request.status
                    );

                  const totalRequestQty =
                    getRequestTotalQty(request);

                  const isExpanded =
                    expandedRequestId === request.id;

                  const busy =
                    processingRequestId ===
                    request.id;

                  const hasEmptyStock =
                    requestHasEmptyStock(request);

                  const hasInsufficientStock =
                    requestHasInsufficientStock(
                      request
                    );

                  return (
                    <div
                      key={request.id}
                      className="overflow-hidden rounded-[20px] border border-[#E1E7E3] bg-white transition hover:border-[#BFD1C5] hover:shadow-sm"
                    >
                      <div className="flex flex-col gap-4 p-4 md:p-5 xl:flex-row xl:items-center">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EEF1EA] text-[#5F8A72]">
                            <Truck size={19} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-[#173A2F]">
                                {getRequestNumber(
                                  request
                                )}
                              </p>

                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusStyle.wrapper} ${statusStyle.text}`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`}
                                />

                                {statusStyle.label}
                              </span>

                              {hasEmptyStock && (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-600">
                                  <PackageX size={11} />
                                  ADA STOCK KOSONG
                                </span>
                              )}

                              {!hasEmptyStock &&
                                hasInsufficientStock && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                                    <AlertTriangle
                                      size={11}
                                    />
                                    STOCK KURANG
                                  </span>
                                )}
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
                              <span className="inline-flex items-center gap-1.5">
                                <Store size={12} />
                                {getRequestOutlet(
                                  request
                                )}
                              </span>

                              <span className="inline-flex items-center gap-1.5">
                                <CalendarDays
                                  size={12}
                                />
                                {formatDate(
                                  request.requestDate
                                )}
                              </span>

                              <span className="inline-flex items-center gap-1.5">
                                <User size={12} />
                                {getRequestCreator(
                                  request
                                )}
                              </span>

                              <span className="inline-flex items-center gap-1.5">
                                <Boxes size={12} />
                                {formatNumber(
                                  totalRequestQty
                                )}{" "}
                                Qty
                              </span>
                            </div>

                            {request.delivery?.number && (
                              <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">
                                <Truck size={12} />
                                Delivery:{" "}
                                {
                                  request.delivery
                                    .number
                                }
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              if (isExpanded) {
                                setExpandedRequestId(
                                  null
                                );
                              } else {
                                setExpandedRequestId(
                                  request.id
                                );
                              }
                            }}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#DDE8E1] bg-white px-3 text-xs font-bold text-[#44564A] transition hover:bg-[#F3F7F4]"
                          >
                            {isExpanded ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            )}

                            Item
                          </button>

                          <button
                             type="button"
                             onClick={() =>
                               openWhatsAppDeliveryRequest(
                                 request
                               )
                             }
                             title="Kirim detail Delivery Request ke WhatsApp Web"
                             className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                           >
                             <MessageCircle size={14} />
                             WhatsApp
                           </button>

                           <button
                            type="button"
                            onClick={() =>
                              openRequestDetail(
                                request
                              )
                            }
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#DDE8E1] bg-[#F7F9F7] px-3 text-xs font-bold text-[#44564A] transition hover:bg-[#EEF1EA]"
                          >
                            <Eye size={14} />
                            Detail
                          </button>

                          {request.status ===
                            "PENDING" && (
                            <button
                              type="button"
                              onClick={() =>
                                approveDeliveryRequest(
                                  request.id
                                )
                              }
                              disabled={busy}
                              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#173A2F] px-4 text-xs font-bold text-white transition hover:bg-[#285744] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {busy ? (
                                <RefreshCw
                                  size={14}
                                  className="animate-spin"
                                />
                              ) : (
                                <Check size={14} />
                              )}

                              Approve
                            </button>
                          )}

                          {request.status ===
                            "APPROVED" && (
                            <button
                              type="button"
                              onClick={() =>
                                processDeliveryRequest(
                                  request.id
                                )
                              }
                              disabled={busy}
                              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#5F8A72] px-4 text-xs font-bold text-white transition hover:bg-[#285744] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {busy ? (
                                <RefreshCw
                                  size={14}
                                  className="animate-spin"
                                />
                              ) : (
                                <Truck size={14} />
                              )}

                              Proses
                            </button>
                          )}

                          {request.deliveryId && (
                            <button
                              type="button"
                              onClick={() =>
                                bukaDelivery(
                                  request.deliveryId
                                )
                              }
                              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#BFD1C5] bg-[#EEF1EA] px-4 text-xs font-bold text-[#285744] transition hover:bg-[#DCEAE1]"
                            >
                              <ArrowRight
                                size={14}
                              />
                              Buka Delivery
                            </button>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-[#E7E3DB] bg-[#FAFBFA] px-4 py-4 md:px-5">
                          <div className="overflow-x-auto rounded-xl border border-[#E3E9E5] bg-white">
                            <table className="min-w-[980px] w-full text-xs">
                              <thead className="bg-[#F4F6F3]">
                                <tr>
                                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wide text-gray-400">
                                    Barang
                                  </th>

                                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wide text-gray-400">
                                    Kode
                                  </th>

                                  <th className="px-4 py-3 text-center font-bold uppercase tracking-wide text-gray-400">
                                    Request
                                  </th>

                                  <th className="px-4 py-3 text-center font-bold uppercase tracking-wide text-gray-400">
                                    Stock Pusat
                                  </th>

                                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wide text-gray-400">
                                    Satuan
                                  </th>

                                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wide text-gray-400">
                                    Status Stock
                                  </th>
                                </tr>
                              </thead>

                              <tbody>
                                {(request.items || []).map(
                                  (item: any) => {
                                    const stock =
                                      getCentralStock(
                                        item
                                      );

                                    const stockStatus =
                                      getStockStatus(
                                        item
                                      );

                                    const StockIcon =
                                      stockStatus.icon;

                                    return (
                                      <tr
                                        key={
                                          item.id
                                        }
                                        className="border-t border-[#EDF1EE]"
                                      >
                                        <td className="px-4 py-3 font-bold text-[#173A2F]">
                                          {item.barang
                                            ?.name ||
                                            `Barang #${item.barangId}`}
                                        </td>

                                        <td className="px-4 py-3 text-gray-500">
                                          {item.barang
                                            ?.code ||
                                            "-"}
                                        </td>

                                        <td className="px-4 py-3 text-center">
                                          <span className="inline-flex min-w-[60px] justify-center rounded-lg bg-[#EEF1EA] px-2.5 py-1.5 font-bold text-[#5F8A72]">
                                            {formatNumber(
                                              item.qty
                                            )}
                                          </span>
                                        </td>

                                        <td className="px-4 py-3 text-center">
                                          <span
                                            className={`inline-flex min-w-[70px] justify-center rounded-lg px-2.5 py-1.5 font-bold ${
                                              stock <=
                                              0
                                                ? "bg-red-50 text-red-600"
                                                : stock <
                                                  Number(
                                                    item.qty ||
                                                      0
                                                  )
                                                ? "bg-amber-50 text-amber-700"
                                                : "bg-emerald-50 text-emerald-700"
                                            }`}
                                          >
                                            {formatNumber(
                                              stock
                                            )}
                                          </span>
                                        </td>

                                        <td className="px-4 py-3">
                                          <span className="inline-flex min-w-[60px] justify-center rounded-lg bg-[#F5F4F0] px-2.5 py-1.5 font-semibold text-[#44564A]">
                                            {getRequestItemUnit(
                                              item
                                            )}
                                          </span>
                                        </td>

                                        <td className="px-4 py-3">
                                          <span
                                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${stockStatus.className}`}
                                          >
                                            <StockIcon
                                              size={
                                                11
                                              }
                                            />

                                            {
                                              stockStatus.label
                                            }
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  }
                                )}
                              </tbody>
                            </table>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-[11px] text-gray-400">
                              <Clock3 size={13} />

                              <span>
                                Request dibuat{" "}
                                {formatDate(
                                  request.createdAt
                                )}
                              </span>
                            </div>

                            {request.remarks && (
                              <div className="rounded-xl border border-[#E4E9E5] bg-white px-3 py-2 text-[11px] text-gray-500">
                                <b className="text-[#44564A]">
                                  Keterangan:
                                </b>{" "}
                                {request.remarks}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

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
                  Tentukan tanggal, customer, outlet tujuan
                  dan keterangan transaksi.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 md:p-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#44564A]">
                  Tanggal Barang Keluar
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </label>

                <div className="relative">
                  <CalendarDays
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) =>
                      setDeliveryDate(e.target.value)
                    }
                    className="h-12 w-full rounded-xl border border-[#DDD8CE] bg-[#FAF9F6] py-3 pl-11 pr-4 text-sm font-medium text-gray-700 outline-none transition placeholder:text-gray-400 hover:border-[#9DB9A8] focus:border-[#5F8A72] focus:bg-white focus:ring-4 focus:ring-[#5F8A72]/10"
                  />
                </div>

                <p className="mt-2 text-[11px] leading-5 text-gray-400">
                  Tanggal transaksi dapat berbeda dengan
                  tanggal dibuat.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#44564A]">
                  Customer
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </label>

                <div className="relative">
                  <User
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <select
                    className="h-12 w-full appearance-none rounded-xl border border-[#DDD8CE] bg-[#FAF9F6] px-4 pl-11 pr-10 text-sm font-medium text-gray-700 outline-none transition hover:border-[#9DB9A8] focus:border-[#5F8A72] focus:bg-white focus:ring-4 focus:ring-[#5F8A72]/10"
                    value={customer}
                    onChange={(e) =>
                      setCustomer(e.target.value)
                    }
                  >
                    <option value="">
                      {loadingCustomer
                        ? "Memuat customer..."
                        : "-- Pilih Customer --"}
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

                {selectedCustomer && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[#5F8A72]">
                    <CircleCheck size={12} />
                    Customer terpilih
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#44564A]">
                  Outlet Tujuan
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </label>

                <div className="relative">
                  <Store
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <select
                    className="h-12 w-full appearance-none rounded-xl border border-[#DDD8CE] bg-[#FAF9F6] px-4 pl-11 pr-10 text-sm font-medium text-gray-700 outline-none transition hover:border-[#9DB9A8] focus:border-[#5F8A72] focus:bg-white focus:ring-4 focus:ring-[#5F8A72]/10"
                    value={outlet}
                    onChange={(e) =>
                      setOutlet(e.target.value)
                    }
                  >
                    <option value="">
                      {loadingOutlet
                        ? "Memuat outlet..."
                        : "-- Pilih Outlet Tujuan --"}
                    </option>

                    {outlets
                      .filter(
                        (o) => o.active !== false
                      )
                      .map((o) => (
                        <option
                          key={o.id}
                          value={o.id}
                        >
                          {o.code
                            ? `${o.code} - `
                            : ""}
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
                    onChange={(e) =>
                      setNote(e.target.value)
                    }
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
                    Gunakan scanner barcode atau kamera untuk
                    menambahkan barang.
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
                <BarcodeInputScanner
                  onScan={scanBarcode}
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  setOpenCamera(true)
                }
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#86A995] bg-[#E8F1EB] px-6 text-sm font-bold text-[#254D3D] shadow-[0_6px_18px_rgba(82,70,45,0.08)] transition duration-200 hover:border-[#9E8C69] hover:bg-[#DCEAE1] hover:shadow-[0_10px_24px_rgba(82,70,45,0.12)] active:scale-[0.99]"
              >
                <Camera size={18} />
                Scan dengan Kamera
              </button>
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#E5E1D8] bg-[#F5F4F0] p-3.5">
              <ScanLine
                size={16}
                className="mt-0.5 shrink-0 text-[#5F8A72]"
              />

              <p className="text-xs leading-5 text-gray-500">
                Barcode akan dicari langsung ke master
                barang. Setelah ditemukan, Anda dapat
                menentukan qty sebelum memasukkannya ke
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
                    onClick={() =>
                      setOpenCamera(false)
                    }
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
                    onClick={() =>
                      setOpenCamera(false)
                    }
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
                          {
                            filteredBarang.length
                          }{" "}
                          hasil
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
                    ) : filteredBarang.length ===
                      0 ? (
                      <div className="p-8 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F3F1EB] text-gray-300">
                          <PackageMinus size={23} />
                        </div>

                        <p className="text-sm font-bold text-gray-600">
                          Barang tidak ditemukan
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          Coba gunakan kode, nama, atau
                          barcode lain.
                        </p>
                      </div>
                    ) : (
                      filteredBarang.map((b) => {
                        const stockValue =
                          Number(
                            b.stock ?? 0
                          );

                        const stockEmpty =
                          stockValue <= 0;

                        return (
                          <button
                            type="button"
                            key={b.id}
                            onClick={() =>
                              pilihBarang(b)
                            }
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
                                      {b.code} -{" "}
                                      {b.name}
                                    </p>

                                    {b.barcode && (
                                      <p className="mt-1 truncate text-[11px] text-gray-400">
                                        Barcode:{" "}
                                        {
                                          b.barcode
                                        }
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
                                      : `STOCK ${formatNumber(
                                          stockValue
                                        )}`}
                                  </span>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
                                  <span>
                                    Satuan:{" "}
                                    <b className="text-[#44564A]">
                                      {b.unit ||
                                        "-"}
                                    </b>
                                  </span>

                                  <span>
                                    Harga:{" "}
                                    <b className="text-[#44564A]">
                                      Rp{" "}
                                      {formatNumber(
                                        b.purchasePrice
                                      )}
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
                  onChange={(e) =>
                    setQty(e.target.value)
                  }
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
                    <td
                      colSpan={6}
                      className="px-6 py-16 text-center"
                    >
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF1EA] text-[#5F8A72]">
                          <ShoppingCart size={27} />
                        </div>

                        <p className="text-sm font-bold text-[#173A2F]">
                          Keranjang masih kosong
                        </p>

                        <p className="mt-1.5 text-xs leading-5 text-gray-400">
                          Tambahkan barang menggunakan
                          pencarian manual atau scanner
                          barcode.
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
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex min-w-[64px] justify-center rounded-lg bg-[#EEF1EA] px-3 py-1.5 text-xs font-bold text-[#5F8A72]">
                          {formatNumber(
                            item.stock
                          )}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex min-w-[50px] justify-center rounded-lg bg-[#F3F7F4] px-3 py-1.5 text-xs font-bold text-[#173A2F]">
                          {formatNumber(
                            item.qty
                          )}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right text-xs font-medium text-gray-500">
                        Rp{" "}
                        {formatNumber(
                          item.price
                        )}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <p className="text-sm font-bold text-[#173A2F]">
                          Rp{" "}
                          {formatNumber(
                            item.subtotal
                          )}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            hapus(index)
                          }
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
                  Informasi jumlah barang yang akan
                  dikeluarkan.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-[22px] border border-[#E7E3DB] bg-[#F7F5F0] p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Total Jenis Barang
                  </p>

                  <Boxes
                    size={17}
                    className="text-[#5F8A72]"
                  />
                </div>

                <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#173A2F]">
                  {formatNumber(
                    cart.length
                  )}
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

                  <PackageMinus
                    size={17}
                    className="text-[#5F8A72]"
                  />
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
                    Rp{" "}
                    {formatNumber(
                      totalNominal
                    )}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-[22px] bg-white/10">
                  <Warehouse
                    size={20}
                    className="text-[#C9D2C5]"
                  />
                </div>
              </div>

              <div className="mb-5 h-px bg-white/10" />

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-white/50">
                    Jenis barang
                  </span>

                  <span className="font-semibold text-white">
                    {formatNumber(
                      cart.length
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-white/50">
                    Total qty
                  </span>

                  <span className="font-semibold text-white">
                    {formatNumber(totalQty)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-white/50">
                    Status
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 font-semibold text-[#D8DFD3]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#8BC4B2]" />
                    Draft
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={simpan}
                disabled={
                  saving ||
                  cart.length === 0
                }
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#D8C9A8] bg-[#E8F1EB] px-5 py-3.5 text-sm font-bold text-[#254D3D] shadow-[0_8px_24px_rgba(82,70,45,0.10)] transition hover:border-[#BBAA86] hover:bg-[#DCEAE1] hover:shadow-[0_12px_28px_rgba(82,70,45,0.14)] disabled:cursor-not-allowed disabled:opacity-40"
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

              <p className="mt-3 text-center text-[10px] leading-4 text-white/35">
                Transaksi manual akan disimpan sebagai DRAFT
                setelah validasi berhasil.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          REQUEST DETAIL MODAL
      ===================================================== */}

      {showRequestDetail &&
        requestDetail && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#141B17]/65 p-4 backdrop-blur-sm">
            <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[24px] border border-[#DDE8E1] bg-white shadow-2xl">
              {/* HEADER */}

              <div className="flex items-center justify-between border-b border-[#E7E3DB] px-5 py-5 md:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#173A2F] text-white">
                    <ClipboardList size={19} />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-[#173A2F]">
                      Detail Delivery Request
                    </p>

                    <p className="mt-0.5 text-xs text-gray-500">
                      {getRequestNumber(
                        requestDetail
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">


                  <button
                    type="button"
                    onClick={() => {
                      setShowRequestDetail(
                        false
                      );
                      setRequestDetail(null);
                      setEditingRequest(false);
                    }}
                    className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                  >
                    <X size={19} />
                  </button>
                </div>
              </div>

              <div className="max-h-[calc(92vh-90px)] overflow-y-auto p-5 md:p-6">
                {/* INFO */}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div className="rounded-xl border border-[#E5EAE7] bg-[#F8FAF8] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Request
                    </p>

                    <p className="mt-1.5 text-sm font-bold text-[#173A2F]">
                      {getRequestNumber(
                        requestDetail
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#E5EAE7] bg-[#F8FAF8] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Outlet
                    </p>

                    <p className="mt-1.5 text-sm font-bold text-[#173A2F]">
                      {getRequestOutlet(
                        requestDetail
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#E5EAE7] bg-[#F8FAF8] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Tanggal
                    </p>

                    <p className="mt-1.5 text-sm font-bold text-[#173A2F]">
                      {formatDate(
                        requestDetail.requestDate
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#E5EAE7] bg-[#F8FAF8] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Status
                    </p>

                    <div className="mt-1.5">
                      {(() => {
                        const style =
                          getRequestStatusStyle(
                            requestDetail.status
                          );

                        return (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${style.wrapper} ${style.text}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
                            />

                            {style.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* STOCK SUMMARY */}

                {!editingRequest && (
                  <div className="mt-5 rounded-[20px] border border-[#DDE8E1] bg-[#F8FAF8] p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-[#5F8A72]">
                          Validasi Stock Pusat
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          Stock pusat digunakan sebagai acuan
                          untuk menyesuaikan qty request
                          sebelum Delivery diproses.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700">
                          <PackageCheck size={12} />
                          Stock Cukup
                        </span>

                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-700">
                          <AlertTriangle
                            size={12}
                          />
                          Stock Kurang
                        </span>

                        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[10px] font-bold text-red-600">
                          <PackageX size={12} />
                          Stock Kosong
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* EDIT MODE */}

                {editingRequest ? (
                  <div className="mt-5 overflow-hidden rounded-[20px] border border-[#BFD1C5]">
                    <div className="flex flex-col gap-3 border-b border-[#DDE8E1] bg-[#F3F8F5] px-4 py-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-[#285744]">
                          Edit Delivery Request
                        </p>

                        <p className="mt-1 text-[11px] text-gray-500">
                          Sesuaikan Qty request dengan
                          stock pusat yang tersedia.
                        </p>
                      </div>

                      <div className="rounded-xl border border-[#C9DCCF] bg-white px-3 py-2 text-[11px] font-semibold text-[#285744]">
                        Stock pusat tidak boleh terlewati
                      </div>
                    </div>

                    <div className="overflow-x-auto bg-white">
                      <table className="min-w-[900px] w-full text-xs">
                        <thead className="bg-[#F8FAF8]">
                          <tr>
                            <th className="px-4 py-3 text-left font-bold uppercase tracking-wide text-gray-400">
                              Barang
                            </th>

                            <th className="px-4 py-3 text-center font-bold uppercase tracking-wide text-gray-400">
                              Stock Pusat
                            </th>

                            <th className="px-4 py-3 text-center font-bold uppercase tracking-wide text-gray-400">
                              Qty Request
                            </th>

                            <th className="px-4 py-3 text-center font-bold uppercase tracking-wide text-gray-400">
                              Satuan
                            </th>

                            <th className="px-4 py-3 text-center font-bold uppercase tracking-wide text-gray-400">
                              Status
                            </th>

                            <th className="px-4 py-3 text-center font-bold uppercase tracking-wide text-gray-400">
                              Aksi
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {editItems.map(
                            (editItem) => {
                              const originalItem =
                                (
                                  requestDetail.items ||
                                  []
                                ).find(
                                  (item: any) =>
                                    Number(
                                      item.id
                                    ) ===
                                    Number(
                                      editItem.id
                                    )
                                );

                              const stock =
                                getEditItemStock(
                                  editItem
                                );

                              const qtyValue =
                                Number(
                                  editItem.qty ||
                                    0
                                );

                              const enough =
                                stock >=
                                qtyValue &&
                                qtyValue > 0;

                              const stockEmpty =
                                stock <= 0;

                              return (
                                <tr
                                  key={
                                    editItem.id
                                  }
                                  className="border-t border-[#EDF1EE]"
                                >
                                  <td className="px-4 py-4">
                                    <div>
                                      <p className="font-bold text-[#173A2F]">
                                        {originalItem
                                          ?.barang
                                          ?.name ||
                                          `Barang #${editItem.barangId}`}
                                      </p>

                                      <p className="mt-1 text-[11px] text-gray-400">
                                        {originalItem
                                          ?.barang
                                          ?.code ||
                                          "-"}
                                      </p>
                                    </div>
                                  </td>

                                  <td className="px-4 py-4 text-center">
                                    <span
                                      className={`inline-flex min-w-[80px] justify-center rounded-lg px-3 py-2 font-bold ${
                                        stockEmpty
                                          ? "bg-red-50 text-red-600"
                                          : "bg-[#EEF1EA] text-[#5F8A72]"
                                      }`}
                                    >
                                      {formatNumber(
                                        stock
                                      )}
                                    </span>
                                  </td>

                                  <td className="px-4 py-4">
                                    <div className="mx-auto flex max-w-[150px] items-center gap-2">
                                      <input
                                        type="number"
                                        min="1"
                                        max={
                                          stock >
                                          0
                                            ? stock
                                            : undefined
                                        }
                                        value={
                                          editItem.qty
                                        }
                                        onChange={(
                                          e
                                        ) =>
                                          updateEditItemQty(
                                            editItem.id,
                                            e
                                              .target
                                              .value
                                          )
                                        }
                                        className={`h-10 w-full rounded-xl border bg-white px-3 text-center text-sm font-bold outline-none transition focus:ring-4 ${
                                          stockEmpty
                                            ? "border-red-200 text-red-600 focus:border-red-400 focus:ring-red-100"
                                            : qtyValue >
                                                stock
                                              ? "border-amber-300 text-amber-700 focus:border-amber-400 focus:ring-amber-100"
                                              : "border-[#DDE8E1] text-[#173A2F] focus:border-[#5F8A72] focus:ring-[#5F8A72]/10"
                                        }`}
                                      />
                                    </div>

                                    {qtyValue >
                                      stock && (
                                      <p className="mt-1 text-center text-[10px] font-semibold text-red-500">
                                        Melebihi stock
                                        pusat
                                      </p>
                                    )}
                                  </td>

                                  <td className="px-4 py-4 text-center">
                                    <span className="inline-flex rounded-lg bg-[#F5F4F0] px-3 py-1.5 font-semibold text-[#44564A]">
                                      {getRequestItemUnit(
                                        originalItem
                                      )}
                                    </span>
                                  </td>

                                  <td className="px-4 py-4 text-center">
                                    {stockEmpty ? (
                                      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] font-bold text-red-600">
                                        <PackageX
                                          size={11}
                                        />
                                        KOSONG
                                      </span>
                                    ) : enough ? (
                                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-700">
                                        <PackageCheck
                                          size={
                                            11
                                          }
                                        />
                                        CUKUP
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold text-amber-700">
                                        <AlertTriangle
                                          size={
                                            11
                                          }
                                        />
                                        KURANG
                                      </span>
                                    )}
                                  </td>

                                  <td className="px-4 py-4 text-center">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeEditItem(
                                          editItem.id
                                        )
                                      }
                                      disabled={
                                        savingRequestEdit ||
                                        editItems.length <= 1
                                      }
                                      title={
                                        editItems.length <= 1
                                          ? "Minimal satu barang harus tersisa"
                                          : "Hapus item"
                                      }
                                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            }
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* NORMAL DETAIL TABLE */

                  <div className="mt-5 overflow-hidden rounded-[20px] border border-[#E2E8E4]">
                    <div className="border-b border-[#E7EDE9] bg-[#F5F7F5] px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-[#5F8A72]">
                          Daftar Barang & Stock Pusat
                        </p>

                        <span className="text-[10px] font-semibold text-gray-400">
                          Stock realtime dari Gudang Pusat
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-[850px] w-full text-xs">
                        <thead>
                          <tr className="border-b border-[#E7EDE9] bg-white">
                            <th className="px-4 py-3 text-left font-bold text-gray-400">
                              Barang
                            </th>

                            <th className="px-4 py-3 text-left font-bold text-gray-400">
                              Kode
                            </th>

                            <th className="px-4 py-3 text-center font-bold text-gray-400">
                              Request
                            </th>

                            <th className="px-4 py-3 text-center font-bold text-gray-400">
                              Stock Pusat
                            </th>

                            <th className="px-4 py-3 text-center font-bold text-gray-400">
                              Satuan
                            </th>

                            <th className="px-4 py-3 text-center font-bold text-gray-400">
                              Status
                            </th>

                            <th className="px-4 py-3 text-left font-bold text-gray-400">
                              Catatan
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {(requestDetail.items ||
                            []).map(
                            (item: any) => {
                              const stock =
                                getCentralStock(
                                  item
                                );

                              const stockStatus =
                                getStockStatus(
                                  item
                                );

                              const StockIcon =
                                stockStatus.icon;

                              return (
                                <tr
                                  key={item.id}
                                  className="border-t border-[#EDF1EE]"
                                >
                                  <td className="px-4 py-3 font-bold text-[#173A2F]">
                                    {item.barang
                                      ?.name ||
                                      `Barang #${item.barangId}`}
                                  </td>

                                  <td className="px-4 py-3 text-gray-500">
                                    {item.barang
                                      ?.code ||
                                      "-"}
                                  </td>

                                  <td className="px-4 py-3 text-center">
                                    <span className="inline-flex min-w-[65px] justify-center rounded-lg bg-[#EEF1EA] px-2.5 py-1.5 font-bold text-[#5F8A72]">
                                      {formatNumber(
                                        item.qty
                                      )}
                                    </span>
                                  </td>

                                  <td className="px-4 py-3 text-center">
                                    <span
                                      className={`inline-flex min-w-[75px] justify-center rounded-lg px-2.5 py-1.5 font-bold ${
                                        stock <=
                                        0
                                          ? "bg-red-50 text-red-600"
                                          : stock <
                                            Number(
                                              item.qty ||
                                                0
                                            )
                                          ? "bg-amber-50 text-amber-700"
                                          : "bg-emerald-50 text-emerald-700"
                                      }`}
                                    >
                                      {formatNumber(
                                        stock
                                      )}
                                    </span>
                                  </td>

                                  <td className="px-4 py-3 text-center">
                                    <span className="inline-flex min-w-[60px] justify-center rounded-lg bg-[#F5F4F0] px-2.5 py-1.5 font-semibold text-[#44564A]">
                                      {getRequestItemUnit(
                                        item
                                      )}
                                    </span>
                                  </td>

                                  <td className="px-4 py-3 text-center">
                                    <span
                                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${stockStatus.className}`}
                                    >
                                      <StockIcon
                                        size={
                                          11
                                        }
                                      />

                                      {
                                        stockStatus.label
                                      }
                                    </span>
                                  </td>

                                  <td className="px-4 py-3 text-gray-500">
                                    {item.note ||
                                      "-"}
                                  </td>
                                </tr>
                              );
                            }
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* CREATED INFO */}

                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-[#E5EAE7] bg-[#F8FAF8] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Dibuat Oleh
                    </p>

                    <p className="mt-1.5 text-sm font-bold text-[#173A2F]">
                      {getRequestCreator(
                        requestDetail
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#E5EAE7] bg-[#F8FAF8] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Total Quantity
                    </p>

                    <p className="mt-1.5 text-sm font-bold text-[#173A2F]">
                      {formatNumber(
                        editingRequest
                          ? editItems.reduce(
                              (
                                total,
                                item
                              ) =>
                                total +
                                Number(
                                  item.qty ||
                                    0
                                ),
                              0
                            )
                          : getRequestTotalQty(
                              requestDetail
                            )
                      )}{" "}
                      Qty
                    </p>
                  </div>
                </div>

                {/* REMARKS */}

                {requestDetail.remarks && (
                  <div className="mt-4 rounded-xl border border-[#E5EAE7] bg-[#F8FAF8] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Keterangan
                    </p>

                    <p className="mt-1.5 text-sm leading-6 text-gray-600">
                      {requestDetail.remarks}
                    </p>
                  </div>
                )}

                {/* DELIVERY */}

                {requestDetail.delivery && (
                  <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500">
                          Delivery Order
                        </p>

                        <p className="mt-1 text-sm font-bold text-violet-800">
                          {
                            requestDetail
                              .delivery
                              .number
                          }
                        </p>

                        <p className="mt-1 text-[11px] text-violet-600">
                          Status:{" "}
                          {requestDetail
                            .delivery
                            .status ||
                            "-"}
                        </p>
                      </div>

                      {requestDetail.deliveryId && (
                        <button
                          type="button"
                          onClick={() =>
                            bukaDelivery(
                              requestDetail.deliveryId
                            )
                          }
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white transition hover:bg-violet-800"
                        >
                          <ArrowRight
                            size={14}
                          />
                          Buka Delivery
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* ACTION FOOTER */}

                <div className="mt-5 flex flex-wrap justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    {!editingRequest &&
                      ["PENDING", "APPROVED"].includes(
                        requestDetail.status
                      ) && (
                        <button
                          type="button"
                          onClick={
                            startEditRequest
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#BFD1C5] bg-[#EEF1EA] px-5 py-3 text-xs font-bold text-[#285744] transition hover:bg-[#DCEAE1]"
                        >
                          <Pencil size={14} />
                          Edit Request
                        </button>
                      )}

                    {!editingRequest &&
                      ["PENDING", "APPROVED"].includes(
                        requestDetail.status
                      ) && (
                        <button
                          type="button"
                          onClick={() =>
                            deleteDeliveryRequest(
                              requestDetail
                            )
                          }
                          disabled={
                            deletingRequest
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingRequest ? (
                            <RefreshCw
                              size={14}
                              className="animate-spin"
                            />
                          ) : (
                            <Trash2
                              size={14}
                            />
                          )}

                          Hapus Request
                        </button>
                      )}
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    {editingRequest ? (
                      <>
                        <button
                          type="button"
                          onClick={
                            cancelEditRequest
                          }
                          disabled={
                            savingRequestEdit
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DDD8CE] bg-white px-5 py-3 text-xs font-bold text-gray-600 transition hover:bg-[#F3F1EB] disabled:opacity-50"
                        >
                          <X size={14} />
                          Batal
                        </button>

                        <button
                          type="button"
                          onClick={
                            saveRequestEdit
                          }
                          disabled={
                            savingRequestEdit
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#173A2F] px-5 py-3 text-xs font-bold text-white transition hover:bg-[#285744] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {savingRequestEdit ? (
                            <RefreshCw
                              size={14}
                              className="animate-spin"
                            />
                          ) : (
                            <Save size={14} />
                          )}

                          Simpan Perubahan
                        </button>
                      </>
                    ) : (
                      <>
                        {requestDetail.status ===
                          "PENDING" && (
                          <button
                            type="button"
                            onClick={async () => {
                              setShowRequestDetail(
                                false
                              );

                              await approveDeliveryRequest(
                                requestDetail.id
                              );
                            }}
                            disabled={
                              processingRequestId ===
                              requestDetail.id
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#173A2F] px-5 py-3 text-xs font-bold text-white transition hover:bg-[#285744] disabled:opacity-50"
                          >
                            <Check size={15} />
                            Approve Request
                          </button>
                        )}

                        {requestDetail.status ===
                          "APPROVED" && (
                          <button
                            type="button"
                            onClick={async () => {
                              setShowRequestDetail(
                                false
                              );

                              await processDeliveryRequest(
                                requestDetail.id
                              );
                            }}
                            disabled={
                              processingRequestId ===
                              requestDetail.id
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5F8A72] px-5 py-3 text-xs font-bold text-white transition hover:bg-[#285744] disabled:opacity-50"
                          >
                            <Truck size={15} />
                            Proses Delivery
                          </button>
                        )}
                      </>
                    )}

                    {!editingRequest && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            openWhatsAppDeliveryRequest(
                              requestDetail
                            )
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-xs font-bold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                        >
                          <MessageCircle size={15} />
                          WhatsApp
                        </button>

                        <button
                        type="button"
                        onClick={() => {
                          setShowRequestDetail(
                            false
                          );
                          setRequestDetail(null);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DDD8CE] bg-white px-5 py-3 text-xs font-bold text-gray-600 transition hover:bg-[#F3F1EB]"
                      >
                        Tutup
                      </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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
                  onClick={() =>
                    setScanBarang(null)
                  }
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
                    <PackageMinus
                      size={15}
                      className="text-[#5F8A72]"
                    />

                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F8A72]">
                      Detail Barang
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-[#EDF2EF]">
                  <div className="flex justify-between gap-4 px-4 py-3.5">
                    <span className="text-xs text-gray-400">
                      Kode
                    </span>

                    <span className="text-right text-xs font-bold text-[#173A2F]">
                      {scanBarang.code ||
                        "-"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4 px-4 py-3.5">
                    <span className="text-xs text-gray-400">
                      Barcode
                    </span>

                    <span className="text-right text-xs font-medium text-gray-600">
                      {scanBarang.barcode ||
                        "-"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4 px-4 py-3.5">
                    <span className="text-xs text-gray-400">
                      Nama
                    </span>

                    <span className="max-w-[230px] text-right text-xs font-bold text-[#173A2F]">
                      {scanBarang.name ||
                        "-"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4 px-4 py-3.5">
                    <span className="text-xs text-gray-400">
                      Stock Tersedia
                    </span>

                    <span className="text-right text-xs font-bold text-[#5F8A72]">
                      {formatNumber(
                        getCentralStock(scanBarang)
                      )}{" "}
                      {getRequestItemUnit(scanBarang)}
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
                  onChange={(e) =>
                    setScanQty(e.target.value)
                  }
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setScanBarang(null)
                  }
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