import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({
        success: false,
        message: "File tidak ditemukan",
      });
    }

    const bytes = await file.arrayBuffer();

    const buffer = Buffer.from(bytes);

    const fileName =
      Date.now() +
      "-" +
      file.name.replace(/\s/g, "_");

    const uploadPath = path.join(
      process.cwd(),
      "public",
      "uploads",
      "attendance"
    );

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, {
        recursive: true,
      });
    }

    fs.writeFileSync(
      path.join(uploadPath, fileName),
      buffer
    );

    return NextResponse.json({
      success: true,
      photo: "/uploads/attendance/" + fileName,
    });

  } catch (error) {

    console.log(error);

    return NextResponse.json({
      success: false,
      message: "Upload gagal",
    });

  }
}