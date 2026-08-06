import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {

    const data = await prisma.masterHarga.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        barang: true,
        supplier: true,
      },
    });


    const totalBarang = new Set(
      data.map((item) => item.barangId)
    ).size;


    const perubahan = data.filter(
      (item) => item.selisihHarga !== 0
    );


    const hargaNaik = perubahan
      .filter(
        (item) => item.selisihHarga > 0
      )[0] || null;


    const hargaTurun = perubahan
      .filter(
        (item) => item.selisihHarga < 0
      )[0] || null;


    const kenaikanTerbesar =
      perubahan
        .filter(
          (item)=>item.selisihHarga > 0
        )
        .sort(
          (a,b)=>
            b.selisihHarga - a.selisihHarga
        )[0] || null;


    const penurunanTerbesar =
      perubahan
        .filter(
          (item)=>item.selisihHarga < 0
        )
        .sort(
          (a,b)=>
            a.selisihHarga - b.selisihHarga
        )[0] || null;



    return NextResponse.json({

      success:true,

      data:{
        totalBarang,

        totalPerubahan:
          perubahan.length,

        hargaNaikTerakhir:
          hargaNaik,

        hargaTurunTerakhir:
          hargaTurun,

        kenaikanTerbesar,

        penurunanTerbesar,
      }

    });


  } catch(error:any){

    console.error(error);

    return NextResponse.json(
      {
        success:false,
        message:error.message
      },
      {
        status:500
      }
    );

  }
}