"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";


const menus = [

{
 title:"Dashboard",
 url:"/dashboard",
 roles:["ADMIN","MANAGER","PURCHASING","GUDANG"]
},


{
 title:"MASTER DATA",
 header:true
},

{
 title:"Master Barang",
 url:"/master-barang",
 roles:["ADMIN","PURCHASING"]
},

{
 title:"Master Supplier",
 url:"/supplier",
 roles:["ADMIN","PURCHASING"]
},

{
 title:"Master Customer",
 url:"/customer",
 roles:["ADMIN"]
},

{
 title:"Master User",
 url:"/master/user",
 roles:["ADMIN"]
},



{
 title:"PURCHASE",
 header:true
},


{
 title:"Purchase Order",
 url:"/purchase",
 roles:["ADMIN","PURCHASING"]
},


{
 title:"Approval Purchase",
 url:"/purchase/approve",
 roles:["ADMIN","MANAGER"]
},


{
 title:"Barang Masuk",
 url:"/barang-masuk",
 roles:["ADMIN","GUDANG"]
},


{
 title:"Print Purchase",
 url:"/purchase/print",
 roles:["ADMIN","PURCHASING"]
},



{
 title:"GUDANG",
 header:true
},


{
 title:"Expired Barang",
 url:"/expired",
 roles:["ADMIN","GUDANG"]
},


{
 title:"Barang Keluar",
 url:"/barang-keluar",
 roles:["ADMIN","GUDANG"]
},


{
 title:"Stock Card",
 url:"/stock-card",
 roles:["ADMIN","GUDANG"]
},


{
 title:"Mutasi Stock",
 url:"/mutasi-stock",
 roles:["ADMIN","GUDANG"]
},


{
 title:"Stock Opname",
 url:"/stock-opname",
 roles:["ADMIN","GUDANG"]
},


{
 title:"Adjustment Stock",
 url:"/adjustment",
 roles:["ADMIN","GUDANG"]
},


{
 title:"History Stock",
 url:"/history",
 roles:["ADMIN","GUDANG"]
},




{
 title:"PENJUALAN",
 header:true
},


{
 title:"Delivery Order",
 url:"/pengiriman",
 roles:["ADMIN"]
},


{
 title:"Surat Jalan",
 url:"/surat-jalan",
 roles:["ADMIN","GUDANG"]
},




{
 title:"INVENTORY",
 header:true
},


{
 title:"Inventory",
 url:"/inventory",
 roles:["ADMIN","MANAGER","GUDANG"]
},




{
 title:"LAPORAN",
 header:true
},


{
 title:"Laporan Purchase",
 url:"/laporan/purchase",
 roles:["ADMIN","MANAGER","PURCHASING"]
},


{
 title:"Laporan Barang Masuk",
 url:"/laporan/barang-masuk",
 roles:["ADMIN","MANAGER","GUDANG"]
},


{
 title:"Laporan Barang Keluar",
 url:"/laporan/barang-keluar",
 roles:["ADMIN","MANAGER","GUDANG"]
},


{
 title:"Laporan Inventory",
 url:"/laporan/inventory",
 roles:["ADMIN","MANAGER"]
},


{
 title:"Laporan Supplier",
 url:"/laporan/supplier",
 roles:["ADMIN","MANAGER","PURCHASING"]
},


{
 title:"Laporan Customer",
 url:"/laporan/customer",
 roles:["ADMIN","MANAGER"]
},



{
 title:"SETTING",
 header:true
},


{
 title:"Pengaturan",
 url:"/setting",
 roles:["ADMIN"]
}

];





export default function Sidebar({

user

}:{

user:any

}){


const pathname = usePathname();



const allowedMenus = menus.filter(menu=>{

if(menu.header) return true;


return menu.roles?.includes(user?.role);

});



return (

<aside
className="
w-72
h-screen
bg-slate-900
text-white
overflow-y-auto
border-r
border-slate-700
"
>


<div
className="
p-6
border-b
border-slate-700
"
>


<h1
className="
text-xl
font-bold
"
>
PT. MITRA GARAM BOGATAMA
</h1>


<p
className="
text-sm
text-slate-400
mt-2
"
>
ERP Inventory System
</p>


<p className="text-xs mt-3 text-blue-400">
Login : {user?.fullname}
<br/>
Role : {user?.role}
</p>


</div>



<nav className="p-4">


{
allowedMenus.map((menu,index)=>{


if(menu.header){

return (

<div
key={index}
className="
text-xs
uppercase
text-slate-400
font-bold
mt-6
mb-3
"
>

{menu.title}

</div>

)

}



const active =
pathname === menu.url;



return (

<Link

key={index}

href={menu.url!}

className={`
block
rounded-lg
px-4
py-3
mb-2
transition

${
active
?
"bg-blue-600"
:
"text-slate-200 hover:bg-slate-800"
}

`}

>

{menu.title}

</Link>

)


})

}


</nav>


</aside>


)

}