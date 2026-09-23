import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DeliveryStatus, HistoryType } from "@prisma/client";
import { cookies } from "next/headers";

// =====================================================
// GET
// =====================================================
//
// GET /api/delivery-order
// GET /api/delivery-order?outletId=1
//
// RELASI:
// Delivery.customerId -> Customer
// Delivery.outletId   -> Outlet
//
// =====================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const outletIdParam = searchParams.get("outletId");

    const where: any = {};

    // ---------------------------------------------------
    // FILTER OUTLET
    // ---------------------------------------------------

    if (outletIdParam) {
      const outletId = Number(outletIdParam);

      if (!Number.isInteger(outletId) || outletId <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Outlet ID tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      where.outletId = outletId;
    }

    // ---------------------------------------------------
    // AMBIL DELIVERY
    // ---------------------------------------------------

    const deliveries = await prisma.delivery.findMany({
      where,

      orderBy: {
        deliveryDate: "desc",
      },

      include: {
        // =================================================
        // CUSTOMER
        // =================================================

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

        // =================================================
        // OUTLET
        // =================================================

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

        // =================================================
        // ITEMS
        // =================================================

        items: {
          include: {
            barang: true,
          },
        },

        // =================================================
        // SURAT JALAN
        // =================================================

        suratJalan: true,
      },
    });

    // ---------------------------------------------------
    // FORMAT RESPONSE
    // ---------------------------------------------------

    const data = deliveries.map((delivery) => {
      const items = delivery.items.map((item) => {
        const qty = Number(item.qty ?? 0);
        const price = Number(item.price ?? 0);

        const subtotal =
          Number(item.subtotal ?? 0) > 0
            ? Number(item.subtotal)
            : qty * price;

        return {
          ...item,

          qty,
          price,
          subtotal,
        };
      });

      const totalQty = items.reduce(
        (sum, item) =>
          sum + Number(item.qty ?? 0),
        0
      );

      const totalValue = items.reduce(
        (sum, item) =>
          sum + Number(item.subtotal ?? 0),
        0
      );

      return {
        id: delivery.id,

        number: delivery.number,

        deliveryDate:
          delivery.deliveryDate,

        status:
          delivery.status,

        remarks:
          delivery.remarks,

        totalQty,

        totalValue,

        // =================================================
        // CUSTOMER
        // =================================================
        //
        // INI YANG AKAN DIBACA FRONTEND:
        //
        // d.customer.name
        // d.customer.code
        //
        // =================================================

        customer: delivery.customer
          ? {
              id: delivery.customer.id,
              code: delivery.customer.code,
              name: delivery.customer.name,
              address:
                delivery.customer.address,
              city:
                delivery.customer.city,
              phone:
                delivery.customer.phone,
              email:
                delivery.customer.email,
              contactPerson:
                delivery.customer.contactPerson,
            }
          : null,

        // =================================================
        // OUTLET
        // =================================================

        outlet: delivery.outlet
          ? {
              id: delivery.outlet.id,
              code: delivery.outlet.code,
              name: delivery.outlet.name,
              address:
                delivery.outlet.address,
              city:
                delivery.outlet.city,
              phone:
                delivery.outlet.phone,
            }
          : null,

        // =================================================
        // ITEMS
        // =================================================

        items,

        // =================================================
        // SURAT JALAN
        // =================================================

        suratJalan:
          delivery.suratJalan,
      };
    });

    // ---------------------------------------------------
    // DEBUG
    // ---------------------------------------------------

    console.log(
      "GET DELIVERY ORDER:",
      data.map((item) => ({
        id: item.id,
        number: item.number,

        customerId:
          item.customer?.id ?? null,

        customerCode:
          item.customer?.code ?? null,

        customerName:
          item.customer?.name ?? null,

        outletId:
          item.outlet?.id ?? null,

        outletCode:
          item.outlet?.code ?? null,

        outletName:
          item.outlet?.name ?? null,
      }))
    );

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error(
      "GET DELIVERY ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil Delivery Order",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// POST
// =====================================================
//
// POST /api/delivery-order
//
// BODY:
//
// {
//   customerId: 3,
//   outletId: 1,
//   items: [
//     {
//       barangId: 10,
//       qty: 5,
//       price: 10000,
//       note: "..."
//     }
//   ],
//   remarks: "..."
// }
//
// =====================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      customerId,
      outletId,
      items,
      remarks,
    } = body;

    // ===================================================
    // VALIDASI CUSTOMER ID
    // ===================================================

    const parsedCustomerId =
      Number(customerId);

    if (
      !Number.isInteger(parsedCustomerId) ||
      parsedCustomerId <= 0
    ) {
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

    // ===================================================
    // VALIDASI BARANG
    // ===================================================

    if (
      !Array.isArray(items) ||
      items.length === 0
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

    // ===================================================
    // CEK CUSTOMER
    // ===================================================

    const customer =
      await prisma.customer.findUnique({
        where: {
          id: parsedCustomerId,
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

    // ===================================================
    // VALIDASI OUTLET
    // ===================================================

    let parsedOutletId:
      number | null = null;

    let outlet: any = null;

    if (
      outletId !== null &&
      outletId !== undefined &&
      outletId !== ""
    ) {
      parsedOutletId =
        Number(outletId);

      if (
        !Number.isInteger(
          parsedOutletId
        ) ||
        parsedOutletId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet ID tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      outlet =
        await prisma.outlet.findUnique({
          where: {
            id: parsedOutletId,
          },

          select: {
            id: true,
            code: true,
            name: true,
            address: true,
            city: true,
            phone: true,
          },
        });

      if (!outlet) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet tidak ditemukan",
          },
          {
            status: 404,
          }
        );
      }
    }

    // ===================================================
    // GENERATE NUMBER
    // ===================================================
    //
    // Tidak menggunakan count() + 1 karena rawan:
    //
    // DO-00001
    // DO-00002
    //
    // jika data dihapus atau dua request masuk
    // bersamaan bisa terjadi duplicate.
    //
    // ===================================================

    const now = new Date();

    const datePart = now
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");

    const timePart = String(
      now.getTime()
    ).slice(-8);

    const number =
      `DO-${datePart}-${timePart}`;

    // ===================================================
    // HITUNG BARANG + HARGA
    // ===================================================

    let totalQty = 0;

    let grandTotal = 0;

    const deliveryItems: {
      barangId: number;
      qty: number;
      price: number;
      subtotal: number;
      note: string | null;
    }[] = [];

    // ===================================================
    // LOOP ITEM
    // ===================================================

    for (const item of items) {
      const barangId =
        Number(item.barangId);

      const qty =
        Number(item.qty);

      // -------------------------------------------------
      // VALIDASI BARANG ID
      // -------------------------------------------------

      if (
        !Number.isInteger(
          barangId
        ) ||
        barangId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Barang tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      // -------------------------------------------------
      // VALIDASI QTY
      // -------------------------------------------------

      if (
        !Number.isFinite(qty) ||
        qty <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Qty harus lebih dari 0",
          },
          {
            status: 400,
          }
        );
      }

      // -------------------------------------------------
      // AMBIL BARANG
      // -------------------------------------------------

      const barang =
        await prisma.barang.findUnique({
          where: {
            id: barangId,
          },
        });

      if (!barang) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang ID ${barangId} tidak ditemukan`,
          },
          {
            status: 404,
          }
        );
      }

      // -------------------------------------------------
      // HARGA
      // -------------------------------------------------
      //
      // Prioritas:
      //
      // 1. Harga dari form
      // 2. sellingPrice
      // 3. purchasePrice
      //
      // -------------------------------------------------

      let price =
        Number(item.price);

      if (
        !Number.isFinite(price) ||
        price <= 0
      ) {
        price =
          Number(
            barang.sellingPrice ?? 0
          );
      }

      if (
        !Number.isFinite(price) ||
        price <= 0
      ) {
        price =
          Number(
            barang.purchasePrice ?? 0
          );
      }

      // -------------------------------------------------
      // SUBTOTAL
      // -------------------------------------------------

      const subtotal =
        qty * price;

      totalQty += qty;

      grandTotal += subtotal;

      deliveryItems.push({
        barangId,
        qty,
        price,
        subtotal,
        note:
          item.note
            ? String(item.note)
            : null,
      });
    }

    // ===================================================
    // TRANSACTION
    // ===================================================

    const delivery =
      await prisma.$transaction(
        async (tx) => {
          // ---------------------------------------------
          // CREATE DELIVERY
          // ---------------------------------------------

          const result =
            await tx.delivery.create({
              data: {
                number,

                // CUSTOMER
                customerId:
                  parsedCustomerId,

                // OUTLET
                outletId:
                  parsedOutletId,

                // REMARKS
                remarks:
                  remarks
                    ? String(remarks)
                    : null,

                // TOTAL
                totalQty,

                // STATUS
                status:
                  DeliveryStatus.DRAFT,

                // ITEMS
                items: {
                  create:
                    deliveryItems.map(
                      (item) => ({
                        barangId:
                          item.barangId,

                        qty:
                          item.qty,

                        price:
                          item.price,

                        subtotal:
                          item.subtotal,

                        note:
                          item.note,
                      })
                    ),
                },
              },

              include: {
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
                  include: {
                    barang: true,
                  },
                },
              },
            });

          // ---------------------------------------------
          // AMBIL USER DARI SESSION
          // ---------------------------------------------

          let userId:
            number | null = null;

          try {
            const cookieStore =
              await cookies();

            const session =
              cookieStore.get(
                "erp-session"
              );

            if (session) {
              const sessionData =
                JSON.parse(
                  session.value
                );

              const parsedUserId =
                Number(
                  sessionData.id
                );

              if (
                Number.isInteger(
                  parsedUserId
                ) &&
                parsedUserId > 0
              ) {
                userId =
                  parsedUserId;
              }
            }
          } catch (sessionError) {
            console.error(
              "READ SESSION DELIVERY ERROR:",
              sessionError
            );
          }

          // ---------------------------------------------
          // HISTORY
          // ---------------------------------------------

          await tx.history.create({
            data: {
              transactionType:
                HistoryType.DELIVERY,

              referenceNumber:
                result.number,

              description:
                `Membuat Delivery Order ${result.number}`,

              userId,
            },
          });

          return result;
        }
      );

    // ===================================================
    // TOTAL VALUE RESPONSE
    // ===================================================

    const totalValue =
      delivery.items.reduce(
        (sum, item) =>
          sum +
          Number(
            item.subtotal ?? 0
          ),
        0
      );

    // ===================================================
    // RESPONSE
    // ===================================================

    return NextResponse.json(
      {
        success: true,

        message:
          "Delivery Order berhasil dibuat",

        data: {
          ...delivery,

          totalValue,

          customer:
            delivery.customer
              ? {
                  id:
                    delivery.customer.id,

                  code:
                    delivery.customer.code,

                  name:
                    delivery.customer.name,

                  address:
                    delivery.customer.address,

                  city:
                    delivery.customer.city,

                  phone:
                    delivery.customer.phone,

                  email:
                    delivery.customer.email,

                  contactPerson:
                    delivery.customer
                      .contactPerson,
                }
              : null,

          outlet:
            delivery.outlet
              ? {
                  id:
                    delivery.outlet.id,

                  code:
                    delivery.outlet.code,

                  name:
                    delivery.outlet.name,

                  address:
                    delivery.outlet.address,

                  city:
                    delivery.outlet.city,

                  phone:
                    delivery.outlet.phone,
                }
              : null,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error: any) {
    console.error(
      "POST DELIVERY ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal membuat Delivery Order",
      },
      {
        status: 500,
      }
    );
  }
}