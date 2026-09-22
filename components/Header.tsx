"use client";

import {
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  ExternalLink,
  LogOut,
  Menu,
  MessageCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

interface HeaderProps {
  onMenuClick?: () => void;
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

function normalizeNotifications(
  payload:
    | NotificationsResponse
    | NotificationItem[]
    | null
    | undefined
): NotificationItem[] {
  if (Array.isArray(payload)) {
    return payload
      .filter(Boolean)
      .map((item, index) => ({
        ...item,
        id:
          item.id ??
          `notification-${index}`,
      }));
  }

  const items =
    payload?.notifications ??
    payload?.data ??
    [];

  return Array.isArray(items)
    ? items
        .filter(Boolean)
        .map((item, index) => ({
          ...item,
          id:
            item.id ??
            `notification-${index}`,
        }))
    : [];
}

function getNotificationActor(
  item: NotificationItem
): string {
  const actor = item.actor;
  const user = item.user;

  return (
    actor?.fullname ||
    actor?.name ||
    actor?.username ||
    user?.fullname ||
    user?.name ||
    user?.username ||
    "User"
  );
}

function getPurchaseLabel(
  item: NotificationItem
): string | null {
  const purchase =
    item.purchase ??
    item.outletPurchase ??
    null;

  const purchaseNumber =
    purchase?.poNumber ||
    purchase?.number ||
    purchase?.code ||
    null;

  if (!purchaseNumber) {
    return null;
  }

  if (
    item.outletPurchaseId ||
    item.outletPurchase
  ) {
    return `PO Outlet ${purchaseNumber}`;
  }

  if (
    item.purchaseId ||
    item.purchase
  ) {
    return `PO Pusat ${purchaseNumber}`;
  }

  return purchaseNumber;
}

function getTransferLabel(
  item: NotificationItem
): string | null {
  const transferNumber =
    item.transferNumber ||
    item.transfer?.number ||
    null;

  if (transferNumber) {
    return `Transfer ${transferNumber}`;
  }

  if (item.transferId) {
    return `Transfer #${item.transferId}`;
  }

  return null;
}

function getNotificationLink(
  item: NotificationItem
): string | null {
  if (item.link) {
    return item.link;
  }

  if (item.href) {
    return item.href;
  }

  if (item.outletPurchaseId) {
    return `/outlet/purchase/${item.outletPurchaseId}`;
  }

  if (item.purchaseId) {
    return `/purchase/${item.purchaseId}`;
  }

  if (item.transferId) {
    return `/outlet/barang-masuk/TRANSFER-${item.transferId}`;
  }

  return null;
}

function formatRelativeTime(
  value: string
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = Date.now();
  const diff =
    now - date.getTime();

  if (diff < 60_000) {
    return "Baru saja";
  }

  const minutes = Math.floor(
    diff / 60_000
  );

  if (minutes < 60) {
    return `${minutes} menit lalu`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) {
    return `${hours} jam lalu`;
  }

  const days = Math.floor(
    hours / 24
  );

  if (days < 7) {
    return `${days} hari lalu`;
  }

  return date.toLocaleDateString(
    "id-ID",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

export default function Header({
  onMenuClick,
}: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const notificationRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const notificationButtonRef =
    useRef<HTMLButtonElement | null>(
      null
    );

  const [modalOpen, setModalOpen] =
    useState(false);

  const [canGoBack, setCanGoBack] =
    useState(false);

  const [
    notificationOpen,
    setNotificationOpen,
  ] = useState(false);

  const [
    notifications,
    setNotifications,
  ] = useState<NotificationItem[]>([]);

  const [
    notificationLoading,
    setNotificationLoading,
  ] = useState(false);

  const [
    notificationError,
    setNotificationError,
  ] = useState("");

  const [
    markingRead,
    setMarkingRead,
  ] = useState(false);

  // =========================================================
  // GLOBAL MODAL DETECTION
  // =========================================================

  useEffect(() => {
    if (
      typeof document ===
      "undefined"
    ) {
      return;
    }

    const syncModalState = () => {
      const body =
        document.body;

      const isModalOpen =
        body.dataset.modalOpen ===
          "true" ||
        Boolean(
          document.querySelector(
            '[data-modal="true"], [role="dialog"][aria-modal="true"]'
          )
        );

      setModalOpen(
        isModalOpen
      );
    };

    syncModalState();

    const observer =
      new MutationObserver(
        syncModalState
      );

    observer.observe(
      document.body,
      {
        attributes: true,
        attributeFilter: [
          "data-modal-open",
          "class",
        ],
        childList: true,
        subtree: true,
      }
    );

    return () => {
      observer.disconnect();
    };
  }, []);

  // =========================================================
  // BROWSER HISTORY
  // =========================================================

  useEffect(() => {
    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }

    const syncHistoryState =
      () => {
        setCanGoBack(
          window.history.length >
            1
        );
      };

    syncHistoryState();

    window.addEventListener(
      "popstate",
      syncHistoryState
    );

    window.addEventListener(
      "pushstate",
      syncHistoryState as EventListener
    );

    window.addEventListener(
      "replacestate",
      syncHistoryState as EventListener
    );

    return () => {
      window.removeEventListener(
        "popstate",
        syncHistoryState
      );

      window.removeEventListener(
        "pushstate",
        syncHistoryState as EventListener
      );

      window.removeEventListener(
        "replacestate",
        syncHistoryState as EventListener
      );
    };
  }, [pathname]);

  // =========================================================
  // BACK BUTTON
  // =========================================================

  const goBack = () => {
    if (canGoBack) {
      router.back();
      return;
    }

    router.push(
      "/outlet/dashboard"
    );
  };

  // =========================================================
  // HEARTBEAT
  // =========================================================

  useEffect(() => {
    let cancelled = false;

    const sendHeartbeat =
      async () => {
        try {
          await fetch(
            "/api/me/heartbeat",
            {
              method: "POST",
              credentials: "include",
              cache: "no-store",
            }
          );
        } catch {
          if (!cancelled) {
            // Silent failure.
          }
        }
      };

    sendHeartbeat();

    const interval =
      window.setInterval(
        sendHeartbeat,
        15_000
      );

    return () => {
      cancelled = true;
      window.clearInterval(
        interval
      );
    };
  }, []);

  // =========================================================
  // LOAD NOTIFICATIONS
  // =========================================================

  const loadNotifications =
    async (
      silent = false
    ) => {
      if (!silent) {
        setNotificationLoading(
          true
        );
      }

      setNotificationError("");

      try {
        const response =
          await fetch(
            "/api/notifications",
            {
              method: "GET",
              credentials: "include",
              cache: "no-store",
              headers: {
                Accept:
                  "application/json",
              },
            }
          );

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        const payload =
          (await response.json()) as
            | NotificationsResponse
            | NotificationItem[];

        const normalized =
          normalizeNotifications(
            payload
          );

        setNotifications(
          normalized
        );
      } catch {
        if (!silent) {
          setNotificationError(
            "Pemberitahuan gagal dimuat. Silakan coba lagi."
          );
        }
      } finally {
        if (!silent) {
          setNotificationLoading(
            false
          );
        }
      }
    };

  useEffect(() => {
    let mounted = true;

    const initialLoad =
      async () => {
        if (!mounted) {
          return;
        }

        await loadNotifications(
          true
        );
      };

    initialLoad();

    const interval =
      window.setInterval(
        () => {
          if (mounted) {
            loadNotifications(
              true
            );
          }
        },
        15_000
      );

    return () => {
      mounted = false;
      window.clearInterval(
        interval
      );
    };
  }, []);

  // =========================================================
  // CLOSE NOTIFICATION WHEN CLICK OUTSIDE
  // =========================================================

  useEffect(() => {
    if (!notificationOpen) {
      return;
    }

    const handleMouseDown = (
      event: MouseEvent
    ) => {
      const target =
        event.target as
          | Node
          | null;

      if (
        notificationRef.current &&
        target &&
        !notificationRef.current.contains(
          target
        )
      ) {
        setNotificationOpen(
          false
        );
      }
    };

    const handleEscape = (
      event: KeyboardEvent
    ) => {
      if (
        event.key ===
        "Escape"
      ) {
        setNotificationOpen(
          false
        );

        notificationButtonRef.current?.focus();
      }
    };

    document.addEventListener(
      "mousedown",
      handleMouseDown
    );

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleMouseDown
      );

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [notificationOpen]);

  // =========================================================
  // UNREAD COUNT
  // =========================================================

  const unreadCount =
    useMemo(() => {
      return notifications.filter(
        (notification) =>
          notification.read !==
            true &&
          !notification.readAt
      ).length;
    }, [notifications]);

  const hasUnread =
    unreadCount > 0;

  // =========================================================
  // MARK ALL AS READ
  // =========================================================

  const markAllAsRead =
    async () => {
      if (
        markingRead ||
        unreadCount === 0
      ) {
        return;
      }

      setMarkingRead(true);

      try {
        const response =
          await fetch(
            "/api/notifications/read-all",
            {
              method: "POST",
              credentials: "include",
              cache: "no-store",
              headers: {
                "Content-Type":
                  "application/json",
                Accept:
                  "application/json",
              },
            }
          );

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        const now =
          new Date().toISOString();

        setNotifications(
          (current) =>
            current.map(
              (
                notification
              ) => ({
                ...notification,
                read: true,
                readAt:
                  notification.readAt ??
                  now,
              })
            )
        );
      } catch {
        setNotificationError(
          "Gagal menandai semua pemberitahuan sebagai dibaca."
        );
      } finally {
        setMarkingRead(
          false
        );
      }
    };

  // =========================================================
  // OPEN NOTIFICATION
  // =========================================================

  const openNotification =
    async (
      item: NotificationItem
    ) => {
      const link =
        getNotificationLink(
          item
        );

      const optimisticReadAt =
        item.readAt ??
        new Date().toISOString();

      setNotifications(
        (current) =>
          current.map(
            (notification) =>
              notification.id ===
              item.id
                ? {
                    ...notification,
                    read: true,
                    readAt:
                      optimisticReadAt,
                  }
                : notification
          )
      );

      setNotificationOpen(
        false
      );

      try {
        const response =
          await fetch(
            "/api/notifications",
            {
              method: "POST",
              credentials: "include",
              cache: "no-store",
              headers: {
                "Content-Type":
                  "application/json",
                Accept:
                  "application/json",
              },
              body: JSON.stringify(
                {
                  notificationId:
                    item.id,
                }
              ),
            }
          );

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        const payload =
          (await response.json()) as {
            ok?: boolean;
            unreadCount?: number;
            readAt?: string | null;
          };

        setNotifications(
          (current) =>
            current.map(
              (
                notification
              ) =>
                notification.id ===
                item.id
                  ? {
                      ...notification,
                      read: true,
                      readAt:
                        payload.readAt ??
                        optimisticReadAt,
                    }
                  : notification
            )
        );
      } catch (error) {
        console.error(
          "[Header] Failed to mark notification as read:",
          error
        );
      }

      if (link) {
        router.push(link);
      }
    };

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout =
    async () => {
      try {
        await fetch(
          "/api/logout",
          {
            method: "POST",
            credentials: "include",
            cache: "no-store",
          }
        );
      } catch {
        // Continue redirect.
      } finally {
        window.location.href =
          "/login";
      }
    };

  // =========================================================
  // HIDDEN WHEN MODAL OPEN
  // =========================================================

  if (modalOpen) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 h-[74px] w-full bg-transparent">
      <div className="flex h-full items-center justify-between px-4 md:px-6">

        {/* =====================================================
            LEFT SIDE
        ===================================================== */}

        <div className="flex min-w-0 items-center gap-2.5 md:gap-3">

          <button
            type="button"
            onClick={goBack}
            disabled={!canGoBack}
            aria-label="Kembali"
            title={
              canGoBack
                ? "Kembali"
                : "Tidak ada halaman sebelumnya"
            }
            className={[
              "group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur-2xl backdrop-saturate-150 transition-all duration-200",
              canGoBack
                ? "border-white/30 bg-white/15 text-emerald-700 shadow-[0_8px_25px_rgba(15,118,110,0.10)] hover:-translate-x-0.5 hover:border-emerald-300/60 hover:bg-white/30 hover:shadow-[0_12px_30px_rgba(15,118,110,0.16)]"
                : "cursor-not-allowed border-white/20 bg-white/10 text-slate-300",
            ].join(" ")}
          >
            <ArrowLeft
              size={18}
              strokeWidth={2.4}
              className="transition-transform duration-200 group-hover:-translate-x-0.5"
            />
          </button>

          <button
            type="button"
            onClick={
              onMenuClick
            }
            aria-label="Buka menu"
            title="Menu"
            className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/15 text-emerald-700 shadow-[0_8px_25px_rgba(15,118,110,0.10)] backdrop-blur-2xl backdrop-saturate-150 transition-all duration-200 hover:border-emerald-300/60 hover:bg-white/30 hover:shadow-[0_12px_30px_rgba(15,118,110,0.16)]"
          >
            <Menu
              size={19}
              strokeWidth={2.5}
              className="transition-transform duration-200 group-hover:scale-105"
            />
          </button>

          <div className="hidden items-center gap-3 sm:flex">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/15 text-xs font-black tracking-tight text-emerald-800 shadow-[0_8px_25px_rgba(15,118,110,0.08)] backdrop-blur-2xl backdrop-saturate-150">
              MGB
            </div>

            <div className="hidden min-w-0 md:block">
              <div className="truncate text-[14px] font-extrabold tracking-tight text-slate-800 drop-shadow-[0_1px_2px_rgba(255,255,255,0.7)]">
                PT. Mitra Garam Bogatama
              </div>

              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.10)]" />
                ERP Dashboard
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================
            RIGHT SIDE
        ===================================================== */}

        <div className="flex shrink-0 items-center gap-2">

          {/* ONLINE */}

          <div className="hidden items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-2 shadow-[0_8px_25px_rgba(15,118,110,0.08)] backdrop-blur-2xl backdrop-saturate-150 lg:flex">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>

            <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-emerald-700">
              System Online
            </span>
          </div>

          {/* SECURITY */}

          <div className="hidden items-center gap-1.5 rounded-xl border border-white/30 bg-white/15 px-3 py-2 shadow-[0_8px_25px_rgba(15,118,110,0.08)] backdrop-blur-2xl backdrop-saturate-150 xl:flex">
            <ShieldCheck
              size={15}
              strokeWidth={2.3}
              className="text-emerald-600"
            />

            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-600">
              Secure
            </span>
          </div>

          {/* ===================================================
              PREMIUM NOTIFICATION CENTER
          =================================================== */}

          <div
            ref={
              notificationRef
            }
            className="relative"
          >

            {/* NOTIFICATION BUTTON */}

            <button
              ref={
                notificationButtonRef
              }
              type="button"
              onClick={() => {
                setNotificationOpen(
                  (current) =>
                    !current
                );

                if (
                  !notificationOpen
                ) {
                  loadNotifications(
                    true
                  );
                }
              }}
              aria-label="Pemberitahuan"
              aria-expanded={
                notificationOpen
              }
              aria-haspopup="dialog"
              title={
                hasUnread
                  ? `${unreadCount} pemberitahuan belum dibaca`
                  : "Pemberitahuan"
              }
              className={[
                "group relative flex h-11 w-11 items-center justify-center overflow-visible rounded-xl border backdrop-blur-2xl backdrop-saturate-150 transition-all duration-300",
                notificationOpen
                  ? "border-emerald-300/70 bg-emerald-100/40 text-emerald-700 shadow-[0_14px_40px_rgba(15,118,110,0.24)]"
                  : hasUnread
                  ? "border-emerald-300/60 bg-white/25 text-emerald-700 shadow-[0_10px_35px_rgba(16,185,129,0.20)] hover:border-emerald-400/70 hover:bg-white/40"
                  : "border-white/30 bg-white/15 text-slate-600 shadow-[0_8px_25px_rgba(15,118,110,0.10)] hover:border-emerald-300/60 hover:bg-white/30 hover:text-emerald-700 hover:shadow-[0_12px_35px_rgba(15,118,110,0.18)]",
              ].join(" ")}
            >

              {/* OUTER GLOW */}

              {hasUnread && (
                <span className="pointer-events-none absolute -inset-1 -z-10 rounded-2xl bg-emerald-400/20 opacity-80 blur-md animate-pulse" />
              )}

              {/* ICON */}

              <span
                className={[
                  "relative flex items-center justify-center",
                  hasUnread &&
                    !notificationOpen
                    ? "animate-[notificationShake_1.8s_ease-in-out_infinite]"
                    : "",
                ].join(" ")}
              >
                <Bell
                  size={20}
                  strokeWidth={2.2}
                  className={[
                    "transition-all duration-300",
                    notificationOpen
                      ? "scale-110"
                      : "group-hover:scale-110",
                  ].join(" ")}
                />
              </span>

              {/* UNREAD PULSE */}

              {hasUnread && (
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />

                  <span className="relative block h-2.5 w-2.5 rounded-full border-2 border-white bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.65)]" />
                </span>
              )}

              {/* COUNT BADGE */}

              {hasUnread && (
                <span className="absolute -right-2.5 -top-2.5 flex min-w-[22px] items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 px-1.5 py-1 text-[9px] font-black leading-none text-white shadow-[0_5px_16px_rgba(16,185,129,0.38)]">
                  <span className="absolute inset-0 rounded-full bg-white/20 blur-[2px]" />

                  <span className="relative">
                    {unreadCount >
                    99
                      ? "99+"
                      : unreadCount}
                  </span>
                </span>
              )}

              {/* ACTIVE INDICATOR */}

              {notificationOpen && (
                <span className="absolute -bottom-1 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-400 to-green-600 shadow-[0_0_12px_rgba(16,185,129,0.55)]" />
              )}
            </button>

            {/* =================================================
                NOTIFICATION PANEL
            ================================================= */}

            {notificationOpen && (
              <div
                role="dialog"
                aria-label="Pemberitahuan"
                className="animate-[notificationPanelIn_180ms_ease-out] absolute right-0 top-[calc(100%+14px)] w-[min(475px,calc(100vw-24px))] overflow-hidden rounded-[26px] border border-emerald-100/80 bg-white shadow-[0_30px_90px_rgba(6,78,59,0.24)] ring-1 ring-black/[0.02]"
              >

                {/* PREMIUM HEADER */}

                <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(110,231,183,0.24),transparent_30%),linear-gradient(135deg,#064E3B,#065F46_48%,#022C22)] px-5 pb-5 pt-5 text-white">

                  <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-emerald-300/15 blur-3xl" />

                  <div className="pointer-events-none absolute -bottom-16 left-1/3 h-36 w-36 rounded-full bg-green-300/10 blur-3xl" />

                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.04)_45%,transparent_70%)]" />

                  <div className="relative flex items-start justify-between gap-3">

                    <div className="flex min-w-0 items-center gap-3">

                      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_25px_rgba(0,0,0,0.12)] backdrop-blur-md">

                        <Bell
                          size={21}
                          strokeWidth={2.2}
                        />

                        {hasUnread && (
                          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center">
                            <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-300/60" />

                            <span className="relative h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.85)]" />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">

                        <div className="flex items-center gap-2">
                          <div className="text-[16px] font-black tracking-tight">
                            Pemberitahuan
                          </div>

                          {hasUnread && (
                            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-emerald-200">
                              Baru
                            </span>
                          )}
                        </div>

                        <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-100/70">
                          MGB ERP Notification Center
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setNotificationOpen(
                          false
                        )
                      }
                      aria-label="Tutup pemberitahuan"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/65 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                    >
                      <X
                        size={17}
                      />
                    </button>
                  </div>

                  {/* HEADER STATUS */}

                  <div className="relative mt-5 grid grid-cols-2 gap-2">

                    <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-2.5 backdrop-blur-sm">
                      <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-emerald-100/55">
                        Status
                      </p>

                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />

                          <span className="relative h-2 w-2 rounded-full bg-emerald-300" />
                        </span>

                        <span className="text-[10px] font-black text-white">
                          LIVE
                        </span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-2.5 backdrop-blur-sm">
                      <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-emerald-100/55">
                        Belum Dibaca
                      </p>

                      <p className="mt-1 text-sm font-black text-white">
                        {unreadCount}
                      </p>
                    </div>
                  </div>

                  {/* ACTION ROW */}

                  <div className="relative mt-3 flex items-center justify-between gap-3">

                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />

                      <span className="text-[9px] font-bold text-emerald-50/80">
                        {unreadCount >
                        0
                          ? `${unreadCount} notifikasi menunggu perhatian`
                          : "Semua notifikasi sudah dibaca"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={
                        markAllAsRead
                      }
                      disabled={
                        markingRead ||
                        unreadCount ===
                          0
                      }
                      className="group flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-3 py-1.5 text-[9px] font-extrabold text-white transition hover:border-white/20 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <Check
                        size={12}
                        className="transition-transform group-hover:scale-110"
                      />

                      {markingRead
                        ? "Memproses..."
                        : "Tandai dibaca"}
                    </button>
                  </div>
                </div>

                {/* BODY */}

                <div className="max-h-[475px] overflow-y-auto bg-[#FBFDFC]">

                  {notificationLoading &&
                  notifications.length ===
                    0 ? (
                    <div className="flex min-h-[250px] flex-col items-center justify-center px-6 text-center">

                      <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-100 bg-white text-emerald-600 shadow-[0_10px_30px_rgba(16,185,129,0.10)]">
                        <span className="absolute inset-0 animate-ping rounded-2xl bg-emerald-100/50" />

                        <Bell
                          size={23}
                          className="relative animate-pulse"
                        />
                      </div>

                      <div className="text-sm font-black text-slate-700">
                        Memuat pemberitahuan
                      </div>

                      <div className="mt-1 text-xs text-slate-400">
                        Mengambil informasi terbaru...
                      </div>

                      <div className="mt-5 h-1 w-24 overflow-hidden rounded-full bg-emerald-50">
                        <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
                      </div>
                    </div>
                  ) : notificationError &&
                    notifications.length ===
                      0 ? (
                    <div className="flex min-h-[250px] flex-col items-center justify-center px-6 text-center">

                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-red-500">
                        <X
                          size={22}
                        />
                      </div>

                      <div className="text-sm font-black text-slate-700">
                        Terjadi masalah
                      </div>

                      <div className="mt-1 max-w-[290px] text-xs leading-relaxed text-slate-400">
                        {
                          notificationError
                        }
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          loadNotifications(
                            false
                          )
                        }
                        className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-[10px] font-extrabold text-white shadow-[0_8px_20px_rgba(16,185,129,0.18)] transition hover:-translate-y-0.5 hover:bg-emerald-700"
                      >
                        Coba Lagi
                      </button>
                    </div>
                  ) : notifications.length ===
                    0 ? (
                    <div className="flex min-h-[270px] flex-col items-center justify-center px-6 text-center">

                      <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 text-emerald-600 shadow-[0_12px_35px_rgba(16,185,129,0.10)]">
                        <div className="absolute inset-2 rounded-2xl border border-emerald-100/80" />

                        <Bell
                          size={25}
                        />
                      </div>

                      <div className="text-sm font-black text-slate-700">
                        Tidak ada pemberitahuan
                      </div>

                      <div className="mt-1 max-w-[280px] text-xs leading-relaxed text-slate-400">
                        Semua aktivitas terbaru akan muncul di sini.
                      </div>

                      <div className="mt-4 flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

                        <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-700">
                          Sistem aktif
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">

                      {notifications.map(
                        (
                          notification
                        ) => {
                          const actor =
                            getNotificationActor(
                              notification
                            );

                          const purchaseLabel =
                            getPurchaseLabel(
                              notification
                            );

                          const transferLabel =
                            getTransferLabel(
                              notification
                            );

                          const link =
                            getNotificationLink(
                              notification
                            );

                          const title =
                            notification.title ||
                            notification.type ||
                            "Pemberitahuan baru";

                          const message =
                            notification.message ||
                            notification.description ||
                            "Ada aktivitas baru di MGB ERP.";

                          const isUnread =
                            notification.read !==
                              true &&
                            !notification.readAt;

                          return (
                            <button
                              key={
                                notification.id
                              }
                              type="button"
                              onClick={() =>
                                openNotification(
                                  notification
                                )
                              }
                              className={[
                                "group relative flex w-full gap-3.5 overflow-hidden px-5 py-4 text-left transition-all duration-200",
                                isUnread
                                  ? "bg-gradient-to-r from-emerald-50/90 via-white to-white hover:from-emerald-50 hover:to-emerald-50/30"
                                  : "bg-white hover:bg-slate-50",
                              ].join(
                                " "
                              )}
                            >

                              {/* UNREAD SIDE ACCENT */}

                              {isUnread && (
                                <span className="absolute bottom-0 left-0 top-0 w-1 bg-gradient-to-b from-emerald-400 via-emerald-500 to-green-600" />
                              )}

                              {/* ICON */}

                              <div
                                className={[
                                  "relative mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-all duration-200",
                                  isUnread
                                    ? "border-emerald-200 bg-white text-emerald-600 shadow-[0_6px_18px_rgba(16,185,129,0.10)] group-hover:-translate-y-0.5 group-hover:shadow-[0_10px_25px_rgba(16,185,129,0.16)]"
                                    : "border-slate-100 bg-slate-50 text-slate-400",
                                ].join(
                                  " "
                                )}
                              >
                                {isUnread && (
                                  <span className="absolute -right-1 -top-1 h-3 w-3">
                                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/50" />

                                    <span className="relative block h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                                  </span>
                                )}

                                <MessageCircle
                                  size={
                                    18
                                  }
                                  strokeWidth={
                                    2.1
                                  }
                                />
                              </div>

                              {/* CONTENT */}

                              <div className="min-w-0 flex-1">

                                <div className="flex items-start justify-between gap-2">

                                  <div
                                    className={[
                                      "line-clamp-2 text-[12px] leading-snug",
                                      isUnread
                                        ? "font-black text-slate-800"
                                        : "font-bold text-slate-600",
                                    ].join(
                                      " "
                                    )}
                                  >
                                    {
                                      title
                                    }
                                  </div>

                                  {link && (
                                    <ExternalLink
                                      size={
                                        13
                                      }
                                      className="mt-0.5 shrink-0 text-slate-300 transition group-hover:text-emerald-500"
                                    />
                                  )}
                                </div>

                                <div
                                  className={[
                                    "mt-1.5 line-clamp-3 text-[12px] leading-relaxed",
                                    isUnread
                                      ? "font-semibold text-slate-600"
                                      : "font-medium text-slate-500",
                                  ].join(
                                    " "
                                  )}
                                >
                                  {
                                    message
                                  }
                                </div>

                                <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">

                                  <span
                                    className={[
                                      "font-extrabold",
                                      isUnread
                                        ? "text-sky-600"
                                        : "text-slate-500",
                                    ].join(
                                      " "
                                    )}
                                  >
                                    {
                                      actor
                                    }
                                  </span>

                                  {purchaseLabel && (
                                    <>
                                      <span className="text-slate-300">
                                        •
                                      </span>

                                      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700">
                                        {
                                          purchaseLabel
                                        }
                                      </span>
                                    </>
                                  )}

                                  {transferLabel && (
                                    <>
                                      <span className="text-slate-300">
                                        •
                                      </span>

                                      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700">
                                        {
                                          transferLabel
                                        }
                                      </span>
                                    </>
                                  )}

                                  <span className="text-slate-300">
                                    •
                                  </span>

                                  <span className="text-[10px] font-semibold text-slate-400">
                                    {formatRelativeTime(
                                      notification.createdAt
                                    )}
                                  </span>
                                </div>
                              </div>

                              {/* CHEVRON */}

                              <div className="flex shrink-0 items-center">

                                <ChevronRight
                                  size={
                                    16
                                  }
                                  className="text-slate-300 transition-all duration-200 group-hover:translate-x-1 group-hover:text-emerald-500"
                                />
                              </div>
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>

                {/* FOOTER */}

                <div className="border-t border-emerald-100 bg-gradient-to-r from-slate-50 via-white to-emerald-50/40 px-5 py-3.5">

                  <div className="flex items-center justify-between gap-3">

                    <div className="flex items-center gap-2">

                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />

                        <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
                      </span>

                      <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
                        Notification Center LIVE
                      </span>
                    </div>

                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[8px] font-black tracking-[0.12em] text-slate-400 shadow-sm">
                      SYNC 15S
                    </span>
                  </div>

                  {notificationError &&
                    notifications.length >
                      0 && (
                      <div className="mt-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-semibold text-red-500">
                        {
                          notificationError
                        }
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>

          {/* DIVIDER */}

          <div className="hidden h-9 w-px bg-white/30 sm:block" />

          {/* LOGOUT */}

          <button
            type="button"
            onClick={
              handleLogout
            }
            aria-label="Keluar"
            title="Keluar"
            className="group flex h-11 items-center gap-2 rounded-xl border border-red-200/30 bg-white/15 px-3 text-red-500 shadow-[0_8px_25px_rgba(15,118,110,0.08)] backdrop-blur-2xl backdrop-saturate-150 transition-all duration-200 hover:border-red-300/50 hover:bg-red-50/30 hover:shadow-[0_12px_30px_rgba(239,68,68,0.12)]"
          >
            <LogOut
              size={18}
              strokeWidth={2.3}
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />

            <span className="hidden text-[10px] font-extrabold uppercase tracking-[0.08em] sm:inline">
              Keluar
            </span>
          </button>
        </div>
      </div>

      {/* =====================================================
          PREMIUM NOTIFICATION ANIMATIONS
      ===================================================== */}

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

        @keyframes notificationPanelIn {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.98);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </header>
  );
}