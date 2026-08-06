import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


export async function GET(){

  try {


    const data =
      await prisma.masterHarga.findMany({

        orderBy:{
          createdAt:"desc"
        },

        include:{
          barang:true,
          supplier:true
        }

      });



    const doc = new jsPDF("landscape");


    doc.setFontSize(16);

    doc.text(
      "Laporan Master Harga",
      14,
      15
    );



    const rows =
    data.map((item)=>[

      item.barang.code,

      item.barang.name,

      item.supplier.name,

      item.hargaLama.toLocaleString("id-ID"),

      item.hargaBaru.toLocaleString("id-ID"),

      item.selisihHarga.toLocaleString("id-ID"),

      item.persenNaik.toFixed(2)+"%",

      item.qty,

      item.status,

    ]);



    autoTable(doc,{

      startY:25,

      head:[[
        "Kode",
        "Barang",
        "Supplier",
        "Harga Lama",
        "Harga Baru",
        "Selisih",
        "%",
        "Qty",
        "Status"
      ]],


      body:rows

    });



    const buffer =
      Buffer.from(
        doc.output("arraybuffer")
      );



    return new NextResponse(buffer,{

      headers:{

        "Content-Type":
        "application/pdf",


        "Content-Disposition":
        "attachment; filename=master-harga.pdf"

      }

    });



  }
  catch(error:any){

    console.error(error);


    return NextResponse.json({

      success:false,

      message:error.message

    },{
      status:500
    });

  }

}