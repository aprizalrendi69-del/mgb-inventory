import {
  NextRequest,
  NextResponse,
} from "next/server";

import { cookies } from "next/headers";

import {
  PaymentMethod,
  PettyCashStatus,
  PettyCashType,
  Role,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  generatePettyCashNumber,
  roundMoney,
} from "@/lib/payment";

/*
===========================================================
PETTY CASH API
===========================================================

ACCOUNT
-----------------------------------------------------------
PUSAT
- outletId = null

OUTLET
- outletId = ID outlet

SALDO
-----------------------------------------------------------
Setiap account mempunyai saldo sendiri.

PUSAT TIDAK PERNAH DIGABUNG
DENGAN SALDO OUTLET.

PENDING
- tidak mengubah saldo

APPROVED
- mengubah saldo account terkait

OUTLET ADMIN
-----------------------------------------------------------
- hanya melihat outlet sendiri
- hanya menggunakan outlet sendiri
- tidak dapat membuat transaksi Pusat
- tidak dapat menggunakan account outlet lain

ADMIN / MANAGER
-----------------------------------------------------------
- dapat melihat Pusat
- dapat melihat semua outlet
- dapat membuat transaksi Pusat / Outlet

PAYMENT RULE
-----------------------------------------------------------
CASH
COD
CBD
    -> dapat mengurangi Petty Cash

TRANSFER
    -> langsung LUNAS
    -> tidak mengurangi Petty Cash
    -> tidak membuat hutang

TEMPO
    -> membuat PurchasePayable
    -> tidak mengurangi Petty Cash
===========================================================
*/

/*
===========================================================
GET CURRENT USER
===========================================================
*/

async function getCurrentUser() {
  try {
    const cookieStore = await cookies();

    const session =
      cookieStore.get("erp-session");

    if (!session?.value) {
      return null;
    }

    let sessionData: any;

    try {
      sessionData =
        JSON.parse(session.value);
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
      "GET CURRENT USER PETTY CASH ERROR:",
      error
    );

    return null;
  }
}

/*
===========================================================
ACCOUNT BALANCE
===========================================================
*/

function getAccountBalance(account: {
  currentBalance?: any;
  openingBalance?: any;
}) {
  return roundMoney(
    Number(
      account.currentBalance ??
        account.openingBalance ??
        0
    )
  );
}

/*
===========================================================
GET PETTY CASH
===========================================================
*/

