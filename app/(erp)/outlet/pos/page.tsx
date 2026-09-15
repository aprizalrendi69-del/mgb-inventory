"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Banknote,
  Beef,
  CakeSlice,
  ChevronDown,
  Clock3,
  CreditCard,
  FileText,
  Grid2X2,
  History,
  Landmark,
  List,
  Menu as MenuIcon,
  Minus,
  Plus,
  QrCode,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingCart,
  Soup,
  Trash2,
  UserCircle2,
  X,
  ScanLine,
  Utensils,
  Drumstick,
  CirclePower,
  Printer,
  Bookmark,
  Play,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Package,
  Sparkles,
  ChevronRight,
  WalletCards,
  ArrowDownToLine,
} from "lucide-react";

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type MenuItem = {
  id: number;
  menuId: number | null;
  code: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  image: string | null;
  stock: number;
  bomReady: boolean;
  recipeId: number | null;
  legacyBarangId?: number | null;
};

type SaleItem = {
  id: number;
  qty: number;
  unitPrice: number;
  subtotal: number;
  menu?: { name: string } | null;
  barang?: { name: string; unit: string } | null;
};

type Sale = {
  id: number;
  number: string;
  saleDate: string;
  total: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: string;
  customerName: string | null;
  note?: string | null;
  discount?: number;
  serviceCharge?: number;
  ppn?: number;
  outlet: Outlet;
  items: SaleItem[];
};

type CartItem = {
  menuId: number;
  code: string;
  name: string;
  qty: number;
  stock: number;
  price: number;
  category: string;
  bomReady: boolean;
  recipeId: number | null;
};


type AycePackage = {
  key: string;
  name: string;
  price: number;
  durationMinutes: number;
};

type AyceSession = {
  id: string;
  tableName: string;
  pax: number;
  packageKey: string;
  packageName: string;
  packagePrice: number;
  durationMinutes: number;
  startedAt: string;
  expiresAt: string;
  status: "OPEN" | "EXPIRED" | "CLOSED";
  consumptionCount: number;
};

type ConsumptionEntry = {
  id: string;
  menuId: number;
  name: string;
  qty: number;
  orderedAt: string;
  sessionId: string;
};

const AYCE_STORAGE_KEY = "mgb-pos-ayce-sessions-v1";

const aycePackages: AycePackage[] = [
  { key: "AYCE_199K", name: "AYCE 199K", price: 199000, durationMinutes: 100 },
  { key: "AYCE_219K", name: "AYCE 219K", price: 219000, durationMinutes: 100 },
  { key: "AYCE_249K", name: "AYCE 249K", price: 249000, durationMinutes: 120 },
];

type HoldOrder = {
  id: string;
  createdAt: string;
  outletId: string;
  customerName: string;
  discount: string;
  paymentMethod: string;
  note: string;
  cart: CartItem[];
};

type Category = {
  key: string;
  label: string;
  icon: any;
};

type QuickPackage = {
  key: string;
  label: string;
  subtitle: string;
  accent: string;
};

const gangnamPackages: QuickPackage[] = [
  { key: "PAKET_PORKY", label: "PAKET PORKY", subtitle: "Signature Pork", accent: "red" },
  { key: "FREE_PORKY", label: "FREE PORKY", subtitle: "Free Flow Pork", accent: "orange" },
  { key: "PAKET_FAMILY", label: "PAKET FAMILY", subtitle: "Family Set", accent: "lime" },
  { key: "PAKET_STANDARD", label: "PAKET STANDARD", subtitle: "Standard Set", accent: "amber" },
  { key: "DAGING_PEDAS", label: "DAGING PEDAS", subtitle: "Spicy Meat", accent: "blue" },
  { key: "SUNDUBU_JIGAE", label: "SUNDUBU JIGAE", subtitle: "Korean Soup", accent: "violet" },
  { key: "DAGING_MANIS", label: "DAGING MANIS", subtitle: "Sweet Meat", accent: "rose" },
  { key: "PAJEON", label: "PAJEON", subtitle: "Korean Pancake", accent: "sky" },
  { key: "CRISPY_BELLY", label: "CRISPY BELLY", subtitle: "Crispy Pork", accent: "slate" },
  { key: "PORK_GARLIC", label: "PORK GARLIC", subtitle: "Garlic Pork", accent: "emerald" },
  { key: "BOKKEUMBAP", label: "BOKKEUMBAP", subtitle: "Fried Rice", accent: "cyan" },
  { key: "ARANG", label: "ARANG", subtitle: "Charcoal", accent: "stone" },
  { key: "PAKET_119K", label: "PAKET 119 K", subtitle: "Value Package", accent: "red" },
  { key: "PAKET_129K", label: "PAKET 129 K", subtitle: "Premium Package", accent: "orange" },
];

const HOLD_KEY = "mgb-pos-hold-orders-v1";

const money = (n: number) =>
  `Rp ${Math.round(Number(n || 0)).toLocaleString("id-ID")}`;

const roundMoney = (n: number) =>
  Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

const normalize = (s: string) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const gangnamCategories: Category[] = [
  { key: "ALL", label: "SEMUA", icon: Grid2X2 },
  { key: "PORK", label: "PORK", icon: Beef },
  { key: "BEEF", label: "BEEF", icon: Beef },
  { key: "CHICKEN", label: "CHICKEN", icon: Drumstick },
  { key: "SIDE", label: "SIDE DISH", icon: Utensils },
  { key: "SOUP", label: "SOUP", icon: Soup },
  { key: "DRINK", label: "DRINK", icon: Utensils },
  { key: "DESSERT", label: "DESSERT", icon: CakeSlice },
];

const categoryKey = (category: string | null, name: string) => {
  const s = normalize(`${category || ""} ${name}`);

  if (/pork|samgyeop|galbi|babi|go chu|dwae ji/.test(s)) return "PORK";
  if (/beef|sapi|bulgogi/.test(s)) return "BEEF";
  if (/chicken|ayam|chikin/.test(s)) return "CHICKEN";
  if (/soup|sundubu|jigae|kuah/.test(s)) return "SOUP";
  if (/drink|americano|coffee|tea|minum|sujeonggwa/.test(s)) return "DRINK";
  if (/dessert|pudding|fruit|es |ice|hotteok|campur/.test(s)) {
    return "DESSERT";
  }

  return "SIDE";
};

function foodEmoji(category: string) {
  if (category === "PORK") return "🥩";
  if (category === "BEEF") return "🥓";
  if (category === "CHICKEN") return "🍗";
  if (category === "SOUP") return "🍲";
  if (category === "DRINK") return "☕";
  if (category === "DESSERT") return "🍧";
  return "🥢";
}

function paymentIcon(method: string) {
  if (method === "QRIS") return QrCode;
  if (method === "TRANSFER") return Landmark;
  return Banknote;
}

