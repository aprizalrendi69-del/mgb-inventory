import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * ============================================================
 * PARSE DATE ONLY
 * ============================================================
 *
 * Input dari <input type="date">:
 *     2026-08-25
 *
 * Disimpan pada UTC siang agar tanggal tidak bergeser
 * ketika dikonversi kembali ke format YYYY-MM-DD.
 */
function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const valueTrimmed = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(valueTrimmed)) {
    return null;
  }

  const [year, month, day] = valueTrimmed
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      12,
      0,
      0,
      0
    )
  );

  // Validasi supaya tanggal seperti 2026-02-31 ditolak.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

/**
 * ============================================================
 * GENERATE DELIVERY NUMBER
 * ============================================================
 *
 * Contoh:
 *
 * DO-00001
 * DO-00002
 * DO-00005
 *
 * Berikutnya:
 *
 * DO-00006
 *
 * Nomor lama tidak disentuh.
 */
async function generateDeliveryNumber(
  tx: Prisma.TransactionClient,
  attempt = 0
): Promise<string> {
  /*
   * IMPORTANT:
   * Jangan hanya memakai findFirst + orderBy("number", "desc").
   *
   * Retry sebelumnya bisa menghasilkan nomor yang sama karena transaksi
   * yang gagal di-rollback lalu generator membaca kandidat yang sama lagi.
   *
   * Kita ambil seluruh nomor DO-* yang berbentuk DO-angka, cari angka
   * terbesar secara numerik, lalu tambahkan 1. Pada retry, tambahkan
   * offset deterministik kecil agar kandidat tidak kembali sama apabila
   * terjadi collision/race dengan transaksi lain.
   */
  const deliveries = await tx.delivery.findMany({
    where: {
      number: {
        startsWith: "DO-",
      },
    },
    select: {
      number: true,
    },
  });

  let maxNumber = 0;

  for (const delivery of deliveries) {
    const match = delivery.number.match(/^DO-(\d+)$/);
    if (!match) continue;

    const value = Number(match[1]);

    if (
      Number.isSafeInteger(value) &&
      value > maxNumber
    ) {
      maxNumber = value;
    }
  }

  /*
   * Attempt 0 = nomor berikutnya normal.
   * Attempt berikutnya diberi offset supaya tidak mengulang kandidat
   * yang baru saja collision.
   */
  const offset = Math.max(0, attempt);
  const nextNumber = maxNumber + 1 + offset;

  return `DO-${String(nextNumber).padStart(5, "0")}`;
}

/**
 * ============================================================
 * CHECK UNIQUE DELIVERY NUMBER ERROR
 * ============================================================
 */
function isDeliveryNumberUniqueError(
  error: unknown
): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError)
  ) {
    return false;
  }

  if (error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.includes("number");
  }

  if (typeof target === "string") {
    return target.includes("number");
  }

  return false;
}

