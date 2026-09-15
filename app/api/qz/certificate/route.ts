import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const certificatePath = path.resolve(
      process.cwd(),
      process.env.QZ_CERTIFICATE_PATH || "./digital-certificate.txt"
    );

    if (!fs.existsSync(certificatePath)) {
      return new NextResponse(
        "QZ certificate tidak ditemukan: " + certificatePath,
        {
          status: 404,
          headers: {
            "Content-Type": "text/plain",
          },
        }
      );
    }

    const certificate = fs.readFileSync(
      certificatePath,
      "utf8"
    );

    return new NextResponse(certificate, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("QZ CERTIFICATE ERROR:", error);

    return new NextResponse(
      "Gagal membaca QZ certificate",
      {
        status: 500,
        headers: {
          "Content-Type": "text/plain",
        },
      }
    );
  }
}