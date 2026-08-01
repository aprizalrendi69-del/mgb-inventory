import * as XLSX from "xlsx";

export function exportSupplierExcel(
supplier:any,
purchases:any[]
){

const rows:any=[];

rows.push([
"PT. MITRA GARAM BOGATAMA"
]);

rows.push([
`Laporan Supplier : ${supplier.name}`
]);

rows.push([]);

rows.push([
"No PO",
"Tanggal",
"Barang",
"Qty",
"Harga",
"Subtotal",
"Status"
]);

let grandTotal=0;

purchases.forEach((po:any)=>{

po.items.forEach((item:any)=>{

grandTotal+=item.subtotal;

rows.push([

po.number,

new Date(
po.purchaseDate
).toLocaleDateString("id-ID"),

item.barang.name,

item.qty,

item.price,

item.subtotal,

po.status

]);

});

});

rows.push([]);

rows.push([
"",
"",
"",
"",
"Grand Total",
grandTotal
]);

const ws=XLSX.utils.aoa_to_sheet(rows);

const wb=XLSX.utils.book_new();

XLSX.utils.book_append_sheet(
wb,
ws,
"Supplier"
);

XLSX.writeFile(
wb,
`Laporan Supplier ${supplier.name}.xlsx`
);

}