export default function PosOutletPage() {
  const router = useRouter();
  // Render POS directly into document.body so parent/layout stacking contexts
  // (including the global ERP header) cannot cover the POS screen.
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const [role, setRole] = useState("");
  const [cashier, setCashier] = useState("");
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState("");
  const [currentOutlet, setCurrentOutlet] = useState<Outlet | null>(null);

  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  const [search, setSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [selectedPackage, setSelectedPackage] = useState("");

  // ============================================================
  // AYCE SESSION
  // Meja → Session → Pax → Paket → Timer → Order → Consumption
  // ============================================================
  const [ayceEnabled, setAyceEnabled] = useState(false);
  const [tableName, setTableName] = useState("");
  const [pax, setPax] = useState("2");
  const [aycePackageKey, setAycePackageKey] = useState("AYCE_199K");
  const [ayceSession, setAyceSession] = useState<AyceSession | null>(null);
  const [consumptions, setConsumptions] = useState<ConsumptionEntry[]>([]);
  const [aycePanelOpen, setAycePanelOpen] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [discount, setDiscount] = useState("");
  const [paid, setPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [payOpen, setPayOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  const [view, setView] = useState<"GRID" | "LIST">("GRID");

  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const [clock, setClock] = useState(new Date());

  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const [holdOpen, setHoldOpen] = useState(false);
  const [holds, setHolds] = useState<HoldOrder[]>([]);

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  const loadHolds = () => {
    try {
      const raw = localStorage.getItem(HOLD_KEY);
      const parsed = raw ? JSON.parse(raw) : [];

      setHolds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setHolds([]);
    }
  };

  const persistHolds = (next: HoldOrder[]) => {
    setHolds(next);
    localStorage.setItem(HOLD_KEY, JSON.stringify(next));
  };

  const loadAyceSession = () => {
    try {
      const raw = localStorage.getItem(AYCE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const outletKey = String(outletId || "");
      const saved = parsed?.[outletKey];

      if (saved?.session) {
        setAyceSession(saved.session);
        setAyceEnabled(true);
        setTableName(saved.session.tableName || "");
        setPax(String(saved.session.pax || 1));
        setAycePackageKey(saved.session.packageKey || "AYCE_199K");
        setConsumptions(
          Array.isArray(saved.consumptions) ? saved.consumptions : []
        );
      } else {
        setAyceSession(null);
        setConsumptions([]);
      }
    } catch {
      setAyceSession(null);
      setConsumptions([]);
    }
  };

  const persistAyceSession = (
    session: AyceSession | null,
    entries: ConsumptionEntry[] = consumptions
  ) => {
    try {
      const raw = localStorage.getItem(AYCE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const outletKey = String(outletId || "");

      if (session) {
        parsed[outletKey] = {
          session,
          consumptions: entries,
        };
      } else {
        delete parsed[outletKey];
      }

      localStorage.setItem(AYCE_STORAGE_KEY, JSON.stringify(parsed));
    } catch {
      // Local persistence is only a client-side convenience.
    }
  };

  const selectedAycePackage =
    aycePackages.find((item) => item.key === aycePackageKey) ||
    aycePackages[0];

  const ayceRemainingSeconds = useMemo(() => {
    if (!ayceSession) return 0;
    return Math.max(
      0,
      Math.floor(
        (new Date(ayceSession.expiresAt).getTime() - clock.getTime()) / 1000
      )
    );
  }, [ayceSession, clock]);

  const ayceExpired =
    Boolean(ayceSession) && ayceRemainingSeconds <= 0;

  const formatDuration = (seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds));
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = safe % 60;
    return h > 0
      ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  function startAyceSession() {
    if (!outletId) {
      alert("Pilih outlet terlebih dahulu.");
      return;
    }

    const parsedPax = Math.max(1, Math.floor(Number(pax || 0)));
    if (!Number.isFinite(parsedPax) || parsedPax < 1) {
      alert("Jumlah pax minimal 1 orang.");
      return;
    }

    if (!tableName.trim()) {
      alert("Isi nomor / nama meja terlebih dahulu.");
      return;
    }

    const now = new Date();
    const expires = new Date(
      now.getTime() + selectedAycePackage.durationMinutes * 60 * 1000
    );

    const session: AyceSession = {
      id: `AYCE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tableName: tableName.trim(),
      pax: parsedPax,
      packageKey: selectedAycePackage.key,
      packageName: selectedAycePackage.name,
      packagePrice: selectedAycePackage.price,
      durationMinutes: selectedAycePackage.durationMinutes,
      startedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      status: "OPEN",
      consumptionCount: 0,
    };

    setAyceSession(session);
    setAyceEnabled(true);
    setConsumptions([]);
    setAycePanelOpen(false);
    persistAyceSession(session, []);
  }

  function closeAyceSession() {
    if (!ayceSession) return;

    if (
      !confirm(
        `Tutup session ${ayceSession.tableName}? Session akan ditandai CLOSED dan tidak lagi menerima order AYCE.`
      )
    ) {
      return;
    }

    setAyceSession(null);
    setConsumptions([]);
    setAyceEnabled(false);
    setTableName("");
    setPax("2");
    setCart([]);
    persistAyceSession(null, []);
  }

  function recordAyceConsumption(items: CartItem[]) {
    if (!ayceSession || ayceSession.status !== "OPEN") return;

    const now = new Date().toISOString();
    const nextEntries = [...consumptions];

    for (const item of items) {
      const existing = nextEntries.find(
        (entry) =>
          entry.sessionId === ayceSession.id &&
          entry.menuId === item.menuId
      );

      if (existing) {
        existing.qty += item.qty;
        existing.orderedAt = now;
      } else {
        nextEntries.push({
          id: `CONS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          menuId: item.menuId,
          name: item.name,
          qty: item.qty,
          orderedAt: now,
          sessionId: ayceSession.id,
        });
      }
    }

    const updatedSession = {
      ...ayceSession,
      consumptionCount: nextEntries.reduce(
        (sum, item) => sum + item.qty,
        0
      ),
    };

    setConsumptions(nextEntries);
    setAyceSession(updatedSession);
    persistAyceSession(updatedSession, nextEntries);
  }


  const load = async (requestedOutletId?: string) => {
    try {
      setLoading(true);
      setError("");

      const selected = requestedOutletId ?? outletId;

      const q = selected
        ? `?outletId=${encodeURIComponent(selected)}`
        : "";

      const response = await fetch(`/api/outlet/pos${q}`, {
        cache: "no-store",
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.message || "Gagal mengambil POS.");
      }

      setRole(json.role || "");

      const cashierData = json.cashier;

      setCashier(
        typeof cashierData === "string"
          ? cashierData
          : cashierData?.fullname ||
              cashierData?.username ||
              "Kasir"
      );

      setOutlets(Array.isArray(json.outlets) ? json.outlets : []);
      setMenus(Array.isArray(json.menus) ? json.menus : []);
      setSales(Array.isArray(json.sales) ? json.sales : []);
      setCurrentOutlet(json.currentOutlet || null);

      if (json.role === "OUTLET_ADMIN" && json.currentOutlet) {
        setOutletId(String(json.currentOutlet.id));
      } else if (json.currentOutlet && !selected) {
        setOutletId(String(json.currentOutlet.id));
      }
    } catch (e: any) {
      setError(e?.message || "Gagal mengambil POS.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadHolds();

    const timer = window.setInterval(
      () => setClock(new Date()),
      1000
    );

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (outletId) {
      load(outletId);
      loadAyceSession();
    }

    setCart([]);
    setCategory("ALL");
    setSelectedPackage("");
    setMobileCartOpen(false);
  }, [outletId]);

  const selectedOutlet = useMemo(
    () =>
      currentOutlet ||
      outlets.find(
        (outlet) => String(outlet.id) === outletId
      ) ||
      null,
    [currentOutlet, outlets, outletId]
  );

  const isGangnam = useMemo(() => {
    const text = normalize(
      `${selectedOutlet?.code || ""} ${
        selectedOutlet?.name || ""
      }`
    );

    return text.includes("gangnam");
  }, [selectedOutlet]);

  const filtered = useMemo(() => {
    const q = normalize(search);

    return menus
      .filter((menu) => {
        const cat = categoryKey(
          menu.category,
          menu.name
        );

        return (
          (category === "ALL" || cat === category) &&
          (!q ||
            normalize(
              `${menu.code} ${menu.name}`
            ).includes(q))
        );
      })
      .slice(0, 100);
  }, [menus, search, category]);


  const aycePackageTotal = ayceSession
    ? roundMoney(ayceSession.packagePrice * Math.max(1, ayceSession.pax))
    : 0;

  // Dalam mode AYCE, item AYCE bernilai Rp0 di order/consumption.
  // Harga paket menjadi komponen revenue utama. Add-on tetap memakai harga item.
  const ayceOrderSubtotal = ayceSession
    ? roundMoney(
        cart.reduce((sum, item) => {
          const isAyceFood =
            item.price <= 0 ||
            !["DRINK", "DESSERT"].includes(item.category);

          return sum + (isAyceFood ? 0 : item.qty * item.price);
        }, 0)
      )
    : 0;

  const regularCartSubtotal = roundMoney(
    cart.reduce(
      (sum, item) =>
        sum + item.qty * item.price,
      0
    )
  );

  const subtotal = ayceSession
    ? roundMoney(aycePackageTotal + ayceOrderSubtotal)
    : regularCartSubtotal;

  const disc = roundMoney(
    Math.min(
      subtotal,
      Math.max(
        0,
        Number(discount || 0)
      )
    )
  );

  const taxable = roundMoney(
    Math.max(0, subtotal - disc)
  );

  const serviceCharge = isGangnam
    ? roundMoney(taxable * 0.05)
    : 0;

  const ppn = isGangnam
    ? roundMoney(
        (taxable + serviceCharge) * 0.11
      )
    : 0;

  const total = roundMoney(
    Math.max(
      0,
      taxable +
        serviceCharge +
        ppn
    )
  );

  const paidN = roundMoney(
    Math.max(0, Number(paid || 0))
  );

  const change = roundMoney(
    Math.max(0, paidN - total)
  );

  const itemCount = cart.reduce(
    (sum, item) => sum + item.qty,
    0
  );

  const missingBomCount = cart.filter(
    (item) =>
      !item.bomReady ||
      !item.recipeId
  ).length;

  const displayCategories =
    useMemo<Category[]>(() => {
      if (isGangnam) {
        return gangnamCategories;
      }

      const keys = Array.from(
        new Set(
          menus
            .map((menu) =>
              String(
                menu.category || ""
              ).trim()
            )
            .filter(Boolean)
        )
      ).slice(0, 7);

      return [
        {
          key: "ALL",
          label: "SEMUA",
          icon: Grid2X2,
        },
        ...keys.map((key) => ({
          key,
          label: key.toUpperCase(),
          icon: Utensils,
        })),
      ];
    }, [isGangnam, menus]);

  function selectQuickPackage(pkg: QuickPackage) {
    setSelectedPackage(pkg.key);

    const packageWords = normalize(pkg.label)
      .replace(/^paket\s+/, "")
      .trim();

    const candidates = menus.filter((menu) => {
      const name = normalize(menu.name);
      const code = normalize(menu.code);
      const label = normalize(pkg.label);
      return (
        name === label ||
        name.includes(label) ||
        label.includes(name) ||
        (packageWords.length > 3 && name.includes(packageWords)) ||
        (code && code === normalize(pkg.key))
      );
    });

    const target = candidates[0];

    if (target) {
      add(target);
      return;
    }

    // Package button remains useful even when the package has not yet
    // been connected to a Menu record: show matching items for the cashier.
    setSearch(pkg.label);
    setCategory("ALL");
  }

  function add(menu: MenuItem) {
    if (!menu.menuId) {
      alert(
        `${menu.name} belum memiliki menuId yang valid.`
      );
      return;
    }

    if (ayceSession && ayceExpired) {
      alert("Waktu AYCE sudah habis. Tutup session atau buat session baru.");
      return;
    }

    if (
      !Number.isFinite(
        Number(menu.stock)
      ) ||
      Number(menu.stock) <= 0
    ) {
      alert(`${menu.name} sedang habis.`);
      return;
    }

    setCart((current) => {
      const found = current.find(
        (item) =>
          item.menuId === menu.menuId
      );

      if (found) {
        if (
          found.qty >=
          Number(menu.stock)
        ) {
          alert(
            `Qty ${menu.name} sudah mencapai stock ${menu.stock}.`
          );

          return current;
        }

        return current.map((item) =>
          item.menuId === menu.menuId
            ? {
                ...item,
                qty: Math.min(
                  item.qty + 1,
                  Number(menu.stock)
                ),
                stock: Number(
                  menu.stock
                ),
                bomReady:
                  Boolean(
                    menu.bomReady
                  ),
                recipeId:
                  menu.recipeId ??
                  null,
              }
            : item
        );
      }

      return [
        ...current,
        {
          menuId: menu.menuId,
          code: menu.code,
          name: menu.name,
          qty: 1,
          stock: Number(menu.stock),
          price: Number(
            menu.price || 0
          ),
          category: categoryKey(
            menu.category,
            menu.name
          ),
          bomReady:
            Boolean(menu.bomReady),
          recipeId:
            menu.recipeId ?? null,
        },
      ];
    });
  }

  function changeQty(
    menuId: number,
    delta: number
  ) {
    setCart((current) =>
      current
        .map((item) =>
          item.menuId === menuId
            ? {
                ...item,
                qty: Math.max(
                  0,
                  Math.min(
                    item.stock,
                    item.qty + delta
                  )
                ),
              }
            : item
        )
        .filter(
          (item) => item.qty > 0
        )
    );
  }

  function removeItem(menuId: number) {
    setCart((current) =>
      current.filter(
        (item) =>
          item.menuId !== menuId
      )
    );
  }

  function clearCart() {
    setCart([]);
    setDiscount("");
    setPaid("");
    setCustomerName("");
    setNote("");
    setSelectedPackage("");
  }

  function scanOrSearch() {
    const q = normalize(search);

    if (!q) return;

    const exact = menus.find(
      (menu) =>
        normalize(menu.code) === q
    );

    const exactName = menus.find(
      (menu) =>
        normalize(menu.name) === q
    );

    const target =
      exact || exactName;

    if (target) {
      add(target);
      setSearch("");
      return;
    }

    alert(
      "Menu / kode menu tidak ditemukan."
    );
  }

  function saveHold() {
    if (!cart.length) {
      alert(
        "Keranjang masih kosong."
      );
      return;
    }

    if (!outletId) {
      alert(
        "Pilih outlet terlebih dahulu."
      );
      return;
    }

    const next: HoldOrder = {
      id: `HOLD-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      createdAt:
        new Date().toISOString(),
      outletId,
      customerName,
      discount,
      paymentMethod,
      note,
      cart,
    };

    persistHolds(
      [next, ...holds].slice(
        0,
        100
      )
    );

    clearCart();
    setPayOpen(false);
    setMobileCartOpen(false);

    alert(
      `Transaksi ${next.id} berhasil di-HOLD.`
    );
  }

  function resumeHold(id: string) {
    const found = holds.find(
      (item) => item.id === id
    );

    if (!found) return;

    if (
      String(found.outletId) !==
      String(outletId)
    ) {
      alert(
        "HOLD ini berasal dari outlet yang berbeda."
      );
      return;
    }

    if (
      cart.length &&
      !confirm(
        "Keranjang aktif akan diganti. Lanjutkan HOLD?"
      )
    ) {
      return;
    }

    setCart(found.cart);
    setCustomerName(
      found.customerName || ""
    );
    setDiscount(
      found.discount || ""
    );
    setPaymentMethod(
      found.paymentMethod ||
        "CASH"
    );
    setNote(found.note || "");

    persistHolds(
      holds.filter(
        (item) => item.id !== id
      )
    );

    setHoldOpen(false);
    setMobileCartOpen(true);
  }

  function deleteHold(id: string) {
    if (
      !confirm(
        "Hapus transaksi HOLD ini?"
      )
    ) {
      return;
    }

    persistHolds(
      holds.filter(
        (item) => item.id !== id
      )
    );
  }

  async function checkout() {
    if (!cart.length) {
      return alert(
        "Keranjang masih kosong."
      );
    }

    if (!outletId) {
      return alert(
        "Pilih outlet terlebih dahulu."
      );
    }

    if (missingBomCount) {
      alert(
        `Transaksi belum bisa diproses karena ${missingBomCount} menu belum memiliki BOM/Recipe.`
      );

      return;
    }

    if (ayceSession && ayceExpired) {
      return alert(
        "Waktu AYCE sudah habis. Silakan tutup session sebelum checkout."
      );
    }

    if (total <= 0) {
      return alert(
        "Total transaksi harus lebih dari 0."
      );
    }

    if (paidN < total) {
      return alert(
        `Pembayaran kurang ${money(
          total - paidN
        )}.`
      );
    }

    try {
      setSaving(true);

      const response = await fetch(
        "/api/outlet/pos",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            outletId:
              Number(outletId),
            customerName:
              customerName.trim() ||
              null,
            discount: disc,
            paidAmount: paidN,
            paymentMethod,
            note:
              note.trim() ||
              null,

            // Backward-compatible AYCE metadata.
            // API POS lama boleh mengabaikan field ini, sedangkan API yang
            // sudah mendukung AYCE dapat menyimpan session/pax/package/consumption.
            ayce: ayceSession
              ? {
                  enabled: true,
                  sessionId: ayceSession.id,
                  tableName: ayceSession.tableName,
                  pax: ayceSession.pax,
                  packageKey: ayceSession.packageKey,
                  packageName: ayceSession.packageName,
                  packagePrice: ayceSession.packagePrice,
                  durationMinutes: ayceSession.durationMinutes,
                  startedAt: ayceSession.startedAt,
                  expiresAt: ayceSession.expiresAt,
                }
              : null,
            consumption: ayceSession
              ? cart.map((item) => ({
                  menuId: item.menuId,
                  qty: item.qty,
                  unitPrice: 0,
                  outletId: Number(outletId),
                }))
              : [],
            items: cart.map(
              (item) => ({
                menuId:
                  item.menuId,
                qty: item.qty,
              })
            ),
          }),
        }
      );

      const json =
        await response
          .json()
          .catch(() => ({}));

      if (
        !response.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
            "Gagal menyimpan transaksi."
        );
      }

      const sale =
        json.data || null;

      setLastSale(sale);
      setReceiptSale(sale);
      setPayOpen(false);

      if (ayceSession) {
        recordAyceConsumption(cart);
      }

      clearCart();

      await load(outletId);

      alert(
        `${
          json.message ||
          "Transaksi berhasil."
        }\nKembalian: ${money(
          sale?.changeAmount ??
            change
        )}`
      );

      if (sale) {
        setReceiptOpen(true);
      }
    } catch (e: any) {
      alert(
        e?.message ||
          "Gagal menyimpan transaksi."
      );
    } finally {
      setSaving(false);
    }
  }

  function openReceipt(
    sale: Sale | null
  ) {
    if (!sale) {
      alert(
        "Belum ada transaksi untuk dicetak."
      );

      return;
    }

    setReceiptSale(sale);
    setReceiptOpen(true);
  }

  function printReceipt() {
    window.print();
  }

  const filteredSales =
    useMemo(() => {
      const q =
        normalize(historySearch);

      return sales.filter(
        (sale) => {
          if (!q) return true;

          return normalize(
            `${sale.number} ${
              sale.customerName ||
              ""
            } ${
              sale.paymentMethod
            }`
          ).includes(q);
        }
      );
    }, [sales, historySearch]);

  const theme = isGangnam
    ? "gangnam"
    : "generic";

  const isDark = theme === "gangnam";

  const activeHolds = holds.filter(
    (h) =>
      String(h.outletId) ===
      String(outletId)
  );

  async function logout() {
    if (!confirm("Yakin ingin logout dari POS?")) return;

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Gagal logout.");
      }

      router.push("/login");
      router.refresh();
    } catch (e: any) {
      alert(e?.message || "Gagal logout.");
    }
  }

  /*
   * =========================================================
   * CART PANEL
   * =========================================================
   */

  const cartPanel = (
    <aside
      className={`flex w-full min-h-0 shrink-0 flex-col overflow-hidden rounded-[24px] border shadow-2xl ${
        isDark
          ? "border-white/[0.08] bg-[#0b0f0e] text-white shadow-black/30"
          : "border-slate-200 bg-white text-slate-900 shadow-slate-200/70"
      } xl:w-[460px]`}
    >
      {/* CART HEADER */}
      <div
        className={`relative overflow-hidden border-b px-5 py-4 ${
          isDark
            ? "border-white/[0.07] bg-gradient-to-br from-[#12362d] via-[#0b1714] to-[#070d0b]"
            : "border-slate-100 bg-gradient-to-br from-[#18352D] via-[#23483e] to-[#315f52] text-white"
        }`}
      >
        <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10">
              <ShoppingCart className="h-5 w-5 text-emerald-300" />
            </div>

            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-emerald-300/70">
                Current Order
              </div>

              <div className="mt-0.5 text-base font-black tracking-tight">
                KERANJANG
              </div>
            </div>

            {itemCount > 0 && (
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black text-emerald-300">
                {itemCount} ITEM
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={clearCart}
            disabled={!cart.length}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-400 transition hover:border-red-400/30 hover:bg-red-400/10 hover:text-red-300 disabled:opacity-30"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* BOM WARNING */}
      {missingBomCount > 0 && (
        <div className="border-b border-amber-500/10 bg-amber-500/[0.07] px-5 py-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />

            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                {missingBomCount} menu belum siap
              </div>

              <div className="mt-0.5 text-[9px] leading-relaxed text-amber-200/50">
                Checkout akan ditolak sampai BOM / Recipe tersedia.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TABLE HEADER */}
      <div
        className={`grid grid-cols-[1fr_76px_70px_80px_18px] gap-2 border-b px-4 py-3 text-[8px] font-black uppercase tracking-wider ${
          isDark
            ? "border-white/[0.06] text-slate-600"
            : "border-slate-100 text-slate-400"
        }`}
      >
        <span>Item</span>
        <span className="text-center">
          Qty
        </span>
        <span className="text-right">
          Harga
        </span>
        <span className="text-right">
          Total
        </span>
        <span />
      </div>

      {/* CART ITEMS */}
      <div className="min-h-0 flex-1 overflow-auto px-3">
        {cart.length ? (
          cart.map((item) => (
            <div
              key={item.menuId}
              className={`grid grid-cols-[1fr_76px_70px_80px_18px] items-center gap-2 border-b py-3.5 ${
                isDark
                  ? "border-white/[0.055]"
                  : "border-slate-100"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${
                      isDark
                        ? "border border-white/[0.06] bg-white/[0.04]"
                        : "border border-slate-100 bg-slate-50"
                    }`}
                  >
                    {foodEmoji(
                      item.category
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="line-clamp-2 text-[9px] font-black uppercase leading-tight">
                      {item.name}
                    </div>

                    <div className="mt-0.5 text-[8px] text-slate-500">
                      {item.code}
                    </div>

                    <div
                      className={`mt-1 flex items-center gap-1 text-[7px] font-black uppercase ${
                        item.bomReady &&
                        item.recipeId
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }`}
                    >
                      {item.bomReady &&
                      item.recipeId ? (
                        <>
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          BOM READY
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-2.5 w-2.5" />
                          BOM BELUM ADA
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={`flex items-center justify-center gap-1 rounded-xl border px-1 py-1 ${
                  isDark
                    ? "border-white/[0.08] bg-white/[0.025]"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    changeQty(
                      item.menuId,
                      -1
                    )
                  }
                  className="flex h-5 w-5 items-center justify-center rounded-md transition hover:bg-emerald-400/10 hover:text-emerald-400"
                >
                  <Minus className="h-3 w-3" />
                </button>

                <span className="min-w-5 text-center text-[10px] font-black tabular-nums">
                  {item.qty}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    changeQty(
                      item.menuId,
                      1
                    )
                  }
                  disabled={
                    item.qty >=
                    item.stock
                  }
                  className="flex h-5 w-5 items-center justify-center rounded-md transition hover:bg-emerald-400/10 hover:text-emerald-400 disabled:opacity-20"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              <div className="text-right text-[9px] text-slate-500">
                {ayceSession &&
                (!["DRINK", "DESSERT"].includes(item.category) ||
                  item.price <= 0) ? (
                  <span className="font-black text-red-400">AYCE</span>
                ) : (
                  money(item.price)
                )}
              </div>

              <div className="text-right text-[10px] font-black tabular-nums">
                {ayceSession &&
                (!["DRINK", "DESSERT"].includes(item.category) ||
                  item.price <= 0)
                  ? money(0)
                  : money(
                      item.qty *
                        item.price
                    )}
              </div>

              <button
                type="button"
                onClick={() =>
                  removeItem(
                    item.menuId
                  )
                }
                className="flex justify-end text-slate-500 transition hover:text-red-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        ) : (
          <div className="flex h-full min-h-[220px] items-center justify-center">
            <div className="text-center">
              <div
                className={`mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border ${
                  isDark
                    ? "border-white/[0.06] bg-white/[0.025]"
                    : "border-slate-100 bg-slate-50"
                }`}
              >
                <ShoppingCart className="h-8 w-8 text-slate-600" />
              </div>

              <div className="mt-4 text-xs font-bold text-slate-500">
                Keranjang masih kosong
              </div>

              <div className="mt-1 text-[9px] text-slate-600">
                Pilih menu untuk memulai transaksi
              </div>
            </div>
          </div>
        )}
      </div>

      {/* GANGNAM INFO */}
      {isGangnam && (
        <div className="border-t border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-3 rounded-xl border border-red-500/10 bg-red-500/[0.045] p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10">
              <Clock3 className="h-4 w-4 text-red-400" />
            </div>

            <div>
              <div className="text-[9px] font-black uppercase tracking-wider">
                All You Can Eat
              </div>

              <div className="mt-0.5 text-[8px] text-slate-500">
                Durasi layanan{" "}
                <b className="text-red-400">
                  100 menit
                </b>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUMMARY */}
      <div
        className={`border-t p-4 ${
          isDark
            ? "border-white/[0.06]"
            : "border-slate-100"
        }`}
      >
        <div className="space-y-2">
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">
              {ayceSession ? "Paket + Add-on" : "Subtotal"}
            </span>
            <b>{money(subtotal)}</b>
          </div>

          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">
              Service Charge
            </span>
            <b>{money(serviceCharge)}</b>
          </div>

          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">
              PPN
            </span>
            <b>{money(ppn)}</b>
          </div>

          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">
              Diskon
            </span>
            <b className="text-red-400">
              - {money(disc)}
            </b>
          </div>
        </div>

        <div
          className={`mt-4 rounded-2xl border p-4 ${
            isDark
              ? "border-emerald-400/10 bg-emerald-400/[0.045]"
              : "border-emerald-100 bg-emerald-50"
          }`}
        >
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Grand Total
              </div>

              <div
                className={`mt-1 text-[9px] ${
                  isDark
                    ? "text-slate-600"
                    : "text-slate-400"
                }`}
              >
                {itemCount} item dalam order
              </div>
            </div>

            <div className="text-right">
              <div className="text-xl font-black tracking-tight text-emerald-400">
                {money(total)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="grid grid-cols-4 gap-1.5 px-4 pb-3">
        {[
          {
            label: "HOLD",
            icon: Bookmark,
            action: saveHold,
            disabled: !cart.length,
          },
          {
            label: "AMBIL",
            icon: Play,
            action: () =>
              setHoldOpen(true),
            disabled: false,
          },
          {
            label: "NOTA",
            icon: ReceiptText,
            action: () =>
              openReceipt(lastSale),
            disabled: false,
          },
          {
            label: "CATATAN",
            icon: FileText,
            action: () =>
              setNoteOpen(true),
            disabled: false,
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              disabled={item.disabled}
              className={`rounded-xl border py-2.5 transition ${
                isDark
                  ? "border-white/[0.06] bg-white/[0.025] text-slate-400 hover:border-emerald-400/20 hover:bg-emerald-400/[0.05] hover:text-emerald-300"
                  : "border-slate-100 bg-slate-50 text-slate-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600"
              } disabled:opacity-20`}
            >
              <Icon className="mx-auto mb-1 h-4 w-4" />

              <span className="text-[7px] font-black uppercase tracking-wider">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* PAY BUTTON */}
      <button
        type="button"
        onClick={() =>
          setPayOpen(true)
        }
        disabled={
          !cart.length ||
          !outletId
        }
        className="group relative mx-4 mb-4 overflow-hidden rounded-[20px] bg-gradient-to-r from-[#497F70] via-emerald-500 to-teal-400 px-5 py-4 text-left text-slate-950 shadow-[0_12px_35px_rgba(16,185,129,0.18)] transition hover:shadow-[0_16px_45px_rgba(16,185,129,0.28)] disabled:cursor-not-allowed disabled:opacity-25"
      >
        <div className="absolute inset-0 bg-white/10 opacity-0 transition group-hover:opacity-100" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/10">
              <WalletCards className="h-5 w-5" />
            </div>

            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.18em] opacity-60">
                Ready to checkout
              </div>

              <div className="mt-0.5 text-sm font-black">
                BAYAR SEKARANG
              </div>
            </div>
          </div>

          <ChevronRight className="h-5 w-5" />
        </div>
      </button>
    </aside>
  );

  if (!portalReady) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[2147483647] flex min-h-screen flex-col overflow-hidden ${
        isDark
          ? "bg-[#050907] text-white"
          : "bg-[#f3f6f5] text-slate-900"
      }`}
    >
      {/* BACKGROUND GLOW */}
      {isDark && (
        <>
          <div className="pointer-events-none fixed -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-emerald-500/[0.035] blur-[120px]" />
          <div className="pointer-events-none fixed -bottom-60 right-0 h-[600px] w-[600px] rounded-full bg-teal-500/[0.025] blur-[140px]" />
        </>
      )}

      {/* ERROR */}
      {error && (
        <div className="absolute left-1/2 top-4 z-[300] flex -translate-x-1/2 items-center gap-2 rounded-xl border border-red-400/20 bg-red-950/95 px-4 py-2.5 text-xs font-semibold text-red-100 shadow-2xl backdrop-blur-xl">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          {error}
        </div>
      )}

      {/* =====================================================
          HEADER
      ====================================================== */}
      <header
        className={`relative z-20 flex h-[78px] shrink-0 items-center gap-4 border-b px-4 lg:px-5 ${
          isDark
            ? "border-white/[0.06] bg-[#07100d]/95 backdrop-blur-2xl"
            : "border-slate-200/80 bg-white/95 backdrop-blur-2xl"
        }`}
      >
        {/* MENU
            User kasir / OUTLET_ADMIN tidak memiliki akses ke menu ERP.
            Tombol garis tiga tidak dirender untuk role kasir.
            Role selain kasir tetap melihat tombol kembali seperti sebelumnya.
        */}
        {role !== "OUTLET_ADMIN" &&
          role !== "KASIR" &&
          role !== "CASHIER" && (
            <button
              type="button"
              onClick={() =>
                window.history.back()
              }
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition ${
                isDark
                  ? "border-white/[0.08] bg-white/[0.025] text-slate-400 hover:border-emerald-400/20 hover:text-emerald-300"
                  : "border-slate-200 bg-slate-50 text-slate-500 hover:border-emerald-200 hover:text-emerald-600"
              }`}
              title="Kembali"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
          )}

        {/* BRAND */}
        <div className="hidden w-[225px] shrink-0 sm:block">
          {isGangnam ? (
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.28em] text-red-400">
                강남
              </div>

              <div className="text-xl font-black tracking-tight">
                Gangnam BBQ
              </div>

              <div className="text-[7px] font-semibold tracking-[0.25em] text-slate-500">
                KOREAN GRILL RESTAURANT
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/10">
                  <ShoppingCart className="h-4 w-4 text-emerald-400" />
                </div>

                <div>
                  <div className="text-base font-black tracking-tight">
                    MGB POS
                  </div>

                  <div className="text-[7px] font-bold uppercase tracking-[0.25em] text-slate-500">
                    Outlet Cashier
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CENTER BRAND INFO */}
        {isGangnam && (
          <div className="hidden flex-1 text-center lg:block">
            <div className="text-[8px] font-bold uppercase tracking-[0.35em] text-slate-500">
              ALL YOU CAN EAT
            </div>

            <div className="mt-0.5 text-2xl font-black tracking-tight">
              199k
              <span className="ml-0.5 text-xs align-top text-red-400">
                ++
              </span>
            </div>
          </div>
        )}

        {/* RIGHT HEADER */}
        <div className="ml-auto flex items-center gap-2.5">
          {/* OUTLET */}
          {role !== "OUTLET_ADMIN" ? (
            <div
              className={`hidden min-w-[190px] items-center gap-3 rounded-2xl border px-3.5 py-2.5 md:flex ${
                isDark
                  ? "border-white/[0.08] bg-white/[0.025]"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/10">
                <Landmark className="h-4 w-4 text-emerald-400" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[7px] font-bold uppercase tracking-wider text-slate-500">
                  Outlet
                </div>

                <select
                  value={outletId}
                  onChange={(event) =>
                    setOutletId(
                      event.target.value
                    )
                  }
                  className={`w-full truncate bg-transparent text-[10px] font-black outline-none ${
                    isDark
                      ? "text-white"
                      : "text-slate-900"
                  }`}
                >
                  <option value="">
                    Pilih Outlet
                  </option>

                  {outlets.map(
                    (outlet) => (
                      <option
                        key={outlet.id}
                        value={
                          outlet.id
                        }
                      >
                        {outlet.name}
                      </option>
                    )
                  )}
                </select>
              </div>

              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            </div>
          ) : (
            <div
              className={`hidden min-w-[170px] rounded-2xl border px-3.5 py-2.5 md:block ${
                isDark
                  ? "border-white/[0.08] bg-white/[0.025]"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="text-[7px] font-bold uppercase tracking-wider text-slate-500">
                Outlet Aktif
              </div>

              <div className="mt-0.5 truncate text-[10px] font-black">
                {selectedOutlet?.name ||
                  "Outlet"}
              </div>
            </div>
          )}

          {/* CASHIER */}
          <div
            className={`hidden items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 md:flex ${
              isDark
                ? "border-white/[0.08] bg-white/[0.025]"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/10">
              <UserCircle2 className="h-4 w-4 text-emerald-400" />
            </div>

            <div>
              <div className="text-[7px] font-bold uppercase tracking-wider text-slate-500">
                Kasir
              </div>

              <div className="max-w-[120px] truncate text-[10px] font-black">
                {cashier ||
                  "Admin Outlet"}
              </div>
            </div>
          </div>

          {/* CLOCK */}
          <div
            className={`hidden min-w-[78px] rounded-2xl border px-3 py-2.5 text-center sm:block ${
              isDark
                ? "border-white/[0.08] bg-white/[0.025]"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-50" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>

              <span className="text-[7px] font-bold uppercase tracking-wider text-slate-500">
                Live
              </span>
            </div>

            <div className="mt-0.5 text-xs font-black tabular-nums">
              {clock.toLocaleTimeString(
                "id-ID",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                }
              )}
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================
          MAIN POS
      ====================================================== */}
      <main className="relative z-10 flex min-h-0 flex-1 gap-3 p-3 lg:p-3.5">
        {/* CATEGORY SIDEBAR */}
        <aside
          className={`hidden w-[104px] shrink-0 flex-col gap-1.5 overflow-auto rounded-[22px] border p-2 md:flex ${
            isDark
              ? "border-white/[0.06] bg-[#09110e]/90"
              : "border-slate-200 bg-white"
          }`}
        >
          <div className="px-1 pb-2 pt-1 text-center">
            <div className="text-[7px] font-black uppercase tracking-[0.2em] text-slate-500">
              Kategori
            </div>
          </div>

          {displayCategories.map(
            (item) => {
              const Icon =
                item.icon;

              const active =
                category ===
                item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    setCategory(
                      item.key
                    )
                  }
                  className={`group relative flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 text-[8px] font-black uppercase tracking-wide transition ${
                    active
                      ? isGangnam
                        ? "border-red-400/20 bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-xl shadow-red-900/20"
                        : "border-emerald-400/20 bg-gradient-to-br from-[#497F70] to-[#315f52] text-white shadow-xl shadow-emerald-900/10"
                      : isDark
                      ? "border-transparent bg-white/[0.018] text-slate-500 hover:border-white/[0.07] hover:bg-white/[0.04] hover:text-slate-200"
                      : "border-transparent bg-slate-50 text-slate-500 hover:border-slate-200 hover:bg-white"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 transition ${
                      active
                        ? "scale-110"
                        : "group-hover:scale-105"
                    }`}
                  />

                  <span>
                    {item.label}
                  </span>

                  {active && (
                    <span className="absolute bottom-1.5 h-0.5 w-4 rounded-full bg-current opacity-60" />
                  )}
                </button>
              );
            }
          )}

          {isGangnam && (
            <div className="mt-auto rounded-xl border border-red-500/10 bg-red-500/[0.045] p-2.5 text-center">
              <div className="text-[6px] font-bold uppercase tracking-wider text-red-300/60">
                AYCE
              </div>

              <div className="mt-1 text-base font-black">
                199k
              </div>

              <div className="text-[7px] text-slate-500">
                ++ / orang
              </div>

              <div className="mt-1 text-[7px] font-bold text-red-400">
                100 MIN
              </div>
            </div>
          )}
        </aside>

        {/* CENTER */}
        <section className="flex min-w-0 flex-1 flex-col gap-3">
          {/* SEARCH / TOOLBAR */}
          <div className="flex shrink-0 gap-2">
            <div
              className={`group relative flex min-w-0 flex-1 items-center rounded-[18px] border transition ${
                isDark
                  ? "border-white/[0.07] bg-[#0a120f] focus-within:border-emerald-400/20"
                  : "border-slate-200 bg-white focus-within:border-emerald-300"
              }`}
            >
              <Search className="ml-4 h-4 w-4 shrink-0 text-slate-500 transition group-focus-within:text-emerald-400" />

              <input
                ref={searchRef}
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                onKeyDown={(event) =>
                  event.key ===
                    "Enter" &&
                  scanOrSearch()
                }
                placeholder="Cari menu atau scan kode..."
                className={`w-full bg-transparent px-3 py-3.5 text-xs font-semibold outline-none ${
                  isDark
                    ? "text-white placeholder:text-slate-600"
                    : "text-slate-900 placeholder:text-slate-400"
                }`}
              />

              <button
                type="button"
                onClick={
                  scanOrSearch
                }
                className={`mr-2 flex h-8 w-8 items-center justify-center rounded-lg transition ${
                  isDark
                    ? "bg-white/[0.04] text-slate-500 hover:bg-emerald-400/10 hover:text-emerald-300"
                    : "bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"
                }`}
                title="Cari kode menu"
              >
                <ScanLine className="h-4 w-4" />
              </button>
            </div>

            {/* HISTORY */}
            <button
              type="button"
              onClick={() =>
                setHistoryOpen(true)
              }
              className={`hidden items-center gap-2 rounded-[18px] border px-4 text-[9px] font-black uppercase tracking-wider transition sm:flex ${
                isDark
                  ? "border-white/[0.07] bg-white/[0.025] text-slate-400 hover:border-emerald-400/20 hover:text-emerald-300"
                  : "border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:text-emerald-600"
              }`}
            >
              <History className="h-4 w-4" />
              Riwayat
            </button>

            {/* HOLD */}
            <button
              type="button"
              onClick={() =>
                setHoldOpen(true)
              }
              className={`hidden items-center gap-2 rounded-[18px] border px-4 text-[9px] font-black uppercase tracking-wider transition lg:flex ${
                isDark
                  ? "border-white/[0.07] bg-white/[0.025] text-slate-400 hover:border-emerald-400/20 hover:text-emerald-300"
                  : "border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:text-emerald-600"
              }`}
            >
              <Bookmark className="h-4 w-4" />

              Hold

              {activeHolds.length >
                0 && (
                <span className="rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[7px] text-amber-400">
                  {activeHolds.length}
                </span>
              )}
            </button>

            {/* VIEW */}
            <div
              className={`hidden overflow-hidden rounded-2xl border sm:flex ${
                isDark
                  ? "border-white/[0.07] bg-[#0a120f]"
                  : "border-slate-200 bg-white"
              }`}
            >
              <button
                type="button"
                onClick={() =>
                  setView(
                    "GRID"
                  )
                }
                className={`flex items-center gap-1.5 px-3 text-[8px] font-black uppercase tracking-wider transition ${
                  view === "GRID"
                    ? isDark
                      ? "bg-emerald-400 text-slate-950"
                      : "bg-emerald-500 text-white"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Grid2X2 className="h-3.5 w-3.5" />
                Grid
              </button>

              <button
                type="button"
                onClick={() =>
                  setView(
                    "LIST"
                  )
                }
                className={`flex items-center gap-1.5 px-3 text-[8px] font-black uppercase tracking-wider transition ${
                  view === "LIST"
                    ? isDark
                      ? "bg-emerald-400 text-slate-950"
                      : "bg-emerald-500 text-white"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <List className="h-3.5 w-3.5" />
                List
              </button>
            </div>
          </div>

          {/* =====================================================
              PACKAGE / QUICK ORDER BOARD
              ====================================================== */}
          {isGangnam && (
            <section
              className={`shrink-0 overflow-hidden rounded-[24px] border ${
                isDark
                  ? "border-white/[0.07] bg-[#09110f] shadow-[0_18px_60px_rgba(0,0,0,0.22)]"
                  : "border-slate-200 bg-white shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/20 to-orange-400/10 ring-1 ring-red-400/10">
                    <Sparkles className="h-4 w-4 text-red-300" />
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />
                  </div>
                  <div>
                    <div className="text-[7px] font-black uppercase tracking-[0.28em] text-red-300/70">
                      Quick Service
                    </div>
                    <div className="mt-0.5 text-xs font-black tracking-tight">
                      PILIHAN PAKET
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="hidden rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[6px] font-bold uppercase tracking-wider text-slate-500 sm:inline-flex">
                    Tap untuk pilih
                  </span>
                  <span className="rounded-full border border-red-400/15 bg-red-500/[0.06] px-2.5 py-1 text-[7px] font-black uppercase tracking-wider text-red-300">
                    {ayceSession
                      ? `SESSION • ${formatDuration(ayceRemainingSeconds)}`
                      : "AYCE • 100 MIN"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 p-2 sm:grid-cols-4 xl:grid-cols-7">
                {gangnamPackages.map((pkg, index) => {
                  const active = selectedPackage === pkg.key;
                  const linkedMenu = menus.find((menu) => {
                    const name = normalize(menu.name);
                    const label = normalize(pkg.label);
                    const words = label.replace(/^paket\s+/, "").trim();
                    return (
                      name === label ||
                      name.includes(label) ||
                      label.includes(name) ||
                      (words.length > 3 && name.includes(words))
                    );
                  });

                  const gradients = [
                    "from-red-600 via-red-500 to-rose-500",
                    "from-orange-600 via-orange-500 to-amber-400",
                    "from-lime-500 via-emerald-500 to-green-500",
                    "from-amber-500 via-yellow-500 to-orange-400",
                    "from-blue-700 via-blue-600 to-sky-500",
                    "from-violet-700 via-violet-600 to-purple-500",
                    "from-rose-700 via-rose-600 to-pink-500",
                    "from-sky-700 via-sky-600 to-cyan-500",
                    "from-slate-700 via-slate-600 to-slate-500",
                    "from-emerald-700 via-emerald-600 to-teal-500",
                    "from-cyan-700 via-cyan-600 to-sky-500",
                    "from-stone-700 via-stone-600 to-zinc-500",
                    "from-red-700 via-red-600 to-orange-500",
                    "from-orange-700 via-orange-600 to-red-500",
                  ];

                  return (
                    <button
                      key={pkg.key}
                      type="button"
                      onClick={() => selectQuickPackage(pkg)}
                      className={`group relative min-h-[68px] overflow-hidden rounded-[15px] border px-2.5 py-2 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-xl ${
                        active
                          ? "border-white/40 shadow-[0_0_0_2px_rgba(255,255,255,.08),0_14px_30px_rgba(0,0,0,.28)]"
                          : "border-white/[0.08] shadow-sm"
                      } bg-gradient-to-br ${gradients[index % gradients.length]}`}
                    >
                      <div className="absolute inset-0 bg-black/10 transition group-hover:bg-black/0" />
                      <div className="absolute -right-4 -top-5 h-14 w-14 rounded-full bg-white/10 blur-xl transition group-hover:bg-white/20" />

                      <div className="relative flex h-full flex-col justify-between">
                        <div className="flex items-start justify-between gap-2">
                          <span className="line-clamp-2 text-[8px] font-black uppercase leading-[1.15] tracking-tight text-white drop-shadow-sm">
                            {pkg.label}
                          </span>
                          {active && (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-white" />
                          )}
                        </div>

                        <div className="flex items-end justify-between gap-1">
                          <span className="truncate text-[6px] font-semibold uppercase tracking-wider text-white/65">
                            {linkedMenu ? "MENU TERHUBUNG" : pkg.subtitle}
                          </span>
                          {linkedMenu && (
                            <span className="shrink-0 text-[7px] font-black text-white">
                              {money(linkedMenu.price)}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedPackage && (
                <div className="flex items-center justify-between border-t border-white/[0.06] bg-white/[0.015] px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.8)]" />
                    <span className="truncate text-[7px] font-bold uppercase tracking-wider text-slate-500">
                      Paket dipilih:
                    </span>
                    <span className="truncate text-[8px] font-black text-white">
                      {gangnamPackages.find((pkg) => pkg.key === selectedPackage)?.label}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPackage("")}
                    className="rounded-lg px-2 py-1 text-[7px] font-black uppercase tracking-wider text-slate-500 transition hover:bg-white/[0.05] hover:text-white"
                  >
                    Reset
                  </button>
                </div>
              )}
            </section>
          )}

          {/* =====================================================
              AYCE SESSION BOARD
              Meja → Session → Pax → Paket → Timer → Consumption
              ====================================================== */}
          {isGangnam && (
            <section
              className={`shrink-0 overflow-hidden rounded-[24px] border ${
                isDark
                  ? "border-red-400/10 bg-[#0b1110]"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2.5 p-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      ayceSession
                        ? "bg-red-500/10 text-red-400"
                        : "bg-emerald-500/10 text-emerald-400"
                    }`}
                  >
                    <Clock3 className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="text-[7px] font-black uppercase tracking-[0.24em] text-slate-500">
                      AYCE SESSION
                    </div>

                    {ayceSession ? (
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-black">
                          MEJA {ayceSession.tableName}
                        </span>
                        <span className="rounded-full bg-red-500/10 px-2 py-1 text-[7px] font-black text-red-400">
                          {ayceSession.pax} PAX
                        </span>
                        <span className="rounded-full bg-white/[0.05] px-2 py-1 text-[7px] font-black text-slate-400">
                          {ayceSession.packageName}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-0.5 text-xs font-black">
                        Belum ada session meja
                      </div>
                    )}
                  </div>
                </div>

                {ayceSession ? (
                  <>
                    <div
                      className={`min-w-[125px] rounded-xl border px-3 py-2 text-center ${
                        ayceExpired
                          ? "border-red-400/20 bg-red-500/10"
                          : "border-emerald-400/15 bg-emerald-400/5"
                      }`}
                    >
                      <div className="text-[6px] font-black uppercase tracking-wider text-slate-500">
                        SISA WAKTU
                      </div>
                      <div
                        className={`mt-0.5 text-base font-black tabular-nums ${
                          ayceExpired ? "text-red-400" : "text-emerald-400"
                        }`}
                      >
                        {formatDuration(ayceRemainingSeconds)}
                      </div>
                    </div>

                    <div className="hidden rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 sm:block">
                      <div className="text-[6px] font-black uppercase tracking-wider text-slate-500">
                        CONSUMPTION
                      </div>
                      <div className="mt-0.5 text-sm font-black">
                        {ayceSession.consumptionCount} item
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAycePanelOpen(true)}
                      className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[7px] font-black uppercase tracking-wider text-slate-400 hover:text-white"
                    >
                      Session
                    </button>

                    <button
                      type="button"
                      onClick={closeAyceSession}
                      className="rounded-xl border border-red-400/10 bg-red-500/[0.06] px-3 py-2 text-[7px] font-black uppercase tracking-wider text-red-300"
                    >
                      Tutup
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAycePanelOpen(true)}
                    className="rounded-xl bg-red-600 px-4 py-2.5 text-[8px] font-black uppercase tracking-wider text-white shadow-lg shadow-red-900/20 hover:bg-red-500"
                  >
                    + BUKA SESSION AYCE
                  </button>
                )}
              </div>

              {ayceSession && (
                <div className="border-t border-white/[0.05] px-3 py-2">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[7px] text-slate-500">
                    <span>
                      Session: <b className="text-slate-300">{ayceSession.id}</b>
                    </span>
                    <span>
                      Paket:{" "}
                      <b className="text-slate-300">
                        {money(ayceSession.packagePrice)} / pax
                      </b>
                    </span>
                    <span>
                      Revenue paket:{" "}
                      <b className="text-red-300">
                        {money(aycePackageTotal)}
                      </b>
                    </span>
                    <span>
                      Consumption tersimpan:{" "}
                      <b className="text-emerald-300">
                        {consumptions.reduce((sum, item) => sum + item.qty, 0)}
                      </b>
                    </span>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* MENU AREA */}
          <div className="min-h-0 flex-1 overflow-auto pr-1">
            {loading ? (
              <div
                className={`flex h-full min-h-[400px] items-center justify-center rounded-[24px] border ${
                  isDark
                    ? "border-white/[0.06] bg-white/[0.015]"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="text-center">
                  <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-emerald-400/10 blur-xl" />

                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-400/10 border-t-emerald-400" />
                  </div>

                  <div className="mt-4 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400/70">
                    MGB POS
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    Memuat menu...
                  </div>
                </div>
              </div>
            ) : !outletId ? (
              <div
                className={`flex h-full min-h-[400px] items-center justify-center rounded-[22px] border border-dashed ${
                  isDark
                    ? "border-white/[0.08] bg-white/[0.012]"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="text-center">
                  <div
                    className={`mx-auto flex h-20 w-20 items-center justify-center rounded-3xl ${
                      isDark
                        ? "bg-emerald-400/[0.05]"
                        : "bg-emerald-50"
                    }`}
                  >
                    <Landmark className="h-8 w-8 text-emerald-400/60" />
                  </div>

                  <div className="mt-5 text-sm font-black">
                    Pilih outlet
                  </div>

                  <div className="mt-1 text-[10px] text-slate-500">
                    Pilih outlet terlebih dahulu untuk mulai kasir
                  </div>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-full min-h-[400px] items-center justify-center">
                <div className="text-center">
                  <div
                    className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${
                      isDark
                        ? "bg-white/[0.025]"
                        : "bg-slate-50"
                    }`}
                  >
                    <Search className="h-7 w-7 text-slate-500" />
                  </div>

                  <div className="mt-4 text-xs font-bold text-slate-500">
                    Menu tidak ditemukan
                  </div>

                  <div className="mt-1 text-[9px] text-slate-600">
                    Coba kata kunci atau kategori lain
                  </div>
                </div>
              </div>
            ) : view === "GRID" ? (
              <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {filtered.map(
                  (menu) => {
                    const cat =
                      categoryKey(
                        menu.category,
                        menu.name
                      );

                    const canAdd =
                      Boolean(
                        menu.menuId
                      ) &&
                      Number(
                        menu.stock
                      ) > 0;

                    const inCart =
                      cart.find(
                        (item) =>
                          item.menuId ===
                          menu.menuId
                      );

                    return (
                      <button
                        key={
                          menu.menuId ??
                          menu.id
                        }
                        type="button"
                        onClick={() =>
                          add(menu)
                        }
                        disabled={
                          !canAdd
                        }
                        className={`group relative overflow-hidden rounded-[24px] border text-left transition-all duration-300 ${
                          isDark
                            ? "border-white/[0.06] bg-[#0a120f] hover:-translate-y-0.5 hover:border-emerald-400/20 hover:bg-[#0c1713] hover:shadow-[0_22px_55px_rgba(0,0,0,0.32)]"
                            : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_22px_50px_rgba(15,23,42,0.12)]"
                        } disabled:cursor-not-allowed disabled:opacity-30`}
                      >
                        {/* IMAGE */}
                        <div
                          className={`relative flex h-[142px] items-center justify-center overflow-hidden ${
                            isDark
                              ? "bg-gradient-to-b from-white/[0.025] to-transparent"
                              : "bg-slate-50"
                          }`}
                        >
                          {menu.image ? (
                            <img
                              src={
                                menu.image
                              }
                              alt={
                                menu.name
                              }
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <>
                              <div className="absolute h-24 w-24 rounded-full bg-emerald-400/[0.035] blur-2xl" />

                              <div
                                className={`relative flex h-20 w-20 items-center justify-center rounded-3xl border text-4xl shadow-xl ${
                                  isDark
                                    ? "border-white/[0.07] bg-[#101a17]"
                                    : "border-slate-100 bg-white"
                                }`}
                              >
                                {foodEmoji(
                                  cat
                                )}
                              </div>
                            </>
                          )}

                          {/* STOCK BADGE */}
                          <div className="absolute right-2 top-2">
                            <span
                              className={`rounded-full border px-2 py-1 text-[7px] font-black uppercase backdrop-blur-md ${
                                Number(
                                  menu.stock
                                ) >
                                0
                                  ? isDark
                                    ? "border-emerald-400/15 bg-emerald-400/10 text-emerald-300"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-600"
                                  : "border-red-400/20 bg-red-500/10 text-red-400"
                              }`}
                            >
                              {Number(
                                menu.stock
                              ) >
                              0
                                ? `${menu.stock} STOCK`
                                : "HABIS"}
                            </span>
                          </div>

                          {/* CART QTY */}
                          {inCart && (
                            <div className="absolute left-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-lg bg-emerald-400 px-2 text-[9px] font-black text-slate-950 shadow-lg">
                              {inCart.qty}
                            </div>
                          )}
                        </div>

                        {/* CONTENT */}
                        <div className="p-3">
                          <div className="line-clamp-2 min-h-9 text-[10px] font-black uppercase leading-tight">
                            {menu.name}
                          </div>

                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="truncate text-[7px] font-bold uppercase tracking-wider text-slate-500">
                              {cat ===
                              "SIDE"
                                ? "SIDE DISH"
                                : cat}
                            </span>

                            <span
                              className={`flex items-center gap-1 text-[7px] font-black uppercase ${
                                menu.bomReady &&
                                menu.recipeId
                                  ? "text-emerald-400"
                                  : "text-amber-400"
                              }`}
                            >
                              {menu.bomReady &&
                              menu.recipeId ? (
                                <>
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                  READY
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  BOM
                                </>
                              )}
                            </span>
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-2">
                            <div>
                              <div className="text-[7px] font-bold uppercase tracking-wider text-slate-500">
                                Harga
                              </div>

                              <div
                                className={`mt-0.5 text-sm font-black ${
                                  isGangnam
                                    ? "text-red-400"
                                    : "text-emerald-500"
                                }`}
                              >
                                {money(
                                  menu.price
                                )}
                              </div>
                            </div>

                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                                canAdd
                                  ? isGangnam
                                    ? "border-red-400/20 bg-red-500 text-white group-hover:bg-red-400"
                                    : "border-emerald-400/20 bg-emerald-500 text-white group-hover:bg-emerald-400"
                                  : isDark
                                  ? "border-white/[0.06] bg-white/[0.025] text-slate-600"
                                  : "border-slate-100 bg-slate-50 text-slate-300"
                              }`}
                            >
                              <Plus className="h-4 w-4" />
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            ) : (
              <div
                className={`overflow-hidden rounded-[24px] border ${
                  isDark
                    ? "border-white/[0.06] bg-[#0a120f]"
                    : "border-slate-200 bg-white"
                }`}
              >
                <table className="w-full text-xs">
                  <thead
                    className={`sticky top-0 z-10 text-[8px] font-black uppercase tracking-wider ${
                      isDark
                        ? "bg-[#0b1512] text-slate-600"
                        : "bg-slate-50 text-slate-400"
                    }`}
                  >
                    <tr>
                      <th className="px-4 py-3 text-left">
                        Menu
                      </th>

                      <th className="px-4 py-3 text-left">
                        Kategori
                      </th>

                      <th className="px-4 py-3 text-right">
                        Stock
                      </th>

                      <th className="px-4 py-3 text-right">
                        BOM
                      </th>

                      <th className="px-4 py-3 text-right">
                        Harga
                      </th>

                      <th />
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.map(
                      (menu) => {
                        const cat =
                          categoryKey(
                            menu.category,
                            menu.name
                          );

                        const canAdd =
                          Boolean(
                            menu.menuId
                          ) &&
                          Number(
                            menu.stock
                          ) > 0;

                        return (
                          <tr
                            key={
                              menu.menuId ??
                              menu.id
                            }
                            className={`border-t transition ${
                              isDark
                                ? "border-white/[0.05] hover:bg-white/[0.02]"
                                : "border-slate-100 hover:bg-slate-50"
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                                    isDark
                                      ? "bg-white/[0.04]"
                                      : "bg-slate-50"
                                  }`}
                                >
                                  {foodEmoji(
                                    cat
                                  )}
                                </div>

                                <div>
                                  <div className="font-black">
                                    {
                                      menu.name
                                    }
                                  </div>

                                  <div className="mt-0.5 text-[8px] text-slate-500">
                                    {
                                      menu.code
                                    }
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3 text-[9px] text-slate-500">
                              {cat}
                            </td>

                            <td className="px-4 py-3 text-right font-bold">
                              {menu.stock}
                            </td>

                            <td className="px-4 py-3 text-right">
                              <span
                                className={
                                  menu.bomReady &&
                                  menu.recipeId
                                    ? "text-emerald-400"
                                    : "text-amber-400"
                                }
                              >
                                {menu.bomReady &&
                                menu.recipeId
                                  ? "READY"
                                  : "BELUM ADA"}
                              </span>
                            </td>

                            <td
                              className={`px-4 py-3 text-right font-black ${
                                isGangnam
                                  ? "text-red-400"
                                  : "text-emerald-500"
                              }`}
                            >
                              {money(
                                menu.price
                              )}
                            </td>

                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  add(
                                    menu
                                  )
                                }
                                disabled={
                                  !canAdd
                                }
                                className="rounded-lg bg-emerald-500 px-3 py-2 text-[8px] font-black uppercase text-white transition hover:bg-emerald-400 disabled:opacity-20"
                              >
                                Tambah
                              </button>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* DESKTOP CART */}
        <div className="hidden min-h-0 xl:flex">
          {cartPanel}
        </div>
      </main>

      {/* =====================================================
          MOBILE CART BUTTON
      ====================================================== */}
      <div className="fixed bottom-[72px] right-4 z-[90] xl:hidden">
        <button
          type="button"
          onClick={() =>
            setMobileCartOpen(
              true
            )
          }
          className="flex items-center gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-500 px-5 py-3.5 text-slate-950 shadow-[0_15px_40px_rgba(16,185,129,0.25)]"
        >
          <div className="relative">
            <ShoppingCart className="h-5 w-5" />

            {itemCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-950 px-1 text-[7px] font-black text-white">
                {itemCount}
              </span>
            )}
          </div>

          <div className="text-left">
            <div className="text-[7px] font-black uppercase tracking-wider opacity-60">
              Current order
            </div>

            <div className="text-xs font-black">
              {money(total)}
            </div>
          </div>

          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* =====================================================
          FOOTER
      ====================================================== */}
      <footer
        className={`relative z-20 flex h-[62px] shrink-0 items-center gap-2 border-t px-3 ${
          isDark
            ? "border-white/[0.06] bg-[#07100d]/95"
            : "border-slate-200 bg-white/95"
        }`}
      >
        <button
          type="button"
          onClick={() =>
            setHistoryOpen(true)
          }
          className={`hidden h-9 items-center gap-2 rounded-xl border px-4 text-[8px] font-black uppercase tracking-wider transition sm:flex ${
            isDark
              ? "border-white/[0.06] bg-white/[0.025] text-slate-500 hover:text-emerald-300"
              : "border-slate-200 bg-slate-50 text-slate-500 hover:text-emerald-600"
          }`}
        >
          <History className="h-3.5 w-3.5" />
          Transaksi Terakhir
        </button>

        <button
          type="button"
          onClick={() =>
            setHoldOpen(true)
          }
          className={`flex h-9 items-center gap-2 rounded-xl border px-4 text-[8px] font-black uppercase tracking-wider transition ${
            isDark
              ? "border-white/[0.06] bg-white/[0.025] text-slate-500 hover:text-emerald-300"
              : "border-slate-200 bg-slate-50 text-slate-500 hover:text-emerald-600"
          }`}
        >
          <Bookmark className="h-3.5 w-3.5" />

          Hold

          <span className="rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[7px] text-amber-400">
            {activeHolds.length}
          </span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              load(outletId)
            }
            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
              isDark
                ? "border-white/[0.06] bg-white/[0.025] text-slate-500 hover:text-emerald-300"
                : "border-slate-200 bg-white text-slate-500 hover:text-emerald-600"
            }`}
            title="Refresh"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                loading
                  ? "animate-spin"
                  : ""
              }`}
            />
          </button>

          {(role === "KASIR" || role === "CASHIER") && (
            <button
              type="button"
              onClick={logout}
              className={`flex h-9 items-center gap-2 rounded-xl border px-4 text-[8px] font-black uppercase tracking-wider transition ${
                isDark
                  ? "border-red-400/10 bg-red-500/[0.06] text-red-300 hover:border-red-400/20 hover:bg-red-500/10"
                  : "border-red-100 bg-red-50 text-red-500 hover:border-red-200 hover:bg-red-100"
              }`}
              title="Logout"
            >
              <CirclePower className="h-3.5 w-3.5" />
              Logout
            </button>
          )}
        </div>
      </footer>

      {/* =====================================================
          MOBILE CART MODAL
      ====================================================== */}
      {mobileCartOpen && (
        <div className="fixed inset-0 z-[110] flex items-end bg-black/75 backdrop-blur-sm xl:hidden">
          <div
            className={`max-h-[94vh] w-full overflow-auto rounded-t-[28px] border-t p-3 ${
              isDark
                ? "border-white/[0.08] bg-[#050907]"
                : "border-slate-200 bg-slate-100"
            }`}
          >
            <div className="mb-2 flex justify-center">
              <div className="h-1 w-10 rounded-full bg-slate-500/30" />
            </div>

            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() =>
                  setMobileCartOpen(
                    false
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-900 shadow"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {cartPanel}
          </div>
        </div>
      )}

      {/* =====================================================
          AYCE SESSION MODAL
          ====================================================== */}
      {aycePanelOpen && (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md">
          <div
            className={`w-full max-w-lg overflow-hidden rounded-[28px] border shadow-[0_30px_100px_rgba(0,0,0,0.5)] ${
              isDark
                ? "border-white/[0.08] bg-[#08100d] text-white"
                : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div
              className={`border-b p-5 ${
                isDark
                  ? "border-white/[0.06] bg-gradient-to-r from-red-950/30 to-transparent"
                  : "border-slate-100 bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
                    <Utensils className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <div className="text-[8px] font-black uppercase tracking-[0.22em] text-red-400/70">
                      Table Session
                    </div>
                    <div className="text-base font-black">
                      {ayceSession ? "SESSION AYCE AKTIF" : "BUKA SESSION AYCE"}
                    </div>
                    <div className="mt-0.5 text-[8px] text-slate-500">
                      Meja → Pax → Paket → Timer → Consumption
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAycePanelOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-slate-500 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4 p-5">
              {ayceSession ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <div className="text-[7px] font-black uppercase tracking-wider text-slate-500">
                        MEJA
                      </div>
                      <div className="mt-1 text-lg font-black">
                        {ayceSession.tableName}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <div className="text-[7px] font-black uppercase tracking-wider text-slate-500">
                        PAX
                      </div>
                      <div className="mt-1 text-lg font-black">
                        {ayceSession.pax} orang
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-red-400/10 bg-red-500/[0.05] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[7px] font-black uppercase tracking-wider text-slate-500">
                          PAKET
                        </div>
                        <div className="mt-1 text-sm font-black">
                          {ayceSession.packageName}
                        </div>
                        <div className="mt-1 text-[8px] text-slate-500">
                          {money(ayceSession.packagePrice)} × {ayceSession.pax}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[7px] font-black uppercase tracking-wider text-slate-500">
                          SISA
                        </div>
                        <div
                          className={`mt-1 text-xl font-black tabular-nums ${
                            ayceExpired ? "text-red-400" : "text-emerald-400"
                          }`}
                        >
                          {formatDuration(ayceRemainingSeconds)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-[7px] font-black uppercase tracking-wider text-slate-500">
                      Consumption
                    </div>
                    <div className="max-h-44 overflow-auto rounded-2xl border border-white/[0.06]">
                      {consumptions.length ? (
                        consumptions.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between border-b border-white/[0.05] px-3 py-2.5 last:border-b-0"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-[9px] font-black">
                                {entry.name}
                              </div>
                              <div className="text-[7px] text-slate-500">
                                {new Date(entry.orderedAt).toLocaleTimeString(
                                  "id-ID",
                                  { hour: "2-digit", minute: "2-digit" }
                                )}
                              </div>
                            </div>
                            <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[8px] font-black text-emerald-300">
                              ×{entry.qty}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-6 text-center text-[9px] text-slate-500">
                          Belum ada consumption.
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setAycePanelOpen(false);
                      closeAyceSession();
                    }}
                    className="w-full rounded-xl bg-red-600 py-3.5 text-[9px] font-black uppercase tracking-wider text-white hover:bg-red-500"
                  >
                    Tutup Session
                  </button>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-[1fr_110px] gap-2">
                    <div>
                      <div className="mb-2 text-[7px] font-black uppercase tracking-wider text-slate-500">
                        Nomor / Nama Meja
                      </div>
                      <input
                        value={tableName}
                        onChange={(e) => setTableName(e.target.value)}
                        placeholder="Contoh: A12"
                        autoFocus
                        className={`w-full rounded-xl border px-4 py-3.5 text-xs font-bold outline-none ${
                          isDark
                            ? "border-white/[0.07] bg-white/[0.025] text-white placeholder:text-slate-600"
                            : "border-slate-200 bg-white placeholder:text-slate-400"
                        }`}
                      />
                    </div>

                    <div>
                      <div className="mb-2 text-[7px] font-black uppercase tracking-wider text-slate-500">
                        Pax
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={pax}
                        onChange={(e) => setPax(e.target.value)}
                        className={`w-full rounded-xl border px-4 py-3.5 text-xs font-black outline-none ${
                          isDark
                            ? "border-white/[0.07] bg-white/[0.025]"
                            : "border-slate-200 bg-white"
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-[7px] font-black uppercase tracking-wider text-slate-500">
                      Paket AYCE
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {aycePackages.map((pkg) => (
                        <button
                          key={pkg.key}
                          type="button"
                          onClick={() => setAycePackageKey(pkg.key)}
                          className={`rounded-2xl border p-3 text-left transition ${
                            aycePackageKey === pkg.key
                              ? "border-red-400/30 bg-red-500 text-white"
                              : isDark
                              ? "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-white"
                              : "border-slate-200 bg-white text-slate-500"
                          }`}
                        >
                          <div className="text-[8px] font-black">
                            {pkg.name}
                          </div>
                          <div className="mt-1 text-[10px] font-black">
                            {money(pkg.price)}
                          </div>
                          <div className="mt-0.5 text-[7px] opacity-60">
                            {pkg.durationMinutes} menit / pax
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-red-400/10 bg-red-500/[0.05] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[7px] font-black uppercase tracking-wider text-slate-500">
                          Estimasi Paket
                        </div>
                        <div className="mt-1 text-lg font-black text-red-400">
                          {money(
                            selectedAycePackage.price *
                              Math.max(1, Number(pax || 1))
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[7px] font-black uppercase tracking-wider text-slate-500">
                          Durasi
                        </div>
                        <div className="mt-1 text-sm font-black">
                          {selectedAycePackage.durationMinutes} MIN
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-[8px] leading-relaxed text-slate-500">
                      Menu AYCE yang dipesan akan masuk ke consumption dengan
                      harga Rp0. Add-on tetap dihitung sesuai harga menu.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={startAyceSession}
                    className="w-full rounded-xl bg-red-600 py-3.5 text-[9px] font-black uppercase tracking-wider text-white shadow-lg shadow-red-900/20 hover:bg-red-500"
                  >
                    Mulai Session & Timer
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          PAYMENT MODAL
      ====================================================== */}
      {payOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md">
          <div
            className={`w-full max-w-[520px] overflow-hidden rounded-[28px] border shadow-[0_30px_100px_rgba(0,0,0,0.5)] ${
              isDark
                ? "border-white/[0.08] bg-[#0a110e] text-white"
                : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            {/* PAYMENT HEADER */}
            <div
              className={`relative overflow-hidden border-b px-5 py-4 ${
                isDark
                  ? "border-white/[0.06] bg-gradient-to-br from-emerald-950/60 to-[#0a110e]"
                  : "border-slate-100 bg-slate-50"
              }`}
            >
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-400/[0.06] blur-3xl" />

              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10">
                    <WalletCards className="h-5 w-5 text-emerald-400" />
                  </div>

                  <div>
                    <div className="text-[8px] font-bold uppercase tracking-[0.22em] text-emerald-400/70">
                      Checkout
                    </div>

                    <div className="text-base font-black">
                      PEMBAYARAN
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setPayOpen(
                      false
                    )
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-slate-500 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[78vh] overflow-auto p-5">
              {/* BOM */}
              {missingBomCount >
                0 && (
                <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-400/15 bg-amber-400/[0.06] p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />

                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                      BOM belum siap
                    </div>

                    <div className="mt-1 text-[9px] leading-relaxed text-amber-200/50">
                      Ada{" "}
                      {
                        missingBomCount
                      }{" "}
                      menu yang belum memiliki BOM / Recipe.
                    </div>
                  </div>
                </div>
              )}

              {/* TOTAL */}
              <div
                className={`relative overflow-hidden rounded-[24px] p-5 text-center ${
                  isGangnam
                    ? "bg-gradient-to-br from-red-600 to-red-800 text-white"
                    : "bg-gradient-to-br from-emerald-500 to-teal-500 text-slate-950"
                }`}
              >
                <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-3xl" />

                <div className="relative text-[8px] font-bold uppercase tracking-[0.3em] opacity-60">
                  Grand Total
                </div>

                <div className="relative mt-1 text-4xl font-black tracking-tight">
                  {money(total)}
                </div>

                {ayceSession && (
                  <div className="relative mt-2 text-[8px] font-bold opacity-75">
                    MEJA {ayceSession.tableName} · {ayceSession.pax} PAX ·{" "}
                    {ayceSession.packageName}
                  </div>
                )}

                <div className="relative mt-1 text-[8px] font-semibold opacity-50">
                  {itemCount} item ·{" "}
                  {selectedOutlet?.name ||
                    "Outlet"}
                </div>
              </div>

              {/* PAYMENT METHODS */}
              <div className="mt-5">
                <div className="mb-2 text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Metode Pembayaran
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    [
                      "CASH",
                      Banknote,
                    ],
                    [
                      "QRIS",
                      QrCode,
                    ],
                    [
                      "TRANSFER",
                      Landmark,
                    ],
                  ].map(
                    ([name, Icon]: any) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() =>
                          setPaymentMethod(
                            name
                          )
                        }
                        className={`rounded-xl border p-3 transition ${
                          paymentMethod ===
                          name
                            ? isGangnam
                              ? "border-red-400/20 bg-red-500 text-white"
                              : "border-emerald-400/20 bg-emerald-500 text-white"
                            : isDark
                            ? "border-white/[0.06] bg-white/[0.025] text-slate-500 hover:text-white"
                            : "border-slate-200 bg-slate-50 text-slate-500"
                        }`}
                      >
                        <Icon className="mx-auto mb-1.5 h-5 w-5" />

                        <div className="text-[8px] font-black">
                          {name}
                        </div>
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* CUSTOMER */}
              <div className="mt-4">
                <div className="mb-2 text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Informasi Transaksi
                </div>

                <input
                  value={
                    customerName
                  }
                  onChange={(e) =>
                    setCustomerName(
                      e.target.value
                    )
                  }
                  placeholder="Nama pelanggan / meja (opsional)"
                  className={`w-full rounded-xl border px-4 py-3 text-xs outline-none transition ${
                    isDark
                      ? "border-white/[0.07] bg-white/[0.025] text-white placeholder:text-slate-600 focus:border-emerald-400/30"
                      : "border-slate-200 bg-white placeholder:text-slate-400 focus:border-emerald-300"
                  }`}
                />

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    value={
                      discount
                    }
                    onChange={(e) =>
                      setDiscount(
                        e.target
                          .value
                      )
                    }
                    placeholder="Diskon"
                    className={`w-full rounded-xl border px-4 py-3 text-xs outline-none ${
                      isDark
                        ? "border-white/[0.07] bg-white/[0.025]"
                        : "border-slate-200 bg-white"
                    }`}
                  />

                  <input
                    type="number"
                    min="0"
                    value={paid}
                    onChange={(e) =>
                      setPaid(
                        e.target
                          .value
                      )
                    }
                    placeholder="Uang diterima"
                    className={`w-full rounded-xl border px-4 py-3 text-xs outline-none ${
                      isDark
                        ? "border-white/[0.07] bg-white/[0.025]"
                        : "border-slate-200 bg-white"
                    }`}
                  />
                </div>
              </div>

              {/* SUMMARY */}
              <div
                className={`mt-5 space-y-2 border-t pt-4 ${
                  isDark
                    ? "border-white/[0.06]"
                    : "border-slate-100"
                }`}
              >
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500">
                    {ayceSession ? "Paket + Add-on" : "Subtotal"}
                  </span>
                  <b>
                    {money(
                      subtotal
                    )}
                  </b>
                </div>

                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500">
                    Service Charge
                  </span>
                  <b>
                    {money(
                      serviceCharge
                    )}
                  </b>
                </div>

                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500">
                    PPN
                  </span>
                  <b>
                    {money(ppn)}
                  </b>
                </div>

                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500">
                    Diskon
                  </span>
                  <b className="text-red-400">
                    -{" "}
                    {money(disc)}
                  </b>
                </div>

                <div
                  className={`mt-3 flex items-center justify-between rounded-xl p-3 ${
                    isDark
                      ? "bg-emerald-400/[0.05]"
                      : "bg-emerald-50"
                  }`}
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                    Kembalian
                  </span>

                  <b className="text-base font-black text-emerald-400">
                    {money(change)}
                  </b>
                </div>
              </div>

              {/* ACTION */}
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={
                    saveHold
                  }
                  disabled={
                    !cart.length
                  }
                  className={`rounded-xl border py-3.5 text-[9px] font-black uppercase tracking-wider ${
                    isDark
                      ? "border-white/[0.07] bg-white/[0.025] text-slate-400"
                      : "border-slate-200 bg-slate-50 text-slate-500"
                  } disabled:opacity-20`}
                >
                  <Bookmark className="mr-1.5 inline h-4 w-4" />
                  HOLD
                </button>

                <button
                  type="button"
                  onClick={
                    checkout
                  }
                  disabled={
                    saving ||
                    paidN < total ||
                    missingBomCount >
                      0
                  }
                  className={`rounded-xl py-3.5 text-[9px] font-black uppercase tracking-wider text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-25 ${
                    isGangnam
                      ? "bg-red-600 hover:bg-red-500"
                      : "bg-emerald-500 hover:bg-emerald-400"
                  }`}
                >
                  {saving
                    ? "MEMPROSES..."
                    : missingBomCount >
                      0
                    ? "BOM BELUM SIAP"
                    : "KONFIRMASI & BAYAR"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          HISTORY MODAL
      ====================================================== */}
      {historyOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md">
          <div
            className={`flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border shadow-[0_30px_100px_rgba(0,0,0,0.5)] ${
              isDark
                ? "border-white/[0.08] bg-[#08100d] text-white"
                : "border-slate-200 bg-white"
            }`}
          >
            {/* HEADER */}
            <div
              className={`relative border-b px-5 py-4 ${
                isDark
                  ? "border-white/[0.06] bg-gradient-to-r from-emerald-950/40 to-transparent"
                  : "border-slate-100 bg-slate-50"
              }`}
            >
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10">
                    <History className="h-5 w-5 text-emerald-400" />
                  </div>

                  <div>
                    <div className="text-[8px] font-bold uppercase tracking-[0.22em] text-emerald-400/70">
                      Transaction Center
                    </div>

                    <div className="text-base font-black">
                      RIWAYAT TRANSAKSI
                    </div>

                    <div className="mt-0.5 text-[8px] text-slate-500">
                      {sales.length} transaksi tercatat
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setHistoryOpen(
                      false
                    );
                    setSelectedSale(
                      null
                    );
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-slate-500 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* SEARCH */}
            <div
              className={`border-b p-4 ${
                isDark
                  ? "border-white/[0.06]"
                  : "border-slate-100"
              }`}
            >
              <div
                className={`relative rounded-xl border ${
                  isDark
                    ? "border-white/[0.07] bg-white/[0.025]"
                    : "border-slate-200 bg-white"
                }`}
              >
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />

                <input
                  value={
                    historySearch
                  }
                  onChange={(e) =>
                    setHistorySearch(
                      e.target.value
                    )
                  }
                  placeholder="Cari nomor transaksi, pelanggan, metode..."
                  className="w-full bg-transparent py-3 pl-9 pr-4 text-xs outline-none"
                />
              </div>
            </div>

            {/* LIST */}
            <div className="min-h-0 flex-1 overflow-auto">
              {filteredSales.length ? (
                <div className="divide-y divide-white/[0.05]">
                  {filteredSales.map(
                    (sale) => {
                      const PaymentIcon =
                        paymentIcon(
                          sale.paymentMethod
                        );

                      return (
                        <div
                          key={
                            sale.id
                          }
                          className={`grid gap-3 p-4 transition md:grid-cols-[1.15fr_1.5fr_.7fr_1fr_auto] md:items-center ${
                            isDark
                              ? "hover:bg-white/[0.018]"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="font-black">
                                {
                                  sale.number
                                }
                              </div>

                              <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[6px] font-black uppercase text-emerald-400">
                                PAID
                              </span>
                            </div>

                            <div className="mt-1 text-[8px] text-slate-500">
                              {new Date(
                                sale.saleDate
                              ).toLocaleString(
                                "id-ID"
                              )}
                            </div>

                            {sale.customerName && (
                              <div className="mt-1 text-[9px] font-semibold text-slate-400">
                                {
                                  sale.customerName
                                }
                              </div>
                            )}
                          </div>

                          <div className="text-[9px] text-slate-500">
                            {sale.items
                              ?.map(
                                (
                                  item
                                ) =>
                                  `${
                                    item
                                      .menu
                                      ?.name ||
                                    item
                                      .barang
                                      ?.name ||
                                    "Item"
                                  } x${
                                    item.qty
                                  }`
                              )
                              .join(
                                ", "
                              ) ||
                              "-"}
                          </div>

                          <div className="flex items-center gap-2 text-[8px] font-black text-slate-400">
                            <PaymentIcon className="h-3.5 w-3.5 text-emerald-400" />
                            {
                              sale.paymentMethod
                            }
                          </div>

                          <div className="text-left font-black text-emerald-400 md:text-right">
                            {money(
                              sale.total
                            )}
                          </div>

                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedSale(
                                  sale
                                )
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-slate-500 hover:bg-emerald-400/10 hover:text-emerald-300"
                              title="Detail"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openReceipt(
                                  sale
                                )
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-400"
                              title="Cetak"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              ) : (
                <div className="flex min-h-[300px] items-center justify-center">
                  <div className="text-center">
                    <History className="mx-auto h-8 w-8 text-slate-600" />

                    <div className="mt-3 text-xs font-bold text-slate-500">
                      Belum ada transaksi
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* DETAIL */}
            {selectedSale && (
              <div
                className={`max-h-[45vh] overflow-auto border-t p-5 ${
                  isDark
                    ? "border-white/[0.06] bg-[#0a120f]"
                    : "border-slate-100 bg-slate-50"
                }`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-emerald-400/70">
                      Transaction Detail
                    </div>

                    <div className="mt-1 text-base font-black">
                      {
                        selectedSale.number
                      }
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedSale(
                        null
                      )
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-slate-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {[
                    [
                      "TOTAL",
                      money(
                        selectedSale.total
                      ),
                    ],
                    [
                      "BAYAR",
                      money(
                        selectedSale.paidAmount
                      ),
                    ],
                    [
                      "KEMBALIAN",
                      money(
                        selectedSale.changeAmount
                      ),
                    ],
                    [
                      "METODE",
                      selectedSale.paymentMethod,
                    ],
                  ].map(
                    ([label, value]) => (
                      <div
                        key={label}
                        className={`rounded-xl border p-3 ${
                          isDark
                            ? "border-white/[0.06] bg-white/[0.02]"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="text-[7px] font-bold uppercase tracking-wider text-slate-500">
                          {label}
                        </div>

                        <div
                          className={`mt-1 text-xs font-black ${
                            label ===
                            "KEMBALIAN"
                              ? "text-emerald-400"
                              : ""
                          }`}
                        >
                          {value}
                        </div>
                      </div>
                    )
                  )}
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.06]">
                  <table className="w-full text-[10px]">
                    <thead className="bg-white/[0.025] text-[7px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="p-3 text-left">
                          Item
                        </th>

                        <th className="p-3 text-right">
                          Qty
                        </th>

                        <th className="p-3 text-right">
                          Harga
                        </th>

                        <th className="p-3 text-right">
                          Subtotal
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {(
                        selectedSale.items ||
                        []
                      ).map(
                        (item) => (
                          <tr
                            key={
                              item.id
                            }
                            className="border-t border-white/[0.05]"
                          >
                            <td className="p-3 font-semibold">
                              {item
                                .menu
                                ?.name ||
                                item
                                  .barang
                                  ?.name ||
                                "Item"}
                            </td>

                            <td className="p-3 text-right">
                              {
                                item.qty
                              }
                            </td>

                            <td className="p-3 text-right text-slate-500">
                              {money(
                                item.unitPrice
                              )}
                            </td>

                            <td className="p-3 text-right font-black">
                              {money(
                                item.subtotal
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    openReceipt(
                      selectedSale
                    )
                  }
                  className="mt-4 rounded-xl bg-emerald-500 px-5 py-3 text-[9px] font-black uppercase tracking-wider text-white"
                >
                  <Printer className="mr-1.5 inline h-4 w-4" />
                  Cetak Nota
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================
          HOLD MODAL
      ====================================================== */}
      {holdOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md">
          <div
            className={`max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-[28px] border shadow-[0_30px_100px_rgba(0,0,0,0.5)] ${
              isDark
                ? "border-white/[0.08] bg-[#08100d] text-white"
                : "border-slate-200 bg-white"
            }`}
          >
            <div
              className={`border-b p-5 ${
                isDark
                  ? "border-white/[0.06]"
                  : "border-slate-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10">
                    <Bookmark className="h-5 w-5 text-amber-400" />
                  </div>

                  <div>
                    <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-amber-400/70">
                      Saved Orders
                    </div>

                    <div className="text-base font-black">
                      TRANSAKSI HOLD
                    </div>

                    <div className="text-[8px] text-slate-500">
                      {activeHolds.length} order tersimpan
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setHoldOpen(
                      false
                    )
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-slate-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[68vh] overflow-auto p-4">
              {activeHolds.length ? (
                activeHolds.map(
                  (hold) => (
                    <div
                      key={
                        hold.id
                      }
                      className={`mb-2.5 rounded-2xl border p-4 transition ${
                        isDark
                          ? "border-white/[0.06] bg-white/[0.018] hover:bg-white/[0.03]"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-xs font-black">
                              {
                                hold.id
                              }
                            </div>

                            <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[6px] font-black uppercase text-amber-400">
                              HOLD
                            </span>
                          </div>

                          <div className="mt-1 text-[8px] text-slate-500">
                            {new Date(
                              hold.createdAt
                            ).toLocaleString(
                              "id-ID"
                            )}
                          </div>

                          <div className="mt-1 text-[8px] text-slate-400">
                            {hold.customerName ||
                              "Tanpa nama"}{" "}
                            ·{" "}
                            {hold.cart.reduce(
                              (
                                sum,
                                x
                              ) =>
                                sum +
                                x.qty,
                              0
                            )}{" "}
                            item
                          </div>
                        </div>

                        <div className="flex shrink-0 gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              resumeHold(
                                hold.id
                              )
                            }
                            className="rounded-xl bg-emerald-500 px-3.5 py-2 text-[8px] font-black uppercase text-white"
                          >
                            <Play className="mr-1 inline h-3 w-3" />
                            Lanjutkan
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deleteHold(
                                hold.id
                              )
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/10 text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                )
              ) : (
                <div className="flex min-h-[280px] items-center justify-center">
                  <div className="text-center">
                    <Bookmark className="mx-auto h-8 w-8 text-slate-600" />

                    <div className="mt-3 text-xs font-bold text-slate-500">
                      Belum ada transaksi HOLD
                    </div>

                    <div className="mt-1 text-[9px] text-slate-600">
                      Order yang di-HOLD akan muncul di sini
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          NOTE MODAL
      ====================================================== */}
      {noteOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md">
          <div
            className={`w-full max-w-md overflow-hidden rounded-[26px] border shadow-2xl ${
              isDark
                ? "border-white/[0.08] bg-[#08100d] text-white"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10">
                  <FileText className="h-4 w-4 text-emerald-400" />
                </div>

                <div>
                  <div className="text-[8px] font-bold uppercase tracking-wider text-emerald-400/70">
                    Transaction Note
                  </div>

                  <div className="text-sm font-black">
                    CATATAN NOTA
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setNoteOpen(
                    false
                  )
                }
                className="text-slate-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              <textarea
                value={note}
                onChange={(e) =>
                  setNote(
                    e.target.value
                  )
                }
                rows={5}
                placeholder="Catatan untuk transaksi / meja..."
                className="w-full resize-none rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-xs outline-none transition focus:border-emerald-400/30"
              />

              <button
                type="button"
                onClick={() =>
                  setNoteOpen(
                    false
                  )
                }
                className="mt-3 w-full rounded-xl bg-emerald-500 py-3.5 text-[9px] font-black uppercase tracking-wider text-white"
              >
                Simpan Catatan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          RECEIPT
      ====================================================== */}
      {receiptOpen &&
        receiptSale && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 p-3 backdrop-blur-md">
            <div className="w-full max-w-md overflow-hidden rounded-[26px] bg-white text-black shadow-[0_30px_100px_rgba(0,0,0,0.6)]">
              <div className="flex items-center justify-between border-b p-4">
                <div>
                  <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-emerald-600">
                    Receipt
                  </div>

                  <div className="text-sm font-black">
                    NOTA TRANSAKSI
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setReceiptOpen(
                      false
                    )
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div
                id="pos-receipt"
                className="max-h-[65vh] overflow-auto p-6 text-sm"
              >
                <div className="text-center">
                  <div className="text-xl font-black">
                    {isGangnam
                      ? "Gangnam BBQ"
                      : "MGB POS"}
                  </div>

                  <div className="mt-1 text-[10px] text-slate-500">
                    {receiptSale
                      .outlet
                      ?.name ||
                      selectedOutlet?.name ||
                      "Outlet"}
                  </div>

                  <div className="mt-3 border-b border-dashed pb-3 text-[9px]">
                    {
                      receiptSale.number
                    }
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {(
                    receiptSale.items ||
                    []
                  ).map(
                    (item) => (
                      <div
                        key={
                          item.id
                        }
                        className="flex justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-bold">
                            {item.menu
                              ?.name ||
                              item.barang
                                ?.name ||
                              "Item"}
                          </div>

                          <div className="text-[9px] text-slate-500">
                            {
                              item.qty
                            }{" "}
                            x{" "}
                            {money(
                              item.unitPrice
                            )}
                          </div>
                        </div>

                        <div className="font-bold">
                          {money(
                            item.subtotal
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>

                <div className="mt-5 space-y-1.5 border-t border-dashed pt-4 text-[10px]">
                  <div className="flex justify-between">
                    <span>
                      Diskon
                    </span>

                    <b>
                      -{" "}
                      {money(
                        receiptSale.discount ||
                          0
                      )}
                    </b>
                  </div>

                  <div className="flex justify-between">
                    <span>
                      Service
                    </span>

                    <b>
                      {money(
                        receiptSale.serviceCharge ||
                          0
                      )}
                    </b>
                  </div>

                  <div className="flex justify-between">
                    <span>
                      PPN
                    </span>

                    <b>
                      {money(
                        receiptSale.ppn ||
                          0
                      )}
                    </b>
                  </div>

                  <div className="mt-2 flex justify-between border-t pt-2 text-base">
                    <b>TOTAL</b>
                    <b>
                      {money(
                        receiptSale.total
                      )}
                    </b>
                  </div>

                  <div className="flex justify-between">
                    <span>
                      Bayar
                    </span>

                    <b>
                      {money(
                        receiptSale.paidAmount
                      )}
                    </b>
                  </div>

                  <div className="flex justify-between">
                    <span>
                      Kembalian
                    </span>

                    <b className="text-emerald-600">
                      {money(
                        receiptSale.changeAmount
                      )}
                    </b>
                  </div>
                </div>

                {receiptSale.customerName && (
                  <div className="mt-5 rounded-lg bg-slate-50 p-3 text-[9px]">
                    Pelanggan:{" "}
                    <b>
                      {
                        receiptSale.customerName
                      }
                    </b>
                  </div>
                )}

                {receiptSale.note && (
                  <div className="mt-2 rounded-lg bg-slate-50 p-3 text-[9px]">
                    Catatan:{" "}
                    {
                      receiptSale.note
                    }
                  </div>
                )}

                <div className="mt-6 text-center text-[9px] text-slate-400">
                  Terima kasih telah berbelanja.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t bg-slate-50 p-4">
                <button
                  type="button"
                  onClick={() =>
                    setReceiptOpen(
                      false
                    )
                  }
                  className="rounded-xl border border-slate-200 bg-white py-3 text-[9px] font-black uppercase"
                >
                  Tutup
                </button>

                <button
                  type="button"
                  onClick={
                    printReceipt
                  }
                  className="rounded-xl bg-emerald-500 py-3 text-[9px] font-black uppercase text-white"
                >
                  <Printer className="mr-1.5 inline h-4 w-4" />
                  Print
                </button>
              </div>
            </div>
          </div>
        )}

      {/* =====================================================
          PRINT STYLE
      ====================================================== */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }

          #pos-receipt,
          #pos-receipt * {
            visibility: visible !important;
          }

          #pos-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 5mm !important;
            background: white !important;
            color: black !important;
            overflow: visible !important;
            max-height: none !important;
          }
        }

        ::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.18);
          border-radius: 999px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.32);
        }
      `}</style>
    </div>,
    document.body
  );
}
