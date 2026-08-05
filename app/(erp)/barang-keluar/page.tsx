"use client";

import { useEffect, useState } from "react";
import BarcodeInputScanner from "@/components/BarcodeInputScanner";
import CameraBarcodeScanner from "@/components/CameraBarcodeScanner";


export default function BarangKeluarPage(){


const [barang,setBarang] =
useState<any[]>([]);

const [customers,setCustomers] =
useState<any[]>([]);

const [cart,setCart] =
useState<any[]>([]);


const [customer,setCustomer] =
useState("");

const [note,setNote] =
useState("");


const [selectedBarang,setSelectedBarang] =
useState("");

const [qty,setQty] =
useState("");


const [openCamera,setOpenCamera] =
useState(false);


const [scanBarang,setScanBarang] =
useState<any>(null);


const [scanQty,setScanQty] =
useState("1");




async function loadBarang(){

try{

const res =
await fetch("/api/barang");

const json =
await res.json();


setBarang(
Array.isArray(json)
? json
: json.data || []
);


}catch(err){

console.error(err);

}

}




async function loadCustomer(){

try{

const res =
await fetch("/api/customer");


const json =
await res.json();


setCustomers(
Array.isArray(json)
? json
: json.data || []
);


}catch(err){

console.error(err);

}

}




useEffect(()=>{

loadBarang();

loadCustomer();

},[]);





function tambahKeCart(
data:any,
jumlah:number
){


if(jumlah<=0){

return;

}



if(jumlah > data.stock){

alert(
`Stock ${data.name} hanya ${data.stock}`
);

return;

}




setCart(prev=>{


const exist =
prev.find(
x=>x.barangId===data.id
);



if(exist){


return prev.map(x=>{


if(x.barangId===data.id){


const newQty =
x.qty + jumlah;



if(newQty > data.stock){

alert(
"Qty melebihi stock"
);

return x;

}



return {

...x,

qty:newQty,

subtotal:
newQty*x.price

};


}



return x;


});


}




return [

...prev,

{

barangId:data.id,

code:data.code,

name:data.name,

unit:data.unit,

qty:jumlah,

price:
Number(data.sellingPrice || 0),

subtotal:
Number(data.sellingPrice || 0)
*
jumlah,

stock:data.stock,

barcode:data.barcode


}

];


});


}






async function scanBarcode(
barcode:string
){


try{


const res =
await fetch(
`/api/barang/barcode/${barcode}`
);



const json =
await res.json();




if(!json.success){

alert(
json.message
);

return;

}




setScanBarang(
json.data
);


setScanQty("1");



}catch(err){

console.error(err);

alert(
"Barcode gagal diproses"
);

}


}






function tambahDariScan(){


if(!scanBarang){

return;

}



tambahKeCart(

scanBarang,

Number(scanQty)

);



setScanBarang(null);

setScanQty("1");


}






function tambahManual(){


const data =
barang.find(
b=>b.id===Number(selectedBarang)
);



if(!data){

alert(
"Pilih barang"
);

return;

}



tambahKeCart(
data,
Number(qty)
);



setSelectedBarang("");

setQty("");

}






function hapus(index:number){


setCart(
cart.filter(
(_,i)=>i!==index
)
);


}




async function simpan(){


if(cart.length===0){

alert(
"Belum ada barang"
);

return;

}


const res =
await fetch(
"/api/barang-keluar",
{

method:"POST",

headers:{
"Content-Type":
"application/json"
},


body:JSON.stringify({

customerId:
Number(customer),

note,

items:
cart.map(item=>({

barangId:
item.barangId,

qty:
item.qty

}))

})


}

);



const json =
await res.json();



if(json.success){


alert(
"Barang keluar berhasil"
);


setCart([]);

setCustomer("");

setNote("");


}else{


alert(
json.message ||
"Gagal simpan"
);


}


}



const totalQty =
cart.reduce(
(a,b)=>a+b.qty,
0
);



const totalNominal =
cart.reduce(
(a,b)=>a+b.subtotal,
0
);
return (

<div className="p-8">


<h1 className="text-3xl font-bold mb-6">
Barang Keluar
</h1>



<div className="bg-white shadow rounded-xl p-6">



{
scanBarang && (

<div className="
fixed
inset-0
bg-black/50
flex
items-center
justify-center
z-50
">


<div className="
bg-white
rounded-xl
p-6
w-96
">


<h2 className="
text-xl
font-bold
mb-4
">

Detail Barang

</h2>



<p>
Kode :
<b>
{" "}
{scanBarang.code}
</b>
</p>



<p>
Barcode :
<b>
{" "}
{scanBarang.barcode}
</b>
</p>



<p>
Nama :
<b>
{" "}
{scanBarang.name}
</b>
</p>



<p>
Stock :
<b>
{" "}
{scanBarang.stock}
</b>
</p>



<p>
Satuan :
<b>
{" "}
{scanBarang.unit}
</b>
</p>



<div className="mt-4">


<label>
Qty Keluar
</label>


<input

type="number"

className="
border
w-full
p-3
rounded
"

value={scanQty}

onChange={
e=>setScanQty(e.target.value)
}


/>


</div>





<div className="
flex
gap-3
mt-5
">


<button

onClick={tambahDariScan}

className="
bg-blue-600
text-white
px-5
py-2
rounded
"

>

Tambah

</button>




<button

onClick={()=>setScanBarang(null)}

className="
bg-gray-500
text-white
px-5
py-2
rounded
"

>

Batal

</button>



</div>



</div>


</div>

)

}





<div className="mb-6">


<label className="
font-semibold
block
mb-2
">

Scan Barcode Barang

</label>




<div className="
flex
gap-3
">


<div className="flex-1">


<BarcodeInputScanner

onScan={scanBarcode}

/>


</div>



<button

onClick={()=>
setOpenCamera(true)
}

className="
bg-purple-600
text-white
px-5
rounded-lg
"

>

📷 Scan Kamera

</button>


</div>




{
openCamera && (


<div className="
mt-5
bg-black
rounded-xl
p-4
">


<p className="
text-white
mb-3
">

Arahkan kamera ke barcode

</p>



<CameraBarcodeScanner

onScan={(barcode)=>{


setOpenCamera(false);

scanBarcode(barcode);


}}


/>



<button

onClick={()=>
setOpenCamera(false)
}

className="
mt-3
bg-red-500
text-white
px-5
py-2
rounded
"

>

Tutup Kamera

</button>



</div>


)

}



</div>







<div className="
grid
grid-cols-2
gap-4
mb-6
">


<div>


<label>
Customer
</label>



<select

className="
border
w-full
p-3
rounded
"

value={customer}

onChange={
e=>setCustomer(e.target.value)
}

>


<option value="">
-- Pilih Customer --
</option>



{
customers.map(c=>(

<option

key={c.id}

value={c.id}

>

{c.code} - {c.name}

</option>

))

}


</select>


</div>





<div>


<label>
Keterangan
</label>



<input

className="
border
w-full
p-3
rounded
"

value={note}

onChange={
e=>setNote(e.target.value)
}

placeholder="Keterangan"

/>


</div>



</div>







<div className="
flex
gap-3
mb-6
">


<select

className="
border
p-3
rounded
flex-1
"

value={selectedBarang}

onChange={
e=>setSelectedBarang(e.target.value)
}

>


<option value="">
-- Pilih Barang --
</option>



{
barang.map(b=>(

<option

key={b.id}

value={b.id}

>

{b.code} - {b.name}
| Stock {b.stock}

</option>

))

}



</select>





<input

type="number"

className="
border
p-3
w-32
rounded
"

placeholder="Qty"

value={qty}

onChange={
e=>setQty(e.target.value)
}

/>




<button

onClick={tambahManual}

className="
bg-green-600
text-white
px-5
rounded
"

>

Tambah

</button>



</div>







<table className="w-full border">


<thead className="bg-gray-100">

<tr>


<th className="border p-2">
Barang
</th>


<th className="border p-2">
Stock
</th>


<th className="border p-2">
Qty
</th>


<th className="border p-2">
Harga
</th>


<th className="border p-2">
Total
</th>


<th className="border p-2">
Aksi
</th>


</tr>


</thead>



<tbody>


{

cart.map((item,index)=>(


<tr key={index}>


<td className="border p-2">
{item.name}
</td>


<td className="border p-2 text-center">
{item.stock}
</td>


<td className="border p-2 text-center">
{item.qty}
</td>


<td className="border p-2 text-right">

Rp {item.price.toLocaleString("id-ID")}

</td>


<td className="border p-2 text-right">

Rp {item.subtotal.toLocaleString("id-ID")}

</td>


<td className="border p-2 text-center">


<button

onClick={()=>
hapus(index)
}

className="
bg-red-500
text-white
px-3
py-1
rounded
"

>

Hapus

</button>


</td>


</tr>


))


}



</tbody>


</table>







<div className="
mt-6
text-right
">


<p>
Total Qty :
<b>
{" "}
{totalQty}
</b>
</p>



<p className="
text-2xl
font-bold
">

Total :
Rp {totalNominal.toLocaleString("id-ID")}

</p>



</div>







<button

onClick={simpan}

className="
mt-6
bg-blue-600
text-white
px-8
py-3
rounded-lg
"

>

Simpan Barang Keluar

</button>



</div>


</div>


);


}