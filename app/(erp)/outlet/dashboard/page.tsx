"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ShoppingCart,
  PackageCheck,
  Clock3,
  AlertTriangle,
  ClipboardList,
  ArrowRight,
  RefreshCw,
  CalendarDays,
  Boxes,
  ChevronRight,
  FileText,
  Warehouse,
  CheckCircle2,
  CircleAlert,
  Truck,
  Users,
  Activity,
  TrendingUp,
  BarChart3,
  UserCheck,
  ArrowDownToLine,
  ArrowUpFromLine,
  Trash2,
  Sparkles,
  Layers3,
  CircleDollarSign,
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================

type MovementTrend = {
  month: string;
  stockIn: number;
  stockOut: number;
  waste: number;
  net: number;
};

type MovementSummary = {
  stockIn: number;
  stockOut: number;
  waste: number;
  net: number;
};

type DashboardData = {
  totalPurchase: number;
  totalDraft: number;
  totalApproved: number;
  totalReceived: number;
  totalReceipt: number;
  totalStock: number;
  totalStockValue?: number;
  totalStockItem?: number;
  lowStock: number;

  percentages?: {
    approved?: number;
    received?: number;
    draft?: number;
  };

  stockHealth?: {
    totalItem?: number;
    totalStock?: number;
    lowStock?: number;
    healthyItem?: number;
    lowStockPercentage?: number;
    totalStockValue?: number;
  };

  charts?: {
    stockMovementTrend?: MovementTrend[];
    stockMovementSummary?: MovementSummary;

    purchaseTrend?: {
      month: string;
      total: number;
      count: number;
    }[];

    purchaseStatus?: {
      name: string;
      value: number;
    }[];

    lowStockChart?: unknown[];

    transferTrend?: {
      month: string;
      sent: number;
      partial: number;
      received: number;
    }[];
  };

  recentPurchase: {
    id: number;
    number: string;
    purchaseDate: string;
    status: string;
    total: number;
    supplier: {
      code: string;
      name: string;
    };
  }[];
};

type UserData = {
  id: number;
  username: string;
  fullname: string;
  photo?: string | null;
  outlet?: {
    id: number;
    code: string;
    name: string;
  } | null;
};

type OnlineUser = {
  id?: number | string;
  username?: string;
  fullname?: string;
  name?: string;
  role?: string;
  lastSeen?: string;
  updatedAt?: string;
  online?: boolean;
  photo?: string | null;
  outlet?: {
    id?: number;
    code?: string;
    name?: string;
  } | null;
  outletName?: string | null;
  outletCode?: string | null;
};

// ============================================================
// HELPERS
// ============================================================

function cleanNumber(value: unknown): number {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return 0;
  }

  return n;
}

function formatNumber(value: unknown): string {
  return new Intl.NumberFormat("id-ID").format(
    cleanNumber(value)
  );
}

function formatCurrency(value: unknown): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(cleanNumber(value));
}

function formatDate(value: string): string {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("") || "U"
  );
}

function formatUserRole(role?: string): string {
  const normalized = String(role || "")
    .trim()
    .toUpperCase();

  const labels: Record<string, string> = {
    ADMIN: "Admin",
    MANAGER: "Manager",
    OUTLET_ADMIN: "Outlet Admin",
    OUTLET_MANUFACTURE: "Outlet Manufacture",
    STAF_MANUFACTURE: "Staf Manufacture",
    STAFF_MANUFACTURE: "Staff Manufacture",
    STAFF: "Staff",
    USER: "User",
  };

  if (labels[normalized]) {
    return labels[normalized];
  }

  if (!normalized) {
    return "Active User";
  }

  return normalized
    .toLowerCase()
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" ");
}

// ============================================================
// PROFILE AVATAR
// ============================================================

function ProfileAvatar({
  name,
  photo,
  size = "md",
  online = false,
  dark = false,
}: {
  name: string;
  photo?: string | null;
  size?: "sm" | "md" | "lg";
  online?: boolean;
  dark?: boolean;
}) {
  const [imageError, setImageError] =
    useState(false);

  const initials = getInitials(name);

  const sizeClass =
    size === "sm"
      ? "h-10 w-10 text-[10px]"
      : size === "lg"
      ? "h-14 w-14 text-sm"
      : "h-11 w-11 text-xs";

  const onlineClass =
    size === "sm"
      ? "h-3 w-3"
      : size === "lg"
      ? "h-3.5 w-3.5"
      : "h-3 w-3";

  const borderClass = dark
    ? "border-[#071c17]"
    : "border-white";

  return (
    <div className="relative shrink-0">
      <div
        className={`
          relative flex ${sizeClass}
          items-center justify-center
          overflow-hidden rounded-full
          border-2 ${borderClass}
          bg-gradient-to-br from-[#497F70] to-[#18352D]
          font-black text-white
          shadow-[0_4px_14px_rgba(7,28,23,0.18)]
        `}
      >
        {photo && !imageError ? (
          <img
            src={photo}
            alt={name}
            className="h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {online && (
        <span
          aria-label="Online"
          className={`
            absolute bottom-0 right-0
            ${onlineClass}
            rounded-full
            border-2 ${borderClass}
            bg-[#39d98a]
            shadow-[0_0_0_2px_rgba(57,217,138,0.10),0_0_10px_rgba(57,217,138,0.45)]
          `}
        />
      )}
    </div>
  );
}

// ============================================================
// STATUS BADGE
// ============================================================

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized = String(status || "").toUpperCase();

  let className =
    "bg-slate-100 text-slate-600 border-slate-200";

  let label = normalized || "-";

  if (
    normalized === "APPROVED" ||
    normalized === "RECEIVED" ||
    normalized === "COMPLETED" ||
    normalized === "PAID"
  ) {
    className =
      "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (
    normalized === "DRAFT" ||
    normalized === "PENDING"
  ) {
    className =
      "bg-amber-50 text-amber-700 border-amber-200";
  } else if (
    normalized === "CANCELLED" ||
    normalized === "CANCELED" ||
    normalized === "VOID" ||
    normalized === "REJECTED"
  ) {
    className =
      "bg-red-50 text-red-700 border-red-200";
  } else if (
    normalized === "SUBMITTED" ||
    normalized === "PROCESSING"
  ) {
    className =
      "bg-blue-50 text-blue-700 border-blue-200";
  }

  const labels: Record<string, string> = {
    DRAFT: "Draft",
    PENDING: "Pending",
    SUBMITTED: "Submitted",
    APPROVED: "Approved",
    RECEIVED: "Received",
    COMPLETED: "Completed",
    PAID: "Paid",
    CANCELLED: "Cancelled",
    CANCELED: "Canceled",
    VOID: "Void",
    REJECTED: "Rejected",
    PROCESSING: "Processing",
  };

  label = labels[normalized] || normalized;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}

