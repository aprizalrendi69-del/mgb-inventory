import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


export function exportAttendancePdf(
 data:any[],
 month:number,
 year:number
){


const doc =
new jsPDF();



doc.text(

`Laporan Attendance ${month}/${year}`,

14,

15

);



autoTable(doc,{

startY:25,


head:[

[
"NIK",
"Nama",
"Department",
"Hadir",
"Check Out",
"Belum"
]

],



body:data.map((e)=>[

e.nik,

e.name,

e.department || "-",

e.totalHadir,

e.totalSelesai,

e.totalBelumPulang

])


});



doc.save(

`Laporan_Attendance_${month}_${year}.pdf`

);


}