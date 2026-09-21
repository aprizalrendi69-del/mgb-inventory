import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// =====================================================
// PARSE TEMPO
// =====================================================

function parseTempoDays(value: unknown) {
  // Jika tidak dikirim, gunakan default 30 hari
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
// GET SUPPLIER
// =====================================================

export async function GET() {
  try {
    const data =
      await prisma.supplier.findMany({
        orderBy: {
          name: "asc",
        },
      });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "GET SUPPLIER ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil supplier",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// POST SUPPLIER
// =====================================================

export async function POST(
  req: Request
) {
  try {
    const body = await req.json();

    // -------------------------------------------------
    // BASIC VALIDATION
    // -------------------------------------------------

    const code =
      String(body.code ?? "").trim();

    const name =
      String(body.name ?? "").trim();

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Kode supplier wajib diisi",
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
          message:
            "Nama supplier wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    // -------------------------------------------------
    // TEMPO
    // -------------------------------------------------

    let tempoDays: number;

    try {
      tempoDays =
        parseTempoDays(
          body.tempoDays
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

    // -------------------------------------------------
    // BANK / REKENING
    // -------------------------------------------------

    const noRekening =
      parseOptionalString(
        body.noRekening
      );

    const namaRekening =
      parseOptionalString(
        body.namaRekening
      );

    const jenisRekening =
      parseOptionalString(
        body.jenisRekening
      );

    // -------------------------------------------------
    // CREATE
    // -------------------------------------------------

    const supplier =
      await prisma.supplier.create({
        data: {
          code,
          name,

          address:
            parseOptionalString(
              body.address
            ),

          city:
            parseOptionalString(
              body.city
            ),

          phone:
            parseOptionalString(
              body.phone
            ),

          email:
            parseOptionalString(
              body.email
            ),

          contactPerson:
            parseOptionalString(
              body.contactPerson
            ),

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
      data: supplier,
    });
  } catch (error: any) {
    console.error(
      "POST SUPPLIER ERROR:",
      error
    );

    // -------------------------------------------------
    // DUPLICATE CODE
    // -------------------------------------------------

    if (
      error?.code === "P2002"
    ) {
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
          "Gagal menambah supplier",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// PATCH SUPPLIER
// =====================================================

export async function PATCH(
  req: Request
) {
  try {
    const body = await req.json();

    // -------------------------------------------------
    // ID
    // -------------------------------------------------

    const id =
      Number(body.id);

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID supplier tidak valid",
        },
        {
          status: 400,
        }
      );
    }

    // -------------------------------------------------
    // CHECK SUPPLIER
    // -------------------------------------------------

    const existing =
      await prisma.supplier.findUnique({
        where: {
          id,
        },
      });

    if (!existing) {
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

    // -------------------------------------------------
    // BASIC VALIDATION
    // -------------------------------------------------

    const code =
      String(
        body.code ??
          existing.code
      ).trim();

    const name =
      String(
        body.name ??
          existing.name
      ).trim();

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Kode supplier wajib diisi",
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
          message:
            "Nama supplier wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    // -------------------------------------------------
    // TEMPO
    // -------------------------------------------------

    let tempoDays: number;

    try {
      tempoDays =
        parseTempoDays(
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

    // -------------------------------------------------
    // BANK / REKENING
    // -------------------------------------------------
    //
    // Jika field dikirim:
    //   "" -> null
    //   "123" -> "123"
    //
    // Jika field tidak dikirim:
    //   pertahankan nilai existing.
    // -------------------------------------------------

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

    // -------------------------------------------------
    // UPDATE
    // -------------------------------------------------

    const supplier =
      await prisma.supplier.update({
        where: {
          id,
        },

        data: {
          code,
          name,

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
          // UPDATE TEMPO
          // ===========================================

          tempoDays,
        },
      });

    return NextResponse.json({
      success: true,
      data: supplier,
    });
  } catch (error: any) {
    console.error(
      "PATCH SUPPLIER ERROR:",
      error
    );

    // -------------------------------------------------
    // DUPLICATE CODE
    // -------------------------------------------------

    if (
      error?.code === "P2002"
    ) {
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
          "Gagal mengubah supplier",
      },
      {
        status: 500,
      }
    );
  }
}