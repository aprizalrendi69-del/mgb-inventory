export default function DokumenPage(){

return(

<div className="p-8">

<h1 className="text-3xl font-bold mb-6">
Pengaturan Nomor Dokumen
</h1>


<div className="bg-white rounded-xl shadow p-6">


<table className="w-full">

<thead>

<tr>

<th className="text-left">
Dokumen
</th>

<th>
Prefix
</th>

<th>
Contoh
</th>

</tr>

</thead>


<tbody>


<tr>
<td>
Purchase Order
</td>

<td>
PO
</td>

<td>
PO-202608-00001
</td>

</tr>


<tr>
<td>
Goods Receipt
</td>

<td>
GR
</td>

<td>
GR-202608-00001
</td>

</tr>


<tr>
<td>
Delivery Order
</td>

<td>
DO
</td>

<td>
DO-202608-00001
</td>

</tr>


<tr>
<td>
Surat Jalan
</td>

<td>
SJ
</td>

<td>
SJ-202608-00001
</td>

</tr>


</tbody>


</table>


</div>


</div>

)

}