/**
 * ============================================================
 * POST - CREATE BARANG KELUAR DRAFT
 * ============================================================
 *
 * Mendukung 2 jenis Delivery:
 *
 * 1. CUSTOMER DELIVERY
 *
 *    customerId = ADA
 *    outletId   = ADA
 *
 * 2. OUTLET DELIVERY
 *
 *    customerId = NULL
 *    outletId   = ADA
 *
 * PENTING:
 *
 * Endpoint ini hanya membuat DRAFT.
 *
 * TIDAK ADA pengurangan Barang.stock.
 *
 * Stock baru boleh berkurang pada proses RELEASE.
 * ============================================================
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      customerId,
      outletId,
      note,
      items,
      deliveryDate,
    } = body;

    // =====================================================
    // VALIDASI OUTLET & ITEMS
    // =====================================================

    /**
     * Outlet wajib ada.
     *
     * Customer tidak lagi wajib karena Delivery dari
     * Outlet Request memang tidak memiliki customer.
     */
    if (
      !outletId ||
      !items ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Outlet dan barang wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    const outletIdNumber = Number(outletId);

    if (
      !Number.isInteger(outletIdNumber) ||
      outletIdNumber <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Outlet tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // CUSTOMER OPTIONAL
    // =====================================================

    let customerIdNumber: number | null = null;

    /**
     * Kalau customerId diberikan:
     * validasi sebagai Customer Delivery.
     *
     * Kalau tidak diberikan:
     * dianggap sebagai Outlet Delivery.
     */
    if (
      customerId !== null &&
      customerId !== undefined &&
      customerId !== ""
    ) {
      customerIdNumber = Number(customerId);

      if (
        !Number.isInteger(customerIdNumber) ||
        customerIdNumber <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Customer tidak valid",
          },
          {
            status: 400,
          }
        );
      }
    }

    // =====================================================
    // TENTUKAN JENIS DELIVERY
    // =====================================================

    const isOutletDelivery =
      customerIdNumber === null;

    // =====================================================
    // TANGGAL DELIVERY
    // =====================================================

    let parsedDeliveryDate: Date;

    if (
      deliveryDate !== undefined &&
      deliveryDate !== null &&
      deliveryDate !== ""
    ) {
      const parsed =
        parseDateOnly(deliveryDate);

      if (!parsed) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Tanggal barang keluar tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      parsedDeliveryDate = parsed;
    } else {
      const now = new Date();

      parsedDeliveryDate = new Date(
        Date.UTC(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          12,
          0,
          0,
          0
        )
      );
    }

    // =====================================================
    // VALIDASI CUSTOMER
    // =====================================================

    /**
     * Customer hanya divalidasi kalau memang dikirim.
     *
     * Untuk Outlet Delivery:
     *
     * customerId = null
     *
     * sehingga bagian ini dilewati.
     */
    if (customerIdNumber !== null) {
      const customer =
        await prisma.customer.findUnique({
          where: {
            id: customerIdNumber,
          },
        });

      if (!customer) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Customer tidak ditemukan",
          },
          {
            status: 400,
          }
        );
      }
    }

    // =====================================================
    // VALIDASI OUTLET
    // =====================================================

    const outlet =
      await prisma.outlet.findUnique({
        where: {
          id: outletIdNumber,
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
          status: 400,
        }
      );
    }

    // =====================================================
    // VALIDASI ITEMS SEBELUM TRANSACTION
    // =====================================================

    const normalizedItems: Array<{
      barangId: number;
      qty: number;
    }> = [];

    for (const item of items) {
      const barangId = Number(
        item?.barangId
      );

      const qty = Number(
        item?.qty
      );

      if (
        !Number.isInteger(barangId) ||
        barangId <= 0 ||
        !Number.isFinite(qty) ||
        qty <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Data barang keluar tidak valid",
          },
          {
            status: 400,
          }
        );
      }

      normalizedItems.push({
        barangId,
        qty,
      });
    }

    // =====================================================
    // RETRY CREATE DELIVERY
    // =====================================================
    //
    // Menghindari benturan nomor Delivery.
    //

    const MAX_RETRY = 5;

    let result: Awaited<
      ReturnType<typeof createDeliveryDraft>
    > | null = null;

    for (
      let attempt = 1;
      attempt <= MAX_RETRY;
      attempt++
    ) {
      try {
        result =
          await createDeliveryDraft({
            parsedDeliveryDate,
            customerIdNumber,
            outletIdNumber,
            note,
            normalizedItems,
            attempt: attempt - 1,
          });

        break;
      } catch (error) {
        const isUniqueNumberError =
          isDeliveryNumberUniqueError(
            error
          );

        if (
          isUniqueNumberError &&
          attempt < MAX_RETRY
        ) {
          console.warn(
            `Delivery number collision. ` +
              `Generate candidate baru. Retry ${attempt}/${MAX_RETRY}`
          );

          continue;
        }

        throw error;
      }
    }

    if (!result) {
      throw new Error(
        "Gagal membuat nomor delivery setelah beberapa percobaan"
      );
    }

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,

      message: isOutletDelivery
        ? `Barang keluar ${result.number} berhasil disimpan sebagai DRAFT untuk outlet ${outlet.name}`
        : `Barang keluar ${result.number} berhasil disimpan sebagai DRAFT`,

      data: {
        ...result,

        /**
         * Informasi tambahan untuk frontend.
         */
        isOutletDelivery,

        deliveryType: isOutletDelivery
          ? "OUTLET"
          : "CUSTOMER",
      },
    });
  } catch (error: any) {
    console.error(
      "BARANG KELUAR DRAFT ERROR:",
      error
    );

    // =====================================================
    // UNIQUE DELIVERY NUMBER
    // =====================================================

    if (
      isDeliveryNumberUniqueError(error)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Nomor Delivery bentrok karena transaksi bersamaan. Tidak ada data yang dihapus. Silakan simpan kembali.",
        },
        {
          status: 409,
        }
      );
    }

    // =====================================================
    // NORMAL ERROR
    // =====================================================

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal menyimpan barang keluar",
      },
      {
        status: 500,
      }
    );
  }
}

