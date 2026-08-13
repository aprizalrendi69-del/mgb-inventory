import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const customerId = Number(id);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "ID customer tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const { searchParams } = new URL(req.url);

    /*
     * =====================================================
     * FILTER
     * =====================================================
     *
     * Frontend mengirim:
     *
     * from
     * to
     * searchDO
     *
     * Tetap dukung start/end supaya tidak merusak
     * pemanggilan API lama.
     */

    const from =
      searchParams.get("from") ??
      searchParams.get("start");

    const to =
      searchParams.get("to") ??
      searchParams.get("end");

    const searchDO =
      searchParams.get("searchDO")?.trim() ?? "";

    /*
     * =====================================================
     * WHERE DELIVERY
     * =====================================================
     */

    const where: any = {
      customerId,
    };

    /*
     * FILTER TANGGAL
     */

    if (from || to) {
      where.deliveryDate = {};

      if (from) {
        where.deliveryDate.gte =
          new Date(`${from}T00:00:00`);
      }

      if (to) {
        where.deliveryDate.lte =
          new Date(`${to}T23:59:59`);
      }
    }

    /*
     * =====================================================
     * FILTER NOMOR DELIVERY ORDER
     * =====================================================
     *
     * Pencarian dilakukan pada nomor DO.
     *
     * contains = bisa mencari sebagian nomor.
     *
     * Contoh:
     *
     * DO-001
     *
     * pencarian:
     * 001
     *
     * tetap menemukan DO-001.
     */

    if (searchDO) {
      where.number = {
        contains: searchDO,
      };
    }

    /*
     * =====================================================
     * AMBIL DELIVERY
     * =====================================================
     */

    const deliveries =
      await prisma.delivery.findMany({
        where,

        include: {
          customer: true,

          items: {
            include: {
              barang: true,
            },

            orderBy: {
              id: "asc",
            },
          },
        },

        orderBy: {
          deliveryDate: "desc",
        },
      });

    /*
     * =====================================================
     * CUSTOMER
     * =====================================================
     *
     * Jangan membuat customer null hanya karena
     * hasil filter searchDO kosong.
     *
     * Customer tetap diambil berdasarkan customerId.
     */

    const customer =
      await prisma.customer.findUnique({
        where: {
          id: customerId,
        },
      });

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * =====================================================
     * TIDAK ADA DELIVERY
     * =====================================================
     */

    if (deliveries.length === 0) {
      return NextResponse.json({
        success: true,

        data: {
          customer,

          deliveries: [],

          summary: {
            transaksi: 0,
            qty: 0,
            nominal: 0,
          },
        },
      });
    }

    /*
     * =====================================================
     * AMBIL BARANG ID
     * =====================================================
     */

    const barangIds = [
      ...new Set(
        deliveries.flatMap((delivery) =>
          delivery.items.map(
            (item) => item.barangId
          )
        )
      ),
    ];

    /*
     * =====================================================
     * PRICE SUMMARY
     * =====================================================
     */

    const priceSummaries =
      barangIds.length > 0
        ? await prisma.priceSummary.findMany({
            where: {
              barangId: {
                in: barangIds,
              },
            },

            select: {
              barangId: true,
              lastPrice: true,
            },
          })
        : [];

    /*
     * =====================================================
     * PRICE MAP
     * =====================================================
     */

    const priceMap =
      new Map<number, number>();

    priceSummaries.forEach((item) => {
      priceMap.set(
        item.barangId,
        Number(item.lastPrice ?? 0)
      );
    });

    /*
     * =====================================================
     * TOTAL
     * =====================================================
     */

    let totalQty = 0;
    let totalNominal = 0;

    /*
     * =====================================================
     * NORMALISASI DELIVERY
     * =====================================================
     */

    const resultDeliveries =
      deliveries.map((delivery) => {
        const items =
          delivery.items.map((item) => {
            const qty = Number(
              item.qty ?? 0
            );

            /*
             * Harga yang tersimpan di DeliveryItem
             */

            const deliveryPrice =
              Number(item.price ?? 0);

            /*
             * Harga terakhir dari PriceSummary
             */

            const summaryPrice =
              Number(
                priceMap.get(
                  item.barangId
                ) ?? 0
              );

            /*
             * Harga jual barang
             */

            const sellingPrice =
              Number(
                item.barang?.sellingPrice ?? 0
              );

            /*
             * =================================================
             * PRIORITAS HARGA
             * =================================================
             *
             * 1. DeliveryItem.price
             * 2. PriceSummary.lastPrice
             * 3. Barang.sellingPrice
             */

            let harga = 0;

            if (deliveryPrice > 0) {
              harga = deliveryPrice;
            } else if (
              summaryPrice > 0
            ) {
              harga = summaryPrice;
            } else if (
              sellingPrice > 0
            ) {
              harga = sellingPrice;
            }

            /*
             * =================================================
             * SUBTOTAL
             * =================================================
             */

            const originalSubtotal =
              Number(
                item.subtotal ?? 0
              );

            let subtotal = 0;

            /*
             * Kalau DeliveryItem sudah punya
             * harga + subtotal valid, pertahankan.
             */

            if (
              deliveryPrice > 0 &&
              originalSubtotal > 0
            ) {
              subtotal =
                originalSubtotal;
            } else {
              subtotal =
                qty * harga;
            }

            totalQty += qty;

            totalNominal += subtotal;

            return {
              id: item.id,

              barangId:
                item.barangId,

              barang: {
                id:
                  item.barang?.id,

                code:
                  item.barang?.code ??
                  "-",

                name:
                  item.barang?.name ??
                  "-",

                unit:
                  item.barang?.unit ??
                  "-",
              },

              qty,

              price: harga,

              subtotal,
            };
          });

        return {
          id: delivery.id,

          number: delivery.number,

          deliveryDate:
            delivery.deliveryDate,

          status:
            delivery.status,

          items,
        };
      });

    /*
     * =====================================================
     * RESPONSE
     * =====================================================
     */

    return NextResponse.json({
      success: true,

      data: {
        customer,

        deliveries:
          resultDeliveries,

        summary: {
          transaksi:
            deliveries.length,

          qty: totalQty,

          nominal:
            totalNominal,
        },
      },
    });
  } catch (error: any) {
    console.error(
      "DETAIL CUSTOMER ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ??
          "Gagal mengambil detail customer",
      },
      {
        status: 500,
      }
    );
  }
}