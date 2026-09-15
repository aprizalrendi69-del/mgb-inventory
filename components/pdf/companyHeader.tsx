import Image from "next/image";


export default function CompanyHeader({
company
}:{
company:any
}){


return (

<div className="flex items-center gap-4 mb-6">


{
company?.logo &&
<img
src={company.logo}
width={80}
height={80}
className="object-contain"
/>
}


<div>

<h1 className="text-xl font-bold">
{company?.name}
</h1>


<p>
{company?.address}
</p>


<p>
{company?.city}
</p>


<p>
Telp : {company?.phone}
</p>


<p>
Email : {company?.email}
</p>


<p>
NPWP : {company?.npwp}
</p>


</div>


</div>


)

}