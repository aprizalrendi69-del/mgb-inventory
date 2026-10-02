"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PackageCheck,
  RefreshCw,
  Search,
  Eye,
  Truck,
  CalendarDays,
  X,
  ArrowRightLeft,
  Boxes,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  MapPin,
  FileText,
  Building2,
  ChevronRight,
  SlidersHorizontal,
  RotateCcw,
  ChevronDown,
  Check,
} from "lucide-react";
import { useRouter } from "next/navigation";

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

type SourceFilter =
  | "ALL"
  | "PURCHASE"
  | "DELIVERY_ORDER"
  | "TRANSFER";

type StatusFilter =
  | "ALL"
  | "RECEIVED"
  | "PARTIAL"
  | "SENT"
  | "APPROVED"
  | "DRAFT";

type BarangMasuk = {
  id: string;

  sourceId?: number | null;
  outletId?: number | null;

  sumber: "PURCHASE" | "TRANSFER";

  jenisTransfer?:
    | "WAREHOUSE_TO_OUTLET"
    | "OUTLET_TO_OUTLET"
    | null;

  nomor: string;
  tanggal: string;
  status: string;

  totalItem: number;
  totalReceived: number;

  hasVoid?: boolean;
  voidItemCount?: number;
  voidTotalQty?: number;

  outlet?: Outlet | null;

  sourceOutletId?: number | null;
  sourceOutlet?: Outlet | null;

  destinationOutlet?: Outlet | null;

  supplier?: Supplier | null;
};

type MonthOption = {
  value: string;
  label: string;
  year: number;
  month: number;
};

type LoginUser = {
  id?: number;
  role?: string | null;
  outletId?: number | null;
  outlet?: Outlet | null;
};

