"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Search,
  RefreshCw,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  Package,
  Wallet,
  Store,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  History,
  CircleDollarSign,
} from "lucide-react";

type Role = "ADMIN" | "OUTLET_ADMIN";

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type User = {
  id: number;
  username: string;
  fullname: string;
  role: Role;
  outletId: number | null;
  outlet?: Outlet | null;
};

type Barang = {
  id: number;
  code: string;
  name: string;
  unit: string;
  barcode?: string;
  purchasePrice?: number;
  sellingPrice?: number;
};

type OutletStock = {
  id: number;
  outletId: number;
  barangId: number;

  /*
   * CURRENT / PERIOD STOCK
   */
  stock: number;
  minimumStock: number;
  averageCost: number;
  updatedAt: string;

  outlet: Outlet;
  barang: Barang;

  /*
   * OPENING / STOCK AWAL
   */
  stockAwal?: number;
  openingStock?: number;
  openingQty?: number;
  saldoAwal?: number;

  /*
   * STOCK IN / BARANG MASUK
   */
  barangMasuk?: number;
  stockIn?: number;
  receivedQty?: number;
  totalBarangMasuk?: number;
  incomingQty?: number;

  /*
   * USAGE / PEMAKAIAN
   */
  pemakaian?: number;
  usage?: number;
  usedQty?: number;
  consumption?: number;

  /*
   * RUNNING / ENDING STOCK
   */
  stockBerjalan?: number;
  runningStock?: number;
  currentStock?: number;

  /*
   * PRICE
   */
  harga?: number;
  price?: number;

  /*
   * COST CURRENT PERIOD
   */
  costPercent?: number;
  costPercentage?: number;
  costPct?: number;
  costRate?: number;
  cost?: number;

  /*
   * PREVIOUS COST
   */
  costBulanSebelumnya?: number;
  previousCost?: number;
  previousCostPercent?: number;
  previousCostPercentage?: number;
  previousCostPct?: number;
  previousCostRate?: number;
  lastMonthCost?: number;
  lastMonthCostPercent?: number;

  /*
   * STOCK OPNAME
   */
  stockOpname?: number;
  opnameStock?: number;
  approvedOpnameStock?: number;
  approvedStockOpname?: number;

  stockOpnameStatus?: string;
  opnameStatus?: string;

  /*
   * PERIOD
   */
  periode?: string;
  period?: string;
};

type ReportRow = OutletStock & {
  stockAwalValue: number;
  barangMasukValue: number;
  stockBerjalanValue: number;
  pemakaianValue: number;

  hargaValue: number;
  nilaiStockValue: number;

  costPercentValue: number | null;
  previousCostPercentValue: number | null;

  costDifferencePoint: number | null;
  costDifferencePercent: number | null;
};

type NumberMap = Record<string, number>;

type ApiResponse = {
  success?: boolean;
  data?: OutletStock[];
  message?: string;

  period?: string;
  month?: string;
  year?: number;

  previousPeriod?: string;

  /*
   * Stock awal
   */
  stockOpname?: NumberMap;
  approvedStockOpname?: NumberMap;
  openingStock?: NumberMap;
  stockAwal?: NumberMap;

  /*
   * Barang masuk
   */
  barangMasuk?: NumberMap;
  stockIn?: NumberMap;

  /*
   * Pemakaian
   */
  pemakaian?: NumberMap;
  usage?: NumberMap;

  /*
   * Cost
   */
  costPercent?: NumberMap;
  costPercentage?: NumberMap;
  costPct?: NumberMap;

  /*
   * Previous cost
   */
  previousCost?: NumberMap;
  previousCostPercent?: NumberMap;
  previousCostPercentage?: NumberMap;
};

type MasterBarangResponse = {
  success?: boolean;
  data?: unknown;
  message?: string;
};

function getCurrentPeriod() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
}

