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
  PettyCashStatus,
  PettyCashType,
} from "@prisma/client";

/*
===========================================================
PAYMENT API
===========================================================

PO PUSAT
Purchase
   ↓
Payment PENDING
   ↓
Approve Payment
   ↓
CASH / TRANSFER / COD / CBD
   ↓
Petty Cash Pusat

TEMPO
   ↓
PurchasePayable
   ↓
TIDAK memotong Petty Cash


PO OUTLET
OutletPurchase
   ↓
Payment PENDING
   ↓
Approve Payment
   ↓
CASH / TRANSFER / COD / CBD
   ↓
Petty Cash Outlet

TEMPO
   ↓
PurchasePayable
   ↓
TIDAK memotong Petty Cash
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

    const userId = Number(
      sessionUser?.id
    );

    if (
      !Number.isInteger(userId) ||
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

function isCashPaymentMethod(
  method: PaymentMethod
) {
  return (
    method === PaymentMethod.CASH ||
    method === PaymentMethod.TRANSFER ||
    method === PaymentMethod.COD ||
    method === PaymentMethod.CBD
  );
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
    FILTER STATUS
    ========================================================
    */

    if (
      status &&
      Object.values(
        PaymentStatus
      ).includes(
        status as PaymentStatus
      )
    ) {
      where.status =
        status as PaymentStatus;
    }

    /*
    ========================================================
    FILTER SUPPLIER
    ========================================================
    */

    if (supplierIdParam) {
      const supplierId =
        Number(supplierIdParam);

      if (
        Number.isInteger(
          supplierId
        ) &&
        supplierId > 0
      ) {
        where.supplierId =
          supplierId;
      }
    }

    /*
    ========================================================
    FILTER PO PUSAT
    ========================================================
    */

    if (purchaseIdParam) {
      const purchaseId =
        Number(purchaseIdParam);

      if (
        Number.isInteger(
          purchaseId
        ) &&
        purchaseId > 0
      ) {
        where.purchaseId =
          purchaseId;
      }
    }

    /*
    ========================================================
    FILTER PO OUTLET
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
      user.role ===
      Role.OUTLET_ADMIN
    ) {
      if (!user.outletId) {
        return NextResponse.json({
          success: true,
          data: [],
        });
      }

      where.AND = [
        {
          outletPurchase: {
            outletId:
              user.outletId,
          },
        },
      ];
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
            paymentDate:
              "desc",
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
    SOURCE PO
    ========================================================
    */

    const pusatPurchaseId =
      purchaseId !==
        undefined &&
      purchaseId !== null &&
      purchaseId !== ""
        ? Number(purchaseId)
        : null;

    const outletPurchaseIdValue =
      outletPurchaseId !==
        undefined &&
      outletPurchaseId !== null &&
      outletPurchaseId !== ""
        ? Number(
            outletPurchaseId
          )
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
        purchase.status !==
          "APPROVED" &&
        purchase.status !==
          "RECEIVED"
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
      outletPurchaseIdValue !== null
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
        await prisma.outletPurchase.findUnique({
          where: {
            id:
              outletPurchaseIdValue,
          },

          include: {
            supplier: true,
            outlet: true,
          },
        });

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
          id: Number(
            actualSupplierId
          ),
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
    PAYMENT SEBELUMNYA
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

    const alreadyPaid =
      Number(
        existingPayments
          ._sum.amount ?? 0
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
        poTotal - alreadyPaid
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
    NUMBER
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
            Number(
              actualSupplierId
            ),

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
            (
              note ??
              remarks
            )
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

ACTION:
approve
reject
cancel

APPROVE:
CASH      → Petty Cash OUT
TRANSFER  → Petty Cash OUT
COD       → Petty Cash OUT
CBD       → Petty Cash OUT
TEMPO     → PurchasePayable

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
    ONLY ADMIN / MANAGER
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
      !Number.isInteger(
        paymentId
      ) ||
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

    if (action === "reject") {
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
            id: payment.id,
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

    if (action === "cancel") {
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
            id: payment.id,
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
    APPROVE
    ========================================================
    */

    if (action !== "approve") {
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
    VALIDASI SUMBER PO
    ========================================================
    */

    const isCentral =
      !!payment.purchaseId;

    const isOutlet =
      !!payment.outletPurchaseId;

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
    APPROVAL DALAM TRANSACTION
    ========================================================
    */

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
          ==================================================
          CEK ULANG PAYMENT
          ==================================================
          */

          const currentPayment =
            await tx.payment.findUnique({
              where: {
                id: payment.id,
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
          TEMPO
          ==================================================

          TEMPO TIDAK MENYENTUH PETTY CASH.

          TEMPO masuk PurchasePayable.
          */

          if (
            currentPayment.method ===
            PaymentMethod.TEMPO
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

            if (isCentral) {
              const purchaseId =
                currentPayment.purchaseId!;

              const existingPayable =
                await tx.purchasePayable.findUnique(
                  {
                    where: {
                      purchaseId,
                    },
                  }
                );

              if (
                existingPayable
              ) {
                const newAmount =
                  existingPayable.amount +
                  currentPayment.amount;

                const newOutstanding =
                  Math.max(
                    0,
                    newAmount -
                      existingPayable.paidAmount
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
                        0
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
                        currentPayment.amount,

                      paidAmount: 0,

                      outstanding:
                        currentPayment.amount,

                      status:
                        "OUTSTANDING",
                    },
                  }
                );
              }
            }

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

              if (
                existingPayable
              ) {
                const newAmount =
                  existingPayable.amount +
                  currentPayment.amount;

                const newOutstanding =
                  Math.max(
                    0,
                    newAmount -
                      existingPayable.paidAmount
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
                        0
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
                        currentPayment.amount,

                      paidAmount: 0,

                      outstanding:
                        currentPayment.amount,

                      status:
                        "OUTSTANDING",
                    },
                  }
                );
              }
            }

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
              });

            return {
              payment:
                approved,

              pettyCash: null,

              payable: true,
            };
          }

          /*
          ==================================================
          CASH / TRANSFER / COD / CBD
          ==================================================
          */

          if (
            !isCashPaymentMethod(
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
          outletId = NULL

          OUTLET:
          outletId = outletPurchase.outletId
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
          CEK SALDO
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
          GENERATE PETTY CASH NUMBER
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

          const pettyCount =
            await tx.pettyCash.count({
              where: {
                createdAt: {
                  gte:
                    new Date(
                      now.getFullYear(),
                      now.getMonth(),
                      now.getDate()
                    ),

                  lt:
                    new Date(
                      now.getFullYear(),
                      now.getMonth(),
                      now.getDate() + 1
                    ),
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
                  `Payment ${currentPayment.number} - ${
                    currentPayment.method
                  } - ${
                    isCentral
                      ? payment.purchase?.number ??
                        "PO Pusat"
                      : payment
                          .outletPurchase
                          ?.number ??
                        "PO Outlet"
                  } - Supplier ${
                    currentPayment
                      .supplierId
                  }`,

                amount:
                  paymentAmount,

                balanceBefore,

                balanceAfter,

                accountId:
                  pettyCashAccount.id,

                paymentId:
                  currentPayment.id,

                outletId:
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

          await tx.pettyCashAccount.update(
            {
              where: {
                id:
                  pettyCashAccount.id,
              },

              data: {
                currentBalance:
                  balanceAfter,
              },
            }
          );

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
                  PaymentStatus.PAID,

                approvedBy:
                  user.id,

                approvedAt:
                  new Date(),
              },
            });

          return {
            payment:
              approved,

            pettyCash,

            payable: false,
          };
        }
      );

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
          payment.method ===
          PaymentMethod.TEMPO
            ? `Payment ${payment.number} disetujui sebagai TEMPO dan masuk Purchase Payable`
            : `Payment ${payment.number} disetujui dan ${
                result.pettyCash
                  ? `memotong Petty Cash sebesar ${payment.amount}`
                  : "diproses"
              }`,

        userId:
          user.id,
      },
    });

    return NextResponse.json({
      success: true,

      message:
        payment.method ===
        PaymentMethod.TEMPO
          ? "Payment TEMPO berhasil disetujui dan masuk Purchase Payable"
          : `Payment berhasil disetujui dan Petty Cash ${
              outletId
                ? "outlet"
                : "pusat"
            } telah dipotong`,

      data: {
        payment:
          result.payment,

        pettyCash:
          result.pettyCash,

        payable:
          result.payable,
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
      "PETTY_CASH_CENTER_ACCOUNT_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Akun Petty Cash Pusat belum tersedia atau tidak aktif",
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
            "Akun Petty Cash Outlet belum tersedia atau tidak aktif",
        },
        {
          status: 400,
        }
      );
    }

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