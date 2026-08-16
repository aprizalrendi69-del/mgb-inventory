import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get("erp-session");

  if (!session) return null;

  try {
    const sessionData = JSON.parse(session.value);

    return await prisma.user.findUnique({
      where: {
        id: sessionData.id,
      },
      select: {
        id: true,
        role: true,
        outletId: true,
      },
    });
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak login",
        },
        { status: 401 }
      );
    }

    const formData = await req.formData();

    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          message: "File Excel tidak ditemukan",
        },
        { status: 400 }
      );
    }

    let outletId: number;

    // OUTLET ADMIN
    if (user.role === "OUTLET_ADMIN") {
      if (!user.outletId) {
        return NextResponse.json(
          {
            success: false,
            message: "User belum memiliki outlet",
          },
          { status: 400 }
        );
      }

      outletId = user.outletId;
    }

    // ADMIN PUSAT
    else {
      const bodyOutletId =
        formData.get("outletId");

      outletId = Number(bodyOutletId);

      if (
        !Number.isInteger(outletId) ||
        outletId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Outlet wajib dipilih",
          },
          { status: 400 }
        );
      }
    }

    // CEK OUTLET
    const outlet =
      await prisma.outlet.findUnique({
        where: {
          id: outletId,
        },
      });

    if (!outlet) {
      return NextResponse.json(
        {
          success: false,
          message: "Outlet tidak ditemukan",
        },
        { status: 404 }
      );
    }

    const buffer = Buffer.from(
      await file.arrayBuffer()
    );

    const workbook = XLSX.read(buffer, {
      type: "buffer",
    });

    const sheet =
      workbook.Sheets[
        workbook.SheetNames[0]
      ];

    if (!sheet) {
      return NextResponse.json(
        {
          success: false,
          message: "Sheet Excel tidak ditemukan",
        },
        { status: 400 }
      );
    }

    const rows =
      XLSX.utils.sheet_to_json<any>(
        sheet,
        {
          defval: "",
        }
      );

    if (rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Excel kosong",
        },
        { status: 400 }
      );
    }

    let berhasil = 0;
    let dilewati = 0;
    let gagal = 0;

    for (const row of rows) {
      const kode = String(
        row["Kode"] ||
          row["Kode Barang"] ||
          row["kode"] ||
          row["code"] ||
          ""
      ).trim();

      if (!kode) {
        gagal++;
        continue;
      }

      try {
        // CARI BARANG DI CENTRAL
        const barang =
          await prisma.barang.findFirst({
            where: {
              code: kode,
              source: "CENTRAL",
            },
          });

        // JIKA TIDAK ADA DI CENTRAL
        if (!barang) {
          gagal++;
          continue;
        }

        // CEK SUDAH ADA DI OUTLET
        const existing =
          await prisma.outletBarang.findUnique({
            where: {
              outletId_barangId: {
                outletId,
                barangId: barang.id,
              },
            },
          });

        if (existing) {
          dilewati++;
          continue;
        }

        // TAMBAHKAN OUTLET BARANG + STOCK
        await prisma.$transaction(
          async (tx) => {
            await tx.outletBarang.create({
              data: {
                outletId,
                barangId: barang.id,
                harga:
                  Number(
                    row["Harga"] ||
                      row["harga"] ||
                      0
                  ) || 0,
                aktif: true,
              },
            });

            await tx.outletStock.create({
              data: {
                outletId,
                barangId: barang.id,
                stock: 0,
                minimumStock:
                  barang.minimumStock || 0,
                averageCost:
                  barang.purchasePrice || 0,
              },
            });
          }
        );

        berhasil++;
      } catch (error) {
        console.error(
          `GAGAL IMPORT BARANG ${kode}`,
          error
        );

        gagal++;
      }
    }

    return NextResponse.json({
      success: true,

      message:
        `Import selesai. ` +
        `Berhasil: ${berhasil}, ` +
        `dilewati: ${dilewati}, ` +
        `gagal: ${gagal}.`,

      summary: {
        total: rows.length,
        berhasil,
        dilewati,
        gagal,
      },
    });
  } catch (error: any) {
    console.error(
      "IMPORT BARANG OUTLET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal import barang outlet",
      },
      { status: 500 }
    );
  }
}