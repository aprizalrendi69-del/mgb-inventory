import {
  NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";

import { cookies } from "next/headers";

import {
  PaymentMethod,
  PaymentStatus,
  Role,
} from "@prisma/client";

/*
===========================================================
PAYMENT PAID ENDPOINT
===========================================================

DESAIN FINAL
============

Endpoint ini TIDAK lagi digunakan untuk:

CASH
TRANSFER
COD
CBD

Karena metode tersebut:

Payment PENDING
   ↓
Approve
   ↓
Petty Cash OUT
   ↓
Payment PAID

Jadi Payment menjadi PAID langsung pada saat APPROVE.

-----------------------------------------------------------

TEMPO

Payment PENDING
   ↓
Approve
   ↓
PurchasePayable OUTSTANDING
   ↓
Payment APPROVED

TEMPO tidak menjadi PAID melalui endpoint ini.

-----------------------------------------------------------

KESIMPULAN:

/api/payment/[id]/paid

TIDAK BOLEH mengubah:

APPROVED → PAID

Karena perubahan tersebut sekarang sudah menjadi bagian
dari proses APPROVE PAYMENT.

Endpoint ini dipertahankan sebagai endpoint pengaman agar
route lama/frontend lama tidak dapat merusak flow payment.
===========================================================
*/

/*
===========================================================
CURRENT USER
===========================================================
*/

async function getCurrentUser() {
  try {
    const cookieStore =
      await cookies();

    const session =
      cookieStore.get(
        "erp-session"
      );

    if (!session?.value) {
      return null;
    }

    let sessionData: any;

    try {
      sessionData =
        JSON.parse(
          session.value
        );
    } catch {
      return null;
    }

    const sessionUser =
      sessionData?.user ??
      sessionData;

    const userId =
      Number(
        sessionUser?.id
      );

    if (
      !Number.isInteger(
        userId
      ) ||
      userId <= 0
    ) {
      return null;
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },

        select: {
          id: true,
          username: true,
          fullname: true,
          role: true,
          outletId: true,
          active: true,
        },
      });

    if (
      !user ||
      !user.active
    ) {
      return null;
    }

    return user;
  } catch (error) {
    console.error(
      "GET CURRENT USER PAYMENT PAID ERROR:",
      error
    );

    return null;
  }
}

/*
===========================================================
PUT
===========================================================

Endpoint lama:

PUT /api/payment/[id]/paid

SEKARANG TIDAK BOLEH melakukan:

APPROVED → PAID

Karena approve payment sudah menangani seluruh proses.

Tujuannya supaya tidak ada double:

- Payment PAID
- Petty Cash OUT
- PurchasePayable
- History

===========================================================
*/

