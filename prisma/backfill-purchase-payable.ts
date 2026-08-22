import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("========================================");
  console.log("BACKFILL PURCHASE PAYABLE LAMA");
  console.log("========================================");

  let pusatCreated = 0;
  let outletCreated = 0;

  /*
   * ======================================================
   * PURCHASE PUSAT
   * ======================================================
   */

  const purchases = await prisma.purchase.findMany({
    where: {
      status: {
        in: ["APPROVED", "RECEIVED"],
      },
      payable: null,
    },
    include: {
      supplier: true,
    },
  });

  for (const purchase of purchases) {
    const amount = Number(purchase.total);

    if (!Number.isFinite(amount) || amount <= 0) {
      console.log(
        `SKIP ${purchase.number} - total tidak valid`
      );
      continue;
    }

    await prisma.purchasePayable.create({
      data: {
        purchaseId: purchase.id,

        supplierId: purchase.supplierId,

        outletId: null,

        invoiceNumber:
          `PAID-${purchase.number}`,

        invoiceDate:
          purchase.purchaseDate,

        dueDate:
          purchase.purchaseDate,

        amount,

        paidAmount: amount,

        outstanding: 0,

        status: "PAID",
      },
    });

    pusatCreated++;

    console.log(
      `✓ PUSAT ${purchase.number} -> PAID`
    );
  }

  /*
   * ======================================================
   * PURCHASE OUTLET
   * ======================================================
   */

  const outletPurchases =
    await prisma.outletPurchase.findMany({
      where: {
        status: {
          in: ["APPROVED", "RECEIVED"],
        },
        payable: null,
      },
      include: {
        supplier: true,
        outlet: true,
      },
    });

  for (const purchase of outletPurchases) {
    const amount = Number(purchase.total);

    if (!Number.isFinite(amount) || amount <= 0) {
      console.log(
        `SKIP ${purchase.number} - total tidak valid`
      );
      continue;
    }

    await prisma.purchasePayable.create({
      data: {
        outletPurchaseId:
          purchase.id,

        supplierId:
          purchase.supplierId,

        outletId:
          purchase.outletId,

        invoiceNumber:
          `PAID-${purchase.number}`,

        invoiceDate:
          purchase.purchaseDate,

        dueDate:
          purchase.purchaseDate,

        amount,

        paidAmount: amount,

        outstanding: 0,

        status: "PAID",
      },
    });

    outletCreated++;

    console.log(
      `✓ OUTLET ${purchase.number} -> PAID`
    );
  }

  console.log("");
  console.log("========================================");
  console.log("SELESAI");
  console.log(`Pusat : ${pusatCreated}`);
  console.log(`Outlet: ${outletCreated}`);
  console.log("========================================");
}

main()
  .catch((error) => {
    console.error(
      "BACKFILL ERROR:",
      error
    );

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });