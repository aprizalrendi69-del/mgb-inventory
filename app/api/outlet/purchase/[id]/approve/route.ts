import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import {
  OutletPurchaseStatus,
  PaymentMethod,
  PaymentStatus,
  PettyCashStatus,
  PettyCashType,
  Role,
} from "@prisma/client";

import { cookies } from "next/headers";

/*
===========================================================
APPROVE PURCHASE OUTLET API
===========================================================

PAYMENT RULE
-----------------------------------------------------------
CASH
COD
CBD
    -> langsung PAID
    -> mengurangi Petty Cash Outlet
    -> membuat transaksi Petty Cash OUT

TRANSFER
    -> langsung PAID
    -> TIDAK mengurangi Petty Cash
    -> TIDAK membuat hutang

TEMPO
    -> tidak mengurangi Petty Cash
    -> membuat PurchasePayable
    -> Payment tidak dibuat

PETTY CASH
-----------------------------------------------------------
Setiap outlet mempunyai account sendiri.

Outlet 1
    account.outletId = 1

Outlet 2
    account.outletId = 2

Pusat
    account.outletId = null

Purchase Outlet SELALU:
    account.outletId === purchase.outletId

Tidak boleh menggunakan:
    account Pusat
    account Outlet lain
===========================================================
*/

/*
===========================================================
GET CURRENT USER
===========================================================
*/

async function getCurrentUser() {
  const cookieStore = await cookies();

  const sessionCookie =
    cookieStore.get("session") ||
    cookieStore.get("erp-session");

  if (!sessionCookie?.value) {
    return null;
  }

  /*
  ---------------------------------------------------------
  PRIORITAS:
  DATABASE SESSION
  ---------------------------------------------------------
  */

  try {
    const session =
      await prisma.session.findUnique({
        where: {
          token: sessionCookie.value,
        },

        select: {
          expiresAt: true,

          user: {
            select: {
              id: true,
              username: true,
              fullname: true,
              role: true,
              active: true,
              outletId: true,
            },
          },
        },
      });

    if (session) {
      if (
        session.expiresAt <
        new Date()
      ) {
        return null;
      }

      if (!session.user.active) {
        return null;
      }

      return session.user;
    }
  } catch (error) {
    console.error(
      "DATABASE SESSION CHECK ERROR:",
      error
    );
  }

  /*
  ---------------------------------------------------------
  FALLBACK JSON SESSION
  ---------------------------------------------------------
  */

  try {
    const parsed =
      JSON.parse(
        sessionCookie.value
      );

    const userId =
      Number(
        parsed?.user?.id ??
          parsed?.id ??
          0
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
      "JSON SESSION CHECK ERROR:",
      error
    );

    return null;
  }
}

/*
===========================================================
GENERATE PAYMENT NUMBER
===========================================================
*/

async function generatePaymentNumber(
  tx: any,
  paymentDate: Date
) {
  const year =
    paymentDate.getFullYear();

  const month = String(
    paymentDate.getMonth() + 1
  ).padStart(2, "0");

  const period =
    `${year}${month}`;

  const document =
    await tx.documentNumber.upsert({
      where: {
        type_period: {
          type: "PAYMENT",
          period,
        },
      },

      create: {
        type: "PAYMENT",
        prefix: "PAY",
        period,
        lastNumber: 1,
      },

      update: {
        lastNumber: {
          increment: 1,
        },
      },
    });

  return `${document.prefix}-${period}-${String(
    document.lastNumber
  ).padStart(5, "0")}`;
}

/*
===========================================================
GENERATE PETTY CASH NUMBER
===========================================================
*/

async function generatePettyCashNumber(
  tx: any,
  trxDate: Date
) {
  const year =
    trxDate.getFullYear();

  const month = String(
    trxDate.getMonth() + 1
  ).padStart(2, "0");

  const period =
    `${year}${month}`;

  const document =
    await tx.documentNumber.upsert({
      where: {
        type_period: {
          type: "PETTY_CASH",
          period,
        },
      },

      create: {
        type: "PETTY_CASH",
        prefix: "PC",
        period,
        lastNumber: 1,
      },

      update: {
        lastNumber: {
          increment: 1,
        },
      },
    });

  return `${document.prefix}-${period}-${String(
    document.lastNumber
  ).padStart(5, "0")}`;
}

