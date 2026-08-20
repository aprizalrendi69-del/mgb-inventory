import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// =====================================================
// HELPER: AMBIL NOMOR PO TERBESAR YANG PERNAH DIGUNAKAN
// =====================================================
//
// Prioritas:
// 1. Purchase yang masih ada
// 2. History Purchase yang pernah dibuat
//
// Tujuan:
// Nomor PO TIDAK BOLEH kembali ke nomor lama
// walaupun PO sebelumnya sudah dihapus.
//
// Contoh:
//
// PO-00001
// PO-00002
// PO-00003
//
// PO-00003 dihapus
//
// PO berikutnya:
// PO-00004
//
// =====================================================

async function getNextPurchaseNumber() {
  // ===================================================
  // AMBIL SEMUA NOMOR PO YANG MASIH ADA
  // ===================================================

  const purchases = await prisma.purchase.findMany({
    select: {
      number: true,
    },
  });

  // ===================================================
  // AMBIL HISTORY YANG BERKAITAN DENGAN PURCHASE
  // ===================================================
  //
  // History menyimpan referenceNumber seperti:
  //
  // PO-00001
  // PO-00002
  // PO-00003
  //
  // Walaupun Purchase sudah dihapus,
  // history tetap menjadi jejak nomor PO tersebut.
  //
  // ===================================================

  const histories = await prisma.history.findMany({
    where: {
      transactionType: "PURCHASE",
    },

    select: {
      referenceNumber: true,
    },
  });

  let highestNumber = 0;

  // ===================================================
  // CEK NOMOR DARI PURCHASE YANG MASIH ADA
  // ===================================================

  for (const purchase of purchases) {
    const match = purchase.number?.match(/^PO-(\d+)$/);

    if (!match) {
      continue;
    }

    const number = Number(match[1]);

    if (
      Number.isInteger(number) &&
      number > highestNumber
    ) {
      highestNumber = number;
    }
  }

  // ===================================================
  // CEK NOMOR DARI HISTORY
  // ===================================================

  for (const history of histories) {
    const match =
      history.referenceNumber?.match(/^PO-(\d+)$/);

    if (!match) {
      continue;
    }

    const number = Number(match[1]);

    if (
      Number.isInteger(number) &&
      number > highestNumber
    ) {
      highestNumber = number;
    }
  }

  // ===================================================
  // NOMOR BERIKUTNYA
  // ===================================================

  const nextNumber = highestNumber + 1;

  return `PO-${String(nextNumber).padStart(5, "0")}`;
}

// =====================================================
// GET PURCHASE ORDER
// =====================================================

