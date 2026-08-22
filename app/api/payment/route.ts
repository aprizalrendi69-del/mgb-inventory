import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

import {
  PaymentMethod,
  PaymentStatus,
  Role,
  PettyCashStatus,
  PettyCashType,
} from "@prisma/client";

/*
===========================================================
PAYMENT API - FINAL MGB ERP
===========================================================

RULE FINAL:

PO PUSAT
-----------------------------------------------------------
CASH / COD / CBD
  Payment PENDING
      ↓
  Approve
      ↓
  Petty Cash Pusat OUT
      ↓
  Payment PAID
      ↓
  PurchasePayable sync

TRANSFER
  Payment PENDING
      ↓
  Approve
      ↓
  Payment PAID
      ↓
  TIDAK potong Petty Cash
  TIDAK membuat PurchasePayable

TEMPO
  Payment PENDING
      ↓
  Approve
      ↓
  Payment APPROVED
      ↓
  PurchasePayable OUTSTANDING
      ↓
  TIDAK potong Petty Cash


PO OUTLET
-----------------------------------------------------------
CASH / COD / CBD
  Payment PENDING
      ↓
  Approve
      ↓
  Petty Cash Outlet OUT
      ↓
  Payment PAID

TRANSFER
  Payment PENDING
      ↓
  Approve
      ↓
  Payment PAID
      ↓
  TIDAK potong Petty Cash
  TIDAK membuat PurchasePayable

TEMPO
  Payment PENDING
      ↓
  Approve
      ↓
  PurchasePayable OUTSTANDING
      ↓
  TIDAK potong Petty Cash


PETTY CASH
-----------------------------------------------------------
PUSAT:
  outletId = null

OUTLET:
  outletId = outletPurchase.outletId

CASH / COD / CBD saja yang membutuhkan
PettyCashAccount.

TRANSFER TIDAK PERNAH mencari PettyCashAccount.
===========================================================
*/

/*
===========================================================
CURRENT USER
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
      sessionData?.user ??
      sessionData;

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
        username: true,
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
      "GET CURRENT USER PAYMENT ERROR:",
      error
    );

    return null;
  }
}

/*
===========================================================
HELPER
===========================================================
*/

function isPettyCashPaymentMethod(
  method: PaymentMethod
) {
  return (
    method === PaymentMethod.CASH ||
    method === PaymentMethod.COD ||
    method === PaymentMethod.CBD
  );
}

function isTransferPaymentMethod(
  method: PaymentMethod
) {
  return method === PaymentMethod.TRANSFER;
}

function isTempoPaymentMethod(
  method: PaymentMethod
) {
  return method === PaymentMethod.TEMPO;
}

/*
===========================================================
SYNC PURCHASE PAYABLE
===========================================================

Hanya payment PAID yang dihitung sebagai pembayaran.

TRANSFER = PAID
CASH/COD/CBD = PAID
TEMPO = APPROVED dan tidak dihitung sebagai paid.

Jadi:

PO TOTAL
-
SEMUA PAYMENT PAID
=
OUTSTANDING

Jika outstanding <= 0:
PAID

Jika outstanding > 0:
OUTSTANDING
===========================================================
*/

