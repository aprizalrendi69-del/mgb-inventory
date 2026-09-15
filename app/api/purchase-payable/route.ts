import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

/*
============================================================
GET PURCHASE PAYABLE
============================================================

ACCESS CONTROL
------------------------------------------------------------
OUTLET_ADMIN:
- Hanya melihat PurchasePayable dari Outlet miliknya.
- Tidak boleh melihat Purchase Pusat.
- Tidak boleh melihat Outlet lain.
- outletId diambil dari user login, BUKAN dari request.

USER PUSAT:
- Tetap dapat melihat seluruh PurchasePayable.

SOURCE OF TRUTH
------------------------------------------------------------
PurchasePayable:
- amount
- paidAmount
- outstanding
- status

SUPPLIER TEMPO
------------------------------------------------------------
- Supplier.tempoDays adalah master tempo supplier.
- Untuk tampilan API, tempoDays dikembalikan secara eksplisit.
- PurchasePayable.dueDate adalah snapshot jatuh tempo
  transaksi historis jika sudah tersimpan.
- Jika dueDate lama masih NULL, API menggunakan fallback:
    invoiceDate + Supplier.tempoDays
- Fallback HANYA untuk response/tampilan.
- Database TIDAK diubah oleh GET ini.

============================================================
*/

/*
============================================================
CURRENT LOGIN USER
============================================================
*/

