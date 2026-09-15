"use client";

import { useEffect, useState } from "react";


export default function BarangMasukPage() {


const [receipt,setReceipt] = useState<any[]>([]);

const [loading,setLoading] = useState(true);



useEffect(()=>{

    loadData();

},[]);



async function loadData(){

    try{


        const res = await fetch("/api/barang-masuk");


        const data = await res.json();



        if(Array.isArray(data)){

            setReceipt(data);

        }else{

            setReceipt([]);

            console.log("Response API bukan array:",data);

        }



    }catch(error){

        console.log("Gagal mengambil data barang masuk",error);

        setReceipt([]);

    }finally{

        setLoading(false);

    }

}



return(


<div className="p-6">


<h1 className="text-2xl font-bold mb-5">

Barang Masuk

</h1>



{loading && (

<p>

Loading data...

</p>

)}



<table className="w-full border">


<thead className="bg-slate-200">


<tr>

<th className="border p-2">
No GR
</th>


<th className="border p-2">
Tanggal
</th>


<th className="border p-2">
Supplier
</th>


<th className="border p-2">
PO
</th>


</tr>


</thead>



<tbody>


{
receipt.length === 0 ? (


<tr>

<td 
colSpan={4}
className="text-center p-4"
>

Belum ada data barang masuk

</td>

</tr>


):(


receipt.map((x:any)=>(


<tr key={x.id}>


<td className="border p-2">

{x.number}

</td>



<td className="border p-2">

{
new Date(x.receiveDate)
.toLocaleDateString("id-ID")
}

</td>



<td className="border p-2">

{
x.supplier?.name ?? "-"
}

</td>



<td className="border p-2">

{
x.purchaseOrder?.poNumber ?? "-"
}

</td>



</tr>


))


)


}



</tbody>


</table>


</div>


)

}