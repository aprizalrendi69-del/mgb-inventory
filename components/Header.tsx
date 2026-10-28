
"use client";

import {
  ArrowLeft,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  LogOut,
  Menu,
  MessageCircle,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

interface HeaderProps {
  onMenuClick?: () => void;
}

interface OnlineUser {
  id: number | string;
  username?: string | null;
  fullname?: string | null;
  photo?: string | null;
  role?: string | null;
  outletId?: number | null;
  online?: boolean;
  outlet?: {
    id: number;
    code?: string | null;
    name?: string | null;
  } | null;
}

interface OnlineUsersResponse {
  success?: boolean;
  users?: OnlineUser[];
  currentUser?: OnlineUser;
}

interface NotificationItem {
  id: number | string;
  mentionId?: number | string | null;
  type?: string | null;
  title?: string | null;
  message?: string | null;
  description?: string | null;
  createdAt: string;
  read?: boolean | null;
  readAt?: string | null;
  link?: string | null;
  href?: string | null;
  purchaseId?: number | string | null;
  outletPurchaseId?: number | string | null;
  transferId?: number | string | null;
  transferNumber?: string | null;
  commentId?: number | string | null;
  user?: {
    id?: number | string | null;
    name?: string | null;
    fullname?: string | null;
    username?: string | null;
  } | null;
  actor?: {
    id?: number | string | null;
    name?: string | null;
    fullname?: string | null;
    username?: string | null;
  } | null;
  purchase?: {
    id?: number | string | null;
    poNumber?: string | null;
    number?: string | null;
    code?: string | null;
  } | null;
  outletPurchase?: {
    id?: number | string | null;
    poNumber?: string | null;
    number?: string | null;
    code?: string | null;
  } | null;
  transfer?: {
    id?: number | string | null;
    number?: string | null;
    transferDate?: string | null;
    status?: string | null;
  } | null;
}

interface NotificationsResponse {
  notifications?: NotificationItem[];
  data?: NotificationItem[];
  unreadCount?: number;
  count?: number;
}

type DateFilter = "all" | "today" | "7days" | "30days" | "custom";

function normalizeNotifications(
  payload: NotificationsResponse | NotificationItem[] | null | undefined
): NotificationItem[] {
  if (Array.isArray(payload)) {
    return payload.filter(Boolean).map((item, index) => ({
      ...item,
      id: item.id ?? `notification-${index}`,
    }));
  }

  const items = payload?.notifications ?? payload?.data ?? [];

  return Array.isArray(items)
    ? items.filter(Boolean).map((item, index) => ({
        ...item,
        id: item.id ?? `notification-${index}`,
      }))
    : [];
}

function getNotificationActor(item: NotificationItem): string {
  return (
    item.actor?.fullname ||
    item.actor?.name ||
    item.actor?.username ||
    item.user?.fullname ||
    item.user?.name ||
    item.user?.username ||
    "User"
  );
}

function getPurchaseLabel(item: NotificationItem): string | null {
  const purchase = item.purchase ?? item.outletPurchase ?? null;
  const number = purchase?.poNumber || purchase?.number || purchase?.code;

  if (!number) return null;
  if (item.outletPurchaseId || item.outletPurchase) return `PO Outlet ${number}`;
  if (item.purchaseId || item.purchase) return `PO Pusat ${number}`;
  return number;
}

function getTransferLabel(item: NotificationItem): string | null {
  const number = item.transferNumber || item.transfer?.number;
  if (number) return `Transfer ${number}`;
  if (item.transferId) return `Transfer #${item.transferId}`;
  return null;
}

function getNotificationLink(item: NotificationItem): string | null {
  if (item.link) return item.link;
  if (item.href) return item.href;
  if (item.outletPurchaseId) return `/outlet/purchase/${item.outletPurchaseId}`;
  if (item.purchaseId) return `/purchase/${item.purchaseId}`;
  if (item.transferId) return `/outlet/barang-masuk/TRANSFER-${item.transferId}`;
  return null;
}

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Baru saja";

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes} menit lalu`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateLabel(value: string): string {
  if (!value) return "-";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getTodayInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function getUserName(user: OnlineUser): string {
  return user.fullname?.trim() || user.username?.trim() || "User";
}

function getUserInitials(user: OnlineUser): string {
  const name = getUserName(user);
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "U";
}

export default function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const notificationRef = useRef<HTMLDivElement | null>(null);
  const notificationButtonRef = useRef<HTMLButtonElement | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);

  const [userRole, setUserRole] = useState<string | null>(null);
  const [userRoleLoading, setUserRoleLoading] = useState(true);
  const [isUserOnline, setIsUserOnline] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [profileDisplayName, setProfileDisplayName] = useState("User");
  const [companyBrand, setCompanyBrand] = useState<{ name: string; logo: string | null }>({ name: "PT. Mitra Garam Bogatama", logo: null });

  // Daftar user lain yang online, diambil dari /api/chat/users.
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [onlineUsersLoading, setOnlineUsersLoading] = useState(true);

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [markingRead, setMarkingRead] = useState(false);

  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const [currentDateTime, setCurrentDateTime] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadCompanyBrand = async () => {
      try {
        const response = await fetch("/api/company", { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } });
        if (!response.ok) return;
        const payload = await response.json();
        const company = payload?.data;
        if (!cancelled && payload?.success && company) {
          setCompanyBrand({
            name: typeof company.name === "string" && company.name.trim() ? company.name.trim() : "PT. Mitra Garam Bogatama",
            logo: typeof company.logo === "string" && company.logo.trim() ? company.logo.trim() : null,
          });
        }
      } catch (error) { console.error("Gagal memuat identitas perusahaan di header", error); }
    };
    void loadCompanyBrand();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setCurrentDateTime(new Date());

    const interval = window.setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const digitalTime = currentDateTime
    ? new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(currentDateTime)
    : "--:--:--";

  const digitalDate = currentDateTime
    ? new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(currentDateTime)
    : "Memuat tanggal...";

  // =========================================================
  // LOAD CURRENT USER
  // =========================================================

  useEffect(() => {
    let cancelled = false;

    const loadCurrentUser = async () => {
      try {
        setUserRoleLoading(true);

        const response = await fetch("/api/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const payload = await response.json();
        const user =
          payload?.user ??
          payload?.data?.user ??
          payload?.data ??
          payload ??
          {};

        const role = String(user?.role ?? payload?.role ?? "")
          .trim()
          .toUpperCase();

        const photoCandidate =
          user?.avatarUrl ??
          user?.avatar ??
          user?.profileImageUrl ??
          user?.profileImage ??
          user?.photoUrl ??
          user?.photo ??
          user?.imageUrl ??
          user?.image ??
          user?.picture ??
          null;

        const photo =
          typeof photoCandidate === "string" && photoCandidate.trim()
            ? photoCandidate.trim()
            : null;

        const displayName = String(
          user?.fullname ??
            user?.fullName ??
            user?.name ??
            user?.username ??
            "User"
        ).trim();

        if (!cancelled) {
          setUserRole(role || null);
          setProfilePhotoUrl(photo);
          setProfileDisplayName(displayName || "User");
        }
      } catch (error) {
        console.error("[Header] Gagal mengambil data user:", error);

        if (!cancelled) {
          setUserRole(null);
          setProfilePhotoUrl(null);
          setProfileDisplayName("User");
        }
      } finally {
        if (!cancelled) setUserRoleLoading(false);
      }
    };

    void loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

  // =========================================================
  // HEARTBEAT USER LOGIN
  // =========================================================

  useEffect(() => {
    let cancelled = false;
    let requestInProgress = false;

    const sendHeartbeat = async () => {
      if (cancelled || requestInProgress) return;

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setIsUserOnline(false);
        return;
      }

      requestInProgress = true;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10_000);

      try {
        const response = await fetch("/api/me/heartbeat", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          if (!cancelled) setIsUserOnline(false);
          return;
        }

        let payload: {
          success?: boolean;
          online?: boolean;
          user?: { active?: boolean };
        } | null = null;

        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          payload = await response.json();
        }

        const confirmedOnline =
          payload?.success !== false &&
          payload?.online !== false &&
          payload?.user?.active !== false;

        if (!cancelled) setIsUserOnline(confirmedOnline);
      } catch {
        if (!cancelled) setIsUserOnline(false);
      } finally {
        window.clearTimeout(timeout);
        requestInProgress = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void sendHeartbeat();
    };

    const onOnline = () => void sendHeartbeat();
    const onOffline = () => setIsUserOnline(false);

    void sendHeartbeat();

    const interval = window.setInterval(() => {
      void sendHeartbeat();
    }, 15_000);

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // =========================================================
  // LOAD USER ONLINE LIST
  // GET /api/chat/users -> users[] with online: boolean
  // =========================================================

  useEffect(() => {
    let cancelled = false;
    let requestInProgress = false;
    let interval: number | undefined;

    const loadOnlineUsers = async () => {
      if (cancelled || requestInProgress) return;

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (!cancelled) {
          setOnlineUsers([]);
          setOnlineUsersLoading(false);
        }
        return;
      }

      requestInProgress = true;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10_000);

      try {
        const response = await fetch("/api/chat/users", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as OnlineUsersResponse;

        if (payload?.success === false || !Array.isArray(payload?.users)) {
          throw new Error("Format respons /api/chat/users tidak sesuai");
        }

        // Hanya tampilkan user yang benar-benar dinyatakan online oleh API.
        const currentlyOnline = payload.users.filter(
          (user) => user && user.online === true
        );

        if (!cancelled) {
          setOnlineUsers(currentlyOnline);
        }
      } catch (error) {
        // Jangan mempertahankan daftar lama ketika endpoint gagal,
        // karena status online yang lama bisa sudah kedaluwarsa.
        if (!cancelled) {
          setOnlineUsers([]);
        }
        console.error("[Header] Gagal memuat daftar user online:", error);
      } finally {
        window.clearTimeout(timeout);
        requestInProgress = false;

        if (!cancelled) setOnlineUsersLoading(false);
      }
    };

    void loadOnlineUsers();

    interval = window.setInterval(() => {
      void loadOnlineUsers();
    }, 15_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadOnlineUsers();
      }
    };

    const onOnline = () => void loadOnlineUsers();
    const onOffline = () => {
      setOnlineUsers([]);
      setOnlineUsersLoading(false);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      cancelled = true;
      if (interval !== undefined) window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // =========================================================
  // STAFF OUTLET ACCESS
  // =========================================================

  const isStaffOutlet = userRole === "STAFF_OUTLET";
  const isStaffOutletAtManufacture =
    isStaffOutlet && pathname === "/manufacture";

  const backButtonDisabled =
    userRoleLoading ||
    userRole === null ||
    isStaffOutletAtManufacture ||
    (!isStaffOutlet && !canGoBack);

  // =========================================================
  // GLOBAL MODAL DETECTION
  // =========================================================

  useEffect(() => {
    const syncModalState = () => {
      const body = document.body;
      const isOpen =
        body.dataset.modalOpen === "true" ||
        Boolean(
          document.querySelector(
            '[data-modal="true"], [role="dialog"][aria-modal="true"]'
          )
        );

      setModalOpen(isOpen);
    };

    syncModalState();

    const observer = new MutationObserver(syncModalState);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-modal-open", "class"],
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  // =========================================================
  // BROWSER HISTORY
  // =========================================================

  useEffect(() => {
    const syncHistoryState = () => {
      setCanGoBack(window.history.length > 1);
    };

    syncHistoryState();
    window.addEventListener("popstate", syncHistoryState);
    window.addEventListener("pushstate", syncHistoryState as EventListener);
    window.addEventListener("replacestate", syncHistoryState as EventListener);

    return () => {
      window.removeEventListener("popstate", syncHistoryState);
      window.removeEventListener("pushstate", syncHistoryState as EventListener);
      window.removeEventListener("replacestate", syncHistoryState as EventListener);
    };
  }, [pathname]);

  // =========================================================
  // BACK BUTTON
  // =========================================================

  const goBack = () => {
    if (userRoleLoading || userRole === null) return;

    if (isStaffOutlet) {
      if (pathname !== "/manufacture") {
        router.replace("/manufacture");
      }
      return;
    }

    if (canGoBack) {
      router.back();
      return;
    }

    router.push("/outlet/dashboard");
  };

  // =========================================================
  // NOTIFICATIONS
  // =========================================================

  const loadNotifications = useCallback(async (silent = false) => {
    if (!silent) setNotificationLoading(true);
    setNotificationError("");

    try {
      const response = await fetch("/api/notifications", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = (await response.json()) as
        | NotificationsResponse
        | NotificationItem[];

      setNotifications(normalizeNotifications(payload));
    } catch {
      if (!silent) {
        setNotificationError(
          "Pemberitahuan gagal dimuat. Silakan coba lagi."
        );
      }
    } finally {
      if (!silent) setNotificationLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications(true);

    const interval = window.setInterval(() => {
      void loadNotifications(true);
    }, 15_000);

    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    if (!notificationOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;

      if (
        notificationRef.current &&
        target &&
        !notificationRef.current.contains(target)
      ) {
        setNotificationOpen(false);
        setFilterOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotificationOpen(false);
        setFilterOpen(false);
        notificationButtonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [notificationOpen]);

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (item) => item.read !== true && !item.readAt
      ).length,
    [notifications]
  );

  const hasUnread = unreadCount > 0;

  const filteredNotifications = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    const now = new Date();

    if (dateFilter === "today") {
      startDate = startOfDay(now);
      endDate = endOfDay(now);
    }

    if (dateFilter === "7days") {
      const date = new Date(now);
      date.setDate(date.getDate() - 6);
      startDate = startOfDay(date);
      endDate = endOfDay(now);
    }

    if (dateFilter === "30days") {
      const date = new Date(now);
      date.setDate(date.getDate() - 29);
      startDate = startOfDay(date);
      endDate = endOfDay(now);
    }

    if (dateFilter === "custom" && customStartDate) {
      startDate = startOfDay(new Date(`${customStartDate}T00:00:00`));
    }

    if (dateFilter === "custom" && customEndDate) {
      endDate = endOfDay(new Date(`${customEndDate}T00:00:00`));
    }

    return notifications.filter((item) => {
      const searchableText = [
        item.title,
        item.message,
        item.description,
        item.type,
        getNotificationActor(item),
        getPurchaseLabel(item),
        getTransferLabel(item),
        item.transferNumber,
        item.purchase?.poNumber,
        item.outletPurchase?.poNumber,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (query && !searchableText.includes(query)) return false;
      if (!startDate && !endDate) return true;

      const createdAt = new Date(item.createdAt);
      if (Number.isNaN(createdAt.getTime())) return false;
      if (startDate && createdAt < startDate) return false;
      if (endDate && createdAt > endDate) return false;

      return true;
    });
  }, [
    notifications,
    searchQuery,
    dateFilter,
    customStartDate,
    customEndDate,
  ]);

  const hasActiveFilters = Boolean(searchQuery.trim()) || dateFilter !== "all";

  const resetFilters = () => {
    setSearchQuery("");
    setDateFilter("all");
    setCustomStartDate("");
    setCustomEndDate("");
  };

  const dateFilterLabel = useMemo(() => {
    switch (dateFilter) {
      case "today":
        return "Hari ini";
      case "7days":
        return "7 hari";
      case "30days":
        return "30 hari";
      case "custom":
        if (customStartDate && customEndDate) {
          return `${formatDateLabel(customStartDate)} — ${formatDateLabel(customEndDate)}`;
        }
        if (customStartDate) return `Mulai ${formatDateLabel(customStartDate)}`;
        if (customEndDate) return `Sampai ${formatDateLabel(customEndDate)}`;
        return "Custom";
      default:
        return "Semua tanggal";
    }
  }, [dateFilter, customStartDate, customEndDate]);

  const markAllAsRead = async () => {
    if (markingRead || unreadCount === 0) return;

    setMarkingRead(true);

    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const now = new Date().toISOString();

      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          read: true,
          readAt: item.readAt ?? now,
        }))
      );
    } catch {
      setNotificationError(
        "Gagal menandai semua pemberitahuan sebagai dibaca."
      );
    } finally {
      setMarkingRead(false);
    }
  };

  const openNotification = async (item: NotificationItem) => {
    const link = getNotificationLink(item);
    const optimisticReadAt = item.readAt ?? new Date().toISOString();

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === item.id
          ? {
              ...notification,
              read: true,
              readAt: optimisticReadAt,
            }
          : notification
      )
    );

    setNotificationOpen(false);
    setFilterOpen(false);

    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ notificationId: item.id }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = (await response.json()) as {
        readAt?: string | null;
      };

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === item.id
            ? {
                ...notification,
                read: true,
                readAt: payload.readAt ?? optimisticReadAt,
              }
            : notification
        )
      );
    } catch (error) {
      console.error(
        "[Header] Gagal menandai pemberitahuan sebagai dibaca:",
        error
      );
    }

    if (link) router.push(link);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    } catch {
      // Tetap arahkan ke halaman login.
    } finally {
      window.location.href = "/login";
    }
  };

  if (modalOpen) return null;

  return (
    <header className="sticky top-0 z-40 h-[74px] w-full bg-transparent">
      <div className="flex h-full items-center justify-between gap-2 px-3 md:px-6">
        {/* LEFT SIDE */}
        <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={backButtonDisabled}
            aria-label="Kembali"
            title={
              userRoleLoading
                ? "Memeriksa akses..."
                : userRole === null
                  ? "Akses belum tersedia"
                  : isStaffOutlet
                    ? pathname === "/manufacture"
                      ? "Sudah di halaman utama Manufacture"
                      : "Kembali ke Manufacture"
                    : canGoBack
                      ? "Kembali"
                      : "Tidak ada halaman sebelumnya"
            }
            className={[
              "group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur-2xl transition-all duration-200",
              userRoleLoading || userRole === null
                ? "cursor-wait border-white/20 bg-white/10 text-slate-300"
                : isStaffOutlet
                  ? pathname === "/manufacture"
                    ? "cursor-not-allowed border-white/20 bg-white/10 text-slate-300"
                    : "border-emerald-300/60 bg-white/20 text-emerald-700 hover:bg-white/40"
                  : canGoBack
                    ? "border-white/30 bg-white/15 text-emerald-700 hover:bg-white/30"
                    : "cursor-not-allowed border-white/20 bg-white/10 text-slate-300",
            ].join(" ")}
          >
            <ArrowLeft size={18} strokeWidth={2.4} />
          </button>

          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Buka menu"
            title="Menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/15 text-emerald-700 backdrop-blur-2xl transition hover:bg-white/30"
          >
            <Menu size={19} strokeWidth={2.5} />
          </button>

          <div className="hidden items-center gap-3 sm:flex">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/25 bg-white/80 p-1 shadow-sm">
              {companyBrand.logo ? (
                <img src={companyBrand.logo} alt={`Logo ${companyBrand.name}`} className="h-full w-full object-contain" onError={() => setCompanyBrand((current) => ({ ...current, logo: null }))} />
              ) : (
                <span className="text-xs font-black text-emerald-800">MGB</span>
              )}
            </div>
            <div className="hidden min-w-0 md:block">
              <div className="truncate text-[14px] font-extrabold tracking-tight text-slate-800">
                {companyBrand.name}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                ERP Dashboard
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          {/* CLOCK WIB */}
          <div
            className="hidden items-center gap-2.5 px-1 sm:flex"
            aria-label={`Jam ${digitalTime} WIB, ${digitalDate}`}
            title={`${digitalDate} — Waktu Indonesia Barat`}
          >
            <Clock size={16} className="shrink-0 text-emerald-700 dark:text-emerald-400" />
            <div className="flex min-w-0 flex-col justify-center gap-1">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[15px] font-bold tabular-nums text-slate-800 dark:text-slate-100">
                  {digitalTime}
                </span>
                <span className="text-[9px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                  WIB
                </span>
              </div>
              <span className="hidden max-w-[190px] truncate text-[9px] capitalize text-slate-500 dark:text-slate-400 xl:block">
                {digitalDate}
              </span>
            </div>
            <span className="ml-0.5 hidden h-7 w-px bg-slate-200/80 dark:bg-slate-700/80 xl:block" />
          </div>

          {/* =================================================
              ONLINE USERS IN HEADER
              Avatar hanya untuk user dengan online === true.
              Polling API dilakukan setiap 15 detik.
          ================================================== */}
          <div
            className="flex max-w-[min(44vw,330px)] items-center gap-2 rounded-2xl border border-white/30 bg-white/20 px-2 py-1.5 shadow-[0_8px_25px_rgba(15,118,110,0.08)] backdrop-blur-2xl sm:px-3"
            title="User lain yang sedang online"
          >
            <div className="hidden items-center gap-1.5 text-emerald-700 sm:flex">
              <Users size={15} />
              <span className="whitespace-nowrap text-[9px] font-extrabold uppercase tracking-[0.08em]">
                Online
              </span>
            </div>

            <div className="flex min-w-0 items-center">
              {onlineUsersLoading ? (
                <span className="px-1.5 text-[10px] font-semibold text-slate-400">
                  Memuat...
                </span>
              ) : onlineUsers.length === 0 ? (
                <span className="whitespace-nowrap px-1.5 text-[10px] font-semibold text-slate-400">
                  Tidak ada user lain
                </span>
              ) : (
                <>
                  <div className="flex items-center -space-x-2">
                    {onlineUsers.slice(0, 5).map((user) => {
                      const name = getUserName(user);

                      return (
                        <div
                          key={String(user.id)}
                          className="group relative shrink-0"
                          title={`${name} — Online${
                            user.outlet?.name
                              ? ` • ${user.outlet.name}`
                              : ""
                          }`}
                        >
                          <div className="h-8 w-8 rounded-full p-[2px] ring-2 ring-emerald-500 ring-offset-1 ring-offset-white shadow-[0_0_12px_rgba(16,185,129,0.22)] transition-transform group-hover:z-10 group-hover:scale-110 dark:ring-offset-slate-950">
                            {user.photo ? (
                              <img
                                src={user.photo}
                                alt={name}
                                className="h-full w-full rounded-full object-cover"
                                referrerPolicy="no-referrer"
                                onError={(event) => {
                                  event.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center rounded-full bg-emerald-100 text-[10px] font-black text-emerald-800">
                                {getUserInitials(user)}
                              </div>
                            )}
                          </div>
                          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-950" />
                        </div>
                      );
                    })}
                  </div>

                  {onlineUsers.length > 5 && (
                    <span className="ml-2 whitespace-nowrap rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black text-emerald-800">
                      +{onlineUsers.length - 5}
                    </span>
                  )}

                  <span className="ml-2 whitespace-nowrap text-[10px] font-black tabular-nums text-emerald-700">
                    {onlineUsers.length}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* FOTO PROFIL USER LOGIN */}
          {isUserOnline && profilePhotoUrl && (
            <div
              className="relative hidden h-10 w-10 shrink-0 rounded-full p-[2px] ring-2 ring-emerald-500 ring-offset-2 ring-offset-white shadow-[0_0_18px_rgba(16,185,129,0.25)] transition-all duration-300 sm:flex dark:ring-offset-slate-950"
              title={`${profileDisplayName} — Online`}
              aria-label={`${profileDisplayName} sedang online`}
            >
              <img
                src={profilePhotoUrl}
                alt={`Foto profil ${profileDisplayName}`}
                className="h-full w-full rounded-full object-cover"
                referrerPolicy="no-referrer"
                onError={() => setProfilePhotoUrl(null)}
              />
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-950" />
            </div>
          )}

          {/* STATUS USER LOGIN */}
          <div
            aria-live="polite"
            aria-label={isUserOnline ? "User online" : "User offline"}
            title={isUserOnline ? "Koneksi user aktif" : "Koneksi user tidak aktif"}
            className={[
              "hidden items-center gap-2 rounded-full px-3 py-2 transition-all duration-300 lg:flex",
              isUserOnline
                ? "border border-emerald-300/70 bg-emerald-50/50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-400/10 dark:text-emerald-300"
                : "border border-transparent bg-transparent text-slate-400 dark:text-slate-500",
            ].join(" ")}
          >
            <span
              className={[
                "h-2.5 w-2.5 rounded-full",
                isUserOnline ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600",
              ].join(" ")}
            />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.12em]">
              {isUserOnline ? "Online" : "Offline"}
            </span>
          </div>

          {/* SECURITY */}
          <div className="hidden items-center gap-1.5 rounded-xl border border-white/30 bg-white/15 px-3 py-2 xl:flex">
            <ShieldCheck size={15} className="text-emerald-600" />
          </div>

          {/* NOTIFICATION CENTER */}
          <div ref={notificationRef} className="relative">
            <button
              ref={notificationButtonRef}
              type="button"
              onClick={() => {
                const nextOpen = !notificationOpen;
                setNotificationOpen(nextOpen);
                if (nextOpen) void loadNotifications(true);
              }}
              aria-label="Pemberitahuan"
              aria-expanded={notificationOpen}
              aria-haspopup="dialog"
              title={
                hasUnread
                  ? `${unreadCount} pemberitahuan belum dibaca`
                  : "Pemberitahuan"
              }
              className={[
                "group relative flex h-11 w-11 items-center justify-center rounded-xl border backdrop-blur-2xl transition-all duration-300",
                notificationOpen || hasUnread
                  ? "border-emerald-300/70 bg-emerald-50/40 text-emerald-700 shadow-[0_10px_35px_rgba(16,185,129,0.18)]"
                  : "border-white/30 bg-white/15 text-slate-600 hover:border-emerald-300/60 hover:bg-white/30 hover:text-emerald-700",
              ].join(" ")}
            >
              <Bell
                size={20}
                strokeWidth={2.2}
                className="transition-transform group-hover:scale-110"
              />

              {hasUnread && (
                <>
                  <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                  <span className="absolute -right-2 -top-2 flex min-w-[22px] items-center justify-center rounded-full border-2 border-white bg-emerald-600 px-1.5 py-1 text-[9px] font-black text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                </>
              )}
            </button>

            {notificationOpen && (
              <div
                role="dialog"
                aria-label="Pemberitahuan"
                className="absolute right-0 top-[calc(100%+14px)] z-50 w-[min(500px,calc(100vw-24px))] overflow-hidden rounded-[24px] border border-emerald-100 bg-white text-slate-800 shadow-[0_30px_90px_rgba(6,78,59,0.24)]"
              >
                <div className="bg-gradient-to-br from-[#064E3B] via-[#065F46] to-[#022C22] px-5 py-5 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
                        <Bell size={21} />
                      </div>
                      <div>
                        <div className="text-[16px] font-black">
                          Pemberitahuan
                        </div>
                        <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-100/70">
                          MGB ERP Notification Center
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setNotificationOpen(false);
                        setFilterOpen(false);
                      }}
                      aria-label="Tutup pemberitahuan"
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    >
                      <X size={17} />
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2">
                      <p className="text-[8px] font-bold uppercase text-emerald-100/60">
                        Status
                      </p>
                      <p className="mt-1 text-[11px] font-black">LIVE</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2">
                      <p className="text-[8px] font-bold uppercase text-emerald-100/60">
                        Belum dibaca
                      </p>
                      <p className="mt-1 text-sm font-black">{unreadCount}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2">
                      <p className="text-[8px] font-bold uppercase text-emerald-100/60">
                        Ditampilkan
                      </p>
                      <p className="mt-1 text-sm font-black">
                        {filteredNotifications.length}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="text-[9px] font-semibold text-emerald-50/80">
                      {unreadCount > 0
                        ? `${unreadCount} notifikasi menunggu perhatian`
                        : "Semua notifikasi sudah dibaca"}
                    </span>
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      disabled={markingRead || unreadCount === 0}
                      className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-3 py-1.5 text-[9px] font-extrabold text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <Check size={12} />
                      {markingRead ? "Memproses..." : "Tandai dibaca"}
                    </button>
                  </div>
                </div>

                <div className="border-b border-emerald-100 bg-white px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                      <Search
                        size={15}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Cari pemberitahuan..."
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-[11px] font-semibold outline-none focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setFilterOpen((current) => !current)}
                      aria-expanded={filterOpen}
                      className={[
                        "flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 transition",
                        filterOpen || hasActiveFilters
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-500 hover:border-emerald-200",
                      ].join(" ")}
                    >
                      <SlidersHorizontal size={14} />
                      <span className="text-[10px] font-black">Filter</span>
                    </button>
                  </div>

                  {filterOpen && (
                    <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <Filter size={13} className="text-emerald-600" />
                        <span className="text-[10px] font-black text-slate-700">
                          Filter tanggal
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          { value: "all" as const, label: "Semua" },
                          { value: "today" as const, label: "Hari ini" },
                          { value: "7days" as const, label: "7 Hari" },
                          { value: "30days" as const, label: "30 Hari" },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setDateFilter(option.value)}
                            className={[
                              "rounded-xl border px-2 py-2 text-[9px] font-extrabold",
                              dateFilter === option.value
                                ? "border-emerald-500 bg-emerald-600 text-white"
                                : "border-slate-200 bg-white text-slate-500 hover:border-emerald-200",
                            ].join(" ")}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setDateFilter("custom")}
                        className="mt-2 flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-[10px] font-bold text-slate-600"
                      >
                        <CalendarDays size={13} />
                        Rentang tanggal custom
                      </button>

                      {dateFilter === "custom" && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <label className="rounded-xl border border-slate-200 bg-white p-2">
                            <span className="mb-1 block text-[8px] font-black uppercase text-slate-400">
                              Dari
                            </span>
                            <input
                              type="date"
                              value={customStartDate}
                              max={customEndDate || getTodayInputValue()}
                              onChange={(event) =>
                                setCustomStartDate(event.target.value)
                              }
                              className="w-full bg-transparent text-[10px] outline-none"
                            />
                          </label>
                          <label className="rounded-xl border border-slate-200 bg-white p-2">
                            <span className="mb-1 block text-[8px] font-black uppercase text-slate-400">
                              Sampai
                            </span>
                            <input
                              type="date"
                              value={customEndDate}
                              min={customStartDate || undefined}
                              max={getTodayInputValue()}
                              onChange={(event) =>
                                setCustomEndDate(event.target.value)
                              }
                              className="w-full bg-transparent text-[10px] outline-none"
                            />
                          </label>
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-[9px] font-semibold text-slate-500">
                          {dateFilterLabel}
                        </span>
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="flex items-center gap-1 text-[9px] font-extrabold text-emerald-700"
                        >
                          <RotateCcw size={11} />
                          Reset
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="max-h-[475px] overflow-y-auto bg-[#FBFDFC]">
                  {notificationLoading && notifications.length === 0 ? (
                    <div className="flex min-h-[180px] items-center justify-center px-6 text-center text-sm font-semibold text-slate-400">
                      Memuat pemberitahuan...
                    </div>
                  ) : notificationError && notifications.length === 0 ? (
                    <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 px-6 text-center">
                      <p className="text-xs text-red-500">{notificationError}</p>
                      <button
                        type="button"
                        onClick={() => void loadNotifications(false)}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-[10px] font-extrabold text-white hover:bg-emerald-700"
                      >
                        Coba Lagi
                      </button>
                    </div>
                  ) : filteredNotifications.length === 0 ? (
                    <div className="flex min-h-[200px] flex-col items-center justify-center px-6 text-center">
                      <CalendarDays size={24} className="text-emerald-600" />
                      <p className="mt-3 text-sm font-black text-slate-700">
                        Tidak ada hasil
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {searchQuery
                          ? `Tidak ditemukan pemberitahuan untuk "${searchQuery}".`
                          : "Tidak ada pemberitahuan pada periode yang dipilih."}
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[9px] font-extrabold text-emerald-700"
                        >
                          <RotateCcw size={12} />
                          Reset filter
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {filteredNotifications.map((item) => {
                        const actor = getNotificationActor(item);
                        const purchaseLabel = getPurchaseLabel(item);
                        const transferLabel = getTransferLabel(item);
                        const link = getNotificationLink(item);
                        const title = item.title || item.type || "Pemberitahuan baru";
                        const message =
                          item.message ||
                          item.description ||
                          "Ada aktivitas baru di MGB ERP.";
                        const isUnread = item.read !== true && !item.readAt;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => void openNotification(item)}
                            className={[
                              "group relative flex w-full gap-3 px-5 py-4 text-left transition",
                              isUnread
                                ? "bg-emerald-50/70 hover:bg-emerald-50"
                                : "bg-white hover:bg-slate-50",
                            ].join(" ")}
                          >
                            {isUnread && (
                              <span className="absolute bottom-0 left-0 top-0 w-1 bg-emerald-500" />
                            )}

                            <div
                              className={[
                                "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                                isUnread
                                  ? "border-emerald-200 bg-white text-emerald-600"
                                  : "border-slate-100 bg-slate-50 text-slate-400",
                              ].join(" ")}
                            >
                              <MessageCircle size={18} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div
                                  className={[
                                    "line-clamp-2 text-[12px] leading-snug",
                                    isUnread
                                      ? "font-black text-slate-800"
                                      : "font-bold text-slate-600",
                                  ].join(" ")}
                                >
                                  {title}
                                </div>
                                {link && (
                                  <ExternalLink
                                    size={13}
                                    className="mt-0.5 shrink-0 text-slate-300 group-hover:text-emerald-500"
                                  />
                                )}
                              </div>

                              <p className="mt-1.5 line-clamp-3 text-[12px] leading-relaxed text-slate-500">
                                {message}
                              </p>

                              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[10px]">
                                <span className="font-extrabold text-sky-600">
                                  {actor}
                                </span>
                                {purchaseLabel && (
                                  <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700">
                                    {purchaseLabel}
                                  </span>
                                )}
                                {transferLabel && (
                                  <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700">
                                    {transferLabel}
                                  </span>
                                )}
                                <span className="text-slate-400">
                                  {formatRelativeTime(item.createdAt)}
                                </span>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center">
                              <ChevronRight
                                size={16}
                                className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-500"
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-emerald-100 bg-white px-5 py-3">
                  <span className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-slate-500">
                    Notification Center LIVE
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[8px] font-black text-slate-400">
                    SYNC 15S
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="hidden h-9 w-px bg-white/30 sm:block" />

          {/* LOGOUT */}
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Keluar"
            title="Keluar"
            className="group flex h-11 items-center gap-2 rounded-xl border border-red-200/30 bg-white/15 px-3 text-red-500 transition hover:border-red-300/50 hover:bg-red-50/30"
          >
            <LogOut
              size={18}
              strokeWidth={2.3}
              className="transition-transform group-hover:translate-x-0.5"
            />
            <span className="hidden text-[10px] font-extrabold uppercase tracking-[0.08em] sm:inline">
              Log Out
            </span>
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes notificationShake {
          0%,
          18%,
          100% {
            transform: rotate(0deg);
          }
          3% {
            transform: rotate(12deg);
          }
          6% {
            transform: rotate(-12deg);
          }
          9% {
            transform: rotate(9deg);
          }
          12% {
            transform: rotate(-7deg);
          }
          15% {
            transform: rotate(4deg);
          }
        }
      `}</style>
    </header>
  );
}
