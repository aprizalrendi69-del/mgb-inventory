import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";


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



    const rows = data.map((item)=>({

      "Kode Barang":
      item.barang.code,


      "Nama Barang":
      item.barang.name,


      "Supplier":
      item.supplier.name,


      "Harga Lama":
      item.hargaLama,


      "Harga Baru":
      item.hargaBaru,


      "Selisih":
      item.selisihHarga,


      "Persen":
      item.persenNaik,


      "Qty":
      item.qty,


      "Total":
      item.total,


      "Status":
      item.status,


      "Tanggal":
      item.createdAt

    }));



    const worksheet =
      XLSX.utils.json_to_sheet(rows);



    const workbook =
      XLSX.utils.book_new();


    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Master Harga"
    );


    const buffer =
      XLSX.write(
        workbook,
        {
          type:"buffer",
          bookType:"xlsx"
        }
      );



    return new NextResponse(buffer,{

      headers:{

        "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",


        "Content-Disposition":
        "attachment; filename=master-harga.xlsx"

      }

    });



  }catch(error:any){


    return NextResponse.json({

      success:false,

      message:error.message

    },{
      status:500
    });


  }

}