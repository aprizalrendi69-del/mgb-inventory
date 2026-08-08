"use client";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";


export default function ERPLayout({

  children,

}: {

  children: React.ReactNode;

}) {


  const router = useRouter();

  const [user,setUser] = useState<any>(null);



  useEffect(()=>{

    loadUser();

  },[]);



  async function loadUser(){

    const res = await fetch("/api/me");

    const data = await res.json();


    if(!data.success){

      router.push("/login");
      return;

    }


    setUser(data.user);

  }



  if(!user){

    return (

      <div className="p-10">

        Loading...

      </div>

    );

  }



  return (

    <div className="flex">

      <Sidebar user={user}/>


      <div className="flex-1 bg-slate-100 min-h-screen">


        <div className="p-6">


          <Header />


          {children}


        </div>


      </div>


    </div>

  );

}