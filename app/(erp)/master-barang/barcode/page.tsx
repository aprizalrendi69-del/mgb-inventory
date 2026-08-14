"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import jsPDF from "jspdf";

import {
  ArrowLeft,
  Barcode,
  FileDown,
  Loader2,
  Printer,
  QrCode,
} from "lucide-react";

interface BatchStock {
  id: number;
  batchNumber: string;
  expiredDate: string;
  qty: number;
}

interface Supplier {
  id: number;
  code: string;
  name: string;
}

interface Barang {
  id: number;
  code: string;
  barcode?: string | null;
  name: string;
  unit?: string | null;
  category?: string | null;
  brand?: string | null;
  hasExpired?: boolean;
  supplier?: Supplier | null;
  batchStocks?: BatchStock[];
}

interface LabelItem {
  key: string;
  barang: Barang;
  batch?: BatchStock;
}

export default function BarcodePage() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids");

  const [barang, setBarang] = useState<Barang[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // =====================================================
  // LOAD DATA
  // =====================================================

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        if (!idsParam) {
          setBarang([]);
          return;
        }

        const ids = idsParam
          .split(",")
          .map((id) => Number(id))
          .filter((id) => !Number.isNaN(id));

        if (!ids.length) {
          setBarang([]);
          return;
        }

        /*
         * PENTING:
         *
         * Jangan gunakan /api/barcode lagi.
         *
         * Supplier terakhir dan batch sudah disediakan
         * oleh /api/master/barang.
         */
        const res = await fetch(
          "/api/master/barang?search=",
          {
            cache: "no-store",
          }
        );

        if (!res.ok) {
          throw new Error(
            "Gagal mengambil data barang"
          );
        }

        const json = await res.json();

        if (!json.success) {
          throw new Error(
            json.message ||
              "Gagal mengambil data barang"
          );
        }

        const allBarang: Barang[] =
          json.data ?? [];

        /*
         * Ambil hanya barang yang dipilih.
         */
        const selectedBarang = allBarang
          .filter((item) =>
            ids.includes(Number(item.id))
          )
          .map((item) => ({
            ...item,

            /*
             * Pastikan batch hanya yang masih
             * mempunyai stok.
             */
            batchStocks:
              item.batchStocks
                ?.filter(
                  (batch) =>
                    Number(batch.qty) > 0
                )
                .sort(
                  (a, b) =>
                    new Date(
                      a.expiredDate
                    ).getTime() -
                    new Date(
                      b.expiredDate
                    ).getTime()
                ) ?? [],

            /*
             * Supplier sudah berasal dari API:
             *
             * supplier: {
             *   id,
             *   code,
             *   name
             * }
             */
            supplier: item.supplier
              ? {
                  id: item.supplier.id,
                  code: item.supplier.code,
                  name: item.supplier.name,
                }
              : null,
          }));

        console.log(
          "BARANG BARCODE:",
          selectedBarang
        );

        setBarang(selectedBarang);
      } catch (error) {
        console.error(
          "GAGAL LOAD BARCODE:",
          error
        );

        setBarang([]);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [idsParam]);

  // =====================================================
  // 1 BATCH = 1 LABEL
  // =====================================================

  const labels = useMemo<LabelItem[]>(() => {
    const result: LabelItem[] = [];

    for (const item of barang) {
      /*
       * Barang expired:
       * setiap batch aktif dibuat satu label.
       */
      if (
        item.hasExpired &&
        item.batchStocks &&
        item.batchStocks.length > 0
      ) {
        for (const batch of item.batchStocks) {
          result.push({
            key: `${item.id}-${batch.id}`,
            barang: item,
            batch,
          });
        }
      } else {
        /*
         * Barang tanpa expired:
         * satu barang = satu label.
         */
        result.push({
          key: `${item.id}-no-batch`,
          barang: item,
        });
      }
    }

    return result;
  }, [barang]);

  // =====================================================
  // QR DATA
  // =====================================================

  function getQrValue(label: LabelItem) {
    const item = label.barang;
    const batch = label.batch;

    return [
      "MGB",
      item.id,
      item.code,
      batch?.batchNumber || "-",
      batch?.expiredDate || "-",
    ].join("|");
  }

  // =====================================================
  // GENERATE QR
  // =====================================================

  useEffect(() => {
    if (!labels.length) return;

    const timer = window.setTimeout(() => {
      labels.forEach(async (label) => {
        const canvas =
          document.getElementById(
            `qr-${label.key}`
          ) as HTMLCanvasElement | null;

        if (!canvas) return;

        try {
          await QRCode.toCanvas(
            canvas,
            getQrValue(label),
            {
              width: 300,
              margin: 0,
              errorCorrectionLevel: "M",
              color: {
                dark: "#000000",
                light: "#ffffff",
              },
            }
          );
        } catch (error) {
          console.error(
            "GAGAL GENERATE QR:",
            error
          );
        }
      });
    }, 100);

    return () =>
      window.clearTimeout(timer);
  }, [labels]);

  // =====================================================
  // FORMAT TANGGAL
  // =====================================================

  function formatShortDate(
    date?: string | null
  ) {
    if (!date) return "-";

    const parsed = new Date(date);

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return "-";
    }

    return parsed.toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }

  // =====================================================
  // SUPPLIER
  // =====================================================

  function getSupplierName(
    item: Barang
  ) {
    return (
      item.supplier?.name ||
      "-"
    );
  }

  // =====================================================
  // PRINT
  // =====================================================

  function handlePrint() {
    window.print();
  }

  // =====================================================
  // EXPORT PDF
  // =====================================================

  async function handleExportPDF() {
    if (
      !labels.length ||
      exporting
    ) {
      return;
    }

    try {
      setExporting(true);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = 210;
      const pageHeight = 297;

      const labelWidth = 60;
      const labelHeight = 34;

      const gapX = 4;
      const gapY = 4;

      const columns = 3;
      const rows = 8;

      const totalWidth =
        labelWidth * columns +
        gapX * (columns - 1);

      const totalHeight =
        labelHeight * rows +
        gapY * (rows - 1);

      const marginX =
        (pageWidth - totalWidth) / 2;

      const marginY =
        (pageHeight - totalHeight) / 2;

      const labelsPerPage =
        columns * rows;

      for (
        let index = 0;
        index < labels.length;
        index++
      ) {
        const label =
          labels[index];

        const position =
          index % labelsPerPage;

        if (
          position === 0 &&
          index > 0
        ) {
          pdf.addPage();
        }

        const col =
          position % columns;

        const row =
          Math.floor(
            position / columns
          );

        const x =
          marginX +
          col *
            (labelWidth + gapX);

        const y =
          marginY +
          row *
            (labelHeight + gapY);

        // =================================================
        // BORDER
        // =================================================

        pdf.setDrawColor(
          180,
          180,
          180
        );

        pdf.setLineWidth(
          0.2
        );

        pdf.roundedRect(
          x,
          y,
          labelWidth,
          labelHeight,
          1.2,
          1.2,
          "S"
        );

        // =================================================
        // HEADER
        // =================================================

        pdf.setFont(
          "helvetica",
          "bold"
        );

        pdf.setFontSize(
          4.2
        );

        pdf.setTextColor(
          60,
          60,
          60
        );

        pdf.text(
          "PT Mitra Garam Bogatama",
          x + 2.5,
          y + 3.5
        );

        // =================================================
        // NAMA BARANG
        // =================================================

        pdf.setFont(
          "helvetica",
          "bold"
        );

        pdf.setFontSize(
          6.2
        );

        pdf.setTextColor(
          20,
          20,
          20
        );

        const nameLines =
          pdf.splitTextToSize(
            label.barang.name,
            labelWidth - 5
          );

        pdf.text(
          nameLines.slice(0, 2),
          x + 2.5,
          y + 7.5
        );

        // =================================================
        // SUBTITLE
        // =================================================

        const subtitle =
          label.barang.brand ||
          label.barang.category ||
          "";

        if (subtitle) {
          pdf.setFont(
            "helvetica",
            "normal"
          );

          pdf.setFontSize(
            3.8
          );

          pdf.setTextColor(
            90,
            90,
            90
          );

          pdf.text(
            subtitle,
            x + 2.5,
            y + 12
          );
        }

        // =================================================
        // QR
        // =================================================

        const qrSize = 15;

        const qrX =
          x + 2.5;

        const qrY =
          y + 13.5;

        const canvas =
          document.getElementById(
            `qr-${label.key}`
          ) as HTMLCanvasElement | null;

        if (canvas) {
          pdf.addImage(
            canvas.toDataURL(
              "image/png"
            ),
            "PNG",
            qrX,
            qrY,
            qrSize,
            qrSize
          );
        }

        // =================================================
        // KODE BARCODE
        // =================================================

        pdf.setFont(
          "helvetica",
          "normal"
        );

        pdf.setFontSize(
          3.2
        );

        pdf.setTextColor(
          80,
          80,
          80
        );

        pdf.text(
          label.barang.barcode ||
            label.barang.code,
          qrX +
            qrSize / 2,
          qrY +
            qrSize +
            1.8,
          {
            align: "center",
          }
        );

        // =================================================
        // DETAIL
        // =================================================

        const infoX =
          x + 20;

        const valueX =
          infoX + 9;

        let infoY =
          y + 16;

        pdf.setFontSize(
          4
        );

        // UNIT

        pdf.setFont(
          "helvetica",
          "normal"
        );

        pdf.setTextColor(
          90,
          90,
          90
        );

        pdf.text(
          "Unit",
          infoX,
          infoY
        );

        pdf.setFont(
          "helvetica",
          "bold"
        );

        pdf.setTextColor(
          30,
          30,
          30
        );

        pdf.text(
          label.barang.unit ||
            "-",
          valueX,
          infoY
        );

        // CODE

        infoY += 3;

        pdf.setFont(
          "helvetica",
          "normal"
        );

        pdf.setTextColor(
          90,
          90,
          90
        );

        pdf.text(
          "Code",
          infoX,
          infoY
        );

        pdf.setFont(
          "helvetica",
          "bold"
        );

        pdf.setTextColor(
          30,
          30,
          30
        );

        pdf.text(
          label.barang.code,
          valueX,
          infoY
        );

        // =================================================
        // BATCH + EXP
        // =================================================

        if (
          label.barang.hasExpired
        ) {
          infoY += 3;

          pdf.setDrawColor(
            200,
            200,
            200
          );

          pdf.setLineWidth(
            0.1
          );

          pdf.line(
            infoX,
            infoY - 1.2,
            x +
              labelWidth -
              2.5,
            infoY - 1.2
          );

          infoY += 1.8;

          // BATCH

          pdf.setFont(
            "helvetica",
            "normal"
          );

          pdf.setTextColor(
            90,
            90,
            90
          );

          pdf.text(
            "Batch",
            infoX,
            infoY
          );

          pdf.setFont(
            "helvetica",
            "bold"
          );

          pdf.setTextColor(
            30,
            30,
            30
          );

          pdf.text(
            label.batch
              ?.batchNumber ||
              "-",
            valueX,
            infoY
          );

          // EXP

          infoY += 3;

          pdf.setFont(
            "helvetica",
            "normal"
          );

          pdf.setTextColor(
            90,
            90,
            90
          );

          pdf.text(
            "Exp",
            infoX,
            infoY
          );

          pdf.setFont(
            "helvetica",
            "bold"
          );

          pdf.setTextColor(
            30,
            30,
            30
          );

          pdf.text(
            formatShortDate(
              label.batch
                ?.expiredDate
            ),
            valueX,
            infoY
          );
        }

        // =================================================
        // SUPPLIER
        // =================================================

        infoY += 3;

        pdf.setFont(
          "helvetica",
          "normal"
        );

        pdf.setTextColor(
          90,
          90,
          90
        );

        pdf.text(
          "Sup",
          infoX,
          infoY
        );

        pdf.setFont(
          "helvetica",
          "bold"
        );

        pdf.setTextColor(
          30,
          30,
          30
        );

        /*
         * Supplier asli dari database.
         */
        const supplierName =
          getSupplierName(
            label.barang
          );

        const supplierText =
          pdf.splitTextToSize(
            supplierName,
            labelWidth -
              valueX +
              x -
              2.5
          );

        pdf.text(
          supplierText.slice(0, 2),
          valueX,
          infoY
        );

        // =================================================
        // USER
        // =================================================

        infoY += 3;

        pdf.setFont(
          "helvetica",
          "normal"
        );

        pdf.setTextColor(
          90,
          90,
          90
        );

        pdf.text(
          "Usr",
          infoX,
          infoY
        );

        pdf.setFont(
          "helvetica",
          "bold"
        );

        pdf.setTextColor(
          30,
          30,
          30
        );

        pdf.text(
          "Gudang",
          valueX,
          infoY
        );

        // =================================================
        // FOOTER
        // =================================================

        pdf.setDrawColor(
          210,
          210,
          210
        );

        pdf.setLineWidth(
          0.1
        );

        pdf.line(
          x + 2.5,
          y +
            labelHeight -
            3.5,
          x +
            labelWidth -
            2.5,
          y +
            labelHeight -
            3.5
        );

        pdf.setFont(
          "helvetica",
          "normal"
        );

        pdf.setFontSize(
          3.2
        );

        pdf.setTextColor(
          120,
          120,
          120
        );

        pdf.text(
          `Rec : ${formatShortDate(
            new Date().toISOString()
          )}`,
          x + 2.5,
          y +
            labelHeight -
            1.3
        );
      }

      const date =
        new Date()
          .toISOString()
          .slice(0, 10);

      pdf.save(
        `label-barcode-mgb-${date}.pdf`
      );
    } catch (error) {
      console.error(
        "EXPORT PDF ERROR:",
        error
      );

      alert(
        "Gagal membuat PDF label"
      );
    } finally {
      setExporting(false);
    }
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">
          <Loader2
            size={30}
            className="animate-spin text-[#497F70]"
          />

          <p className="mt-4 text-sm text-gray-500">
            Memuat label...
          </p>
        </div>
      </div>
    );
  }

  // =====================================================
  // EMPTY
  // =====================================================

  if (!labels.length) {
    return (
      <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#DDE9E4] bg-white p-8 text-center shadow-sm">

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
            <QrCode size={28} />
          </div>

          <h2 className="mt-4 text-lg font-bold text-[#18352D]">
            Data barcode tidak ditemukan
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Tidak ada barang yang
            dipilih untuk dicetak.
          </p>

          <button
            type="button"
            onClick={() =>
              window.history.back()
            }
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-4 py-2.5 text-sm font-semibold text-white"
          >
            <ArrowLeft size={16} />
            Kembali
          </button>

        </div>
      </div>
    );
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="no-print mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div className="flex items-center gap-3">

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70] shadow-sm">
            <Barcode size={23} />
          </div>

          <div>

            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Label Barcode Barang
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Label QR dengan informasi
              barang, supplier dan batch
            </p>

          </div>

        </div>

        <div className="flex flex-wrap gap-2">

          <div className="hidden items-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-2.5 text-sm text-gray-500 shadow-sm sm:flex">

            <QrCode
              size={17}
              className="text-[#497F70]"
            />

            {labels.length} label

          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-2.5 text-sm font-semibold text-[#497F70] shadow-sm hover:bg-[#F5F8F6]"
          >
            <Printer size={17} />
            Cetak
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#3E6E61] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? (
              <Loader2
                size={17}
                className="animate-spin"
              />
            ) : (
              <FileDown size={17} />
            )}

            {exporting
              ? "Membuat PDF..."
              : "Export PDF"}
          </button>

          <button
            type="button"
            onClick={() =>
              window.history.back()
            }
            className="inline-flex items-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-[#F5F8F6]"
          >
            <ArrowLeft size={17} />
            Kembali
          </button>

        </div>
      </div>

      {/* =================================================
          INFO
      ================================================= */}

      <div className="no-print mb-6 rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

        <div className="flex items-start gap-3">

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
            <QrCode size={19} />
          </div>

          <div>

            <h2 className="font-semibold text-[#18352D]">
              Preview Label
            </h2>

            <p className="mt-1 text-xs leading-5 text-gray-500">
              Setiap batch aktif dibuatkan
              satu label. QR berukuran
              <strong> 15 × 15 mm</strong>.
              Supplier pada label diambil
              dari supplier pembelian terakhir
              barang tersebut.
            </p>

          </div>

        </div>

      </div>

      {/* =================================================
          LABEL PREVIEW
      ================================================= */}

      <div className="label-container grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">

        {labels.map((label) => {
          const item = label.barang;
          const batch = label.batch;

          return (
            <div
              key={label.key}
              className="label-card relative overflow-hidden rounded-md border border-[#D4D4D4] bg-[#FFFDF8] shadow-sm"
            >

              {/* HEADER */}

              <div className="px-2 pt-2">

                <div className="text-[6px] font-semibold tracking-wide text-gray-700">
                  PT Mitra Garam Bogatama
                </div>

                <div className="mt-0.5 line-clamp-2 text-[11px] font-bold leading-tight text-gray-900">
                  {item.name}
                </div>

                {(item.brand ||
                  item.category) && (
                  <div className="mt-0.5 truncate text-[6px] text-gray-700">
                    {item.brand ||
                      item.category}
                  </div>
                )}

              </div>

              {/* CONTENT */}

              <div className="grid grid-cols-[57px_minmax(0,1fr)] gap-1.5 px-2 pb-1.5 pt-1">

                {/* QR */}

                <div className="flex min-w-0 flex-col items-center justify-start">

                  <div className="qr-wrapper">
                    <canvas
                      id={`qr-${label.key}`}
                      className="qr-code"
                    />
                  </div>

                  <div className="mt-0.5 w-[57px] break-all text-center text-[5px] font-semibold leading-tight text-gray-700">
                    {item.barcode ||
                      item.code}
                  </div>

                </div>

                {/* DETAIL */}

                <div className="info-section min-w-0 pt-0">

                  <div className="info-row grid grid-cols-[22px_minmax(0,1fr)] text-[6px] leading-[1.35]">

                    <span className="text-gray-500">
                      Unit
                    </span>

                    <strong className="break-all text-gray-800">
                      {item.unit ||
                        "-"}
                    </strong>

                  </div>

                  <div className="info-row grid grid-cols-[22px_minmax(0,1fr)] text-[6px] leading-[1.35]">

                    <span className="text-gray-500">
                      Code
                    </span>

                    <strong className="break-all text-gray-800">
                      {item.code}
                    </strong>

                  </div>

                  {item.hasExpired && (
                    <>
                      <div className="my-0.5 border-t border-gray-300" />

                      <div className="info-row grid grid-cols-[22px_minmax(0,1fr)] text-[6px] leading-[1.35]">

                        <span className="text-gray-500">
                          Batch
                        </span>

                        <strong className="break-all text-gray-800">
                          {batch?.batchNumber ||
                            "-"}
                        </strong>

                      </div>

                      <div className="info-row grid grid-cols-[22px_minmax(0,1fr)] text-[6px] leading-[1.35]">

                        <span className="text-gray-500">
                          Exp
                        </span>

                        <strong className="text-gray-800">
                          {formatShortDate(
                            batch?.expiredDate
                          )}
                        </strong>

                      </div>
                    </>
                  )}

                  {/* =================================================
                      SUPPLIER ASLI
                      ================================================= */}

                  <div className="info-row grid grid-cols-[22px_minmax(0,1fr)] text-[6px] leading-[1.35]">

                    <span className="text-gray-500">
                      Sup
                    </span>

                    <strong
                      className="break-all text-gray-800"
                      title={
                        item.supplier?.name ||
                        "-"
                      }
                    >
                      {item.supplier?.name ||
                        "-"}
                    </strong>

                  </div>

                  <div className="info-row grid grid-cols-[22px_minmax(0,1fr)] text-[6px] leading-[1.35]">

                    <span className="text-gray-500">
                      Usr
                    </span>

                    <strong className="text-gray-800">
                      Gudang
                    </strong>

                  </div>

                </div>

              </div>

              {/* FOOTER */}

              <div className="border-t border-gray-300 px-2 py-0.5 text-[5px] text-gray-500">
                Rec :{" "}
                {formatShortDate(
                  new Date().toISOString()
                )}
              </div>

            </div>
          );
        })}

      </div>

      {/* =====================================================
          PRINT STYLE
      ===================================================== */}

      <style jsx global>{`
        .qr-wrapper {
          width: 57px;
          height: 57px;
          flex-shrink: 0;
        }

        .qr-code {
          display: block;
          width: 57px;
          height: 57px;
        }

        @media print {
          @page {
            size: A4;
            margin: 8mm;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          .no-print {
            display: none !important;
          }

          .label-container {
            display: grid !important;

            grid-template-columns:
              repeat(3, 60mm) !important;

            gap: 4mm !important;

            padding: 0 !important;
            margin: 0 !important;

            width: 188mm !important;
          }

          .label-card {
            width: 60mm !important;
            height: 34mm !important;
            min-height: 34mm !important;
            max-height: 34mm !important;

            border:
              0.25mm solid
              #999 !important;

            border-radius:
              1.2mm !important;

            box-shadow: none !important;

            background:
              #fffdf8 !important;

            overflow: hidden !important;

            page-break-inside:
              avoid !important;

            break-inside:
              avoid !important;
          }

          .qr-wrapper {
            width: 15mm !important;
            height: 15mm !important;
          }

          .qr-code {
            width: 15mm !important;
            height: 15mm !important;
          }

          .qr-wrapper + div {
            width: 15mm !important;
            max-width: 15mm !important;

            margin-top: 0.4mm !important;

            font-size: 3.5pt !important;

            line-height: 1.05 !important;
          }

          .label-card > div:first-child {
            padding-left: 2.5mm !important;
            padding-right: 2.5mm !important;
            padding-top: 2mm !important;
          }

          .label-card > div:first-child > div:first-child {
            font-size: 4.2pt !important;
          }

          .label-card > div:first-child > div:nth-child(2) {
            font-size: 6pt !important;
            line-height: 1.1 !important;

            margin-top: 0.5mm !important;
          }

          .label-card > div:first-child > div:nth-child(3) {
            font-size: 3.8pt !important;
            line-height: 1 !important;
          }

          .label-card > div:nth-child(2) {
            grid-template-columns:
              15mm
              minmax(0, 1fr) !important;

            gap: 1.5mm !important;

            padding-left: 2.5mm !important;
            padding-right: 2.5mm !important;
            padding-bottom: 1.5mm !important;
            padding-top: 1mm !important;
          }

          .info-section {
            padding-top: 0 !important;
          }

          .info-row {
            grid-template-columns:
              5.5mm
              minmax(0, 1fr) !important;

            font-size: 4.2pt !important;

            line-height: 1.35 !important;
          }

          .label-card > div:last-child {
            padding-left: 2.5mm !important;
            padding-right: 2.5mm !important;

            padding-top: 0.6mm !important;
            padding-bottom: 0.6mm !important;

            font-size: 3.5pt !important;

            line-height: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}