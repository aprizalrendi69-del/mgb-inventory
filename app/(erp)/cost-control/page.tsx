"use client";

import { useEffect, useState } from "react";
import {
  Boxes,
  FileDown,
  Printer,
  RefreshCw,
  Store,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

const money = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const number = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

const pct = (n: number) =>
  `${Number(n || 0).toFixed(2)}%`;

/*
 * =========================================================
 * BENCHMARK PARSER
 *
 * API TIDAK DIUBAH.
 * Helper ini hanya membaca nilai benchmark yang sudah
 * diberikan oleh API.
 *
 * Mendukung:
 * 15
 * "15"
 * "15%"
 * "15.00%"
 * =========================================================
 */

function parseBenchmark(value: any): number {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  const parsed = Number(
    String(value)
      .replace("%", "")
      .replace(",", ".")
      .trim()
  );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

/*
 * =========================================================
 * GET BENCHMARK
 *
 * Prioritas:
 * 1. row.benchmark
 * 2. row.benchmarkValue
 * 3. row.foodCostBenchmark
 * 4. outlet.benchmark
 * 5. outlet.foodCostBenchmark
 * =========================================================
 */

function getBenchmark(
  row: any,
  outlet: any
): number {
  const candidates = [
    row?.benchmark,
    row?.benchmarkValue,
    row?.foodCostBenchmark,
    row?.foodCostTarget,
    outlet?.benchmark,
    outlet?.foodCostBenchmark,
    outlet?.foodCostTarget,
  ];

  for (const value of candidates) {
    const parsed = parseBenchmark(value);

    if (parsed > 0) {
      return parsed;
    }
  }

  return 0;
}

/*
 * =========================================================
 * STATUS
 *
 * NORMAL  : <= 90% benchmark
 * WARNING : > 90% benchmark dan <= benchmark
 * OVER    : > benchmark
 *
 * Contoh benchmark 15%:
 *
 * <= 13.50% -> NORMAL
 * > 13.50% sampai 15% -> WARNING
 * > 15% -> OVER
 * =========================================================
 */

type CostStatus =
  | "NORMAL"
  | "WARNING"
  | "OVER";

function getCostStatus(
  ratioFoodCost: number,
  benchmark: number
): CostStatus {
  const ratio = Number(
    ratioFoodCost || 0
  );

  const target = Number(
    benchmark || 0
  );

  /*
   * Jika benchmark tidak tersedia,
   * jangan mengarang status OVER/WARNING.
   */
  if (target <= 0) {
    return "NORMAL";
  }

  const warningLimit =
    target * 0.9;

  if (ratio > target) {
    return "OVER";
  }

  if (ratio > warningLimit) {
    return "WARNING";
  }

  return "NORMAL";
}

/*
 * =========================================================
 * STATUS STYLE
 * =========================================================
 */

function statusClass(
  status: string
) {
  switch (
    String(status).toUpperCase()
  ) {
    case "OVER":
    case "CRITICAL":
      return "border-red-200 bg-red-100 text-red-700";

    case "WARNING":
      return "border-yellow-200 bg-yellow-100 text-yellow-700";

    case "NORMAL":
    case "AMAN":
      return "border-green-200 bg-green-100 text-green-700";

    default:
      return "border-slate-200 bg-slate-100 text-slate-500";
  }
}

function statusDotClass(
  status: string
) {
  switch (
    String(status).toUpperCase()
  ) {
    case "OVER":
    case "CRITICAL":
      return "bg-red-500";

    case "WARNING":
      return "bg-yellow-500";

    case "NORMAL":
    case "AMAN":
      return "bg-green-500";

    default:
      return "bg-slate-400";
  }
}

/*
 * =========================================================
 * STATUS LABEL
 * =========================================================
 */

function statusLabel(
  status: string
) {
  switch (
    String(status).toUpperCase()
  ) {
    case "OVER":
    case "CRITICAL":
      return "OVER";

    case "WARNING":
      return "WARNING";

    case "NORMAL":
    case "AMAN":
      return "NORMAL";

    default:
      return "NORMAL";
  }
}

/*
 * =========================================================
 * STATUS BADGE
 * =========================================================
 */

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized =
    statusLabel(status);

  return (
    <span
      className={`
        inline-flex
        items-center
        justify-center
        gap-1.5
        rounded-lg
        border
        px-2.5
        py-1
        text-[10px]
        font-bold
        ${statusClass(normalized)}
      `}
    >
      <span
        className={`
          h-1.5
          w-1.5
          rounded-full
          ${statusDotClass(normalized)}
        `}
      />

      {normalized}
    </span>
  );
}

/*
 * =========================================================
 * CATEGORY GROUP
 *
 * API boleh mengirim:
 * row.group
 * row.section
 * row.type
 * row.categoryGroup
 *
 * Kalau API belum mengirim group, kita fallback:
 * kategori yang bernama OTHERS / OTHER dianggap OTHERS.
 * =========================================================
 */

function getCategoryGroup(
  row: any
): "FOOD COST" | "OTHERS" {
  const group = String(
    row?.group ??
      row?.section ??
      row?.type ??
      row?.categoryGroup ??
      ""
  )
    .trim()
    .toUpperCase();

  if (
    group === "OTHERS" ||
    group === "OTHER"
  ) {
    return "OTHERS";
  }

  const category = String(
    row?.category ?? ""
  )
    .trim()
    .toUpperCase();

  if (
    category === "OTHERS" ||
    category === "OTHER"
  ) {
    return "OTHERS";
  }

  /*
   * Jika API tidak mengirim group,
   * default tetap FOOD COST supaya data
   * existing tidak hilang.
   */
  return "FOOD COST";
}

/*
 * =========================================================
 * GROUP ROWS
 * =========================================================
 */

function groupRows(
  rows: any[]
) {
  const foodCost: any[] = [];
  const others: any[] = [];

  for (const row of rows || []) {
    if (
      getCategoryGroup(row) ===
      "OTHERS"
    ) {
      others.push(row);
    } else {
      foodCost.push(row);
    }
  }

  return {
    foodCost,
    others,
  };
}

/*
 * =========================================================
 * SUM ROWS
 * =========================================================
 */

function sumRows(
  rows: any[]
) {
  const opening = rows.reduce(
    (sum, row) =>
      sum + Number(row.opening || 0),
    0
  );

  const purchase = rows.reduce(
    (sum, row) =>
      sum + Number(row.purchase || 0),
    0
  );

  const ending = rows.reduce(
    (sum, row) =>
      sum + Number(row.ending || 0),
    0
  );

  const waste = rows.reduce(
    (sum, row) =>
      sum + Number(row.waste || 0),
    0
  );

  const cost = rows.reduce(
    (sum, row) =>
      sum + Number(row.cost || 0),
    0
  );

  const sales = rows.reduce(
    (sum, row) =>
      sum + Number(
        row.sales ||
          row.netSales ||
          0
      ),
    0
  );

  const ratioFoodCost =
    sales > 0
      ? (cost / sales) * 100
      : 0;

  const ratioToSales =
    ratioFoodCost;

  return {
    opening,
    purchase,
    ending,
    waste,
    cost,
    sales,
    ratioFoodCost,
    foodCost: ratioFoodCost,
    ratioToSales,
  };
}

/*
 * =========================================================
 * TOTAL STATUS
 * =========================================================
 */

function getTotalStatus(
  rows: any[],
  outlet: any
) {
  const totals =
    sumRows(rows);

  const benchmark =
    getBenchmark(
      rows?.[0],
      outlet
    );

  const status =
    getCostStatus(
      totals.ratioFoodCost,
      benchmark
    );

  return {
    ...totals,
    benchmark,
    status,
  };
}

/*
 * =========================================================
 * MONTH LABEL
 * =========================================================
 */

function monthLabel(
  month: string
) {
  if (!month) return "";

  const date = new Date(
    `${month}-01T00:00:00`
  );

  return date.toLocaleDateString(
    "id-ID",
    {
      month: "long",
      year: "numeric",
    }
  );
}

/*
 * =========================================================
 * DATE LABEL
 * =========================================================
 */

function dateLabel(
  date: string
) {
  if (!date) return "-";

  return new Date(
    date
  ).toLocaleDateString(
    "id-ID",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  );
}

/*
 * =========================================================
 * PAGE
 * =========================================================
 */

export default function CostControlPage() {
  const [outlets, setOutlets] =
    useState<any[]>([]);

  const [outletId, setOutletId] =
    useState("");

  const [month, setMonth] =
    useState(
      new Date()
        .toISOString()
        .slice(0, 7)
    );

  const [salesByOutlet, setSalesByOutlet] =
    useState<
      Record<string, string>
    >({});

  const [data, setData] =
    useState<any>(null);

  const [loading, setLoading] =
    useState(false);

  const [exporting, setExporting] =
    useState(false);

  /*
   * =======================================================
   * LOAD OUTLET + USER
   * =======================================================
   */

  useEffect(() => {
    async function init() {
      try {
        const outletResponse =
          await fetch(
            "/api/outlet",
            {
              cache: "no-store",
            }
          );

        const outletJson =
          await outletResponse.json();

        const outletData =
          outletJson.data || [];

        setOutlets(outletData);

        const meResponse =
          await fetch(
            "/api/me",
            {
              cache: "no-store",
            }
          );

        const meJson =
          await meResponse.json();

        if (
          meJson?.user?.outletId
        ) {
          setOutletId(
            String(
              meJson.user.outletId
            )
          );
        }
      } catch (error) {
        console.error(
          "INIT COST CONTROL ERROR:",
          error
        );
      }
    }

    init();
  }, []);

  /*
   * =======================================================
   * LOAD DATA
   * =======================================================
   */

  useEffect(() => {
    load();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletId, month]);

  /*
   * =======================================================
   * LOAD DATA
   * =======================================================
   */

  async function load(
    salesOverride?: Record<
      string,
      string
    >
  ) {
    setLoading(true);

    try {
      const q =
        new URLSearchParams();

      q.set(
        "month",
        month
      );

      if (outletId) {
        q.set(
          "outletId",
          outletId
        );
      }

      const currentSales =
        salesOverride ??
        salesByOutlet;

      q.set(
        "salesByOutlet",
        JSON.stringify(
          currentSales
        )
      );

      const response =
        await fetch(
          `/api/cost-control?${q.toString()}`,
          {
            cache: "no-store",
          }
        );

      const json =
        await response.json();

      if (json.success) {
        setData(
          json.data
        );
      } else {
        console.error(
          "COST CONTROL API:",
          json.message
        );

        setData(null);
      }
    } catch (error) {
      console.error(
        "LOAD COST CONTROL ERROR:",
        error
      );

      setData(null);
    } finally {
      setLoading(false);
    }
  }

  /*
   * =======================================================
   * SALES INPUT
   * =======================================================
   */

  function updateSales(
    id: number,
    value: string
  ) {
    setSalesByOutlet(
      (prev) => ({
        ...prev,
        [String(id)]: value,
      })
    );
  }

  /*
   * =======================================================
   * HITUNG FOOD COST
   * =======================================================
   */

  function calculateFoodCost() {
    load(
      salesByOutlet
    );
  }

  /*
   * =======================================================
   * EXPORT PDF
   * =======================================================
   */

  async function exportPDF() {
    if (!data) return;

    setExporting(true);

    try {
      const pdf =
        new jsPDF({
          orientation:
            "landscape",
          unit: "mm",
          format: "a4",
        });

      const pageWidth =
        pdf.internal.pageSize.getWidth();

      const pageHeight =
        pdf.internal.pageSize.getHeight();

      const selectedOutlet =
        outletId
          ? outlets.find(
              (x) =>
                String(x.id) ===
                String(outletId)
            )
          : null;

      const reportTitle =
        selectedOutlet?.name ||
        "SEMUA OUTLET";

      /*
       * HEADER
       */

      pdf.setFontSize(20);

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.text(
        "COST CONTROL REPORT",
        14,
        18
      );

      pdf.setFontSize(10);

      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.text(
        `${reportTitle} • ${monthLabel(
          data.month
        )}`,
        14,
        25
      );

      pdf.text(
        `Generated: ${new Date().toLocaleString(
          "id-ID"
        )}`,
        pageWidth - 14,
        25,
        {
          align: "right",
        }
      );

      /*
       * SUMMARY
       */

      const summary =
        data.monthly;

      const cards = [
        [
          "STOCK AWAL",
          money(
            summary.opening
          ),
        ],
        [
          "PEMBELIAN",
          money(
            summary.purchase
          ),
        ],
        [
          "STOCK AKHIR",
          money(
            summary.ending
          ),
        ],
        [
          "WASTE / SPOILAGE",
          money(
            summary.waste
          ),
        ],
        [
          "COST OF SALE",
          money(
            summary.cost
          ),
        ],
        [
          "NET SALES",
          money(
            summary.netSales
          ),
        ],
        [
          "FOOD COST",
          pct(
            summary.foodCost
          ),
        ],
      ];

      let cardX = 14;

      const cardY = 32;
      const cardWidth = 34;
      const cardHeight = 20;
      const cardGap = 3;

      cards.forEach(
        ([label, value]) => {
          if (
            cardX + cardWidth >
            pageWidth - 10
          ) {
            cardX = 14;
          }

          pdf.rect(
            cardX,
            cardY,
            cardWidth,
            cardHeight
          );

          pdf.setFontSize(7);

          pdf.setFont(
            "helvetica",
            "normal"
          );

          pdf.text(
            label,
            cardX + 3,
            cardY + 7
          );

          pdf.setFontSize(8);

          pdf.setFont(
            "helvetica",
            "bold"
          );

          pdf.text(
            value,
            cardX + 3,
            cardY + 15
          );

          cardX +=
            cardWidth +
            cardGap;
        }
      );

      let currentY = 62;

      /*
       * OUTLET DETAIL
       */

      for (
        let outletIndex = 0;
        outletIndex <
        data.outlets.length;
        outletIndex++
      ) {
        const outlet =
          data.outlets[
            outletIndex
          ];

        if (
          currentY >
          pageHeight - 45
        ) {
          pdf.addPage();
          currentY = 15;
        }

        const outletRows =
          outlet.weeks.flatMap(
            (week: any) =>
              week.rows || []
          );

        const outletBenchmark =
          getBenchmark(
            outletRows?.[0],
            outlet
          );

        const outletStatus =
          getCostStatus(
            outlet?.monthly
              ?.foodCost,
            outletBenchmark
          );

        pdf.setFontSize(14);

        pdf.setFont(
          "helvetica",
          "bold"
        );

        pdf.text(
          outlet.outlet.name,
          14,
          currentY
        );

        currentY += 6;

        pdf.setFontSize(8);

        pdf.setFont(
          "helvetica",
          "normal"
        );

        pdf.text(
          `Net Sales: ${money(
            outlet.monthly
              .netSales
          )} | Cost: ${money(
            outlet.monthly.cost
          )} | Food Cost: ${pct(
            outlet.monthly.foodCost
          )} | Benchmark: ${pct(
            outletBenchmark
          )} | Status: ${outletStatus} | SO Approved: ${
            outlet.opnameCount
          }`,
          14,
          currentY
        );

        currentY += 5;

        for (
          let weekIndex = 0;
          weekIndex <
          outlet.weeks.length;
          weekIndex++
        ) {
          const week =
            outlet.weeks[
              weekIndex
            ];

          if (
            currentY >
            pageHeight - 65
          ) {
            pdf.addPage();
            currentY = 15;
          }

          pdf.setFontSize(9);

          pdf.setFont(
            "helvetica",
            "bold"
          );

          pdf.text(
            `WEEK ${
              weekIndex + 1
            } • ${
              week.code
            } • ${dateLabel(
              week.date
            )}`,
            14,
            currentY
          );

          currentY += 3;

          const grouped =
            groupRows(
              week.rows || []
            );

          const groups = [
            {
              title: "FOOD COST",
              rows:
                grouped.foodCost,
            },
            {
              title: "OTHERS",
              rows:
                grouped.others,
            },
          ].filter(
            (group) =>
              group.rows.length >
              0
          );

          for (
            const group of groups
          ) {
            const total =
              getTotalStatus(
                group.rows,
                outlet
              );

            const rows =
              group.rows.map(
                (row: any) => {
                  const benchmark =
                    getBenchmark(
                      row,
                      outlet
                    );

                  const status =
                    getCostStatus(
                      row.ratioFoodCost,
                      benchmark
                    );

                  return [
                    row.category,
                    money(
                      row.opening
                    ),
                    money(
                      row.purchase
                    ),
                    money(
                      row.ending
                    ),
                    money(
                      row.waste
                    ),
                    money(
                      row.cost
                    ),
                    pct(
                      row.ratioFoodCost
                    ),
                    pct(
                      row.ratioToSales
                    ),
                    status,
                  ];
                }
              );

            rows.push([
              `TOTAL ${group.title}`,
              money(
                total.opening
              ),
              money(
                total.purchase
              ),
              money(
                total.ending
              ),
              money(
                total.waste
              ),
              money(
                total.cost
              ),
              pct(
                total.ratioFoodCost
              ),
              pct(
                total.ratioToSales
              ),
              total.status,
            ]);

            autoTable(pdf, {
              startY:
                currentY + 2,

              head: [
                [
                  group.title,
                  "STOCK AWAL",
                  "PEMBELIAN",
                  "STOCK AKHIR",
                  "WASTE",
                  "COST OF SALE",
                  "FOOD COST %",
                  "SALES %",
                  "STATUS",
                ],
              ],

              body: rows,

              theme: "grid",

              styles: {
                fontSize: 7,
                cellPadding: 2,
              },

              headStyles: {
                fontSize: 7,
              },

              columnStyles: {
                0: {
                  cellWidth: 30,
                },
                1: {
                  cellWidth: 27,
                },
                2: {
                  cellWidth: 27,
                },
                3: {
                  cellWidth: 27,
                },
                4: {
                  cellWidth: 24,
                },
                5: {
                  cellWidth: 29,
                },
                6: {
                  cellWidth: 23,
                },
                7: {
                  cellWidth: 22,
                },
                8: {
                  cellWidth: 23,
                },
              },
            });

            currentY =
              (
                pdf as any
              ).lastAutoTable
                .finalY + 8;
          }
        }

        if (
          outlet.weeks.length ===
          0
        ) {
          pdf.setFontSize(8);

          pdf.text(
            "Belum ada Stock Opname APPROVED pada bulan ini.",
            14,
            currentY
          );

          currentY += 10;
        }

        currentY += 3;
      }

      /*
       * FOOTER
       */

      const totalPages =
        pdf.getNumberOfPages();

      for (
        let page = 1;
        page <= totalPages;
        page++
      ) {
        pdf.setPage(page);

        pdf.setFontSize(7);

        pdf.setFont(
          "helvetica",
          "normal"
        );

        pdf.text(
          `Cost Control • ${monthLabel(
            data.month
          )}`,
          14,
          pageHeight - 7
        );

        pdf.text(
          `Page ${page} / ${totalPages}`,
          pageWidth - 14,
          pageHeight - 7,
          {
            align: "right",
          }
        );
      }

      const filename =
        `Cost-Control-${data.month}${
          selectedOutlet
            ? `-${selectedOutlet.name.replace(
                /\s+/g,
                "-"
              )}`
            : ""
        }.pdf`;

      pdf.save(
        filename
      );
    } catch (error) {
      console.error(
        "EXPORT PDF ERROR:",
        error
      );

      alert(
        "Gagal membuat PDF"
      );
    } finally {
      setExporting(false);
    }
  }

  /*
   * =======================================================
   * RENDER
   * =======================================================
   */

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">

      {/* HEADER */}

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div className="flex items-center gap-3">

          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">
            <TrendingUp
              size={22}
              className="text-emerald-600"
            />
          </div>

          <div>

            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
              Inventory & Cost Management
            </div>

            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
              Cost Control
            </h1>

            <p className="mt-0.5 text-sm text-slate-500">
              Weekly Stock Opname → Monthly Recap
            </p>

          </div>

        </div>

        <div className="flex flex-wrap gap-2">

          <button
            type="button"
            onClick={() =>
              window.print()
            }
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-xl
              border
              border-slate-200
              bg-white
              px-4
              py-2.5
              text-sm
              font-semibold
              text-slate-700
              shadow-sm
              transition
              hover:bg-slate-50
            "
          >
            <Printer size={16} />
            PRINT
          </button>

          <button
            type="button"
            onClick={
              exportPDF
            }
            disabled={
              exporting ||
              !data
            }
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-emerald-600
              px-5
              py-2.5
              text-sm
              font-bold
              text-white
              shadow-sm
              transition
              hover:bg-emerald-700
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            <FileDown size={16} />

            {exporting
              ? "MEMBUAT PDF..."
              : "EXPORT PDF"}
          </button>

        </div>

      </div>

      {/* FILTER */}

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

        <div className="mb-4">

          <h2 className="font-semibold text-slate-800">
            Filter Report
          </h2>

          <p className="mt-0.5 text-sm text-slate-500">
            Pilih outlet dan periode laporan
          </p>

        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">

          <div>

            <label className="mb-1.5 block text-sm font-medium text-slate-600">
              Outlet
            </label>

            <select
              value={
                outletId
              }
              onChange={(e) =>
                setOutletId(
                  e.target.value
                )
              }
              className="
                w-full
                rounded-xl
                border
                border-slate-300
                bg-white
                px-4
                py-3
                text-sm
                text-slate-700
                outline-none
                transition
                focus:border-emerald-400
                focus:ring-2
                focus:ring-emerald-100
              "
            >
              <option value="">
                SEMUA OUTLET
              </option>

              {outlets.map(
                (outlet) => (
                  <option
                    key={
                      outlet.id
                    }
                    value={
                      outlet.id
                    }
                  >
                    {
                      outlet.name
                    }
                  </option>
                )
              )}
            </select>

          </div>

          <div>

            <label className="mb-1.5 block text-sm font-medium text-slate-600">
              Bulan
            </label>

            <input
              type="month"
              value={
                month
              }
              onChange={(e) =>
                setMonth(
                  e.target.value
                )
              }
              className="
                w-full
                rounded-xl
                border
                border-slate-300
                bg-white
                px-4
                py-3
                text-sm
                text-slate-700
                outline-none
                transition
                focus:border-emerald-400
                focus:ring-2
                focus:ring-emerald-100
              "
            />

          </div>

          <div className="flex items-end">

            <button
              type="button"
              onClick={() =>
                load()
              }
              disabled={
                loading
              }
              className="
                inline-flex
                w-full
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-slate-800
                px-4
                py-3
                text-sm
                font-semibold
                text-white
                shadow-sm
                transition
                hover:bg-slate-900
                disabled:cursor-not-allowed
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

              {loading
                ? "MEMUAT..."
                : "REFRESH DATA"}
            </button>

          </div>

        </div>

      </section>

      {/* SALES */}

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <h2 className="font-semibold text-slate-800">
              Net Sales Per Outlet
            </h2>

            <p className="mt-0.5 text-sm text-slate-500">
              Masukkan Net Sales masing-masing outlet untuk menghitung Food Cost.
            </p>

          </div>

          <div className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
            SALES BASE
          </div>

        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">

          {outlets.map(
            (outlet) => {

              const visible =
                !outletId ||
                String(
                  outlet.id
                ) ===
                  String(
                    outletId
                  );

              if (!visible) {
                return null;
              }

              const outletResult =
                data?.outlets?.find(
                  (x: any) =>
                    Number(
                      x.outlet.id
                    ) ===
                    Number(
                      outlet.id
                    )
                );

              return (
                <div
                  key={
                    outlet.id
                  }
                  className="
                    rounded-xl
                    border
                    border-slate-200
                    bg-slate-50
                    p-4
                  "
                >

                  <div className="mb-3 flex items-center gap-2">

                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                      <Store
                        size={15}
                        className="text-emerald-600"
                      />
                    </div>

                    <div className="text-sm font-bold text-slate-700">
                      {
                        outlet.name
                      }
                    </div>

                  </div>

                  <div className="relative">

                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      Rp
                    </span>

                    <input
                      type="number"
                      min="0"
                      value={
                        salesByOutlet[
                          String(
                            outlet.id
                          )
                        ] || ""
                      }
                      onChange={(e) =>
                        updateSales(
                          outlet.id,
                          e.target.value
                        )
                      }
                      placeholder="Masukkan Net Sales"
                      className="
                        w-full
                        rounded-xl
                        border
                        border-slate-300
                        bg-white
                        py-3
                        pl-10
                        pr-3
                        text-sm
                        font-semibold
                        outline-none
                        transition
                        focus:border-emerald-400
                        focus:ring-2
                        focus:ring-emerald-100
                      "
                    />

                  </div>

                  {outletResult && (
                    <div className="mt-3 flex items-center justify-between">

                      <span className="text-xs font-semibold uppercase text-slate-400">
                        Food Cost
                      </span>

                      <span className="text-sm font-bold text-emerald-700">
                        {pct(
                          outletResult
                            ?.monthly
                            ?.foodCost
                        )}
                      </span>

                    </div>
                  )}

                </div>
              );
            }
          )}

        </div>

        <div className="mt-4 flex justify-end">

          <button
            type="button"
            onClick={
              calculateFoodCost
            }
            disabled={
              loading
            }
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-emerald-600
              px-5
              py-2.5
              text-sm
              font-bold
              text-white
              shadow-sm
              transition
              hover:bg-emerald-700
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            <TrendingUp size={16} />

            {loading
              ? "MENGHITUNG..."
              : "HITUNG FOOD COST"}
          </button>

        </div>

      </section>

      {/* LEGEND */}

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

        <div className="flex flex-wrap items-center gap-3">

          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Status Benchmark
          </span>

          <StatusBadge status="NORMAL" />

          <span className="text-xs text-slate-400">
            ≤ 90% benchmark
          </span>

          <StatusBadge status="WARNING" />

          <span className="text-xs text-slate-400">
            90% – 100% benchmark
          </span>

          <StatusBadge status="OVER" />

          <span className="text-xs text-slate-400">
            &gt; benchmark
          </span>

        </div>

      </section>

      {/* LOADING */}

      {loading && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-700">

          <RefreshCw
            size={18}
            className="animate-spin"
          />

          Memuat data Cost Control...

        </div>
      )}

      {/* DATA */}

      {data && (
        <>

          {/* TITLE */}

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <h2 className="text-xl font-bold text-slate-900">
                Recap Keseluruhan
              </h2>

              <p className="mt-0.5 text-sm text-slate-500">
                {
                  monthLabel(
                    data.month
                  )
                }
              </p>

            </div>

            <div className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
              {
                data.outlets
                  .length
              }{" "}
              OUTLET
            </div>

          </div>

          {/* SUMMARY */}

          <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">

            <SummaryCard
              title="Stock Awal"
              value={money(
                data.monthly
                  .opening
              )}
            />

            <SummaryCard
              title="Pembelian"
              value={money(
                data.monthly
                  .purchase
              )}
            />

            <SummaryCard
              title="Stock Akhir"
              value={money(
                data.monthly
                  .ending
              )}
            />

            <SummaryCard
              title="Waste / Spoilage"
              value={money(
                data.monthly
                  .waste
              )}
            />

            <SummaryCard
              title="Cost of Sale"
              value={money(
                data.monthly
                  .cost
              )}
            />

            <SummaryCard
              title="Net Sales"
              value={money(
                data.monthly
                  .netSales
              )}
            />

            <SummaryCard
              title="Food Cost"
              value={pct(
                data.monthly
                  .foodCost
              )}
              highlight
            />

          </section>

          {/* OUTLETS */}

          <div className="space-y-6">

            {data.outlets.map(
              (outlet: any) => {

                /*
                 * Ambil seluruh rows dari seluruh minggu
                 * hanya untuk membaca benchmark dan
                 * membuat status outlet.
                 */

                const allOutletRows =
                  outlet.weeks.flatMap(
                    (
                      week: any
                    ) =>
                      week.rows ||
                      []
                  );

                const outletBenchmark =
                  getBenchmark(
                    allOutletRows?.[0],
                    outlet
                  );

                const outletStatus =
                  getCostStatus(
                    outlet
                      ?.monthly
                      ?.foodCost,
                    outletBenchmark
                  );

                return (
                  <section
                    key={
                      outlet
                        .outlet
                        .id
                    }
                    className="
                      overflow-hidden
                      rounded-2xl
                      border
                      border-slate-200
                      bg-white
                      shadow-sm
                    "
                  >

                    {/* OUTLET HEADER */}

                    <div className="border-b border-slate-200 px-5 py-5">

                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                        <div className="flex items-center gap-3">

                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">
                            <Store
                              size={21}
                              className="text-emerald-600"
                            />
                          </div>

                          <div>

                            <h2 className="text-xl font-bold text-slate-900">
                              {
                                outlet
                                  .outlet
                                  .name
                              }
                            </h2>

                            <div className="mt-1 flex flex-wrap items-center gap-2">

                              <span className="text-xs text-slate-500">
                                Benchmark:
                              </span>

                              <span className="text-xs font-bold text-slate-700">
                                {pct(
                                  outletBenchmark
                                )}
                              </span>

                              <StatusBadge
                                status={
                                  outletStatus
                                }
                              />

                            </div>

                          </div>

                        </div>

                        <div className="flex flex-wrap gap-2">

                          <InfoBadge
                            label="NET SALES"
                            value={money(
                              outlet
                                .monthly
                                .netSales
                            )}
                          />

                          <InfoBadge
                            label="SO APPROVED"
                            value={
                              outlet
                                .opnameCount
                            }
                          />

                          <InfoBadge
                            label="COST"
                            value={money(
                              outlet
                                .monthly
                                .cost
                            )}
                          />

                          <InfoBadge
                            label="FOOD COST"
                            value={pct(
                              outlet
                                .monthly
                                .foodCost
                            )}
                          />

                          <StatusBadge
                            status={
                              outletStatus
                            }
                          />

                        </div>

                      </div>

                    </div>

                    {/* OUTLET SUMMARY */}

                    <div className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200 md:grid-cols-5">

                      <MiniCard
                        label="Stock Awal"
                        value={money(
                          outlet
                            .monthly
                            .opening
                        )}
                      />

                      <MiniCard
                        label="Pembelian"
                        value={money(
                          outlet
                            .monthly
                            .purchase
                        )}
                      />

                      <MiniCard
                        label="Stock Akhir"
                        value={money(
                          outlet
                            .monthly
                            .ending
                        )}
                      />

                      <MiniCard
                        label="Waste"
                        value={money(
                          outlet
                            .monthly
                            .waste
                        )}
                      />

                      <MiniCard
                        label="Cost"
                        value={money(
                          outlet
                            .monthly
                            .cost
                        )}
                      />

                    </div>

                    {/* WEEKLY */}

                    <div className="p-5">

                      {outlet.weeks.length ===
                      0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">

                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                            <AlertTriangle
                              size={22}
                              className="text-slate-400"
                            />
                          </div>

                          <div className="mt-3 text-sm font-bold text-slate-700">
                            Belum ada Stock Opname APPROVED
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            pada bulan{" "}
                            {
                              monthLabel(
                                data.month
                              )
                            }
                          </div>

                        </div>
                      ) : (

                        <div className="space-y-8">

                          {outlet.weeks.map(
                            (
                              week: any,
                              index: number
                            ) => {

                              const grouped =
                                groupRows(
                                  week.rows ||
                                    []
                                );

                              const foodTotal =
                                getTotalStatus(
                                  grouped.foodCost,
                                  outlet
                                );

                              const othersTotal =
                                getTotalStatus(
                                  grouped.others,
                                  outlet
                                );

                              const subtotalRows =
                                week.rows ||
                                [];

                              const subtotal =
                                getTotalStatus(
                                  subtotalRows,
                                  outlet
                                );

                              return (
                                <div
                                  key={
                                    week.id
                                  }
                                >

                                  {/* WEEK HEADER */}

                                  <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

                                    <div>

                                      <h3 className="font-bold text-slate-900">
                                        Week{" "}
                                        {
                                          index +
                                          1
                                        }{" "}
                                        <span className="font-normal text-slate-400">
                                          •
                                        </span>{" "}
                                        {
                                          week.code
                                        }
                                      </h3>

                                      <p className="mt-0.5 text-xs text-slate-500">
                                        {
                                          dateLabel(
                                            week.date
                                          )
                                        }
                                      </p>

                                    </div>

                                    <div className="flex flex-wrap gap-2">

                                      <InfoBadge
                                        label="COST"
                                        value={money(
                                          week
                                            .totals
                                            .cost
                                        )}
                                      />

                                      <InfoBadge
                                        label="FOOD COST"
                                        value={pct(
                                          week
                                            .totals
                                            .foodCost
                                        )}
                                      />

                                      <StatusBadge
                                        status={
                                          getCostStatus(
                                            week
                                              .totals
                                              .foodCost,
                                            getBenchmark(
                                              week
                                                .rows?.[0],
                                              outlet
                                            )
                                          )
                                        }
                                      />

                                    </div>

                                  </div>

                                  {/* =================================================
                                      FOOD COST
                                      ================================================= */}

                                  {grouped.foodCost
                                    .length >
                                    0 && (
                                    <CostGroupTable
                                      title="FOOD COST"
                                      rows={
                                        grouped.foodCost
                                      }
                                      outlet={
                                        outlet
                                      }
                                      total={
                                        foodTotal
                                      }
                                    />
                                  )}

                                  {/* =================================================
                                      OTHERS
                                      ================================================= */}

                                  {grouped.others
                                    .length >
                                    0 && (
                                    <div className="mt-5">

                                      <CostGroupTable
                                        title="OTHERS"
                                        rows={
                                          grouped.others
                                        }
                                        outlet={
                                          outlet
                                        }
                                        total={
                                          othersTotal
                                        }
                                      />

                                    </div>
                                  )}

                                  {/* =================================================
                                      SUB TOTAL
                                      ================================================= */}

                                  <div className="mt-5 overflow-x-auto rounded-xl border-2 border-slate-300">

                                    <table className="w-full min-w-[1100px] text-xs">

                                      <thead>

                                        <tr className="border-b border-slate-300 bg-slate-100 text-left text-[10px] font-bold uppercase tracking-wide text-slate-700">

                                          <th className="px-3 py-3">
                                            SUB TOTAL
                                          </th>

                                          <th className="px-3 py-3 text-right">
                                            Stock Awal
                                          </th>

                                          <th className="px-3 py-3 text-right">
                                            Pembelian
                                          </th>

                                          <th className="px-3 py-3 text-right">
                                            Stock Akhir
                                          </th>

                                          <th className="px-3 py-3 text-right">
                                            Waste
                                          </th>

                                          <th className="px-3 py-3 text-right">
                                            Cost of Sale
                                          </th>

                                          <th className="px-3 py-3 text-right">
                                            Food Cost %
                                          </th>

                                          <th className="px-3 py-3 text-right">
                                            Sales %
                                          </th>

                                          <th className="px-3 py-3 text-center">
                                            Status
                                          </th>

                                        </tr>

                                      </thead>

                                      <tbody>

                                        <tr className="bg-slate-50 font-bold">

                                          <td className="px-3 py-3 text-slate-800">
                                            SUB TOTAL
                                          </td>

                                          <td className="px-3 py-3 text-right text-slate-700">
                                            {money(
                                              subtotal.opening
                                            )}
                                          </td>

                                          <td className="px-3 py-3 text-right text-slate-700">
                                            {money(
                                              subtotal.purchase
                                            )}
                                          </td>

                                          <td className="px-3 py-3 text-right text-slate-700">
                                            {money(
                                              subtotal.ending
                                            )}
                                          </td>

                                          <td className="px-3 py-3 text-right text-slate-700">
                                            {money(
                                              subtotal.waste
                                            )}
                                          </td>

                                          <td className="px-3 py-3 text-right text-slate-900">
                                            {money(
                                              subtotal.cost
                                            )}
                                          </td>

                                          <td className="px-3 py-3 text-right text-slate-800">
                                            {pct(
                                              subtotal.ratioFoodCost
                                            )}
                                          </td>

                                          <td className="px-3 py-3 text-right text-slate-800">
                                            {pct(
                                              subtotal.ratioToSales
                                            )}
                                          </td>

                                          <td className="px-3 py-3 text-center">

                                            <StatusBadge
                                              status={
                                                subtotal.status
                                              }
                                            />

                                          </td>

                                        </tr>

                                      </tbody>

                                    </table>

                                  </div>

                                </div>
                              );
                            }
                          )}

                        </div>

                      )}

                    </div>

                  </section>
                );
              }
            )}

          </div>

        </>
      )}

      {/* EMPTY */}

      {!data &&
        !loading && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
              <Boxes
                size={27}
                className="text-slate-400"
              />
            </div>

            <div className="mt-4 font-semibold text-slate-700">
              Belum ada data Cost Control
            </div>

            <div className="mt-1 text-sm text-slate-500">
              Pilih outlet dan periode kemudian refresh data.
            </div>

          </div>
        )}

    </main>
  );
}

