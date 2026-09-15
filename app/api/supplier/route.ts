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
    // CREATE
    // -------------------------------------------------

    const supplier =
      await prisma.supplier.create({
        data: {
          code,
          name,

          address:
            body.address ??
            null,

          city:
            body.city ??
            null,

          phone:
            body.phone ??
            null,

          email:
            body.email ??
            null,

          contactPerson:
            body.contactPerson ??
            null,

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
            body.address ??
            null,

          city:
            body.city ??
            null,

          phone:
            body.phone ??
            null,

          email:
            body.email ??
            null,

          contactPerson:
            body.contactPerson ??
            null,

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