/**
 * ============================================================
 * CREATE DELIVERY DRAFT
 * ============================================================
 */
async function createDeliveryDraft({
  parsedDeliveryDate,
  customerIdNumber,
  outletIdNumber,
  note,
  normalizedItems,
  attempt = 0,
}: {
  parsedDeliveryDate: Date;
  customerIdNumber: number | null;
  outletIdNumber: number;
  note: unknown;
  normalizedItems: Array<{
    barangId: number;
    qty: number;
  }>;
  attempt?: number;
}) {
  return prisma.$transaction(
    async (tx) => {
      // =================================================
      // GENERATE NOMOR DELIVERY
      // =================================================

      const number =
        await generateDeliveryNumber(tx, attempt);

      let totalQty = 0;

      // =================================================
      // CREATE DELIVERY
      // =================================================

      const delivery =
        await tx.delivery.create({
          data: {
            number,

            /**
             * Customer boleh NULL.
             *
             * Untuk Outlet Request:
             *
             * customerId = null
             */
            customerId:
              customerIdNumber,

            /**
             * Outlet tetap wajib.
             */
            outletId:
              outletIdNumber,

            // =================================================
            // TANGGAL TRANSAKSI
            // =================================================

            deliveryDate:
              parsedDeliveryDate,

            // =================================================
            // STATUS
            // =================================================

            status: "DRAFT",

            remarks:
              typeof note === "string"
                ? note.trim() || null
                : null,

            // =================================================
            // TOTAL AWAL
            // =================================================

            totalQty: 0,
          },
        });

      // =================================================
      // PROCESS ITEMS
      // =================================================

      for (const item of normalizedItems) {
        const barangId =
          item.barangId;

        const keluarQty =
          item.qty;

        // ===============================================
        // AMBIL BARANG
        // ===============================================

        const barang =
          await tx.barang.findUnique({
            where: {
              id: barangId,
            },
          });

        if (!barang) {
          throw new Error(
            `Barang dengan ID ${barangId} tidak ditemukan`
          );
        }

        // ===============================================
        // CEK STOCK
        // ===============================================
        //
        // PENTING:
        //
        // Ini hanya pengecekan.
        //
        // TIDAK ADA:
        //
        // barang.stock -= keluarQty
        //
        // Stock tetap utuh selama DRAFT.
        //
        // Stock baru dikurangi pada RELEASE.
        // ===============================================

        const currentStock =
          Number(
            barang.stock ?? 0
          );

        if (
          !Number.isFinite(
            currentStock
          )
        ) {
          throw new Error(
            `Stock barang ${barang.name} tidak valid`
          );
        }

        if (
          currentStock < keluarQty
        ) {
          throw new Error(
            `Stock ${barang.name} tidak cukup. ` +
              `Stock tersedia: ${currentStock}, ` +
              `diminta: ${keluarQty}`
          );
        }

        // ===============================================
        // HARGA
        // ===============================================

        const price =
          Number(
            barang.sellingPrice ?? 0
          );

        if (
          !Number.isFinite(price)
        ) {
          throw new Error(
            `Harga jual ${barang.name} tidak valid`
          );
        }

        // ===============================================
        // SUBTOTAL
        // ===============================================

        const subtotal =
          price * keluarQty;

        // ===============================================
        // CREATE DELIVERY ITEM
        // ===============================================

        await tx.deliveryItem.create({
          data: {
            deliveryId:
              delivery.id,

            barangId:
              barang.id,

            qty:
              keluarQty,

            price,

            subtotal,
          },
        });

        totalQty +=
          keluarQty;
      }

      // =================================================
      // UPDATE TOTAL QTY
      // =================================================

      const updatedDelivery =
        await tx.delivery.update({
          where: {
            id: delivery.id,
          },

          data: {
            totalQty,
          },

          include: {
            customer: true,

            outlet: true,

            items: {
              include: {
                barang: true,
              },

              orderBy: {
                id: "asc",
              },
            },
          },
        });

      return updatedDelivery;
    },
    {
      maxWait: 10000,
      timeout: 30000,
    }
  );
}