export async function PUT(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    /*
    ========================================================
    CURRENT USER
    ========================================================
    */

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    /*
    ========================================================
    PERMISSION
    ========================================================
    */

    if (
      user.role !==
        Role.ADMIN &&
      user.role !==
        Role.MANAGER
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses untuk memproses payment",
        },
        {
          status: 403,
        }
      );
    }

    /*
    ========================================================
    PAYMENT ID
    ========================================================
    */

    const { id } =
      await params;

    const paymentId =
      Number(id);

    if (
      !Number.isInteger(
        paymentId
      ) ||
      paymentId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID payment tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    FIND PAYMENT
    ========================================================
    */

    const payment =
      await prisma.payment.findUnique(
        {
          where: {
            id: paymentId,
          },

          include: {
            supplier: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },

            purchase: {
              select: {
                id: true,
                number: true,
                total: true,
                status: true,
                paymentMethod: true,
              },
            },

            outletPurchase: {
              select: {
                id: true,
                number: true,
                total: true,
                status: true,
                paymentMethod: true,

                outlet: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },
              },
            },
          },
        }
      );

    if (!payment) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    /*
    ========================================================
    VALIDASI SOURCE PO
    ========================================================
    */

    if (
      !payment.purchaseId &&
      !payment.outletPurchaseId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment tidak memiliki sumber PO",
        },
        {
          status: 400,
        }
      );
    }

    if (
      payment.purchaseId &&
      payment.outletPurchaseId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment memiliki dua sumber PO sekaligus",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    STATUS FINAL
    ========================================================

    Kalau sudah PAID:

    Tidak perlu diproses lagi.

    --------------------------------------------------------

    Kalau PENDING:

    Payment harus melalui endpoint APPROVE.

    --------------------------------------------------------

    Kalau APPROVED:

    Endpoint ini sengaja menolak karena status APPROVED
    seharusnya hanya terjadi pada TEMPO.

    --------------------------------------------------------
    */

    if (
      payment.status ===
      PaymentStatus.PAID
    ) {
      return NextResponse.json(
        {
          success: true,

          message:
            "Payment sudah berstatus PAID. Tidak ada proses tambahan.",

          data: {
            id:
              payment.id,

            number:
              payment.number,

            status:
              payment.status,
          },
        }
      );
    }

    /*
    ========================================================
    TEMPO
    ========================================================
    */

    const paymentMethod =
      payment.method;

    if (
      paymentMethod ===
      PaymentMethod.TEMPO
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Payment TEMPO tidak dapat ditandai PAID melalui endpoint ini. Payment TEMPO harus tetap APPROVED sampai pembayaran hutang supplier diproses melalui modul Purchase Payable.",

          data: {
            id:
              payment.id,

            number:
              payment.number,

            status:
              payment.status,

            method:
              payment.method,
          },
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    CASH / TRANSFER / COD / CBD
    ========================================================

    Metode ini seharusnya sudah PAID setelah APPROVE.

    Jika masih PENDING:

    Jangan langsung ubah menjadi PAID.

    Harus melalui:

    /api/payment/[id]/approve

    supaya:

    1. cek Petty Cash
    2. buat PettyCash OUT
    3. update saldo akun
    4. Payment → PAID
    5. sinkron PurchasePayable
    6. History
    ========================================================
    */

    if (
      payment.status ===
      PaymentStatus.PENDING
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Payment masih PENDING. Gunakan proses APPROVE PAYMENT agar Petty Cash dan Payment diproses secara bersamaan.",

          data: {
            id:
              payment.id,

            number:
              payment.number,

            status:
              payment.status,

            method:
              payment.method,

            purchaseId:
              payment.purchaseId,

            outletPurchaseId:
              payment.outletPurchaseId,
          },
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    APPROVED
    ========================================================

    APPROVED untuk metode non-TEMPO seharusnya tidak terjadi
    pada desain final.

    Karena:

    CASH
    TRANSFER
    COD
    CBD

    APPROVE → PAID

    Jadi kalau ditemukan kondisi seperti ini, endpoint
    menolak agar tidak terjadi perubahan status tanpa
    Petty Cash.
    ========================================================
    */

    if (
      payment.status ===
      PaymentStatus.APPROVED
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Payment sudah APPROVED tetapi belum PAID. Jangan gunakan endpoint ini karena proses APPROVE PAYMENT seharusnya sudah memproses Petty Cash dan mengubah payment menjadi PAID. Periksa kembali proses approval payment.",

          data: {
            id:
              payment.id,

            number:
              payment.number,

            status:
              payment.status,

            method:
              payment.method,
          },
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    REJECTED / CANCELLED
    ========================================================
    */

    if (
      payment.status ===
        PaymentStatus.REJECTED ||
      payment.status ===
        PaymentStatus.CANCELLED
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            `Payment berstatus ${payment.status} dan tidak dapat ditandai PAID.`,

          data: {
            id:
              payment.id,

            number:
              payment.number,

            status:
              payment.status,
          },
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    FALLBACK
    ========================================================
    */

    return NextResponse.json(
      {
        success: false,

        message:
          `Payment tidak dapat diproses dari status ${payment.status}.`,

        data: {
          id:
            payment.id,

          number:
            payment.number,

          status:
            payment.status,
        },
      },
      {
        status: 400,
      }
    );
  } catch (error) {
    console.error(
      "PUT PAYMENT PAID ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal memproses payment PAID",
      },
      {
        status: 500,
      }
    );
  }
}