export async function GET() {
  try {
    const cookieStore = await import("next/headers").then(
      async (module) => await module.cookies()
    );

    const session = cookieStore.get("erp-session");

    if (!session) {
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

    let sessionData: any;

    try {
      sessionData = JSON.parse(session.value);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Session tidak valid",
        },
        {
          status: 401,
        }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        id: sessionData.id,
      },

      select: {
        id: true,
        username: true,
        fullname: true,
        role: true,
        outletId: true,
        active: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "User tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    if (!user.active) {
      return NextResponse.json(
        {
          success: false,
          message: "User tidak aktif",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // USER PUSAT
    // =====================================================

    if (user.outletId === null) {
      const [
        purchasePusat,
        purchaseOutlet,
      ] = await Promise.all([
        prisma.purchase.findMany({
          include: {
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
        }),

        prisma.outletPurchase.findMany({
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
        }),
      ]);

      const pusat = purchasePusat.map((item) => ({
        ...item,

        source: "PUSAT",

        destinationType: "PUSAT",

        destinationId: null,

        destinationName: "Gudang Pusat",

        destinationCode: null,
      }));

      const outlet = purchaseOutlet.map((item) => ({
        ...item,

        source: "OUTLET",

        destinationType: "OUTLET",

        destinationId: item.outletId,

        destinationName:
          item.outlet?.name || "-",

        destinationCode:
          item.outlet?.code || "-",
      }));

      const data = [
        ...pusat,
        ...outlet,
      ].sort((a, b) => {
        const dateA = new Date(
          a.purchaseDate
        ).getTime();

        const dateB = new Date(
          b.purchaseDate
        ).getTime();

        return dateB - dateA;
      });

      return NextResponse.json({
        success: true,
        data,
      });
    }

    // =====================================================
    // USER OUTLET
    // =====================================================

    const purchaseOutlet =
      await prisma.outletPurchase.findMany({
        where: {
          outletId: user.outletId,
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

        orderBy: {
          id: "desc",
        },
      });

    const data = purchaseOutlet.map((item) => ({
      ...item,

      source: "OUTLET",

      destinationType: "OUTLET",

      destinationId: item.outletId,

      destinationName:
        item.outlet?.name || "-",

      destinationCode:
        item.outlet?.code || "-",
    }));

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "GET PURCHASE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil data Purchase Order",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// CREATE PURCHASE ORDER PUSAT
// =====================================================

export async function POST(
  req: NextRequest
) {
  try {
    const body = await req.json();

    const {
      supplierId,
      remarks,
      items,
    } = body;

    // =====================================================
    // VALIDASI SUPPLIER
    // =====================================================

    if (!supplierId) {
      return NextResponse.json(
        {
          success: false,
          message: "Supplier wajib dipilih",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // VALIDASI ITEM
    // =====================================================

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Barang belum dipilih",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // CEK SUPPLIER
    // =====================================================

    const supplier =
      await prisma.supplier.findUnique({
        where: {
          id: Number(supplierId),
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

    // =====================================================
    // VALIDASI ITEM + HITUNG TOTAL
    // =====================================================

    let total = 0;

    for (const item of items) {
      const barangId =
        Number(item.barangId);

      const qty =
        Number(item.qty);

      const price =
        Number(item.price);

      if (
        !barangId ||
        qty <= 0 ||
        price <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Barang, Qty, dan Harga harus valid",
          },
          {
            status: 400,
          }
        );
      }

      const barang =
        await prisma.barang.findUnique({
          where: {
            id: barangId,
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

      total += qty * price;
    }

    // =====================================================
    // CREATE PURCHASE + HISTORY
    // =====================================================
    //
    // Nomor dibuat berdasarkan:
    //
    // - Purchase yang masih ada
    // - History Purchase yang pernah ada
    //
    // Jadi DELETE tidak menyebabkan nomor kembali.
    //
    // =====================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // =================================================
          // AMBIL NOMOR PURCHASE YANG MASIH ADA
          // =================================================

          const purchases =
            await tx.purchase.findMany({
              select: {
                number: true,
              },
            });

          // =================================================
          // AMBIL HISTORY PURCHASE
          // =================================================

          const histories =
            await tx.history.findMany({
              where: {
                transactionType:
                  "PURCHASE",
              },

              select: {
                referenceNumber: true,
              },
            });

          let highestNumber = 0;

          // =================================================
          // CEK PURCHASE
          // =================================================

          for (const purchase of purchases) {
            const match =
              purchase.number?.match(
                /^PO-(\d+)$/
              );

            if (!match) {
              continue;
            }

            const number =
              Number(match[1]);

            if (
              Number.isInteger(number) &&
              number > highestNumber
            ) {
              highestNumber = number;
            }
          }

          // =================================================
          // CEK HISTORY
          // =================================================

          for (const history of histories) {
            const match =
              history.referenceNumber?.match(
                /^PO-(\d+)$/
              );

            if (!match) {
              continue;
            }

            const number =
              Number(match[1]);

            if (
              Number.isInteger(number) &&
              number > highestNumber
            ) {
              highestNumber = number;
            }
          }

          // =================================================
          // GENERATE NOMOR PO
          // =================================================

          const nextNumber =
            highestNumber + 1;

          const number =
            `PO-${String(
              nextNumber
            ).padStart(5, "0")}`;

          // =================================================
          // CEK ULANG NOMOR
          // =================================================
          //
          // Safety tambahan supaya tidak ada duplicate.
          //
          // =================================================

          const existing =
            await tx.purchase.findUnique({
              where: {
                number,
              },

              select: {
                id: true,
              },
            });

          if (existing) {
            throw new Error(
              `Nomor Purchase Order ${number} sudah digunakan. Silakan coba lagi.`
            );
          }

          // =================================================
          // CREATE PURCHASE
          // =================================================

          const purchase =
            await tx.purchase.create({
              data: {
                number,

                supplierId:
                  Number(supplierId),

                total,

                remarks:
                  remarks || null,

                items: {
                  create:
                    items.map(
                      (item: any) => {
                        const qty =
                          Number(
                            item.qty
                          );

                        const price =
                          Number(
                            item.price
                          );

                        return {
                          barangId:
                            Number(
                              item.barangId
                            ),

                          qty,

                          price,

                          subtotal:
                            qty * price,
                        };
                      }
                    ),
                },
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

          // =================================================
          // HISTORY
          // =================================================

          await tx.history.create({
            data: {
              transactionType:
                "PURCHASE",

              referenceNumber:
                purchase.number,

              description:
                "Membuat Purchase Order " +
                purchase.number,
            },
          });

          return purchase;
        }
      );

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,

      message:
        "Purchase Order berhasil dibuat",

      data: result,
    });
  } catch (error: any) {
    console.error(
      "POST PURCHASE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal membuat Purchase Order",
      },
      {
        status: 500,
      }
    );
  }
}