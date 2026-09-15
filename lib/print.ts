import { COMPANY } from "@/lib/company";

export function printTable(
  columns: string[],
  rows: any[][]
) {
  const now = new Date().toLocaleString("id-ID");

  const html = `
<!DOCTYPE html>
<html>

<head>

<meta charset="UTF-8">

<title>Laporan</title>

<style>

body{
font-family:Arial,Helvetica,sans-serif;
padding:30px;
color:#222;
}

.header{
text-align:center;
border-bottom:3px solid #000;
padding-bottom:10px;
margin-bottom:20px;
}

.header h1{
margin:0;
font-size:24px;
}

.header p{
margin:3px 0;
font-size:12px;
}

.title{
text-align:center;
font-size:20px;
font-weight:bold;
margin:20px 0;
}

.info{
display:flex;
justify-content:space-between;
margin-bottom:15px;
font-size:13px;
}

table{
width:100%;
border-collapse:collapse;
}

th{
background:#dbeafe;
border:1px solid #000;
padding:8px;
}

td{
border:1px solid #000;
padding:8px;
}

tbody tr:nth-child(even){
background:#f9fafb;
}

.footer{
margin-top:60px;
display:flex;
justify-content:space-between;
}

.sign{
width:220px;
text-align:center;
}

.line{
margin-top:60px;
border-top:1px solid black;
padding-top:5px;
}

.print-footer{
margin-top:40px;
text-align:center;
font-size:11px;
color:#555;
}

</style>

</head>

<body>

<div class="header">

<h1>${COMPANY.name}</h1>

<p>${COMPANY.address}</p>

<p>
Telp : ${COMPANY.phone}
|
Email : ${COMPANY.email}
</p>

<p>${COMPANY.website}</p>

</div>

<div class="title">

LAPORAN

</div>

<div class="info">

<div>
Tanggal Cetak : ${now}
</div>

<div>
Jumlah Data : ${rows.length}
</div>

</div>

<table>

<thead>

<tr>

${columns.map(col=>`<th>${col}</th>`).join("")}

</tr>

</thead>

<tbody>

${rows.map(row=>`

<tr>

${row.map(cell=>`<td>${cell}</td>`).join("")}

</tr>

`).join("")}

</tbody>

</table>

<div class="footer">

<div class="sign">

Mengetahui

<div class="line">
Manager
</div>

</div>

<div class="sign">

Dibuat Oleh

<div class="line">
Administrator
</div>

</div>

</div>

<div class="print-footer">

PT Mitra Garam Bogatama - MGB Inventory System

</div>

<script>

window.onload=function(){

window.print();

window.onafterprint=function(){

window.close();

}

}

</script>

</body>

</html>
`;

  const win = window.open("", "_blank");

  if (!win) return;

  win.document.open();
  win.document.write(html);
  win.document.close();
}