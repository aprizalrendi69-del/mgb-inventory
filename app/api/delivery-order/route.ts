import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DeliveryStatus, HistoryType } from "@prisma/client";

/*
|--------------------------------------------------------------------------
| GET - LIST DELIVERY ORDER
|--------------------------------------------------------------------------
|
| BUSINESS FLOW:
|
| Delivery.customerId
|        ↓
| Customer
|
| Sedangkan tujuan outlet:
|
| Delivery
|    ↓
| OutletTransfer
|    ↓
| Outlet
|
| JANGAN lagi menganggap:
|
| Delivery.customerId = Outlet.id
|
|--------------------------------------------------------------------------
*/

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

        /*
        |--------------------------------------------------------------------------
        | CUSTOMER
        |--------------------------------------------------------------------------
        |
        | Customer berasal langsung dari Delivery.customerId.
        |
        */

        customer: {
          select: {
            id: true,
            code: true,
            name: true,
            address: true,
            city: true,
            phone: true,
            email: true,
            contactPerson: true,
          },
        },

        /*
        |--------------------------------------------------------------------------
        | SURAT JALAN
        |--------------------------------------------------------------------------
        */

        suratJalan: {
          select: {
            id: true,
            number: true,
          },
        },

        /*
        |--------------------------------------------------------------------------
        | DELIVERY ITEMS
        |--------------------------------------------------------------------------
        */

        items: {
          select: {
            id: true,
            qty: true,
            price: true,
            voided: true,
            voidedAt: true,
            voidedById: true,
            voidReason: true,
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
    |--------------------------------------------------------------------------
    | BUILD RESULT
    |--------------------------------------------------------------------------
    */

    const result = await Promise.all(
      data.map(async (delivery) => {
        /*
        |--------------------------------------------------------------------------
        | NORMALIZE ITEMS
        |--------------------------------------------------------------------------
        */

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

        /*
        |--------------------------------------------------------------------------
        | TOTAL VALUE
        |--------------------------------------------------------------------------
        */

        const totalValue = items.reduce(
          (sum, item) =>
            sum + Number(item.subtotal ?? 0),
          0
        );

        /*
        |--------------------------------------------------------------------------
        | CARI OUTLET TRANSFER
        |--------------------------------------------------------------------------
        |
        | PENTING:
        |
        | Jangan lagi:
        |
        | outletId: delivery.customer.id
        |
        | Karena customer.id adalah ID CUSTOMER,
        | bukan ID OUTLET.
        |
        | Kita cari transfer berdasarkan nomor Delivery Order
        | yang disimpan pada remarks.
        |
        */

        let outletTransfer: any = null;

        try {
          outletTransfer =
            await prisma.outletTransfer.findFirst({
              where: {
                remarks: {
                  contains: delivery.number,
                },
              },

              include: {
                outlet: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    address: true,
                    city: true,
                    phone: true,
                  },
                },

                items: {
                  select: {
                    id: true,
                    barangId: true,
                    qty: true,
                    receivedQty: true,

                    barang: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                        unit: true,
                      },
                    },
                  },
                },
              },
            });
        } catch (error) {
          console.error(
            `GET OUTLET TRANSFER ERROR ${delivery.number}:`,
            error
          );
        }

        /*
        |--------------------------------------------------------------------------
        | CUSTOMER
        |--------------------------------------------------------------------------
        |
        | Customer tetap berasal dari Delivery.customer.
        |
        */

        const customer = delivery.customer
          ? {
              id: delivery.customer.id,
              code: delivery.customer.code,
              name: delivery.customer.name,
              address: delivery.customer.address,
              city: delivery.customer.city,
              phone: delivery.customer.phone,
              email: delivery.customer.email,
              contactPerson:
                delivery.customer.contactPerson,
            }
          : null;

        /*
        |--------------------------------------------------------------------------
        | OUTLET
        |--------------------------------------------------------------------------
        |
        | Outlet berasal dari OutletTransfer.
        |
        */

        const outlet =
          outletTransfer?.outlet ?? null;

        /*
        |--------------------------------------------------------------------------
        | RETURN
        |--------------------------------------------------------------------------
        */

        return {
          id: delivery.id,

          number: delivery.number,

          deliveryDate:
            delivery.deliveryDate,

          status: delivery.status,

          totalQty:
            delivery.totalQty,

          totalValue,

          remarks:
            delivery.remarks,

          /*
          |--------------------------------------------------------------------------
          | CUSTOMER
          |--------------------------------------------------------------------------
          */

          customer,

          /*
          |--------------------------------------------------------------------------
          | OUTLET
          |--------------------------------------------------------------------------
          */

          outlet,

          /*
          |--------------------------------------------------------------------------
          | SURAT JALAN
          |--------------------------------------------------------------------------
          */

          suratJalan:
            delivery.suratJalan ?? null,

          /*
          |--------------------------------------------------------------------------
          | ITEMS
          |--------------------------------------------------------------------------
          */

          items,

          /*
          |--------------------------------------------------------------------------
          | OUTLET TRANSFER
          |--------------------------------------------------------------------------
          */

          outletTransfer:
            outletTransfer
              ? {
                  id:
                    outletTransfer.id,

                  number:
                    outletTransfer.number,

                  status:
                    outletTransfer.status,

                  remarks:
                    outletTransfer.remarks,

                  items:
                    outletTransfer.items,
                }
              : null,
        };
      })
    );

    /*
    |--------------------------------------------------------------------------
    | RESPONSE
    |--------------------------------------------------------------------------
    */

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(
      "GET DELIVERY ORDER ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil Delivery Order",
      },
      {
        status: 500,
      }
    );
  }
}