/*
===========================================================
POST APPROVE PURCHASE OUTLET
===========================================================
*/

export async function POST(
  req: Request,
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
    1. PURCHASE ID
    ========================================================
    */

    const { id } =
      await params;

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
            "ID Purchase Outlet tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    2. USER
    ========================================================
    */

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Session tidak valid atau user tidak aktif",
        },
        {
          status: 401,
        }
      );
    }

    /*
    ========================================================
    3. ACCESS
    ========================================================
    
    Yang boleh approve:
      ADMIN
      PURCHASING

    OUTLET_ADMIN tidak boleh approve.
    ========================================================
    */

    const allowedRoles: Role[] = [
      Role.ADMIN,
      Role.PURCHASING,
    ];

    if (
      !allowedRoles.includes(
        user.role
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses untuk approve Purchase Outlet",
        },
        {
          status: 403,
        }
      );
    }

    /*
    ========================================================
    4. TRANSACTION
    ========================================================
    */

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
          ==================================================
          GET PURCHASE
          ==================================================
          */

          const purchase =
            await tx.outletPurchase.findUnique({
              where: {
                id: purchaseId,
              },

              include: {
                supplier: true,
                outlet: true,
                items: true,
                payable: true,
                payments: true,
              },
            });

          if (!purchase) {
            throw new Error(
              "Purchase Outlet tidak ditemukan"
            );
          }

          /*
          ==================================================
          STATUS
          ==================================================
          */

          if (
            purchase.status !==
            OutletPurchaseStatus.DRAFT
          ) {
            throw new Error(
              `Purchase Outlet sudah ${purchase.status} dan tidak dapat diapprove lagi`
            );
          }

          /*
          ==================================================
          OUTLET
          ==================================================
          */

          if (
            !purchase.outletId
          ) {
            throw new Error(
              "Purchase Outlet tidak memiliki outlet"
            );
          }

          if (!purchase.outlet) {
            throw new Error(
              "Outlet Purchase tidak ditemukan"
            );
          }

          /*
          ==================================================
          SUPPLIER
          ==================================================
          */

          if (!purchase.supplier) {
            throw new Error(
              "Supplier Purchase Outlet tidak ditemukan"
            );
          }

          /*
          ==================================================
          ITEM
          ==================================================
          */

          if (
            !purchase.items ||
            purchase.items.length === 0
          ) {
            throw new Error(
              "Purchase Outlet tidak memiliki barang"
            );
          }

          for (
            const item of
              purchase.items
          ) {
            const qty =
              Number(
                item.qty
              );

            const price =
              Number(
                item.price
              );

            if (
              !Number.isFinite(
                qty
              ) ||
              qty <= 0
            ) {
              throw new Error(
                "Terdapat qty barang yang tidak valid"
              );
            }

            if (
              !Number.isFinite(
                price
              ) ||
              price < 0
            ) {
              throw new Error(
                "Terdapat harga barang yang tidak valid"
              );
            }
          }

          /*
          ==================================================
          HITUNG TOTAL
          ==================================================
          */

          const calculatedTotal =
            purchase.items.reduce(
              (
                sum,
                item
              ) =>
                sum +
                Number(
                  item.qty
                ) *
                Number(
                  item.price
                ),
              0
            );

          if (
            !Number.isFinite(
              calculatedTotal
            ) ||
            calculatedTotal <= 0
          ) {
            throw new Error(
              "Total Purchase Outlet tidak valid"
            );
          }

          const total =
            calculatedTotal;

          /*
          ==================================================
          PAYMENT METHOD
          ==================================================
          */

          const paymentMethod =
            purchase.paymentMethod;

          const isPettyCashPayment =
            paymentMethod ===
              PaymentMethod.CASH ||
            paymentMethod ===
              PaymentMethod.COD ||
            paymentMethod ===
              PaymentMethod.CBD;

          const isTransfer =
            paymentMethod ===
            PaymentMethod.TRANSFER;

          const isTempo =
            paymentMethod ===
            PaymentMethod.TEMPO;

          /*
          ==================================================
          VALIDATE PAYMENT METHOD
          ==================================================
          */

          if (
            !isPettyCashPayment &&
            !isTransfer &&
            !isTempo
          ) {
            throw new Error(
              "Metode pembayaran Purchase Outlet tidak valid"
            );
          }

          /*
          ==================================================
          PAYMENT
          ==================================================
          */

          let payment:
            | any
            | null = null;

          /*
          ==================================================
          PETTY CASH
          ==================================================
          */

          let pettyCash:
            | any
            | null = null;

          /*
          ==================================================
          PAYABLE
          ==================================================
          */

          let payable:
            | any
            | null = null;

          /*
          ==================================================
          5A. CASH / COD / CBD
          ==================================================

          RULE:

          - harus memakai Petty Cash outlet
          - saldo harus cukup
          - Payment langsung PAID
          - Petty Cash langsung berkurang
          - Petty Cash transaction langsung APPROVED
          ==================================================
          */

          if (
            isPettyCashPayment
          ) {
            /*
            ------------------------------------------------
            CARI ACCOUNT OUTLET
            ------------------------------------------------
            */

            const account =
              await tx.pettyCashAccount.findFirst({
                where: {
                  outletId:
                    purchase.outletId,

                  isActive: true,
                },

                orderBy: {
                  id: "asc",
                },
              });

            if (!account) {
              throw new Error(
                `Akun Petty Cash untuk outlet ${purchase.outlet.name} belum tersedia`
              );
            }

            /*
            ------------------------------------------------
            PASTIKAN ACCOUNT BENAR-BENAR OUTLET
            ------------------------------------------------
            */

            if (
              account.outletId !==
              purchase.outletId
            ) {
              throw new Error(
                "Akun Petty Cash tidak sesuai dengan outlet Purchase"
              );
            }

            /*
            ------------------------------------------------
            SALDO
            ------------------------------------------------
            */

            const balanceBefore =
              Number(
                account.currentBalance ??
                  account.openingBalance ??
                  0
              );

            if (
              !Number.isFinite(
                balanceBefore
              )
            ) {
              throw new Error(
                `Saldo Petty Cash outlet ${purchase.outlet.name} tidak valid`
              );
            }

            if (
              balanceBefore <
              total
            ) {
              throw new Error(
                `Saldo Petty Cash outlet ${purchase.outlet.name} tidak mencukupi. Saldo tersedia Rp ${balanceBefore.toLocaleString(
                  "id-ID"
                )}, pembayaran Rp ${total.toLocaleString(
                  "id-ID"
                )}.`
              );
            }

            const balanceAfter =
              balanceBefore -
              total;

            /*
            ------------------------------------------------
            GENERATE PAYMENT NUMBER
            ------------------------------------------------
            */

            const paymentNumber =
              await generatePaymentNumber(
                tx,
                purchase.purchaseDate
              );

            /*
            ------------------------------------------------
            PAYMENT = PAID
            ------------------------------------------------
            */

            payment =
              await tx.payment.create({
                data: {
                  number:
                    paymentNumber,

                  outletPurchaseId:
                    purchase.id,

                  supplierId:
                    purchase.supplierId,

                  paymentDate:
                    purchase.purchaseDate,

                  amount:
                    total,

                  method:
                    paymentMethod,

                  status:
                    PaymentStatus.PAID,

                  note:
                    `Pembayaran ${paymentMethod} Purchase Outlet ${purchase.number} - ${purchase.outlet.name}`,

                  createdBy:
                    user.id,

                  approvedBy:
                    user.id,

                  approvedAt:
                    new Date(),
                },
              });

            /*
            ------------------------------------------------
            UPDATE PETTY CASH ACCOUNT
            ------------------------------------------------
            */

            const updatedAccount =
              await tx.pettyCashAccount.updateMany({
                where: {
                  id:
                    account.id,

                  isActive: true,

                  outletId:
                    purchase.outletId,

                  currentBalance: {
                    gte: total,
                  },
                },

                data: {
                  currentBalance:
                    balanceAfter,
                },
              });

            if (
              updatedAccount.count !==
              1
            ) {
              throw new Error(
                "Saldo Petty Cash berubah atau tidak mencukupi. Silakan refresh dan coba lagi."
              );
            }

            /*
            ------------------------------------------------
            PETTY CASH TRANSACTION
            ------------------------------------------------
            */

            const pettyCashNumber =
              await generatePettyCashNumber(
                tx,
                purchase.purchaseDate
              );

            pettyCash =
              await tx.pettyCash.create({
                data: {
                  number:
                    pettyCashNumber,

                  trxDate:
                    purchase.purchaseDate,

                  type:
                    PettyCashType.OUT,

                  category:
                    "PURCHASE",

                  description:
                    `Pembayaran ${paymentMethod} Purchase Outlet ${purchase.number} - ${purchase.supplier.name}`,

                  amount:
                    total,

                  balanceBefore,

                  balanceAfter,

                  accountId:
                    account.id,

                  paymentId:
                    payment.id,

                  outletId:
                    purchase.outletId,

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
          }

          /*
          ==================================================
          5B. TRANSFER
          ==================================================

          RULE:

          - langsung PAID
          - tidak mengurangi Petty Cash
          - tidak membuat PurchasePayable
          ==================================================
          */

          if (
            isTransfer
          ) {
            const paymentNumber =
              await generatePaymentNumber(
                tx,
                purchase.purchaseDate
              );

            payment =
              await tx.payment.create({
                data: {
                  number:
                    paymentNumber,

                  outletPurchaseId:
                    purchase.id,

                  supplierId:
                    purchase.supplierId,

                  paymentDate:
                    purchase.purchaseDate,

                  amount:
                    total,

                  method:
                    PaymentMethod.TRANSFER,

                  /*
                  PENTING:
                  TRANSFER langsung LUNAS
                  */

                  status:
                    PaymentStatus.PAID,

                  note:
                    `Pembayaran TRANSFER Purchase Outlet ${purchase.number}`,

                  createdBy:
                    user.id,

                  approvedBy:
                    user.id,

                  approvedAt:
                    new Date(),
                },
              });

            /*
            PENTING:

            Tidak ada:
              pettyCashAccount.update

            Tidak ada:
              pettyCash.create

            Tidak ada:
              purchasePayable.create
            */
          }

          /*
          ==================================================
          5C. TEMPO
          ==================================================

          RULE:

          - tidak membuat Payment
          - tidak mengurangi Petty Cash
          - membuat hutang supplier
          ==================================================
          */

          if (
            isTempo
          ) {
            /*
            ------------------------------------------------
            CEK DUPLIKAT HUTANG
            ------------------------------------------------
            */

            if (
              purchase.payable
            ) {
              throw new Error(
                "Hutang untuk Purchase Outlet ini sudah ada"
              );
            }

            /*
            ------------------------------------------------
            CREATE PAYABLE
            ------------------------------------------------
            */

            payable =
              await tx.purchasePayable.create({
                data: {
                  purchaseId:
                    null,

                  outletPurchaseId:
                    purchase.id,

                  supplierId:
                    purchase.supplierId,

                  outletId:
                    purchase.outletId,

                  invoiceNumber:
                    `INV-${purchase.number}`,

                  invoiceDate:
                    purchase.purchaseDate,

                  dueDate:
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
          }

          /*
          ==================================================
          6. APPROVE PURCHASE ATOMIC
          ==================================================

          Hanya boleh DRAFT -> APPROVED.

          Jika user lain sudah approve,
          update count = 0.
          ==================================================
          */

          const updated =
            await tx.outletPurchase.updateMany({
              where: {
                id:
                  purchaseId,

                status:
                  OutletPurchaseStatus.DRAFT,
              },

              data: {
                status:
                  OutletPurchaseStatus.APPROVED,

                total,
              },
            });

          if (
            updated.count !== 1
          ) {
            throw new Error(
              "Purchase Outlet sudah diproses oleh user lain"
            );
          }

          /*
          ==================================================
          7. HISTORY
          ==================================================
          */

          await tx.history.create({
            data: {
              transactionType:
                "PURCHASE",

              referenceNumber:
                purchase.number,

              description:
                `Approve Purchase Outlet ${purchase.number} - ${purchase.supplier.name} - ${purchase.outlet.name} - Pembayaran ${paymentMethod}`,

              userId:
                user.id,
            },
          });

          /*
          ==================================================
          8. GET APPROVED PURCHASE
          ==================================================
          */

          const approved =
            await tx.outletPurchase.findUnique({
              where: {
                id:
                  purchase.id,
              },

              include: {
                supplier: true,
                outlet: true,
                items: true,
                payable: true,
                payments: true,
              },
            });

          if (!approved) {
            throw new Error(
              "Purchase Outlet gagal diambil setelah approval"
            );
          }

          /*
          ==================================================
          RETURN
          ==================================================
          */

          return {
            purchase:
              approved,

            payment,

            pettyCash,

            payable,
          };
        },
        {
          maxWait: 10000,
          timeout: 20000,
        }
      );

    /*
    ========================================================
    9. MESSAGE
    ========================================================
    */

    const paymentMethod =
      result.purchase.paymentMethod;

    let message =
      "Purchase Outlet berhasil diapprove.";

    /*
    --------------------------------------------------------
    CASH / COD / CBD
    --------------------------------------------------------
    */

    if (
      paymentMethod ===
        PaymentMethod.CASH ||
      paymentMethod ===
        PaymentMethod.COD ||
      paymentMethod ===
        PaymentMethod.CBD
    ) {
      message =
        `Purchase Outlet berhasil diapprove dan Petty Cash ${result.purchase.outlet.name} berkurang Rp ${Number(
          result.purchase.total
        ).toLocaleString(
          "id-ID"
        )}.`;
    }

    /*
    --------------------------------------------------------
    TRANSFER
    --------------------------------------------------------
    */

    if (
      paymentMethod ===
      PaymentMethod.TRANSFER
    ) {
      message =
        "Purchase Outlet berhasil diapprove. Pembayaran TRANSFER langsung LUNAS dan tidak mengurangi Petty Cash.";
    }

    /*
    --------------------------------------------------------
    TEMPO
    --------------------------------------------------------
    */

    if (
      paymentMethod ===
      PaymentMethod.TEMPO
    ) {
      message =
        "Purchase Outlet berhasil diapprove. Pembayaran TEMPO tidak mengurangi Petty Cash dan hutang supplier berhasil dibuat.";
    }

    /*
    ========================================================
    10. RESPONSE
    ========================================================
    */

    return NextResponse.json({
      success: true,

      message,

      data: result,
    });
  } catch (error) {
    console.error(
      "APPROVE OUTLET PURCHASE ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Approve Purchase Outlet gagal";

    let status = 500;

    /*
    --------------------------------------------------------
    404
    --------------------------------------------------------
    */

    if (
      message.includes(
        "tidak ditemukan"
      )
    ) {
      status = 404;
    }

    /*
    --------------------------------------------------------
    403
    --------------------------------------------------------
    */

    if (
      message.includes(
        "tidak memiliki akses"
      )
    ) {
      status = 403;
    }

    /*
    --------------------------------------------------------
    400
    --------------------------------------------------------
    */

    if (
      message.includes(
        "sudah"
      ) ||
      message.includes(
        "tidak valid"
      ) ||
      message.includes(
        "tidak mencukupi"
      ) ||
      message.includes(
        "belum"
      ) ||
      message.includes(
        "tidak memiliki"
      ) ||
      message.includes(
        "tidak sesuai"
      ) ||
      message.includes(
        "berubah"
      )
    ) {
      status = 400;
    }

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status,
      }
    );
  }
}