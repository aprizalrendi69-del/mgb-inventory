import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  PaymentMethod,
  Role,
} from "@prisma/client";

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

    const userId = Number(
      data?.user?.id ?? data?.id
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
// NORMALIZE PAYMENT METHOD
// =====================================================

function normalizePaymentMethod(
  value: unknown
): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

// =====================================================
// PARSE AMOUNT
// =====================================================
//
// Support:
//
// 100000
// "100000"
// "100.000"
// "1.250.000"
// "100,000"
// "1,250,000"
// "100.50"
// "100,50"
// "1.250.000,50"
//
// =====================================================

function parseAmount(
  value: unknown
): number {
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : NaN;
  }

  const raw = String(
    value ?? ""
  ).trim();

  if (!raw) {
    return NaN;
  }

  // Remove currency / whitespace.
  const cleaned = raw
    .replace(/Rp/gi, "")
    .replace(/\s/g, "");

  // Indonesian format:
  // 1.250.000,50
  if (
    cleaned.includes(".") &&
    cleaned.includes(",")
  ) {
    return Number(
      cleaned
        .replace(/\./g, "")
        .replace(",", ".")
    );
  }

  // Only dot.
  if (cleaned.includes(".")) {
    const parts =
      cleaned.split(".");

    const lastPart =
      parts[parts.length - 1];

    // 100.50 = decimal
    if (
      parts.length === 2 &&
      /^\d{1,2}$/.test(lastPart)
    ) {
      return Number(cleaned);
    }

    // 100.000 / 1.250.000 = thousands
    return Number(
      cleaned.replace(/\./g, "")
    );
  }

  // Only comma.
  if (cleaned.includes(",")) {
    const parts =
      cleaned.split(",");

    const lastPart =
      parts[parts.length - 1];

    // 100,50 = decimal
    if (
      parts.length === 2 &&
      /^\d{1,2}$/.test(lastPart)
    ) {
      return Number(
        cleaned.replace(",", ".")
      );
    }

    // 100,000 / 1,250,000 = thousands
    return Number(
      cleaned.replace(/,/g, "")
    );
  }

  return Number(
    cleaned.replace(/[^\d-]/g, "")
  );
}

// =====================================================
// CLEAN OPTIONAL STRING
// =====================================================

function cleanOptionalString(
  value: unknown
): string | null {
  const result = String(
    value ?? ""
  ).trim();

  return result || null;
}