/*
|--------------------------------------------------------------------------
| POST - BUAT DELIVERY ORDER
|--------------------------------------------------------------------------
|
| CATATAN:
|
| Endpoint ini masih digunakan untuk pembuatan Delivery Order langsung.
|
| Untuk flow Delivery Request baru:
|
| OUTLET_ADMIN
|      ↓
| Delivery Request
|      ↓
| Pusat proses
|      ↓
| Delivery Order
|
| customerId harus tetap menunjuk ke Customer,
| bukan Outlet.
|
|--------------------------------------------------------------------------
*/

export async function POST(
  req: NextRequest
) {
  try {
    const body = await req.json();

    /*
    |--------------------------------------------------------------------------
    | VALIDASI CUSTOMER
    |--------------------------------------------------------------------------
    */

    if (!body.customerId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Customer wajib dipilih",
        },
        {
          status: 400,
        }
      );
    }

    const customerId =
      Number(body.customerId);

    if (
      !Number.isInteger(customerId) ||
      customerId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Customer ID tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | CEK CUSTOMER
    |--------------------------------------------------------------------------
    */

    const customer =
      await prisma.customer.findUnique({
        where: {
          id: customerId,
        },

        select: {
          id: true,
          code: true,
          name: true,
          address: true,
          city: true,
          phone: true,
          email: true,
          contactPerson: true,
        },
      });

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Customer tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | VALIDASI ITEMS
    |--------------------------------------------------------------------------
    */

    if (
      !Array.isArray(body.items) ||
      body.items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang belum dipilih",
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
      const barang =
        await prisma.barang.findUnique({
          where: {
            id: Number(item.barangId),
          },
        });

      if (!barang) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang dengan ID ${item.barangId} tidak ditemukan`,
          },
          {
            status: 404,
          }
        );
      }

      const qty =
        Number(item.qty);

      if (
        !Number.isFinite(qty) ||
        qty <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Qty ${barang.name} tidak valid`,
          },
          {
            status: 400,
          }
        );
      }

      /*
      |--------------------------------------------------------------------------
      | CEK STOCK
      |--------------------------------------------------------------------------
      |
      | DRAFT belum mengurangi stock.
      |
      | Jadi ini hanya memastikan stock tersedia
      | ketika DO dibuat.
      |
      */

      if (Number(barang.stock) < qty) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Stock ${barang.name} tidak mencukupi. Stock tersedia: ${barang.stock}`,
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

    const deliveryItems =
      await Promise.all(
        body.items.map(
          async (item: any) => {
            const barangId =
              Number(item.barangId);

            const qty =
              Number(item.qty);

            /*
            |--------------------------------------------------------------------------
            | BARANG
            |--------------------------------------------------------------------------
            */

            const barang =
              await prisma.barang.findUnique({
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
            | PRICE SUMMARY
            |--------------------------------------------------------------------------
            */

            const summary =
              await prisma.priceSummary.findUnique(
                {
                  where: {
                    barangId,
                  },
                }
              );

            let harga =
              Number(
                summary?.lastPrice ?? 0
              );

            /*
            |--------------------------------------------------------------------------
            | FALLBACK SELLING PRICE
            |--------------------------------------------------------------------------
            */

            if (harga <= 0) {
              harga =
                Number(
                  barang.sellingPrice ?? 0
                );
            }

            /*
            |--------------------------------------------------------------------------
            | FALLBACK MASTER HARGA
            |--------------------------------------------------------------------------
            */

            if (harga <= 0) {
              const masterHarga =
                await prisma.masterHarga.findFirst(
                  {
                    where: {
                      barangId,
                    },

                    orderBy: {
                      createdAt:
                        "desc",
                    },
                  }
                );

              if (masterHarga) {
                harga =
                  Number(
                    masterHarga.hargaBaru ??
                      0
                  );
              }
            }

            /*
            |--------------------------------------------------------------------------
            | SUBTOTAL
            |--------------------------------------------------------------------------
            */

            const subtotal =
              harga * qty;

            return {
              barangId,
              qty,
              price: harga,
              subtotal,
              note:
                item.note ??
                null,
            };
          }
        )
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

          /*
          |--------------------------------------------------------------------------
          | CUSTOMER
          |--------------------------------------------------------------------------
          |
          | PENTING:
          | Ini CUSTOMER ID.
          | Bukan OUTLET ID.
          |
          */

          customerId,

          deliveryDate:
            body.deliveryDate
              ? new Date(
                  body.deliveryDate
                )
              : new Date(),

          remarks:
            body.remarks ??
            null,

          totalQty,

          status:
            DeliveryStatus.DRAFT,

          items: {
            create:
              deliveryItems,
          },
        },

        include: {
          /*
          |--------------------------------------------------------------------------
          | RETURN CUSTOMER
          |--------------------------------------------------------------------------
          */

          customer: true,

          /*
          |--------------------------------------------------------------------------
          | RETURN ITEMS
          |--------------------------------------------------------------------------
          */

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
          error instanceof Error
            ? error.message
            : "Gagal membuat Delivery Order",
      },
      {
        status: 500,
      }
    );
  }
}