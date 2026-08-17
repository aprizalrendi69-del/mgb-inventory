import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export const dynamic = "force-dynamic";

async function getCertificate() {
  const certificatePath = path.join(
    process.cwd(),
    "digital-certificate.txt"
  );

  const certificate =
    await fs.readFile(
      certificatePath,
      "utf8"
    );

  return certificate.trim();
}

async function getPrivateKey() {
  const privateKeyPath = path.join(
    process.cwd(),
    "private-key.pem"
  );

  const privateKey =
    await fs.readFile(
      privateKeyPath,
      "utf8"
    );

  return privateKey.trim();
}

/*
 * =========================================================
 * GET CERTIFICATE
 * =========================================================
 */

export async function GET() {
  try {
    const certificate =
      await getCertificate();

    if (
      !certificate.includes(
        "BEGIN CERTIFICATE"
      )
    ) {
      throw new Error(
        "Certificate QZ tidak valid."
      );
    }

    return NextResponse.json({
      success: true,
      certificate,
    });
  } catch (error) {
    console.error(
      "[QZ API] CERTIFICATE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Gagal membaca certificate QZ.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * =========================================================
 * POST SIGNATURE
 * =========================================================
 */

export async function POST(
  request: NextRequest
) {
  try {
    /*
     * PENTING:
     *
     * QZ mengirim string yang harus
     * ditandatangani sebagai RAW BODY.
     *
     * JANGAN gunakan:
     *
     * await request.json()
     *
     * karena request QZ bukan JSON object.
     */

    const toSign =
      await request.text();

    if (!toSign) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Data signature kosong.",
        },
        {
          status: 400,
        }
      );
    }

    const privateKey =
      await getPrivateKey();

    if (
      !privateKey.includes(
        "BEGIN"
      )
    ) {
      throw new Error(
        "Private key QZ tidak valid."
      );
    }

    const signer =
      crypto.createSign(
        "RSA-SHA512"
      );

    signer.update(
      toSign,
      "utf8"
    );

    signer.end();

    const signature =
      signer.sign(
        privateKey,
        "base64"
      );

    console.log(
      "[QZ API] SIGN SUCCESS"
    );

    return NextResponse.json({
      success: true,
      signature,
    });
  } catch (error) {
    console.error(
      "[QZ API] SIGN ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Gagal membuat signature QZ.",
      },
      {
        status: 500,
      }
    );
  }
}