async function syncPurchasePayable(
  tx: any,
  params: {
    purchaseId?: number | null;
    outletPurchaseId?: number | null;
  }
) {
  const {
    purchaseId,
    outletPurchaseId,
  } = params;

  const isCentral =
    purchaseId !== null &&
    purchaseId !== undefined;

  const isOutlet =
    outletPurchaseId !== null &&
    outletPurchaseId !== undefined;

  if (!isCentral && !isOutlet) {
    return null;
  }

  if (isCentral && isOutlet) {
    throw new Error(
      "MULTIPLE_PURCHASE_SOURCE"
    );
  }

  let poTotal = 0;
  let supplierId: number;
  let outletId: number | null = null;

  /*
  ========================================================
  PO PUSAT
  ========================================================
  */

  if (isCentral) {
    const purchase =
      await tx.purchase.findUnique({
        where: {
          id: purchaseId!,
        },
      });

    if (!purchase) {
      throw new Error(
        "PURCHASE_NOT_FOUND"
      );
    }

    poTotal = Number(purchase.total);
    supplierId = purchase.supplierId;
    outletId = null;
  }

  /*
  ========================================================
  PO OUTLET
  ========================================================
  */

  else {
    const outletPurchase =
      await tx.outletPurchase.findUnique({
        where: {
          id: outletPurchaseId!,
        },
      });

    if (!outletPurchase) {
      throw new Error(
        "OUTLET_PURCHASE_NOT_FOUND"
      );
    }

    poTotal = Number(outletPurchase.total);
    supplierId = outletPurchase.supplierId;
    outletId = outletPurchase.outletId;
  }

  /*
  ========================================================
  TOTAL PAYMENT PAID
  ========================================================
  */

  const paidAggregate =
    await tx.payment.aggregate({
      where: {
        ...(isCentral
          ? {
              purchaseId: purchaseId!,
            }
          : {
              outletPurchaseId:
                outletPurchaseId!,
            }),

        status: PaymentStatus.PAID,
      },

      _sum: {
        amount: true,
      },
    });

  const paidAmount =
    Number(
      paidAggregate._sum.amount ?? 0
    );

  const outstanding =
    Math.max(
      0,
      poTotal - paidAmount
    );

  /*
  ========================================================
  EXISTING PAYABLE
  ========================================================
  */

  const existingPayable = isCentral
    ? await tx.purchasePayable.findUnique({
        where: {
          purchaseId: purchaseId!,
        },
      })
    : await tx.purchasePayable.findUnique({
        where: {
          outletPurchaseId:
            outletPurchaseId!,
        },
      });

  /*
  ========================================================
  JIKA SUDAH LUNAS
  ========================================================
  */

  if (outstanding <= 0.01) {
    if (existingPayable) {
      return await tx.purchasePayable.update({
        where: {
          id: existingPayable.id,
        },

        data: {
          amount: poTotal,
          paidAmount: poTotal,
          outstanding: 0,
          status: "PAID",
        },
      });
    }

    return await tx.purchasePayable.create({
      data: {
        ...(isCentral
          ? {
              purchaseId: purchaseId!,
            }
          : {
              outletPurchaseId:
                outletPurchaseId!,
            }),

        supplierId,
        outletId,

        invoiceNumber:
          `PAID-${
            isCentral
              ? `PURCHASE-${purchaseId}`
              : `OUTLET-${outletPurchaseId}`
          }`,

        invoiceDate: new Date(),
        dueDate: new Date(),

        amount: poTotal,
        paidAmount: poTotal,
        outstanding: 0,

        status: "PAID",
      },
    });
  }

  /*
  ========================================================
  MASIH OUTSTANDING
  ========================================================
  */

  if (existingPayable) {
    return await tx.purchasePayable.update({
      where: {
        id: existingPayable.id,
      },

      data: {
        amount: poTotal,
        paidAmount,
        outstanding,
        status: "OUTSTANDING",
      },
    });
  }

  /*
  ========================================================
  CREATE PAYABLE
  ========================================================
  */

  return await tx.purchasePayable.create({
    data: {
      ...(isCentral
        ? {
            purchaseId: purchaseId!,
          }
        : {
            outletPurchaseId:
              outletPurchaseId!,
          }),

      supplierId,
      outletId,

      invoiceNumber:
        `PAYMENT-${
          isCentral
            ? purchaseId
            : outletPurchaseId
        }`,

      invoiceDate: new Date(),
      dueDate: new Date(),

      amount: poTotal,
      paidAmount,
      outstanding,

      status: "OUTSTANDING",
    },
  });
}

/*
===========================================================
GET PAYMENT
===========================================================
*/

export async function GET(
  req: NextRequest
) {
  try {
    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const {
      searchParams,
    } = new URL(req.url);

    const status =
      searchParams.get("status");

    const supplierIdParam =
      searchParams.get("supplierId");

    const purchaseIdParam =
      searchParams.get("purchaseId");

    const outletPurchaseIdParam =
      searchParams.get(
        "outletPurchaseId"
      );

    const where: any = {};

    /*
    ========================================================
    STATUS
    ========================================================
    */

    if (
      status &&
      Object.values(PaymentStatus).includes(
        status as PaymentStatus
      )
    ) {
      where.status =
        status as PaymentStatus;
    }

    /*
    ========================================================
    SUPPLIER
    ========================================================
    */

    if (supplierIdParam) {
      const supplierId =
        Number(supplierIdParam);

      if (
        Number.isInteger(supplierId) &&
        supplierId > 0
      ) {
        where.supplierId =
          supplierId;
      }
    }

    /*
    ========================================================
    PO PUSAT
    ========================================================
    */

    if (purchaseIdParam) {
      const purchaseId =
        Number(purchaseIdParam);

      if (
        Number.isInteger(purchaseId) &&
        purchaseId > 0
      ) {
        where.purchaseId =
          purchaseId;
      }
    }

    /*
    ========================================================
    PO OUTLET
    ========================================================
    */

    if (outletPurchaseIdParam) {
      const outletPurchaseId =
        Number(
          outletPurchaseIdParam
        );

      if (
        Number.isInteger(
          outletPurchaseId
        ) &&
        outletPurchaseId > 0
      ) {
        where.outletPurchaseId =
          outletPurchaseId;
      }
    }

    /*
    ========================================================
    ACCESS OUTLET
    ========================================================
    */

    if (
      user.role === Role.OUTLET_ADMIN
    ) {
      if (!user.outletId) {
        return NextResponse.json({
          success: true,
          data: [],
        });
      }

      where.outletPurchase = {
        outletId: user.outletId,
      };
    }

    /*
    ========================================================
    QUERY
    ========================================================
    */

    const payments =
      await prisma.payment.findMany({
        where,

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
              purchaseDate: true,
              status: true,
              total: true,
              paymentMethod: true,
              payable: true,
            },
          },

          outletPurchase: {
            select: {
              id: true,
              number: true,
              purchaseDate: true,
              status: true,
              total: true,
              paymentMethod: true,

              outlet: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },

              payable: true,
            },
          },
        },

        orderBy: [
          {
            paymentDate: "desc",
          },
          {
            id: "desc",
          },
        ],
      });

    return NextResponse.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    console.error(
      "GET PAYMENT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil data payment",
      },
      {
        status: 500,
      }
    );
  }
}