export default function OutletBarangMasukPage() {
  const router = useRouter();

  // =====================================================
  // DATA
  // =====================================================

  const [data, setData] = useState<BarangMasuk[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // =====================================================
  // USER
  // =====================================================

  const [role, setRole] = useState("");
  const [userOutletId, setUserOutletId] =
    useState<number | null>(null);
  const [loginOutlet, setLoginOutlet] =
    useState<Outlet | null>(null);
  const [userReady, setUserReady] = useState(false);

  const isAdminPusat =
    role === "ADMIN" || role === "MANAGER";

  const isOutletAdmin =
    role === "OUTLET_ADMIN";

  const hasPeriodFilterRole =
    isAdminPusat || isOutletAdmin;

  // =====================================================
  // CURRENT MONTH
  // =====================================================

  const currentDate = useMemo(() => new Date(), []);

  const currentYear =
    currentDate.getFullYear();

  const currentMonth =
    currentDate.getMonth();

  const currentMonthValue =
    `${currentYear}-${String(
      currentMonth + 1
    ).padStart(2, "0")}`;

  // =====================================================
  // MONTH OPTIONS
  // =====================================================

  const monthOptions = useMemo<MonthOption[]>(() => {
    const options: MonthOption[] = [];

    for (
      let month = 0;
      month <= currentMonth;
      month++
    ) {
      const date = new Date(
        currentYear,
        month,
        1
      );

      const value =
        `${currentYear}-${String(
          month + 1
        ).padStart(2, "0")}`;

      const rawLabel =
        date.toLocaleDateString(
          "id-ID",
          {
            month: "long",
            year: "numeric",
          }
        );

      options.push({
        value,
        label:
          rawLabel.charAt(0).toUpperCase() +
          rawLabel.slice(1),
        year: currentYear,
        month,
      });
    }

    return options.reverse();
  }, [
    currentYear,
    currentMonth,
  ]);

  // =====================================================
  // FILTER
  // =====================================================

  const [selectedOutlet, setSelectedOutlet] =
    useState("ALL");

  const [dateFrom, setDateFrom] =
    useState("");

  const [dateTo, setDateTo] =
    useState("");

  const [selectedMonth, setSelectedMonth] =
    useState(currentMonthValue);

  const [customDateMode, setCustomDateMode] =
    useState(false);

  const [selectedSource, setSelectedSource] =
    useState<SourceFilter>("ALL");

  const [selectedStatus, setSelectedStatus] =
    useState<StatusFilter>("ALL");

  const [statusMenuOpen, setStatusMenuOpen] =
    useState(false);

  const statusMenuRef =
    useRef<HTMLDivElement | null>(null);

  // =====================================================
  // REQUEST CONTROL
  // =====================================================

  const abortControllerRef =
    useRef<AbortController | null>(null);

  const requestIdRef =
    useRef(0);

  const initialLoadDoneRef =
    useRef(false);

  const manualRefreshRef =
    useRef(false);

  // =====================================================
  // MONTH RANGE
  // =====================================================

  const getMonthDateRange = useCallback(
    (monthValue: string) => {
      if (!monthValue) {
        return {
          from: "",
          to: "",
        };
      }

      const [
        yearString,
        monthString,
      ] = monthValue.split("-");

      const year = Number(
        yearString
      );

      const month = Number(
        monthString
      );

      if (
        !Number.isInteger(year) ||
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12
      ) {
        return {
          from: "",
          to: "",
        };
      }

      const from =
        `${year}-${String(
          month
        ).padStart(2, "0")}-01`;

      const lastDay =
        new Date(
          year,
          month,
          0
        ).getDate();

      const to =
        `${year}-${String(
          month
        ).padStart(2, "0")}-${String(
          lastDay
        ).padStart(2, "0")}`;

      return {
        from,
        to,
      };
    },
    []
  );

  // =====================================================
  // INITIAL PERIOD
  // =====================================================

  useEffect(() => {
    const range =
      getMonthDateRange(
        currentMonthValue
      );

    setSelectedMonth(
      currentMonthValue
    );

    setDateFrom(
      range.from
    );

    setDateTo(
      range.to
    );
  }, [
    currentMonthValue,
    getMonthDateRange,
  ]);

  // =====================================================
  // DEBOUNCE SEARCH
  //
  // Search dilakukan client-side.
  // Tidak perlu request API setiap ketikan.
  // =====================================================

  useEffect(() => {
    const timer =
      window.setTimeout(() => {
        setDebouncedSearch(
          search
        );
      }, 180);

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [search]);

  // =====================================================
  // LOAD CURRENT USER
  //
  // HANYA SEKALI.
  //
  // Sebelumnya /api/me dipanggil setiap loadData().
  // Sekarang user session disimpan di state.
  // =====================================================

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      try {
        const response =
          await fetch(
            "/api/me",
            {
              method: "GET",
              cache: "no-store",
            }
          );

        const json =
          await response.json();

        if (
          cancelled
        ) {
          return;
        }

        if (
          !response.ok ||
          !json.success
        ) {
          console.error(
            "LOAD USER:",
            json.message
          );

          setRole("");
          setUserOutletId(null);
          setLoginOutlet(null);
          setUserReady(true);
          return;
        }

        const user:
          LoginUser =
          json.user || {};

        const loginRole =
          String(
            user.role || ""
          ).toUpperCase();

        const outletId =
          user.outletId !==
            null &&
          user.outletId !==
            undefined
            ? Number(
                user.outletId
              )
            : null;

        setRole(
          loginRole
        );

        setUserOutletId(
          Number.isInteger(
            outletId
          )
            ? outletId
            : null
        );

        if (
          user.outlet &&
          Number.isInteger(
            Number(
              user.outlet.id
            )
          )
        ) {
          setLoginOutlet({
            id: Number(
              user.outlet.id
            ),
            code:
              user.outlet
                .code || "",
            name:
              user.outlet
                .name || "",
          });
        }

        // OUTLET_ADMIN selalu PURCHASE sebagai default.
        if (
          loginRole ===
          "OUTLET_ADMIN"
        ) {
          setSelectedSource(
            "PURCHASE"
          );
        }

        setUserReady(true);
      } catch (error) {
        if (
          cancelled
        ) {
          return;
        }

        console.error(
          "LOAD USER ERROR:",
          error
        );

        setRole("");
        setUserOutletId(null);
        setLoginOutlet(null);
        setUserReady(true);
      }
    }

    loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

  // =====================================================
  // LOAD BARANG MASUK
  //
  // OPTIMIZATION:
  // 1. Tidak fetch /api/me lagi.
  // 2. Abort request sebelumnya.
  // 3. Request ID mencegah response lama menimpa data baru.
  // =====================================================

  const loadData = useCallback(
    async (
      options?: {
        manual?: boolean;
      }
    ) => {
      if (
        !userReady ||
        !role
      ) {
        return;
      }

      const currentRequestId =
        ++requestIdRef.current;

      if (
        abortControllerRef.current
      ) {
        abortControllerRef.current.abort();
      }

      const controller =
        new AbortController();

      abortControllerRef.current =
        controller;

      try {
        setLoading(true);

        const params =
          new URLSearchParams();

        // -------------------------------------------------
        // OUTLET
        // -------------------------------------------------

        if (
          isOutletAdmin
        ) {
          if (
            userOutletId ===
            null
          ) {
            setData([]);
            return;
          }

          params.set(
            "outletId",
            String(
              userOutletId
            )
          );
        } else if (
          isAdminPusat &&
          selectedOutlet !==
            "ALL"
        ) {
          params.set(
            "outletId",
            selectedOutlet
          );
        }

        // -------------------------------------------------
        // PERIODE
        // -------------------------------------------------

        if (
          hasPeriodFilterRole
        ) {
          if (dateFrom) {
            params.set(
              "dateFrom",
              dateFrom
            );
          }

          if (dateTo) {
            params.set(
              "dateTo",
              dateTo
            );
          }
        }

        const query =
          params.toString();

        const response =
          await fetch(
            `/api/outlet/barang-masuk${
              query
                ? `?${query}`
                : ""
            }`,
            {
              method: "GET",
              cache: "no-store",
              signal:
                controller.signal,
            }
          );

        const json =
          await response.json();

        if (
          controller.signal.aborted ||
          currentRequestId !==
            requestIdRef.current
        ) {
          return;
        }

        if (
          !response.ok ||
          !json.success
        ) {
          console.error(
            "LOAD BARANG MASUK:",
            json.message
          );

          setData([]);
          return;
        }

        const rows =
          Array.isArray(
            json.data
          )
            ? json.data
            : [];

        setData(
          rows
        );

        initialLoadDoneRef.current =
          true;

        if (
          options?.manual
        ) {
          manualRefreshRef.current =
            true;
        }
      } catch (error) {
        if (
          error instanceof
            DOMException &&
          error.name ===
            "AbortError"
        ) {
          return;
        }

        if (
          controller.signal
            .aborted ||
          currentRequestId !==
            requestIdRef.current
        ) {
          return;
        }

        console.error(
          "LOAD OUTLET BARANG MASUK ERROR:",
          error
        );

        setData([]);
      } finally {
        if (
          currentRequestId ===
          requestIdRef.current
        ) {
          setLoading(false);
        }
      }
    },
    [
      userReady,
      role,
      isOutletAdmin,
      isAdminPusat,
      userOutletId,
      selectedOutlet,
      dateFrom,
      dateTo,
      hasPeriodFilterRole,
    ]
  );

  // =====================================================
  // INITIAL + FILTER LOAD
  //
  // HANYA SATU EFFECT.
  //
  // Ini menghilangkan masalah:
  // - initial useEffect
  // - effect filter
  // - loadData
  // yang sebelumnya dapat menyebabkan request ganda.
  // =====================================================

  useEffect(() => {
    if (
      !userReady ||
      !role
    ) {
      return;
    }

    if (
      hasPeriodFilterRole &&
      (!dateFrom ||
        !dateTo)
    ) {
      return;
    }

    loadData();
  }, [
    userReady,
    role,
    hasPeriodFilterRole,
    dateFrom,
    dateTo,
    selectedOutlet,
    userOutletId,
    loadData,
  ]);

  // =====================================================
  // CLEANUP REQUEST
  // =====================================================

  useEffect(() => {
    return () => {
      if (
        abortControllerRef.current
      ) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // =====================================================
  // CLOSE STATUS MENU
  // =====================================================

  useEffect(() => {
    if (!statusMenuOpen) {
      return;
    }

    function handleClickOutside(
      event: MouseEvent
    ) {
      const target =
        event.target as Node;

      if (
        statusMenuRef.current &&
        !statusMenuRef.current.contains(
          target
        )
      ) {
        setStatusMenuOpen(
          false
        );
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, [
    statusMenuOpen,
  ]);

  // =====================================================
  // SOURCE
  // =====================================================

  function sourceFilterLabel(
    source: SourceFilter
  ) {
    switch (source) {
      case "PURCHASE":
        return "Purchase Order";
      case "DELIVERY_ORDER":
        return "Delivery Order";
      case "TRANSFER":
        return "Transfer Antar Outlet";
      default:
        return "Semua Transaksi";
    }
  }

  function getTransactionType(
    item: BarangMasuk
  ): Exclude<
    SourceFilter,
    "ALL"
  > {
    if (
      item.sumber ===
      "PURCHASE"
    ) {
      return "PURCHASE";
    }

    if (
      item.jenisTransfer ===
        "OUTLET_TO_OUTLET" ||
      Boolean(
        item.sourceOutletId
      )
    ) {
      return "TRANSFER";
    }

    return "DELIVERY_ORDER";
  }

  // =====================================================
  // STATUS
  // =====================================================

  function statusFilterLabel(
    status: StatusFilter
  ) {
    switch (status) {
      case "RECEIVED":
        return "Diterima";
      case "PARTIAL":
        return "Sebagian";
      case "SENT":
        return "Menunggu";
      case "APPROVED":
        return "Approved";
      case "DRAFT":
        return "Draft";
      default:
        return "Semua Status";
    }
  }

  // =====================================================
  // OUTLET OPTIONS
  //
  // Untuk OUTLET_ADMIN tidak bergantung pada data.
  // Jadi outlet login tetap tampil meskipun bulan tersebut
  // belum memiliki transaksi.
  // =====================================================

  const outletOptions =
    useMemo(() => {
      const map =
        new Map<
          number,
          Outlet
        >();

      if (
        loginOutlet
      ) {
        map.set(
          loginOutlet.id,
          loginOutlet
        );
      }

      data.forEach(
        (item) => {
          const outlet =
            item.destinationOutlet ||
            item.outlet;

          if (
            outlet &&
            Number.isInteger(
              Number(
                outlet.id
              )
            )
          ) {
            map.set(
              Number(
                outlet.id
              ),
              {
                id: Number(
                  outlet.id
                ),
                code:
                  outlet.code ||
                  "",
                name:
                  outlet.name ||
                  "",
              }
            );
          }
        }
      );

      return Array.from(
        map.values()
      ).sort(
        (a, b) =>
          `${a.code} ${a.name}`.localeCompare(
            `${b.code} ${b.name}`,
            "id"
          )
      );
    }, [
      data,
      loginOutlet,
    ]);

  // =====================================================
  // DATE
  // =====================================================

  function getDateOnly(
    value: string
  ) {
    if (!value) {
      return "";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    return `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;
  }

  function formatDate(
    value: string
  ) {
    if (!value) {
      return "-";
    }

    const date =
      new Date(value);

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
        month: "short",
        year: "numeric",
      }
    );
  }

  // =====================================================
  // FILTERED DATA
  //
  // Server sudah memfilter:
  // - outlet
  // - periode
  //
  // Client hanya memfilter:
  // - search
  // - source
  // - status
  //
  // Ini membuat kerja browser lebih ringan.
  // =====================================================

  const filteredData =
    useMemo(() => {
      const keyword =
        debouncedSearch
          .toLowerCase()
          .trim();

      return data.filter(
        (item) => {
          const destinationOutlet =
            item.destinationOutlet ||
            item.outlet;

          const sourceOutlet =
            item.sourceOutlet;

          const itemStatus =
            String(
              item.status || ""
            ).toUpperCase();

          // ---------------------------------------------
          // CLIENT SECURITY
          // ---------------------------------------------

          if (
            isOutletAdmin &&
            userOutletId !==
              null
          ) {
            if (
              Number(
                destinationOutlet?.id
              ) !==
              Number(
                userOutletId
              )
            ) {
              return false;
            }
          }

          // ---------------------------------------------
          // SOURCE
          // ---------------------------------------------

          if (
            selectedSource !==
              "ALL" &&
            getTransactionType(
              item
            ) !==
              selectedSource
          ) {
            return false;
          }

          // ---------------------------------------------
          // STATUS
          // ---------------------------------------------

          if (
            selectedStatus !==
              "ALL" &&
            itemStatus !==
              selectedStatus
          ) {
            return false;
          }

          // ---------------------------------------------
          // OUTLET
          // ---------------------------------------------

          if (
            isAdminPusat &&
            selectedOutlet !==
              "ALL"
          ) {
            if (
              Number(
                destinationOutlet?.id
              ) !==
              Number(
                selectedOutlet
              )
            ) {
              return false;
            }
          }

          // ---------------------------------------------
          // SEARCH
          // ---------------------------------------------

          if (
            keyword
          ) {
            const values = [
              item.nomor,
              item.status,
              item.sumber,
              item.jenisTransfer,
              destinationOutlet?.code,
              destinationOutlet?.name,
              sourceOutlet?.code,
              sourceOutlet?.name,
              item.supplier?.code,
              item.supplier?.name,
              item.hasVoid
                ? "void"
                : "",
            ];

            const matches =
              values.some(
                (value) =>
                  String(
                    value || ""
                  )
                    .toLowerCase()
                    .includes(
                      keyword
                    )
              );

            if (!matches) {
              return false;
            }
          }

          // ---------------------------------------------
          // LOCAL DATE SAFETY FILTER
          //
          // API sudah melakukan filter periode.
          // Ini hanya menjaga konsistensi apabila data
          // API memiliki tanggal di luar range.
          // ---------------------------------------------

          if (
            hasPeriodFilterRole
          ) {
            const itemDate =
              getDateOnly(
                item.tanggal
              );

            if (
              dateFrom &&
              itemDate &&
              itemDate <
                dateFrom
            ) {
              return false;
            }

            if (
              dateTo &&
              itemDate &&
              itemDate >
                dateTo
            ) {
              return false;
            }
          }

          return true;
        }
      );
    }, [
      data,
      debouncedSearch,
      selectedSource,
      selectedStatus,
      isAdminPusat,
      isOutletAdmin,
      userOutletId,
      selectedOutlet,
      dateFrom,
      dateTo,
      hasPeriodFilterRole,
    ]);

  // =====================================================
  // SOURCE COUNTS
  // =====================================================

  const sourceCounts =
    useMemo(() => {
      const counts: Record<
        Exclude<
          SourceFilter,
          "ALL"
        >,
        number
      > = {
        PURCHASE: 0,
        DELIVERY_ORDER: 0,
        TRANSFER: 0,
      };

      data.forEach(
        (item) => {
          const destinationOutlet =
            item.destinationOutlet ||
            item.outlet;

          if (
            isOutletAdmin &&
            userOutletId !==
              null &&
            Number(
              destinationOutlet?.id
            ) !==
              Number(
                userOutletId
              )
          ) {
            return;
          }

          counts[
            getTransactionType(
              item
            )
          ]++;
        }
      );

      return counts;
    }, [
      data,
      isOutletAdmin,
      userOutletId,
    ]);

  // =====================================================
  // KPI
  // =====================================================

  const statistics =
    useMemo(() => {
      let received = 0;
      let waiting = 0;
      let partial = 0;
      let voidCount = 0;

      filteredData.forEach(
        (item) => {
          const status =
            String(
              item.status || ""
            ).toUpperCase();

          if (
            status ===
              "RECEIVED" ||
            status ===
              "SELESAI"
          ) {
            received++;
          } else if (
            status ===
            "PARTIAL"
          ) {
            partial++;
          } else {
            waiting++;
          }

          if (
            item.hasVoid &&
            Number(
              item.voidItemCount ??
                0
            ) > 0
          ) {
            voidCount++;
          }
        }
      );

      return {
        total:
          filteredData.length,
        received,
        waiting,
        partial,
        voidCount,
      };
    }, [
      filteredData,
    ]);

  // =====================================================
  // RESET
  // =====================================================

  function resetFilter() {
    const range =
      getMonthDateRange(
        currentMonthValue
      );

    setSelectedOutlet(
      "ALL"
    );

    setSelectedMonth(
      currentMonthValue
    );

    setCustomDateMode(
      false
    );

    setDateFrom(
      range.from
    );

    setDateTo(
      range.to
    );

    setSearch("");

    setSelectedSource(
      isOutletAdmin
        ? "PURCHASE"
        : "ALL"
    );

    setSelectedStatus(
      "ALL"
    );

    setStatusMenuOpen(
      false
    );
  }

  const hasActiveFilter =
    selectedOutlet !==
      "ALL" ||
    search.length > 0 ||
    selectedSource !==
      "ALL" ||
    selectedStatus !==
      "ALL" ||
    customDateMode ||
    selectedMonth !==
      currentMonthValue;

  // =====================================================
  // STATUS BADGE
  // =====================================================

  function statusBadge(
    status: string
  ) {
    const value =
      String(
        status || ""
      ).toUpperCase();

    if (
      value ===
        "RECEIVED" ||
      value ===
        "SELESAI"
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
          <CheckCircle2 size={13} />
          Diterima
        </span>
      );
    }

    if (
      value === "PARTIAL"
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
          <Clock3 size={13} />
          Sebagian
        </span>
      );
    }

    if (
      value === "SENT"
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-200">
          <Truck size={13} />
          Menunggu
        </span>
      );
    }

    if (
      value === "APPROVED"
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 ring-1 ring-inset ring-violet-200">
          <CheckCircle2 size={13} />
          Approved
        </span>
      );
    }

    if (
      value === "DRAFT"
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-inset ring-slate-200">
          <FileText size={13} />
          Draft
        </span>
      );
    }

    return (
      <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-inset ring-slate-200">
        {status || "-"}
      </span>
    );
  }

  // =====================================================
  // VOID BADGE
  // =====================================================

  function voidBadge(
    item: BarangMasuk
  ) {
    const count =
      Number(
        item.voidItemCount ??
          0
      );

    if (
      !item.hasVoid ||
      count <= 0
    ) {
      return null;
    }

    const qty =
      Number(
        item.voidTotalQty ??
          0
      );

    return (
      <div className="flex flex-col items-center gap-1">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700 ring-1 ring-inset ring-red-200">
          <X size={11} />
          VOID
        </span>

        <span className="text-[10px] font-semibold text-red-500">
          {count} item · qty{" "}
          {qty.toLocaleString(
            "id-ID"
          )}
        </span>
      </div>
    );
  }

  // =====================================================
  // SOURCE BADGE
  // =====================================================

  function sourceBadge(
    item: BarangMasuk
  ) {
    if (
      item.sumber ===
      "TRANSFER"
    ) {
      const antarOutlet =
        item.jenisTransfer ===
          "OUTLET_TO_OUTLET" ||
        Boolean(
          item.sourceOutletId
        );

      if (
        antarOutlet
      ) {
        return (
          <div className="flex min-w-[190px] flex-col items-start gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200">
              <ArrowRightLeft size={12} />
              Transfer Antar Outlet
            </span>

            {item.sourceOutlet && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Building2
                  size={12}
                  className="text-indigo-400"
                />
                Dari{" "}
                <span className="font-semibold text-slate-700">
                  {
                    item
                      .sourceOutlet
                      .code
                  }
                </span>
              </div>
            )}
          </div>
        );
      }

      return (
        <div className="flex min-w-[190px] flex-col items-start gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 ring-1 ring-inset ring-blue-200">
            <Truck size={12} />
            Kiriman Gudang
          </span>

          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Building2
              size={12}
              className="text-blue-400"
            />
            Gudang / Pusat
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-w-[190px] flex-col items-start gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1.5 text-[11px] font-bold text-violet-700 ring-1 ring-inset ring-violet-200">
          <FileText size={12} />
          Purchase Order
        </span>

        {item.supplier && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Building2
              size={12}
              className="text-violet-400"
            />

            <span>
              {
                item
                  .supplier
                  .code
              }{" "}
              ·{" "}
              {
                item
                  .supplier
                  .name
              }
            </span>
          </div>
        )}
      </div>
    );
  }

  // =====================================================
  // DETAIL
  // =====================================================

  function bukaDetail(
    item: BarangMasuk
  ) {
    router.push(
      `/outlet/barang-masuk/${encodeURIComponent(
        item.id
      )}`
    );
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-full bg-[#F4F7F5]">
      <div className="mx-auto max-w-[1700px] p-4 md:p-6 lg:p-8">

        {/* HERO */}
        <section className="relative mb-6 overflow-hidden rounded-[28px] border border-[#D8E7E0] bg-white shadow-[0_12px_40px_rgba(24,53,45,0.06)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(73,127,112,0.12),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(73,127,112,0.06),transparent_30%)]" />

          <div className="relative flex flex-col gap-6 p-6 md:p-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#497F70] text-white shadow-lg shadow-[#497F70]/20">
                <PackageCheck size={26} />
                <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-[3px] border-white bg-emerald-400" />
              </div>

              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#497F70]">
                    Inventory · Receiving
                  </span>

                  {isAdminPusat && (
                    <span className="rounded-full bg-[#EAF3EF] px-2.5 py-1 text-[10px] font-bold text-[#497F70]">
                      PUSAT
                    </span>
                  )}

                  {isOutletAdmin && (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                      OUTLET
                    </span>
                  )}

                  {isOutletAdmin && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-700 ring-1 ring-inset ring-violet-200">
                      <FileText size={10} />
                      PURCHASE ORDER
                    </span>
                  )}
                </div>

                <h1 className="text-2xl font-black tracking-tight text-[#18352D] md:text-3xl">
                  Barang Masuk Outlet
                </h1>

                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
                  Monitoring penerimaan barang berdasarkan Purchase
                  Order, Delivery Order, dan transfer antar outlet.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden rounded-2xl border border-[#DDE9E4] bg-[#FAFCFB] px-4 py-3 sm:block">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Total Transaksi
                </div>

                <div className="mt-0.5 text-xl font-black text-[#18352D]">
                  {statistics.total.toLocaleString(
                    "id-ID"
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  loadData({
                    manual: true,
                  })
                }
                disabled={
                  loading ||
                  !userReady
                }
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#D5E5DC] bg-white px-5 text-sm font-bold text-[#35564C] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#BFD6CC] hover:bg-[#F7FAF8] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw
                  size={17}
                  className={
                    loading
                      ? "animate-spin"
                      : ""
                  }
                />
                Refresh
              </button>
            </div>
          </div>
        </section>

        {/* KPI */}
        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="group relative overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[#497F70]/5 transition-transform group-hover:scale-125" />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Total Transaksi
                </p>

                <p className="mt-2 text-2xl font-black text-[#18352D]">
                  {statistics.total.toLocaleString(
                    "id-ID"
                  )}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Barang masuk terfilter
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                <Boxes size={19} />
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-50 transition-transform group-hover:scale-125" />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Sudah Diterima
                </p>

                <p className="mt-2 text-2xl font-black text-emerald-700">
                  {statistics.received.toLocaleString(
                    "id-ID"
                  )}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Transaksi selesai
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={19} />
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-blue-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-blue-50 transition-transform group-hover:scale-125" />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Menunggu
                </p>

                <p className="mt-2 text-2xl font-black text-blue-700">
                  {statistics.waiting.toLocaleString(
                    "id-ID"
                  )}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Belum selesai diterima
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Truck size={19} />
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-red-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-red-50 transition-transform group-hover:scale-125" />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Memiliki VOID
                </p>

                <p className="mt-2 text-2xl font-black text-red-700">
                  {statistics.voidCount.toLocaleString(
                    "id-ID"
                  )}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Perlu perhatian
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <AlertTriangle size={19} />
              </div>
            </div>
          </div>
        </section>

        {/* FILTER */}
        {hasPeriodFilterRole && (
          <section className="mb-6 overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[#E8EEEB] px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                  <SlidersHorizontal size={17} />
                </div>

                <div>
                  <h2 className="text-sm font-black text-[#18352D]">
                    Filter Data
                  </h2>

                  <p className="text-xs text-slate-400">
                    {isOutletAdmin
                      ? "Saring penerimaan outlet berdasarkan periode transaksi"
                      : "Saring transaksi berdasarkan outlet dan periode"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={
                  resetFilter
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-[#F4F7F5] hover:text-[#35564C]"
              >
                <RotateCcw size={13} />
                Reset ke Bulan Berjalan
              </button>
            </div>

            <div
              className={`grid grid-cols-1 gap-4 p-5 ${
                isAdminPusat
                  ? "md:grid-cols-2 xl:grid-cols-4"
                  : "md:grid-cols-2 xl:grid-cols-3"
              }`}
            >
              {/* OUTLET ADMIN / ADMIN */}
              {isAdminPusat && (
                <div>
                  <label className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <MapPin size={12} />
                    Outlet
                  </label>

                  <select
                    value={
                      selectedOutlet
                    }
                    onChange={(e) =>
                      setSelectedOutlet(
                        e.target.value
                      )
                    }
                    className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm font-semibold text-[#35564C] outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                  >
                    <option value="ALL">
                      Semua Outlet
                    </option>

                    {outletOptions.map(
                      (outlet) => (
                        <option
                          key={
                            outlet.id
                          }
                          value={String(
                            outlet.id
                          )}
                        >
                          {outlet.code} -{" "}
                          {outlet.name}
                        </option>
                      )
                    )}
                  </select>
                </div>
              )}

              {isOutletAdmin && (
                <div>
                  <label className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <MapPin size={12} />
                    Outlet Login
                  </label>

                  <div className="flex min-h-[46px] items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
                    <Building2
                      size={16}
                      className="shrink-0 text-blue-600"
                    />

                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-blue-800">
                        {loginOutlet?.name ||
                          (userOutletId !==
                          null
                            ? `Outlet #${userOutletId}`
                            : "Outlet Login")}
                      </div>

                      <div className="text-[10px] font-semibold text-blue-600/70">
                        {loginOutlet?.code
                          ? `${loginOutlet.code} · `
                          : ""}
                        Terkunci sesuai akun login
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* MONTH */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <CalendarDays size={12} />
                  Bulan & Tahun
                </label>

                <div className="relative">
                  <CalendarDays
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#497F70]"
                  />

                  <select
                    value={
                      customDateMode
                        ? ""
                        : selectedMonth
                    }
                    onChange={(e) => {
                      const value =
                        e.target.value;

                      if (!value) {
                        setCustomDateMode(
                          true
                        );
                        return;
                      }

                      const range =
                        getMonthDateRange(
                          value
                        );

                      setSelectedMonth(
                        value
                      );

                      setCustomDateMode(
                        false
                      );

                      setDateFrom(
                        range.from
                      );

                      setDateTo(
                        range.to
                      );
                    }}
                    className="w-full appearance-none rounded-xl border border-[#BFD8CE] bg-[#EAF3EF] py-3 pl-10 pr-10 text-sm font-bold text-[#35564C] outline-none transition focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                  >
                    {monthOptions.map(
                      (month) => (
                        <option
                          key={
                            month.value
                          }
                          value={
                            month.value
                          }
                        >
                          {month.label}
                        </option>
                      )
                    )}

                    <option value="">
                      Periode Custom
                    </option>
                  </select>

                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#497F70]"
                  />
                </div>

                <p className="mt-1.5 text-[10px] font-medium text-slate-400">
                  {isOutletAdmin
                    ? "Periode hanya memengaruhi outlet login."
                    : "Otomatis mengikuti bulan berjalan."}
                </p>
              </div>

              {/* FROM */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <CalendarDays size={12} />
                  Tanggal Dari
                </label>

                <div className="relative">
                  <CalendarDays
                    size={16}
                    className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${
                      customDateMode
                        ? "text-[#497F70]"
                        : "text-slate-300"
                    }`}
                  />

                  <input
                    type="date"
                    value={
                      dateFrom
                    }
                    max={
                      dateTo ||
                      undefined
                    }
                    disabled={
                      !customDateMode
                    }
                    onChange={(e) => {
                      setCustomDateMode(
                        true
                      );
                      setSelectedMonth(
                        ""
                      );
                      setDateFrom(
                        e.target.value
                      );
                    }}
                    className={`w-full rounded-xl border py-3 pl-10 pr-4 text-sm font-semibold outline-none transition ${
                      customDateMode
                        ? "border-[#D5E5DC] bg-[#FAFCFB] text-[#35564C] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                        : "cursor-not-allowed border-[#E5ECE8] bg-slate-50 text-slate-400"
                    }`}
                  />
                </div>
              </div>

              {/* TO */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <CalendarDays size={12} />
                  Tanggal Sampai
                </label>

                <div className="relative">
                  <CalendarDays
                    size={16}
                    className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${
                      customDateMode
                        ? "text-[#497F70]"
                        : "text-slate-300"
                    }`}
                  />

                  <input
                    type="date"
                    value={
                      dateTo
                    }
                    min={
                      dateFrom ||
                      undefined
                    }
                    disabled={
                      !customDateMode
                    }
                    onChange={(e) => {
                      setCustomDateMode(
                        true
                      );
                      setSelectedMonth(
                        ""
                      );
                      setDateTo(
                        e.target.value
                      );
                    }}
                    className={`w-full rounded-xl border py-3 pl-10 pr-4 text-sm font-semibold outline-none transition ${
                      customDateMode
                        ? "border-[#D5E5DC] bg-[#FAFCFB] text-[#35564C] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                        : "cursor-not-allowed border-[#E5ECE8] bg-slate-50 text-slate-400"
                    }`}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-[#E8EEEB] bg-[#FAFCFB] px-5 py-3">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#EAF3EF] px-2.5 py-1.5 text-[10px] font-black text-[#497F70]">
                <CalendarDays size={11} />

                {customDateMode
                  ? "PERIODE CUSTOM"
                  : `BULAN ${
                      monthOptions.find(
                        (item) =>
                          item.value ===
                          selectedMonth
                      )?.label ||
                      selectedMonth ||
                      "-"
                    }`}
              </span>

              {dateFrom && (
                <span className="text-[10px] font-semibold text-slate-500">
                  {dateFrom}
                </span>
              )}

              {dateFrom &&
                dateTo && (
                  <span className="text-[10px] font-bold text-slate-300">
                    →
                  </span>
                )}

              {dateTo && (
                <span className="text-[10px] font-semibold text-slate-500">
                  {dateTo}
                </span>
              )}
            </div>
          </section>
        )}

        {/* MAIN */}
        <section className="overflow-hidden rounded-[24px] border border-[#DDE9E4] bg-white shadow-[0_10px_35px_rgba(24,53,45,0.05)]">

          {/* TOOLBAR */}
          <div className="border-b border-[#E8EEEB] p-5 md:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#497F70]" />

                  <h2 className="text-base font-black text-[#18352D]">
                    Daftar Penerimaan
                  </h2>
                </div>

                <p className="mt-1 text-xs text-slate-400">
                  Klik detail untuk melihat isi dan proses penerimaan
                  barang.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">

                {/* SEARCH */}
                <div className="relative min-w-[280px]">
                  <Search
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="text"
                    value={
                      search
                    }
                    onChange={(e) =>
                      setSearch(
                        e.target.value
                      )
                    }
                    placeholder="Cari transaksi, outlet, supplier..."
                    className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-3 pl-10 pr-10 text-sm font-medium text-[#35564C] outline-none transition placeholder:text-slate-400 focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                  />

                  {search && (
                    <button
                      type="button"
                      onClick={() =>
                        setSearch("")
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* SOURCE */}
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-2xl border border-[#DDE9E4] bg-[#F8FBF9] p-1.5 xl:flex-none">

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedSource(
                        "ALL"
                      )
                    }
                    className={`group inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-xs font-black transition-all ${
                      selectedSource ===
                      "ALL"
                        ? "bg-white text-[#18352D] shadow-[0_4px_14px_rgba(24,53,45,0.10)] ring-1 ring-inset ring-[#D5E5DC]"
                        : "text-slate-500 hover:bg-white/80 hover:text-[#35564C]"
                    }`}
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${
                      selectedSource ===
                      "ALL"
                        ? "bg-[#EAF3EF] text-[#497F70]"
                        : "bg-slate-100 text-slate-400"
                    }`}>
                      <Boxes size={13} />
                    </span>

                    Semua Transaksi

                    {selectedSource ===
                      "ALL" && (
                      <span className="rounded-full bg-[#497F70] px-1.5 py-0.5 text-[9px] font-black text-white">
                        {data.length.toLocaleString(
                          "id-ID"
                        )}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedSource(
                        "PURCHASE"
                      )
                    }
                    className={`group inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-xs font-black transition-all ${
                      selectedSource ===
                      "PURCHASE"
                        ? "bg-violet-600 text-white shadow-[0_6px_18px_rgba(124,58,237,0.20)]"
                        : "text-slate-500 hover:bg-white/80 hover:text-violet-700"
                    }`}
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${
                      selectedSource ===
                      "PURCHASE"
                        ? "bg-white/15 text-white"
                        : "bg-violet-50 text-violet-500"
                    }`}>
                      <FileText size={13} />
                    </span>

                    <span className="whitespace-nowrap">
                      Purchase Order
                    </span>

                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                      selectedSource ===
                      "PURCHASE"
                        ? "bg-white/15 text-white"
                        : "bg-violet-50 text-violet-600"
                    }`}>
                      {sourceCounts.PURCHASE.toLocaleString(
                        "id-ID"
                      )}
                    </span>

                    {selectedSource ===
                      "PURCHASE" &&
                      isOutletAdmin && (
                      <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] font-black text-white ring-1 ring-inset ring-white/20">
                        DEFAULT
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedSource(
                        "DELIVERY_ORDER"
                      )
                    }
                    className={`group inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-xs font-black transition-all ${
                      selectedSource ===
                      "DELIVERY_ORDER"
                        ? "bg-blue-600 text-white shadow-[0_6px_18px_rgba(37,99,235,0.20)]"
                        : "text-slate-500 hover:bg-white/80 hover:text-blue-700"
                    }`}
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${
                      selectedSource ===
                      "DELIVERY_ORDER"
                        ? "bg-white/15 text-white"
                        : "bg-blue-50 text-blue-500"
                    }`}>
                      <Truck size={13} />
                    </span>

                    <span className="whitespace-nowrap">
                      Delivery Order
                    </span>

                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                      selectedSource ===
                      "DELIVERY_ORDER"
                        ? "bg-white/15 text-white"
                        : "bg-blue-50 text-blue-600"
                    }`}>
                      {sourceCounts.DELIVERY_ORDER.toLocaleString(
                        "id-ID"
                      )}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedSource(
                        "TRANSFER"
                      )
                    }
                    className={`group inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-xs font-black transition-all ${
                      selectedSource ===
                      "TRANSFER"
                        ? "bg-indigo-600 text-white shadow-[0_6px_18px_rgba(79,70,229,0.20)]"
                        : "text-slate-500 hover:bg-white/80 hover:text-indigo-700"
                    }`}
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${
                      selectedSource ===
                      "TRANSFER"
                        ? "bg-white/15 text-white"
                        : "bg-indigo-50 text-indigo-500"
                    }`}>
                      <ArrowRightLeft size={13} />
                    </span>

                    <span className="whitespace-nowrap">
                      Transfer Antar Outlet
                    </span>

                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                      selectedSource ===
                      "TRANSFER"
                        ? "bg-white/15 text-white"
                        : "bg-indigo-50 text-indigo-600"
                    }`}>
                      {sourceCounts.TRANSFER.toLocaleString(
                        "id-ID"
                      )}
                    </span>
                  </button>
                </div>

                {/* STATUS */}
                <div
                  ref={
                    statusMenuRef
                  }
                  className="relative"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setStatusMenuOpen(
                        (value) =>
                          !value
                      )
                    }
                    className={`inline-flex h-[46px] min-w-[150px] items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition-all ${
                      selectedStatus !==
                      "ALL"
                        ? "border-[#AFCFC2] bg-[#EAF3EF] text-[#35564C] shadow-sm"
                        : "border-[#D5E5DC] bg-[#FAFCFB] text-[#35564C] hover:border-[#BFD6CC] hover:bg-white"
                    }`}
                  >
                    <CheckCircle2 size={16} />

                    <span>
                      {selectedStatus ===
                      "ALL"
                        ? "Status"
                        : statusFilterLabel(
                            selectedStatus
                          )}
                    </span>

                    <ChevronDown
                      size={15}
                      className={
                        statusMenuOpen
                          ? "rotate-180 transition-transform"
                          : "transition-transform"
                      }
                    />

                    {selectedStatus !==
                      "ALL" && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#497F70] px-1 text-[10px] font-black text-white">
                        1
                      </span>
                    )}
                  </button>

                  {statusMenuOpen && (
                    <div className="absolute right-0 z-50 mt-2 w-[220px] overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white p-1.5 shadow-[0_15px_45px_rgba(24,53,45,0.15)]">
                      <div className="px-3 pb-2 pt-2">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Filter Status
                        </p>
                      </div>

                      {(
                        [
                          [
                            "ALL",
                            "Semua Status",
                            Boxes,
                          ],
                          [
                            "RECEIVED",
                            "Diterima",
                            CheckCircle2,
                          ],
                          [
                            "PARTIAL",
                            "Sebagian",
                            Clock3,
                          ],
                          [
                            "SENT",
                            "Menunggu",
                            Truck,
                          ],
                          [
                            "APPROVED",
                            "Approved",
                            CheckCircle2,
                          ],
                          [
                            "DRAFT",
                            "Draft",
                            FileText,
                          ],
                        ] as const
                      ).map(
                        ([
                          value,
                          label,
                          Icon,
                        ]) => (
                          <button
                            key={
                              value
                            }
                            type="button"
                            onClick={() => {
                              setSelectedStatus(
                                value
                              );
                              setStatusMenuOpen(
                                false
                              );
                            }}
                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-bold transition ${
                              selectedStatus ===
                              value
                                ? "bg-[#EAF3EF] text-[#35564C]"
                                : "text-slate-600 hover:bg-[#F4F7F5]"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Icon
                                size={15}
                              />
                              {label}
                            </span>

                            {selectedStatus ===
                              value && (
                              <Check
                                size={15}
                                className="text-[#497F70]"
                              />
                            )}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-[#F4F7F5] px-4 py-3 text-xs font-semibold text-slate-500">
                  <span className="font-black text-[#35564C]">
                    {filteredData.length.toLocaleString(
                      "id-ID"
                    )}
                  </span>{" "}
                  transaksi
                </div>
              </div>
            </div>

            {/* ACTIVE FILTER */}
            {hasActiveFilter && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Filter aktif:
                </span>

                {search && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#EAF3EF] px-2.5 py-1.5 text-[11px] font-bold text-[#497F70]">
                    Search: {search}
                  </span>
                )}

                {selectedSource !==
                  "ALL" && (
                  <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ring-1 ring-inset ${
                    selectedSource ===
                    "PURCHASE"
                      ? "bg-violet-50 text-violet-700 ring-violet-200"
                      : selectedSource ===
                          "DELIVERY_ORDER"
                        ? "bg-blue-50 text-blue-700 ring-blue-200"
                        : "bg-indigo-50 text-indigo-700 ring-indigo-200"
                  }`}>
                    {selectedSource ===
                    "PURCHASE" ? (
                      <FileText size={11} />
                    ) : selectedSource ===
                      "DELIVERY_ORDER" ? (
                      <Truck size={11} />
                    ) : (
                      <ArrowRightLeft size={11} />
                    )}

                    Sumber:{" "}
                    {sourceFilterLabel(
                      selectedSource
                    )}

                    {isOutletAdmin &&
                      selectedSource ===
                        "PURCHASE" && (
                      <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[8px] font-black text-white">
                        DEFAULT
                      </span>
                    )}
                  </span>
                )}

                {selectedStatus !==
                  "ALL" && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700">
                    <CheckCircle2 size={11} />
                    Status:{" "}
                    {statusFilterLabel(
                      selectedStatus
                    )}
                  </span>
                )}

                {isAdminPusat &&
                  selectedOutlet !==
                    "ALL" && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700">
                    <MapPin size={11} />
                    Outlet terpilih
                  </span>
                )}

                {isOutletAdmin && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700">
                    <MapPin size={11} />
                    Outlet login
                  </span>
                )}

                {!customDateMode &&
                  selectedMonth && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#EAF3EF] px-2.5 py-1.5 text-[11px] font-bold text-[#497F70]">
                    <CalendarDays size={11} />
                    Bulan:{" "}
                    {monthOptions.find(
                      (item) =>
                        item.value ===
                        selectedMonth
                    )?.label ||
                      selectedMonth}
                  </span>
                )}

                {customDateMode &&
                  dateFrom && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-600">
                    <CalendarDays size={11} />
                    Dari {dateFrom}
                  </span>
                )}

                {customDateMode &&
                  dateTo && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-600">
                    <CalendarDays size={11} />
                    Sampai {dateTo}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto">
            <table className="min-w-[1250px] w-full text-sm">
              <thead>
                <tr className="border-b border-[#E4EBE7] bg-[#F7F9F8]">
                  <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                    #
                  </th>
                  <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Dokumen
                  </th>
                  <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Sumber
                  </th>
                  <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Tanggal
                  </th>
                  <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Outlet Tujuan
                  </th>
                  <th className="px-5 py-4 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Total
                  </th>
                  <th className="px-5 py-4 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Diterima
                  </th>
                  <th className="px-5 py-4 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Status
                  </th>
                  <th className="px-5 py-4 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Detail
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-20"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
                          <PackageCheck size={28} />

                          <div className="absolute inset-0 animate-ping rounded-2xl border border-[#497F70]/20" />
                        </div>

                        <p className="font-bold text-[#35564C]">
                          Memuat data penerimaan
                        </p>

                        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                          <RefreshCw
                            size={13}
                            className="animate-spin"
                          />
                          Sinkronisasi data...
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : filteredData.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-20"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
                          <PackageCheck size={29} />
                        </div>

                        <p className="font-black text-[#35564C]">
                          Tidak ada transaksi
                        </p>

                        <p className="mt-1 max-w-md text-center text-xs leading-5 text-slate-400">
                          Tidak ditemukan barang masuk yang sesuai
                          dengan pencarian atau filter yang sedang
                          digunakan.
                        </p>

                        {hasActiveFilter && (
                          <button
                            type="button"
                            onClick={
                              resetFilter
                            }
                            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#3E6F62]"
                          >
                            <RotateCcw size={14} />
                            Kembali ke Bulan Berjalan
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredData.map(
                    (
                      item,
                      index
                    ) => {
                      const isTransfer =
                        item.sumber ===
                        "TRANSFER";

                      const hasVoid =
                        item.hasVoid ===
                        true;

                      const destinationOutlet =
                        item.destinationOutlet ||
                        item.outlet;

                      const totalItem =
                        Number(
                          item.totalItem ??
                            0
                        );

                      const totalReceived =
                        Number(
                          item.totalReceived ??
                            0
                        );

                      const progress =
                        totalItem > 0
                          ? Math.min(
                              100,
                              Math.max(
                                0,
                                (totalReceived /
                                  totalItem) *
                                  100
                              )
                            )
                          : 0;

                      return (
                        <tr
                          key={
                            item.id
                          }
                          className={`group border-b transition-all last:border-0 ${
                            hasVoid
                              ? "border-red-100 bg-red-50/20 hover:bg-red-50/50"
                              : isTransfer
                                ? "border-blue-50 bg-blue-50/[0.18] hover:bg-blue-50/50"
                                : "border-[#EDF2EF] hover:bg-[#FAFCFB]"
                          }`}
                        >
                          <td className="px-5 py-5 align-top">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-500 group-hover:bg-white">
                              {index + 1}
                            </div>
                          </td>

                          <td className="px-5 py-5 align-top">
                            <div className="flex flex-col items-start gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-black tracking-tight text-[#18352D]">
                                  {item.nomor}
                                </span>

                                {hasVoid && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-[10px] font-black text-red-700 ring-1 ring-inset ring-red-200">
                                    <X size={9} />
                                    VOID
                                  </span>
                                )}
                              </div>

                              {isTransfer &&
                                item.sourceOutlet && (
                                  <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600">
                                    <ArrowRightLeft size={11} />
                                    Dari{" "}
                                    {
                                      item
                                        .sourceOutlet
                                        .name
                                    }
                                  </span>
                                )}

                              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                                ID #{item.id}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-5 align-top">
                            {sourceBadge(
                              item
                            )}
                          </td>

                          <td className="px-5 py-5 align-top">
                            <div className="flex items-start gap-2">
                              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                                <CalendarDays size={14} />
                              </div>

                              <div>
                                <div className="font-bold text-slate-700">
                                  {formatDate(
                                    item.tanggal
                                  )}
                                </div>

                                <div className="mt-0.5 text-[10px] font-medium text-slate-400">
                                  Tanggal transaksi
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-5 align-top">
                            <div className="flex items-start gap-2">
                              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                                <MapPin size={14} />
                              </div>

                              <div>
                                <div className="font-black text-[#18352D]">
                                  {
                                    destinationOutlet?.name ||
                                    "-"
                                  }
                                </div>

                                <div className="mt-0.5 text-[11px] font-semibold text-slate-400">
                                  {
                                    destinationOutlet?.code ||
                                    "Kode outlet -"
                                  }
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-5 text-center align-top">
                            <div className="inline-flex min-w-[70px] flex-col items-center rounded-xl bg-slate-50 px-3 py-2">
                              <span className="text-base font-black text-[#18352D]">
                                {totalItem.toLocaleString(
                                  "id-ID"
                                )}
                              </span>

                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                Qty
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-5 align-top">
                            <div className="min-w-[120px]">
                              <div className="mb-2 flex items-center justify-between">
                                <span className="text-xs font-black text-[#497F70]">
                                  {totalReceived.toLocaleString(
                                    "id-ID"
                                  )}
                                </span>

                                <span className="text-[10px] font-bold text-slate-400">
                                  {Math.round(
                                    progress
                                  )}
                                  %
                                </span>
                              </div>

                              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    progress >=
                                    100
                                      ? "bg-emerald-500"
                                      : progress >
                                          0
                                        ? "bg-[#497F70]"
                                        : "bg-slate-200"
                                  }`}
                                  style={{
                                    width: `${progress}%`,
                                  }}
                                />
                              </div>

                              {hasVoid && (
                                <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-red-500">
                                  <X size={10} />
                                  Void{" "}
                                  {Number(
                                    item.voidTotalQty ??
                                      0
                                  ).toLocaleString(
                                    "id-ID"
                                  )}
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-5 text-center align-top">
                            <div className="flex min-w-[110px] flex-col items-center gap-2">
                              {statusBadge(
                                item.status
                              )}

                              {voidBadge(
                                item
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-5 text-center align-top">
                            <button
                              type="button"
                              onClick={() =>
                                bukaDetail(
                                  item
                                )
                              }
                              className={`group/button inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-xs font-black transition-all ${
                                hasVoid
                                  ? "bg-red-50 text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-100"
                                  : "bg-[#EAF3EF] text-[#497F70] ring-1 ring-inset ring-[#CFE2D9] hover:bg-[#DCEDE5]"
                              }`}
                              title={
                                hasVoid
                                  ? "Lihat detail - terdapat barang void"
                                  : "Lihat detail"
                              }
                            >
                              <Eye size={15} />

                              <span className="hidden xl:inline">
                                Detail
                              </span>

                              <ChevronRight
                                size={14}
                                className="transition-transform group-hover/button:translate-x-0.5"
                              />
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* FOOTER */}
          {!loading &&
            filteredData.length >
              0 && (
              <div className="flex flex-col gap-3 border-t border-[#E8EEEB] bg-[#FAFCFB] px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <PackageCheck
                    size={14}
                    className="text-[#497F70]"
                  />

                  Menampilkan{" "}
                  <span className="font-black text-[#35564C]">
                    {filteredData.length.toLocaleString(
                      "id-ID"
                    )}
                  </span>{" "}
                  dari{" "}
                  <span className="font-black text-[#35564C]">
                    {data.length.toLocaleString(
                      "id-ID"
                    )}
                  </span>{" "}
                  transaksi
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-700">
                    <CheckCircle2 size={11} />
                    {statistics.received} selesai
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold text-blue-700">
                    <Clock3 size={11} />
                    {statistics.waiting} menunggu
                  </span>

                  {statistics.partial >
                    0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold text-amber-700">
                      <Clock3 size={11} />
                      {statistics.partial} sebagian
                    </span>
                  )}

                  {statistics.voidCount >
                    0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-[10px] font-bold text-red-700">
                      <X size={11} />
                      {statistics.voidCount} void
                    </span>
                  )}
                </div>
              </div>
            )}
        </section>

        {/* OUTLET NOTE */}
        {isOutletAdmin && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3.5">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <Building2 size={15} />
            </div>

            <div>
              <p className="text-xs font-black text-blue-800">
                Tampilan Outlet
              </p>

              <p className="mt-0.5 text-[11px] leading-5 text-blue-700/80">
                Data penerimaan difilter otomatis berdasarkan outlet
                yang terhubung dengan akun login dan periode yang
                dipilih.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}