// =====================================================
// POST PURCHASE PAYMENT
// =====================================================
//
// BUSINESS RULE
//
// NON TEMPO:
//
// CASH
// -> Payment
// -> Petty Cash OUT
//
// COD
// -> Payment
// -> Petty Cash OUT
//
// CBD
// -> Payment
// -> Petty Cash OUT
//
// TRANSFER
// -> Payment
// -> Tidak menggunakan Petty Cash
//
// TEMPO INITIAL:
//
// TEMPO
// -> PurchasePayable
// -> TIDAK membuat Payment
// -> TIDAK mengurangi Petty Cash
//
// TEMPO SETTLEMENT:
//
// CASH / COD / CBD
// -> Payment
// -> Petty Cash OUT
// -> Payable berkurang
//
// TRANSFER
// -> Payment
// -> Tidak mengurangi Petty Cash
// -> Payable berkurang
//
// IMPORTANT:
//
// PurchasePayable HANYA dipakai untuk Purchase TEMPO.
//
// Purchase non-TEMPO TIDAK boleh menggunakan payable
// sebagai sumber outstanding pembayaran.
//
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

    const user =
      await getCurrentUser();

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
            "Tidak memiliki akses pembayaran Purchase Pusat",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // PURCHASE ID
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
        {
          status: 400,
        }
      );
    }

    // =================================================
    // BODY
    // =================================================

    let body: Record<
      string,
      unknown
    >;

    try {
      body =
        await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Body request tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // AMOUNT
    // =================================================

    const amount =
      parseAmount(
        body.amount
      );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Jumlah pembayaran tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // METHOD
    // =================================================

    let method =
      normalizePaymentMethod(
        body.method
      );

    // Frontend lama mungkin mengirim PETTY_CASH.
    // Secara bisnis PETTY_CASH = CASH.

    if (
      method === "PETTY_CASH"
    ) {
      method = "CASH";
    }

    const allowedMethods = [
      "CASH",
      "TRANSFER",
      "TEMPO",
      "COD",
      "CBD",
    ];

    if (
      !allowedMethods.includes(
        method
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Metode pembayaran tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // OPTIONAL DATA
    // =================================================

    const referenceNumber =
      cleanOptionalString(
        body.referenceNumber
      );

    const remarks =
      cleanOptionalString(
        body.remarks
      );

    let paymentDate:
      | Date
      | undefined;

    if (body.paymentDate) {
      const parsedDate =
        new Date(
          String(
            body.paymentDate
          )
        );

      if (
        Number.isNaN(
          parsedDate.getTime()
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Tanggal pembayaran tidak valid.",
          },
          {
            status: 400,
          }
        );
      }

      paymentDate =
        parsedDate;
    }

    // =================================================
    // PURCHASE
    // =================================================

    const purchase =
      await prisma.purchase.findUnique({
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
          message:
            "Purchase tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // PURCHASE STATUS
    // =================================================

    if (
      purchase.status ===
      "DRAFT"
    ) {
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

    if (
      purchase.status ===
      "CANCELLED"
    ) {
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
    // PURCHASE METHOD
    // =================================================

    let purchaseMethod =
      normalizePaymentMethod(
        purchase.paymentMethod
      );

    // Kompatibilitas data lama.
    if (
      purchaseMethod ===
      "PETTY_CASH"
    ) {
      purchaseMethod = "CASH";
    }

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

    // =================================================
    // TRANSFER REFERENCE
    // =================================================

    if (
      method === "TRANSFER" &&
      !referenceNumber
    ) {
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
    // TOTAL PURCHASE
    // =================================================

    const total =
      Number(
        purchase.total ?? 0
      );

    if (
      !Number.isFinite(total) ||
      total <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Total Purchase tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // TEMPO PURCHASE
    // =================================================

    if (
      purchaseMethod ===
      "TEMPO"
    ) {
      // =================================================
      // TEMPO INITIAL
      // =================================================
      //
      // Belum punya payable:
      //
      // method HARUS TEMPO
      // amount HARUS sama dengan total
      //
      // CREATE PAYABLE ONLY.
      //
      // Tidak create Payment.
      // Tidak potong Petty Cash.
      // =================================================

      if (
        !purchase.payable
      ) {
        if (
          method !==
          "TEMPO"
        ) {
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

        if (
          Math.abs(
            amount - total
          ) > 0.01
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                `Nilai Purchase Payable harus sama dengan total Purchase. Total Purchase Rp ${Math.round(
                  total
                ).toLocaleString(
                  "id-ID"
                )}.`,
            },
            {
              status: 400,
            }
          );
        }

        // Jangan gunakan prisma transaction di sini
        // karena processPayment juga transaction.
        //
        // Tetapi sebelum create, lakukan pengecekan
        // ulang agar tidak membuat duplicate payable
        // karena race condition sederhana.

        const existingPayable =
          await prisma.purchasePayable.findUnique({
            where: {
              purchaseId:
                purchase.id,
            },
          });

        if (existingPayable) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Purchase Payable untuk Purchase ini sudah tersedia.",
              data: {
                payable:
                  existingPayable,
              },
            },
            {
              status: 409,
            }
          );
        }

        const payable =
          await prisma.purchasePayable.create({
            data: {
              purchaseId:
                purchase.id,

              supplierId:
                purchase.supplierId,

              outletId:
                null,

              amount:
                total,

              paidAmount:
                0,

              outstanding:
                total,

              status:
                "OUTSTANDING",
            },
          });

        return NextResponse.json(
          {
            success: true,
            message:
              "Purchase Payable berhasil dibuat.",

            data: {
              type:
                "PAYABLE",

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

      const payable =
        purchase.payable;

      const payableAmount =
        Number(
          payable.amount ?? 0
        );

      const payablePaidAmount =
        Number(
          payable.paidAmount ?? 0
        );

      const storedOutstanding =
        Number(
          payable.outstanding
        );

      // Gunakan outstanding tersimpan jika valid.
      // Kalau data lama rusak/null, hitung ulang.
      const outstanding =
        Number.isFinite(
          storedOutstanding
        )
          ? Math.max(
              0,
              storedOutstanding
            )
          : Math.max(
              0,
              payableAmount -
                payablePaidAmount
            );

      if (
        outstanding <= 0
      ) {
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

      // TEMPO tidak boleh menjadi metode settlement.
      if (
        method ===
        "TEMPO"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Pelunasan hutang TEMPO harus menggunakan CASH, COD, CBD, atau TRANSFER.",
          },
          {
            status: 400,
          }
        );
      }

      // =================================================
      // SETTLEMENT AMOUNT
      // =================================================

      if (
        amount >
        outstanding + 0.01
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Jumlah pembayaran melebihi outstanding hutang. Outstanding saat ini Rp ${Math.round(
                outstanding
              ).toLocaleString(
                "id-ID"
              )}.`,
          },
          {
            status: 400,
          }
        );
      }

      // =================================================
      // PROCESS TEMPO SETTLEMENT
      // =================================================
      //
      // IMPORTANT:
      //
      // payableId dikirim secara eksplisit.
      //
      // Jadi processPayment tidak boleh memilih
      // payable lain.
      // =================================================

      const result =
        await processPayment({
          purchaseId:
            purchase.id,

          payableId:
            payable.id,

          supplierId:
            purchase.supplierId,

          amount,

          method:
            method as PaymentMethod,

          outletId:
            null,

          userId:
            user.id,

          referenceNumber,

          remarks,

          paymentDate,

          purchaseNumber:
            purchase.number,
        });

      const resultPayable =
        result?.payable;

      const resultOutstanding =
        resultPayable
          ? Number(
              resultPayable.outstanding
            )
          : Math.max(
              0,
              outstanding - amount
            );

      return NextResponse.json(
        {
          success: true,

          message:
            resultOutstanding <=
            0.01
              ? "Pelunasan Purchase berhasil dan hutang sekarang LUNAS."
              : "Pelunasan Purchase berhasil.",

          data: {
            type:
              "PAYABLE_PAYMENT",

            ...result,
          },
        },
        {
          status: 201,
        }
      );
    }

    // =================================================
    // NON-TEMPO
    // =================================================
    //
    // IMPORTANT:
    //
    // Purchase non-TEMPO TIDAK boleh memakai
    // PurchasePayable sebagai outstanding.
    //
    // Payment harus full sesuai total Purchase.
    //
    // =================================================

    if (
      purchase.payable
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase non-TEMPO tidak boleh memiliki Purchase Payable. Periksa data Purchase/Payable sebelum melakukan pembayaran.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // METHOD HARUS SESUAI PURCHASE
    // =================================================

    if (
      method !==
      purchaseMethod
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Metode pembayaran tidak sesuai dengan Purchase. Metode Purchase: ${purchaseMethod}, metode pembayaran: ${method}.`,
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // NON-TEMPO HARUS FULL PAYMENT
    // =================================================

    if (
      Math.abs(
        amount - total
      ) > 0.01
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Jumlah pembayaran harus sama dengan total Purchase. Total Purchase Rp ${Math.round(
              total
            ).toLocaleString(
              "id-ID"
            )}, pembayaran Rp ${Math.round(
              amount
            ).toLocaleString(
              "id-ID"
            )}.`,
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // PROCESS NORMAL PAYMENT
    // =================================================
    //
    // CASH / COD / CBD
    // -> Payment
    // -> Petty Cash OUT
    //
    // TRANSFER
    // -> Payment
    // -> tanpa Petty Cash
    //
    // payableId sengaja TIDAK dikirim.
    // =================================================

    const result =
      await processPayment({
        purchaseId:
          purchase.id,

        supplierId:
          purchase.supplierId,

        amount,

        method:
          method as PaymentMethod,

        outletId:
          null,

        userId:
          user.id,

        referenceNumber,

        remarks,

        paymentDate,

        purchaseNumber:
          purchase.number,
      });

    return NextResponse.json(
      {
        success: true,

        message:
          "Pembayaran Purchase berhasil.",

        data: {
          type:
            "PAYMENT",

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