export async function GET() {
  try {
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

    /*
    ========================================================
    1. TRANSACTION FILTER
    ========================================================
    */

    const transactionWhere: any = {};

    /*
    --------------------------------------------------------
    ADMIN OUTLET
    --------------------------------------------------------
    */

    if (
      user.role ===
      Role.OUTLET_ADMIN
    ) {
      if (!user.outletId) {
        return NextResponse.json({
          success: true,
          data: [],
          accounts: [],
          outlets: [],
          outletBalances: [],
          summary: {
            totalIn: 0,
            totalOut: 0,

            // Saldo account yang sedang diakses
            currentBalance: 0,

            // Total outlet yang terlihat
            totalOutletBalance: 0,

            // Pusat tidak boleh terlihat
            pusatBalance: 0,
          },
        });
      }

      transactionWhere.outletId =
        user.outletId;
    }

    /*
    ========================================================
    2. GET TRANSACTIONS
    ========================================================
    */

    const pettyCash =
      await prisma.pettyCash.findMany({
        where:
          transactionWhere,

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
              isActive: true,

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
            trxDate: "desc",
          },
          {
            id: "desc",
          },
        ],
      });

    /*
    ========================================================
    3. GET PETTY CASH ACCOUNTS
    ========================================================
    */

    const accountWhere: any = {
      isActive: true,
    };

    /*
    --------------------------------------------------------
    ADMIN OUTLET
    hanya account outlet sendiri
    --------------------------------------------------------
    */

    if (
      user.role ===
      Role.OUTLET_ADMIN
    ) {
      accountWhere.outletId =
        user.outletId ?? -1;
    }

    const rawAccounts =
      await prisma.pettyCashAccount.findMany({
        where:
          accountWhere,

        select: {
          id: true,
          code: true,
          name: true,
          outletId: true,
          openingBalance: true,
          currentBalance: true,
          isActive: true,

          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
              active: true,
            },
          },
        },

        orderBy: [
          {
            outletId: "asc",
          },
          {
            id: "asc",
          },
        ],
      });

    /*
    ========================================================
    4. NORMALIZE ACCOUNTS
    ========================================================
    */

    const accounts =
      rawAccounts.map(
        (account) => {
          const balance =
            getAccountBalance(
              account
            );

          return {
            ...account,

            balance,

            saldo:
              balance,

            currentBalance:
              balance,
          };
        }
      );

    /*
    ========================================================
    5. GET ACTIVE OUTLETS
    ========================================================

    Outlet yang belum mempunyai transaksi
    tetap ditampilkan dengan saldo Rp0.
    ========================================================
    */

    const outletWhere: any = {
      active: true,
    };

    if (
      user.role ===
      Role.OUTLET_ADMIN
    ) {
      outletWhere.id =
        user.outletId ?? -1;
    }

    const outlets =
      await prisma.outlet.findMany({
        where:
          outletWhere,

        select: {
          id: true,
          code: true,
          name: true,
          active: true,
        },

        orderBy: {
          id: "asc",
        },
      });

    /*
    ========================================================
    6. BUILD OUTLET BALANCE MAP
    ========================================================
    */

    const outletBalanceMap =
      new Map<
        string,
        {
          outletId: number | null;
          outletCode: string;
          outletName: string;
          openingBalance: number;
          balance: number;
          accountCount: number;
          accountId: number | null;
        }
      >();

    /*
    ========================================================
    7. PUSAT
    ========================================================

    PENTING:

    PUSAT HANYA:
      account.outletId === null

    TIDAK PERNAH mengambil account outlet.
    ========================================================
    */

    if (
      user.role !==
      Role.OUTLET_ADMIN
    ) {
      const pusatAccounts =
        accounts.filter(
          (account) =>
            account.outletId ===
            null
        );

      let pusatBalance = 0;

      let pusatOpening = 0;

      let pusatAccountId:
        | number
        | null = null;

      for (
        const account of
          pusatAccounts
      ) {
        pusatBalance =
          roundMoney(
            pusatBalance +
              getAccountBalance(
                account
              )
          );

        pusatOpening =
          roundMoney(
            pusatOpening +
              Number(
                account.openingBalance ??
                  0
              )
          );

        if (
          pusatAccountId ===
          null
        ) {
          pusatAccountId =
            account.id;
        }
      }

      outletBalanceMap.set(
        "PUSAT",
        {
          outletId:
            null,

          outletCode:
            "PUSAT",

          outletName:
            "Pusat",

          openingBalance:
            pusatOpening,

          balance:
            pusatBalance,

          accountCount:
            pusatAccounts.length,

          accountId:
            pusatAccountId,
        }
      );
    }

    /*
    ========================================================
    8. SEMUA OUTLET
    ========================================================
    */

    for (
      const outlet of outlets
    ) {
      /*
      ------------------------------------------------------
      HANYA ACCOUNT DENGAN outletId = outlet.id
      ------------------------------------------------------
      */

      const outletAccounts =
        accounts.filter(
          (account) =>
            account.outletId ===
            outlet.id
        );

      let balance = 0;

      let openingBalance = 0;

      let accountId:
        | number
        | null = null;

      for (
        const account of
          outletAccounts
      ) {
        balance =
          roundMoney(
            balance +
              getAccountBalance(
                account
              )
          );

        openingBalance =
          roundMoney(
            openingBalance +
              Number(
                account.openingBalance ??
                  0
              )
          );

        if (
          accountId === null
        ) {
          accountId =
            account.id;
        }
      }

      /*
      ------------------------------------------------------
      OUTLET TANPA ACCOUNT
      tetap tampil Rp0
      ------------------------------------------------------
      */

      outletBalanceMap.set(
        `OUTLET-${outlet.id}`,
        {
          outletId:
            outlet.id,

          outletCode:
            outlet.code,

          outletName:
            outlet.name,

          openingBalance,

          balance,

          accountCount:
            outletAccounts.length,

          accountId,
        }
      );
    }

    /*
    ========================================================
    9. OUTLET BALANCES
    ========================================================
    */

    const outletBalances =
      Array.from(
        outletBalanceMap.values()
      ).map(
        (item) => ({
          ...item,

          saldo:
            roundMoney(
              item.balance
            ),

          currentBalance:
            roundMoney(
              item.balance
            ),
        })
      );

    /*
    ========================================================
    10. PUSAT BALANCE
    ========================================================

    Ambil HANYA record PUSAT.

    Tidak menggunakan reduce dari seluruh accounts.
    ========================================================
    */

    const pusatBalance =
      roundMoney(
        outletBalances.find(
          (item) =>
            item.outletId ===
            null
        )?.balance ?? 0
      );

    /*
    ========================================================
    11. TOTAL OUTLET BALANCE
    ========================================================

    Ini memang menjumlah semua outlet.

    Ini BUKAN saldo Pusat.

    Hanya digunakan untuk informasi
    total saldo seluruh outlet.
    ========================================================
    */

    const totalOutletBalance =
      roundMoney(
        outletBalances
          .filter(
            (item) =>
              item.outletId !==
              null
          )
          .reduce(
            (
              total,
              item
            ) =>
              roundMoney(
                total +
                  item.balance
              ),
            0
          )
      );

    /*
    ========================================================
    12. CURRENT BALANCE
    ========================================================

    INI BAGIAN PALING PENTING.

    ADMIN PUSAT
    ------------
    currentBalance =
      saldo Pusat SAJA

    ADMIN OUTLET
    ------------
    currentBalance =
      saldo outlet sendiri SAJA

    TIDAK PERNAH:
      Pusat + Outlet
    ========================================================
    */

    let currentBalance = 0;

    if (
      user.role ===
      Role.OUTLET_ADMIN
    ) {
      currentBalance =
        roundMoney(
          outletBalances.find(
            (item) =>
              item.outletId ===
              user.outletId
          )?.balance ?? 0
        );
    } else {
      /*
      ADMIN / MANAGER

      Default account Petty Cash yang
      sedang ditampilkan adalah PUSAT.

      Jadi currentBalance bukan total
      seluruh outlet.
      */

      currentBalance =
        pusatBalance;
    }

    /*
    ========================================================
    13. APPROVED TRANSACTIONS
    ========================================================
    */

    const approvedWhere: any = {
      status:
        PettyCashStatus.APPROVED,
    };

    /*
    --------------------------------------------------------
    ADMIN OUTLET
    --------------------------------------------------------
    */

    if (
      user.role ===
      Role.OUTLET_ADMIN
    ) {
      approvedWhere.outletId =
        user.outletId ?? -1;
    } else {
      /*
      ------------------------------------------------------
      ADMIN / MANAGER

      Untuk summary totalIn / totalOut,
      gunakan transaksi Pusat saja.

      Karena summary utama halaman Pusat
      harus mengikuti rekening Pusat.
      ------------------------------------------------------
      */

      approvedWhere.outletId =
        null;
    }

    const approvedTransactions =
      await prisma.pettyCash.findMany({
        where:
          approvedWhere,

        select: {
          type: true,
          amount: true,
        },
      });

    let totalIn = 0;

    let totalOut = 0;

    for (
      const trx of
        approvedTransactions
    ) {
      const amount =
        roundMoney(
          Number(
            trx.amount
          )
        );

      if (
        trx.type ===
        PettyCashType.IN
      ) {
        totalIn =
          roundMoney(
            totalIn +
              amount
          );
      }

      if (
        trx.type ===
        PettyCashType.OUT
      ) {
        totalOut =
          roundMoney(
            totalOut +
              amount
          );
      }
    }

    /*
    ========================================================
    14. RESPONSE
    ========================================================
    */

    return NextResponse.json({
      success: true,

      data:
        pettyCash,

      accounts,

      outlets,

      outletBalances,

      summary: {
        /*
        ----------------------------------------------------
        IN / OUT

        Untuk Admin Pusat:
          hanya transaksi Pusat

        Untuk Admin Outlet:
          hanya transaksi outlet sendiri
        ----------------------------------------------------
        */

        totalIn:
          roundMoney(
            totalIn
          ),

        totalOut:
          roundMoney(
            totalOut
          ),

        /*
        ----------------------------------------------------
        CURRENT BALANCE

        PENTING:
        Tidak lagi menjumlah Pusat + Outlet.
        ----------------------------------------------------
        */

        currentBalance:
          roundMoney(
            currentBalance
          ),

        /*
        ----------------------------------------------------
        SALDO OUTLET

        Total semua outlet.
        BUKAN saldo Pusat.
        ----------------------------------------------------
        */

        totalOutletBalance:
          roundMoney(
            totalOutletBalance
          ),

        /*
        ----------------------------------------------------
        SALDO PUSAT
        ----------------------------------------------------
        */

        pusatBalance:
          roundMoney(
            pusatBalance
          ),
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
        message:
          "Gagal mengambil data Petty Cash",
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

export async function POST(
  req: NextRequest
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
          message: "Tidak login",
        },
        {
          status: 401,
        }
      );
    }

    /*
    ========================================================
    BODY
    ========================================================
    */

    const body =
      await req.json();

    /*
    ========================================================
    BASIC DATA
    ========================================================
    */

    const typeRaw =
      String(
        body.type ?? ""
      )
        .trim()
        .toUpperCase();

    const category =
      String(
        body.category ?? ""
      ).trim();

    const description =
      body.description ===
        undefined ||
      body.description ===
        null ||
      String(
        body.description
      ).trim() === ""
        ? null
        : String(
            body.description
          ).trim();

    const amount =
      roundMoney(
        Number(
          body.amount ?? 0
        )
      );

    const paymentId =
      body.paymentId ===
        undefined ||
      body.paymentId ===
        null ||
      body.paymentId === ""
        ? null
        : Number(
            body.paymentId
          );

    /*
    ========================================================
    VALIDATE TYPE
    ========================================================
    */

    if (
      !Object.values(
        PettyCashType
      ).includes(
        typeRaw as PettyCashType
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tipe Petty Cash tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    const type =
      typeRaw as PettyCashType;

    /*
    ========================================================
    CATEGORY
    ========================================================
    */

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Kategori wajib diisi",
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

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Nominal Petty Cash tidak valid",
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

    let outletId:
      | number
      | null = null;

    if (
      user.role ===
      Role.OUTLET_ADMIN
    ) {
      /*
      OUTLET ADMIN SELALU
      MENGGUNAKAN OUTLET SESSION
      */

      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet belum ditentukan",
          },
          {
            status: 400,
          }
        );
      }

      outletId =
        user.outletId;
    } else {
      /*
      ADMIN / MANAGER

      outletId kosong
      = PUSAT

      outletId berisi
      = OUTLET tersebut
      */

      const rawOutletId =
        body.outletId;

      outletId =
        rawOutletId ===
          undefined ||
        rawOutletId ===
          null ||
        rawOutletId === ""
          ? null
          : Number(
              rawOutletId
            );
    }

    /*
    ========================================================
    VALIDATE OUTLET
    ========================================================
    */

    if (
      outletId !== null
    ) {
      if (
        !Number.isInteger(
          outletId
        ) ||
        outletId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      const outlet =
        await prisma.outlet.findUnique(
          {
            where: {
              id: outletId,
            },

            select: {
              id: true,
              code: true,
              name: true,
              active: true,
            },
          }
        );

      if (!outlet) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet tidak ditemukan",
          },
          {
            status: 404,
          }
        );
      }

      if (!outlet.active) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet tidak aktif",
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
    ========================================================
    ACCOUNT ID
    ========================================================
    */

    let accountId:
      | number
      | null = null;

    if (
      body.accountId !==
        undefined &&
      body.accountId !==
        null &&
      body.accountId !== ""
    ) {
      accountId =
        Number(
          body.accountId
        );
    }

    let account:
      | any
      | null = null;

    /*
    ========================================================
    ACCOUNT DIPILIH
    ========================================================
    */

    if (
      accountId !== null
    ) {
      if (
        !Number.isInteger(
          accountId
        ) ||
        accountId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Akun Petty Cash tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      account =
        await prisma.pettyCashAccount.findUnique(
          {
            where: {
              id: accountId,
            },
          }
        );

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

      if (
        !account.isActive
      ) {
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
      ======================================================
      ACCOUNT HARUS SAMA DENGAN
      OUTLET TRANSAKSI
      ======================================================
      */

      if (
        account.outletId !==
        outletId
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              account.outletId ===
              null
                ? "Akun Petty Cash Pusat hanya dapat digunakan untuk transaksi Pusat"
                : "Akun Petty Cash Outlet tidak sesuai dengan outlet transaksi",
          },
          {
            status: 403,
          }
        );
      }

      /*
      ======================================================
      OUTLET ADMIN
      ======================================================
      */

      if (
        user.role ===
          Role.OUTLET_ADMIN &&
        account.outletId !==
          user.outletId
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Anda hanya dapat menggunakan akun Petty Cash outlet sendiri",
          },
          {
            status: 403,
          }
        );
      }
    } else {
      /*
      ======================================================
      CARI ACCOUNT BERDASARKAN OUTLET
      ======================================================

      outletId null
        -> PUSAT

      outletId number
        -> OUTLET tersebut
      ======================================================
      */

      account =
        await prisma.pettyCashAccount.findFirst(
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

      /*
      ======================================================
      BUAT ACCOUNT OTOMATIS
      ======================================================
      */

      if (!account) {
        let code =
          outletId === null
            ? "PC-PUSAT"
            : `PC-${outletId}`;

        const existingCode =
          await prisma.pettyCashAccount.findUnique(
            {
              where: {
                code,
              },

              select: {
                id: true,
              },
            }
          );

        if (existingCode) {
          code =
            outletId === null
              ? `PC-PUSAT-${Date.now()}`
              : `PC-${outletId}-${Date.now()}`;
        }

        account =
          await prisma.pettyCashAccount.create(
            {
              data: {
                code,

                name:
                  outletId ===
                  null
                    ? "Petty Cash Pusat"
                    : `Petty Cash Outlet ${outletId}`,

                openingBalance:
                  0,

                currentBalance:
                  0,

                /*
                PENTING:
                account Pusat:
                  null

                account Outlet:
                  outletId
                */

                outletId,

                isActive: true,
              },
            }
          );
      }

      accountId =
        account.id;
    }

    /*
    ========================================================
    PAYMENT VALIDATION
    ========================================================
    */

    if (
      paymentId !== null
    ) {
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
              "Payment tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      const payment =
        await prisma.payment.findUnique(
          {
            where: {
              id: paymentId,
            },

            include: {
              purchase: true,
              outletPurchase: true,
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
      PAYMENT HARUS APPROVED
      */

      if (
        payment.status !==
        "APPROVED"
      ) {
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
      ======================================================
      TRANSFER / TEMPO
      ======================================================
      */

      if (
        payment.method ===
          PaymentMethod.TRANSFER ||
        payment.method ===
          PaymentMethod.TEMPO
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              payment.method ===
              PaymentMethod.TRANSFER
                ? "Payment TRANSFER tidak mengurangi Petty Cash"
                : "Payment TEMPO tidak mengurangi Petty Cash dan menjadi hutang supplier",
          },
          {
            status: 400,
          }
        );
      }

      /*
      ======================================================
      PAYMENT OUTLET
      ======================================================
      */

      if (
        payment.outletPurchaseId
      ) {
        const poOutlet =
          payment.outletPurchase;

        if (!poOutlet) {
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
          outletId !==
          poOutlet.outletId
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Payment outlet tidak sesuai dengan Petty Cash outlet",
            },
            {
              status: 403,
            }
          );
        }

        if (
          account.outletId !==
          poOutlet.outletId
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Akun Petty Cash tidak sesuai dengan outlet Payment",
            },
            {
              status: 403,
            }
          );
        }
      }

      /*
      ======================================================
      PAYMENT PUSAT
      ======================================================
      */

      if (
        payment.purchaseId
      ) {
        if (
          outletId !==
          null
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

        if (
          account.outletId !==
          null
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Payment PO pusat harus menggunakan akun Petty Cash Pusat",
            },
            {
              status: 403,
            }
          );
        }
      }
    }

    /*
    ========================================================
    BALANCE BEFORE
    ========================================================
    */

    const balanceBefore =
      getAccountBalance(
        account
      );

    /*
    ========================================================
    VALIDATE OUT
    ========================================================
    */

    if (
      type ===
        PettyCashType.OUT &&
      amount >
        balanceBefore
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Saldo Petty Cash tidak mencukupi",

          balance:
            balanceBefore,
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    BALANCE AFTER
    ========================================================
    */

    const balanceAfter =
      type ===
      PettyCashType.IN
        ? roundMoney(
            balanceBefore +
              amount
          )
        : roundMoney(
            balanceBefore -
              amount
          );

    /*
    ========================================================
    NUMBER
    ========================================================
    */

    const now =
      new Date();

    const number =
      await generatePettyCashNumber(
        prisma,
        now
      );

    /*
    ========================================================
    CREATE
    ========================================================
    */

    const pettyCash =
      await prisma.pettyCash.create({
        data: {
          number,

          trxDate:
            now,

          type,

          category,

          description,

          amount,

          balanceBefore,

          balanceAfter,

          /*
          PENTING:
          accountId menentukan
          rekening saldo yang digunakan.
          */

          accountId:
            account.id,

          paymentId,

          /*
          PUSAT:
            null

          OUTLET:
            outletId
          */

          outletId,

          createdBy:
            user.id,

          status:
            PettyCashStatus.PENDING,
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

    /*
    ========================================================
    RESPONSE
    ========================================================
    */

    return NextResponse.json(
      {
        success: true,

        message:
          "Petty Cash berhasil dibuat dan menunggu approval",

        data:
          pettyCash,
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

    const message =
      error instanceof Error
        ? error.message
        : "Gagal membuat Petty Cash";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: 500,
      }
    );
  }
}