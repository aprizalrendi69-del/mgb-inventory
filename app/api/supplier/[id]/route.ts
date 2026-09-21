import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// =====================================================
// PARSE TEMPO
// =====================================================

function parseTempoDays(value: unknown) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 30;
  }

  const tempo = Number(value);

  if (
    !Number.isInteger(tempo) ||
    tempo < 0
  ) {
    throw new Error(
      "Tempo pembayaran harus berupa bilangan bulat 0 atau lebih"
    );
  }

  return tempo;
}

// =====================================================
// PARSE OPTIONAL STRING
// =====================================================

function parseOptionalString(
  value: unknown
): string | null {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const result = String(value).trim();

  return result || null;
}

// =====================================================
// GET SUPPLIER DETAIL
// GET /api/supplier/:id
// =====================================================

export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await params;

    const supplierId = Number(id);

    if (
      !Number.isInteger(supplierId) ||
      supplierId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "ID supplier tidak valid",
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
          message: "Supplier tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,
      data: supplier,
    });
  } catch (error) {
    console.error(
      "GET SUPPLIER DETAIL ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil supplier",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// PATCH SUPPLIER
// PATCH /api/supplier/:id
// =====================================================

export async function PATCH(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await params;

    const supplierId = Number(id);

    if (
      !Number.isInteger(supplierId) ||
      supplierId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "ID supplier tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // CEK SUPPLIER
    // =================================================

    const existing =
      await prisma.supplier.findUnique({
        where: {
          id: supplierId,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message: "Supplier tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    const body = await req.json();

    // =================================================
    // VALIDASI DATA
    // =================================================

    const code = String(
      body.code ?? existing.code
    ).trim();

    const name = String(
      body.name ?? existing.name
    ).trim();

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          message: "Kode supplier wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Nama supplier wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // TEMPO PEMBAYARAN
    // =================================================

    let tempoDays: number;

    try {
      tempoDays = parseTempoDays(
        body.tempoDays ??
          existing.tempoDays
      );
    } catch (error: any) {
      return NextResponse.json(
        {
          success: false,
          message:
            error?.message ||
            "Tempo pembayaran tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // INFORMASI REKENING
    // =================================================
    //
    // Jika field dikirim:
    //   ""     -> null
    //   "123"  -> "123"
    //
    // Jika field tidak dikirim:
    //   gunakan nilai existing.
    // =================================================

    const noRekening =
      body.noRekening !== undefined
        ? parseOptionalString(
            body.noRekening
          )
        : existing.noRekening;

    const namaRekening =
      body.namaRekening !== undefined
        ? parseOptionalString(
            body.namaRekening
          )
        : existing.namaRekening;

    const jenisRekening =
      body.jenisRekening !== undefined
        ? parseOptionalString(
            body.jenisRekening
          )
        : existing.jenisRekening;

    // =================================================
    // UPDATE
    // =================================================

    const supplier =
      await prisma.supplier.update({
        where: {
          id: supplierId,
        },

        data: {
          // ===========================================
          // IDENTITAS SUPPLIER
          // ===========================================

          code,
          name,

          // ===========================================
          // INFORMASI KONTAK
          // ===========================================

          address:
            body.address !== undefined
              ? parseOptionalString(
                  body.address
                )
              : existing.address,

          city:
            body.city !== undefined
              ? parseOptionalString(
                  body.city
                )
              : existing.city,

          phone:
            body.phone !== undefined
              ? parseOptionalString(
                  body.phone
                )
              : existing.phone,

          email:
            body.email !== undefined
              ? parseOptionalString(
                  body.email
                )
              : existing.email,

          contactPerson:
            body.contactPerson !== undefined
              ? parseOptionalString(
                  body.contactPerson
                )
              : existing.contactPerson,

          // ===========================================
          // INFORMASI REKENING SUPPLIER
          // ===========================================

          noRekening,
          namaRekening,
          jenisRekening,

          // ===========================================
          // TEMPO PEMBAYARAN
          // ===========================================

          tempoDays,
        },
      });

    return NextResponse.json({
      success: true,
      message: "Supplier berhasil diperbarui",
      data: supplier,
    });
  } catch (error: any) {
    console.error(
      "PATCH SUPPLIER ERROR:",
      error
    );

    // =================================================
    // PRISMA DUPLICATE UNIQUE CODE
    // =================================================

    if (error?.code === "P2002") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Kode supplier sudah digunakan",
        },
        {
          status: 409,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "Supplier gagal diperbarui",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// DELETE SUPPLIER
// DELETE /api/supplier/:id
// =====================================================

export async function DELETE(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    // =================================================
    // PARAMETER
    // =================================================

    const { id } = await params;

    const supplierId = Number(id);

    if (
      !Number.isInteger(supplierId) ||
      supplierId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "ID supplier tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // CEK SUPPLIER
    // =================================================

    const supplier =
      await prisma.supplier.findUnique({
        where: {
          id: supplierId,
        },

        select: {
          id: true,
          code: true,
          name: true,
        },
      });

    if (!supplier) {
      return NextResponse.json(
        {
          success: false,
          message: "Supplier tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // CEK RELASI TRANSAKSI
    // =================================================

    const [
      purchaseCount,
      outletPurchaseCount,
      payableCount,
      receiptCount,
      paymentCount,
      masterHargaCount,
      priceSummaryCount,
    ] = await Promise.all([
      prisma.purchase.count({
        where: {
          supplierId,
        },
      }),

      prisma.outletPurchase.count({
        where: {
          supplierId,
        },
      }),

      prisma.purchasePayable.count({
        where: {
          supplierId,
        },
      }),

      prisma.receipt.count({
        where: {
          supplierId,
        },
      }),

      prisma.payment.count({
        where: {
          supplierId,
        },
      }),

      prisma.masterHarga.count({
        where: {
          supplierId,
        },
      }),

      prisma.priceSummary.count({
        where: {
          supplierId,
        },
      }),
    ]);

    // =================================================
    // CEK APAKAH SUDAH MEMILIKI HISTORY
    // =================================================

    const hasHistory =
      purchaseCount > 0 ||
      outletPurchaseCount > 0 ||
      payableCount > 0 ||
      receiptCount > 0 ||
      paymentCount > 0 ||
      masterHargaCount > 0 ||
      priceSummaryCount > 0;

    if (hasHistory) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Supplier "${supplier.name}" tidak dapat dihapus karena sudah digunakan dalam transaksi atau master harga.`,
        },
        {
          status: 409,
        }
      );
    }

    // =================================================
    // DELETE
    // =================================================

    await prisma.supplier.delete({
      where: {
        id: supplierId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Supplier berhasil dihapus",
    });
  } catch (error: any) {
    console.error(
      "DELETE SUPPLIER ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Supplier gagal dihapus",
      },
      {
        status: 500,
      }
    );
  }
}