import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { PaymentMethod, Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { processPayment } from "@/lib/payment";

// =====================================================
// CURRENT USER
// =====================================================

async function getCurrentUser() {
  const cookieStore = await cookies();

  const session = cookieStore.get("erp-session");

  if (!session) {
    return null;
  }

  try {
    const data = JSON.parse(session.value);

    const userId = Number(data?.user?.id ?? data?.id);

    if (!Number.isInteger(userId) || userId <= 0) {
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
// NORMALIZE METHOD
// =====================================================

function normalizePaymentMethod(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

// =====================================================
// SAFE DATE
// =====================================================

function parsePaymentDate(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date;
}

// =====================================================
// SAFE STRING
// =====================================================

function cleanString(value: unknown): string | null {
  const result = String(value ?? "").trim();

  return result || null;
}

// =====================================================
// POST PAYMENT PURCHASE PUSAT
//
// BUSINESS RULE:
//
// NON TEMPO
//
// CASH
// COD
// CBD
// -> Payment
// -> Petty Cash OUT
//
// TRANSFER
// -> Payment
// -> TIDAK mengurangi Petty Cash
//
// TEMPO
// -> PurchasePayable
// -> TIDAK membuat Payment
// -> TIDAK mengurangi Petty Cash
//
// TEMPO SETTLEMENT
//
// CASH
// COD
// CBD
// -> Payment
// -> Petty Cash OUT
// -> Payable berkurang
//
// TRANSFER
// -> Payment
// -> Tidak mengurangi Petty Cash
// -> Payable berkurang
//
// Tidak ada Bank Account.
// Tidak ada Cash Account.
//
// ACCESS:
//
// ADMIN
// MANAGER
// -> boleh pembayaran Purchase Pusat
//
// OUTLET_ADMIN
// -> tidak boleh
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
    // USER
    // =================================================

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        {
          status: 401,
        }
      );
    }

    if (!user.active) {
      return NextResponse.json(
        {
          success: false,
          message: "User tidak aktif",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // PUSAT ONLY
    // =================================================

    if (
      user.role !== Role.ADMIN &&
      user.role !== Role.MANAGER
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak memiliki akses pembayaran Purchase Pusat.",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // PARAMETER ID
    // =================================================

    const { id } = await context.params;

    const purchaseId = Number(id);

    if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "ID Purchase tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // BODY
    // =================================================

    let body: Record<string, unknown>;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Body request tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // AMOUNT
    // =================================================

    const amount = Number(body.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Jumlah pembayaran tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // METHOD
    // =================================================

    const method = normalizePaymentMethod(body.method);

    const allowedMethods = [
      "CASH",
      "COD",
      "CBD",
      "TRANSFER",
      "TEMPO",
    ];

    if (!allowedMethods.includes(method)) {
      return NextResponse.json(
        {
          success: false,
          message: "Metode pembayaran tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // OPTIONAL DATA
    // =================================================

    const referenceNumber = cleanString(
      body.referenceNumber
    );

    const remarks = cleanString(body.remarks);

    const paymentDate = parsePaymentDate(body.paymentDate);

    if (
      body.paymentDate !== undefined &&
      body.paymentDate !== null &&
      body.paymentDate !== "" &&
      !paymentDate
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Tanggal pembayaran tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // PURCHASE
    // =================================================

    const purchase = await prisma.purchase.findUnique({
      where: {
        id: purchaseId,
      },
      include: {
        payable: true,
      },
    });

    if (!purchase) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // PURCHASE STATUS
    // =================================================

    if (purchase.status === "DRAFT") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase yang masih Draft belum dapat dibayar.",
        },
        {
          status: 400,
        }
      );
    }

    if (purchase.status === "CANCELLED") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase yang dibatalkan tidak dapat dibayar.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // PURCHASE TOTAL
    // =================================================

    const total = Number(purchase.total ?? 0);

    if (!Number.isFinite(total) || total <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Total Purchase tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // PURCHASE PAYMENT METHOD
    // =================================================

    const purchaseMethod = normalizePaymentMethod(
      purchase.paymentMethod
    );

    if (!purchaseMethod) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase belum memiliki metode pembayaran.",
        },
        {
          status: 400,
        }
      );
    }

    if (!allowedMethods.includes(purchaseMethod)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Metode pembayaran Purchase tidak dikenali.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // TRANSFER REFERENCE
    //
    // Berlaku untuk:
    // 1. Purchase non-TEMPO
    // 2. Settlement TEMPO
    // =================================================

    if (method === "TRANSFER" && !referenceNumber) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Nomor referensi wajib diisi untuk pembayaran Transfer.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // =================================================
    // TEMPO PURCHASE
    // =================================================
    // =================================================

    if (purchaseMethod === "TEMPO") {
      // =================================================
      // TEMPO INITIAL
      //
      // Belum mempunyai payable.
      //
      // WAJIB:
      // method = TEMPO
      //
      // HASIL:
      // PurchasePayable dibuat.
      //
      // TIDAK:
      // - membuat Payment
      // - mengurangi Petty Cash
      // =================================================

      if (!purchase.payable) {
        if (method !== "TEMPO") {
          return NextResponse.json(
            {
              success: false,
              message:
                "Purchase TEMPO pertama kali harus menggunakan metode TEMPO untuk membuat hutang.",
            },
            {
              status: 400,
            }
          );
        }

        // ===============================================
        // NILAI HARUS FULL TOTAL PURCHASE
        // ===============================================

        if (Math.abs(amount - total) > 0.01) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Nilai Purchase Payable harus sama dengan total Purchase.",
            },
            {
              status: 400,
            }
          );
        }

        // ===============================================
        // CREATE PAYABLE
        //
        // Tidak ada Payment.
        // Tidak ada Petty Cash.
        // ===============================================

        const payable =
          await prisma.purchasePayable.create({
            data: {
              purchaseId: purchase.id,

              supplierId: purchase.supplierId,

              amount: total,

              paidAmount: 0,

              outstanding: total,

              status: "OUTSTANDING",
            },
          });

        return NextResponse.json(
          {
            success: true,
            message:
              "Purchase Payable berhasil dibuat. Purchase tercatat sebagai hutang.",
            data: {
              type: "PAYABLE",
              payable,
            },
          },
          {
            status: 201,
          }
        );
      }

      // =================================================
      // TEMPO SETTLEMENT
      // =================================================

      const payable = purchase.payable;

      const payableAmount = Number(payable.amount ?? 0);

      const paidAmount = Number(payable.paidAmount ?? 0);

      const storedOutstanding = Number(
        payable.outstanding ?? NaN
      );

      const calculatedOutstanding = Math.max(
        0,
        payableAmount - paidAmount
      );

      const outstanding = Number.isFinite(
        storedOutstanding
      )
        ? Math.max(0, storedOutstanding)
        : calculatedOutstanding;

      // =================================================
      // PAYABLE INVALID
      // =================================================

      if (
        !Number.isFinite(payableAmount) ||
        payableAmount <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Nilai Purchase Payable tidak valid.",
          },
          {
            status: 400,
          }
        );
      }

      // =================================================
      // SUDAH LUNAS
      // =================================================

      if (outstanding <= 0.01) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Purchase Payable ini sudah lunas.",
          },
          {
            status: 400,
          }
        );
      }

      // =================================================
      // TEMPO TIDAK BOLEH SETTLEMENT DENGAN TEMPO
      // =================================================

      const settlementMethods = [
        "CASH",
        "TRANSFER",
        "COD",
        "CBD",
      ];

      if (!settlementMethods.includes(method)) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Pelunasan hutang TEMPO hanya dapat menggunakan CASH, TRANSFER, COD, atau CBD.",
          },
          {
            status: 400,
          }
        );
      }

      // =================================================
      // JUMLAH TIDAK BOLEH MELEBIHI HUTANG
      // =================================================

      if (amount > outstanding + 0.01) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Jumlah pembayaran melebihi outstanding hutang.",
          },
          {
            status: 400,
          }
        );
      }

      // =================================================
      // PROCESS TEMPO SETTLEMENT
      //
      // CASH/COD/CBD
      // -> Payment
      // -> Petty Cash OUT
      // -> Payable berkurang
      //
      // TRANSFER
      // -> Payment
      // -> Tidak mengurangi Petty Cash
      // -> Payable berkurang
      // =================================================

      const result = await processPayment({
        purchaseId: purchase.id,

        supplierId: purchase.supplierId,

        amount,

        method: method as PaymentMethod,

        outletId: null,

        userId: user.id,

        referenceNumber,

        remarks,

        paymentDate,

        purchaseNumber: purchase.number,
      });

      return NextResponse.json(
        {
          success: true,
          message:
            "Pelunasan Purchase berhasil.",
          data: {
            type: "PAYABLE_PAYMENT",
            ...result,
          },
        },
        {
          status: 201,
        }
      );
    }

    // =================================================
    // =================================================
    // NON TEMPO PURCHASE
    // =================================================
    // =================================================

    // =================================================
    // METHOD HARUS SESUAI PURCHASE
    // =================================================

    if (method !== purchaseMethod) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Metode pembayaran tidak sesuai dengan Purchase. Metode Purchase: ${purchaseMethod}.`,
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // NON TEMPO HARUS FULL PAYMENT
    // =================================================

    if (Math.abs(amount - total) > 0.01) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Jumlah pembayaran harus sama dengan total Purchase.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // NON TEMPO TIDAK BOLEH MEMILIKI PAYABLE
    //
    // Karena hanya TEMPO yang membuat hutang.
    // =================================================

    if (purchase.payable) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase non-TEMPO memiliki data Purchase Payable. Data pembayaran tidak dapat diproses sebelum data hutang diperiksa.",
        },
        {
          status: 409,
        }
      );
    }

    // =================================================
    // PROCESS NORMAL PAYMENT
    //
    // CASH
    // COD
    // CBD
    // -> Payment
    // -> Petty Cash OUT
    //
    // TRANSFER
    // -> Payment
    // -> Tidak mengurangi Petty Cash
    // =================================================

    const result = await processPayment({
      purchaseId: purchase.id,

      supplierId: purchase.supplierId,

      amount,

      method: method as PaymentMethod,

      outletId: null,

      userId: user.id,

      referenceNumber,

      remarks,

      paymentDate,

      purchaseNumber: purchase.number,
    });

    // =================================================
    // SUCCESS
    // =================================================

    return NextResponse.json(
      {
        success: true,
        message: "Pembayaran Purchase berhasil.",
        data: {
          type: "PAYMENT",
          ...result,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "PURCHASE PAYMENT ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Gagal melakukan pembayaran Purchase.";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: 400,
      }
    );
  }
}