function getPreviousPeriodValue(value: string) {
  const [year, month] = value.split("-").map(Number);

  if (!year || !month) {
    return "";
  }

  const date = new Date(year, month - 2, 1);

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

/*
 * ============================================================
 * GENERIC NUMBER HELPERS
 * ============================================================
 */

function numberValue(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = numberValue(value);

    /*
     * 0 adalah nilai VALID.
     * Jangan dilewati.
     */
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

/*
 * ============================================================
 * MAP KEY HELPERS
 * ============================================================
 *
 * API lama mungkin mengirim:
 *
 * {
 *   "12": 50
 * }
 *
 * atau:
 *
 * {
 *   "3-12": 50
 * }
 *
 * Untuk ADMIN + semua outlet, composite key jauh lebih aman
 * karena barangId yang sama bisa dimiliki banyak outlet.
 */

function getMapValue(
  map: NumberMap | undefined,
  outletId: number,
  barangId: number
): number | null {
  if (!map) {
    return null;
  }

  const compositeKeys = [
    `${outletId}-${barangId}`,
    `${outletId}:${barangId}`,
    `${outletId}_${barangId}`,
    `${outletId}.${barangId}`,
    `${outletId}/${barangId}`,
    `${outletId}|${barangId}`,
  ];

  for (const key of compositeKeys) {
    const value = numberValue(map[key]);

    if (value !== null) {
      return value;
    }
  }

  /*
   * Fallback untuk API lama yang key hanya barangId.
   *
   * Ini aman selama backend memang mengirim map
   * berdasarkan barangId saja.
   */
  return numberValue(map[String(barangId)]);
}

/*
 * ============================================================
 * MASTER BARANG EXTRACTION
 * ============================================================
 */

function extractMasterBarangIds(
  payload: MasterBarangResponse
): Set<number> {
  const result = new Set<number>();

  const source = Array.isArray(payload)
    ? payload
    : payload?.data;

  if (!Array.isArray(source)) {
    return result;
  }

  for (const item of source) {
    if (
      item === null ||
      item === undefined
    ) {
      continue;
    }

    if (
      typeof item === "number" ||
      typeof item === "string"
    ) {
      const value = Number(item);

      if (Number.isFinite(value)) {
        result.add(value);
      }

      continue;
    }

    if (typeof item !== "object") {
      continue;
    }

    const record =
      item as Record<string, unknown>;

    const aktif =
      record.aktif === undefined
        ? record.active === undefined
          ? true
          : Boolean(record.active)
        : Boolean(record.aktif);

    if (!aktif) {
      continue;
    }

    /*
     * OutletBarang
     */
    const barangId =
      Number(record.barangId);

    if (Number.isFinite(barangId)) {
      result.add(barangId);
      continue;
    }

    /*
     * Direct Barang
     */
    const directId =
      Number(record.id);

    if (Number.isFinite(directId)) {
      result.add(directId);
      continue;
    }

    /*
     * Nested Barang
     */
    if (
      record.barang &&
      typeof record.barang === "object"
    ) {
      const barang =
        record.barang as Record<
          string,
          unknown
        >;

      const nestedId =
        Number(barang.id);

      if (Number.isFinite(nestedId)) {
        result.add(nestedId);
      }
    }
  }

  return result;
}

export default function OutletStockReportPage() {
  const [user, setUser] =
    useState<User | null>(null);

  const [outlets, setOutlets] =
    useState<Outlet[]>([]);

  const [data, setData] =
    useState<OutletStock[]>([]);

  const [selectedOutlet, setSelectedOutlet] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [loadingOutlet, setLoadingOutlet] =
    useState(true);

  const [period, setPeriod] =
    useState(getCurrentPeriod);

  const [apiMeta, setApiMeta] =
    useState<ApiResponse>({});

  const [masterBarangLoading, setMasterBarangLoading] =
    useState(false);

  const [masterBarangReady, setMasterBarangReady] =
    useState(false);

  const [masterBarangCount, setMasterBarangCount] =
    useState(0);

  /*
   * Mencegah response request lama menimpa
   * response request terbaru.
   */
  const requestSequence =
    useRef(0);

  const initialLoaded =
    useRef(false);

  /*
   * ==========================================================
   * PERIOD
   * ==========================================================
   */

  const currentPeriod = useMemo(
    () => getCurrentPeriod(),
    []
  );

  const periodLabel = useMemo(() => {
    const [year, month] =
      period.split("-").map(Number);

    if (!year || !month) {
      return period;
    }

    return new Date(
      year,
      month - 1,
      1
    ).toLocaleDateString(
      "id-ID",
      {
        month: "long",
        year: "numeric",
      }
    );
  }, [period]);

  const previousPeriod = useMemo(
    () =>
      getPreviousPeriodValue(
        period
      ),
    [period]
  );

  const isCurrentPeriod = useMemo(
    () =>
      currentPeriod === period,
    [currentPeriod, period]
  );

  /*
   * ==========================================================
   * LOAD USER
   * ==========================================================
   */

  const loadUser =
    useCallback(async () => {
      const res = await fetch(
        "/api/me",
        {
          cache: "no-store",
        }
      );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success ||
        !json.user
      ) {
        throw new Error(
          json.message ||
            "Gagal mengambil user login"
        );
      }

      const loginUser: User =
        json.user;

      setUser(loginUser);

      return loginUser;
    }, []);

  /*
   * ==========================================================
   * LOAD OUTLET
   * ==========================================================
   */

  const loadOutlets =
    useCallback(
      async (
        loginUser: User
      ) => {
        try {
          setLoadingOutlet(true);

          /*
           * OUTLET_ADMIN hanya boleh melihat outlet dari session.
           * Jangan bergantung pada endpoint /api/outlet untuk role ini.
           */
          if (
            loginUser.role ===
            "OUTLET_ADMIN"
          ) {
            const ownOutlet =
              loginUser.outlet ||
              (loginUser.outletId
                ? {
                    id: Number(
                      loginUser.outletId
                    ),
                    code: "",
                    name: "Outlet Saya",
                  }
                : null);

            if (ownOutlet) {
              setOutlets([
                ownOutlet,
              ]);

              setSelectedOutlet(
                String(
                  ownOutlet.id
                )
              );
            } else {
              setOutlets([]);
              setSelectedOutlet("");
            }

            return;
          }

          /*
           * ADMIN:
           * /api/outlet pada beberapa versi backend dapat mengembalikan
           * beberapa bentuk payload. Normalisasi semuanya di sini supaya
           * dropdown tidak kosong hanya karena wrapper response berbeda.
           */
          const res =
            await fetch(
              "/api/outlet",
              {
                cache:
                  "no-store",
                credentials:
                  "include",
              }
            );

          const json =
            await res.json();

          const rawList =
            Array.isArray(json)
              ? json
              : Array.isArray(
                  json?.data
                )
              ? json.data
              : Array.isArray(
                  json?.outlets
                )
              ? json.outlets
              : Array.isArray(
                  json?.results
                )
              ? json.results
              : Array.isArray(
                  json?.data?.outlets
                )
              ? json.data.outlets
              : [];

          const normalized: Outlet[] =
            rawList
              .map(
                (item: any) => {
                  const id =
                    Number(
                      item?.id ??
                        item?.outletId
                    );

                  if (
                    !Number.isFinite(
                      id
                    )
                  ) {
                    return null;
                  }

                  return {
                    id,
                    code: String(
                      item?.code ??
                        item?.kode ??
                        item?.outletCode ??
                        ""
                    ),
                    name: String(
                      item?.name ??
                        item?.nama ??
                        item?.outletName ??
                        `Outlet ${id}`
                    ),
                  };
                }
              )
              .filter(
                (
                  item: Outlet | null
                ): item is Outlet =>
                  item !== null
              );

          /*
           * Hilangkan duplicate outlet berdasarkan id.
           */
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
            ).sort(
              (a, b) =>
                a.name.localeCompare(
                  b.name,
                  "id"
                )
            );

          setOutlets(
            unique
          );

          /*
           * ADMIN selalu mulai dari scope SEMUA OUTLET.
           */
          setSelectedOutlet("");

          if (
            unique.length ===
            0
          ) {
            console.warn(
              "LOAD OUTLET REPORT: /api/outlet mengembalikan 0 outlet",
              json
            );
          }
        } catch (error) {
          console.error(
            "LOAD OUTLET REPORT ERROR:",
            error
          );

          setOutlets([]);
          setSelectedOutlet("");
        } finally {
          setLoadingOutlet(false);
        }
      },
      []
    );

  /*
   * ==========================================================
   * LOAD MASTER BARANG
   * ==========================================================
   */

  const loadMasterBarangIds =
    useCallback(
      async (
        outletIds: number[]
      ) => {
        const uniqueOutletIds =
          Array.from(
            new Set(
              outletIds
                .map(Number)
                .filter(
                  (id) =>
                    Number.isFinite(
                      id
                    )
                )
            )
          );

        const result =
          new Map<
            number,
            Set<number>
          >();

        if (
          uniqueOutletIds.length === 0
        ) {
          return result;
        }

        setMasterBarangLoading(
          true
        );
        setMasterBarangReady(
          false
        );

        try {
          const responses =
            await Promise.all(
              uniqueOutletIds.map(
                async (
                  outletId
                ) => {
                  try {
                    const res =
                      await fetch(
                        `/api/outlet/master-barang?outletId=${encodeURIComponent(
                          String(
                            outletId
                          )
                        )}`,
                        {
                          cache:
                            "no-store",
                        }
                      );

                    if (!res.ok) {
                      console.error(
                        `MASTER BARANG OUTLET ${outletId}: HTTP ${res.status}`
                      );

                      return {
                        outletId,
                        ids:
                          new Set<number>(),
                        ok: false,
                      };
                    }

                    const json =
                      (await res.json()) as MasterBarangResponse;

                    if (
                      json &&
                      json.success ===
                        false
                    ) {
                      console.error(
                        `MASTER BARANG OUTLET ${outletId}:`,
                        json.message
                      );

                      return {
                        outletId,
                        ids:
                          new Set<number>(),
                        ok: false,
                      };
                    }

                    return {
                      outletId,
                      ids:
                        extractMasterBarangIds(
                          json
                        ),
                      ok: true,
                    };
                  } catch (error) {
                    console.error(
                      `LOAD MASTER BARANG OUTLET ${outletId} ERROR:`,
                      error
                    );

                    return {
                      outletId,
                      ids:
                        new Set<number>(),
                      ok: false,
                    };
                  }
                }
              )
            );

          let allSuccess = true;
          let total = 0;

          for (const response of responses) {
            result.set(
              response.outletId,
              response.ids
            );

            total +=
              response.ids.size;

            if (!response.ok) {
              allSuccess = false;
            }
          }

          setMasterBarangCount(
            total
          );

          setMasterBarangReady(
            allSuccess
          );

          return result;
        } finally {
          setMasterBarangLoading(
            false
          );
        }
      },
      []
    );

  /*
   * ==========================================================
   * OUTLET EXTRACTION FROM STOCK RESPONSE
   * ==========================================================
   *
   * Fallback untuk kondisi ketika /api/outlet tidak mengirim daftar
   * outlet, tetapi endpoint stock-awal sudah mengirim relasi outlet.
   * Ini membuat dropdown tetap dapat terisi dari data yang benar-benar
   * tersedia di halaman tanpa membuat outlet baru.
   */
  function extractOutletsFromStocks(
    stocks: OutletStock[]
  ): Outlet[] {
    const map =
      new Map<number, Outlet>();

    for (const item of stocks) {
      const outletId =
        Number(
          item?.outletId ??
            item?.outlet?.id
        );

      if (
        !Number.isFinite(
          outletId
        )
      ) {
        continue;
      }

      const outlet =
        item?.outlet;

      map.set(
        outletId,
        {
          id: outletId,
          code: String(
            outlet?.code ??
              ""
          ),
          name: String(
            outlet?.name ??
              `Outlet ${outletId}`
          ),
        }
      );
    }

    return Array.from(
      map.values()
    ).sort(
      (a, b) =>
        a.name.localeCompare(
          b.name,
          "id"
        )
    );
  }

  /*
   * ==========================================================
   * LOAD DATA
   * ==========================================================
   */

  const loadData =
    useCallback(
      async (
        outletFilter?: string,
        forcedUser?: User
      ) => {
        const sequence =
          ++requestSequence.current;

        try {
          setLoading(true);
          setMasterBarangLoading(
            true
          );
          setMasterBarangReady(
            false
          );
          setMasterBarangCount(0);

          const currentUser =
            forcedUser ||
            user ||
            (await loadUser());

          if (
            sequence !==
            requestSequence.current
          ) {
            return;
          }

          /*
           * ==================================================
           * API STOCK
           * ==================================================
           *
           * ADMIN:
           * - Jika memilih outlet tertentu -> ambil outlet tersebut.
           * - Jika "Semua Outlet" -> ambil data per outlet satu per satu.
           *
           * Cara ini sengaja dibuat eksplisit supaya ADMIN tidak
           * bergantung pada default outlet/session di backend.
           *
           * OUTLET_ADMIN:
           * - Selalu dikunci ke outlet dari session.
           *
           * Dengan fetch per outlet, endpoint yang secara default
           * hanya mengembalikan satu outlet tetap dapat digunakan
           * untuk laporan ADMIN semua outlet.
           */

          const fetchStockByOutlet =
            async (
              outletId?: string
            ): Promise<{
              outletId: number | null;
              json: ApiResponse;
            }> => {
              const params =
                new URLSearchParams();

              params.set(
                "period",
                period
              );

              if (outletId) {
                params.set(
                  "outletId",
                  outletId
                );
              }

              const url =
                `/api/outlet/stock-awal?${params.toString()}`;

              const res =
                await fetch(
                  url,
                  {
                    cache:
                      "no-store",
                  }
                );

              const json: ApiResponse =
                await res.json();

              if (
                !res.ok ||
                !json.success
              ) {
                throw new Error(
                  json.message ||
                    "Gagal mengambil stock outlet"
                );
              }

              return {
                outletId:
                  outletId
                    ? Number(
                        outletId
                      )
                    : null,
                json,
              };
            };

          let stockResponses:
            Array<{
              outletId: number | null;
              json: ApiResponse;
            }> = [];

          /*
           * OUTLET_ADMIN selalu satu outlet.
           */
          if (
            currentUser.role ===
            "OUTLET_ADMIN"
          ) {
            if (
              !currentUser.outletId
            ) {
              setData([]);
              setApiMeta({});
              return;
            }

            stockResponses = [
              await fetchStockByOutlet(
                String(
                  currentUser.outletId
                )
              ),
            ];
          } else if (
            outletFilter
          ) {
            /*
             * ADMIN memilih satu outlet.
             */
            stockResponses = [
              await fetchStockByOutlet(
                outletFilter
              ),
            ];
          } else {
            /*
             * ADMIN memilih SEMUA OUTLET.
             *
             * Ambil daftar outlet terbaru dari endpoint outlet,
             * bukan hanya mengandalkan state React, supaya ketika
             * halaman baru dibuka seluruh outlet tetap ikut.
             */
            let adminOutlets: Outlet[] =
              [];

            try {
              const outletRes =
                await fetch(
                  "/api/outlet",
                  {
                    cache:
                      "no-store",
                  }
                );

              const outletJson =
                await outletRes.json();

              adminOutlets =
                Array.isArray(
                  outletJson
                )
                  ? outletJson
                  : Array.isArray(
                      outletJson?.data
                    )
                  ? outletJson.data
                  : [];
            } catch (
              outletError
            ) {
              console.error(
                "LOAD ALL OUTLET LIST ERROR:",
                outletError
              );
            }

            /*
             * Jika endpoint outlet berhasil memberikan daftar,
             * fetch stock masing-masing outlet secara eksplisit.
             */
            if (
              adminOutlets.length >
              0
            ) {
              stockResponses =
                await Promise.all(
                  adminOutlets.map(
                    (outlet) =>
                      fetchStockByOutlet(
                        String(
                          outlet.id
                        )
                      )
                  )
                );
            } else {
              /*
               * Fallback: tetap coba endpoint tanpa outletId.
               */
              stockResponses = [
                await fetchStockByOutlet(),
              ];
            }
          }

          if (
            sequence !==
            requestSequence.current
          ) {
            return;
          }

          /*
           * Gabungkan data dari seluruh response.
           */
          const stocks: OutletStock[] =
            stockResponses.flatMap(
              (response) =>
                Array.isArray(
                  response.json.data
                )
                  ? response.json.data
                  : []
            );

          /*
           * Fallback outlet list:
           * jika /api/outlet kosong/error, gunakan relasi outlet yang
           * dikirim endpoint stock-awal. Untuk ADMIN, daftar ini tetap
           * hanya berisi outlet yang benar-benar ditemukan di data.
           */
          if (
            currentUser.role ===
              "ADMIN" &&
            outlets.length ===
              0 &&
            stocks.length >
              0
          ) {
            const discovered =
              extractOutletsFromStocks(
                stocks
              );

            if (
              discovered.length >
              0
            ) {
              setOutlets(
                discovered
              );
            }
          }

          /*
           * Gabungkan metadata map.
           *
           * API dapat mengirim key:
           *   "barangId"
           * atau:
           *   "outletId-barangId"
           *
           * Saat ADMIN melihat semua outlet, key barangId saja
           * berpotensi bentrok antar outlet. Karena itu key numeric
           * dinormalisasi menjadi composite outletId-barangId.
           */
          const mergeNumberMaps = (
            field:
              | "stockOpname"
              | "approvedStockOpname"
              | "openingStock"
              | "stockAwal"
              | "barangMasuk"
              | "stockIn"
              | "pemakaian"
              | "usage"
              | "costPercent"
              | "costPercentage"
              | "costPct"
              | "previousCost"
              | "previousCostPercent"
              | "previousCostPercentage",
          ) => {
            const merged: NumberMap =
              {};

            for (
              const response of
                stockResponses
            ) {
              const map =
                response.json[
                  field
                ];

              if (
                !map ||
                typeof map !==
                  "object"
              ) {
                continue;
              }

              const scopedOutletId =
                response.outletId;

              for (
                const [
                  key,
                  value,
                ] of Object.entries(
                  map
                )
              ) {
                const parsed =
                  numberValue(
                    value
                  );

                if (
                  parsed ===
                  null
                ) {
                  continue;
                }

                /*
                 * Jika sudah composite, pertahankan.
                 */
                if (
                  key.includes(
                    "-"
                  ) ||
                  key.includes(
                    ":"
                  ) ||
                  key.includes(
                    "_"
                  ) ||
                  key.includes(
                    "."
                  ) ||
                  key.includes(
                    "/"
                  ) ||
                  key.includes(
                    "|"
                  )
                ) {
                  merged[key] =
                    parsed;
                  continue;
                }

                /*
                 * Key numeric murni berarti barangId.
                 */
                if (
                  scopedOutletId !==
                    null &&
                  /^\\d+$/.test(
                    key
                  )
                ) {
                  merged[
                    `${scopedOutletId}-${key}`
                  ] = parsed;
                } else {
                  merged[key] =
                    parsed;
                }
              }
            }

            return merged;
          };

          const mergedMeta: ApiResponse =
            {
              ...(stockResponses[0]
                ?.json || {}),
            };

          const mapFields = [
            "stockOpname",
            "approvedStockOpname",
            "openingStock",
            "stockAwal",
            "barangMasuk",
            "stockIn",
            "pemakaian",
            "usage",
            "costPercent",
            "costPercentage",
            "costPct",
            "previousCost",
            "previousCostPercent",
            "previousCostPercentage",
          ] as const;

          for (
            const field of
              mapFields
          ) {
            const mergedMap =
              mergeNumberMaps(
                field
              );

            if (
              Object.keys(
                mergedMap
              ).length >
              0
            ) {
              mergedMeta[field] =
                mergedMap;
            }
          }

          mergedMeta.data =
            stocks;

          setApiMeta(
            mergedMeta
          );

          /*
           * ==================================================
           * FILTER OUTLET
           * ==================================================
           */

          const outletFiltered =
            currentUser.role ===
            "OUTLET_ADMIN"
              ? stocks.filter(
                  (item) =>
                    Number(
                      item.outletId
                    ) ===
                    Number(
                      currentUser.outletId
                    )
                )
              : outletFilter
              ? stocks.filter(
                  (item) =>
                    Number(
                      item.outletId
                    ) ===
                    Number(
                      outletFilter
                    )
                )
              : stocks;

          /*
           * ==================================================
           * MASTER BARANG PER OUTLET
           * ==================================================
           */

          const outletIds =
            Array.from(
              new Set(
                outletFiltered
                  .map(
                    (item) =>
                      Number(
                        item.outletId
                      )
                  )
                  .filter(
                    (id) =>
                      Number.isFinite(
                        id
                      )
                  )
              )
            );

          const masterMap =
            await loadMasterBarangIds(
              outletIds
            );

          if (
            sequence !==
            requestSequence.current
          ) {
            return;
          }

          /*
           * ==================================================
           * ONLY MASTER BARANG
           * ==================================================
           */

          const filtered =
            outletFiltered.filter(
              (item) => {
                const outletMaster =
                  masterMap.get(
                    Number(
                      item.outletId
                    )
                  );

                if (
                  !outletMaster
                ) {
                  return false;
                }

                return outletMaster.has(
                  Number(
                    item.barangId
                  )
                );
              }
            );

          setData(filtered);
        } catch (error) {
          if (
            sequence !==
            requestSequence.current
          ) {
            return;
          }

          console.error(
            "LOAD OUTLET STOCK REPORT ERROR:",
            error
          );

          setData([]);
          setApiMeta({});
          setMasterBarangReady(
            false
          );
          setMasterBarangCount(0);
        } finally {
          if (
            sequence ===
            requestSequence.current
          ) {
            setLoading(false);
            setMasterBarangLoading(
              false
            );
          }
        }
      },
      [
        loadMasterBarangIds,
        loadUser,
        period,
        user,
        outlets,
      ]
    );

  /*
   * ==========================================================
   * INITIAL LOAD
   * ==========================================================
   */

  useEffect(() => {
    if (initialLoaded.current) {
      return;
    }

    initialLoaded.current = true;

    let cancelled = false;

    async function init() {
      try {
        const loginUser =
          await loadUser();

        if (cancelled) {
          return;
        }

        await loadOutlets(
          loginUser
        );

        if (cancelled) {
          return;
        }

        await loadData(
          loginUser.role ===
            "OUTLET_ADMIN"
            ? String(
                loginUser.outletId
              )
            : "",
          loginUser
        );
      } catch (error) {
        if (
          cancelled
        ) {
          return;
        }

        console.error(
          "INIT OUTLET REPORT ERROR:",
          error
        );

        setData([]);
        setLoading(false);
        setLoadingOutlet(false);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [
    loadData,
    loadOutlets,
    loadUser,
  ]);

  /*
   * ==========================================================
   * PERIOD CHANGE
   * ==========================================================
   */

  useEffect(() => {
    if (!user) {
      return;
    }

    /*
     * Initial load sudah dilakukan
     * oleh init().
     */
    if (
      !initialLoaded.current
    ) {
      return;
    }

    /*
     * Jangan izinkan periode masa depan.
     */
    if (
      period >
      currentPeriod
    ) {
      setPeriod(
        currentPeriod
      );

      return;
    }

    /*
     * Saat period berubah, ambil ulang
     * data dengan outlet aktif.
     */
    loadData(
      user.role ===
        "OUTLET_ADMIN"
        ? String(
            user.outletId
          )
        : selectedOutlet
    );
  }, [
    period,
    user,
    selectedOutlet,
    currentPeriod,
    loadData,
  ]);

  /*
   * ==========================================================
   * OUTLET CHANGE
   * ==========================================================
   */

  async function handleOutletChange(
    value: string
  ) {
    if (
      user?.role !==
      "ADMIN"
    ) {
      return;
    }

    const nextValue =
      String(value || "");

    setSelectedOutlet(
      nextValue
    );

    /*
     * Gunakan value yang baru secara langsung.
     * Jangan menunggu state React berubah karena loadData harus
     * segera memakai outlet yang dipilih user.
     */
    await loadData(
      nextValue
    );
  }

  /*
   * ==========================================================
   * SEARCH
   * ==========================================================
   */

  const filteredData =
    useMemo(() => {
      const keyword =
        search
          .toLowerCase()
          .trim();

      if (!keyword) {
        return data;
      }

      return data.filter(
        (item) => {
          const text = [
            item.barang?.code,
            item.barang?.name,
            item.barang?.unit,
            item.barang?.barcode,
            item.outlet?.code,
            item.outlet?.name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return text.includes(
            keyword
          );
        }
      );
    }, [
      data,
      search,
    ]);

  /*
   * ==========================================================
   * STOCK AWAL
   * ==========================================================
   *
   * PRIORITAS:
   *
   * 1. Field opening yang eksplisit
   * 2. Map opening dari API
   * 3. Approved opname yang eksplisit
   * 4. Map approved opname
   * 5. 0
   *
   * PENTING:
   * current stock TIDAK PERNAH digunakan sebagai
   * Stock Awal fallback.
   *
   * Ini mencegah stock akhir terbaca sebagai
   * saldo awal.
   */

  function getStockAwal(
    item: OutletStock
  ) {
    /*
     * Explicit opening field.
     */
    const explicitOpening =
      firstNumber(
        item.stockAwal,
        item.openingStock,
        item.openingQty,
        item.saldoAwal
      );

    if (
      explicitOpening !==
      null
    ) {
      return explicitOpening;
    }

    /*
     * API map opening.
     */
    const openingMap =
      apiMeta.openingStock ||
      apiMeta.stockAwal;

    const mappedOpening =
      getMapValue(
        openingMap,
        Number(
          item.outletId
        ),
        Number(
          item.barangId
        )
      );

    if (
      mappedOpening !==
      null
    ) {
      return mappedOpening;
    }

    /*
     * Approved stock opname
     * hanya dipakai sebagai fallback
     * jika backend memang menyediakan
     * field tersebut.
     */
    const approved =
      firstNumber(
        item.approvedOpnameStock,
        item.approvedStockOpname
      );

    if (
      approved !==
      null
    ) {
      return approved;
    }

    const approvedMap =
      apiMeta.approvedStockOpname ||
      apiMeta.stockOpname;

    const mappedApproved =
      getMapValue(
        approvedMap,
        Number(
          item.outletId
        ),
        Number(
          item.barangId
        )
      );

    if (
      mappedApproved !==
      null
    ) {
      return mappedApproved;
    }

    return 0;
  }

  /*
   * ==========================================================
   * BARANG MASUK
   * ==========================================================
   */

  function getBarangMasuk(
    item: OutletStock
  ) {
    /*
     * Explicit period movement.
     */
    const direct =
      firstNumber(
        item.barangMasuk,
        item.stockIn,
        item.totalBarangMasuk,
        item.incomingQty
      );

    if (
      direct !==
      null
    ) {
      return direct;
    }

    /*
     * receivedQty hanya digunakan
     * jika backend memang mengirimnya
     * sebagai quantity received periode.
     */
    const received =
      numberValue(
        item.receivedQty
      );

    if (
      received !==
      null
    ) {
      return received;
    }

    const map =
      apiMeta.barangMasuk ||
      apiMeta.stockIn;

    const mapped =
      getMapValue(
        map,
        Number(
          item.outletId
        ),
        Number(
          item.barangId
        )
      );

    if (
      mapped !==
      null
    ) {
      return mapped;
    }

    return 0;
  }

  /*
   * ==========================================================
   * STOCK AKHIR
   * ==========================================================
   *
   * Stock akhir = stock periode yang diberikan backend.
   *
   * Tidak dihitung dari opening + incoming karena stock
   * juga dapat berubah melalui:
   * - waste
   * - transfer
   * - opname
   * - adjustment
   * - transaksi lain.
   */

  function getStockBerjalan(
    item: OutletStock
  ) {
    return (
      firstNumber(
        item.stockBerjalan,
        item.runningStock,
        item.currentStock,
        item.stock
      ) ?? 0
    );
  }

  /*
   * ==========================================================
   * PEMAKAIAN
   * ==========================================================
   */

  function getPemakaian(
    item: OutletStock
  ) {
    /*
     * API authoritative value.
     */
    const direct =
      firstNumber(
        item.pemakaian,
        item.usage,
        item.usedQty,
        item.consumption
      );

    if (
      direct !==
      null
    ) {
      return direct;
    }

    const map =
      apiMeta.pemakaian ||
      apiMeta.usage;

    const mapped =
      getMapValue(
        map,
        Number(
          item.outletId
        ),
        Number(
          item.barangId
        )
      );

    if (
      mapped !==
      null
    ) {
      return mapped;
    }

    /*
     * Fallback accounting movement:
     *
     * Opening
     * + Incoming
     * - Ending
     *
     * Jika hasil negatif, jangan tampilkan
     * pemakaian negatif.
     */
    const opening =
      getStockAwal(item);

    const incoming =
      getBarangMasuk(item);

    const ending =
      getStockBerjalan(item);

    return Math.max(
      0,
      opening +
        incoming -
        ending
    );
  }

  /*
   * ==========================================================
   * HARGA
   * ==========================================================
   */

  function getHarga(
    item: OutletStock
  ) {
    return (
      firstNumber(
        item.harga,
        item.price,
        item.averageCost,
        item.barang
          ?.purchasePrice
      ) ?? 0
    );
  }

  /*
   * ==========================================================
   * COST CURRENT
   * ==========================================================
   */

  function getCostPercent(
    item: OutletStock
  ): number | null {
    const direct =
      firstNumber(
        item.costPercent,
        item.costPercentage,
        item.costPct,
        item.costRate
      );

    if (
      direct !==
      null
    ) {
      return direct;
    }

    /*
     * cost adalah fallback terakhir.
     */
    const cost =
      numberValue(
        item.cost
      );

    if (
      cost !==
      null
    ) {
      return cost;
    }

    const map =
      apiMeta.costPercent ||
      apiMeta.costPercentage ||
      apiMeta.costPct;

    return getMapValue(
      map,
      Number(
        item.outletId
      ),
      Number(
        item.barangId
      )
    );
  }

  /*
   * ==========================================================
   * PREVIOUS COST
   * ==========================================================
   */

  function getPreviousCostPercent(
    item: OutletStock
  ): number | null {
    const direct =
      firstNumber(
        item.previousCostPercent,
        item.previousCostPercentage,
        item.previousCostPct,
        item.previousCostRate,
        item.lastMonthCostPercent,
        item.costBulanSebelumnya
      );

    if (
      direct !==
      null
    ) {
      return direct;
    }

    const map =
      apiMeta.previousCostPercent ||
      apiMeta.previousCostPercentage ||
      apiMeta.previousCost;

    return getMapValue(
      map,
      Number(
        item.outletId
      ),
      Number(
        item.barangId
      )
    );
  }

  /*
   * ==========================================================
   * REPORT ROWS
   * ==========================================================
   */

  const reportRows =
    useMemo<ReportRow[]>(
      () => {
        return filteredData.map(
          (item) => {
            const stockAwal =
              getStockAwal(
                item
              );

            const barangMasuk =
              getBarangMasuk(
                item
              );

            const stockBerjalan =
              getStockBerjalan(
                item
              );

            const pemakaian =
              getPemakaian(
                item
              );

            const harga =
              getHarga(
                item
              );

            const nilaiStock =
              stockBerjalan *
              harga;

            const costPercent =
              getCostPercent(
                item
              );

            const previousCostPercent =
              getPreviousCostPercent(
                item
              );

            const costDifferencePoint =
              costPercent ===
                null ||
              previousCostPercent ===
                null
                ? null
                : costPercent -
                  previousCostPercent;

            const costDifferencePercent =
              previousCostPercent ===
                null ||
              previousCostPercent ===
                0 ||
              costPercent ===
                null
                ? null
                : ((costPercent -
                    previousCostPercent) /
                    previousCostPercent) *
                  100;

            return {
              ...item,

              stockAwalValue:
                stockAwal,

              barangMasukValue:
                barangMasuk,

              stockBerjalanValue:
                stockBerjalan,

              pemakaianValue:
                pemakaian,

              hargaValue:
                harga,

              nilaiStockValue:
                nilaiStock,

              costPercentValue:
                costPercent,

              previousCostPercentValue:
                previousCostPercent,

              costDifferencePoint,

              costDifferencePercent,
            };
          }
        );
      },
      [
        filteredData,
        apiMeta,
      ]
    );

  /*
   * ==========================================================
   * FORMAT
   * ==========================================================
   */

  function formatNumber(
    value: number
  ) {
    return Number(
      value || 0
    ).toLocaleString(
      "id-ID",
      {
        maximumFractionDigits: 3,
      }
    );
  }

  function formatRupiah(
    value: number
  ) {
    return `Rp ${Number(
      value || 0
    ).toLocaleString(
      "id-ID",
      {
        maximumFractionDigits: 0,
      }
    )}`;
  }

  function formatPercent(
    value: number | null
  ) {
    if (
      value ===
      null
    ) {
      return "-";
    }

    return `${
      value >= 0 ? "+" : ""
    }${value.toLocaleString(
      "id-ID",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}%`;
  }

  function formatPlainPercent(
    value: number | null
  ) {
    if (
      value ===
      null
    ) {
      return "-";
    }

    return `${value.toLocaleString(
      "id-ID",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}%`;
  }

  /*
   * ==========================================================
   * STOCK STATUS
   * ==========================================================
   */

  function getStockStatus(
    row: ReportRow
  ) {
    const stock =
      row.stockBerjalanValue;

    const minimum =
      Number(
        row.minimumStock || 0
      );

    if (
      stock <= 0
    ) {
      return "HABIS";
    }

    if (
      stock <= minimum
    ) {
      return "MINIMUM";
    }

    return "AMAN";
  }

  function getStatusClass(
    status: string
  ) {
    if (
      status ===
      "HABIS"
    ) {
      return "bg-[#FDECEC] text-[#C84B4B] border-[#F3CCCC]";
    }

    if (
      status ===
      "MINIMUM"
    ) {
      return "bg-[#FFF4DD] text-[#9A6A18] border-[#F0D9A5]";
    }

    return "bg-[#E8F4EC] text-[#2F7A4F] border-[#CBE5D3]";
  }

  /*
   * ==========================================================
   * COST TREND
   * ==========================================================
   */

  function getCostTrend(
    row: ReportRow
  ) {
    if (
      row.costPercentValue ===
        null ||
      row.previousCostPercentValue ===
        null ||
      row.costDifferencePoint ===
        null
    ) {
      return "NONE";
    }

    if (
      Math.abs(
        row.costDifferencePoint
      ) < 0.0001
    ) {
      return "SAMA";
    }

    if (
      row.costDifferencePoint >
      0
    ) {
      return "NAIK";
    }

    return "TURUN";
  }

  /*
   * ==========================================================
   * SUMMARY
   * ==========================================================
   */

  const totalBarang =
    reportRows.length;

  const totalStockAwal =
    reportRows.reduce(
      (sum, row) =>
        sum +
        row.stockAwalValue,
      0
    );

  const totalBarangMasuk =
    reportRows.reduce(
      (sum, row) =>
        sum +
        row.barangMasukValue,
      0
    );

  const totalStockBerjalan =
    reportRows.reduce(
      (sum, row) =>
        sum +
        row.stockBerjalanValue,
      0
    );

  const totalPemakaian =
    reportRows.reduce(
      (sum, row) =>
        sum +
        row.pemakaianValue,
      0
    );

  const totalNilai =
    reportRows.reduce(
      (sum, row) =>
        sum +
        row.nilaiStockValue,
      0
    );

  const totalCostNaik =
    reportRows.filter(
      (row) =>
        getCostTrend(
          row
        ) === "NAIK"
    ).length;

  const totalCostTurun =
    reportRows.filter(
      (row) =>
        getCostTrend(
          row
        ) === "TURUN"
    ).length;

  /*
   * ==========================================================
   * SELECTED OUTLET
   * ==========================================================
   */

  const selectedOutletData =
    outlets.find(
      (item) =>
        String(
          item.id
        ) ===
        selectedOutlet
    );

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <div className="min-h-full bg-[#F6F8F7] p-4 md:p-6 xl:p-8">

      {/* HEADER */}

      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

        <div className="flex items-center gap-3">

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#497F70] text-white shadow-[0_10px_30px_rgba(73,127,112,0.18)]">
            <Boxes size={23} />
          </div>

          <div>

            <div className="flex flex-wrap items-center gap-2">

              <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
                Laporan Stock Outlet
              </h1>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#CFE3DA] bg-[#EAF3EF] px-2.5 py-1 text-[11px] font-bold text-[#497F70]">
                <CalendarDays size={12} />
                {periodLabel}
              </span>

            </div>

            <p className="mt-1 text-sm text-gray-500">
              Rekap stock, pemakaian,
              nilai persediaan dan Cost
              (%) berdasarkan periode
              dan Master Barang Outlet.
            </p>

          </div>

        </div>

        <button
          type="button"
          onClick={() =>
            loadData(
              user?.role ===
                "OUTLET_ADMIN"
                ? String(
                    user.outletId
                  )
                : selectedOutlet
            )
          }
          disabled={
            loading ||
            masterBarangLoading
          }
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
            transition
            hover:bg-[#F5F8F6]
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          <RefreshCw
            size={16}
            className={
              loading ||
              masterBarangLoading
                ? "animate-spin"
                : ""
            }
          />

          Refresh
        </button>

      </div>

      {/* PERIOD */}

      <div className="mb-6 rounded-2xl border border-[#DDE9E4] bg-white p-4 shadow-sm md:p-5">

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

          <div className="flex items-start gap-3">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <History size={18} />
            </div>

            <div>

              <p className="text-sm font-bold text-[#18352D]">
                Periode Laporan
              </p>

              <p className="mt-1 max-w-2xl text-xs leading-5 text-gray-500">
                Stock Awal mengikuti saldo
                pembuka periode. Jika Stock
                Opname bulan sebelumnya sudah
                APPROVED, hasil opname tersebut
                menjadi Stock Awal bulan
                berikutnya. Stock Akhir
                mengikuti saldo stock periode
                yang diberikan API.
              </p>

            </div>

          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

            <div>

              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-400">
                Bulan
              </label>

              <input
                type="month"
                value={period}
                max={currentPeriod}
                onChange={(e) => {
                  const nextPeriod =
                    e.target.value;

                  if (
                    !nextPeriod
                  ) {
                    return;
                  }

                  setPeriod(
                    nextPeriod >
                      currentPeriod
                      ? currentPeriod
                      : nextPeriod
                  );
                }}
                className="
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  px-3
                  py-2.5
                  text-sm
                  font-semibold
                  text-[#35564C]
                  outline-none
                  transition
                  focus:border-[#497F70]
                  focus:bg-white
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
              />

            </div>

            <div className="rounded-xl border border-[#DDE9E4] bg-[#FAFCFB] px-4 py-3">

              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                Dibandingkan
              </p>

              <p className="mt-1 text-sm font-bold text-[#35564C]">
                {previousPeriod}
              </p>

            </div>

          </div>

        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">

          <div className="flex items-center gap-2 rounded-xl bg-[#F5F8F6] px-3 py-2.5 text-xs text-gray-600">
            <span className="h-2 w-2 rounded-full bg-[#497F70]" />
            <span>
              Stock Awal = saldo pembuka
              periode
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-[#F5F8F6] px-3 py-2.5 text-xs text-gray-600">
            <span className="h-2 w-2 rounded-full bg-[#79A99A]" />
            <span>
              Stock Opname APPROVED menjadi
              saldo awal bulan berikutnya
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-[#F5F8F6] px-3 py-2.5 text-xs text-gray-600">
            <span className="h-2 w-2 rounded-full bg-[#D39A54]" />
            <span>
              Cost dan perbandingan
              ditampilkan dalam %
            </span>
          </div>

        </div>

      </div>

      {/* FILTER */}

      <div className="mb-6 rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          <div>

            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#35564C]">
              <Store size={16} />
              Outlet
            </label>

            <select
              value={
                user?.role ===
                "OUTLET_ADMIN"
                  ? String(
                      user.outletId ??
                        ""
                    )
                  : selectedOutlet
              }
              disabled={
                user?.role ===
                  "OUTLET_ADMIN"
              }
              onChange={(e) =>
                handleOutletChange(
                  e.target.value
                )
              }
              className="
                w-full
                rounded-xl
                border
                border-[#D5E5DC]
                bg-[#FAFCFB]
                px-4
                py-3
                text-sm
                font-medium
                text-[#35564C]
                outline-none
                transition
                focus:border-[#497F70]
                focus:bg-white
                focus:ring-2
                focus:ring-[#497F70]/10
                disabled:cursor-not-allowed
                disabled:bg-gray-100
                disabled:text-gray-500
              "
            >

              {user?.role ===
                "ADMIN" && (
                <option value="">
                  {outlets.length ===
                    0
                    ? loadingOutlet
                      ? "Memuat outlet..."
                      : "Outlet tidak tersedia"
                    : "-- Semua Outlet --"}
                </option>
              )}

              {outlets.map(
                (item) => (
                  <option
                    key={item.id}
                    value={String(
                      item.id
                    )}
                  >
                    {item.code
                      ? `${item.code} - `
                      : ""}
                    {item.name}
                  </option>
                )
              )}

            </select>

            {user?.role ===
              "ADMIN" &&
              !loadingOutlet &&
              outlets.length ===
                0 && (
                <p className="mt-2 text-[11px] font-medium text-[#C84B4B]">
                  Daftar outlet belum berhasil dimuat. Klik Refresh untuk mencoba lagi.
                </p>
              )}

          </div>

          <div className="lg:col-span-2">

            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#35564C]">
              <Search size={16} />
              Cari Barang
            </label>

            <div className="relative">

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
                placeholder="Cari kode, barcode, nama barang..."
                className="
                  w-full
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  py-3
                  pl-9
                  pr-4
                  text-sm
                  outline-none
                  transition
                  focus:border-[#497F70]
                  focus:bg-white
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
              />

            </div>

          </div>

        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">

          <span className="rounded-full bg-[#EAF3EF] px-3 py-1.5 text-xs font-semibold text-[#497F70]">
            {user?.role ===
            "ADMIN"
              ? selectedOutletData
                ? `Outlet: ${selectedOutletData.code} - ${selectedOutletData.name}`
                : "Semua Outlet"
              : user?.outlet
              ? `Outlet: ${user.outlet.code} - ${user.outlet.name}`
              : "Outlet Login"}
          </span>

          <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500">
            Periode:{" "}
            {periodLabel}
          </span>

          <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500">
            Cost vs{" "}
            {previousPeriod}
          </span>

          <span className="rounded-full bg-[#EAF3EF] px-3 py-1.5 text-xs font-semibold text-[#497F70]">
            Master Barang:{" "}
            {masterBarangLoading
              ? "Memuat..."
              : masterBarangReady
              ? `${formatNumber(
                  masterBarangCount
                )} terhubung`
              : "Belum terbaca"}
          </span>

          {isCurrentPeriod && (
            <span className="rounded-full bg-[#EAF3EF] px-3 py-1.5 text-xs font-bold text-[#497F70]">
              Bulan berjalan
            </span>
          )}

        </div>

      </div>

      {/* SUMMARY */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Total Barang
              </p>
              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  totalBarang
                )}
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Package size={19} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Stock Awal
              </p>
              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  totalStockAwal
                )}
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <History size={19} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Barang Masuk
              </p>
              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  totalBarangMasuk
                )}
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <ArrowUp size={19} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Pemakaian
              </p>
              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  totalPemakaian
                )}
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF4DD] text-[#9A6A18]">
              <ArrowDown size={19} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Nilai Stock
              </p>
              <p className="mt-2 text-lg font-bold text-[#18352D]">
                {formatRupiah(
                  totalNilai
                )}
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Wallet size={19} />
            </div>
          </div>
        </div>

      </div>

      {/* COST SUMMARY */}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">

        <div className="rounded-2xl border border-[#DDE9E4] bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FDECEC] text-[#C84B4B]">
              <TrendingUp size={18} />
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                Cost Naik
              </p>
              <p className="text-lg font-bold text-[#18352D]">
                {totalCostNaik}
              </p>
              <p className="text-[10px] text-gray-400">
                dibanding bulan sebelumnya
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F4EC] text-[#2F7A4F]">
              <TrendingDown size={18} />
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                Cost Turun
              </p>
              <p className="text-lg font-bold text-[#18352D]">
                {totalCostTurun}
              </p>
              <p className="text-[10px] text-gray-400">
                dibanding bulan sebelumnya
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <CircleDollarSign size={18} />
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                Cost
              </p>

              <p className="text-lg font-bold text-[#18352D]">
                %
              </p>

              <p className="text-[10px] text-gray-400">
                perbandingan menggunakan
                percentage point
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* TABLE */}

      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        <div className="flex flex-col gap-3 border-b border-[#E5ECE9] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <FileText size={19} />
            </div>

            <div>

              <h2 className="font-semibold text-[#18352D]">
                Rekap Stock & Cost
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Stock Awal → Barang Masuk
                → Stock Akhir → Pemakaian
                → Harga → Nilai Stock →
                Cost (%)
              </p>

            </div>

          </div>

          <div className="flex flex-wrap items-center gap-2">

            <span className="rounded-full bg-[#EAF3EF] px-3 py-1.5 text-xs font-semibold text-[#497F70]">
              {formatNumber(
                reportRows.length
              )}{" "}
              barang
            </span>

            <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500">
              Periode {periodLabel}
            </span>

            <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500">
              Cost vs{" "}
              {previousPeriod}
            </span>

          </div>

        </div>

        <div className="overflow-x-auto">

          <table className="min-w-[1950px] w-full text-sm">

            <thead>

              <tr className="border-b border-[#DDE9E4] bg-[#EAF3EF]">

                {user?.role ===
                  "ADMIN" && (
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-20 border-r border-[#DDE9E4] bg-[#EAF3EF] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-[#35564C]"
                  >
                    Outlet
                  </th>
                )}

                <th
                  rowSpan={2}
                  className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-[#35564C]"
                >
                  Kode
                </th>

                <th
                  rowSpan={2}
                  className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-[#35564C]"
                >
                  Barang
                </th>

                <th
                  rowSpan={2}
                  className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-[#35564C]"
                >
                  Satuan
                </th>

                <th
                  colSpan={4}
                  className="border-l border-r border-[#DDE9E4] px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-[#497F70]"
                >
                  Pergerakan Stock
                </th>

                <th
                  colSpan={2}
                  className="border-r border-[#DDE9E4] px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-[#497F70]"
                >
                  Nilai Persediaan
                </th>

                <th
                  colSpan={3}
                  className="border-r border-[#DDE9E4] px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-[#497F70]"
                >
                  Cost (%)
                </th>

                <th
                  rowSpan={2}
                  className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-[#35564C]"
                >
                  Status
                </th>

              </tr>

              <tr className="border-b border-[#E5ECE9] bg-[#F5F8F6]">

                <th className="border-l border-[#DDE9E4] px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide text-[#35564C]">
                  Stock Awal
                </th>

                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide text-[#35564C]">
                  Barang Masuk
                </th>

                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide text-[#35564C]">
                  Stock Akhir
                </th>

                <th className="border-r border-[#DDE9E4] px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide text-[#35564C]">
                  Pemakaian
                </th>

                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide text-[#35564C]">
                  Harga
                </th>

                <th className="border-r border-[#DDE9E4] px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide text-[#35564C]">
                  Nilai Stock
                </th>

                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide text-[#35564C]">
                  Cost Bulan Ini
                </th>

                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide text-[#35564C]">
                  Cost Bulan Sebelumnya
                </th>

                <th className="border-r border-[#DDE9E4] px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide text-[#35564C]">
                  Perbandingan
                </th>

              </tr>

            </thead>

            <tbody>

              {loading ||
              masterBarangLoading ? (

                <tr>

                  <td
                    colSpan={
                      user?.role ===
                      "ADMIN"
                        ? 14
                        : 13
                    }
                    className="px-5 py-16 text-center"
                  >

                    <RefreshCw
                      size={22}
                      className="mx-auto mb-3 animate-spin text-[#497F70]"
                    />

                    <p className="text-sm font-medium text-gray-500">
                      {masterBarangLoading
                        ? "Memeriksa Master Barang Outlet..."
                        : "Memuat laporan stock..."}
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      Periode{" "}
                      {periodLabel}
                    </p>

                  </td>

                </tr>

              ) : reportRows.length ===
                0 ? (

                <tr>

                  <td
                    colSpan={
                      user?.role ===
                      "ADMIN"
                        ? 14
                        : 13
                    }
                    className="px-5 py-16 text-center"
                  >

                    <Package
                      size={42}
                      className="mx-auto mb-3 text-gray-300"
                    />

                    <p className="text-sm font-semibold text-gray-500">
                      Belum ada data
                      stock
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      Tidak ada barang
                      Master Barang Outlet
                      yang terhubung untuk
                      periode{" "}
                      {periodLabel}.
                    </p>

                  </td>

                </tr>

              ) : (

                reportRows.map(
                  (row) => {

                    const status =
                      getStockStatus(
                        row
                      );

                    const costTrend =
                      getCostTrend(
                        row
                      );

                    return (
                      <tr
                        key={`${row.outletId}-${row.barangId}`}
                        className="
                          border-b
                          border-[#EDF2EF]
                          transition
                          hover:bg-[#FAFCFB]
                        "
                      >

                        {user?.role ===
                          "ADMIN" && (
                          <td className="sticky left-0 z-10 border-r border-[#EDF2EF] bg-white px-4 py-4 align-top">

                            <div className="font-semibold text-[#18352D]">
                              {
                                row
                                  .outlet
                                  ?.name
                              }
                            </div>

                            <div className="mt-0.5 text-[11px] text-gray-400">
                              {
                                row
                                  .outlet
                                  ?.code
                              }
                            </div>

                          </td>
                        )}

                        <td className="px-4 py-4 align-top">

                          <span className="rounded-lg bg-[#F5F8F6] px-2 py-1 font-semibold text-[#35564C]">
                            {
                              row
                                .barang
                                ?.code
                            }
                          </span>

                        </td>

                        <td className="px-4 py-4 align-top">

                          <div className="font-semibold text-[#18352D]">
                            {
                              row
                                .barang
                                ?.name
                            }
                          </div>

                          {row
                            .barang
                            ?.barcode && (
                            <div className="mt-1 text-[10px] text-gray-400">
                              Barcode:{" "}
                              {
                                row
                                  .barang
                                  .barcode
                              }
                            </div>
                          )}

                        </td>

                        <td className="px-4 py-4 text-center align-top">

                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">
                            {
                              row
                                .barang
                                ?.unit ||
                              "-"
                            }
                          </span>

                        </td>

                        <td className="border-l border-[#EDF2EF] px-4 py-4 text-right align-top">

                          <div className="font-bold text-[#35564C]">
                            {formatNumber(
                              row.stockAwalValue
                            )}
                          </div>

                          <div className="mt-1 text-[9px] uppercase tracking-wide text-gray-400">
                            saldo awal
                          </div>

                        </td>

                        <td className="px-4 py-4 text-right align-top">

                          <div className="font-bold text-[#497F70]">
                            {formatNumber(
                              row.barangMasukValue
                            )}
                          </div>

                          {row
                            .barangMasukValue >
                            0 && (
                            <div className="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold text-[#497F70]">
                              <ArrowUp
                                size={10}
                              />
                              MASUK
                            </div>
                          )}

                        </td>

                        <td className="px-4 py-4 text-right align-top">

                          <div className="font-bold text-[#18352D]">
                            {formatNumber(
                              row.stockBerjalanValue
                            )}
                          </div>

                          <div className="mt-1 text-[9px] uppercase tracking-wide text-gray-400">
                            stock akhir
                          </div>

                        </td>

                        <td className="border-r border-[#EDF2EF] px-4 py-4 text-right align-top">

                          <div className="font-bold text-[#9A6A18]">
                            {formatNumber(
                              row.pemakaianValue
                            )}
                          </div>

                          {row
                            .pemakaianValue >
                            0 && (
                            <div className="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold text-[#9A6A18]">
                              <ArrowDown
                                size={10}
                              />
                              PAKAI
                            </div>
                          )}

                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right align-top">

                          <span className="font-medium text-[#35564C]">
                            {formatRupiah(
                              row.hargaValue
                            )}
                          </span>

                        </td>

                        <td className="whitespace-nowrap border-r border-[#EDF2EF] px-4 py-4 text-right align-top">

                          <span className="font-bold text-[#18352D]">
                            {formatRupiah(
                              row.nilaiStockValue
                            )}
                          </span>

                          <div className="mt-1 text-[9px] text-gray-400">
                            stock akhir × harga
                          </div>

                        </td>

                        <td className="px-4 py-4 text-right align-top">

                          {row.costPercentValue ===
                          null ? (
                            <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-400">
                              -
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-[#EAF3EF] px-3 py-1.5 text-xs font-bold text-[#497F70]">
                              {formatPlainPercent(
                                row.costPercentValue
                              )}
                            </span>
                          )}

                        </td>

                        <td className="px-4 py-4 text-right align-top">

                          {row.previousCostPercentValue ===
                          null ? (
                            <span className="text-xs text-gray-400">
                              -
                            </span>
                          ) : (
                            <span className="font-semibold text-gray-500">
                              {formatPlainPercent(
                                row.previousCostPercentValue
                              )}
                            </span>
                          )}

                        </td>

                        <td className="border-r border-[#EDF2EF] px-4 py-4 text-right align-top">

                          {costTrend ===
                          "NONE" ? (

                            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-semibold text-gray-400">
                              <Minus
                                size={11}
                              />
                              Belum ada
                            </span>

                          ) : costTrend ===
                            "SAMA" ? (

                            <div className="inline-flex flex-col items-end gap-1">

                              <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-semibold text-gray-500">
                                <Minus
                                  size={11}
                                />
                                SAMA
                              </span>

                              <span className="text-[9px] text-gray-400">
                                0,00%
                              </span>

                            </div>

                          ) : costTrend ===
                            "NAIK" ? (

                            <div className="inline-flex flex-col items-end gap-1">

                              <span className="inline-flex items-center gap-1 rounded-full border border-[#F3CCCC] bg-[#FDECEC] px-2.5 py-1 text-[10px] font-bold text-[#C84B4B]">
                                <TrendingUp
                                  size={11}
                                />
                                NAIK
                              </span>

                              <span className="text-[9px] font-semibold text-[#C84B4B]">
                                {formatPercent(
                                  row.costDifferencePoint
                                )}
                              </span>

                            </div>

                          ) : (

                            <div className="inline-flex flex-col items-end gap-1">

                              <span className="inline-flex items-center gap-1 rounded-full border border-[#CBE5D3] bg-[#E8F4EC] px-2.5 py-1 text-[10px] font-bold text-[#2F7A4F]">
                                <TrendingDown
                                  size={11}
                                />
                                TURUN
                              </span>

                              <span className="text-[9px] font-semibold text-[#2F7A4F]">
                                {formatPercent(
                                  row.costDifferencePoint
                                )}
                              </span>

                            </div>

                          )}

                        </td>

                        <td className="px-4 py-4 text-center align-top">

                          <span
                            className={`
                              inline-flex
                              items-center
                              gap-1.5
                              rounded-full
                              border
                              px-3
                              py-1.5
                              text-[10px]
                              font-bold
                              ${getStatusClass(
                                status
                              )}
                            `}
                          >

                            {status ===
                            "AMAN" ? (
                              <CheckCircle2
                                size={12}
                              />
                            ) : (
                              <AlertTriangle
                                size={12}
                              />
                            )}

                            {status}

                          </span>

                        </td>

                      </tr>
                    );
                  }
                )

              )}

            </tbody>

          </table>

        </div>

        {/* TOTAL */}

        {!loading &&
          !masterBarangLoading &&
          reportRows.length >
            0 && (
            <div className="border-t border-[#E5ECE9] bg-[#FAFCFB]">

              <div className="grid grid-cols-2 gap-4 px-5 py-5 md:grid-cols-4 xl:grid-cols-7">

                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">
                    Barang
                  </p>

                  <p className="mt-1 text-sm font-bold text-[#18352D]">
                    {formatNumber(
                      totalBarang
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">
                    Stock Awal
                  </p>

                  <p className="mt-1 text-sm font-bold text-[#35564C]">
                    {formatNumber(
                      totalStockAwal
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">
                    Barang Masuk
                  </p>

                  <p className="mt-1 text-sm font-bold text-[#497F70]">
                    {formatNumber(
                      totalBarangMasuk
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">
                    Stock Akhir
                  </p>

                  <p className="mt-1 text-sm font-bold text-[#18352D]">
                    {formatNumber(
                      totalStockBerjalan
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">
                    Pemakaian
                  </p>

                  <p className="mt-1 text-sm font-bold text-[#9A6A18]">
                    {formatNumber(
                      totalPemakaian
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">
                    Nilai Stock
                  </p>

                  <p className="mt-1 text-sm font-bold text-[#18352D]">
                    {formatRupiah(
                      totalNilai
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">
                    Cost Trend
                  </p>

                  <p className="mt-1 text-sm font-bold text-[#497F70]">
                    %
                  </p>

                  <p className="text-[9px] text-gray-400">
                    Naik{" "}
                    {totalCostNaik}
                    {" · "}
                    Turun{" "}
                    {totalCostTurun}
                  </p>
                </div>

              </div>

              <div className="flex flex-col gap-2 border-t border-[#E5ECE9] px-5 py-3 text-[10px] text-gray-400 md:flex-row md:items-center md:justify-between">

                <span>
                  Menampilkan{" "}
                  <strong className="text-[#35564C]">
                    {formatNumber(
                      reportRows.length
                    )}
                  </strong>{" "}
                  barang yang terhubung
                  ke Master Barang Outlet
                </span>

                <span>
                  Periode{" "}
                  <strong className="text-[#35564C]">
                    {periodLabel}
                  </strong>
                  {" · "}
                  Cost dibandingkan{" "}
                  <strong className="text-[#35564C]">
                    {previousPeriod}
                  </strong>
                </span>

              </div>

            </div>
          )}

      </div>

      {/* INFORMATION */}

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#DDE9E4] bg-white px-4 py-3 text-[11px] leading-5 text-gray-500 shadow-sm">

        <CircleDollarSign
          size={15}
          className="mt-0.5 shrink-0 text-[#497F70]"
        />

        <p>

          <span className="font-semibold text-[#35564C]">
            Siklus Stock:
          </span>{" "}

          Stock Opname yang sudah
          <strong className="text-[#35564C]">
            {" "}APPROVED
          </strong>{" "}
          pada akhir suatu bulan menjadi
          Stock Awal bulan berikutnya.

          {" "}

          Contohnya Stock Opname Approved
          Oktober menjadi Stock Awal
          November.

          {" "}

          Stock Akhir mengikuti saldo
          stock periode yang dikirim oleh
          backend dan tidak dihitung ulang
          dari Stock Awal + Barang Masuk,
          karena saldo dapat berubah melalui
          transaksi lain seperti waste,
          transfer dan adjustment.

          {" "}

          Laporan hanya menampilkan barang
          yang benar-benar terhubung ke
          Master Barang Outlet.

          {" "}

          <span className="font-semibold text-[#35564C]">
            Cost ditampilkan dalam
            persentase dan perbandingan
            menggunakan percentage point.
          </span>

        </p>

      </div>

    </div>
  );
}