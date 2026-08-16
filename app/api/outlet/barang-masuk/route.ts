import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OutletPurchaseStatus } from "@prisma/client";
import { cookies } from "next/headers";

export async function GET() {
  try {
    // =====================================================
    // 1. CEK SESSION USER
    // =====================================================

    const cookieStore = await cookies();
    const session = cookieStore.get("erp-session");

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        { status: 401 }
      );
    }

    let sessionData: any;

    try {
      sessionData = JSON.parse(session.value);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Session tidak valid",
        },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        id: sessionData.id,
      },
      select: {
        id: true,
        role: true,
        outletId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "User tidak ditemukan",
        },
        { status: 404 }
      );
    }

    // =====================================================
    // 2. FILTER AKSES OUTLET
    // =====================================================
    //
    // ADMIN PUSAT
    // -> outletFilter = {}
    // -> bisa melihat semua outlet
    //
    // OUTLET_ADMIN
    // -> outletFilter = { outletId: outlet miliknya }
    // -> hanya bisa melihat outlet sendiri
    //
    // Jika OUTLET_ADMIN belum memiliki outlet,
    // gunakan -1 agar tidak mendapatkan data outlet.
    // =====================================================

    const outletFilter =
      user.role === "OUTLET_ADMIN"
        ? {
            outletId: user.outletId ?? -1,
          }
        : {};

    // =====================================================
    // 3. PURCHASE OUTLET
    // =====================================================

    const purchases =
      await prisma.outletPurchase.findMany({
        where: {
          ...outletFilter,
          status: OutletPurchaseStatus.APPROVED,
        },

        include: {
          outlet: true,

          supplier: true,

          items: {
            include: {
              barang: true,
            },
          },
        },

        orderBy: {
          purchaseDate: "desc",
        },
      });

    const purchaseData = purchases.map(
      (purchase) => {
        const totalItem =
          purchase.items.reduce(
            (total, item) =>
              total + Number(item.qty ?? 0),
            0
          );

        const totalReceived =
          purchase.items.reduce(
            (total, item) =>
              total +
              Number(item.receivedQty ?? 0),
            0
          );

        let status = String(
          purchase.status
        );

        if (
          totalReceived > 0 &&
          totalReceived < totalItem
        ) {
          status = "PARTIAL";
        }

        if (
          totalItem > 0 &&
          totalReceived >= totalItem
        ) {
          status = "RECEIVED";
        }

        return {
          id: `PURCHASE-${purchase.id}`,

          sourceId: purchase.id,

          sumber: "PURCHASE" as const,

          nomor: purchase.number,

          tanggal: purchase.purchaseDate,

          status,

          totalItem,

          totalReceived,

          outlet: purchase.outlet
            ? {
                id: purchase.outlet.id,
                code: purchase.outlet.code,
                name: purchase.outlet.name,
              }
            : null,

          supplier: purchase.supplier
            ? {
                id: purchase.supplier.id,
                code: purchase.supplier.code,
                name: purchase.supplier.name,
              }
            : null,

          purchase: {
            id: purchase.id,
            number: purchase.number,
            status: purchase.status,
            purchaseDate:
              purchase.purchaseDate,
            remarks: purchase.remarks,
          },

          items: purchase.items.map(
            (item) => ({
              id: item.id,
              barangId: item.barangId,
              qty: Number(item.qty ?? 0),
              receivedQty: Number(
                item.receivedQty ?? 0
              ),
              price: Number(
                item.price ?? 0
              ),
              subtotal: Number(
                item.subtotal ?? 0
              ),
              barang: item.barang,
            })
          ),
        };
      }
    );

    // =====================================================
    // 4. TRANSFER GUDANG PUSAT -> OUTLET
    // =====================================================

    const transfers =
      await prisma.outletTransfer.findMany({
        where: {
          ...outletFilter,
        },

        include: {
          outlet: true,

          items: {
            include: {
              barang: true,
            },
          },
        },

        orderBy: {
          transferDate: "desc",
        },
      });

    const transferData = transfers.map(
      (transfer) => {
        const totalItem =
          transfer.items.reduce(
            (total, item) =>
              total + Number(item.qty ?? 0),
            0
          );

        const totalReceived =
          transfer.items.reduce(
            (total, item) =>
              total +
              Number(item.receivedQty ?? 0),
            0
          );

        let status = String(
          transfer.status
        );

        if (
          totalReceived > 0 &&
          totalReceived < totalItem
        ) {
          status = "PARTIAL";
        }

        if (
          totalItem > 0 &&
          totalReceived >= totalItem
        ) {
          status = "RECEIVED";
        }

        return {
          id: `TRANSFER-${transfer.id}`,

          sourceId: transfer.id,

          sumber: "TRANSFER" as const,

          nomor: transfer.number,

          tanggal: transfer.transferDate,

          status,

          totalItem,

          totalReceived,

          outlet: transfer.outlet
            ? {
                id: transfer.outlet.id,
                code: transfer.outlet.code,
                name: transfer.outlet.name,
              }
            : null,

          supplier: null,

          purchase: null,

          transfer: {
            id: transfer.id,
            number: transfer.number,
            status: transfer.status,
            transferDate:
              transfer.transferDate,
            remarks:
              transfer.remarks,
          },

          items: transfer.items.map(
            (item) => {
              const price = Number(
                item.barang?.purchasePrice ?? 0
              );

              const qty = Number(
                item.qty ?? 0
              );

              return {
                id: item.id,
                barangId: item.barangId,
                qty,
                receivedQty: Number(
                  item.receivedQty ?? 0
                ),
                price,
                subtotal: qty * price,
                barang: item.barang,
              };
            }
          ),
        };
      }
    );

    // =====================================================
    // 5. GABUNGKAN PURCHASE + TRANSFER
    // =====================================================

    const data = [
      ...purchaseData,
      ...transferData,
    ].sort(
      (a, b) =>
        new Date(b.tanggal).getTime() -
        new Date(a.tanggal).getTime()
    );

    // =====================================================
    // 6. DEBUG LOG
    // =====================================================

    console.log(
      "OUTLET BARANG MASUK:",
      {
        role: user.role,
        outletId: user.outletId,
        total: data.length,
        data: data.map((item) => ({
          id: item.id,
          nomor: item.nomor,
          sumber: item.sumber,
          status: item.status,
          outletId: item.outlet?.id,
          outlet: item.outlet?.name,
        })),
      }
    );

    // =====================================================
    // 7. RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "GET OUTLET BARANG MASUK ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil data barang masuk outlet",
      },
      { status: 500 }
    );
  }
}