/*
 * =========================================================
 * COST GROUP TABLE
 * =========================================================
 */

function CostGroupTable({
  title,
  rows,
  outlet,
  total,
}: {
  title: string;
  rows: any[];
  outlet: any;
  total: any;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">

      {/* GROUP HEADER */}

      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">

        <div className="flex items-center gap-2">

          <div className="h-2 w-2 rounded-full bg-emerald-500" />

          <span className="text-xs font-extrabold uppercase tracking-wide text-slate-800">
            {title}
          </span>

        </div>

        <div className="flex items-center gap-2">

          <span className="text-[10px] font-semibold text-slate-400">
            TOTAL RATIO
          </span>

          <span className="text-xs font-bold text-slate-700">
            {pct(
              total.ratioFoodCost
            )}
          </span>

          <StatusBadge
            status={
              total.status
            }
          />

        </div>

      </div>

      <table className="w-full min-w-[1100px] text-xs">

        <thead>

          <tr className="border-b border-slate-200 bg-white text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">

            <th className="px-3 py-3">
              Category
            </th>

            <th className="px-3 py-3 text-right">
              Stock Awal
            </th>

            <th className="px-3 py-3 text-right">
              Pembelian
            </th>

            <th className="px-3 py-3 text-right">
              Stock Akhir
            </th>

            <th className="px-3 py-3 text-right">
              Waste
            </th>

            <th className="px-3 py-3 text-right">
              Cost of Sale
            </th>

            <th className="px-3 py-3 text-right">
              Food Cost %
            </th>

            <th className="px-3 py-3 text-right">
              Sales %
            </th>

            <th className="px-3 py-3 text-center">
              Status
            </th>

          </tr>

        </thead>

        <tbody>

          {rows.map(
            (
              row: any,
              index: number
            ) => {

              const benchmark =
                getBenchmark(
                  row,
                  outlet
                );

              const status =
                getCostStatus(
                  row.ratioFoodCost,
                  benchmark
                );

              return (
                <tr
                  key={`${row.category}-${index}`}
                  className="
                    border-b
                    border-slate-100
                    transition
                    hover:bg-slate-50
                  "
                >

                  <td className="px-3 py-3 font-semibold text-slate-700">
                    {
                      row.category
                    }
                  </td>

                  <td className="px-3 py-3 text-right text-slate-600">
                    {money(
                      row.opening
                    )}
                  </td>

                  <td className="px-3 py-3 text-right text-slate-600">
                    {money(
                      row.purchase
                    )}
                  </td>

                  <td className="px-3 py-3 text-right text-slate-600">
                    {money(
                      row.ending
                    )}
                  </td>

                  <td className="px-3 py-3 text-right text-slate-600">
                    {money(
                      row.waste
                    )}
                  </td>

                  <td className="px-3 py-3 text-right font-bold text-slate-800">
                    {money(
                      row.cost
                    )}
                  </td>

                  <td className="px-3 py-3 text-right font-semibold text-slate-700">
                    {pct(
                      row.ratioFoodCost
                    )}
                  </td>

                  <td className="px-3 py-3 text-right font-semibold text-slate-700">
                    {pct(
                      row.ratioToSales
                    )}
                  </td>

                  <td className="px-3 py-3 text-center">

                    <StatusBadge
                      status={
                        status
                      }
                    />

                  </td>

                </tr>
              );
            }
          )}

        </tbody>

        <tfoot>

          <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">

            <td className="px-3 py-3 text-slate-800">
              TOTAL {title}
            </td>

            <td className="px-3 py-3 text-right">
              {money(
                total.opening
              )}
            </td>

            <td className="px-3 py-3 text-right">
              {money(
                total.purchase
              )}
            </td>

            <td className="px-3 py-3 text-right">
              {money(
                total.ending
              )}
            </td>

            <td className="px-3 py-3 text-right">
              {money(
                total.waste
              )}
            </td>

            <td className="px-3 py-3 text-right">
              {money(
                total.cost
              )}
            </td>

            <td className="px-3 py-3 text-right">
              {pct(
                total.ratioFoodCost
              )}
            </td>

            <td className="px-3 py-3 text-right">
              {pct(
                total.ratioToSales
              )}
            </td>

            <td className="px-3 py-3 text-center">

              <StatusBadge
                status={
                  total.status
                }
              />

            </td>

          </tr>

        </tfoot>

      </table>

    </div>
  );
}

/*
 * =========================================================
 * SUMMARY CARD
 * =========================================================
 */

function SummaryCard({
  title,
  value,
  highlight = false,
}: {
  title: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`
        rounded-2xl
        border
        p-5
        shadow-sm
        ${
          highlight
            ? "border-emerald-200 bg-emerald-50"
            : "border-slate-200 bg-white"
        }
      `}
    >

      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {title}
      </div>

      <div
        className={`
          mt-2
          text-lg
          font-bold
          ${
            highlight
              ? "text-emerald-700"
              : "text-slate-900"
          }
        `}
      >
        {value}
      </div>

    </div>
  );
}

/*
 * =========================================================
 * MINI CARD
 * =========================================================
 */

function MiniCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white p-4">

      <div className="text-[10px] font-bold uppercase text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-sm font-bold text-slate-800">
        {value}
      </div>

    </div>
  );
}

/*
 * =========================================================
 * INFO BADGE
 * =========================================================
 */

function InfoBadge({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">

      <div className="text-[9px] font-bold uppercase text-slate-400">
        {label}
      </div>

      <div className="text-xs font-bold text-slate-700">
        {value}
      </div>

    </div>
  );
}