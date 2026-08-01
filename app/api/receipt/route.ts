import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function POST(
    req:NextRequest
){

    try{


        const body = await req.json();


        const {
            purchaseId,
            items
        } = body;



        const purchase =
        await prisma.purchase.findUnique({

            where:{
                id:Number(purchaseId)
            },

            include:{
                supplier:true,
                items:true
            }

        });



        if(!purchase){

            return NextResponse.json({

                success:false,

                message:"Purchase Order tidak ditemukan"

            },{
                status:404
            });

        }




        if(
            purchase.status !== "APPROVED"
        ){

            return NextResponse.json({

                success:false,

                message:
                "Purchase harus APPROVED terlebih dahulu"

            });

        }




        const receipt =
        await prisma.receipt.create({

            data:{


                purchaseId:
                purchase.id,


                supplierId:
                purchase.supplierId,


                receiptDate:
                new Date(),



                items:{

                    create:

                    items.map(
                        (item:any)=>({

                            barangId:
                            Number(item.barangId),


                            qty:
                            Number(item.qty)

                        })

                    )

                }

            },

            include:{

                items:true

            }

        });







        for(
            const item of items
        ){


            await prisma.inventory.upsert({

                where:{

                    barangId:
                    Number(item.barangId)

                },


                update:{


                    qty:
                    {

                        increment:
                        Number(item.qty)

                    }

                },


                create:{


                    barangId:
                    Number(item.barangId),


                    qty:
                    Number(item.qty)


                }


            });




            await prisma.stockCard.create({

                data:{


                    barangId:
                    Number(item.barangId),


                    type:
                    "IN",


                    qty:
                    Number(item.qty),


                    reference:
                    `RECEIVE-${receipt.id}`


                }

            });





            await prisma.mutation.create({

                data:{


                    barangId:
                    Number(item.barangId),


                    type:
                    "BARANG MASUK",


                    qty:
                    Number(item.qty),


                    reference:
                    `RECEIVE-${receipt.id}`


                }

            });



        }





        await prisma.purchase.update({

            where:{

                id:
                purchase.id

            },


            data:{

                status:
                "RECEIVED"

            }

        });





        return NextResponse.json({

            success:true,

            message:
            "Barang berhasil diterima",


            data:
            receipt

        });




    }
    catch(error){


        console.log(error);



        return NextResponse.json({

            success:false,

            message:
            "Gagal Receive Barang"

        },{
            status:500
        });



    }


}