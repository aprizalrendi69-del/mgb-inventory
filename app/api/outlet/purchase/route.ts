import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import {
  PaymentMethod,
  Role,
} from "@prisma/client";
import { randomUUID } from "crypto";

/*
 * =========================================================
 * CURRENT USER
 * =========================================================
 */

async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get("erp-session");

  if (!session) {
    return null;
  }

  let sessionData: any;

  try {
    sessionData = JSON.parse(session.value);
  } catch {
    return null;
  }

  const userId = Number(
    sessionData?.user?.id ??
      sessionData?.id
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
      fullname: true,
      role: true,
      active: true,
      outletId: true,
      outlet: {
        select: {
          id: true,
          code: true,
          name: true,
          active: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  if (!user.active) {
    return null;
  }

  return user;
}

/*
 * =========================================================
 * ROLE ACCESS
 * =========================================================
 *
 * OUTLET_ADMIN
 * -> boleh membuat dan melihat PO outlet sendiri
 *
 * ADMIN
 * -> boleh melihat dan membuat PO semua outlet
 *
 * PURCHASING
 * -> boleh melihat dan membuat PO semua outlet
 *
 * MANAGER
 * -> TIDAK memiliki akses endpoint ini
 *
 * Role lain
 * -> TIDAK memiliki akses
 * =========================================================
 */

function canAccessOutletPurchase(
  role: Role
) {
  return (
    role === Role.ADMIN ||
    role === Role.PURCHASING ||
    role === Role.OUTLET_ADMIN
  );
}

function canCreateOutletPurchase(
  role: Role
) {
  return (
    role === Role.ADMIN ||
    role === Role.PURCHASING ||
    role === Role.OUTLET_ADMIN
  );
}

/*
 * =========================================================
 * GET OUTLET FILTER
 * =========================================================
 */

function getOutletFilter(user: {
  role: Role;
  outletId: number | null;
}) {
  if (user.role === Role.OUTLET_ADMIN) {
    return {
      outletId: user.outletId ?? -1,
    };
  }

  return {};
}

/*
 * =========================================================
 * PAYMENT METHOD
 * =========================================================
 *
 * Metode yang digunakan oleh halaman Purchase Outlet Baru:
 *
 * CASH
 * TRANSFER
 * COD
 * CBD
 * TEMPO
 *
 * Backend tetap menggunakan enum PaymentMethod dari Prisma
 * agar nilai yang masuk ke database selalu valid.
 * =========================================================
 */

const ALLOWED_PAYMENT_METHODS: PaymentMethod[] = [
  PaymentMethod.CASH,
  PaymentMethod.TRANSFER,
  PaymentMethod.COD,
  PaymentMethod.CBD,
  PaymentMethod.TEMPO,
];

/*
 * =========================================================
 * GET
 * =========================================================
 *
 * ADMIN / PURCHASING
 * -> melihat semua PO outlet
 *
 * OUTLET_ADMIN
 * -> hanya melihat PO outlet sendiri
 * =========================================================
 */

export async function GET() {
  try {
    /*
     * -------------------------------------------------------
     * SESSION
     * -------------------------------------------------------
     */

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login atau session tidak valid",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * -------------------------------------------------------
     * ROLE
     * -------------------------------------------------------
     */

    if (!canAccessOutletPurchase(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses Purchase Outlet",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * -------------------------------------------------------
     * OUTLET ADMIN WAJIB PUNYA OUTLET
     * -------------------------------------------------------
     */

    if (
      user.role === Role.OUTLET_ADMIN &&
      !user.outletId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User Outlet Admin belum terhubung dengan outlet",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * -------------------------------------------------------
     * FILTER
     * -------------------------------------------------------
     */

    const outletFilter = getOutletFilter({
      role: user.role,
      outletId: user.outletId,
    });

    /*
     * -------------------------------------------------------
     * DATA
     * -------------------------------------------------------
     */

    const data =
      await prisma.outletPurchase.findMany({
        where: outletFilter,

        include: {
          outlet: true,

          supplier: true,

          items: {
            include: {
              barang: true,
            },
          },
        },

        orderBy: {
          id: "desc",
        },
      });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "GET OUTLET PURCHASE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil data Purchase Outlet",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * =========================================================
 * POST
 * =========================================================
 *
 * CREATE PURCHASE OUTLET
 *
 * PAYMENT METHOD:
 *
 * Frontend mengirim:
 *
 * {
 *   paymentMethod: "TRANSFER"
 * }
 *
 * Backend:
 * -> validasi
 * -> simpan ke OutletPurchase.paymentMethod
 *
 * Sehingga alurnya:
 *
 * Purchase Outlet Baru
 *        ↓
 * Payment Method
 *        ↓
 * OutletPurchase
 *        ↓
 * Approve
 *        ↓
 * Payment
 * =========================================================
 */

export async function POST(
  req: NextRequest
) {
  try {
    /*
     * -------------------------------------------------------
     * SESSION
     * -------------------------------------------------------
     */

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak login atau session tidak valid",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * -------------------------------------------------------
     * ROLE
     * -------------------------------------------------------
     */

    if (!canCreateOutletPurchase(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki izin membuat Purchase Outlet",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * -------------------------------------------------------
     * OUTLET ADMIN HARUS PUNYA OUTLET
     * -------------------------------------------------------
     */

    if (
      user.role === Role.OUTLET_ADMIN &&
      !user.outletId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User Outlet Admin belum terhubung dengan outlet",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * -------------------------------------------------------
     * BODY
     * -------------------------------------------------------
     */

    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Format request tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -------------------------------------------------------
     * BASIC DATA
     * -------------------------------------------------------
     */

    const requestedOutletId = Number(
      body?.outletId
    );

    const supplierId = Number(
      body?.supplierId
    );

    /*
     * -------------------------------------------------------
     * PAYMENT METHOD
     * -------------------------------------------------------
     *
     * WAJIB.
     *
     * Frontend:
     *
     * CASH
     * TRANSFER
     * COD
     * CBD
     * TEMPO
     *
     * Backend melakukan validasi enum Prisma.
     * -------------------------------------------------------
     */

    const rawPaymentMethod =
      body?.paymentMethod !== undefined &&
      body?.paymentMethod !== null
        ? String(
            body.paymentMethod
          ).trim()
        : "";

    if (!rawPaymentMethod) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Metode pembayaran wajib dipilih",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Pastikan nilai yang dikirim benar-benar
     * merupakan enum PaymentMethod yang diizinkan.
     */

    if (
      !ALLOWED_PAYMENT_METHODS.includes(
        rawPaymentMethod as PaymentMethod
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

    const paymentMethod =
      rawPaymentMethod as PaymentMethod;

    /*
     * -------------------------------------------------------
     * REMARKS
     * -------------------------------------------------------
     */

    const remarks =
      body?.remarks !== undefined &&
      body?.remarks !== null
        ? String(
            body.remarks
          ).trim()
        : null;

    /*
     * -------------------------------------------------------
     * ITEMS
     * -------------------------------------------------------
     */

    const items = Array.isArray(
      body?.items
    )
      ? body.items
      : [];

    /*
     * -------------------------------------------------------
     * VALIDASI ITEMS
     * -------------------------------------------------------
     */

    if (items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Barang belum dipilih",
        },
        {
          status: 400,
        }
      );
    }

    if (items.length > 500) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Jumlah barang dalam satu Purchase Outlet terlalu banyak",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -------------------------------------------------------
     * TENTUKAN OUTLET
     * -------------------------------------------------------
     *
     * OUTLET_ADMIN
     * -> SELALU session outlet
     *
     * ADMIN / PURCHASING
     * -> boleh memilih outlet
     *
     * outletId dari frontend TIDAK PERNAH
     * digunakan untuk OUTLET_ADMIN.
     * -------------------------------------------------------
     */

    let outletId: number;

    if (
      user.role === Role.OUTLET_ADMIN
    ) {
      outletId = Number(
        user.outletId
      );

      if (
        !outletId ||
        !Number.isInteger(
          outletId
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User Outlet Admin belum memiliki outlet yang valid",
          },
          {
            status: 400,
          }
        );
      }
    } else {
      if (
        !requestedOutletId ||
        !Number.isInteger(
          requestedOutletId
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet wajib dipilih",
          },
          {
            status: 400,
          }
        );
      }

      outletId =
        requestedOutletId;
    }

    /*
     * -------------------------------------------------------
     * CEK OUTLET
     * -------------------------------------------------------
     */

    const outlet =
      await prisma.outlet.findUnique({
        where: {
          id: outletId,
        },

        select: {
          id: true,
          code: true,
          name: true,
          active: true,
        },
      });

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
            "Outlet tersebut sedang tidak aktif",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -------------------------------------------------------
     * CEK SUPPLIER
     * -------------------------------------------------------
     */

    if (
      !supplierId ||
      !Number.isInteger(
        supplierId
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Supplier wajib dipilih",
        },
        {
          status: 400,
        }
      );
    }

    const supplier =
      await prisma.supplier.findUnique({
        where: {
          id: supplierId,
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
     * -------------------------------------------------------
     * VALIDASI ITEMS
     * -------------------------------------------------------
     */

    const normalizedItems: {
      barangId: number;
      qty: number;
      price: number;
      subtotal: number;
    }[] = [];

    const barangIds =
      new Set<number>();

    let total = 0;

    for (
      let index = 0;
      index < items.length;
      index++
    ) {
      const item =
        items[index];

      const barangId =
        Number(
          item?.barangId
        );

      const qty =
        Number(
          item?.qty
        );

      const price =
        Number(
          item?.price
        );

      /*
       * -----------------------------------------------------
       * ID BARANG
       * -----------------------------------------------------
       */

      if (
        !barangId ||
        !Number.isInteger(
          barangId
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang pada item ke-${index + 1} tidak valid`,
          },
          {
            status: 400,
          }
        );
      }

      /*
       * -----------------------------------------------------
       * CEGAH DUPLIKAT BARANG
       * -----------------------------------------------------
       */

      if (
        barangIds.has(
          barangId
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang ID ${barangId} muncul lebih dari satu kali`,
          },
          {
            status: 400,
          }
        );
      }

      barangIds.add(
        barangId
      );

      /*
       * -----------------------------------------------------
       * QTY
       * -----------------------------------------------------
       */

      if (
        !Number.isFinite(
          qty
        ) ||
        qty <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Qty barang pada item ke-${index + 1} harus lebih dari 0`,
          },
          {
            status: 400,
          }
        );
      }

      /*
       * -----------------------------------------------------
       * PRICE
       * -----------------------------------------------------
       */

      if (
        !Number.isFinite(
          price
        ) ||
        price <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Harga barang pada item ke-${index + 1} harus lebih dari 0`,
          },
          {
            status: 400,
          }
        );
      }

      /*
       * -----------------------------------------------------
       * CEGAH ANGKA TERLALU BESAR
       * -----------------------------------------------------
       */

      if (
        qty >
          1000000000 ||
        price >
          1000000000000
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Qty atau harga barang pada item ke-${index + 1} terlalu besar`,
          },
          {
            status: 400,
          }
        );
      }

      /*
       * -----------------------------------------------------
       * CEK BARANG
       * -----------------------------------------------------
       */

      const barang =
        await prisma.barang.findUnique({
          where: {
            id: barangId,
          },

          select: {
            id: true,
            code: true,
            name: true,
            active: true,
          },
        });

      if (!barang) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang ID ${barangId} tidak ditemukan`,
          },
          {
            status: 404,
          }
        );
      }

      /*
       * -----------------------------------------------------
       * BARANG NONAKTIF TIDAK BOLEH
       * -----------------------------------------------------
       */

      if (
        barang.active ===
        false
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Barang ${barang.name} sedang tidak aktif`,
          },
          {
            status: 400,
          }
        );
      }

      /*
       * -----------------------------------------------------
       * SUBTOTAL
       * -----------------------------------------------------
       */

      const subtotal =
        qty * price;

      if (
        !Number.isFinite(
          subtotal
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Subtotal barang ${barang.name} tidak valid`,
          },
          {
            status: 400,
          }
        );
      }

      total +=
        subtotal;

      normalizedItems.push({
        barangId,
        qty,
        price,
        subtotal,
      });
    }

    /*
     * -------------------------------------------------------
     * VALIDASI TOTAL
     * -------------------------------------------------------
     */

    if (
      !Number.isFinite(
        total
      ) ||
      total < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Total Purchase Outlet tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =======================================================
     * CREATE PURCHASE
     * =======================================================
     *
     * Nomor temporary dibuat terlebih dahulu agar aman
     * terhadap request bersamaan.
     *
     * Setelah ID didapat:
     *
     * OP-00001
     * OP-00002
     * dst.
     * =======================================================
     */

    const purchase =
      await prisma.$transaction(
        async (tx) => {
          /*
           * -------------------------------------------------
           * TEMP NUMBER
           * -------------------------------------------------
           */

          const temporaryNumber =
            `TMP-${randomUUID()}`;

          /*
           * -------------------------------------------------
           * CREATE
           * -------------------------------------------------
           *
           * PAYMENT METHOD SEKARANG DISIMPAN DI SINI.
           * -------------------------------------------------
           */

          const created =
            await tx.outletPurchase.create({
              data: {
                number:
                  temporaryNumber,

                outletId,

                supplierId,

                /*
                 * =========================================
                 * PAYMENT METHOD
                 * =========================================
                 */

                paymentMethod,

                total,

                remarks:
                  remarks ||
                  null,

                items: {
                  create:
                    normalizedItems.map(
                      (
                        item
                      ) => ({
                        barangId:
                          item.barangId,

                        qty:
                          item.qty,

                        price:
                          item.price,

                        subtotal:
                          item.subtotal,
                      })
                    ),
                },
              },

              include: {
                outlet: true,

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
           * FINAL NUMBER
           * -------------------------------------------------
           */

          const finalNumber =
            `OP-${String(
              created.id
            ).padStart(
              5,
              "0"
            )}`;

          /*
           * -------------------------------------------------
           * UPDATE NUMBER
           * -------------------------------------------------
           */

          const updated =
            await tx.outletPurchase.update({
              where: {
                id: created.id,
              },

              data: {
                number:
                  finalNumber,
              },

              include: {
                outlet: true,

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
                finalNumber,

              description:
                `Membuat Purchase Order Outlet ${finalNumber} untuk outlet ${outlet.name}`,

              userId:
                user.id,
            },
          });

          return updated;
        }
      );

    /*
     * =======================================================
     * RESPONSE
     * =======================================================
     */

    return NextResponse.json({
      success: true,

      message:
        "Purchase Order Outlet berhasil dibuat",

      data: purchase,
    });
  } catch (error: any) {
    console.error(
      "POST OUTLET PURCHASE ERROR:",
      error
    );

    /*
     * Jangan bocorkan detail database
     * ke browser.
     */

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal membuat Purchase Order Outlet",
      },
      {
        status: 500,
      }
    );
  }
}