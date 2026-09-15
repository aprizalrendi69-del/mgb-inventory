"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import qz from "qz-tray";

import {
  ArrowLeft,
  Barcode,
  FileDown,
  Loader2,
  Printer,
  QrCode,
  Wifi,
  WifiOff,
} from "lucide-react";

/* =========================================================
   TYPES
========================================================= */

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

/* =========================================================
   PRINTER
========================================================= */

const PRINTER_KEYWORD = "xp-d4601b";

/* =========================================================
   LABEL CONSTANTS
========================================================= */

const LABEL_WIDTH_MM = 40;
const LABEL_HEIGHT_MM = 30;

const DPI = 203;

/*
 * QR TETAP 12 X 12 MM
 */
const QR_SIZE_MM = 12;

/* =========================================================
   QZ SECURITY
========================================================= */

if (typeof window !== "undefined") {
  qz.security.setCertificatePromise(
    (
      resolve: (certificate: string) => void,
      reject: (error: unknown) => void
    ) => {
      fetch("/api/qz", {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "text/plain",
        },
      })
        .then(async (response) => {
          const text = await response.text();

          if (!response.ok) {
            throw new Error(
              `Gagal mengambil certificate. HTTP ${response.status}: ${text}`
            );
          }

          if (!text.includes("BEGIN CERTIFICATE")) {
            throw new Error(
              "Certificate QZ tidak valid atau kosong."
            );
          }

          resolve(text);
        })
        .catch((error) => {
          console.error(
            "[QZ] CERTIFICATE ERROR:",
            error
          );

          reject(
            error instanceof Error
              ? error
              : new Error(
                  "Gagal mengambil certificate QZ."
                )
          );
        });
    }
  );

  qz.security.setSignatureAlgorithm("SHA512");

  qz.security.setSignaturePromise(
    (toSign: string) => {
      return (
        resolve: (signature: string) => void,
        reject: (error: unknown) => void
      ) => {
        fetch("/api/qz", {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type":
              "text/plain; charset=utf-8",
            Accept: "text/plain",
          },
          body: toSign,
        })
          .then(async (response) => {
            const text = await response.text();

            if (!response.ok) {
              let message = text;

              try {
                const json = JSON.parse(text);

                if (json?.message) {
                  message = json.message;
                }
              } catch {}

              throw new Error(
                message ||
                  `Gagal membuat signature. HTTP ${response.status}`
              );
            }

            let signature = text.trim();

            try {
              const json = JSON.parse(text);

              if (json?.signature) {
                signature = String(
                  json.signature
                ).trim();
              }
            } catch {}

            if (!signature) {
              throw new Error(
                "Signature dari server kosong."
              );
            }

            resolve(signature);
          })
          .catch((error) => {
            console.error(
              "[QZ] SIGNATURE ERROR:",
              error
            );

            reject(
              error instanceof Error
                ? error
                : new Error(
                    "Gagal membuat signature QZ."
                  )
            );
          });
      };
    }
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function BarcodePage() {
  const searchParams = useSearchParams();

  const idsParam =
    searchParams.get("ids");

  const [barang, setBarang] = useState<
    Barang[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [exporting, setExporting] =
    useState(false);

  const [qzConnected, setQzConnected] =
    useState(false);

  const [printerName, setPrinterName] =
    useState("");

  const [printing, setPrinting] =
    useState(false);

  const recordDate = useMemo(
    () => new Date().toISOString(),
    []
  );

  /* =========================================================
     LOAD BARANG
  ========================================================= */

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
          .filter(
            (id) => !Number.isNaN(id)
          );

        if (!ids.length) {
          setBarang([]);
          return;
        }

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

        const selectedBarang =
          allBarang
            .filter((item) =>
              ids.includes(
                Number(item.id)
              )
            )
            .map((item) => ({
              ...item,

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

              supplier: item.supplier
                ? {
                    id: item.supplier.id,
                    code:
                      item.supplier.code,
                    name:
                      item.supplier.name,
                  }
                : null,
            }));

        console.log(
          "[BARCODE] BARANG:",
          selectedBarang
        );

        setBarang(selectedBarang);
      } catch (error) {
        console.error(
          "[BARCODE] GAGAL LOAD:",
          error
        );

        setBarang([]);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [idsParam]);

  /* =========================================================
     LABEL
  ========================================================= */

  const labels = useMemo<LabelItem[]>(
    () => {
      const result: LabelItem[] = [];

      for (const item of barang) {
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
          result.push({
            key: `${item.id}-no-batch`,
            barang: item,
          });
        }
      }

      return result;
    },
    [barang]
  );

  /* =========================================================
     QR VALUE
  ========================================================= */

  function getQrValue(
    label: LabelItem
  ) {
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

  /* =========================================================
     GENERATE QR PREVIEW
  ========================================================= */

  useEffect(() => {
    if (!labels.length) return;

    let cancelled = false;

    const timer = window.setTimeout(
      async () => {
        for (const label of labels) {
          if (cancelled) return;

          const canvas =
            document.getElementById(
              `qr-${label.key}`
            ) as HTMLCanvasElement | null;

          if (!canvas) continue;

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
              "[BARCODE] QR ERROR:",
              error
            );
          }
        }
      },
      100
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [labels]);

  /* =========================================================
     DATE
  ========================================================= */

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

  /* =========================================================
     SUPPLIER
  ========================================================= */

  function getSupplierName(
    item: Barang
  ) {
    return (
      item.supplier?.name || "-"
    );
  }

  /* =========================================================
     CONNECT QZ TRAY
  ========================================================= */

  async function connectQzTray() {
    try {
      if (!qz.websocket.isActive()) {
        console.log(
          "[QZ] CONNECT..."
        );

        await qz.websocket.connect();
      }

      console.log(
        "[QZ] CONNECTED"
      );

      setQzConnected(true);

      return true;
    } catch (error) {
      console.error(
        "[QZ] CONNECT ERROR:",
        error
      );

      setQzConnected(false);

      throw new Error(
        "QZ Tray belum terhubung. Pastikan QZ Tray sedang berjalan."
      );
    }
  }

  /* =========================================================
     FIND PRINTER
  ========================================================= */

  async function findXprinter() {
    await connectQzTray();

    const printers =
      await qz.printers.find();

    console.log(
      "[QZ] PRINTER LIST:",
      printers
    );

    if (
      !printers ||
      !printers.length
    ) {
      throw new Error(
        "QZ Tray tidak menemukan printer Windows."
      );
    }

    const printer =
      printers.find((name) =>
        name
          .toLowerCase()
          .includes(
            PRINTER_KEYWORD
          )
      );

    if (!printer) {
      throw new Error(
        `Printer XP-D4601B tidak ditemukan.\n\nPrinter QZ:\n${printers.join(
          "\n"
        )}`
      );
    }

    console.log(
      "[QZ] PRINTER TERPILIH:",
      printer
    );

    setPrinterName(printer);

    return printer;
  }

  /* =========================================================
     TSPL HELPERS
  ========================================================= */

  function mmToDots(
    mm: number
  ) {
    return Math.round(
      (mm / 25.4) * DPI
    );
  }

  function tsplText(
    value: string,
    maxLength = 20
  ) {
    return String(value || "")
      .replace(/[\r\n]/g, " ")
      .replace(/"/g, "'")
      .trim()
      .slice(0, maxLength);
  }

  function tsplMainText(
    value: string,
    maxLength = 20
  ) {
    return tsplText(
      value,
      maxLength
    );
  }

  /* =========================================================
     BUILD TSPL LABEL
  ========================================================= */

  function buildTsplLabel(
    label: LabelItem
  ) {
    const item = label.barang;
    const batch = label.batch;

    const supplier =
      getSupplierName(item);

    const qrValue =
      getQrValue(label);

    const lines: string[] = [];

    /* =====================================================
       PRINTER
    ===================================================== */

    lines.push(
      `SIZE ${LABEL_WIDTH_MM} mm,${LABEL_HEIGHT_MM} mm`
    );

    lines.push(
      "GAP 2 mm,0 mm"
    );

    lines.push(
      "DENSITY 8"
    );

    lines.push(
      "SPEED 4"
    );

    lines.push(
      "DIRECTION 1"
    );

    lines.push(
      "REFERENCE 0,0"
    );

    lines.push(
      "CLS"
    );

    /* =====================================================
       HEADER
    ===================================================== */

    lines.push(
      `TEXT ${mmToDots(
        2
      )},${mmToDots(
        0.7
      )},"2",0,1,1,"PT MITRA GARAM BOGATAMA"`
    );

    /* =====================================================
       NAMA BARANG
       DIKECILKAN DAN BOLEH TURUN
    ===================================================== */

    const name =
      tsplMainText(
        item.name,
        24
      );

    lines.push(
      `TEXT ${mmToDots(
        2
      )},${mmToDots(
        3.2
      )},"2",0,1,1,"${name}"`
    );

    /* =====================================================
       SUBTITLE / GROCERIES
    ===================================================== */

    const subtitle =
      item.brand ||
      item.category ||
      "";

    if (subtitle) {
      lines.push(
        `TEXT ${mmToDots(
          2
        )},${mmToDots(
          6.1
        )},"1",0,1,1,"${tsplMainText(
          subtitle,
          18
        )}"`
      );
    }

    /* =====================================================
       QR 12 X 12 MM
       DITURUNKAN KE KIRI BAWAH
    ===================================================== */

    const qrX =
      mmToDots(1.5);

    const qrY =
      mmToDots(9.0);

    const qrCellSize = 3;

    lines.push(
      `QRCODE ${qrX},${qrY},L,${qrCellSize},A,0,"${tsplText(
        qrValue,
        80
      )}"`
    );

    /* =====================================================
       BARCODE / CODE
    ===================================================== */

    lines.push(
      `TEXT ${mmToDots(
        1.5
      )},${mmToDots(
        22.3
      )},"1",0,1,1,"${tsplText(
        item.barcode ||
          item.code,
        15
      )}"`
    );

    /* =====================================================
       INFO KANAN
    ===================================================== */

    const infoX =
      mmToDots(17);

    let infoY =
      mmToDots(9.2);

    const infoFont = "1";

    const rowHeight =
      mmToDots(2.25);

    /* UNIT */

    lines.push(
      `TEXT ${infoX},${infoY},"${infoFont}",0,1,1,"Unit: ${tsplText(
        item.unit || "-",
        11
      )}"`
    );

    infoY += rowHeight;

    /* CODE */

    lines.push(
      `TEXT ${infoX},${infoY},"${infoFont}",0,1,1,"Code: ${tsplText(
        item.code,
        11
      )}"`
    );

    infoY += rowHeight;

    /* BATCH */

    if (item.hasExpired) {
      lines.push(
        `TEXT ${infoX},${infoY},"${infoFont}",0,1,1,"Batch: ${tsplText(
          batch?.batchNumber ||
            "-",
          10
        )}"`
      );

      infoY += rowHeight;

      /* EXP */

      lines.push(
        `TEXT ${infoX},${infoY},"${infoFont}",0,1,1,"Exp: ${tsplText(
          formatShortDate(
            batch?.expiredDate
          ),
          11
        )}"`
      );

      infoY += rowHeight;
    }

    /* SUP */

    const supplierText =
      tsplText(
        supplier,
        18
      );

    /*
     * SUPPLIER TIDAK DIPAKSA
     * TERPOTONG DI KANAN.
     *
     * Jika panjang, dibuat 2 baris.
     */
    if (supplierText.length > 11) {
      const supplierFirst =
        supplierText.slice(0, 11);

      const supplierSecond =
        supplierText.slice(11, 22);

      lines.push(
        `TEXT ${infoX},${infoY},"${infoFont}",0,1,1,"Sup: ${supplierFirst}"`
      );

      infoY += rowHeight;

      if (supplierSecond) {
        lines.push(
          `TEXT ${infoX},${infoY},"${infoFont}",0,1,1,"    ${supplierSecond}"`
        );

        infoY += rowHeight;
      }
    } else {
      lines.push(
        `TEXT ${infoX},${infoY},"${infoFont}",0,1,1,"Sup: ${supplierText}"`
      );

      infoY += rowHeight;
    }

    /* USER */

    lines.push(
      `TEXT ${infoX},${infoY},"${infoFont}",0,1,1,"Usr: Gudang"`
    );

    /* =====================================================
       FOOTER
    ===================================================== */

    lines.push(
      `TEXT ${mmToDots(
        1.5
      )},${mmToDots(
        28.0
      )},"1",0,1,1,"Rec: ${tsplText(
        formatShortDate(
          recordDate
        ),
        15
      )}"`
    );

    /* =====================================================
       PRINT
    ===================================================== */

    lines.push(
      "PRINT 1,1"
    );

    return (
      lines.join("\r\n") +
      "\r\n"
    );
  }

  /* =========================================================
     TEST TSPL
  ========================================================= */

  function buildTestTspl() {
    return [
      "SIZE 40 mm,30 mm",
      "GAP 2 mm,0 mm",
      "DENSITY 8",
      "SPEED 4",
      "DIRECTION 1",
      "REFERENCE 0,0",
      "CLS",

      `TEXT 10,10,"2",0,2,2,"MGB ERP"`,

      `TEXT 10,55,"3",0,2,2,"TEST"`,

      `TEXT 10,105,"3",0,2,2,"XP-D4601B"`,

      `TEXT 10,160,"2",0,2,2,"PRINTER OK"`,

      "BOX 5,5,315,230,2",

      "PRINT 1,1",

      "",
    ].join("\r\n");
  }

  /* =========================================================
     QZ CONFIG
  ========================================================= */

  function createRawConfig(
    printer: string,
    jobName: string
  ) {
    return qz.configs.create(
      printer,
      {
        copies: 1,
        jobName,
        encoding: "UTF-8",
      }
    );
  }

  /* =========================================================
     TEST PRINT
  ========================================================= */

  async function handleTestQz() {
    if (printing) return;

    try {
      setPrinting(true);

      const printer =
        await findXprinter();

      const config =
        createRawConfig(
          printer,
          "MGB TEST TSPL"
        );

      const tspl =
        buildTestTspl();

      console.log(
        "[QZ] TEST PRINTER:",
        printer
      );

      console.log(
        "[QZ] TEST TSPL:",
        tspl
      );

      await qz.print(
        config,
        [
          {
            type: "raw",
            format: "command",
            flavor: "plain",
            data: tspl,
          },
        ]
      );

      alert(
        `Test RAW TSPL berhasil dikirim ke:\n\n${printer}\n\nPeriksa label printer.`
      );
    } catch (error) {
      console.error(
        "[QZ] TEST PRINT ERROR:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Test printer gagal."
      );
    } finally {
      setPrinting(false);
    }
  }

  /* =========================================================
     PRINT ALL
  ========================================================= */

  async function handlePrint() {
    if (!labels.length) {
      alert(
        "Tidak ada label untuk dicetak."
      );
      return;
    }

    if (printing) return;

    try {
      setPrinting(true);

      const printer =
        await findXprinter();

      console.log(
        `[QZ] PRINT ${labels.length} LABEL KE ${printer}`
      );

      const allTspl =
        labels
          .map((label) =>
            buildTsplLabel(label)
          )
          .join("\r\n");

      console.log(
        "[QZ] TOTAL TSPL LENGTH:",
        allTspl.length
      );

      console.log(
        "[QZ] RAW TSPL:",
        allTspl
      );

      const config =
        createRawConfig(
          printer,
          "MGB Barcode Labels"
        );

      await qz.print(
        config,
        [
          {
            type: "raw",
            format: "command",
            flavor: "plain",
            data: allTspl,
          },
        ]
      );

      alert(
        `Berhasil mengirim ${labels.length} label ke:\n${printer}`
      );
    } catch (error) {
      console.error(
        "[QZ] PRINT ERROR:",
        error
      );

      try {
        setQzConnected(
          qz.websocket.isActive()
        );
      } catch {}

      alert(
        error instanceof Error
          ? error.message
          : "Gagal mencetak label."
      );
    } finally {
      setPrinting(false);
    }
  }

  /* =========================================================
     EXPORT PDF
  ========================================================= */

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

      const labelWidth = 40;
      const labelHeight = 30;

      const gapX = 2;
      const gapY = 2;

      const columns = 4;
      const rows = 8;

      const totalWidth =
        labelWidth * columns +
        gapX * (columns - 1);

      const totalHeight =
        labelHeight * rows +
        gapY * (rows - 1);

      const marginX =
        (pageWidth -
          totalWidth) / 2;

      const marginY =
        (pageHeight -
          totalHeight) / 2;

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
          index %
          labelsPerPage;

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
            (labelWidth +
              gapX);

        const y =
          marginY +
          row *
            (labelHeight +
              gapY);

        /* BORDER */

        pdf.setDrawColor(
          170,
          170,
          170
        );

        pdf.setLineWidth(
          0.2
        );

        pdf.roundedRect(
          x,
          y,
          labelWidth,
          labelHeight,
          1,
          1,
          "S"
        );

        /* HEADER */

        pdf.setFont(
          "helvetica",
          "bold"
        );

        pdf.setFontSize(
          4.3
        );

        pdf.setTextColor(
          50,
          50,
          50
        );

        pdf.text(
          "PT MITRA GARAM BOGATAMA",
          x + 2,
          y + 3.2
        );

        /* NAMA BARANG */

        pdf.setFontSize(
          6.2
        );

        pdf.setTextColor(
          10,
          10,
          10
        );

        const nameLines =
          pdf.splitTextToSize(
            label.barang.name,
            labelWidth - 4
          );

        const safeNameLines =
          nameLines.slice(0, 2);

        pdf.text(
          safeNameLines,
          x + 2,
          y + 7.0
        );

        /*
         * Tinggi nama dinamis.
         * Kalau nama 2 baris, subtitle,
         * QR dan barcode ikut turun.
         */
        const nameLineHeight =
          2.8;

        const nameHeight =
          safeNameLines.length *
          nameLineHeight;

        /* SUBTITLE */

        const subtitle =
          label.barang.brand ||
          label.barang.category ||
          "";

        let subtitleY =
          y +
          7.0 +
          nameHeight +
          0.3;

        if (subtitle) {
          pdf.setFont(
            "helvetica",
            "bold"
          );

          pdf.setFontSize(
            3.9
          );

          pdf.setTextColor(
            80,
            80,
            80
          );

          const subtitleLines =
            pdf
              .splitTextToSize(
                subtitle,
                labelWidth - 4
              )
              .slice(0, 1);

          pdf.text(
            subtitleLines,
            x + 2,
            subtitleY
          );
        }

        /* ===================================================
           QR
           KIRI BAWAH
        =================================================== */

        const qrSize =
          QR_SIZE_MM;

        const qrX =
          x + 1.5;

        /*
         * QR diturunkan.
         * Kalau nama barang 2 baris,
         * QR ikut turun.
         */
        const qrY =
          subtitleY +
          (subtitle ? 1.8 : 0.8);

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

        /* BARCODE TEXT */

        pdf.setFont(
          "helvetica",
          "bold"
        );

        pdf.setFontSize(
          3.8
        );

        pdf.setTextColor(
          30,
          30,
          30
        );

        pdf.text(
          label.barang.barcode ||
            label.barang.code,
          qrX +
            qrSize / 2,
          qrY +
            qrSize +
            1.5,
          {
            align: "center",
          }
        );

        /* ===================================================
           INFO
        =================================================== */

        const infoX =
          x + 15.0;

        const valueX =
          x + 20.0;

        let infoY =
          qrY;

        const valueMaxWidth =
          labelWidth -
          (valueX - x) -
          1.2;

        pdf.setFontSize(
          3.6
        );

        function pdfInfo(
          key: string,
          value: string
        ) {
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
            key,
            infoX,
            infoY
          );

          pdf.setFont(
            "helvetica",
            "bold"
          );

          pdf.setTextColor(
            20,
            20,
            20
          );

          /*
           * TIDAK DIPAKSA SATU BARIS.
           *
           * Jika value panjang, akan turun
           * ke baris berikutnya.
           */
          const lines =
            pdf.splitTextToSize(
              value || "-",
              valueMaxWidth
            );

          const safeLines =
            lines.slice(0, 2);

          pdf.text(
            safeLines,
            valueX,
            infoY
          );

          infoY +=
            safeLines.length > 1
              ? 3.5
              : 2.35;
        }

        pdfInfo(
          "Unit",
          label.barang.unit ||
            "-"
        );

        pdfInfo(
          "Code",
          label.barang.code
        );

        if (
          label.barang.hasExpired
        ) {
          pdfInfo(
            "Batch",
            label.batch
              ?.batchNumber ||
              "-"
          );

          pdfInfo(
            "Exp",
            formatShortDate(
              label.batch
                ?.expiredDate
            )
          );
        }

        pdfInfo(
          "Sup",
          getSupplierName(
            label.barang
          )
        );

        pdfInfo(
          "Usr",
          "Gudang"
        );

        /* FOOTER */

        pdf.setDrawColor(
          190,
          190,
          190
        );

        pdf.setLineWidth(
          0.1
        );

        pdf.line(
          x + 2,
          y + 27,
          x + 38,
          y + 27
        );

        pdf.setFont(
          "helvetica",
          "normal"
        );

        pdf.setFontSize(
          3.6
        );

        pdf.setTextColor(
          100,
          100,
          100
        );

        pdf.text(
          `Rec : ${formatShortDate(
            recordDate
          )}`,
          x + 2,
          y + 29
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
        "[PDF] ERROR:",
        error
      );

      alert(
        "Gagal membuat PDF label."
      );
    } finally {
      setExporting(false);
    }
  }

  /* =========================================================
     LOADING
  ========================================================= */

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

  /* =========================================================
     EMPTY
  ========================================================= */

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
            Tidak ada barang yang dipilih
            untuk dicetak.
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

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* HEADER */}

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

          {/* QZ STATUS */}

          <div
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-sm ${
              qzConnected
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-600"
            }`}
          >
            {qzConnected ? (
              <Wifi size={16} />
            ) : (
              <WifiOff size={16} />
            )}

            {qzConnected
              ? "QZ Tray Terhubung"
              : "QZ Tray Belum Terhubung"}
          </div>

          {/* PRINTER */}

          {printerName && (
            <div className="hidden items-center rounded-xl border border-[#D5E5DC] bg-white px-4 py-2.5 text-xs text-gray-600 shadow-sm lg:flex">
              {printerName}
            </div>
          )}

          {/* TOTAL */}

          <div className="hidden items-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-2.5 text-sm text-gray-500 shadow-sm sm:flex">
            <QrCode
              size={17}
              className="text-[#497F70]"
            />
            {labels.length} label
          </div>

          {/* TEST */}

          <button
            type="button"
            onClick={handleTestQz}
            disabled={printing}
            className="inline-flex items-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-2.5 text-sm font-semibold text-[#497F70] shadow-sm hover:bg-[#F5F8F6] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {printing ? (
              <Loader2
                size={17}
                className="animate-spin"
              />
            ) : (
              <Wifi size={17} />
            )}

            Test QZ
          </button>

          {/* PRINT */}

          <button
            type="button"
            onClick={handlePrint}
            disabled={printing}
            className="inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#3E6E61] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {printing ? (
              <Loader2
                size={17}
                className="animate-spin"
              />
            ) : (
              <Printer size={17} />
            )}

            {printing
              ? "Mencetak..."
              : "Cetak Printer"}
          </button>

          {/* PDF */}

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-2.5 text-sm font-semibold text-[#497F70] shadow-sm hover:bg-[#F5F8F6] disabled:cursor-not-allowed disabled:opacity-60"
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

          {/* BACK */}

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

      {/* INFO */}

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
              satu label. Ukuran label{" "}
              <strong>
                40 × 30 mm
              </strong>
              . QR berukuran{" "}
              <strong>
                12 × 12 mm
              </strong>
              . Informasi Unit, Code, Batch,
              Exp, Supplier dan User dibuat
              compact dan dapat turun baris
              apabila terlalu panjang.
            </p>
          </div>
        </div>
      </div>

      {/* LABEL PREVIEW */}

      <div className="label-container grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">

        {labels.map((label) => {
          const item =
            label.barang;

          const batch =
            label.batch;

          const subtitle =
            item.brand ||
            item.category ||
            "";

          return (
            <div
              key={label.key}
              className="label-card relative overflow-hidden rounded-md border border-[#D4D4D4] bg-[#FFFDF8] shadow-sm"
            >

              {/* HEADER */}

              <div className="label-header px-2 pt-2">

                {/* PT */}

                <div className="label-company truncate text-[6px] font-bold tracking-wide leading-none text-gray-700">
                  PT Mitra Garam Bogatama
                </div>

                {/* NAMA BARANG */}

                <div className="label-name mt-0.5 line-clamp-2 break-words text-[11px] font-bold leading-[1.05] text-gray-900">
                  {item.name}
                </div>

                {/* GROCERIES / BRAND */}

                {subtitle && (
                  <div className="label-subtitle mt-0.5 truncate text-[7px] font-semibold leading-none text-gray-700">
                    {subtitle}
                  </div>
                )}

              </div>

              {/* CONTENT */}

              <div className="label-content grid grid-cols-[48px_minmax(0,1fr)] gap-1 px-2 pb-1.5 pt-0.5">

                {/* QR */}

                <div className="qr-column flex min-w-0 flex-col items-center justify-end">

                  <div className="qr-wrapper">
                    <canvas
                      id={`qr-${label.key}`}
                      className="qr-code"
                    />
                  </div>

                  <div className="qr-caption mt-0.5 w-[48px] break-all text-center text-[5.5px] font-bold leading-tight text-gray-700">
                    {item.barcode ||
                      item.code}
                  </div>

                </div>

                {/* INFO */}

                <div className="info-section min-w-0 pt-0">

                  <div className="info-row grid grid-cols-[21px_minmax(0,1fr)] text-[6.2px] font-semibold leading-[1.25]">
                    <span className="text-gray-500">
                      Unit
                    </span>

                    <strong className="min-w-0 break-words text-gray-800">
                      {item.unit || "-"}
                    </strong>
                  </div>

                  <div className="info-row grid grid-cols-[21px_minmax(0,1fr)] text-[6.2px] font-semibold leading-[1.25]">
                    <span className="text-gray-500">
                      Code
                    </span>

                    <strong className="min-w-0 break-words text-gray-800">
                      {item.code}
                    </strong>
                  </div>

                  {item.hasExpired && (
                    <>
                      <div className="my-0.5 border-t border-gray-300" />

                      <div className="info-row grid grid-cols-[21px_minmax(0,1fr)] text-[6.2px] font-semibold leading-[1.25]">
                        <span className="text-gray-500">
                          Batch
                        </span>

                        <strong className="min-w-0 break-words text-gray-800">
                          {batch?.batchNumber ||
                            "-"}
                        </strong>
                      </div>

                      <div className="info-row grid grid-cols-[21px_minmax(0,1fr)] text-[6.2px] font-semibold leading-[1.25]">
                        <span className="text-gray-500">
                          Exp
                        </span>

                        <strong className="min-w-0 break-words text-gray-800">
                          {formatShortDate(
                            batch?.expiredDate
                          )}
                        </strong>
                      </div>
                    </>
                  )}

                  <div className="info-row grid grid-cols-[21px_minmax(0,1fr)] text-[6.2px] font-semibold leading-[1.25]">
                    <span className="text-gray-500">
                      Sup
                    </span>

                    <strong className="min-w-0 break-words text-gray-800">
                      {item.supplier?.name ||
                        "-"}
                    </strong>
                  </div>

                  <div className="info-row grid grid-cols-[21px_minmax(0,1fr)] text-[6.2px] font-semibold leading-[1.25]">
                    <span className="text-gray-500">
                      Usr
                    </span>

                    <strong className="min-w-0 break-words text-gray-800">
                      Gudang
                    </strong>
                  </div>

                </div>
              </div>

              {/* FOOTER */}

              <div className="label-footer border-t border-gray-300 px-2 py-0.5 text-[6px] font-semibold text-gray-500">
                Rec :{" "}
                {formatShortDate(
                  recordDate
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* =====================================================
          PRINT CSS
      ===================================================== */}

      <style jsx global>{`

        /*
         * ===================================================
         * PREVIEW
         * ===================================================
         */

        .label-card {
          width: 40mm;
          min-height: 30mm;
          height: 30mm;

          overflow: hidden;
        }

        .label-header {
          min-height: 9mm;

          overflow: hidden;
        }

        .label-company {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: clip;
        }

        .label-name {
          max-width: 100%;

          white-space: normal;
          overflow: hidden;

          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;

          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .label-subtitle {
          max-width: 100%;

          white-space: nowrap;
          overflow: hidden;
          text-overflow: clip;
        }

        .label-content {
          min-width: 0;
        }

        .qr-column {
          min-width: 0;
          align-self: end;
        }

        .qr-wrapper {
          width: 48px;
          height: 48px;
          flex-shrink: 0;
        }

        .qr-code {
          display: block;
          width: 48px;
          height: 48px;
        }

        .qr-caption {
          max-width: 48px;
          overflow: hidden;

          overflow-wrap: anywhere;
          word-break: break-all;
        }

        .info-section {
          min-width: 0;
          overflow: hidden;
        }

        .info-row {
          min-width: 0;
          overflow: hidden;
        }

        .info-row span {
          min-width: 0;
          overflow: hidden;
        }

        .info-row strong {
          min-width: 0;
          max-width: 100%;

          overflow: hidden;

          white-space: normal;

          overflow-wrap: anywhere;
          word-break: break-word;
        }

        /*
         * ===================================================
         * PRINT
         * ===================================================
         */

        @media print {

          @page {
            size: 40mm 30mm;
            margin: 0;
          }

          html {
            width: 40mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          body {
            width: 40mm !important;
            height: 30mm !important;

            margin: 0 !important;
            padding: 0 !important;

            background: white !important;

            overflow: hidden !important;
          }

          .no-print {
            display: none !important;
          }

          .label-container {
            display: block !important;

            width: 40mm !important;

            margin: 0 !important;
            padding: 0 !important;
          }

          .label-card {
            position: relative !important;

            width: 40mm !important;
            height: 30mm !important;
            min-height: 30mm !important;

            margin: 0 !important;
            padding: 0 !important;

            border: 0.25mm solid #999 !important;

            border-radius: 1mm !important;

            box-shadow: none !important;

            overflow: hidden !important;

            page-break-after: always !important;
            break-after: page !important;
          }

          .label-card:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          /*
           * =================================================
           * HEADER PRINT
           * =================================================
           */

          .label-header {
            min-height: 9mm !important;

            padding-left: 2mm !important;
            padding-right: 2mm !important;
            padding-top: 0.9mm !important;

            overflow: hidden !important;
          }

          /*
           * PT DIPERKECIL LAGI
           * SUPAYA TIDAK KEPOTONG
           */

          .label-company {
            width: 100% !important;

            font-size: 1.25mm !important;
            line-height: 1.5mm !important;

            font-weight: 700 !important;

            white-space: nowrap !important;

            overflow: hidden !important;
            text-overflow: clip !important;
          }

          /*
           * NAMA BARANG
           * TIDAK DIPAKSA 1 BARIS
           */

          .label-name {
            width: 100% !important;

            max-width: 100% !important;

            margin-top: 0.25mm !important;

            font-size: 2.55mm !important;
            line-height: 2.75mm !important;

            white-space: normal !important;

            overflow: hidden !important;

            display: -webkit-box !important;
            -webkit-box-orient: vertical !important;
            -webkit-line-clamp: 2 !important;

            overflow-wrap: anywhere !important;
            word-break: break-word !important;
          }

          /*
           * GROCERIES / BRAND
           * DEKAT DENGAN QR
           */

          .label-subtitle {
            width: 100% !important;

            max-width: 100% !important;

            margin-top: 0.15mm !important;

            font-size: 1.55mm !important;
            line-height: 1.7mm !important;

            font-weight: 600 !important;

            white-space: nowrap !important;

            overflow: hidden !important;
            text-overflow: clip !important;
          }

          /*
           * =================================================
           * CONTENT
           * =================================================
           */

          .label-content {
            display: grid !important;

            grid-template-columns:
              12mm
              minmax(0, 1fr) !important;

            column-gap: 1mm !important;

            /*
             * QR DAN GROCERIES DIBUAT LEBIH DEKAT
             */

            padding-left: 1.5mm !important;
            padding-right: 1.5mm !important;

            padding-top: 0.1mm !important;

            padding-bottom: 0 !important;

            min-width: 0 !important;
          }

          /*
           * =================================================
           * QR
           * KIRI BAWAH
           * =================================================
           */

          .qr-column {
            width: 12mm !important;

            min-width: 12mm !important;

            align-self: end !important;

            justify-content: flex-end !important;

            margin-top: 0 !important;
          }

          .qr-wrapper {
            width: 12mm !important;
            height: 12mm !important;

            flex-shrink: 0 !important;
          }

          .qr-code {
            display: block !important;

            width: 12mm !important;
            height: 12mm !important;

            max-width: 12mm !important;
            max-height: 12mm !important;
          }

          /*
           * BARCODE / CODE DI BAWAH QR
           */

          .qr-caption {
            width: 12mm !important;
            max-width: 12mm !important;

            margin-top: 0.2mm !important;

            font-size: 1.25mm !important;

            line-height: 1.35mm !important;

            font-weight: 700 !important;

            text-align: center !important;

            white-space: normal !important;

            overflow: hidden !important;

            overflow-wrap: anywhere !important;
            word-break: break-all !important;
          }

          /*
           * =================================================
           * INFO
           * =================================================
           */

          .info-section {
            min-width: 0 !important;

            max-width: 100% !important;

            padding-top: 0 !important;

            overflow: hidden !important;
          }

          .info-row {
            display: grid !important;

            grid-template-columns:
              5.2mm
              minmax(0, 1fr) !important;

            width: 100% !important;

            min-width: 0 !important;

            font-size: 1.45mm !important;

            line-height: 1.75mm !important;

            font-weight: 600 !important;

            overflow: visible !important;
          }

          .info-row span {
            min-width: 0 !important;

            max-width: 5.2mm !important;

            overflow: hidden !important;

            white-space: nowrap !important;
          }

          .info-row strong {
            min-width: 0 !important;

            max-width: 100% !important;

            overflow: visible !important;

            white-space: normal !important;

            overflow-wrap: anywhere !important;

            word-break: break-word !important;

            font-weight: 700 !important;
          }

          /*
           * GARIS BATCH
           */

          .info-section .border-t {
            margin-top: 0.25mm !important;
            margin-bottom: 0.25mm !important;
          }

          /*
           * =================================================
           * FOOTER
           * =================================================
           */

          .label-footer {
            position: absolute !important;

            left: 0 !important;
            right: 0 !important;

            bottom: 0 !important;

            height: 2.8mm !important;

            padding-left: 1.5mm !important;
            padding-right: 1.5mm !important;

            padding-top: 0.35mm !important;

            font-size: 1.25mm !important;

            line-height: 1.5mm !important;

            font-weight: 600 !important;

            white-space: nowrap !important;

            overflow: hidden !important;
          }
        }
      `}</style>
    </div>
  );
}