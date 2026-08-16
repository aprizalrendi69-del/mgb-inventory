import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  OutletPurchaseStatus,
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

  let userId: number | null = null;

  /*
   * -------------------------------------------------------
   * SESSION DATABASE
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
            fullname: true,
            username: true,
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
   * FALLBACK ERP JSON SESSION
   * -------------------------------------------------------
   */

  try {
    const parsed = JSON.parse(
      sessionCookie.value
    );

    userId = Number(
      parsed?.user?.id ??
        parsed?.id ??
        0
    );
  } catch {
    return null;
  }

  if (!userId || !Number.isInteger(userId)) {
    return null;
  }

  /*
   * -------------------------------------------------------
   * AMBIL USER TERBARU DARI DATABASE
   * -------------------------------------------------------
   */

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      fullname: true,
      username: true,
      role: true,
      active: true,
      outletId: true,
    },
  });

  if (!user || !user.active) {
    return null;
  }

  return user;
}

/*
 * =========================================================
 * POST APPROVE PURCHASE OUTLET
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
    /*
     * =====================================================
     * PARAMETER
     * =====================================================
     */

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
            "ID Purchase Outlet tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * USER LOGIN
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
     * ROLE SECURITY
     *
     * APPROVE PURCHASE OUTLET:
     *
     * ADMIN
     * PURCHASING
     *
     * MANAGER TIDAK BOLEH APPROVE
     * OUTLET_ADMIN TIDAK BOLEH APPROVE
     * ROLE LAIN TIDAK BOLEH APPROVE
     * =====================================================
     */

    const allowedRoles: Role[] = [
      Role.ADMIN,
      Role.PURCHASING,
    ];

    if (
      !allowedRoles.includes(user.role)
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
     * =====================================================
     * REQUEST BODY
     *
     * Endpoint approve tidak membutuhkan body.
     * Tetap parsing jika dikirim untuk menjaga kompatibilitas.
     * =====================================================
     */

    try {
      await req.json();
    } catch {
      // Body boleh kosong.
    }

    /*
     * =====================================================
     * TRANSACTION
     *
     * SEMUA DATA PURCHASE DIAMBIL ULANG DI DALAM
     * TRANSACTION AGAR TIDAK MENGGUNAKAN DATA STALE.
     * =====================================================
     */

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
           * -------------------------------------------------
           * AMBIL PURCHASE TERBARU
           * -------------------------------------------------
           */

          const purchase =
            await tx.outletPurchase.findUnique({
              where: {
                id: purchaseId,
              },

              include: {
                supplier: {
                  select: {
                    id: true,
                    name: true,
                  },
                },

                outlet: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },

                items: {
                  select: {
                    id: true,
                    barangId: true,
                    qty: true,
                    price: true,
                    subtotal: true,
                  },
                },
              },
            });

          if (!purchase) {
            throw new Error(
              "Purchase Outlet tidak ditemukan"
            );
          }

          /*
           * -------------------------------------------------
           * VALIDASI STATUS
           * -------------------------------------------------
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
           * -------------------------------------------------
           * VALIDASI OUTLET
           *
           * Purchase Outlet wajib memiliki outlet.
           * -------------------------------------------------
           */

          if (!purchase.outletId) {
            throw new Error(
              "Purchase Outlet tidak memiliki outlet"
            );
          }

          /*
           * -------------------------------------------------
           * VALIDASI SUPPLIER
           * -------------------------------------------------
           */

          if (!purchase.supplier) {
            throw new Error(
              "Supplier Purchase Outlet tidak ditemukan"
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
              "Purchase Outlet tidak memiliki barang"
            );
          }

          /*
           * -------------------------------------------------
           * VALIDASI ITEM
           * -------------------------------------------------
           */

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

            if (!item.barangId) {
              throw new Error(
                "Terdapat item Purchase Outlet tanpa barang"
              );
            }
          }

          /*
           * -------------------------------------------------
           * APPROVE ATOMIC
           *
           * PENTING:
           * updateMany memakai:
           *
           * id = purchaseId
           * status = DRAFT
           *
           * Jadi jika ada 2 request approve bersamaan,
           * hanya SATU yang bisa mengubah DRAFT -> APPROVED.
           * -------------------------------------------------
           */

          const updated =
            await tx.outletPurchase.updateMany({
              where: {
                id: purchase.id,

                status:
                  OutletPurchaseStatus.DRAFT,
              },

              data: {
                status:
                  OutletPurchaseStatus.APPROVED,
              },
            });

          /*
           * Tidak ada row yang berhasil diubah berarti
           * purchase sudah diproses request lain.
           */

          if (updated.count !== 1) {
            throw new Error(
              "Purchase Outlet sudah diproses oleh user lain"
            );
          }

          /*
           * -------------------------------------------------
           * HISTORY
           * -------------------------------------------------
           */

          await tx.history.create({
            data: {
              transactionType: "PURCHASE",

              referenceNumber:
                purchase.number,

              description:
                `Approve Purchase Outlet ${purchase.number} - ${purchase.supplier.name} - ${purchase.outlet.name}`,

              userId: user.id,
            },
          });

          /*
           * -------------------------------------------------
           * AMBIL HASIL TERBARU
           * -------------------------------------------------
           */

          const approved =
            await tx.outletPurchase.findUnique({
              where: {
                id: purchase.id,
              },

              include: {
                supplier: true,
                outlet: true,
                items: true,
              },
            });

          if (!approved) {
            throw new Error(
              "Purchase Outlet gagal diambil setelah approval"
            );
          }

          return approved;
        }
      );

    /*
     * =====================================================
     * RESPONSE
     * =====================================================
     */

    return NextResponse.json({
      success: true,

      message:
        "Purchase Outlet berhasil diapprove",

      data: result,
    });
  } catch (error: any) {
    console.error(
      "APPROVE OUTLET PURCHASE ERROR:",
      error
    );

    const message =
      error?.message ||
      "Approve Purchase Outlet gagal";

    /*
     * =====================================================
     * ERROR RESPONSE
     * =====================================================
     */

    if (
      message.includes(
        "tidak ditemukan"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message,
        },
        {
          status: 404,
        }
      );
    }

    if (
      message.includes(
        "tidak dapat diapprove"
      ) ||
      message.includes(
        "sudah diproses"
      ) ||
      message.includes(
        "tidak memiliki barang"
      ) ||
      message.includes(
        "tidak memiliki outlet"
      ) ||
      message.includes(
        "Supplier"
      ) ||
      message.includes(
        "qty"
      ) ||
      message.includes(
        "harga"
      )
    ) {
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

    return NextResponse.json(
      {
        success: false,
        message:
          "Approve Purchase Outlet gagal",
      },
      {
        status: 500,
      }
    );
  }
}