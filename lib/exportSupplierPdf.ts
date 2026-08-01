import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportSupplierPdf(
  supplier: any,
  purchases: any[]
) {

  const doc = new jsPDF("p", "mm", "a4");

  doc.setFontSize(18);
  doc.text("PT. MITRA GARAM BOGATAMA", 14, 15);

  doc.setFontSize(14);
  doc.text("LAPORAN TRANSAKSI SUPPLIER", 14, 24);

  doc.setFontSize(11);

  doc.text(`Supplier : ${supplier.name}`,14,35);
  doc.text(`Kode     : ${supplier.code}`,14,42);
  doc.text(`Kota     : ${supplier.city ?? "-"}`,14,49);
  doc.text(`Telepon  : ${supplier.phone ?? "-"}`,14,56);

  let grandTotal = 0;

  const body:any[]=[];

  purchases.forEach((po:any)=>{

    po.items.forEach((item:any)=>{

      grandTotal+=item.subtotal;

      body.push([

        po.number,

        new Date(
          po.purchaseDate
        ).toLocaleDateString("id-ID"),

        item.barang.name,

        item.qty,

        item.price.toLocaleString("id-ID"),

        item.subtotal.toLocaleString("id-ID"),

        po.status

      ]);

    });

  });

  autoTable(doc,{

    startY:65,

    head:[[
      "No PO",
      "Tanggal",
      "Barang",
      "Qty",
      "Harga",
      "Subtotal",
      "Status"
    ]],

    body,

    styles:{
      fontSize:9
    }

  });

  const finalY =
    (doc as any).lastAutoTable.finalY+10;

  doc.setFontSize(12);

  doc.text(
    `Grand Total : Rp ${grandTotal.toLocaleString("id-ID")}`,
    14,
    finalY
  );

  doc.text(
    "Mengetahui",
    150,
    finalY
  );

  doc.line(
    145,
    finalY+28,
    190,
    finalY+28
  );

  doc.save(
    `Laporan Supplier ${supplier.name}.pdf`
  );

}