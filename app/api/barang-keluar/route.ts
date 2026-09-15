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
 * Kita simpan pada UTC siang agar ketika ditampilkan kembali
 * dengan toISOString().slice(0, 10), tanggal tidak bergeser
 * karena perbedaan timezone.
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
 * Jangan menggunakan delivery.count().
 *
 * Contoh data:
 *
 * DO-00001
 * DO-00002
 * DO-00005
 *
 * Maka nomor berikutnya:
 *
 * DO-00006
 *
 * Nomor lama tidak disentuh.
 */
async function generateDeliveryNumber(
  tx: Prisma.TransactionClient
): Promise<string> {
  const latestDelivery = await tx.delivery.findFirst({
    where: {
      number: {
        startsWith: "DO-",
      },
    },
    orderBy: {
      number: "desc",
    },
    select: {
      number: true,
    },
  });

  let nextNumber = 1;

  if (latestDelivery?.number) {
    const match = latestDelivery.number.match(/^DO-(\d+)$/);

    if (match) {
      const currentNumber = Number(match[1]);

      if (Number.isSafeInteger(currentNumber) && currentNumber >= 1) {
        nextNumber = currentNumber + 1;
      }
    }
  }

  return `DO-${String(nextNumber).padStart(5, "0")}`;
}

/**
 * ============================================================
 * CHECK UNIQUE DELIVERY NUMBER ERROR
 * ============================================================
 */
function isDeliveryNumberUniqueError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
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
    // VALIDASI DATA UTAMA
    // =====================================================

    if (
      !customerId ||
      !outletId ||
      !items ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Customer, outlet, dan barang wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    const customerIdNumber = Number(customerId);
    const outletIdNumber = Number(outletId);

    if (
      !Number.isInteger(customerIdNumber) ||
      !Number.isInteger(outletIdNumber)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer atau outlet tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // TANGGAL DELIVERY
    // =====================================================

    let parsedDeliveryDate: Date;

    if (
      deliveryDate !== undefined &&
      deliveryDate !== null &&
      deliveryDate !== ""
    ) {
      const parsed = parseDateOnly(deliveryDate);

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

    const customer = await prisma.customer.findUnique({
      where: {
        id: customerIdNumber,
      },
    });

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer tidak ditemukan",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // VALIDASI OUTLET
    // =====================================================

    const outlet = await prisma.outlet.findUnique({
      where: {
        id: outletIdNumber,
      },
    });

    if (!outlet) {
      return NextResponse.json(
        {
          success: false,
          message: "Outlet tidak ditemukan",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // VALIDASI ITEMS SEBELUM TRANSACTION
    // =====================================================
    //
    // Kita normalisasi data item terlebih dahulu.
    // Ini membuat transaction lebih aman dan lebih mudah
    // dikontrol.
    //

    const normalizedItems: Array<{
      barangId: number;
      qty: number;
    }> = [];

    for (const item of items) {
      const barangId = Number(item?.barangId);
      const qty = Number(item?.qty);

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
    // P2002 pada Delivery.number bisa terjadi kalau dua
    // request membuat nomor yang sama hampir bersamaan.
    //
    // Jika itu terjadi:
    //
    // Request A -> DO-00010 -> berhasil
    // Request B -> DO-00010 -> P2002
    //
    // Request B akan mengulang transaction dan membaca
    // nomor terbaru, kemudian mencoba DO-00011.
    //
    // Data lama tidak diubah dan tidak dihapus.
    //

    const MAX_RETRY = 5;

    let result: Awaited<
      ReturnType<typeof createDeliveryDraft>
    > | null = null;

    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
      try {
        result = await createDeliveryDraft({
          parsedDeliveryDate,
          customerIdNumber,
          outletIdNumber,
          note,
          normalizedItems,
        });

        break;
      } catch (error) {
        const isUniqueNumberError =
          isDeliveryNumberUniqueError(error);

        if (
          isUniqueNumberError &&
          attempt < MAX_RETRY
        ) {
          console.warn(
            `Delivery number collision. ` +
              `Retry ${attempt}/${MAX_RETRY}`
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

      message:
        `Barang keluar ${result.number} berhasil ` +
        `disimpan sebagai DRAFT untuk outlet ${outlet.name}`,

      data: result,
    });
  } catch (error: any) {
    console.error(
      "BARANG KELUAR DRAFT ERROR:",
      error
    );

    // =====================================================
    // UNIQUE DELIVERY NUMBER
    // =====================================================

    if (isDeliveryNumberUniqueError(error)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Nomor Delivery sedang digunakan oleh transaksi lain. Silakan coba lagi.",
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
}: {
  parsedDeliveryDate: Date;
  customerIdNumber: number;
  outletIdNumber: number;
  note: unknown;
  normalizedItems: Array<{
    barangId: number;
    qty: number;
  }>;
}) {
  return prisma.$transaction(
    async (tx) => {
      // =================================================
      // GENERATE NOMOR DELIVERY
      // =================================================

      const number =
        await generateDeliveryNumber(tx);

      let totalQty = 0;

      // =================================================
      // CREATE DELIVERY
      // =================================================

      const delivery = await tx.delivery.create({
        data: {
          number,

          customerId: customerIdNumber,

          outletId: outletIdNumber,

          // =================================================
          // TANGGAL TRANSAKSI
          // =================================================

          deliveryDate: parsedDeliveryDate,

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
        const barangId = item.barangId;
        const keluarQty = item.qty;

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
        // Status masih DRAFT.
        //
        // Jadi stock BELUM dikurangi di endpoint ini.
        //
        // Stock baru boleh berkurang pada proses RELEASE
        // sesuai flow Barang Keluar / Delivery.
        //

        const currentStock = Number(
          barang.stock ?? 0
        );

        if (!Number.isFinite(currentStock)) {
          throw new Error(
            `Stock barang ${barang.name} tidak valid`
          );
        }

        if (currentStock < keluarQty) {
          throw new Error(
            `Stock ${barang.name} tidak cukup. ` +
              `Stock tersedia: ${currentStock}, ` +
              `diminta: ${keluarQty}`
          );
        }

        // ===============================================
        // HARGA
        // ===============================================

        const price = Number(
          barang.sellingPrice ?? 0
        );

        if (!Number.isFinite(price)) {
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
            deliveryId: delivery.id,

            barangId: barang.id,

            qty: keluarQty,

            price,

            subtotal,
          },
        });

        totalQty += keluarQty;
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