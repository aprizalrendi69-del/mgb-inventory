import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import {
  PaymentMethod,
  Role,
} from "@prisma/client";
import { randomUUID } from "crypto";

// =====================================================
// CURRENT USER
// =====================================================

async function getCurrentUser() {
  const cookieStore = await cookies();

  const session =
    cookieStore.get("erp-session");

  if (!session) {
    return null;
  }

  let sessionData: any;

  try {
    sessionData = JSON.parse(
      session.value
    );
  } catch {
    return null;
  }

  const userId = Number(
    sessionData?.user?.id ??
      sessionData?.id
  );

  if (
    !userId ||
    !Number.isInteger(userId)
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

  if (!user || !user.active) {
    return null;
  }

  return user;
}

// =====================================================
// ACCESS PURCHASE OUTLET
// =====================================================

function canAccessOutletPurchase(
  role: Role
) {
  return (
    role === Role.ADMIN ||
    role === Role.PURCHASING ||
    role === Role.OUTLET_ADMIN
  );
}

// =====================================================
// CREATE PURCHASE OUTLET
// =====================================================

function canCreateOutletPurchase(
  role: Role
) {
  return (
    role === Role.ADMIN ||
    role === Role.PURCHASING ||
    role === Role.OUTLET_ADMIN
  );
}

// =====================================================
// PAYMENT ACCESS
// =====================================================
//
// CATATAN:
//
// Proses PAYMENT / PELUNASAN bukan dilakukan
// di route ini.
//
// Route ini hanya membuat Purchase Order
// dan menyimpan paymentMethod sebagai metode
// pembayaran yang dipilih pada PO.
//
// Hak akses PAYMENT aktual harus dibatasi
// pada endpoint payment khusus.
//
// Hanya ADMIN pusat yang boleh melakukan
// proses PAYMENT / PELUNASAN.
//

function canProcessPayment(
  role: Role
) {
  return role === Role.ADMIN;
}

// =====================================================
// OUTLET FILTER
// =====================================================

function getOutletFilter(user: {
  role: Role;
  outletId: number | null;
}) {
  if (
    user.role === Role.OUTLET_ADMIN
  ) {
    return {
      outletId:
        user.outletId ?? -1,
    };
  }

  return {};
}

// =====================================================
// ALLOWED PAYMENT METHODS
// =====================================================
//
// Ini tetap diperbolehkan untuk pembuatan PO.
//
// CASH
// TRANSFER
// COD
// CBD
// TEMPO
//
// Jangan dibatasi ADMIN di sini karena
// PURCHASING / OUTLET_ADMIN tetap perlu
// membuat PO dengan metode pembayaran.
//

const ALLOWED_PAYMENT_METHODS: PaymentMethod[] =
  [
    PaymentMethod.CASH,
    PaymentMethod.TRANSFER,
    PaymentMethod.COD,
    PaymentMethod.CBD,
    PaymentMethod.TEMPO,
  ];

// =====================================================
// PARSE PURCHASE DATE
// =====================================================

function parsePurchaseDate(
  value: unknown
): Date | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const raw =
    value.trim();

  /*
   * Hanya menerima:
   *
   * YYYY-MM-DD
   */
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      raw
    )
  ) {
    return null;
  }

  const [
    yearText,
    monthText,
    dayText,
  ] = raw.split("-");

  const year =
    Number(yearText);

  const month =
    Number(monthText);

  const day =
    Number(dayText);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  /*
   * Batasi tahun supaya tidak
   * menerima tanggal aneh.
   */

  if (
    year < 2000 ||
    year > 2100
  ) {
    return null;
  }

  /*
   * Local date supaya tidak berubah
   * karena timezone UTC.
   */

  const date =
    new Date(
      year,
      month - 1,
      day,
      0,
      0,
      0,
      0
    );

  /*
   * Validasi tanggal sebenarnya.
   *
   * Contoh:
   * 2026-02-31
   *
   * harus ditolak.
   */

  if (
    date.getFullYear() !==
      year ||
    date.getMonth() !==
      month - 1 ||
    date.getDate() !==
      day
  ) {
    return null;
  }

  return date;
}

// =====================================================
// GET PURCHASE OUTLET
// =====================================================

