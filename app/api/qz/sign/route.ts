import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const data = body?.data;

    if (!data || typeof data !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Data signature tidak ditemukan",
        },
        { status: 400 }
      );
    }

    const privateKeyPath = path.resolve(
      process.cwd(),
      process.env.QZ_PRIVATE_KEY_PATH || "./private-key.pem"
    );

    if (!fs.existsSync(privateKeyPath)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "QZ private key tidak ditemukan: " +
            privateKeyPath,
        },
        { status: 404 }
      );
    }

    const privateKey = fs.readFileSync(
      privateKeyPath,
      "utf8"
    );

    const signer = crypto.createSign("RSA-SHA512");

    signer.update(data);
    signer.end();

    const signature = signer.sign(
      privateKey,
      "base64"
    );

    return NextResponse.json({
      success: true,
      signature,
    });
  } catch (error) {
    console.error("QZ SIGN ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal membuat signature QZ",
      },
      { status: 500 }
    );
  }
}