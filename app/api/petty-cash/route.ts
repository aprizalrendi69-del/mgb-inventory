import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  PettyCashStatus,
  PettyCashType,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

/*
===========================================================
PETTY CASH API
===========================================================

KONSEP SALDO:

PettyCashAccount
- openingBalance  = saldo awal akun
- currentBalance  = saldo berjalan TERAKHIR

TRANSAKSI:
- PENDING  -> belum mengubah currentBalance
- APPROVED -> mengubah currentBalance

balanceBefore / balanceAfter pada transaksi adalah
snapshot saldo ketika transaksi diproses.

ATURAN:

PUSAT
- outletId = null
- account.outletId = null

OUTLET
- outletId = ID outlet
- account.outletId = ID outlet

OUTLET_ADMIN
- hanya outlet sendiri
- hanya akun petty cash outlet sendiri

ADMIN / MANAGER
- dapat melihat seluruh transaksi
- dapat membuat transaksi pusat/outlet

===========================================================
*/

async function getCurrentUser() {
  try {
    const cookieStore = await cookies();

    const session = cookieStore.get("erp-session");

    if (!session?.value) {
      return null;
    }

    let sessionData: any;

    try {
      sessionData = JSON.parse(session.value);
    } catch {
      return null;
    }

    const sessionUser =
      sessionData?.user ?? sessionData;

    const userId = Number(sessionUser?.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        fullname: true,
        role: true,
        active: true,
        outletId: true,
      },
    });

    if (!user || !user.active) {
      return null;
    }

    return user;
  } catch (error) {
    console.error(
      "GET CURRENT USER PETTY CASH ERROR:",
      error
    );

    return null;
  }
}

/*
===========================================================
GET PETTY CASH
===========================================================
*/

export async function GET() {
  try {
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

    const where: any = {};

    /*
    ========================================================
    OUTLET ADMIN
    ========================================================
    */

    if (user.role === Role.OUTLET_ADMIN) {
      if (!user.outletId) {
        return NextResponse.json({
          success: true,
          data: [],
          summary: {
            totalIn: 0,
            totalOut: 0,
            currentBalance: 0,
          },
        });
      }

      where.outletId = user.outletId;
    }

    /*
    ========================================================
    TRANSACTIONS
    ========================================================
    */

    const pettyCash = await prisma.pettyCash.findMany({
      where,

      include: {
        outlet: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },

        account: {
          select: {
            id: true,
            code: true,
            name: true,
            outletId: true,
            openingBalance: true,
            currentBalance: true,
          },
        },
      },

      orderBy: [
        {
          trxDate: "desc",
        },
        {
          id: "desc",
        },
      ],
    });

    /*
    ========================================================
    SUMMARY

    PENTING:
    currentBalance TIDAK dihitung dari:
      totalIn - totalOut

    karena harus memasukkan saldo awal.

    Untuk summary global, kita hitung dari akun:
      openingBalance + transaksi APPROVED

    Tetapi nilai saldo akun tetap menjadi referensi utama.
    ========================================================
    */

    const approvedWhere: any = {
      status: PettyCashStatus.APPROVED,
    };

    if (user.role === Role.OUTLET_ADMIN) {
      approvedWhere.outletId = user.outletId ?? -1;
    }

    const approvedTransactions =
      await prisma.pettyCash.findMany({
        where: approvedWhere,

        select: {
          type: true,
          amount: true,
        },
      });

    let totalIn = 0;
    let totalOut = 0;

    for (const trx of approvedTransactions) {
      const amount = Number(trx.amount) || 0;

      if (trx.type === PettyCashType.IN) {
        totalIn += amount;
      }

      if (trx.type === PettyCashType.OUT) {
        totalOut += amount;
      }
    }

    /*
    ========================================================
    CURRENT BALANCE

    Ambil dari akun petty cash agar konsisten dengan
    currentBalance yang digunakan saat approval.
    ========================================================
    */

    const accountWhere: any = {
      isActive: true,
    };

    if (user.role === Role.OUTLET_ADMIN) {
      accountWhere.outletId = user.outletId ?? -1;
    }

    const accounts =
      await prisma.pettyCashAccount.findMany({
        where: accountWhere,

        select: {
          currentBalance: true,
        },
      });

    const currentBalance = accounts.reduce(
      (total, account) =>
        total + Number(account.currentBalance || 0),
      0
    );

    return NextResponse.json({
      success: true,

      data: pettyCash,

      summary: {
        totalIn,
        totalOut,
        currentBalance,
      },
    });
  } catch (error) {
    console.error(
      "GET PETTY CASH ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil data Petty Cash",
      },
      {
        status: 500,
      }
    );
  }
}

