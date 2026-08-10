import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { COMPANY } from "@/lib/company";

export function exportSuratJalanPDF(data: any) {
  const doc = new jsPDF("p", "mm", "a4");

  // =====================================================
  // KONFIGURASI HALAMAN
  // =====================================================

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const marginLeft = 14;
  const marginRight = 14;

  // =====================================================
  // HEADER PERUSAHAAN
  // =====================================================

  function drawCompanyHeader() {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);

    doc.text(
      COMPANY.name.toUpperCase(),
      pageWidth / 2,
      15,
      {
        align: "center",
      }
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    let headerLineY = 21;

    // Alamat
    if (COMPANY.address) {
      doc.text(
        COMPANY.address,
        pageWidth / 2,
        headerLineY,
        {
          align: "center",
        }
      );

      headerLineY += 5;
    }

    // Telepon
    if (COMPANY.phone) {
      doc.text(
        `Telp : ${COMPANY.phone}`,
        pageWidth / 2,
        headerLineY,
        {
          align: "center",
        }
      );

      headerLineY += 5;
    }

    // Email
    if (COMPANY.email) {
      doc.text(
        `Email : ${COMPANY.email}`,
        pageWidth / 2,
        headerLineY,
        {
          align: "center",
        }
      );

      headerLineY += 5;
    }

    // Website
    if (COMPANY.website) {
      doc.text(
        `Website : ${COMPANY.website}`,
        pageWidth / 2,
        headerLineY,
        {
          align: "center",
        }
      );

      headerLineY += 5;
    }

    // Garis header
    doc.setLineWidth(0.8);

    doc.line(
      marginLeft,
      headerLineY,
      pageWidth - marginRight,
      headerLineY
    );

    doc.setLineWidth(0.2);

    doc.line(
      marginLeft,
      headerLineY + 1.5,
      pageWidth - marginRight,
      headerLineY + 1.5
    );

    return headerLineY;
  }

  // =====================================================
  // HEADER HALAMAN PERTAMA
  // =====================================================

  const headerLineY = drawCompanyHeader();

  // =====================================================
  // JUDUL
  // =====================================================

  const titleY = headerLineY + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);

  doc.text(
    "SURAT JALAN",
    pageWidth / 2,
    titleY,
    {
      align: "center",
    }
  );

  // =====================================================
  // INFORMASI DOKUMEN
  // =====================================================

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const infoStartY = titleY + 10;

  // Kiri

  doc.text(
    "No Surat Jalan",
    14,
    infoStartY
  );

  doc.text(
    ": " + (data.suratJalan?.number ?? "-"),
    50,
    infoStartY
  );

  doc.text(
    "No Delivery",
    14,
    infoStartY + 7
  );

  doc.text(
    ": " + (data.number ?? "-"),
    50,
    infoStartY + 7
  );

  doc.text(
    "Customer",
    14,
    infoStartY + 14
  );

  doc.text(
    ": " + (data.customer?.name ?? "-"),
    50,
    infoStartY + 14
  );

  doc.text(
    "Alamat",
    14,
    infoStartY + 21
  );

  // Alamat dibuat max width agar tidak keluar halaman
  const customerAddress =
    data.customer?.address ?? "-";

  doc.text(
    ": " + customerAddress,
    50,
    infoStartY + 21,
    {
      maxWidth: 75,
    }
  );

  // Kanan

  doc.text(
    "Tanggal",
    130,
    infoStartY
  );

  doc.text(
    ": " +
      (data.deliveryDate
        ? new Date(
            data.deliveryDate
          ).toLocaleDateString("id-ID")
        : "-"),
    155,
    infoStartY
  );

  // =====================================================
  // DATA BARANG
  // =====================================================

  const items = data.items ?? [];

  // =====================================================
  // HITUNG TOTAL
  // =====================================================

  const total = items.reduce(
    (acc: number, item: any) => {
      const subtotal =
        item.subtotal ??
        Number(item.qty ?? 0) *
          Number(item.price ?? 0);

      return acc + Number(subtotal);
    },
    0
  );

  // =====================================================
  // TABEL BARANG
  // =====================================================

  const tableStartY =
    infoStartY + 30;

  autoTable(doc, {
    startY: tableStartY,

    margin: {
      top: 15,
      left: marginLeft,
      right: marginRight,
      bottom: 20,
    },

    theme: "grid",

    pageBreak: "auto",

    showHead: "everyPage",

    rowPageBreak: "avoid",

    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2.5,
      overflow: "linebreak",
      valign: "middle",
    },

    headStyles: {
      fillColor: [22, 163, 74],
      textColor: 255,
      halign: "center",
      valign: "middle",
      fontStyle: "bold",
      fontSize: 8,
    },

    bodyStyles: {
      halign: "left",
      textColor: 20,
    },

    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },

    columnStyles: {
      0: {
        halign: "center",
        cellWidth: 10,
      },

      1: {
        cellWidth: 22,
      },

      2: {
        cellWidth: 52,
      },

      3: {
        halign: "center",
        cellWidth: 18,
      },

      4: {
        halign: "right",
        cellWidth: 14,
      },

      5: {
        halign: "right",
        cellWidth: 28,
      },

      6: {
        halign: "right",
        cellWidth: 32,
      },
    },

    head: [
      [
        "No",
        "Kode",
        "Nama Barang",
        "Satuan",
        "Qty",
        "Harga",
        "Subtotal",
      ],
    ],

    body: items.map(
      (item: any, index: number) => [
        index + 1,

        item.barang?.code ?? "-",

        item.barang?.name ?? "-",

        item.barang?.unit ?? "-",

        Number(item.qty ?? 0).toLocaleString(
          "id-ID"
        ),

        Number(
          item.price ?? 0
        ).toLocaleString("id-ID"),

        Number(
          item.subtotal ??
            Number(item.qty ?? 0) *
              Number(item.price ?? 0)
        ).toLocaleString("id-ID"),
      ]
    ),

    // =================================================
    // FOOTER SETIAP HALAMAN
    // =================================================

    didDrawPage: function () {
      const pageNumber =
        doc.getCurrentPageInfo()
          .pageNumber;

      const pageCount =
        (doc as any).internal.getNumberOfPages();

      doc.setFontSize(8);
      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.text(
        `Halaman ${pageNumber} dari ${pageCount}`,
        pageWidth / 2,
        pageHeight - 8,
        {
          align: "center",
        }
      );
    },
  });

  // =====================================================
  // POSISI SETELAH TABEL
  // =====================================================

  let finalY =
    ((doc as any).lastAutoTable
      ?.finalY ?? tableStartY) + 10;

  // =====================================================
  // CEK RUANG UNTUK TOTAL + CATATAN + TTD
  // =====================================================

  const requiredSpace = 75;

  if (
    finalY + requiredSpace >
    pageHeight - 15
  ) {
    doc.addPage();

    finalY = 20;

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(11);

    doc.text(
      "SURAT JALAN - LANJUTAN",
      marginLeft,
      finalY
    );

    finalY += 10;
  }

  // =====================================================
  // TOTAL
  // =====================================================

  doc.setDrawColor(120);
  doc.setLineWidth(0.3);

  doc.line(
    120,
    finalY,
    196,
    finalY
  );

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(12);

  doc.text(
    "TOTAL : Rp " +
      total.toLocaleString("id-ID"),
    125,
    finalY + 7
  );

  // =====================================================
  // CATATAN
  // =====================================================

  const note =
    data.note ??
    data.remarks ??
    "-";

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(10);

  doc.text(
    "Catatan :",
    14,
    finalY + 20
  );

  doc.text(
    String(note),
    35,
    finalY + 20,
    {
      maxWidth: 160,
    }
  );

  // =====================================================
  // TANDA TANGAN
  // =====================================================

  const signY =
    finalY + 38;

  doc.setFontSize(10);

  doc.text(
    "Dibuat",
    27,
    signY,
    {
      align: "center",
    }
  );

  doc.text(
    "Gudang",
    77,
    signY,
    {
      align: "center",
    }
  );

  doc.text(
    "Pengirim",
    127,
    signY,
    {
      align: "center",
    }
  );

  doc.text(
    "Penerima",
    177,
    signY,
    {
      align: "center",
    }
  );

  // Garis tanda tangan

  doc.line(
    12,
    signY + 28,
    42,
    signY + 28
  );

  doc.line(
    62,
    signY + 28,
    92,
    signY + 28
  );

  doc.line(
    112,
    signY + 28,
    142,
    signY + 28
  );

  doc.line(
    162,
    signY + 28,
    192,
    signY + 28
  );

  // =====================================================
  // UPDATE NOMOR HALAMAN
  // =====================================================

  const totalPages =
    (doc as any).internal.getNumberOfPages();

  for (
    let page = 1;
    page <= totalPages;
    page++
  ) {
    doc.setPage(page);

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(8);

    doc.text(
      `Halaman ${page} dari ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      {
        align: "center",
      }
    );
  }

  // =====================================================
  // SIMPAN PDF
  // =====================================================

  const fileName =
    data.suratJalan?.number ??
    data.number ??
    "surat-jalan";

  doc.save(
    `${fileName}.pdf`
  );
}