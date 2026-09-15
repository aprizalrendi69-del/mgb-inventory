import {
  NextRequest,
  NextResponse,
} from "next/server";

import { cookies } from "next/headers";

import {
  PaymentMethod,
  Role,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  processPayment,
} from "@/lib/payment";

// =====================================================
// CURRENT USER
// =====================================================

async function getCurrentUser() {
  const cookieStore =
    await cookies();

  const session =
    cookieStore.get("erp-session");

  if (!session) {
    return null;
  }

  try {
    const data =
      JSON.parse(session.value);

    const userId = Number(
      data?.user?.id ??
        data?.id
    );

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return null;
    }

    return await prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        role: true,
        active: true,
        outletId: true,
      },
    });
  } catch {
    return null;
  }
}

// =====================================================
// POST PAYMENT PURCHASE OUTLET
//
// ARSITEKTUR PAYMENT:
//
// PURCHASE TEMPO
// -> RECEIVE
// -> PurchasePayable dibuat
// -> dueDate ditentukan dari Supplier.tempoDays
//
// PAYMENT SETELAHNYA
// -> CASH / COD / CBD
// -> petty cash outlet
//
// -> TRANSFER
// -> payment saja
//
// TEMPO TIDAK BOLEH dikirim sebagai method pembayaran
// pada endpoint ini.
// =====================================================

export async function POST(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    // =================================================
    // CURRENT USER
    // =================================================

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        { status: 401 }
      );
    }

    if (!user.active) {
      return NextResponse.json(
        {
          success: false,
          message: "User tidak aktif",
        },
        { status: 403 }
      );
    }

    // =================================================
    // ACCESS CONTROL
    // =================================================

    if (
      user.role !== Role.ADMIN &&
      user.role !== Role.MANAGER &&
      user.role !== Role.OUTLET_ADMIN
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak memiliki akses pembayaran Purchase Outlet",
        },
        { status: 403 }
      );
    }

    // =================================================
    // ID
    // =================================================

    const { id } =
      await context.params;

    const purchaseId =
      Number(id);

    if (
      !Number.isInteger(purchaseId) ||
      purchaseId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID Purchase Outlet tidak valid",
        },
        { status: 400 }
      );
    }

    // =================================================
    // PURCHASE OUTLET
    // =================================================

    const purchase =
      await prisma.outletPurchase.findUnique({
        where: {
          id: purchaseId,
        },

        select: {
          id: true,
          number: true,
          outletId: true,
          supplierId: true,
          paymentMethod: true,
          total: true,

          payable: {
            select: {
              id: true,
              outletPurchaseId: true,
              supplierId: true,
              outletId: true,
              invoiceNumber: true,
              invoiceDate: true,
              dueDate: true,
              amount: true,
              paidAmount: true,
              outstanding: true,
              status: true,
            },
          },
        },
      });

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase Outlet tidak ditemukan",
        },
        { status: 404 }
      );
    }

    // =================================================
    // OUTLET ADMIN SECURITY
    // =================================================

    if (
      user.role === Role.OUTLET_ADMIN
    ) {
      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User belum memiliki outlet",
          },
          { status: 403 }
        );
      }

      if (
        purchase.outletId !==
        user.outletId
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Tidak dapat membayar Purchase Outlet lain",
          },
          { status: 403 }
        );
      }
    }

    // =================================================
    // BODY
    // =================================================

    const body =
      await req.json();

    const amount =
      Number(body.amount);

    const method =
      String(
        body.method ?? ""
      ).trim().toUpperCase() as PaymentMethod;

    // =================================================
    // VALIDATE AMOUNT
    // =================================================

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Jumlah pembayaran tidak valid",
        },
        { status: 400 }
      );
    }

    // =================================================
    // TEMPO TIDAK DIPROSES DI SINI
    // =================================================

    if (
      method === PaymentMethod.TEMPO
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Metode TEMPO tidak dapat diproses sebagai pembayaran. Purchase Payable TEMPO dibuat saat penerimaan barang.",
        },
        { status: 400 }
      );
    }

    // =================================================
    // JIKA PURCHASE TEMPO
    // HARUS ADA PAYABLE
    // =================================================

    if (
      purchase.paymentMethod ===
      PaymentMethod.TEMPO
    ) {
      if (!purchase.payable) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Purchase Outlet TEMPO belum memiliki Purchase Payable. Pastikan barang sudah diterima terlebih dahulu.",
          },
          { status: 400 }
        );
      }

      if (
        purchase.payable.outletPurchaseId !==
        purchase.id
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Purchase Payable tidak terhubung dengan Purchase Outlet ini.",
          },
          { status: 400 }
        );
      }

      if (
        purchase.payable.supplierId !==
        purchase.supplierId
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Supplier Purchase Payable tidak sesuai dengan Purchase Outlet.",
          },
          { status: 400 }
        );
      }

      if (
        purchase.payable.outletId !==
        purchase.outletId
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet Purchase Payable tidak sesuai dengan Purchase Outlet.",
          },
          { status: 400 }
        );
      }
    }

    // =================================================
    // PROCESS PAYMENT
    // =================================================

    const result =
      await processPayment({
        outletPurchaseId:
          purchase.id,

        // =================================================
        // PENTING:
        // Kalau Purchase TEMPO, settlement harus diarahkan
        // ke PurchasePayable yang sudah dibuat saat RECEIVE.
        // =================================================

        payableId:
          purchase.payable?.id ??
          null,

        supplierId:
          purchase.supplierId,

        amount,

        method,

        outletId:
          purchase.outletId,

        userId:
          user.id,

        referenceNumber:
          body.referenceNumber
            ? String(
                body.referenceNumber
              ).trim()
            : null,

        remarks:
          body.remarks
            ? String(
                body.remarks
              ).trim()
            : null,

        paymentDate:
          body.paymentDate
            ? new Date(
                body.paymentDate
              )
            : undefined,

        purchaseNumber:
          purchase.number,
      });

    // =================================================
    // SUCCESS
    // =================================================

    return NextResponse.json(
      {
        success: true,

        message:
          "Pembayaran Purchase Outlet berhasil",

        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "OUTLET PURCHASE PAYMENT ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Gagal melakukan pembayaran Purchase Outlet";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 400 }
    );
  }
}