// ============================================================
// KPI CARD
// ============================================================

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  href,
  tone = "emerald",
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
  href?: string;
  tone?:
    | "emerald"
    | "blue"
    | "amber"
    | "purple"
    | "red"
    | "slate";
}) {
  const tones = {
    emerald: {
      icon:
        "bg-emerald-50 text-emerald-700 ring-emerald-100",
      accent: "bg-emerald-500",
      glow:
        "group-hover:shadow-emerald-100/70",
    },
    blue: {
      icon:
        "bg-blue-50 text-blue-700 ring-blue-100",
      accent: "bg-blue-500",
      glow:
        "group-hover:shadow-blue-100/70",
    },
    amber: {
      icon:
        "bg-amber-50 text-amber-700 ring-amber-100",
      accent: "bg-amber-500",
      glow:
        "group-hover:shadow-amber-100/70",
    },
    purple: {
      icon:
        "bg-purple-50 text-purple-700 ring-purple-100",
      accent: "bg-purple-500",
      glow:
        "group-hover:shadow-purple-100/70",
    },
    red: {
      icon:
        "bg-red-50 text-red-700 ring-red-100",
      accent: "bg-red-500",
      glow:
        "group-hover:shadow-red-100/70",
    },
    slate: {
      icon:
        "bg-slate-100 text-slate-700 ring-slate-200",
      accent: "bg-slate-500",
      glow:
        "group-hover:shadow-slate-100/70",
    },
  };

  const selectedTone = tones[tone];

  const content = (
    <div
      className={`group relative h-full min-h-[165px] overflow-hidden rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${selectedTone.glow}`}
    >
      <div
        className={`absolute left-0 top-0 h-1 w-full ${selectedTone.accent}`}
      />

      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-4 ${selectedTone.icon}`}
        >
          <Icon
            size={22}
            strokeWidth={2.2}
          />
        </div>

        {href && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition group-hover:bg-slate-900 group-hover:text-white">
            <ChevronRight size={16} />
          </div>
        )}
      </div>

      <div className="mt-5">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          {title}
        </div>

        <div className="mt-1 text-[27px] font-black tracking-tight text-slate-900">
          {value}
        </div>

        <div className="mt-1 text-xs font-medium text-slate-500">
          {subtitle}
        </div>
      </div>

      <div className="pointer-events-none absolute -bottom-10 -right-10 h-28 w-28 rounded-full bg-slate-100/70 blur-2xl transition group-hover:scale-150" />
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link
      href={href}
      className="block h-full"
    >
      {content}
    </Link>
  );
}

// ============================================================
// QUICK MENU
// ============================================================

function QuickMenu({
  href,
  title,
  description,
  icon: Icon,
  number,
}: {
  href: string;
  title: string;
  description: string;
  icon: any;
  number: string;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_6px_24px_rgba(15,23,42,0.035)] transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 transition group-hover:bg-emerald-50 group-hover:text-emerald-700">
          <Icon size={20} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-slate-900">
            {title}
          </div>

          <div className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
            {description}
          </div>
        </div>

        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-50 text-[9px] font-black text-slate-400 transition group-hover:bg-emerald-600 group-hover:text-white">
          {number}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-emerald-500 transition-all duration-300 group-hover:w-full" />
    </Link>
  );
}

// ============================================================
// MOVEMENT SUMMARY CARD
// ============================================================

function MovementSummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: any;
  variant: "in" | "out" | "waste" | "net";
}) {
  const styles = {
    in: {
      box: "bg-emerald-50 text-emerald-700",
      value: "text-emerald-800",
      dot: "bg-emerald-500",
    },
    out: {
      box: "bg-blue-50 text-blue-700",
      value: "text-blue-800",
      dot: "bg-blue-500",
    },
    waste: {
      box: "bg-red-50 text-red-700",
      value: "text-red-800",
      dot: "bg-red-500",
    },
    net: {
      box: "bg-slate-100 text-slate-700",
      value: "text-slate-900",
      dot: "bg-slate-700",
    },
  };

  const style = styles[variant];

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${style.box}`}
        >
          <Icon size={17} />
        </div>

        <span
          className={`mt-1 h-2 w-2 rounded-full ${style.dot}`}
        />
      </div>

      <div className="mt-4">
        <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
          {title}
        </div>

        <div
          className={`mt-1 text-xl font-black tracking-tight ${style.value}`}
        >
          {formatNumber(value)}
        </div>

        <div className="mt-0.5 text-[10px] font-medium text-slate-400">
          {subtitle}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MOVEMENT CHART
// ============================================================

function MovementChart({
  data,
}: {
  data: MovementTrend[];
}) {
  const width = 1100;
  const height = 390;

  const paddingLeft = 68;
  const paddingRight = 28;
  const paddingTop = 34;
  const paddingBottom = 58;

  const chartWidth =
    width - paddingLeft - paddingRight;

  const chartHeight =
    height - paddingTop - paddingBottom;

  const [hoveredIndex, setHoveredIndex] =
    useState<number | null>(null);

  const normalizedData =
    data.length > 0
      ? data
      : Array.from({ length: 6 }).map(
          (_, index) => ({
            month: `Bulan ${index + 1}`,
            stockIn: 0,
            stockOut: 0,
            waste: 0,
            net: 0,
          })
        );

  const maxValue = Math.max(
    1,
    ...normalizedData.flatMap((item) => [
      cleanNumber(item.stockIn),
      cleanNumber(item.stockOut),
      cleanNumber(item.waste),
    ])
  );

  const tickStep =
    maxValue <= 10
      ? 2
      : maxValue <= 50
      ? 10
      : maxValue <= 100
      ? 20
      : maxValue <= 500
      ? 100
      : Math.pow(
          10,
          Math.max(
            0,
            Math.floor(Math.log10(maxValue)) - 1
          )
        ) * 2;

  const roundedMax = Math.max(
    tickStep,
    Math.ceil(maxValue / tickStep) * tickStep
  );

  const getX = (index: number) => {
    if (normalizedData.length === 1) {
      return paddingLeft + chartWidth / 2;
    }

    return (
      paddingLeft +
      (index / (normalizedData.length - 1)) *
        chartWidth
    );
  };

  const getY = (value: number) => {
    const safeValue = Math.max(
      0,
      cleanNumber(value)
    );

    return (
      paddingTop +
      chartHeight -
      (safeValue / roundedMax) *
        chartHeight
    );
  };

  const buildSmoothPath = (
    key: keyof Pick<
      MovementTrend,
      "stockIn" | "stockOut" | "waste"
    >
  ) => {
    const points = normalizedData.map(
      (item, index) => ({
        x: getX(index),
        y: getY(cleanNumber(item[key])),
      })
    );

    if (points.length === 0) {
      return "";
    }

    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y}`;
    }

    let path =
      `M ${points[0].x} ${points[0].y}`;

    for (
      let index = 0;
      index < points.length - 1;
      index++
    ) {
      const current = points[index];
      const next = points[index + 1];

      const controlX =
        (current.x + next.x) / 2;

      path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
    }

    return path;
  };

  const buildAreaPath = (
    key: keyof Pick<
      MovementTrend,
      "stockIn" | "stockOut"
    >
  ) => {
    const points = normalizedData.map(
      (item, index) => ({
        x: getX(index),
        y: getY(cleanNumber(item[key])),
      })
    );

    if (points.length === 0) {
      return "";
    }

    const linePath =
      buildSmoothPath(key);

    const first = points[0];
    const last =
      points[points.length - 1];

    const bottom =
      paddingTop + chartHeight;

    return [
      linePath,
      `L ${last.x} ${bottom}`,
      `L ${first.x} ${bottom}`,
      "Z",
    ].join(" ");
  };

  const gridCount = 5;

  const gridValues =
    Array.from({
      length: gridCount + 1,
    }).map((_, index) => {
      return (
        roundedMax -
        (roundedMax / gridCount) * index
      );
    });

  const hovered =
    hoveredIndex !== null
      ? normalizedData[hoveredIndex]
      : null;

  const hoveredX =
    hoveredIndex !== null
      ? getX(hoveredIndex)
      : null;

  return (
    <div className="relative w-full">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
            Movement Trend
          </div>

          <div className="mt-1 text-xs font-bold text-slate-600">
            Volume pergerakan inventory
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Masuk
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-700">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Keluar
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-[10px] font-bold text-red-700">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Waste
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[22px] border border-slate-100 bg-gradient-to-b from-slate-50/80 via-white to-white p-2 sm:p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full min-w-[760px]"
          preserveAspectRatio="none"
          onMouseLeave={() =>
            setHoveredIndex(null)
          }
        >
          <defs>
            <linearGradient
              id="movementInGradientPremium"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="#10b981"
                stopOpacity="0.20"
              />
              <stop
                offset="55%"
                stopColor="#10b981"
                stopOpacity="0.07"
              />
              <stop
                offset="100%"
                stopColor="#10b981"
                stopOpacity="0"
              />
            </linearGradient>

            <linearGradient
              id="movementOutGradientPremium"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="#3b82f6"
                stopOpacity="0.14"
              />
              <stop
                offset="55%"
                stopColor="#3b82f6"
                stopOpacity="0.05"
              />
              <stop
                offset="100%"
                stopColor="#3b82f6"
                stopOpacity="0"
              />
            </linearGradient>

            <filter
              id="movementGreenGlow"
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur
                stdDeviation="4"
                result="blur"
              />

              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter
              id="movementBlueGlow"
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur
                stdDeviation="4"
                result="blur"
              />

              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter
              id="movementPointShadow"
              x="-100%"
              y="-100%"
              width="300%"
              height="300%"
            >
              <feDropShadow
                dx="0"
                dy="2"
                stdDeviation="2"
                floodOpacity="0.16"
              />
            </filter>
          </defs>

          {gridValues.map(
            (value, index) => {
              const percent =
                index / gridCount;

              const y =
                paddingTop +
                chartHeight -
                percent * chartHeight;

              return (
                <g
                  key={`grid-${index}`}
                >
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={
                      width -
                      paddingRight
                    }
                    y2={y}
                    stroke="#e2e8f0"
                    strokeWidth={
                      index === gridCount
                        ? 1.3
                        : 1
                    }
                    strokeDasharray={
                      index === gridCount
                        ? undefined
                        : "3 6"
                    }
                  />

                  <text
                    x={paddingLeft - 12}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fontWeight="700"
                    fill="#94a3b8"
                  >
                    {formatNumber(value)}
                  </text>
                </g>
              );
            }
          )}

          {normalizedData.map(
            (item, index) => {
              const x = getX(index);

              return (
                <line
                  key={`vertical-${item.month}-${index}`}
                  x1={x}
                  y1={paddingTop}
                  x2={x}
                  y2={
                    paddingTop +
                    chartHeight
                  }
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
              );
            }
          )}

          {normalizedData.length > 0 && (
            <rect
              x={Math.max(
                paddingLeft,
                getX(
                  normalizedData.length - 1
                ) - 42
              )}
              y={paddingTop}
              width="84"
              height={chartHeight}
              rx="16"
              fill="#10b981"
              opacity="0.025"
            />
          )}

          <path
            d={buildAreaPath("stockIn")}
            fill="url(#movementInGradientPremium)"
          />

          <path
            d={buildAreaPath("stockOut")}
            fill="url(#movementOutGradientPremium)"
          />

          <path
            d={buildSmoothPath("stockIn")}
            fill="none"
            stroke="#10b981"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.08"
            filter="url(#movementGreenGlow)"
          />

          <path
            d={buildSmoothPath("stockOut")}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.07"
            filter="url(#movementBlueGlow)"
          />

          <path
            d={buildSmoothPath("waste")}
            fill="none"
            stroke="#ef4444"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="7 6"
          />

          <path
            d={buildSmoothPath("stockIn")}
            fill="none"
            stroke="#10b981"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            d={buildSmoothPath("stockOut")}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {normalizedData.map(
            (item, index) => {
              const x = getX(index);

              const stockInY =
                getY(item.stockIn);

              const stockOutY =
                getY(item.stockOut);

              const wasteY =
                getY(item.waste);

              const active =
                hoveredIndex === index;

              return (
                <g
                  key={`points-${index}`}
                  className="cursor-crosshair"
                  onMouseEnter={() =>
                    setHoveredIndex(index)
                  }
                >
                  <rect
                    x={x - 30}
                    y={paddingTop}
                    width="60"
                    height={chartHeight}
                    fill="transparent"
                  />

                  {active && (
                    <line
                      x1={x}
                      y1={paddingTop}
                      x2={x}
                      y2={
                        paddingTop +
                        chartHeight
                      }
                      stroke="#64748b"
                      strokeWidth="1"
                      strokeDasharray="4 5"
                      opacity="0.65"
                    />
                  )}

                  <circle
                    cx={x}
                    cy={stockInY}
                    r={active ? 7 : 4.5}
                    fill="white"
                    stroke="#10b981"
                    strokeWidth={
                      active ? 3.5 : 2.5
                    }
                    filter={
                      active
                        ? "url(#movementPointShadow)"
                        : undefined
                    }
                  />

                  <circle
                    cx={x}
                    cy={stockOutY}
                    r={active ? 7 : 4.5}
                    fill="white"
                    stroke="#3b82f6"
                    strokeWidth={
                      active ? 3.5 : 2.5
                    }
                    filter={
                      active
                        ? "url(#movementPointShadow)"
                        : undefined
                    }
                  />

                  <circle
                    cx={x}
                    cy={wasteY}
                    r={active ? 5 : 3}
                    fill="white"
                    stroke="#ef4444"
                    strokeWidth={
                      active ? 2.5 : 2
                    }
                  />
                </g>
              );
            }
          )}

          {normalizedData.map(
            (item, index) => (
              <text
                key={`label-${item.month}-${index}`}
                x={getX(index)}
                y={height - 19}
                textAnchor="middle"
                fontSize="10"
                fontWeight="800"
                fill={
                  hoveredIndex === index
                    ? "#0f172a"
                    : "#94a3b8"
                }
              >
                {item.month}
              </text>
            )
          )}

          {hovered &&
            hoveredX !== null && (
              <g
                pointerEvents="none"
                transform={`translate(${
                  hoveredX > width - 230
                    ? hoveredX - 218
                    : hoveredX + 14
                }, ${paddingTop + 8})`}
              >
                <rect
                  width="204"
                  height="132"
                  rx="14"
                  fill="white"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  filter="url(#movementPointShadow)"
                />

                <text
                  x="15"
                  y="23"
                  fontSize="10"
                  fontWeight="900"
                  fill="#0f172a"
                >
                  {hovered.month}
                </text>

                <line
                  x1="15"
                  y1="34"
                  x2="189"
                  y2="34"
                  stroke="#f1f5f9"
                />

                <circle
                  cx="20"
                  cy="52"
                  r="4"
                  fill="#10b981"
                />

                <text
                  x="31"
                  y="56"
                  fontSize="9"
                  fontWeight="700"
                  fill="#64748b"
                >
                  Barang Masuk
                </text>

                <text
                  x="188"
                  y="56"
                  textAnchor="end"
                  fontSize="10"
                  fontWeight="900"
                  fill="#047857"
                >
                  {formatNumber(
                    hovered.stockIn
                  )}
                </text>

                <circle
                  cx="20"
                  cy="78"
                  r="4"
                  fill="#3b82f6"
                />

                <text
                  x="31"
                  y="82"
                  fontSize="9"
                  fontWeight="700"
                  fill="#64748b"
                >
                  Barang Keluar
                </text>

                <text
                  x="188"
                  y="82"
                  textAnchor="end"
                  fontSize="10"
                  fontWeight="900"
                  fill="#1d4ed8"
                >
                  {formatNumber(
                    hovered.stockOut
                  )}
                </text>

                <circle
                  cx="20"
                  cy="104"
                  r="4"
                  fill="#ef4444"
                />

                <text
                  x="31"
                  y="108"
                  fontSize="9"
                  fontWeight="700"
                  fill="#64748b"
                >
                  Waste
                </text>

                <text
                  x="188"
                  y="108"
                  textAnchor="end"
                  fontSize="10"
                  fontWeight="900"
                  fill="#dc2626"
                >
                  {formatNumber(
                    hovered.waste
                  )}
                </text>
              </g>
            )}
        </svg>
      </div>

      {normalizedData.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700">
                Periode Terakhir
              </span>

              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>

            <div className="mt-1 text-sm font-black text-emerald-900">
              {formatNumber(
                normalizedData[
                  normalizedData.length - 1
                ].stockIn
              )}{" "}
              masuk
            </div>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-blue-700">
                Barang Keluar
              </span>

              <span className="h-2 w-2 rounded-full bg-blue-500" />
            </div>

            <div className="mt-1 text-sm font-black text-blue-900">
              {formatNumber(
                normalizedData[
                  normalizedData.length - 1
                ].stockOut
              )}{" "}
              keluar
            </div>
          </div>

          <div className="rounded-2xl border border-red-100 bg-red-50/60 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-red-700">
                Waste
              </span>

              <span className="h-2 w-2 rounded-full bg-red-500" />
            </div>

            <div className="mt-1 text-sm font-black text-red-900">
              {formatNumber(
                normalizedData[
                  normalizedData.length - 1
                ].waste
              )}{" "}
              waste
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN
// ============================================================

export default function OutletDashboardPage() {
  const [data, setData] =
    useState<DashboardData | null>(null);

  const [user, setUser] =
    useState<UserData | null>(null);

  const [onlineUsers, setOnlineUsers] =
    useState<OnlineUser[]>([]);

  const [onlineLoading, setOnlineLoading] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  // ==========================================================
  // LOAD DASHBOARD
  // ==========================================================

  async function loadDashboard(
    showRefresh = false
  ) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await fetch(
        "/api/outlet/dashboard",
        {
          cache: "no-store",
        }
      );

      const json =
        await response.json();

      if (
        !response.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
            "Gagal memuat dashboard outlet."
        );
      }

      setData(json.data || null);
      setUser(json.user || null);
    } catch (err: any) {
      console.error(
        "OUTLET DASHBOARD ERROR:",
        err
      );

      setError(
        err?.message ||
          "Terjadi kesalahan saat memuat dashboard."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // ==========================================================
  // LOAD ONLINE USERS
  // ==========================================================

  async function loadOnlineUsers() {
    try {
      setOnlineLoading(true);

      const response = await fetch(
        "/api/me/online-users",
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        return;
      }

      const json =
        await response.json();

      if (!json?.success) {
        return;
      }

      const users =
        json.users ??
        json.data ??
        json.onlineUsers ??
        [];

      if (Array.isArray(users)) {
        setOnlineUsers(users);
      }
    } catch (err) {
      console.error(
        "OUTLET ONLINE USERS ERROR:",
        err
      );
    } finally {
      setOnlineLoading(false);
    }
  }

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    loadDashboard();
    loadOnlineUsers();

    const interval =
      window.setInterval(() => {
        loadOnlineUsers();
      }, 15000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  // ==========================================================
  // TODAY
  // ==========================================================

  const today = useMemo(() => {
    return new Date().toLocaleDateString(
      "id-ID",
      {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }
    );
  }, []);

  // ==========================================================
  // NORMALIZED DATA
  // ==========================================================

  const recentPurchases =
    Array.isArray(data?.recentPurchase)
      ? data.recentPurchase
      : [];

  const totalPurchase =
    cleanNumber(data?.totalPurchase);

  const totalDraft =
    cleanNumber(data?.totalDraft);

  const totalApproved =
    cleanNumber(data?.totalApproved);

  const totalReceived =
    cleanNumber(data?.totalReceived);

  const totalReceipt =
    cleanNumber(data?.totalReceipt);

  const totalStock =
    cleanNumber(data?.totalStock);

  const lowStock =
    cleanNumber(data?.lowStock);

  // ==========================================================
  // NILAI PERSEDIAAN
  // ==========================================================

  const totalStockValue =
    cleanNumber(
      data?.totalStockValue ??
        data?.stockHealth?.totalStockValue
    );

  // ==========================================================
  // MOVEMENT
  // ==========================================================

  const movementTrend =
    Array.isArray(
      data?.charts?.stockMovementTrend
    )
      ? data.charts.stockMovementTrend
      : [];

  const movementSummary =
    data?.charts?.stockMovementSummary;

  const stockIn =
    cleanNumber(
      movementSummary?.stockIn ??
        movementTrend.reduce(
          (sum, item) =>
            sum + cleanNumber(item.stockIn),
          0
        )
    );

  const stockOut =
    cleanNumber(
      movementSummary?.stockOut ??
        movementTrend.reduce(
          (sum, item) =>
            sum + cleanNumber(item.stockOut),
          0
        )
    );

  const waste =
    cleanNumber(
      movementSummary?.waste ??
        movementTrend.reduce(
          (sum, item) =>
            sum + cleanNumber(item.waste),
          0
        )
    );

  const netMovement =
    cleanNumber(
      movementSummary?.net ??
        stockIn -
          stockOut -
          waste
    );

  // ==========================================================
  // USER
  // ==========================================================

  const outletName =
    user?.outlet?.name ||
    "Outlet";

  const outletCode =
    user?.outlet?.code ||
    "-";

  const displayName =
    user?.fullname ||
    user?.username ||
    "User";

  const currentOnlineUser =
    user?.id
      ? onlineUsers.find(
          (onlineUser) =>
            String(onlineUser.id) ===
            String(user.id)
        )
      : undefined;

  const currentUserPhoto =
    user?.photo ||
    currentOnlineUser?.photo ||
    null;

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#f5f7f6]">
        <div className="mx-auto max-w-[1700px] px-4 py-5 sm:px-6 lg:px-8">
          <div className="h-[420px] animate-pulse rounded-[32px] bg-slate-200" />

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {Array.from({ length: 7 }).map(
              (_, index) => (
                <div
                  key={index}
                  className="h-[165px] animate-pulse rounded-[24px] bg-slate-200"
                />
              )
            )}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="h-[530px] animate-pulse rounded-[26px] bg-slate-200 xl:col-span-2" />
            <div className="h-[530px] animate-pulse rounded-[26px] bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================
  // ERROR
  // ==========================================================

  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#f5f7f6] px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="overflow-hidden rounded-[28px] border border-red-200 bg-white shadow-xl">
            <div className="bg-[#071c17] p-8 text-white">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/20 text-red-300">
                <CircleAlert size={28} />
              </div>

              <h1 className="mt-5 text-2xl font-black">
                Dashboard tidak dapat dimuat
              </h1>

              <p className="mt-2 text-sm text-white/60">
                {error}
              </p>
            </div>

            <div className="p-6">
              <button
                type="button"
                onClick={() =>
                  loadDashboard(true)
                }
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 transition hover:bg-emerald-800"
              >
                <RefreshCw size={17} />
                Coba Lagi
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================
  // MAIN
  // ==========================================================

  return (
    <div className="min-h-screen bg-[#f5f7f6] text-slate-900">
      <div className="mx-auto max-w-[1700px] px-4 py-5 sm:px-6 lg:px-8">

        {/* ====================================================
            HERO
        ==================================================== */}

        <section className="relative overflow-hidden rounded-[32px] bg-[#071c17] shadow-[0_25px_70px_rgba(7,28,23,0.18)]">

          {/* DECORATIVE GLOW */}

          <div className="pointer-events-none absolute -right-24 -top-32 h-[430px] w-[430px] rounded-full bg-emerald-400/20 blur-3xl" />

          <div className="pointer-events-none absolute -bottom-48 left-[35%] h-[500px] w-[500px] rounded-full bg-teal-400/10 blur-3xl" />

          <div className="pointer-events-none absolute right-[38%] top-10 h-28 w-28 rounded-full bg-lime-300/10 blur-3xl" />

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.07),transparent_28%)]" />

          <div className="relative p-6 sm:p-8 lg:p-10">

            <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">

              {/* ==================================================
                  HERO LEFT
              ================================================== */}

              <div className="max-w-3xl">

                <div className="flex flex-wrap items-center gap-2">

                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200 backdrop-blur">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    Outlet Dashboard
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-white/60">
                    {outletCode}
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-bold text-emerald-300">
                    <Sparkles size={11} />
                    LIVE
                  </span>

                </div>

                <div className="mt-5 flex items-center gap-4">

                  <ProfileAvatar
                    name={displayName}
                    photo={currentUserPhoto}
                    size="lg"
                    online
                    dark
                  />

                  <div className="min-w-0">

                    <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-4xl">
                      PT. MITRA GARAM BOGATAMA
                    </h1>

                    <div className="mt-1 text-lg font-bold text-emerald-300 sm:text-xl">
                      Selamat datang
                      <span className="mx-2 text-white/30">
                        -
                      </span>
                      {displayName}
                      <span className="ml-2 text-white/30">
                        -
                      </span>
                    </div>

                  </div>

                </div>

                <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55 sm:text-base">
                  Pantau pembelian, penerimaan,
                  pergerakan barang, persediaan,
                  nilai persediaan, waste dan
                  aktivitas outlet dari satu pusat
                  kontrol.
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-3">

                  <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs font-semibold text-white/70 backdrop-blur">
                    <CalendarDays
                      size={15}
                      className="text-emerald-300"
                    />
                    {today}
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs font-semibold text-white/70 backdrop-blur">
                    <Warehouse
                      size={15}
                      className="text-emerald-300"
                    />
                    {outletName}
                  </div>

                </div>

              </div>

              {/* ==================================================
                  HERO RIGHT — ACTIVE USERS
              ================================================== */}

              <div className="w-full xl:max-w-[640px]">

                <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.07] shadow-2xl backdrop-blur-xl">

                  {/* TOP BAR */}

                  <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-4 py-3.5 sm:px-5">

                    <div className="flex min-w-0 items-center gap-3">

                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/10 bg-emerald-400/10 text-emerald-300">
                        <CalendarDays
                          size={17}
                          strokeWidth={1.8}
                        />
                      </div>

                      <div className="min-w-0">

                        <div className="text-[8px] font-black uppercase tracking-[0.20em] text-white/35">
                          Hari Ini
                        </div>

                        <div className="mt-0.5 truncate text-[10px] font-bold text-white/90 sm:text-[11px]">
                          {today}
                        </div>

                      </div>

                    </div>

                    <div className="flex shrink-0 items-center gap-2">

                      <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/10 bg-emerald-400/10 px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-emerald-300">

                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)]" />

                        {onlineLoading
                          ? "SYNC"
                          : `${onlineUsers.length} ONLINE`}

                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          loadOnlineUsers()
                        }
                        disabled={onlineLoading}
                        aria-label="Refresh user online"
                        title="Refresh user online"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/45 transition hover:border-emerald-300/20 hover:bg-emerald-400/10 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RefreshCw
                          size={14}
                          className={
                            onlineLoading
                              ? "animate-spin"
                              : ""
                          }
                        />
                      </button>

                    </div>

                  </div>

                  {/* ACTIVE USERS */}

                  <div className="px-4 py-3.5 sm:px-5">

                    <div className="mb-2.5 flex items-center justify-between">

                      <div className="flex items-center gap-2">

                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300">
                          <Users size={12} />
                        </div>

                        <div className="text-[8px] font-black uppercase tracking-[0.16em] text-white/45">
                          Active Users
                        </div>

                      </div>

                      <div className="text-[8px] font-black uppercase tracking-[0.14em] text-emerald-300/70">
                        LIVE
                      </div>

                    </div>

                    {onlineUsers.length > 0 ? (
                      <>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">

                          {onlineUsers
                            .slice(0, 2)
                            .map(
                              (
                                onlineUser,
                                index
                              ) => {

                                const name =
                                  onlineUser.fullname ||
                                  onlineUser.name ||
                                  onlineUser.username ||
                                  "User";

                                const roleLabel =
                                  formatUserRole(
                                    onlineUser.role
                                  );

                                const onlineOutlet =
                                  onlineUser.outlet?.name ||
                                  onlineUser.outletName ||
                                  onlineUser.outlet?.code ||
                                  onlineUser.outletCode ||
                                  (onlineUser.id &&
                                  user?.id &&
                                  String(
                                    onlineUser.id
                                  ) ===
                                    String(
                                      user.id
                                    )
                                    ? outletName
                                    : "");

                                const detail =
                                  onlineOutlet
                                    ? `${roleLabel} • ${onlineOutlet}`
                                    : roleLabel;

                                return (
                                  <div
                                    key={
                                      onlineUser.id ??
                                      `${name}-${index}`
                                    }
                                    className="flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2.5 transition hover:border-emerald-300/15 hover:bg-white/[0.055]"
                                  >

                                    <ProfileAvatar
                                      name={name}
                                      photo={
                                        onlineUser.photo
                                      }
                                      size="sm"
                                      online
                                      dark
                                    />

                                    <div className="min-w-0 flex-1">

                                      <div className="truncate text-[10px] font-black text-white/90">
                                        {name}
                                      </div>

                                      <div className="mt-0.5 truncate text-[8px] font-medium text-white/35">
                                        {detail}
                                      </div>

                                    </div>

                                    <div className="flex shrink-0 items-center gap-1.5 text-[7px] font-bold uppercase tracking-[0.10em] text-emerald-300/70">

                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_7px_rgba(52,211,211,0.55)]" />

                                      Active

                                    </div>

                                  </div>
                                );
                              }
                            )}

                        </div>

                        {onlineUsers.length > 2 && (
                          <div className="mt-2 text-center text-[8px] font-semibold text-white/30">
                            +{onlineUsers.length - 2} user
                            lainnya sedang aktif
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="rounded-xl border border-white/[0.07] bg-black/10 px-3 py-3 text-center">

                        <div className="text-[9px] font-bold text-white/40">
                          Belum ada user online
                        </div>

                        <div className="mt-0.5 text-[8px] text-white/20">
                          Menunggu aktivitas pengguna...
                        </div>

                      </div>
                    )}

                    {/* SYSTEM STATUS */}

                    <div className="mt-2.5 grid grid-cols-2 gap-2">

                      <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2">

                        <div className="flex items-center justify-between">

                          <span className="text-[7px] font-black uppercase tracking-[0.12em] text-white/30">
                            ERP Core
                          </span>

                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,211,0.55)]" />

                        </div>

                        <div className="mt-1 text-[9px] font-black text-white/75">
                          Operational
                        </div>

                      </div>

                      <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2">

                        <div className="flex items-center justify-between">

                          <span className="text-[7px] font-black uppercase tracking-[0.12em] text-white/30">
                            Monitoring
                          </span>

                          <Activity
                            size={10}
                            className="text-emerald-300"
                          />

                        </div>

                        <div className="mt-1 text-[9px] font-black text-white/75">
                          Active
                        </div>

                      </div>

                    </div>

                  </div>

                </div>

              </div>

            </div>

            {/* ==================================================
                HERO INVENTORY CONTROL
                NILAI PERSEDIAAN — COMPACT
            ================================================== */}

            <div className="mt-7 border-t border-white/[0.07] pt-5">

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

                {/* LABEL */}

                <div className="flex items-center gap-3">

                  <span className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300/55">
                    Inventory Control
                  </span>

                  <span className="h-1 w-1 rounded-full bg-white/20" />

                  <span className="text-[10px] font-medium text-white/30">
                    {outletName}
                  </span>

                </div>

                {/* HORIZONTAL METRICS */}

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">

                  {/* NILAI PERSEDIAAN */}

                  <Link
                    href="/outlet/stock"
                    className="group inline-flex items-center gap-2 transition"
                  >
                    <CircleDollarSign
                      size={13}
                      strokeWidth={2}
                      className="text-emerald-300/65 transition group-hover:text-emerald-300"
                    />

                    <span className="text-[8px] font-black uppercase tracking-[0.12em] text-white/30">
                      Nilai Persediaan
                    </span>

                    <span className="text-sm font-black tracking-tight text-emerald-300">
                      {formatCurrency(
                        totalStockValue
                      )}
                    </span>
                  </Link>

                  <span className="hidden h-4 w-px bg-white/10 sm:block" />

                  {/* ACTIVITY */}

                  <Link
                    href="/outlet/stock"
                    className="group inline-flex items-center gap-2 transition"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]" />

                    <span className="text-[8px] font-black uppercase tracking-[0.12em] text-white/30">
                      Activity
                    </span>

                    <span className="text-xs font-black text-emerald-300">
                      Active
                    </span>
                  </Link>

                  <span className="hidden h-4 w-px bg-white/10 sm:block" />

                  {/* STOCK ALERT */}

                  <Link
                    href="/outlet/stock"
                    className="group inline-flex items-center gap-2 transition"
                  >
                    <AlertTriangle
                      size={13}
                      strokeWidth={2}
                      className={
                        lowStock > 0
                          ? "text-amber-300"
                          : "text-emerald-300/65"
                      }
                    />

                    <span className="text-[8px] font-black uppercase tracking-[0.12em] text-white/30">
                      Stock Alert
                    </span>

                    <span
                      className={`text-sm font-black tracking-tight ${
                        lowStock > 0
                          ? "text-amber-300"
                          : "text-emerald-300"
                      }`}
                    >
                      {formatNumber(lowStock)}
                    </span>

                    <span className="text-[8px] font-medium text-white/25">
                      item
                    </span>
                  </Link>

                  <span className="hidden h-4 w-px bg-white/10 sm:block" />

                  {/* ACTIVE USERS */}

                  <div className="inline-flex items-center gap-2">

                    <Users
                      size={13}
                      strokeWidth={2}
                      className="text-emerald-300/60"
                    />

                    <span className="text-[8px] font-black uppercase tracking-[0.12em] text-white/30">
                      Active Users
                    </span>

                    <span className="text-sm font-black tracking-tight text-white">
                      {onlineLoading
                        ? "..."
                        : onlineUsers.length}
                    </span>

                    <span className="text-[8px] font-medium text-white/25">
                      online
                    </span>

                  </div>

                </div>

              </div>

            </div>

          </div>

        </section>

        {/* ====================================================
            KPI
        ==================================================== */}

        <section className="mt-5">

          <div className="mb-4 flex items-end justify-between">

            <div>

              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                Executive Overview
              </div>

              <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                Ringkasan Outlet
              </h2>

            </div>

            <button
              type="button"
              onClick={() =>
                loadDashboard(true)
              }
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh
            </button>

          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">

            <KpiCard
              title="Purchase Order"
              value={formatNumber(totalPurchase)}
              subtitle="Total purchase"
              icon={ShoppingCart}
              href="/outlet/purchase"
              tone="emerald"
            />

            <KpiCard
              title="Draft"
              value={formatNumber(totalDraft)}
              subtitle="Belum diproses"
              icon={FileText}
              href="/outlet/purchase"
              tone="amber"
            />

            <KpiCard
              title="Approved"
              value={formatNumber(totalApproved)}
              subtitle="Purchase approved"
              icon={CheckCircle2}
              href="/outlet/purchase"
              tone="blue"
            />

            <KpiCard
              title="Received"
              value={formatNumber(totalReceived)}
              subtitle="Sudah diterima"
              icon={PackageCheck}
              href="/outlet/barang-masuk"
              tone="emerald"
            />

            <KpiCard
              title="Receipt"
              value={formatNumber(totalReceipt)}
              subtitle="Dokumen penerimaan"
              icon={ClipboardList}
              href="/outlet/barang-masuk"
              tone="purple"
            />

            <KpiCard
              title="Stock"
              value={formatNumber(totalStock)}
              subtitle="Total persediaan"
              icon={Boxes}
              href="/outlet/stock"
              tone="slate"
            />

            <KpiCard
              title="Low Stock"
              value={formatNumber(lowStock)}
              subtitle={
                lowStock > 0
                  ? "Perlu perhatian"
                  : "Stock aman"
              }
              icon={AlertTriangle}
              href="/outlet/stock"
              tone={
                lowStock > 0
                  ? "red"
                  : "emerald"
              }
            />

          </div>

        </section>

        {/* ====================================================
            MOVEMENT ANALYTICS
        ==================================================== */}

        <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">

          <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)] xl:col-span-2">

            <div className="border-b border-slate-100 px-6 py-5 sm:px-7">

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                <div>

                  <div className="flex items-center gap-2">

                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                      <Activity size={16} />
                    </span>

                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                      Inventory Analytics
                    </div>

                  </div>

                  <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">
                    Pergerakan Barang Outlet
                  </h3>

                  <p className="mt-1 text-xs text-slate-400">
                    Monitoring barang masuk,
                    barang keluar dan waste
                    selama 6 bulan terakhir.
                  </p>

                </div>

                <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500">

                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Barang Masuk
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    Barang Keluar
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    Waste
                  </div>

                </div>

              </div>

            </div>

            <div className="p-5 sm:p-7">

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

                <MovementSummaryCard
                  title="Barang Masuk"
                  value={stockIn}
                  subtitle="Total 6 bulan"
                  icon={ArrowDownToLine}
                  variant="in"
                />

                <MovementSummaryCard
                  title="Barang Keluar"
                  value={stockOut}
                  subtitle="Total 6 bulan"
                  icon={ArrowUpFromLine}
                  variant="out"
                />

                <MovementSummaryCard
                  title="Waste"
                  value={waste}
                  subtitle="Total 6 bulan"
                  icon={Trash2}
                  variant="waste"
                />

                <MovementSummaryCard
                  title="Net Movement"
                  value={netMovement}
                  subtitle="Masuk - keluar - waste"
                  icon={Layers3}
                  variant="net"
                />

              </div>

              <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-100 bg-white">

                {movementTrend.length === 0 ? (
                  <div className="flex min-h-[350px] flex-col items-center justify-center text-center">

                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                      <BarChart3 size={24} />
                    </div>

                    <div className="mt-4 text-sm font-black text-slate-600">
                      Belum ada data
                      pergerakan barang
                    </div>

                    <div className="mt-1 max-w-sm text-xs text-slate-400">
                      Data akan muncul setelah
                      terdapat transaksi barang
                      masuk atau barang keluar.
                    </div>

                  </div>
                ) : (
                  <MovementChart
                    data={movementTrend}
                  />
                )}

              </div>

              <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-4 sm:flex-row sm:items-center">

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                  <TrendingUp size={18} />
                </div>

                <div className="min-w-0 flex-1">

                  <div className="text-xs font-black text-emerald-900">
                    Inventory Flow
                  </div>

                  <p className="mt-1 text-[11px] leading-5 text-emerald-800/65">
                    Pergerakan dihitung dari
                    penerimaan barang outlet
                    dan transaksi stock out
                    yang berstatus approved.
                    Waste dipisahkan agar
                    tidak tercampur dengan
                    barang keluar bersih.
                  </p>

                </div>

                <div
                  className={`shrink-0 rounded-xl px-3 py-2 text-right ${
                    netMovement >= 0
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >

                  <div className="text-[9px] font-black uppercase tracking-wider">
                    Net
                  </div>

                  <div className="text-sm font-black">
                    {netMovement >= 0
                      ? "+"
                      : ""}
                    {formatNumber(
                      netMovement
                    )}
                  </div>

                </div>

              </div>

            </div>

          </div>

          {/* ==================================================
              OPERATIONAL STATUS
          ================================================== */}

          <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]">

            <div className="border-b border-slate-100 px-6 py-5">

              <div className="flex items-center justify-between">

                <div>

                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                    Operational Status
                  </div>

                  <h3 className="mt-1 text-lg font-black text-slate-900">
                    Kondisi Outlet
                  </h3>

                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                  <BarChart3 size={19} />
                </div>

              </div>

            </div>

            <div className="space-y-3 p-5">

              <div className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:border-emerald-100 hover:bg-emerald-50/40">

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Boxes size={18} />
                </div>

                <div className="min-w-0 flex-1">

                  <div className="flex items-center justify-between gap-2">

                    <span className="text-xs font-bold text-slate-700">
                      Persediaan
                    </span>

                    {lowStock > 0 ? (
                      <span className="text-[10px] font-black text-red-600">
                        Perlu cek
                      </span>
                    ) : (
                      <span className="text-[10px] font-black text-emerald-600">
                        Aman
                      </span>
                    )}

                  </div>

                  <div className="mt-1 text-[11px] text-slate-500">
                    {formatNumber(totalStock)} unit stock
                  </div>

                </div>

              </div>

              <div className="group flex items-center gap-4 rounded-2xl border border-purple-100 bg-purple-50/40 p-4 transition hover:border-purple-200 hover:bg-purple-50/70">

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-purple-700 shadow-sm">
                  <CircleDollarSign size={18} />
                </div>

                <div className="min-w-0 flex-1">

                  <div className="flex items-center justify-between gap-2">

                    <span className="text-xs font-bold text-slate-700">
                      Nilai Persediaan
                    </span>

                    <span className="text-[10px] font-black text-purple-600">
                      Valuasi
                    </span>

                  </div>

                  <div className="mt-1 text-sm font-black tracking-tight text-slate-800">
                    {formatCurrency(
                      totalStockValue
                    )}
                  </div>

                  <div className="mt-0.5 text-[10px] text-slate-400">
                    Estimasi nilai seluruh stock outlet
                  </div>

                </div>

              </div>

              <div className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:border-red-100 hover:bg-red-50/40">

                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    lowStock > 0
                      ? "bg-red-50 text-red-600"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  <AlertTriangle size={18} />
                </div>

                <div className="min-w-0 flex-1">

                  <div className="flex items-center justify-between gap-2">

                    <span className="text-xs font-bold text-slate-700">
                      Low Stock
                    </span>

                    <span
                      className={`text-[10px] font-black ${
                        lowStock > 0
                          ? "text-red-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {formatNumber(lowStock)}
                    </span>

                  </div>

                  <div className="mt-1 text-[11px] text-slate-500">
                    {lowStock > 0
                      ? "Ada item yang perlu diperhatikan"
                      : "Tidak ada item low stock"}
                  </div>

                </div>

              </div>

              <div className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:border-purple-100 hover:bg-purple-50/40">

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                  <ClipboardList size={18} />
                </div>

                <div className="min-w-0 flex-1">

                  <div className="flex items-center justify-between gap-2">

                    <span className="text-xs font-bold text-slate-700">
                      Receipt
                    </span>

                    <span className="text-[10px] font-black text-purple-600">
                      {formatNumber(totalReceipt)}
                    </span>

                  </div>

                  <div className="mt-1 text-[11px] text-slate-500">
                    Dokumen penerimaan barang
                  </div>

                </div>

              </div>

              <div className="group flex items-center gap-4 rounded-2xl border border-red-100 bg-red-50/50 p-4 transition hover:border-red-200 hover:bg-red-50">

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-red-600 shadow-sm">
                  <Trash2 size={18} />
                </div>

                <div className="min-w-0 flex-1">

                  <div className="flex items-center justify-between gap-2">

                    <span className="text-xs font-black text-red-900">
                      Waste
                    </span>

                    <span className="text-[10px] font-black text-red-600">
                      {formatNumber(waste)}
                    </span>

                  </div>

                  <div className="mt-1 text-[11px] text-red-800/55">
                    Waste tercatat 6 bulan
                  </div>

                </div>

              </div>

              <div className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                  <UserCheck size={18} />
                </div>

                <div className="min-w-0 flex-1">

                  <div className="text-xs font-black text-emerald-900">
                    Outlet Aktif
                  </div>

                  <div className="mt-1 truncate text-[11px] text-emerald-800/60">
                    {outletName} • {outletCode}
                  </div>

                </div>

                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />

              </div>

            </div>

          </div>

        </section>

        {/* ====================================================
            QUICK MENU
        ==================================================== */}

        <section className="mt-5">

          <div className="mb-4">

            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
              Quick Access
            </div>

            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">
              Menu Cepat
            </h2>

          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">

            <QuickMenu
              number="01"
              href="/outlet/purchase"
              title="Purchase Order"
              description="Kelola purchase outlet"
              icon={ShoppingCart}
            />

            <QuickMenu
              number="02"
              href="/outlet/barang-masuk"
              title="Barang Masuk"
              description="Penerimaan barang outlet"
              icon={PackageCheck}
            />

            <QuickMenu
              number="03"
              href="/outlet/stock"
              title="Stock Outlet"
              description="Pantau persediaan outlet"
              icon={Boxes}
            />

            <QuickMenu
              number="04"
              href="/outlet/stock-opname"
              title="Stock Opname"
              description="Pengecekan stock fisik"
              icon={ClipboardList}
            />

            <QuickMenu
              number="05"
              href="/outlet/purchase"
              title="Purchase Pending"
              description="Purchase yang belum selesai"
              icon={Clock3}
            />

            <QuickMenu
              number="06"
              href="/outlet/stock"
              title="Stock Alert"
              description="Item yang perlu diperhatikan"
              icon={AlertTriangle}
            />

          </div>

        </section>

        {/* ====================================================
            RECENT PURCHASE + ATTENTION
        ==================================================== */}

        <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">

          <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)] xl:col-span-2">

            <div className="border-b border-slate-100 px-6 py-5">

              <div className="flex items-center justify-between">

                <div>

                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                    Recent Activity
                  </div>

                  <h3 className="mt-1 text-lg font-black text-slate-900">
                    Purchase Terbaru
                  </h3>

                </div>

                <Link
                  href="/outlet/purchase"
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 hover:text-emerald-900"
                >
                  Lihat semua
                  <ArrowRight size={14} />
                </Link>

              </div>

            </div>

            {recentPurchases.length === 0 ? (
              <div className="flex min-h-[270px] flex-col items-center justify-center px-6 text-center">

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <ShoppingCart size={24} />
                </div>

                <div className="mt-4 text-sm font-black text-slate-700">
                  Belum ada purchase
                </div>

                <p className="mt-1 max-w-sm text-xs text-slate-400">
                  Data purchase terbaru akan
                  muncul di sini.
                </p>

              </div>
            ) : (
              <div className="overflow-x-auto">

                <table className="w-full min-w-[760px]">

                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">

                      <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                        Purchase
                      </th>

                      <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                        Supplier
                      </th>

                      <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                        Tanggal
                      </th>

                      <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                        Status
                      </th>

                      <th className="px-6 py-3 text-right text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                        Total
                      </th>

                    </tr>
                  </thead>

                  <tbody>

                    {recentPurchases.map(
                      (purchase, index) => (
                        <tr
                          key={purchase.id}
                          className={`group transition hover:bg-emerald-50/40 ${
                            index !==
                            recentPurchases.length - 1
                              ? "border-b border-slate-100"
                              : ""
                          }`}
                        >

                          <td className="px-6 py-4">

                            <Link
                              href={`/outlet/purchase/${purchase.id}`}
                              className="flex items-center gap-3"
                            >

                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition group-hover:bg-emerald-100 group-hover:text-emerald-700">
                                <FileText size={16} />
                              </div>

                              <div className="min-w-0">

                                <div className="truncate text-xs font-black text-slate-800">
                                  {purchase.number}
                                </div>

                                <div className="mt-0.5 text-[10px] font-medium text-slate-400">
                                  ID #{purchase.id}
                                </div>

                              </div>

                            </Link>

                          </td>

                          <td className="px-4 py-4">

                            <div className="max-w-[180px]">

                              <div className="truncate text-xs font-bold text-slate-700">
                                {purchase.supplier?.name || "-"}
                              </div>

                              <div className="mt-0.5 text-[10px] text-slate-400">
                                {purchase.supplier?.code || "-"}
                              </div>

                            </div>

                          </td>

                          <td className="px-4 py-4">

                            <div className="text-xs font-semibold text-slate-600">
                              {formatDate(
                                purchase.purchaseDate
                              )}
                            </div>

                          </td>

                          <td className="px-4 py-4">

                            <StatusBadge
                              status={purchase.status}
                            />

                          </td>

                          <td className="px-6 py-4 text-right">

                            <div className="text-xs font-black text-slate-800">
                              {formatCurrency(
                                purchase.total
                              )}
                            </div>

                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>

              </div>
            )}

          </div>

          {/* ==================================================
              ATTENTION
          ================================================== */}

          <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]">

            <div className="border-b border-slate-100 px-6 py-5">

              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                Attention Center
              </div>

              <h3 className="mt-1 text-lg font-black text-slate-900">
                Perlu Perhatian
              </h3>

            </div>

            <div className="space-y-3 p-5">

              <Link
                href="/outlet/stock"
                className={`group block rounded-2xl border p-4 transition ${
                  lowStock > 0
                    ? "border-red-100 bg-red-50/60 hover:border-red-200"
                    : "border-emerald-100 bg-emerald-50/60 hover:border-emerald-200"
                }`}
              >

                <div className="flex items-center gap-3">

                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white ${
                      lowStock > 0
                        ? "text-red-600"
                        : "text-emerald-600"
                    }`}
                  >
                    <AlertTriangle size={18} />
                  </div>

                  <div className="min-w-0 flex-1">

                    <div
                      className={`text-xs font-black ${
                        lowStock > 0
                          ? "text-red-900"
                          : "text-emerald-900"
                      }`}
                    >
                      {lowStock > 0
                        ? `${formatNumber(
                            lowStock
                          )} item low stock`
                        : "Stock dalam kondisi aman"}
                    </div>

                    <div
                      className={`mt-1 text-[10px] ${
                        lowStock > 0
                          ? "text-red-800/60"
                          : "text-emerald-800/60"
                      }`}
                    >
                      {lowStock > 0
                        ? "Klik untuk melihat detail"
                        : "Tidak ada alert stock"}
                    </div>

                  </div>

                  <ChevronRight
                    size={16}
                    className="text-slate-400 transition group-hover:translate-x-1"
                  />

                </div>

              </Link>

              <Link
                href="/outlet/purchase"
                className="group block rounded-2xl border border-amber-100 bg-amber-50/60 p-4 transition hover:border-amber-200"
              >

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-amber-600">
                    <Clock3 size={18} />
                  </div>

                  <div className="min-w-0 flex-1">

                    <div className="text-xs font-black text-amber-900">
                      {formatNumber(totalDraft)} purchase draft
                    </div>

                    <div className="mt-1 text-[10px] text-amber-800/60">
                      Masih menunggu proses
                    </div>

                  </div>

                  <ChevronRight
                    size={16}
                    className="text-amber-500 transition group-hover:translate-x-1"
                  />

                </div>

              </Link>

              <Link
                href="/outlet/barang-masuk"
                className="group block rounded-2xl border border-blue-100 bg-blue-50/60 p-4 transition hover:border-blue-200"
              >

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600">
                    <Truck size={18} />
                  </div>

                  <div className="min-w-0 flex-1">

                    <div className="text-xs font-black text-blue-900">
                      {formatNumber(totalReceived)} received
                    </div>

                    <div className="mt-1 text-[10px] text-blue-800/60">
                      Total purchase yang sudah diterima
                    </div>

                  </div>

                  <ChevronRight
                    size={16}
                    className="text-blue-500 transition group-hover:translate-x-1"
                  />

                </div>

              </Link>

              <Link
                href="/outlet/stock"
                className="group block rounded-2xl border border-red-100 bg-red-50/60 p-4 transition hover:border-red-200"
              >

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-red-600">
                    <Trash2 size={18} />
                  </div>

                  <div className="min-w-0 flex-1">

                    <div className="text-xs font-black text-red-900">
                      {formatNumber(waste)} waste
                    </div>

                    <div className="mt-1 text-[10px] text-red-800/60">
                      Total waste 6 bulan
                    </div>

                  </div>

                  <ChevronRight
                    size={16}
                    className="text-red-500 transition group-hover:translate-x-1"
                  />

                </div>

              </Link>

              <Link
                href="/outlet/stock"
                className="group block rounded-2xl border border-purple-100 bg-purple-50/60 p-4 transition hover:border-purple-200"
              >

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-purple-600 shadow-sm">
                    <CircleDollarSign size={18} />
                  </div>

                  <div className="min-w-0 flex-1">

                    <div className="text-xs font-black text-purple-900">
                      {formatCurrency(
                        totalStockValue
                      )}
                    </div>

                    <div className="mt-1 text-[10px] text-purple-800/60">
                      Nilai persediaan outlet
                    </div>

                  </div>

                  <ChevronRight
                    size={16}
                    className="text-purple-500 transition group-hover:translate-x-1"
                  />

                </div>

              </Link>

            </div>

          </div>

        </section>

        {/* ====================================================
            ONLINE USERS
        ==================================================== */}

        <section className="relative mt-5 overflow-hidden rounded-[28px] border border-[#24483e] bg-[#071c17] shadow-[0_20px_60px_rgba(7,28,23,0.16)]">

          <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-emerald-400/[0.05] blur-3xl" />

          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-teal-400/[0.04] blur-3xl" />

          <div className="relative">

            {/* HEADER */}

            <div className="border-b border-white/[0.07] px-6 py-5 sm:px-7">

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                <div>

                  <div className="flex items-center gap-2">

                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#39d98a] shadow-[0_0_10px_rgba(57,217,138,0.7)]" />

                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#75b9a4]">
                      Live Monitoring
                    </span>

                  </div>

                  <h3 className="mt-1.5 text-xl font-black tracking-tight text-white">
                    Active Users
                  </h3>

                  <p className="mt-1 text-[11px] font-medium text-white/35">
                    Pengguna yang sedang aktif di MGB ERP
                  </p>

                </div>

                <div className="flex items-center gap-3">

                  <div className="inline-flex items-center gap-2 rounded-full border border-[#39d98a]/20 bg-[#39d98a]/10 px-3.5 py-2">

                    <span className="relative flex h-2.5 w-2.5">

                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#39d98a] opacity-50" />

                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#39d98a]" />

                    </span>

                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#7ee2b5]">
                      {onlineLoading
                        ? "..."
                        : `${onlineUsers.length} ONLINE`}
                    </span>

                  </div>

                  <button
                    type="button"
                    onClick={loadOnlineUsers}
                    disabled={onlineLoading}
                    title="Refresh user online"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-white/40 transition hover:border-[#39d98a]/20 hover:bg-[#39d98a]/10 hover:text-[#72dcae] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw
                      size={14}
                      className={
                        onlineLoading
                          ? "animate-spin"
                          : ""
                      }
                    />
                  </button>

                </div>

              </div>

            </div>

            {/* ACTIVE USER LIST */}

            {onlineUsers.length === 0 ? (

              <div className="p-6 sm:p-7">

                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-5 py-8 text-center">

                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.04] text-white/20">
                    <Users size={21} />
                  </div>

                  <div className="mt-3 text-sm font-black text-white/55">
                    Belum ada user online
                  </div>

                  <div className="mt-1 text-[11px] text-white/25">
                    Sistem akan memperbarui status secara otomatis.
                  </div>

                </div>

              </div>

            ) : (

              <div className="p-4 sm:p-5">

                <div className="mb-3 flex items-center justify-between px-1">

                  <div className="text-[9px] font-black uppercase tracking-[0.16em] text-white/25">
                    Pengguna Aktif
                  </div>

                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#5fc999]">

                    <span className="h-1.5 w-1.5 rounded-full bg-[#39d98a]" />

                    LIVE

                  </div>

                </div>

                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3">

                  {onlineUsers.map(
                    (onlineUser, index) => {

                      const name =
                        onlineUser.fullname ||
                        onlineUser.name ||
                        onlineUser.username ||
                        "User";

                      const role =
                        formatUserRole(
                          onlineUser.role
                        );

                      const lastSeen =
                        onlineUser.lastSeen ||
                        onlineUser.updatedAt;

                      return (
                        <div
                          key={
                            onlineUser.id ??
                            `${name}-${index}`
                          }
                          className="
                            group
                            relative
                            overflow-hidden
                            rounded-[18px]
                            border
                            border-white/[0.06]
                            bg-white/[0.035]
                            px-4
                            py-3.5
                            transition-all
                            duration-200
                            hover:border-[#39d98a]/20
                            hover:bg-white/[0.055]
                          "
                        >

                          <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-[#39d98a] transition-all duration-300 group-hover:w-full" />

                          <div className="flex items-center gap-3">

                            <ProfileAvatar
                              name={name}
                              photo={
                                onlineUser.photo
                              }
                              size="md"
                              online
                              dark
                            />

                            <div className="min-w-0 flex-1">

                              <div className="truncate text-xs font-black text-white/90">
                                {name}
                              </div>

                              <div className="mt-0.5 truncate text-[10px] font-medium text-white/35">
                                {role}
                              </div>

                            </div>

                            <div className="shrink-0 text-right">

                              <div className="flex items-center justify-end gap-1.5">

                                <span className="h-1.5 w-1.5 rounded-full bg-[#39d98a] shadow-[0_0_7px_rgba(57,217,138,0.55)]" />

                                <span className="text-[9px] font-black text-[#65d39f]">
                                  Online
                                </span>

                              </div>

                              <div className="mt-1 text-[9px] font-medium text-white/25">
                                {lastSeen
                                  ? formatDateTime(
                                      lastSeen
                                    )
                                  : "Baru saja"}
                              </div>

                            </div>

                          </div>

                        </div>
                      );
                    }
                  )}

                </div>

              </div>

            )}

          </div>

        </section>

        {/* ====================================================
            FOOTER
        ==================================================== */}

        <footer className="mt-6 pb-5">

          <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-3">

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#071c17] text-emerald-300">
                <Warehouse size={17} />
              </div>

              <div>

                <div className="text-xs font-black text-slate-800">
                  MGB ERP • Outlet
                </div>

                <div className="mt-0.5 text-[10px] font-medium text-slate-400">
                  {outletName} ({outletCode})
                </div>

              </div>

            </div>

            <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-400">

              <span>
                Operational Dashboard
              </span>

              <span className="h-1 w-1 rounded-full bg-slate-300" />

              <span>
                Live Monitoring
              </span>

              <span className="h-1 w-1 rounded-full bg-slate-300" />

              <span>
                Inventory Analytics
              </span>

            </div>

          </div>

        </footer>

      </div>
    </div>
  );
}