/*
===========================================================
POST PAYMENT
===========================================================
*/

export async function POST(
  req: NextRequest
) {
  try {
    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await req.json();

    const {
      purchaseId,
      outletPurchaseId,
      supplierId,
      amount,
      method,
      referenceNumber,
      note,
      remarks,
      paymentDate,
    } = body;

    const paymentAmount =
      Number(amount);

    if (
      !Number.isFinite(
        paymentAmount
      ) ||
      paymentAmount <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Jumlah pembayaran harus lebih dari 0",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    SOURCE
    ========================================================
    */

    const pusatPurchaseId =
      purchaseId !== undefined &&
      purchaseId !== null &&
      purchaseId !== ""
        ? Number(purchaseId)
        : null;

    const outletPurchaseIdValue =
      outletPurchaseId !==
        undefined &&
      outletPurchaseId !== null &&
      outletPurchaseId !== ""
        ? Number(outletPurchaseId)
        : null;

    if (
      pusatPurchaseId === null &&
      outletPurchaseIdValue === null
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment harus terkait PO pusat atau PO outlet",
        },
        {
          status: 400,
        }
      );
    }

    if (
      pusatPurchaseId !== null &&
      outletPurchaseIdValue !== null
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment tidak boleh terkait PO pusat dan PO outlet sekaligus",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    METHOD
    ========================================================
    */

    const paymentMethod =
      method ||
      PaymentMethod.CASH;

    if (
      !Object.values(
        PaymentMethod
      ).includes(
        paymentMethod as PaymentMethod
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Metode pembayaran tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    let purchase: any = null;
    let outletPurchase: any = null;

    /*
    ========================================================
    PO PUSAT
    ========================================================
    */

    if (
      pusatPurchaseId !== null
    ) {
      if (
        !Number.isInteger(
          pusatPurchaseId
        ) ||
        pusatPurchaseId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Purchase ID tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      purchase =
        await prisma.purchase.findUnique({
          where: {
            id: pusatPurchaseId,
          },

          include: {
            supplier: true,
          },
        });

      if (!purchase) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Purchase Order tidak ditemukan",
          },
          {
            status: 404,
          }
        );
      }

      if (
        purchase.status !== "APPROVED" &&
        purchase.status !== "RECEIVED"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "PO belum APPROVED sehingga belum dapat dibuat payment",
          },
          {
            status: 400,
          }
        );
      }

      if (
        user.role ===
        Role.OUTLET_ADMIN
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet tidak dapat membuat payment untuk PO pusat",
          },
          {
            status: 403,
          }
        );
      }
    }

    /*
    ========================================================
    PO OUTLET
    ========================================================
    */

    if (
      outletPurchaseIdValue !==
      null
    ) {
      if (
        !Number.isInteger(
          outletPurchaseIdValue
        ) ||
        outletPurchaseIdValue <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Purchase outlet ID tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      outletPurchase =
        await prisma.outletPurchase.findUnique(
          {
            where: {
              id:
                outletPurchaseIdValue,
            },

            include: {
              supplier: true,
              outlet: true,
            },
          }
        );

      if (!outletPurchase) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Purchase Order outlet tidak ditemukan",
          },
          {
            status: 404,
          }
        );
      }

      if (
        user.role ===
        Role.OUTLET_ADMIN
      ) {
        if (
          user.outletId !==
          outletPurchase.outletId
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Anda tidak memiliki akses ke PO outlet ini",
            },
            {
              status: 403,
            }
          );
        }
      }

      if (
        outletPurchase.status !==
          "APPROVED" &&
        outletPurchase.status !==
          "RECEIVED"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "PO outlet belum APPROVED sehingga belum dapat dibuat payment",
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
    ========================================================
    SUPPLIER
    ========================================================
    */

    const actualSupplierId =
      purchase?.supplierId ??
      outletPurchase?.supplierId ??
      (
        supplierId
          ? Number(supplierId)
          : null
      );

    if (
      !actualSupplierId ||
      !Number.isInteger(
        Number(actualSupplierId)
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Supplier tidak ditemukan",
        },
        {
          status: 400,
        }
      );
    }

    const supplier =
      await prisma.supplier.findUnique({
        where: {
          id:
            Number(actualSupplierId),
        },
      });

    if (!supplier) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Supplier tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    /*
    ========================================================
    CEK PAYMENT SEBELUMNYA
    ========================================================
    */

    const existingPayments =
      await prisma.payment.aggregate({
        where:
          pusatPurchaseId !== null
            ? {
                purchaseId:
                  pusatPurchaseId,

                status: {
                  in: [
                    PaymentStatus.PENDING,
                    PaymentStatus.APPROVED,
                    PaymentStatus.PAID,
                  ],
                },
              }
            : {
                outletPurchaseId:
                  outletPurchaseIdValue,

                status: {
                  in: [
                    PaymentStatus.PENDING,
                    PaymentStatus.APPROVED,
                    PaymentStatus.PAID,
                  ],
                },
              },

        _sum: {
          amount: true,
        },
      });

    const alreadyReserved =
      Number(
        existingPayments._sum
          .amount ?? 0
      );

    const poTotal =
      Number(
        purchase?.total ??
        outletPurchase?.total ??
        0
      );

    const outstanding =
      Math.max(
        0,
        poTotal -
          alreadyReserved
      );

    if (
      paymentAmount >
      outstanding + 0.01
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Total payment melebihi nilai PO. Sisa yang dapat dibayar: ${outstanding}`,
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    PAYMENT NUMBER
    ========================================================
    */

    const now = new Date();

    const datePart =
      `${now.getFullYear()}${String(
        now.getMonth() + 1
      ).padStart(2, "0")}${String(
        now.getDate()
      ).padStart(2, "0")}`;

    const todayStart =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

    const tomorrowStart =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1
      );

    const count =
      await prisma.payment.count({
        where: {
          createdAt: {
            gte: todayStart,
            lt: tomorrowStart,
          },
        },
      });

    const number =
      `PAY-${datePart}-${String(
        count + 1
      ).padStart(4, "0")}`;

    /*
    ========================================================
    CREATE PAYMENT
    ========================================================
    */

    const payment =
      await prisma.payment.create({
        data: {
          number,

          purchaseId:
            pusatPurchaseId,

          outletPurchaseId:
            outletPurchaseIdValue,

          supplierId:
            Number(actualSupplierId),

          paymentDate:
            paymentDate
              ? new Date(paymentDate)
              : new Date(),

          amount:
            paymentAmount,

          method:
            paymentMethod as PaymentMethod,

          status:
            PaymentStatus.PENDING,

          referenceNumber:
            referenceNumber
              ? String(
                  referenceNumber
                ).trim()
              : null,

          note:
            note ??
            remarks
              ? String(
                  note ??
                    remarks
                ).trim()
              : null,

          createdBy:
            user.id,
        },

        include: {
          supplier: true,

          purchase: true,

          outletPurchase: {
            include: {
              outlet: true,
            },
          },
        },
      });

    /*
    ========================================================
    HISTORY
    ========================================================
    */

    await prisma.history.create({
      data: {
        transactionType:
          "PURCHASE",

        referenceNumber:
          payment.number,

        description:
          `Payment dibuat untuk ${
            purchase?.number ??
            outletPurchase?.number ??
            "-"
          } sebesar ${paymentAmount} dengan metode ${paymentMethod}`,

        userId:
          user.id,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message:
          "Payment berhasil dibuat",
        data: payment,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "POST PAYMENT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal membuat payment",
      },
      {
        status: 500,
      }
    );
  }
}

/*
===========================================================
PATCH PAYMENT
===========================================================

approve
reject
cancel

FINAL:

TRANSFER
  APPROVE -> PAID
  NO PETTY CASH
  NO PAYABLE

TEMPO
  APPROVE -> APPROVED
  CREATE/UPDATE PAYABLE
  NO PETTY CASH

CASH/COD/CBD
  APPROVE
  CHECK PETTY CASH
  PETTY CASH OUT
  PAYMENT PAID
  SYNC PAYABLE
===========================================================
*/

export async function PATCH(
  req: NextRequest
) {
  try {
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
    ADMIN / MANAGER ONLY
    ========================================================
    */

    if (
      user.role !== Role.ADMIN &&
      user.role !== Role.MANAGER
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki hak untuk approval payment",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      await req.json();

    const paymentId =
      Number(body.paymentId);

    const action =
      String(
        body.action ?? "approve"
      )
        .trim()
        .toLowerCase();

    if (
      !Number.isInteger(paymentId) ||
      paymentId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment ID tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    GET PAYMENT
    ========================================================
    */

    const payment =
      await prisma.payment.findUnique({
        where: {
          id: paymentId,
        },

        include: {
          supplier: true,

          purchase: {
            include: {
              payable: true,
            },
          },

          outletPurchase: {
            include: {
              outlet: true,
              payable: true,
            },
          },
        },
      });

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
    REJECT
    ========================================================
    */

    if (
      action === "reject"
    ) {
      if (
        payment.status !==
        PaymentStatus.PENDING
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Payment hanya dapat ditolak saat status PENDING",
          },
          {
            status: 400,
          }
        );
      }

      const rejected =
        await prisma.payment.update({
          where: {
            id:
              payment.id,
          },

          data: {
            status:
              PaymentStatus.REJECTED,
          },

          include: {
            supplier: true,

            purchase: true,

            outletPurchase: {
              include: {
                outlet: true,
              },
            },
          },
        });

      await prisma.history.create({
        data: {
          transactionType:
            "PURCHASE",

          referenceNumber:
            payment.number,

          description:
            `Payment ${payment.number} ditolak oleh ${user.fullname}`,

          userId:
            user.id,
        },
      });

      return NextResponse.json({
        success: true,
        message:
          "Payment berhasil ditolak",
        data: rejected,
      });
    }

    /*
    ========================================================
    CANCEL
    ========================================================
    */

    if (
      action === "cancel"
    ) {
      if (
        payment.status ===
        PaymentStatus.PAID
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Payment yang sudah PAID tidak dapat dibatalkan",
          },
          {
            status: 400,
          }
        );
      }

      if (
        payment.status ===
        PaymentStatus.CANCELLED
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Payment sudah CANCELLED",
          },
          {
            status: 400,
          }
        );
      }

      const cancelled =
        await prisma.payment.update({
          where: {
            id:
              payment.id,
          },

          data: {
            status:
              PaymentStatus.CANCELLED,
          },

          include: {
            supplier: true,

            purchase: true,

            outletPurchase: {
              include: {
                outlet: true,
              },
            },
          },
        });

      await prisma.history.create({
        data: {
          transactionType:
            "PURCHASE",

          referenceNumber:
            payment.number,

          description:
            `Payment ${payment.number} dibatalkan oleh ${user.fullname}`,

          userId:
            user.id,
        },
      });

      return NextResponse.json({
        success: true,
        message:
          "Payment berhasil dibatalkan",
        data: cancelled,
      });
    }

    /*
    ========================================================
    ONLY APPROVE
    ========================================================
    */

    if (
      action !== "approve"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Action tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    if (
      payment.status !==
      PaymentStatus.PENDING
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Payment tidak dapat di-approve karena status saat ini ${payment.status}`,
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    VALIDASI SUMBER
    ========================================================
    */

    const isCentral =
      payment.purchaseId !== null;

    const isOutlet =
      payment.outletPurchaseId !== null;

    if (!isCentral && !isOutlet) {
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

    if (isCentral && isOutlet) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment memiliki dua sumber PO",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    OUTLET ID
    ========================================================
    */

    const outletId =
      payment.outletPurchase
        ?.outletId ??
      null;

    /*
    ========================================================
    TRANSACTION
    ========================================================
    */

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
          ==================================================
          RECHECK PAYMENT
          ==================================================
          */

          const currentPayment =
            await tx.payment.findUnique({
              where: {
                id:
                  payment.id,
              },
            });

          if (!currentPayment) {
            throw new Error(
              "PAYMENT_NOT_FOUND"
            );
          }

          if (
            currentPayment.status !==
            PaymentStatus.PENDING
          ) {
            throw new Error(
              "PAYMENT_ALREADY_PROCESSED"
            );
          }

          /*
          ==================================================
          TRANSFER
          ==================================================

          TRANSFER TIDAK menggunakan Petty Cash.

          TRANSFER:
            PENDING
              ↓
            APPROVE
              ↓
            PAID

          Tidak:
            - pettyCash.create
            - pettyCashAccount.update
            - PurchasePayable
          ==================================================
          */

          if (
            isTransferPaymentMethod(
              currentPayment.method
            )
          ) {
            const approved =
              await tx.payment.update({
                where: {
                  id:
                    currentPayment.id,
                },

                data: {
                  status:
                    PaymentStatus.PAID,

                  approvedBy:
                    user.id,

                  approvedAt:
                    new Date(),
                },

                include: {
                  supplier: true,

                  purchase: true,

                  outletPurchase: {
                    include: {
                      outlet: true,
                    },
                  },
                },
              });

            /*
            TRANSFER TIDAK SYNC PAYABLE
            karena bukan hutang.
            */

            return {
              payment: approved,

              pettyCash: null,

              payable: null,

              paymentType:
                "TRANSFER",
            };
          }

          /*
          ==================================================
          TEMPO
          ==================================================
          */

          if (
            isTempoPaymentMethod(
              currentPayment.method
            )
          ) {
            const invoiceNumber =
              String(
                body.invoiceNumber ??
                  currentPayment.referenceNumber ??
                  currentPayment.number
              ).trim();

            const invoiceDate =
              body.invoiceDate
                ? new Date(
                    body.invoiceDate
                  )
                : currentPayment.paymentDate;

            const dueDate =
              body.dueDate
                ? new Date(
                    body.dueDate
                  )
                : null;

            /*
            ==================================================
            TEMPO PUSAT
            ==================================================
            */

            if (isCentral) {
              const purchaseId =
                currentPayment.purchaseId!;

              const purchase =
                await tx.purchase.findUnique({
                  where: {
                    id:
                      purchaseId,
                  },
                });

              if (!purchase) {
                throw new Error(
                  "PURCHASE_NOT_FOUND"
                );
              }

              const existingPayable =
                await tx.purchasePayable.findUnique(
                  {
                    where: {
                      purchaseId,
                    },
                  }
                );

              if (existingPayable) {
                const newAmount =
                  Number(
                    existingPayable.amount
                  ) +
                  Number(
                    currentPayment.amount
                  );

                const newOutstanding =
                  Math.max(
                    0,
                    newAmount -
                      Number(
                        existingPayable.paidAmount
                      )
                  );

                await tx.purchasePayable.update(
                  {
                    where: {
                      id:
                        existingPayable.id,
                    },

                    data: {
                      amount:
                        newAmount,

                      outstanding:
                        newOutstanding,

                      invoiceNumber,

                      invoiceDate,

                      dueDate,

                      status:
                        newOutstanding <=
                        0.01
                          ? "PAID"
                          : "OUTSTANDING",
                    },
                  }
                );
              } else {
                await tx.purchasePayable.create(
                  {
                    data: {
                      purchaseId,

                      supplierId:
                        currentPayment.supplierId,

                      outletId: null,

                      invoiceNumber,

                      invoiceDate,

                      dueDate,

                      amount:
                        Number(
                          currentPayment.amount
                        ),

                      paidAmount: 0,

                      outstanding:
                        Number(
                          currentPayment.amount
                        ),

                      status:
                        "OUTSTANDING",
                    },
                  }
                );
              }
            }

            /*
            ==================================================
            TEMPO OUTLET
            ==================================================
            */

            if (isOutlet) {
              const outletPurchaseId =
                currentPayment
                  .outletPurchaseId!;

              const outletPurchase =
                await tx.outletPurchase.findUnique(
                  {
                    where: {
                      id:
                        outletPurchaseId,
                    },
                  }
                );

              if (!outletPurchase) {
                throw new Error(
                  "OUTLET_PURCHASE_NOT_FOUND"
                );
              }

              const existingPayable =
                await tx.purchasePayable.findUnique(
                  {
                    where: {
                      outletPurchaseId,
                    },
                  }
                );

              if (existingPayable) {
                const newAmount =
                  Number(
                    existingPayable.amount
                  ) +
                  Number(
                    currentPayment.amount
                  );

                const newOutstanding =
                  Math.max(
                    0,
                    newAmount -
                      Number(
                        existingPayable.paidAmount
                      )
                  );

                await tx.purchasePayable.update(
                  {
                    where: {
                      id:
                        existingPayable.id,
                    },

                    data: {
                      amount:
                        newAmount,

                      outstanding:
                        newOutstanding,

                      invoiceNumber,

                      invoiceDate,

                      dueDate,

                      status:
                        newOutstanding <=
                        0.01
                          ? "PAID"
                          : "OUTSTANDING",
                    },
                  }
                );
              } else {
                await tx.purchasePayable.create(
                  {
                    data: {
                      outletPurchaseId,

                      supplierId:
                        currentPayment.supplierId,

                      outletId:
                        outletPurchase.outletId,

                      invoiceNumber,

                      invoiceDate,

                      dueDate,

                      amount:
                        Number(
                          currentPayment.amount
                        ),

                      paidAmount: 0,

                      outstanding:
                        Number(
                          currentPayment.amount
                        ),

                      status:
                        "OUTSTANDING",
                    },
                  }
                );
              }
            }

            /*
            ==================================================
            PAYMENT APPROVED
            ==================================================
            */

            const approved =
              await tx.payment.update({
                where: {
                  id:
                    currentPayment.id,
                },

                data: {
                  status:
                    PaymentStatus.APPROVED,

                  approvedBy:
                    user.id,

                  approvedAt:
                    new Date(),
                },

                include: {
                  supplier: true,

                  purchase: true,

                  outletPurchase: {
                    include: {
                      outlet: true,
                    },
                  },
                },
              });

            return {
              payment: approved,

              pettyCash: null,

              payable: true,

              paymentType:
                "TEMPO",
            };
          }

          /*
          ==================================================
          CASH / COD / CBD
          ==================================================
          */

          if (
            !isPettyCashPaymentMethod(
              currentPayment.method
            )
          ) {
            throw new Error(
              "INVALID_PAYMENT_METHOD"
            );
          }

          /*
          ==================================================
          CARI AKUN PETTY CASH
          ==================================================

          PUSAT:
            outletId = null

          OUTLET:
            outletId = outletPurchase.outletId

          HANYA jalur CASH/COD/CBD yang sampai ke sini.
          TRANSFER sudah keluar di atas.
          ==================================================
          */

          const pettyCashAccount =
            await tx.pettyCashAccount.findFirst(
              {
                where: {
                  outletId:
                    outletId,

                  isActive: true,
                },

                orderBy: {
                  id: "asc",
                },
              }
            );

          if (!pettyCashAccount) {
            throw new Error(
              outletId
                ? "PETTY_CASH_OUTLET_ACCOUNT_NOT_FOUND"
                : "PETTY_CASH_CENTER_ACCOUNT_NOT_FOUND"
            );
          }

          /*
          ==================================================
          SALDO
          ==================================================
          */

          const balanceBefore =
            Number(
              pettyCashAccount.currentBalance
            );

          const paymentAmount =
            Number(
              currentPayment.amount
            );

          if (
            balanceBefore <
            paymentAmount
          ) {
            throw new Error(
              `PETTY_CASH_INSUFFICIENT:${balanceBefore}`
            );
          }

          const balanceAfter =
            balanceBefore -
            paymentAmount;

          /*
          ==================================================
          PETTY CASH NUMBER
          ==================================================
          */

          const now =
            new Date();

          const datePart =
            `${now.getFullYear()}${String(
              now.getMonth() + 1
            ).padStart(
              2,
              "0"
            )}${String(
              now.getDate()
            ).padStart(
              2,
              "0"
            )}`;

          const todayStart =
            new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate()
            );

          const tomorrowStart =
            new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate() + 1
            );

          const pettyCount =
            await tx.pettyCash.count({
              where: {
                createdAt: {
                  gte:
                    todayStart,

                  lt:
                    tomorrowStart,
                },
              },
            });

          const pettyNumber =
            `PC-${datePart}-${String(
              pettyCount + 1
            ).padStart(
              4,
              "0"
            )}`;

          /*
          ==================================================
          SOURCE NUMBER
          ==================================================
          */

          let sourceNumber =
            isCentral
              ? "PO Pusat"
              : "PO Outlet";

          if (
            isCentral &&
            currentPayment.purchaseId
          ) {
            const source =
              await tx.purchase.findUnique({
                where: {
                  id:
                    currentPayment.purchaseId,
                },

                select: {
                  number: true,
                },
              });

            sourceNumber =
              source?.number ??
              "PO Pusat";
          }

          if (
            isOutlet &&
            currentPayment.outletPurchaseId
          ) {
            const source =
              await tx.outletPurchase.findUnique(
                {
                  where: {
                    id:
                      currentPayment
                        .outletPurchaseId,
                  },

                  select: {
                    number: true,
                  },
                }
              );

            sourceNumber =
              source?.number ??
              "PO Outlet";
          }

          /*
          ==================================================
          CREATE PETTY CASH OUT
          ==================================================
          */

          const pettyCash =
            await tx.pettyCash.create({
              data: {
                number:
                  pettyNumber,

                trxDate:
                  new Date(),

                type:
                  PettyCashType.OUT,

                category:
                  "PAYMENT",

                description:
                  `Payment ${currentPayment.number} - ${currentPayment.method} - ${sourceNumber} - Supplier ${currentPayment.supplierId}`,

                amount:
                  paymentAmount,

                balanceBefore,

                balanceAfter,

                accountId:
                  pettyCashAccount.id,

                paymentId:
                  currentPayment.id,

                outletId,

                createdBy:
                  user.id,

                approvedBy:
                  user.id,

                status:
                  PettyCashStatus.APPROVED,

                approvedAt:
                  new Date(),
              },
            });

          /*
          ==================================================
          UPDATE PETTY CASH ACCOUNT
          ==================================================
          */

          await tx.pettyCashAccount.update({
            where: {
              id:
                pettyCashAccount.id,
            },

            data: {
              currentBalance:
                balanceAfter,
            },
          });

          /*
          ==================================================
          PAYMENT PAID
          ==================================================
          */

          const approved =
            await tx.payment.update({
              where: {
                id:
                  currentPayment.id,
              },

              data: {
                status:
                  PaymentStatus.PAID,

                approvedBy:
                  user.id,

                approvedAt:
                  new Date(),
              },

              include: {
                supplier: true,

                purchase: true,

                outletPurchase: {
                  include: {
                    outlet: true,
                  },
                },
              },
            });

          /*
          ==================================================
          SYNC PAYABLE
          ==================================================
          */

          const payable =
            await syncPurchasePayable(
              tx,
              {
                purchaseId:
                  currentPayment.purchaseId,

                outletPurchaseId:
                  currentPayment
                    .outletPurchaseId,
              }
            );

          return {
            payment: approved,

            pettyCash,

            payable,

            paymentType:
              "PETTY_CASH",
          };
        }
      );

    /*
    ========================================================
    HISTORY
    ========================================================
    */

    let historyDescription =
      "";

    if (
      payment.method ===
      PaymentMethod.TRANSFER
    ) {
      historyDescription =
        `Payment ${payment.number} disetujui sebagai TRANSFER dan langsung LUNAS. Tidak menggunakan Petty Cash dan tidak membuat hutang.`;
    } else if (
      payment.method ===
      PaymentMethod.TEMPO
    ) {
      historyDescription =
        `Payment ${payment.number} disetujui sebagai TEMPO dan masuk Purchase Payable. Tidak menggunakan Petty Cash.`;
    } else {
      historyDescription =
        `Payment ${payment.number} disetujui dengan metode ${payment.method} dan Petty Cash ${
          outletId
            ? "outlet"
            : "pusat"
        } dipotong sebesar ${payment.amount}.`;
    }

    await prisma.history.create({
      data: {
        transactionType:
          "PURCHASE",

        referenceNumber:
          payment.number,

        description:
          historyDescription,

        userId:
          user.id,
      },
    });

    /*
    ========================================================
    RESPONSE
    ========================================================
    */

    let message =
      "Payment berhasil diproses";

    if (
      payment.method ===
      PaymentMethod.TRANSFER
    ) {
      message =
        "Payment TRANSFER berhasil disetujui dan langsung LUNAS";
    } else if (
      payment.method ===
      PaymentMethod.TEMPO
    ) {
      message =
        "Payment TEMPO berhasil disetujui dan masuk Purchase Payable";
    } else {
      message =
        `Payment berhasil disetujui dan Petty Cash ${
          outletId
            ? "outlet"
            : "pusat"
        } telah dipotong`;
    }

    return NextResponse.json({
      success: true,

      message,

      data: {
        payment:
          result.payment,

        pettyCash:
          result.pettyCash,

        payable:
          result.payable,

        paymentType:
          result.paymentType,
      },
    });
  } catch (error: any) {
    console.error(
      "PATCH PAYMENT ERROR:",
      error
    );

    const message =
      String(
        error?.message ?? ""
      );

    /*
    ========================================================
    ERROR HANDLING
    ========================================================
    */

    if (
      message ===
      "PAYMENT_NOT_FOUND"
    ) {
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

    if (
      message ===
      "PAYMENT_ALREADY_PROCESSED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment sudah diproses sebelumnya",
        },
        {
          status: 400,
        }
      );
    }

    if (
      message ===
      "PURCHASE_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "PO pusat tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    if (
      message ===
      "OUTLET_PURCHASE_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "PO outlet tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    if (
      message ===
      "MULTIPLE_PURCHASE_SOURCE"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment tidak boleh memiliki PO pusat dan PO outlet sekaligus",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    PETTY CASH ACCOUNT
    ========================================================
    */

    if (
      message ===
      "PETTY_CASH_CENTER_ACCOUNT_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Akun Petty Cash Pusat belum tersedia atau tidak aktif. Buat/aktifkan akun Petty Cash Pusat terlebih dahulu.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      message ===
      "PETTY_CASH_OUTLET_ACCOUNT_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Akun Petty Cash Outlet belum tersedia atau tidak aktif. Buat/aktifkan akun Petty Cash untuk outlet tersebut terlebih dahulu.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    INSUFFICIENT BALANCE
    ========================================================
    */

    if (
      message.startsWith(
        "PETTY_CASH_INSUFFICIENT:"
      )
    ) {
      const balance =
        message.split(":")[1];

      return NextResponse.json(
        {
          success: false,
          message:
            `Saldo Petty Cash tidak mencukupi. Saldo saat ini: ${balance}`,
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    INVALID METHOD
    ========================================================
    */

    if (
      message ===
      "INVALID_PAYMENT_METHOD"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Metode payment tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    DEFAULT
    ========================================================
    */

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal memproses payment",
      },
      {
        status: 500,
      }
    );
  }
}