import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DeliveryStatus, HistoryType } from "@prisma/client";

export async function GET() {
  try {
    const data = await prisma.delivery.findMany({
      select: {
        id: true,
        number: true,
        deliveryDate: true,
        status: true,
        totalQty: true,
        remarks: true,

        customer: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },

        suratJalan: {
          select: {
            id: true,
            number: true,
          },
        },

        items: {
          select: {
            id: true,
            qty: true,
            price: true,
            subtotal: true,
            note: true,

            barang: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,

                priceSummary: {
                  select: {
                    lastPrice: true,
                  },
                },
              },
            },
          },
        },
      },

      orderBy: {
        deliveryDate: "desc",
      },
    });

    /*
     * Kalau DeliveryItem.price masih 0,
     * gunakan PriceSummary.lastPrice.
     */
    const result = data.map((delivery) => {
      const items = delivery.items.map((item) => {
        const dbPrice = Number(item.price ?? 0);

        const summaryPrice = Number(
          item.barang?.priceSummary?.lastPrice ?? 0
        );

        const price =
          dbPrice > 0
            ? dbPrice
            : summaryPrice;

        const subtotal =
          Number(item.qty ?? 0) * price;

        return {
          ...item,

          price,

          subtotal,
        };
      });

      const totalValue = items.reduce(
        (sum, item) =>
          sum + Number(item.subtotal ?? 0),
        0
      );

      return {
        ...delivery,

        items,

        totalValue,
      };
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("GET DELIVERY ORDER ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil Delivery Order",
      },
      {
        status: 500,
      }
    );
  }
}

/*
|--------------------------------------------------------------------------
| POST - Buat Delivery Order
|--------------------------------------------------------------------------
*/
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.customerId) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer wajib dipilih",
        },
        {
          status: 400,
        }
      );
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Barang belum dipilih",
        },
        {
          status: 400,
        }
      );
    }

    let totalQty = 0;

    /*
    |--------------------------------------------------------------------------
    | VALIDASI BARANG & STOCK
    |--------------------------------------------------------------------------
    */

    for (const item of body.items) {
      const barang = await prisma.barang.findUnique({
        where: {
          id: Number(item.barangId),
        },
      });

      if (!barang) {
        return NextResponse.json(
          {
            success: false,
            message: `Barang dengan ID ${item.barangId} tidak ditemukan`,
          },
          {
            status: 404,
          }
        );
      }

      const qty = Number(item.qty);

      if (!qty || qty <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Qty ${barang.name} tidak valid`,
          },
          {
            status: 400,
          }
        );
      }

      if (barang.stock < qty) {
        return NextResponse.json(
          {
            success: false,
            message: `Stock ${barang.name} tidak mencukupi. Stock tersedia: ${barang.stock}`,
          },
          {
            status: 400,
          }
        );
      }

      totalQty += qty;
    }

    /*
    |--------------------------------------------------------------------------
    | NOMOR DELIVERY ORDER
    |--------------------------------------------------------------------------
    */

    const number =
      "DO-" +
      new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "") +
      "-" +
      Date.now();

    /*
    |--------------------------------------------------------------------------
    | BUAT DELIVERY ITEMS
    |--------------------------------------------------------------------------
    */

    const deliveryItems = await Promise.all(
      body.items.map(async (item: any) => {
        const barangId = Number(item.barangId);
        const qty = Number(item.qty);

        /*
        |--------------------------------------------------------------------------
        | AMBIL DATA BARANG
        |--------------------------------------------------------------------------
        */

        const barang = await prisma.barang.findUnique({
          where: {
            id: barangId,
          },
        });

        if (!barang) {
          throw new Error(
            `Barang ID ${barangId} tidak ditemukan`
          );
        }

        /*
        |--------------------------------------------------------------------------
        | 1. COBA PRICE SUMMARY
        |--------------------------------------------------------------------------
        */

        const summary =
          await prisma.priceSummary.findUnique({
            where: {
              barangId,
            },
          });

        let harga = Number(
          summary?.lastPrice ?? 0
        );

        /*
        |--------------------------------------------------------------------------
        | 2. FALLBACK KE SELLING PRICE BARANG
        |--------------------------------------------------------------------------
        */

        if (harga <= 0) {
          harga = Number(
            barang.sellingPrice ?? 0
          );
        }

        /*
        |--------------------------------------------------------------------------
        | 3. FALLBACK KE MASTER HARGA TERBARU
        |--------------------------------------------------------------------------
        */

        if (harga <= 0) {
          const masterHarga =
            await prisma.masterHarga.findFirst({
              where: {
                barangId,
              },
              orderBy: {
                createdAt: "desc",
              },
            });

          if (masterHarga) {
            harga = Number(
              masterHarga.hargaBaru ?? 0
            );
          }
        }

        /*
        |--------------------------------------------------------------------------
        | HITUNG SUBTOTAL
        |--------------------------------------------------------------------------
        */

        const subtotal =
          harga * qty;

        console.log(
          "DELIVERY PRICE:",
          {
            barangId,
            barang: barang.name,
            priceSummary: summary?.lastPrice,
            sellingPrice: barang.sellingPrice,
            finalPrice: harga,
            qty,
            subtotal,
          }
        );

        return {
          barangId,
          qty,
          price: harga,
          subtotal,
          note: item.note ?? null,
        };
      })
    );

    /*
    |--------------------------------------------------------------------------
    | BUAT DELIVERY
    |--------------------------------------------------------------------------
    */

    const delivery =
      await prisma.delivery.create({
        data: {
          number,
          customerId: Number(
            body.customerId
          ),

          deliveryDate:
            body.deliveryDate
              ? new Date(body.deliveryDate)
              : new Date(),

          remarks:
            body.remarks ?? null,

          totalQty,

          status:
            DeliveryStatus.DRAFT,

          items: {
            create: deliveryItems,
          },
        },

        include: {
          customer: true,

          items: {
            include: {
              barang: true,
            },
          },
        },
      });

    /*
    |--------------------------------------------------------------------------
    | HISTORY
    |--------------------------------------------------------------------------
    */

    await prisma.history.create({
      data: {
        transactionType:
          HistoryType.DELIVERY,

        referenceNumber:
          delivery.number,

        description:
          `Membuat Delivery Order ${delivery.number}`,
      },
    });

    /*
    |--------------------------------------------------------------------------
    | RESPONSE
    |--------------------------------------------------------------------------
    */

    return NextResponse.json({
      success: true,
      message:
        "Delivery Order berhasil dibuat",

      data: delivery,
    });
  } catch (error) {
    console.error(
      "CREATE DELIVERY ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal membuat Delivery Order",
      },
      {
        status: 500,
      }
    );
  }
}