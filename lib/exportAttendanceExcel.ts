import * as XLSX from "xlsx";


export function exportAttendanceExcel(
  data:any[],
  month:number,
  year:number
){


const rows = data.map((e)=>({

  NIK:e.nik,

  Nama:e.name,

  Department:e.department || "-",

  Hadir:e.totalHadir,

  "Sudah Check Out":e.totalSelesai,

  "Belum Check Out":e.totalBelumPulang

}));



const worksheet =
XLSX.utils.json_to_sheet(rows);



const workbook =
XLSX.utils.book_new();



XLSX.utils.book_append_sheet(

workbook,

worksheet,

"Attendance"

);



XLSX.writeFile(

workbook,

`Laporan_Attendance_${month}_${year}.xlsx`

);


}