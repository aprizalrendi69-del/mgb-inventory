import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const data = await prisma.barang.findUnique({
    where: {
      id: Number(id),
    },
  });

  return NextResponse.json({
    success: true,
    data,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const data = await prisma.barang.update({
  where: {
    id: Number(id),
  },
  data: {
    code: body.code,
    barcode: body.barcode,
    name: body.name,
    category: body.category,
    unit: body.unit,
    minimumStock: Number(body.minimumStock) || 0,
    purchasePrice: Number(body.purchasePrice) || 0,
    sellingPrice: Number(body.sellingPrice) || 0,
    hasExpired: Boolean(body.hasExpired),
  },
});

  return NextResponse.json({
    success: true,
    data,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await prisma.barang.delete({
    where: {
      id: Number(id),
    },
  });

  return NextResponse.json({
    success: true,
  });
}