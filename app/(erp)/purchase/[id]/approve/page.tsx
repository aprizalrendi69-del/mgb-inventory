"use client";

import {useRouter,useParams} from "next/navigation";

export default function ApprovePage(){

const router=useRouter();

const params=useParams();

async function approve(){

await fetch(

"/api/purchase/"+params.id+"/approve",

{

method:"PUT"

}

);

router.push("/purchase");

}

return(

<div className="p-8">

<h1 className="text-3xl font-bold mb-6">

Approve Purchase Order

</h1>

<p className="mb-6">

Apakah Purchase Order ini akan disetujui?

</p>

<div className="flex gap-3">

<button

onClick={approve}

className="bg-green-600 text-white px-6 py-2 rounded"

>

Approve

</button>

<button

onClick={()=>router.back()}

className="bg-gray-500 text-white px-6 py-2 rounded"

>

Batal

</button>

</div>

</div>

);

}