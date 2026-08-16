import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      customerId,
      outletId,
      note,
      items,
    } = body;

    // =====================================================
    // VALIDASI DATA
    // =====================================================

    if (
      !customerId ||
      !outletId ||
      !items ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Customer, outlet, dan barang wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    const customerIdNumber = Number(customerId);
    const outletIdNumber = Number(outletId);

    if (
      !Number.isInteger(customerIdNumber) ||
      !Number.isInteger(outletIdNumber)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer atau outlet tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // VALIDASI CUSTOMER
    // =====================================================

    const customer = await prisma.customer.findUnique({
      where: {
        id: customerIdNumber,
      },
    });

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer tidak ditemukan",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // VALIDASI OUTLET
    // =====================================================

    const outlet = await prisma.outlet.findUnique({
      where: {
        id: outletIdNumber,
      },
    });

    if (!outlet) {
      return NextResponse.json(
        {
          success: false,
          message: "Outlet tidak ditemukan",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // TRANSACTION
    // =====================================================

    const result = await prisma.$transaction(
      async (tx) => {
        // =================================================
        // NOMOR DELIVERY
        // =================================================

        const count = await tx.delivery.count();

        const number =
          `DO-${String(count + 1).padStart(5, "0")}`;

        let totalQty = 0;

        // =================================================
        // CREATE DELIVERY
        // =================================================

        const delivery = await tx.delivery.create({
          data: {
            number,

            customerId: customerIdNumber,

            // WAJIB TERHUBUNG KE OUTLET
            outletId: outletIdNumber,

            status: "DRAFT",

            remarks: note || null,

            totalQty: 0,
          },
        });

        // =================================================
        // PROCESS ITEMS
        // =================================================

        for (const item of items) {
          const barangId = Number(item.barangId);
          const keluarQty = Number(item.qty);

          if (
            !Number.isInteger(barangId) ||
            !Number.isFinite(keluarQty) ||
            keluarQty <= 0
          ) {
            throw new Error(
              "Data barang keluar tidak valid"
            );
          }

          // ===============================================
          // AMBIL BARANG
          // ===============================================

          const barang = await tx.barang.findUnique({
            where: {
              id: barangId,
            },
          });

          if (!barang) {
            throw new Error(
              `Barang dengan ID ${barangId} tidak ditemukan`
            );
          }

          // ===============================================
          // VALIDASI STOCK
          //
          // HANYA CEK.
          // STOCK BELUM DIKURANGI.
          // ===============================================

          if (Number(barang.stock) < keluarQty) {
            throw new Error(
              `Stock ${barang.name} tidak cukup. ` +
                `Stock tersedia: ${barang.stock}, ` +
                `diminta: ${keluarQty}`
            );
          }

          // ===============================================
          // HARGA
          // ===============================================

          const price =
            Number(barang.sellingPrice ?? 0);

          const subtotal =
            price * keluarQty;

          // ===============================================
          // CREATE DELIVERY ITEM
          // ===============================================

          await tx.deliveryItem.create({
            data: {
              deliveryId: delivery.id,
              barangId: barang.id,
              qty: keluarQty,
              price,
              subtotal,
            },
          });

          totalQty += keluarQty;
        }

        // =================================================
        // UPDATE TOTAL QTY
        // =================================================

        const updatedDelivery =
          await tx.delivery.update({
            where: {
              id: delivery.id,
            },
            data: {
              totalQty,
            },
            include: {
              customer: true,
              outlet: true,
              items: {
                include: {
                  barang: true,
                },
              },
            },
          });

        return updatedDelivery;
      }
    );

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,

      message:
        `Barang keluar ${result.number} berhasil ` +
        `disimpan sebagai DRAFT untuk outlet ${outlet.name}`,

      data: result,
    });
  } catch (error: any) {
    console.error(
      "BARANG KELUAR DRAFT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal menyimpan barang keluar",
      },
      {
        status: 500,
      }
    );
  }
}