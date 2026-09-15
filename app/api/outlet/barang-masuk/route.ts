import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// =====================================================
// CURRENT USER
// =====================================================

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
    sessionData?.id ??
      sessionData?.user?.id
  );

  if (
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    return null;
  }

  return await prisma.user.findUnique({
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
}

// =====================================================
// GET OUTLET BARANG MASUK
//
// ADMIN / MANAGER
// -> semua outlet
// -> bisa filter outlet
// -> bisa filter tanggal
//
// OUTLET_ADMIN
// -> hanya outlet sendiri
//
// SUMBER:
// 1. PURCHASE SUPPLIER
// 2. GUDANG / PUSAT -> OUTLET
// 3. OUTLET -> OUTLET
//
// VOID:
// - Transfer tetap tampil
// - Transfer tetap bisa RECEIVED
// - Item void tidak dihitung sebagai received
// - Item void tidak masuk stock
// - Ditandai hasVoid = true
// - voidItemCount dan voidTotalQty dikirim
//
// INVOICE SUPPLIER:
// - Diambil dari OutletReceipt.invoiceNumber
// - Relasi berdasarkan OutletReceipt.purchaseId
// - Tidak menggunakan Purchase.number sebagai invoice
//
// =====================================================

export async function GET(
  request: NextRequest
) {
  try {
    // ===================================================
    // 1. SESSION
    // ===================================================

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

    // ===================================================
    // 2. USER AKTIF
    // ===================================================

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

    // ===================================================
    // 3. ROLE
    // ===================================================

    const role = String(
      user.role || ""
    ).toUpperCase();

    if (
      role !== "ADMIN" &&
      role !== "MANAGER" &&
      role !== "OUTLET_ADMIN"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak memiliki akses barang masuk outlet",
        },
        {
          status: 403,
        }
      );
    }

    // ===================================================
    // 4. QUERY PARAMETER
    // ===================================================

    const { searchParams } =
      new URL(request.url);

    const outletIdParam =
      searchParams.get("outletId");

    const dateFrom =
      searchParams.get("dateFrom");

    const dateTo =
      searchParams.get("dateTo");

    // ===================================================
    // 5. VALIDASI OUTLET ID
    // ===================================================

    let selectedOutletId:
      number | null = null;

    if (outletIdParam) {
      const parsedOutletId =
        Number(outletIdParam);

      if (
        !Number.isInteger(
          parsedOutletId
        ) ||
        parsedOutletId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet ID tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      selectedOutletId =
        parsedOutletId;
    }

    // ===================================================
    // 6. SECURITY OUTLET
    // ===================================================

    let outletFilter: any = {};

    if (
      role === "OUTLET_ADMIN"
    ) {
      if (
        !user.outletId ||
        !Number.isInteger(
          user.outletId
        ) ||
        user.outletId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "User outlet belum terhubung dengan outlet",
          },
          {
            status: 400,
          }
        );
      }

      if (
        selectedOutletId !== null &&
        selectedOutletId !==
          user.outletId
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Anda hanya dapat melihat barang masuk outlet sendiri",
          },
          {
            status: 403,
          }
        );
      }

      outletFilter = {
        outletId:
          user.outletId,
      };
    } else {
      if (
        selectedOutletId !== null
      ) {
        outletFilter = {
          outletId:
            selectedOutletId,
        };
      }
    }

    // ===================================================
    // 7. FILTER TANGGAL
    // ===================================================

    function buildDateFilter(
      fieldName: string
    ) {
      const filter: any = {};

      if (dateFrom) {
        const start =
          new Date(
            `${dateFrom}T00:00:00`
          );

        if (
          Number.isNaN(
            start.getTime()
          )
        ) {
          throw new Error(
            "Tanggal awal tidak valid"
          );
        }

        filter[fieldName] = {
          ...(filter[fieldName] || {}),
          gte: start,
        };
      }

      if (dateTo) {
        const end =
          new Date(
            `${dateTo}T23:59:59.999`
          );

        if (
          Number.isNaN(
            end.getTime()
          )
        ) {
          throw new Error(
            "Tanggal akhir tidak valid"
          );
        }

        filter[fieldName] = {
          ...(filter[fieldName] || {}),
          lte: end,
        };
      }

      return filter;
    }

    // ===================================================
    // 8. PURCHASE DATE FILTER
    // ===================================================

    const purchaseDateFilter =
      buildDateFilter(
        "purchaseDate"
      );

    // ===================================================
    // 9. PURCHASE OUTLET
    // ===================================================

    const purchases =
      await prisma.outletPurchase.findMany(
        {
          where: {
            ...outletFilter,
            ...purchaseDateFilter,
          },

          include: {
            outlet: {
              select: {
                id: true,
                code: true,
                name: true,
                active: true,
              },
            },

            supplier: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },

            items: {
              include: {
                barang: true,
              },
            },
          },

          orderBy: {
            purchaseDate:
              "desc",
          },
        }
      );

    // ===================================================
    // 10. VALIDASI PURCHASE
    // ===================================================

    const validPurchases =
      purchases.filter(
        (purchase) => {
          if (
            !purchase.outlet ||
            !purchase.outlet.active
          ) {
            return false;
          }

          return purchase.items.every(
            (item) =>
              item.barang &&
              item.barang.source ===
                "CENTRAL"
          );
        }
      );

    // ===================================================
    // 11. AMBIL INVOICE SUPPLIER
    //
    // Invoice supplier disimpan di OutletReceipt,
    // bukan di OutletPurchase.
    //
    // Relasi:
    // OutletReceipt.purchaseId
    //            ↓
    // OutletPurchase.id
    //
    // Tidak mengubah data apa pun.
    // Hanya membaca data receipt.
    // ===================================================

    const purchaseIds =
      validPurchases.map(
        (purchase) =>
          purchase.id
      );

    const purchaseReceipts =
      purchaseIds.length > 0
        ? await prisma.outletReceipt.findMany(
            {
              where: {
                purchaseId: {
                  in: purchaseIds,
                },
              },

              select: {
                purchaseId: true,
                invoiceNumber: true,
              },
            }
          )
        : [];

    // ===================================================
    // 12. MAP RECEIPT BY PURCHASE ID
    // ===================================================

    const receiptByPurchaseId =
      new Map<
        number,
        string | null
      >();

    for (
      const receipt of purchaseReceipts
    ) {
      const invoiceNumber =
        typeof receipt.invoiceNumber ===
          "string"
          ? receipt.invoiceNumber.trim()
          : "";

      receiptByPurchaseId.set(
        receipt.purchaseId,
        invoiceNumber || null
      );
    }

    // ===================================================
    // 13. MAP PURCHASE
    // ===================================================

    const purchaseData =
      validPurchases.map(
        (purchase) => {
          const totalItem =
            purchase.items.reduce(
              (
                total,
                item
              ) =>
                total +
                Number(
                  item.qty ?? 0
                ),
              0
            );

          const totalReceived =
            purchase.items.reduce(
              (
                total,
                item
              ) =>
                total +
                Number(
                  item.receivedQty ??
                    0
                ),
              0
            );

          let status =
            String(
              purchase.status
            );

          if (
            totalReceived > 0 &&
            totalReceived <
              totalItem
          ) {
            status =
              "PARTIAL";
          }

          if (
            totalItem > 0 &&
            totalReceived >=
              totalItem
          ) {
            status =
              "RECEIVED";
          }

          // =================================================
          // INVOICE SUPPLIER
          // =================================================

          const invoiceNumber =
            receiptByPurchaseId.get(
              purchase.id
            ) ?? null;

          return {
            id:
              `PURCHASE-${purchase.id}`,

            sourceId:
              purchase.id,

            sumber:
              "PURCHASE" as const,

            jenisTransfer:
              null,

            nomor:
              purchase.number,

            // =================================================
            // INVOICE SUPPLIER
            //
            // Ini yang sebelumnya belum dikirim.
            // =================================================

            invoiceNumber,

            tanggal:
              purchase.purchaseDate,

            status,

            totalItem,

            totalReceived,

            // Purchase tidak memiliki void
            hasVoid: false,

            voidItemCount: 0,

            voidTotalQty: 0,

            outletId:
              purchase.outlet?.id ??
              null,

            outlet:
              purchase.outlet
                ? {
                    id:
                      purchase
                        .outlet.id,

                    code:
                      purchase
                        .outlet.code,

                    name:
                      purchase
                        .outlet.name,
                  }
                : null,

            sourceOutletId:
              null,

            sourceOutlet:
              null,

            destinationOutlet:
              purchase.outlet
                ? {
                    id:
                      purchase
                        .outlet.id,

                    code:
                      purchase
                        .outlet.code,

                    name:
                      purchase
                        .outlet.name,
                  }
                : null,

            supplier:
              purchase.supplier
                ? {
                    id:
                      purchase
                        .supplier.id,

                    code:
                      purchase
                        .supplier.code,

                    name:
                      purchase
                        .supplier.name,
                  }
                : null,

            purchase: {
              id:
                purchase.id,

              number:
                purchase.number,

              status:
                purchase.status,

              purchaseDate:
                purchase
                  .purchaseDate,

              remarks:
                purchase.remarks,

              // =================================================
              // INVOICE SUPPLIER
              // =================================================

              invoiceNumber,
            },

            transfer:
              null,

            items:
              purchase.items.map(
                (item) => ({
                  id:
                    item.id,

                  barangId:
                    item.barangId,

                  qty:
                    Number(
                      item.qty ?? 0
                    ),

                  receivedQty:
                    Number(
                      item.receivedQty ??
                        0
                    ),

                  price:
                    Number(
                      item.price ?? 0
                    ),

                  subtotal:
                    Number(
                      item.subtotal ??
                        0
                    ),

                  voided: false,

                  voidedAt: null,

                  voidReason: null,

                  barang:
                    item.barang,
                })
              ),
          };
        }
      );

    // ===================================================
    // 14. TRANSFER DATE FILTER
    // ===================================================

    const transferDateFilter =
      buildDateFilter(
        "transferDate"
      );

    // ===================================================
    // 15. OUTLET TRANSFER
    // ===================================================

    const transfers =
      await prisma.outletTransfer.findMany(
        {
          where: {
            ...outletFilter,
            ...transferDateFilter,
          },

          include: {
            sourceOutlet: {
              select: {
                id: true,
                code: true,
                name: true,
                active: true,
              },
            },

            outlet: {
              select: {
                id: true,
                code: true,
                name: true,
                active: true,
              },
            },

            items: {
              include: {
                barang: true,
              },
            },
          },

          orderBy: {
            transferDate:
              "desc",
          },
        }
      );

    // ===================================================
    // 16. VALIDASI TRANSFER
    //
    // Jangan buang item VOID.
    //
    // Item void tetap harus tampil supaya user tahu
    // bahwa transaksi memiliki barang yang di-void.
    //
    // ===================================================

    const validTransfers =
      transfers.filter(
        (transfer) => {
          if (
            !transfer.outlet ||
            !transfer.outlet.active
          ) {
            return false;
          }

          return transfer.items.every(
            (item) => {
              // Barang void tetap valid untuk ditampilkan.
              if (
                item.voided === true
              ) {
                return true;
              }

              return (
                item.barang &&
                item.barang.source ===
                  "CENTRAL"
              );
            }
          );
        }
      );

    // ===================================================
    // 17. MAP TRANSFER
    // =====================================================

    const transferData =
      validTransfers.map(
        (transfer) => {
          // =================================================
          // TOTAL ITEM
          //
          // Semua qty barang tetap dihitung sebagai
          // total item transaksi.
          // =================================================

          const totalItem =
            transfer.items.reduce(
              (
                total,
                item
              ) =>
                total +
                Number(
                  item.qty ?? 0
                ),
              0
            );

          // =================================================
          // TOTAL RECEIVED
          //
          // receivedQty barang VOID seharusnya 0.
          // Kita tetap menggunakan receivedQty sebagai
          // sumber data penerimaan.
          // =================================================

          const totalReceived =
            transfer.items.reduce(
              (
                total,
                item
              ) =>
                total +
                Number(
                  item.receivedQty ??
                    0
                ),
              0
            );

          // =================================================
          // VOID
          // =================================================

          const voidItems =
            transfer.items.filter(
              (item) =>
                item.voided === true
            );

          const voidItemCount =
            voidItems.length;

          const voidTotalQty =
            voidItems.reduce(
              (
                total,
                item
              ) =>
                total +
                Number(
                  item.qty ?? 0
                ),
              0
            );

          const hasVoid =
            voidItemCount > 0;

          // =================================================
          // STATUS
          // =================================================

          let status =
            String(
              transfer.status
            );

          if (
            totalReceived > 0 &&
            totalReceived <
              totalItem
          ) {
            status =
              "PARTIAL";
          }

          if (
            totalItem > 0 &&
            totalReceived >=
              totalItem
          ) {
            status =
              "RECEIVED";
          }

          // =================================================
          // JENIS TRANSFER
          // =================================================

          const jenisTransfer =
            transfer.sourceOutletId
              ? "OUTLET_TO_OUTLET"
              : "WAREHOUSE_TO_OUTLET";

          return {
            id:
              `TRANSFER-${transfer.id}`,

            sourceId:
              transfer.id,

            sumber:
              "TRANSFER" as const,

            jenisTransfer,

            nomor:
              transfer.number,

            // =================================================
            // TRANSFER TIDAK MEMILIKI INVOICE SUPPLIER
            // =================================================

            invoiceNumber:
              null,

            tanggal:
              transfer.transferDate,

            status,

            totalItem,

            totalReceived,

            // =================================================
            // INFORMASI VOID
            // =================================================

            hasVoid,

            voidItemCount,

            voidTotalQty,

            // =================================================
            // SOURCE
            // =================================================

            sourceOutletId:
              transfer.sourceOutletId ??
              null,

            sourceOutlet:
              transfer.sourceOutlet
                ? {
                    id:
                      transfer
                        .sourceOutlet.id,

                    code:
                      transfer
                        .sourceOutlet.code,

                    name:
                      transfer
                        .sourceOutlet.name,
                  }
                : null,

            // =================================================
            // DESTINATION
            // =================================================

            outletId:
              transfer.outlet?.id ??
              null,

            outlet:
              transfer.outlet
                ? {
                    id:
                      transfer
                        .outlet.id,

                    code:
                      transfer
                        .outlet.code,

                    name:
                      transfer
                        .outlet.name,
                  }
                : null,

            destinationOutlet:
              transfer.outlet
                ? {
                    id:
                      transfer
                        .outlet.id,

                    code:
                      transfer
                        .outlet.code,

                    name:
                      transfer
                        .outlet.name,
                  }
                : null,

            supplier:
              null,

            purchase:
              null,

            transfer: {
              id:
                transfer.id,

              number:
                transfer.number,

              status:
                transfer.status,

              transferDate:
                transfer
                  .transferDate,

              remarks:
                transfer.remarks,

              sourceOutletId:
                transfer
                  .sourceOutletId,

              destinationOutletId:
                transfer.outletId,

              jenisTransfer,
            },

            // =================================================
            // ITEMS
            // =================================================

            items:
              transfer.items.map(
                (item) => {
                  const price =
                    Number(
                      item.barang
                        ?.purchasePrice ??
                        0
                    );

                  const qty =
                    Number(
                      item.qty ?? 0
                    );

                  return {
                    id:
                      item.id,

                    barangId:
                      item.barangId,

                    qty,

                    receivedQty:
                      Number(
                        item.receivedQty ??
                          0
                      ),

                    // ===============================
                    // VOID INFO
                    // ===============================

                    voided:
                      item.voided ===
                      true,

                    voidedAt:
                      item.voidedAt,

                    voidReason:
                      item.voidReason,

                    price,

                    subtotal:
                      qty * price,

                    barang:
                      item.barang,
                  };
                }
              ),
          };
        }
      );

    // ===================================================
    // 18. GABUNG PURCHASE + TRANSFER
    // ===================================================

    const data = [
      ...purchaseData,
      ...transferData,
    ].sort(
      (a, b) =>
        new Date(
          b.tanggal
        ).getTime() -
        new Date(
          a.tanggal
        ).getTime()
    );

    // ===================================================
    // 19. RESPONSE
    // ===================================================

    return NextResponse.json({
      success: true,

      user: {
        id:
          user.id,

        fullname:
          user.fullname,

        role:
          user.role,

        outletId:
          user.outletId,
      },

      filters: {
        outletId:
          selectedOutletId,

        dateFrom:
          dateFrom || null,

        dateTo:
          dateTo || null,
      },

      data,
    });
  } catch (error: any) {
    console.error(
      "GET OUTLET BARANG MASUK ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Gagal mengambil data barang masuk outlet",
      },
      {
        status: 500,
      }
    );
  }
}