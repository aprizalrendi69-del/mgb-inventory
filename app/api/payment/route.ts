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
PAYMENT API
===========================================================

PO PUSAT
Purchase
   ↓
Payment
   ↓
Approve
   ↓
Petty Cash Pusat

PO OUTLET
OutletPurchase
   ↓
Payment
   ↓
Approve
   ↓
Petty Cash Outlet tersebut

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
          active: true,
          outletId: true,
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
      "GET CURRENT USER PAYMENT ERROR:",
      error
    );

    return null;
  }
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
          message:
            "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const {
      searchParams,
    } =
      new URL(req.url);

    const status =
      searchParams.get(
        "status"
      );

    const supplierIdParam =
      searchParams.get(
        "supplierId"
      );

    const purchaseIdParam =
      searchParams.get(
        "purchaseId"
      );

    const outletPurchaseIdParam =
      searchParams.get(
        "outletPurchaseId"
      );

    const where: any =
      {};

    /*
    ========================================================
    FILTER
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

    if (
      supplierIdParam
    ) {
      const supplierId =
        Number(
          supplierIdParam
        );

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

    if (
      purchaseIdParam
    ) {
      const purchaseId =
        Number(
          purchaseIdParam
        );

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

    if (
      outletPurchaseIdParam
    ) {
      const outletPurchaseId =
        Number(
          outletPurchaseIdParam
        );

      if (
        Number.isInteger(
          outletPurchaseId
        ) &&
        outletPurchaseId >
          0
      ) {
        where.outletPurchaseId =
          outletPurchaseId;
      }
    }

    /*
    ========================================================
    OUTLET ADMIN
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
            },
          },

          outletPurchase: {
            select: {
              id: true,
              number: true,
              purchaseDate: true,
              status: true,
              total: true,

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
          message:
            "Unauthorized",
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
        ? Number(
            purchaseId
          )
        : null;

    const outletPurchaseIdValue =
      outletPurchaseId !==
        undefined &&
      outletPurchaseId !==
        null &&
      outletPurchaseId !==
        ""
        ? Number(
            outletPurchaseId
          )
        : null;

    if (
      pusatPurchaseId ===
        null &&
      outletPurchaseIdValue ===
        null
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
      pusatPurchaseId !==
        null &&
      outletPurchaseIdValue !==
        null
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

    let purchase: any =
      null;

    let outletPurchase:
      any = null;

    /*
    ========================================================
    PO PUSAT
    ========================================================
    */

    if (
      pusatPurchaseId !==
      null
    ) {
      if (
        !Number.isInteger(
          pusatPurchaseId
        ) ||
        pusatPurchaseId <=
          0
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
            id:
              pusatPurchaseId,
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

      /*
      OUTLET ADMIN TIDAK BOLEH
      MEMBUAT PAYMENT PO PUSAT
      */

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
        outletPurchaseIdValue <=
          0
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
          ? Number(
              supplierId
            )
          : null
      );

    if (
      !actualSupplierId ||
      !Number.isInteger(
        Number(
          actualSupplierId
        )
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
            Number(
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
          pusatPurchaseId !==
          null
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
          ._sum.amount ??
          0
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
          alreadyPaid
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

    const count =
      await prisma.payment.count({
        where: {
          createdAt: {
            gte:
              todayStart,
            lt:
              tomorrowStart,
          },
        },
      });

    const number =
      `PAY-${datePart}-${String(
        count + 1
      ).padStart(
        4,
        "0"
      )}`;

    /*
    ========================================================
    CREATE
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
              ? new Date(
                  paymentDate
                )
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
          } sebesar ${paymentAmount}`,

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