/*
===========================================================
CREATE PETTY CASH
===========================================================
*/

export async function POST(req: NextRequest) {
  try {
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

    const body = await req.json();

    /*
    ========================================================
    BASIC DATA
    ========================================================
    */

    const typeRaw = String(body.type ?? "")
      .trim()
      .toUpperCase();

    const category = String(
      body.category ?? ""
    ).trim();

    const description =
      body.description === undefined ||
      body.description === null ||
      String(body.description).trim() === ""
        ? null
        : String(body.description).trim();

    const amount = Number(body.amount ?? 0);

    const paymentId =
      body.paymentId === undefined ||
      body.paymentId === null ||
      body.paymentId === ""
        ? null
        : Number(body.paymentId);

    /*
    ========================================================
    VALIDATE TYPE
    ========================================================
    */

    if (
      !Object.values(PettyCashType).includes(
        typeRaw as PettyCashType
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Tipe Petty Cash tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const type = typeRaw as PettyCashType;

    /*
    ========================================================
    CATEGORY
    ========================================================
    */

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          message: "Kategori wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    AMOUNT
    ========================================================
    */

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Nominal Petty Cash tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    DETERMINE OUTLET
    ========================================================
    */

    let outletId: number | null = null;

    if (user.role === Role.OUTLET_ADMIN) {
      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message: "User outlet belum ditentukan",
          },
          {
            status: 400,
          }
        );
      }

      outletId = user.outletId;
    } else {
      const rawOutletId = body.outletId;

      outletId =
        rawOutletId === undefined ||
        rawOutletId === null ||
        rawOutletId === ""
          ? null
          : Number(rawOutletId);
    }

    /*
    ========================================================
    VALIDATE OUTLET
    ========================================================
    */

    if (outletId !== null) {
      if (
        !Number.isInteger(outletId) ||
        outletId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Outlet tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      const outlet = await prisma.outlet.findUnique({
        where: {
          id: outletId,
        },
      });

      if (!outlet) {
        return NextResponse.json(
          {
            success: false,
            message: "Outlet tidak ditemukan",
          },
          {
            status: 404,
          }
        );
      }
    }

    /*
    ========================================================
    ACCOUNT
    ========================================================
    */

    let accountId: number | null = null;

    if (
      body.accountId !== undefined &&
      body.accountId !== null &&
      body.accountId !== ""
    ) {
      accountId = Number(body.accountId);
    }

    let account: any = null;

    if (accountId !== null) {
      if (
        !Number.isInteger(accountId) ||
        accountId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Akun Petty Cash tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      account =
        await prisma.pettyCashAccount.findUnique({
          where: {
            id: accountId,
          },
        });

      if (!account) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Akun Petty Cash tidak ditemukan",
          },
          {
            status: 404,
          }
        );
      }

      if (!account.isActive) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Akun Petty Cash tidak aktif",
          },
          {
            status: 400,
          }
        );
      }

      /*
      AKUN HARUS SESUAI OUTLET
      */

      if (account.outletId !== outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Akun Petty Cash tidak sesuai dengan outlet transaksi",
          },
          {
            status: 403,
          }
        );
      }
    } else {
      /*
      CARI AKUN AKTIF SESUAI OUTLET
      */

      account =
        await prisma.pettyCashAccount.findFirst({
          where: {
            outletId,
            isActive: true,
          },

          orderBy: {
            id: "asc",
          },
        });

      if (!account) {
        return NextResponse.json(
          {
            success: false,
            message:
              outletId === null
                ? "Akun Petty Cash Pusat belum tersedia"
                : "Akun Petty Cash Outlet belum tersedia",
          },
          {
            status: 400,
          }
        );
      }

      accountId = account.id;
    }

    /*
    ========================================================
    PAYMENT
    ========================================================
    */

    if (paymentId !== null) {
      if (
        !Number.isInteger(paymentId) ||
        paymentId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Payment tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      const payment =
        await prisma.payment.findUnique({
          where: {
            id: paymentId,
          },

          include: {
            purchase: true,
            outletPurchase: true,
          },
        });

      if (!payment) {
        return NextResponse.json(
          {
            success: false,
            message: "Payment tidak ditemukan",
          },
          {
            status: 404,
          }
        );
      }

      if (payment.status !== "APPROVED") {
        return NextResponse.json(
          {
            success: false,
            message:
              "Payment harus APPROVED sebelum masuk Petty Cash",
          },
          {
            status: 400,
          }
        );
      }

      /*
      PAYMENT OUTLET
      */

      if (payment.outletPurchaseId) {
        const poOutlet =
          payment.outletPurchase;

        if (!poOutlet) {
          return NextResponse.json(
            {
              success: false,
              message: "PO outlet tidak ditemukan",
            },
            {
              status: 404,
            }
          );
        }

        if (outletId !== poOutlet.outletId) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Payment outlet tidak sesuai dengan petty cash outlet",
            },
            {
              status: 403,
            }
          );
        }
      }

      /*
      PAYMENT PUSAT
      */

      if (
        payment.purchaseId &&
        outletId !== null
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Payment PO pusat harus menggunakan Petty Cash Pusat",
          },
          {
            status: 403,
          }
        );
      }
    }

    /*
    ========================================================
    SALDO

    PENTING:
    Transaksi baru masih PENDING.

    Jadi transaksi ini BELUM boleh mengubah saldo.

    balanceBefore menggunakan currentBalance akun.
    ========================================================
    */

    const balanceBefore = Number(
      account.currentBalance ??
        account.openingBalance ??
        0
    );

    /*
    Jangan menolak OUT hanya karena pending.

    Namun kita tetap cek saldo saat membuat transaksi
    supaya transaksi OUT yang jelas tidak mungkin
    disetujui tidak dibuat.
    */

    if (
      type === PettyCashType.OUT &&
      amount > balanceBefore
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Saldo Petty Cash tidak mencukupi",
          balance: balanceBefore,
        },
        {
          status: 400,
        }
      );
    }

    const balanceAfter =
      type === PettyCashType.IN
        ? balanceBefore + amount
        : balanceBefore - amount;

    /*
    ========================================================
    NUMBER
    ========================================================
    */

    const now = new Date();

    const year = now.getFullYear();

    const month = String(
      now.getMonth() + 1
    ).padStart(2, "0");

    const prefix = `PC-${year}${month}-`;

    const lastTransaction =
      await prisma.pettyCash.findFirst({
        where: {
          number: {
            startsWith: prefix,
          },
        },

        orderBy: {
          id: "desc",
        },

        select: {
          number: true,
        },
      });

    let sequence = 1;

    if (lastTransaction?.number) {
      const lastNumber = Number(
        lastTransaction.number.replace(
          prefix,
          ""
        )
      );

      if (Number.isFinite(lastNumber)) {
        sequence = lastNumber + 1;
      }
    }

    const number =
      `${prefix}${String(sequence).padStart(4, "0")}`;

    /*
    ========================================================
    CREATE

    STATUS SELALU PENDING.

    currentBalance ACCOUNT TIDAK DISENTUH.
    ========================================================
    */

    const pettyCash =
      await prisma.pettyCash.create({
        data: {
          number,

          trxDate: now,

          type,

          category,

          description,

          amount,

          balanceBefore,

          balanceAfter,

          accountId,

          paymentId,

          outletId,

          createdBy: user.id,

          status: PettyCashStatus.PENDING,
        },

        include: {
          account: {
            include: {
              outlet: true,
            },
          },

          outlet: true,
        },
      });

    return NextResponse.json(
      {
        success: true,
        message:
          "Petty Cash berhasil dibuat dan menunggu approval",
        data: pettyCash,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "CREATE PETTY CASH ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Gagal membuat Petty Cash",
      },
      {
        status: 500,
      }
    );
  }
}