"use client";

import { useEffect, useState } from "react";


export default function BarangMasukPage() {


  const [purchase,setPurchase] = useState<any[]>([]);
  const [selected,setSelected] = useState<any>(null);

  const [qty,setQty] = useState<any>({});
  const [expired,setExpired] = useState<any>({});

  const [loading,setLoading] = useState(false);




  async function loadPurchase(){

    try{

      const res = await fetch("/api/purchase");

      const json = await res.json();


      const purchases = Array.isArray(json)
      ?
      json
      :
      json.data ?? [];



      const approved =
      purchases.filter(
        (p:any)=>
        p.status==="APPROVED"
      );


      setPurchase(approved);


    }
    catch(err){

      console.error(err);

      setPurchase([]);

    }

  }




  useEffect(()=>{

    loadPurchase();

  },[]);






  function pilihPO(po:any){


    setSelected(po);


    const q:any={};

    const e:any={};



    po.items.forEach((item:any)=>{


      q[item.barangId]=item.qty;


      e[item.barangId]="";


    });



    setQty(q);

    setExpired(e);


  }







  async function receive(){


    if(!selected){

      alert(
        "Pilih Purchase Order terlebih dahulu"
      );

      return;

    }



    setLoading(true);



    try{


      const items =
      selected.items.map((item:any)=>({


        barangId:
        item.barangId,


        qty:
        Number(qty[item.barangId]),


        price:
        Number(item.price),


        expiredDate:
        expired[item.barangId] || null


      }));






      const res =
      await fetch(
        "/api/goods-receipt",
        {

          method:"POST",

          headers:{
            "Content-Type":"application/json"
          },

          body:JSON.stringify({

            purchaseId:
            selected.id,

            items

          })

        }
      );





      const json =
      await res.json();





      if(json.success){


        alert(
          "Barang berhasil diterima"
        );


        setSelected(null);

        setQty({});

        setExpired({});


        loadPurchase();



      }
      else{


        alert(
          json.message ??
          "Gagal menerima barang"
        );


      }



    }
    catch(err){


      console.error(err);

      alert(
        "Terjadi kesalahan"
      );


    }



    setLoading(false);


  }








return(

<div className="p-8">


<h1 className="text-3xl font-bold mb-6">
Barang Masuk / Goods Receipt
</h1>





<div className="grid md:grid-cols-2 gap-6">





<div className="bg-white rounded-xl shadow p-5">


<h2 className="text-xl font-bold mb-4">
Purchase Approved
</h2>



{
purchase.length===0
?

<p>
Tidak ada Purchase yang menunggu penerimaan.
</p>

:

purchase.map((po:any)=>(


<div

key={po.id}

onClick={()=>pilihPO(po)}

className={`border rounded-lg p-4 mb-3 cursor-pointer ${
selected?.id===po.id
?
"border-blue-600 bg-blue-50"
:
"hover:bg-gray-50"
}`}

>


<div className="font-bold">
{po.number}
</div>


<div>
Supplier : {po.supplier?.name}
</div>


<div>
Status : {po.status}
</div>


<div>
Total Item : {po.items.length}
</div>


</div>


))

}



</div>







<div className="bg-white rounded-xl shadow p-5">


<h2 className="text-xl font-bold mb-4">
Detail Receive
</h2>



{
!selected

?

<p>
Pilih Purchase Order.
</p>


:

<>


<div className="mb-5 font-semibold">
{selected.number}
</div>




{
selected.items.map((item:any)=>(


<div

key={item.id}

className="border-b py-4"

>


<div className="font-bold">

{item.barang?.name}

</div>


<div>
Qty Order : {item.qty}
</div>





<input

type="number"

className="border rounded p-2 w-32 mt-2"

value={
qty[item.barangId] ?? ""
}

onChange={(e)=>

setQty({

...qty,

[item.barangId]:
e.target.value

})

}

/>





{


item.barang?.hasExpired

&&


<div className="mt-3">


<label className="block font-semibold">

Expired Date

</label>



<input

type="date"

className="border rounded p-2"

value={
expired[item.barangId] ?? ""
}

onChange={(e)=>

setExpired({

...expired,

[item.barangId]:
e.target.value

})

}

/>



</div>



}





</div>


))

}





<button

onClick={receive}

disabled={loading}

className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg disabled:bg-gray-400"

>


{
loading
?
"Memproses..."
:
"Terima Barang"
}


</button>



</>

}



</div>



</div>


</div>

)


}