export async function GET() {
  try {
    const user =
      await getCurrentUser();

    // ---------------------------------------------------
    // SESSION
    // ---------------------------------------------------

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

    // ---------------------------------------------------
    // ACCESS
    // ---------------------------------------------------

    if (
      !canAccessOutletPurchase(
        user.role
      )
    ) {
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

    // ---------------------------------------------------
    // OUTLET ADMIN MUST HAVE OUTLET
    // ---------------------------------------------------

    if (
      user.role ===
        Role.OUTLET_ADMIN &&
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

    // ---------------------------------------------------
    // OUTLET FILTER
    // ---------------------------------------------------

    const outletFilter =
      getOutletFilter({
        role: user.role,
        outletId:
          user.outletId,
      });

    // ---------------------------------------------------
    // GET DATA
    // ---------------------------------------------------

    const data =
      await prisma.outletPurchase.findMany(
        {
          where:
            outletFilter,

          include: {
            outlet: true,

            supplier: true,

            items: {
              include: {
                barang: true,
              },
            },
          },

          /*
           * Purchase Order diurutkan
           * berdasarkan purchaseDate.
           *
           * createdAt TIDAK digunakan
           * sebagai tanggal PO.
           */

          orderBy: [
            {
              purchaseDate:
                "desc",
            },
            {
              id: "desc",
            },
          ],
        }
      );

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

// =====================================================
// POST PURCHASE OUTLET
// =====================================================

export async function POST(
  req: NextRequest
) {
  try {
    const user =
      await getCurrentUser();

    // ---------------------------------------------------
    // SESSION
    // ---------------------------------------------------

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

    // ---------------------------------------------------
    // CREATE ACCESS
    // ---------------------------------------------------

    if (
      !canCreateOutletPurchase(
        user.role
      )
    ) {
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

    // ---------------------------------------------------
    // OUTLET ADMIN VALIDATION
    // ---------------------------------------------------

    if (
      user.role ===
        Role.OUTLET_ADMIN &&
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

    // ---------------------------------------------------
    // REQUEST BODY
    // ---------------------------------------------------

    let body: any;

    try {
      body =
        await req.json();
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

    const requestedOutletId =
      Number(
        body?.outletId
      );

    const supplierId =
      Number(
        body?.supplierId
      );

    // ===================================================
    // PURCHASE DATE
    // ===================================================

    const purchaseDateValue =
      parsePurchaseDate(
        body?.purchaseDate
      );

    if (
      !purchaseDateValue
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tanggal Purchase Order wajib diisi dan harus valid dengan format YYYY-MM-DD",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // PAYMENT METHOD
    // ===================================================
    //
    // Ini adalah PAYMENT METHOD pada PO.
    //
    // BUKAN proses pelunasan.
    //
    // Jadi tetap boleh dipilih oleh:
    //
    // ADMIN
    // PURCHASING
    // OUTLET_ADMIN
    //
    // Proses pelunasan aktual tetap harus
    // dibatasi pada endpoint payment.
    // ===================================================

    const rawPaymentMethod =
      body?.paymentMethod !==
        undefined &&
      body?.paymentMethod !==
        null
        ? String(
            body.paymentMethod
          ).trim()
        : "";

    if (
      !rawPaymentMethod
    ) {
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

    // ===================================================
    // REMARKS
    // ===================================================

    const remarks =
      body?.remarks !==
        undefined &&
      body?.remarks !==
        null
        ? String(
            body.remarks
          ).trim()
        : null;

    // ===================================================
    // ITEMS
    // ===================================================

    const items =
      Array.isArray(
        body?.items
      )
        ? body.items
        : [];

    if (
      items.length === 0
    ) {
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

    if (
      items.length > 500
    ) {
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

    // ===================================================
    // DETERMINE OUTLET
    // ===================================================

    let outletId: number;

    if (
      user.role ===
      Role.OUTLET_ADMIN
    ) {
      outletId =
        Number(
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

    // ===================================================
    // CHECK OUTLET
    // ===================================================

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

    if (
      !outlet.active
    ) {
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

    // ===================================================
    // CHECK SUPPLIER
    // ===================================================

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
      await prisma.supplier.findUnique(
        {
          where: {
            id: supplierId,
          },
        }
      );

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

    // ===================================================
    // NORMALIZE ITEMS
    // ===================================================

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

      // -------------------------------------------------
      // BARANG ID
      // -------------------------------------------------

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

      // -------------------------------------------------
      // DUPLICATE BARANG
      // -------------------------------------------------

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

      // -------------------------------------------------
      // QTY
      // -------------------------------------------------

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

      // -------------------------------------------------
      // PRICE
      // -------------------------------------------------

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

      // -------------------------------------------------
      // LIMIT
      // -------------------------------------------------

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

      // -------------------------------------------------
      // CHECK BARANG
      // -------------------------------------------------

      const barang =
        await prisma.barang.findUnique(
          {
            where: {
              id: barangId,
            },

            select: {
              id: true,
              code: true,
              name: true,
              active: true,
            },
          }
        );

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

      // -------------------------------------------------
      // BARANG ACTIVE
      // -------------------------------------------------

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

      // -------------------------------------------------
      // SUBTOTAL
      // -------------------------------------------------

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

    // ===================================================
    // TOTAL VALIDATION
    // ===================================================

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

    // ===================================================
    // CREATE PURCHASE
    // ===================================================

    const purchase =
      await prisma.$transaction(
        async (tx) => {
          // ------------------------------------------------
          // TEMPORARY NUMBER
          // ------------------------------------------------

          const temporaryNumber =
            `TMP-${randomUUID()}`;

          // ------------------------------------------------
          // CREATE
          // ------------------------------------------------

          const created =
            await tx.outletPurchase.create(
              {
                data: {
                  number:
                    temporaryNumber,

                  outletId,

                  supplierId,

                  /*
                   * Tanggal PO yang dipilih user.
                   *
                   * Bukan createdAt.
                   */

                  purchaseDate:
                    purchaseDateValue,

                  /*
                   * Metode pembayaran PO.
                   *
                   * Bukan berarti PO sudah dibayar.
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
              }
            );

          // =================================================
          // FINAL PURCHASE NUMBER
          // =================================================

          const finalNumber =
            `OP-${String(
              created.id
            ).padStart(
              5,
              "0"
            )}`;

          // =================================================
          // UPDATE NUMBER
          // =================================================

          const updated =
            await tx.outletPurchase.update(
              {
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
              }
            );

          // =================================================
          // HISTORY
          // =================================================

          await tx.history.create({
            data: {
              transactionType:
                "PURCHASE",

              referenceNumber:
                finalNumber,

              description:
                `Membuat Purchase Order Outlet ${finalNumber} untuk outlet ${outlet.name} tanggal ${purchaseDateValue.toLocaleDateString(
                  "id-ID"
                )}`,

              userId:
                user.id,
            },
          });

          return updated;
        }
      );

    // ===================================================
    // SUCCESS
    // ===================================================

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