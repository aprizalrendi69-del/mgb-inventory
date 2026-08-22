import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  PaymentMethod,
  PaymentStatus,
  PettyCashStatus,
  PettyCashType,
  PurchaseStatus,
  Role,
} from "@prisma/client";
import { cookies } from "next/headers";

/*
 * =========================================================
 * GET CURRENT USER
 * =========================================================
 */

async function getCurrentUser() {
  const cookieStore = await cookies();

  const sessionCookie =
    cookieStore.get("session") ||
    cookieStore.get("erp-session");

  if (!sessionCookie) {
    return null;
  }

  /*
   * -------------------------------------------------------
   * DATABASE SESSION
   * -------------------------------------------------------
   */

  try {
    const session = await prisma.session.findUnique({
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
      if (session.expiresAt < new Date()) {
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
   * -------------------------------------------------------
   * FALLBACK JSON SESSION
   * -------------------------------------------------------
   */

  try {
    const parsed = JSON.parse(sessionCookie.value);

    const userId = Number(
      parsed?.user?.id ??
        parsed?.id ??
        0
    );

    if (!userId || !Number.isInteger(userId)) {
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
      "JSON SESSION CHECK ERROR:",
      error
    );

    return null;
  }
}

/*
 * =========================================================
 * GENERATE PAYMENT NUMBER
 * =========================================================
 *
 * Contoh:
 *
 * PAY-202608-00001
 *
 * =========================================================
 */

async function generatePaymentNumber(
  tx: any,
  paymentDate: Date
) {
  const year = paymentDate.getFullYear();

  const month = String(
    paymentDate.getMonth() + 1
  ).padStart(2, "0");

  const period = `${year}${month}`;

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
 * =========================================================
 * GENERATE PETTY CASH NUMBER
 * =========================================================
 *
 * Contoh:
 *
 * PC-202608-00001
 *
 * =========================================================
 */

async function generatePettyCashNumber(
  tx: any,
  trxDate: Date
) {
  const year = trxDate.getFullYear();

  const month = String(
    trxDate.getMonth() + 1
  ).padStart(2, "0");

  const period = `${year}${month}`;

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
 * =========================================================
 * POST APPROVE PURCHASE PUSAT
 * =========================================================
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
    const { id } = await params;

    const purchaseId = Number(id);

    if (
      !Number.isInteger(purchaseId) ||
      purchaseId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID Purchase Order tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * USER
     * =====================================================
     */

    const user = await getCurrentUser();

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
     * =====================================================
     * SECURITY
     *
     * ADMIN / PURCHASING boleh approve PO Pusat.
     * =====================================================
     */

    const allowedRoles: Role[] = [
      Role.ADMIN,
      Role.PURCHASING,
    ];

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses untuk approve Purchase Order",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * =====================================================
     * TRANSACTION
     * =====================================================
     */

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
           * -------------------------------------------------
           * AMBIL PO TERBARU
           * -------------------------------------------------
           */

          const purchase =
            await tx.purchase.findUnique({
              where: {
                id: purchaseId,
              },

              include: {
                supplier: true,
                items: true,
                payable: true,
              },
            });

          if (!purchase) {
            throw new Error(
              "Purchase Order tidak ditemukan"
            );
          }

          /*
           * -------------------------------------------------
           * STATUS
           * -------------------------------------------------
           */

          if (
            purchase.status !==
            PurchaseStatus.DRAFT
          ) {
            throw new Error(
              `Purchase Order sudah ${purchase.status} dan tidak dapat diapprove lagi`
            );
          }

          /*
           * -------------------------------------------------
           * VALIDASI SUPPLIER
           * -------------------------------------------------
           */

          if (!purchase.supplier) {
            throw new Error(
              "Supplier Purchase Order tidak ditemukan"
            );
          }

          /*
           * -------------------------------------------------
           * VALIDASI ITEM
           * -------------------------------------------------
           */

          if (
            !purchase.items ||
            purchase.items.length === 0
          ) {
            throw new Error(
              "Purchase Order belum memiliki barang"
            );
          }

          for (const item of purchase.items) {
            const qty = Number(item.qty);
            const price = Number(item.price);

            if (
              !Number.isFinite(qty) ||
              qty <= 0
            ) {
              throw new Error(
                "Terdapat qty barang yang tidak valid"
              );
            }

            if (
              !Number.isFinite(price) ||
              price < 0
            ) {
              throw new Error(
                "Terdapat harga barang yang tidak valid"
              );
            }
          }

          /*
           * -------------------------------------------------
           * TOTAL
           * -------------------------------------------------
           */

          const calculatedTotal =
            purchase.items.reduce(
              (sum, item) => {
                return (
                  sum +
                  Number(item.qty) *
                    Number(item.price)
                );
              },
              0
            );

          if (
            !Number.isFinite(
              calculatedTotal
            ) ||
            calculatedTotal <= 0
          ) {
            throw new Error(
              "Total Purchase Order tidak valid"
            );
          }

          /*
           * Gunakan total hasil perhitungan item.
           * Ini mencegah total PO yang rusak.
           */

          const total =
            calculatedTotal;

          /*
           * -------------------------------------------------
           * PAYMENT METHOD
           * -------------------------------------------------
           */

          const paymentMethod =
            purchase.paymentMethod;

          /*
           * -------------------------------------------------
           * APPROVE PO ATOMIC
           * -------------------------------------------------
           */

          const updated =
            await tx.purchase.updateMany({
              where: {
                id: purchaseId,
                status:
                  PurchaseStatus.DRAFT,
              },

              data: {
                status:
                  PurchaseStatus.APPROVED,
              },
            });

          if (updated.count !== 1) {
            throw new Error(
              "Purchase Order sudah diproses oleh user lain"
            );
          }

          /*
           * -------------------------------------------------
           * PAYMENT
           * -------------------------------------------------
           */

          let payment = null;

          const isImmediate =
            paymentMethod ===
              PaymentMethod.CASH ||
            paymentMethod ===
              PaymentMethod.COD ||
            paymentMethod ===
              PaymentMethod.CBD;

          const isTempo =
            paymentMethod ===
            PaymentMethod.TEMPO;

          /*
           * -------------------------------------------------
           * CASH / COD / CBD
           *
           * POTONG PETTY CASH PUSAT
           * -------------------------------------------------
           */

          let pettyCash = null;

          if (isImmediate) {
            /*
             * Cari akun petty cash pusat.
             *
             * outletId NULL = PUSAT.
             */

            const account =
              await tx.pettyCashAccount.findFirst({
                where: {
                  outletId: null,
                  isActive: true,
                },
                orderBy: {
                  id: "asc",
                },
              });

            if (!account) {
              throw new Error(
                "Akun petty cash pusat belum tersedia"
              );
            }

            const balanceBefore =
              Number(
                account.currentBalance
              );

            if (
              !Number.isFinite(
                balanceBefore
              )
            ) {
              throw new Error(
                "Saldo petty cash pusat tidak valid"
              );
            }

            if (
              balanceBefore < total
            ) {
              throw new Error(
                `Saldo petty cash pusat tidak mencukupi. Saldo tersedia Rp ${balanceBefore.toLocaleString(
                  "id-ID"
                )}, pembayaran Rp ${total.toLocaleString(
                  "id-ID"
                )}.`
              );
            }

            const balanceAfter =
              balanceBefore - total;

            /*
             * Nomor payment.
             */

            const paymentNumber =
              await generatePaymentNumber(
                tx,
                purchase.purchaseDate
              );

            payment =
              await tx.payment.create({
                data: {
                  number: paymentNumber,

                  purchaseId:
                    purchase.id,

                  supplierId:
                    purchase.supplierId,

                  paymentDate:
                    purchase.purchaseDate,

                  amount: total,

                  method:
                    paymentMethod,

                  status:
                    PaymentStatus.PAID,

                  note:
                    `Pembayaran ${paymentMethod} PO ${purchase.number}`,

                  createdBy:
                    user.id,

                  approvedBy:
                    user.id,

                  approvedAt:
                    new Date(),
                },
              });

            /*
             * Update saldo akun.
             */

            await tx.pettyCashAccount.update({
              where: {
                id: account.id,
              },

              data: {
                currentBalance:
                  balanceAfter,
              },
            });

            /*
             * Nomor petty cash.
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
                    `Pembayaran ${paymentMethod} PO ${purchase.number} - ${purchase.supplier.name}`,

                  amount: total,

                  balanceBefore,

                  balanceAfter,

                  accountId:
                    account.id,

                  paymentId:
                    payment.id,

                  outletId: null,

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
           * -------------------------------------------------
           * TRANSFER
           *
           * Belum mengurangi petty cash.
           *
           * Payment dibuat PENDING karena pembayaran bank
           * dilakukan melalui proses payment.
           * -------------------------------------------------
           */

          if (
            paymentMethod ===
            PaymentMethod.TRANSFER
          ) {
            const paymentNumber =
              await generatePaymentNumber(
                tx,
                purchase.purchaseDate
              );

            payment =
              await tx.payment.create({
                data: {
                  number: paymentNumber,

                  purchaseId:
                    purchase.id,

                  supplierId:
                    purchase.supplierId,

                  paymentDate:
                    purchase.purchaseDate,

                  amount: total,

                  method:
                    PaymentMethod.TRANSFER,

                  status:
                    PaymentStatus.PENDING,

                  note:
                    `Pembayaran transfer PO ${purchase.number}`,

                  createdBy:
                    user.id,
                },
              });
          }

          /*
           * -------------------------------------------------
           * TEMPO
           * -------------------------------------------------
           */

          let payable = null;

          if (isTempo) {
            if (purchase.payable) {
              throw new Error(
                "Hutang untuk Purchase Order ini sudah ada"
              );
            }

            payable =
              await tx.purchasePayable.create({
                data: {
                  purchaseId:
                    purchase.id,

                  supplierId:
                    purchase.supplierId,

                  outletId: null,

                  invoiceNumber:
                    `INV-${purchase.number}`,

                  invoiceDate:
                    purchase.purchaseDate,

                  dueDate: null,

                  amount: total,

                  paidAmount: 0,

                  outstanding: total,

                  status:
                    "OUTSTANDING",
                },
              });
          }

          /*
           * -------------------------------------------------
           * UPDATE TOTAL
           * -------------------------------------------------
           */

          const approvedPurchase =
            await tx.purchase.update({
              where: {
                id: purchase.id,
              },

              data: {
                total,
              },

              include: {
                supplier: true,
                items: {
                  include: {
                    barang: true,
                  },
                },
              },
            });

          /*
           * -------------------------------------------------
           * HISTORY
           * -------------------------------------------------
           */

          await tx.history.create({
            data: {
              transactionType:
                "PURCHASE",

              referenceNumber:
                purchase.number,

              description:
                `Approve Purchase Order ${purchase.number} - ${purchase.supplier.name} - Pembayaran ${paymentMethod}`,

              userId:
                user.id,
            },
          });

          return {
            purchase:
              approvedPurchase,
            payment,
            pettyCash,
            payable,
          };
        },
        {
          maxWait: 5000,
          timeout: 15000,
        }
      );

    /*
     * =====================================================
     * RESPONSE
     * =====================================================
     */

    const paymentMethod =
      result.purchase.paymentMethod;

    let message =
      "Purchase Order berhasil diapprove.";

    if (
      paymentMethod === PaymentMethod.CASH ||
      paymentMethod === PaymentMethod.COD ||
      paymentMethod === PaymentMethod.CBD
    ) {
      message =
        `Purchase Order berhasil diapprove dan petty cash pusat berkurang Rp ${Number(
          result.purchase.total
        ).toLocaleString("id-ID")}.`;
    }

    if (
      paymentMethod ===
      PaymentMethod.TRANSFER
    ) {
      message =
        "Purchase Order berhasil diapprove. Pembayaran transfer menunggu proses payment.";
    }

    if (
      paymentMethod ===
      PaymentMethod.TEMPO
    ) {
      message =
        "Purchase Order berhasil diapprove dan hutang supplier berhasil dibuat.";
    }

    return NextResponse.json({
      success: true,
      message,
      data: result,
    });
  } catch (error) {
    console.error(
      "APPROVE PURCHASE ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Approve Purchase Order gagal";

    let status = 500;

    if (
      message.includes(
        "tidak ditemukan"
      ) ||
      message.includes(
        "belum memiliki"
      )
    ) {
      status = 404;
    }

    if (
      message.includes(
        "tidak memiliki akses"
      )
    ) {
      status = 403;
    }

    if (
      message.includes(
        "tidak mencukupi"
      ) ||
      message.includes(
        "tidak valid"
      ) ||
      message.includes(
        "sudah"
      ) ||
      message.includes(
        "belum"
      ) ||
      message.includes(
        "belum tersedia"
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