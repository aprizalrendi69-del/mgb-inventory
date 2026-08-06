"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  Package,
  Users,
  Truck,
  Boxes,
  AlertTriangle,
  DollarSign,
  ShoppingCart,
} from "lucide-react";


export default function Dashboard() {


const [data,setData] = useState<any>(null);



useEffect(()=>{

fetch("/api/dashboard")

.then(res=>res.json())

.then(result=>{

setData(result);

})

.catch(console.error);


},[]);



if(!data){

return (

<div className="p-8 flex justify-center items-center h-[70vh]">

<div className="text-xl font-semibold">

Loading Dashboard...

</div>

</div>

)

}




const cards=[

{
title:"Total Barang",
value:(data.totalBarang ?? 0).toLocaleString(),
icon:<Package size={40}/>
},


{
title:"Total Supplier",
value:(data.totalSupplier ?? 0).toLocaleString(),
icon:<Truck size={40}/>
},


{
title:"Total Customer",
value:(data.totalCustomer ?? 0).toLocaleString(),
icon:<Users size={40}/>
},


{
title:"Total Stock",
value:(data.totalStock ?? 0).toLocaleString(),
icon:<Boxes size={40}/>
},


{
title:"Barang Sold",
value:(data.barangSold ?? 0).toLocaleString(),
icon:<ShoppingCart size={40}/>
},


{
title:"Limit Stock",
value:(data.limitStock ?? 0).toLocaleString(),
icon:<AlertTriangle size={40}/>
},


{
title:"Nilai Inventory",
value:"Rp "+(data.inventory ?? 0).toLocaleString("id-ID"),
icon:<DollarSign size={40}/>
},


];





const menus=[

{
title:"📦 Barang",
href:"/master-barang"
},

{
title:"🏭 Supplier",
href:"/supplier"
},

{
title:"👥 Customer",
href:"/customer"
},

{
title:"🛒 Purchase",
href:"/purchase"
},

{
title:"🚚 Delivery",
href:"/surat-jalan"
},

{
title:"📦 Inventory",
href:"/inventory"
},

{
title:"📊 Laporan",
href:"/laporan"
},

];





return (

<div className="p-8 bg-slate-100 min-h-screen">



{/* HEADER */}

<div className="flex justify-between items-center mb-8">


<div>

<h1 className="text-3xl font-bold text-green-700">

Dashboard ERP

</h1>


<p className="text-gray-600">

PT. Mitra Garam Bogatama

</p>


</div>



<div className="text-right">

<div className="text-gray-500">

Hari Ini

</div>


<div className="font-bold">

{
new Date().toLocaleDateString("id-ID",{

weekday:"long",
day:"2-digit",
month:"long",
year:"numeric"

})
}

</div>


</div>


</div>






{/* CARD */}


<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mt-8">


{
cards.map((item,index)=>(


<div

key={index}

className="rounded-2xl bg-gradient-to-r from-green-600 to-green-700 text-white shadow-xl p-6 hover:scale-105 transition"

>


<div className="flex justify-between items-center">


<div>


<p className="text-green-100">

{item.title}

</p>


<h2 className="text-4xl font-bold mt-3">

{item.value}

</h2>


</div>


<div>

{item.icon}

</div>


</div>


</div>


))

}


</div>






{/* DETAIL */}


<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">



<div className="bg-white rounded-2xl shadow p-6">


<h2 className="font-bold text-xl mb-4">

Informasi Inventory

</h2>



<div className="space-y-3">


<div className="flex justify-between">

<span>Total Stock</span>

<span className="font-bold">

{data.totalStock ?? 0}

</span>


</div>



<div className="flex justify-between">


<span>Nilai Inventory</span>


<span className="font-bold text-green-700">

Rp {(data.inventory ?? 0).toLocaleString("id-ID")}

</span>


</div>




<div className="flex justify-between">


<span>Limit Stock</span>


<span className="font-bold text-red-600">

{data.limitStock ?? 0}

</span>


</div>


</div>


</div>





<div className="bg-white rounded-2xl shadow p-6">


<h2 className="font-bold text-xl mb-4">

Ringkasan

</h2>


<ul className="space-y-3">


<li>
Total Barang : {data.totalBarang ?? 0}
</li>


<li>
Total Supplier : {data.totalSupplier ?? 0}
</li>


<li>
Total Customer : {data.totalCustomer ?? 0}
</li>


<li>
Barang Sold : {data.barangSold ?? 0}
</li>


</ul>


</div>


</div>







{/* QUICK MENU */}


<div className="mt-8">


<h2 className="text-2xl font-bold mb-5">

Quick Menu

</h2>



<div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-5">


{

menus.map(menu=>(


<Link

key={menu.title}

href={menu.href}

className="bg-white rounded-xl shadow-lg p-6 text-center hover:bg-green-600 hover:text-white transition"

>


<h3 className="font-semibold">

{menu.title}

</h3>


</Link>


))


}


</div>


</div>







{/* AKTIVITAS TERBARU */}



<div className="mt-8 bg-white rounded-2xl shadow-lg p-6">


<h2 className="text-2xl font-bold mb-5">

Aktivitas Terbaru

</h2>




<table className="w-full text-sm">


<thead>


<tr className="bg-slate-100">


<th className="p-3 text-left">
Tanggal
</th>


<th className="p-3 text-left">
Aktivitas
</th>


<th className="p-3 text-left">
Nomor
</th>

<th className="p-3 text-left">
User
</th>


</tr>


</thead>



<tbody>


{

data.history?.length > 0 ?

data.history.map((item:any,index:number)=>(


<tr
key={index}
className="border-b"
>


<td className="p-3">

{
new Date(item.createdAt ?? item.date)
.toLocaleDateString("id-ID")
}

</td>


<td className="p-3">

{item.description ?? item.activity ?? item.type ?? "-"}

</td>


<td className="p-3">

{item.number ?? "-"}

</td>

<td className="p-3">

{item.user?.fullname ?? item.user?.username ?? "-"}

</td>

</tr>


))


:


<tr>

<td
colSpan={4}
className="p-5 text-center text-gray-500"
>
Belum ada aktivitas
</td>

</tr>


}


</tbody>


</table>

</div>

{/* PANEL ERP */}

<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">


{/* STOCK MINIMUM */}

<div className="bg-white rounded-2xl shadow-lg p-6">


<h2 className="text-xl font-bold text-red-600 mb-5">

🔴 Stock Minimum

</h2>



<div className="space-y-3">


{

data.stockMinimum?.length > 0 ?


data.stockMinimum.map((item:any)=>(


<div

key={item.id}

className="flex justify-between border-b pb-2"

>


<div>


<div className="font-semibold">

{item.name}

</div>


<div className="text-sm text-gray-500">

{item.code}

</div>


</div>



<div className="text-right">

<div className="font-bold text-red-600">
Stock : {item.stock}
</div>

<div className="text-xs text-gray-500">
Min : {item.minimumStock ?? "-"}
</div>

</div>


</div>


))


:


<div className="text-gray-500">

Stock aman

</div>


}



</div>


</div>








{/* PURCHASE PENDING */}


<div className="bg-white rounded-2xl shadow-lg p-6">


<h2 className="text-xl font-bold text-yellow-600 mb-5">

🟡 Purchase Pending

</h2>



<div className="space-y-3">


{

data.purchasePending?.length > 0 ?


data.purchasePending.map((item:any)=>(


<div

key={item.id}

className="border-b pb-2"

>


<div className="font-semibold">

{item.number}

</div>



<div className="text-sm">

{item.supplier?.name ?? "-"}

</div>



<div className="text-yellow-600 text-sm">

{item.status}

</div>


</div>


))


:


<div className="text-gray-500">

Tidak ada PO pending

</div>


}



</div>


</div>








{/* DELIVERY PENDING */}


<div className="bg-white rounded-2xl shadow-lg p-6">


<h2 className="text-xl font-bold text-blue-600 mb-5">

🔵 Delivery Pending

</h2>




<div className="space-y-3">


{

data.deliveryPending?.length > 0 ?


data.deliveryPending.map((item:any)=>(


<div

key={item.id}

className="border-b pb-2"

>


<div className="font-semibold">

{item.number}

</div>



<div className="text-sm">

{item.customer?.name ?? "-"}

</div>



<div className="text-blue-600 text-sm">

{item.status}

</div>


</div>


))


:


<div className="text-gray-500">

Tidak ada delivery pending

</div>


}

</div>

</div>


<div className="bg-white rounded-2xl shadow-lg p-6">

<h2 className="text-xl font-bold text-orange-600 mb-5">

🟠 Barang Expired

</h2>

{
data.expired?.length > 0 ?

data.expired.map((item:any)=>(

<div
key={item.id}
className="border-b pb-3 mb-3"
>

<div className="flex justify-between">

<div>

<div className="font-semibold">

{item.name}

</div>

<div className="text-sm text-gray-500">

Batch : {item.batch}

</div>

<div className="text-sm text-gray-500">

Qty : {item.qty}

</div>

</div>

<div className="text-right">

{

item.status==="EXPIRED"

?

<span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs">

EXPIRED

</span>

:

<span className="bg-yellow-500 text-white px-3 py-1 rounded-full text-xs">

WARNING

</span>

}

<div className="mt-2 text-sm">

{
new Date(item.expired)
.toLocaleDateString("id-ID")
}

</div>

<div className="text-xs text-gray-500">

{

item.status==="EXPIRED"

?

`${Math.abs(item.sisaHari)} Hari Lewat`

:

`${item.sisaHari} Hari Lagi`

}

</div>

</div>

</div>

</div>

))

:

<div className="text-green-600 font-semibold">

✅ Tidak ada barang expired

</div>

}

</div>

</div>

</div>


)
}