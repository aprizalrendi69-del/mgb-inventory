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
      },
    });
  } catch {
    return null;
  }
}

// =====================================================
// POST PAYMENT PURCHASE PUSAT
//
// CASH / COD / CBD
// -> PAYMENT
// -> PETTY CASH OUT
//
// TRANSFER
// -> PAYMENT SAJA
//
// TEMPO
// -> PAYABLE
//
// TIDAK ADA BANK
// TIDAK ADA CASH ACCOUNT
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
    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login",
        },
        { status: 401 }
      );
    }

    if (!user.active) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User tidak aktif",
        },
        { status: 403 }
      );
    }

    if (
      user.role !== Role.ADMIN &&
      user.role !== Role.MANAGER
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak memiliki akses pembayaran Purchase Pusat",
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
      !Number.isInteger(
        purchaseId
      ) ||
      purchaseId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID Purchase tidak valid",
        },
        { status: 400 }
      );
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
        body.method || ""
      ).toUpperCase() as PaymentMethod;

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
    // PURCHASE
    // =================================================

    const purchase =
      await prisma.purchase.findUnique({
        where: {
          id:
            purchaseId,
        },

        include: {
          payable: true,
        },
      });

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase tidak ditemukan",
        },
        { status: 404 }
      );
    }

    // =================================================
    // PROCESS PAYMENT
    // =================================================

    const result =
      await processPayment({
        purchaseId:
          purchase.id,

        supplierId:
          purchase.supplierId,

        amount,

        method,

        outletId:
          null,

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

    return NextResponse.json(
      {
        success: true,
        message:
          "Pembayaran Purchase berhasil",
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "PURCHASE PAYMENT ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Gagal melakukan pembayaran Purchase";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 400 }
    );
  }
}