async function getCurrentUser() {
  const cookieStore = await cookies();

  const session = cookieStore.get("erp-session");

  if (!session?.value) {
    return null;
  }

  try {
    const sessionData = JSON.parse(session.value);

    /*
     * Menyesuaikan beberapa kemungkinan struktur session:
     *
     * data.user.id
     * data.data.user.id
     * data.data.id
     * data.id
     */
    const userId = Number(
      sessionData?.user?.id ??
        sessionData?.data?.user?.id ??
        sessionData?.data?.id ??
        sessionData?.id
    );

    if (!Number.isInteger(userId) || userId <= 0) {
      return null;
    }

    /*
     * Role dan outletId selalu diambil ulang
     * dari database.
     *
     * Jangan mempercayai role/outletId dari cookie.
     */
    const user = await prisma.user.findUnique({
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

    return user;
  } catch (error) {
    console.error(
      "GET CURRENT USER ERROR:",
      error
    );

    return null;
  }
}

/*
============================================================
ADD DAYS
============================================================

Dipakai hanya sebagai fallback tampilan ketika
PurchasePayable.dueDate masih NULL.

TIDAK mengubah database.
============================================================
*/

function addDays(
  date: Date,
  days: number
) {
  const result = new Date(date);

  result.setDate(
    result.getDate() + days
  );

  return result;
}

/*
============================================================
GET PURCHASE PAYABLE
============================================================
*/

export async function GET() {
  try {
    /*
     * ======================================================
     * AUTHENTICATION
     * ======================================================
     */

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * ======================================================
     * USER ACTIVE
     * ======================================================
     */

    if (user.active === false) {
      return NextResponse.json(
        {
          error: "User tidak aktif.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * ======================================================
     * DETECT OUTLET USER
     * ======================================================
     */

    const role = String(
      user.role || ""
    )
      .trim()
      .toUpperCase();

    const isOutletUser =
      role === "OUTLET_ADMIN";

    /*
     * ======================================================
     * OUTLET USER HARUS PUNYA OUTLET
     * ======================================================
     */

    if (
      isOutletUser &&
      (!user.outletId ||
        Number(user.outletId) <= 0)
    ) {
      return NextResponse.json(
        {
          error:
            "User Outlet belum memiliki outlet.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * ======================================================
     * BUILD WHERE
     * ======================================================
     *
     * OUTLET_ADMIN:
     *
     * hanya PurchasePayable yang berasal dari
     * OutletPurchase milik outlet user.
     *
     * Purchase Pusat:
     * tidak akan ikut.
     *
     * Outlet lain:
     * tidak akan ikut.
     * ======================================================
     */

    const where = isOutletUser
      ? {
          outletPurchaseId: {
            not: null,
          },

          outletPurchase: {
            outletId: Number(
              user.outletId
            ),
          },
        }
      : undefined;

    /*
     * ======================================================
     * QUERY
     * ======================================================
     *
     * Prisma mendukung nested relation melalui include.
     * ======================================================
     */

    const payables =
      await prisma.purchasePayable.findMany({
        where,

        orderBy: {
          createdAt: "desc",
        },

        include: {
          /*
           * Supplier langsung dari PurchasePayable.
           */
          supplier: true,

          /*
           * Outlet langsung dari PurchasePayable.
           */
          outlet: true,

          /*
           * Purchase Pusat.
           */
          purchase: {
            include: {
              supplier: true,
            },
          },

          /*
           * Purchase Outlet.
           */
          outletPurchase: {
            include: {
              supplier: true,
              outlet: true,
            },
          },
        },
      });

    /*
     * ======================================================
     * FORMAT RESULT
     * ======================================================
     */

    const result = payables.map(
      (payable) => {
        /*
         * ==================================================
         * SOURCE
         * ==================================================
         */

        const source =
          payable.purchase
            ? "PURCHASE"
            : payable.outletPurchase
              ? "OUTLET_PURCHASE"
              : "UNKNOWN";

        /*
         * ==================================================
         * TRANSACTION NUMBER
         * ==================================================
         */

        const transactionNumber =
          payable.purchase?.number ??
          payable.outletPurchase?.number ??
          payable.invoiceNumber;

        /*
         * ==================================================
         * SUPPLIER
         * ==================================================
         *
         * Prioritas:
         *
         * 1. PurchasePayable.supplier
         * 2. Purchase.supplier
         * 3. OutletPurchase.supplier
         * ==================================================
         */

        const supplier =
          payable.supplier ??
          payable.purchase?.supplier ??
          payable.outletPurchase?.supplier ??
          null;

        const supplierName =
          supplier?.name ?? "-";

        /*
         * ==================================================
         * SUPPLIER ID
         * ==================================================
         */

        const supplierId =
          supplier?.id ??
          payable.supplierId;

        /*
         * ==================================================
         * TEMPO DAYS
         * ==================================================
         *
         * Supplier.tempoDays adalah master tempo supplier.
         *
         * Nilai ini dipakai untuk fallback dueDate
         * apabila payable lama belum mempunyai dueDate.
         * ==================================================
         */

        const tempoDays =
          supplier?.tempoDays != null
            ? Number(
                supplier.tempoDays
              )
            : null;

        /*
         * ==================================================
         * OUTLET
         * ==================================================
         */

        const outletName =
          payable.outlet?.name ??
          payable.outletPurchase
            ?.outlet?.name ??
          "-";

        /*
         * ==================================================
         * INVOICE DATE
         * ==================================================
         */

        const invoiceDate =
          payable.invoiceDate ??
          null;

        /*
         * ==================================================
         * DUE DATE
         * ==================================================
         *
         * PRIORITAS 1:
         * ----------------
         * PurchasePayable.dueDate
         *
         * Kalau sudah ada, WAJIB digunakan.
         *
         * PRIORITAS 2:
         * ----------------
         * Kalau dueDate NULL:
         *
         * invoiceDate + Supplier.tempoDays
         *
         * Ini hanya fallback untuk response.
         *
         * TIDAK mengubah database.
         * ==================================================
         */

        let dueDate =
          payable.dueDate ??
          null;

        let dueDateSource:
          | "PAYABLE"
          | "CALCULATED"
          | "NONE" =
          "NONE";

        /*
         * Existing snapshot.
         */
        if (payable.dueDate) {
          dueDateSource = "PAYABLE";
        }

        /*
         * Fallback untuk historical payable
         * yang belum mempunyai dueDate.
         */
        else if (
          invoiceDate &&
          tempoDays != null &&
          Number.isFinite(tempoDays)
        ) {
          dueDate = addDays(
            invoiceDate,
            tempoDays
          );

          dueDateSource = "CALCULATED";
        }

        /*
         * ==================================================
         * RETURN
         * ==================================================
         */

        return {
          ...payable,

          /*
           * Source transaksi.
           */
          source,

          /*
           * Nomor transaksi.
           */
          transactionNumber,

          /*
           * Supplier.
           */
          supplierName,

          supplierId,

          /*
           * Tempo supplier.
           */
          tempoDays,

          /*
           * Informasi tanggal.
           */
          invoiceDate,

          /*
           * Jatuh tempo efektif.
           *
           * Bisa berasal dari:
           *
           * - PurchasePayable.dueDate
           * - fallback invoiceDate + tempoDays
           */
          dueDate,

          /*
           * Informasi tambahan supaya frontend/debugging
           * dapat mengetahui asal tanggal jatuh tempo.
           */
          dueDateSource,

          /*
           * PurchasePayable adalah source of truth
           * untuk angka hutang.
           */
          amount:
            payable.amount,

          paidAmount:
            payable.paidAmount,

          outstanding:
            payable.outstanding,

          status:
            payable.status,

          /*
           * Outlet.
           */
          outletName,
        };
      }
    );

    /*
     * ======================================================
     * RESPONSE
     * ======================================================
     */

    return NextResponse.json(
      result
    );
  } catch (error) {
    console.error(
      "GET PURCHASE PAYABLE ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Gagal mengambil data Purchase Payable.",
      },
      {
        status: 500,
      }
    );
  }
}