"use client";


import {useRouter} from "next/navigation";


export default function Navbar(){


const router = useRouter();



async function logout(){


await fetch("/api/logout",{
method:"POST"
});


router.push("/login");


}



return (

<header className="
h-16
bg-white
border-b
flex
items-center
justify-between
px-6
">


<h1 className="font-semibold text-xl">

Dashboard

</h1>


<button

onClick={logout}

className="
bg-red-600
text-white
px-4
py-2
rounded
">

Logout

</button>


</header>

)


}