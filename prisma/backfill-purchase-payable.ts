import {
  PaymentStatus,
  PrismaClient,
} from "@prisma/client";

const prisma = new PrismaClient();

// =====================================================
// MONEY
// =====================================================

function roundMoney(value: number) {
  return (
    Math.round(
      (value + Number.EPSILON) * 100
    ) / 100
  );
}

// =====================================================
// ADD TEMPO DAYS
// =====================================================

function addTempoDays(
  invoiceDate: Date,
  tempoDays: number
) {
  const dueDate =
    new Date(invoiceDate);

  dueDate.setDate(
    dueDate.getDate() + tempoDays
  );

  return dueDate;
}

// =====================================================
// GET PAYMENT TOTAL - PURCHASE PUSAT
// =====================================================

async function getPaidAmountForPurchase(
  purchaseId: number
) {
  const payments =
    await prisma.payment.findMany({
      where: {
        purchaseId,

        status:
          PaymentStatus.PAID,
      },

      select: {
        amount: true,
      },
    });

  return roundMoney(
    payments.reduce(
      (total, payment) =>
        total +
        Number(
          payment.amount ?? 0
        ),
      0
    )
  );
}

// =====================================================
// GET PAYMENT TOTAL - PURCHASE OUTLET
// =====================================================

async function getPaidAmountForOutletPurchase(
  outletPurchaseId: number
) {
  const payments =
    await prisma.payment.findMany({
      where: {
        outletPurchaseId,

        status:
          PaymentStatus.PAID,
      },

      select: {
        amount: true,
      },
    });

  return roundMoney(
    payments.reduce(
      (total, payment) =>
        total +
        Number(
          payment.amount ?? 0
        ),
      0
    )
  );
}

// =====================================================
// CALCULATE PAYABLE STATE
// =====================================================

function calculatePayableState(
  amount: number,
  paidAmount: number
) {
  const normalizedAmount =
    roundMoney(
      Math.max(
        0,
        Number.isFinite(
          amount
        )
          ? amount
          : 0
      )
    );

  const normalizedPaid =
    roundMoney(
      Math.min(
        normalizedAmount,
        Math.max(
          0,
          Number.isFinite(
            paidAmount
          )
            ? paidAmount
            : 0
        )
      )
    );

  const outstanding =
    roundMoney(
      Math.max(
        0,
        normalizedAmount -
          normalizedPaid
      )
    );

  let status =
    "OUTSTANDING";

  if (
    outstanding <= 0
  ) {
    status = "PAID";
  } else if (
    normalizedPaid > 0
  ) {
    status = "PARTIAL";
  }

  return {
    amount:
      normalizedAmount,

    paidAmount:
      normalizedPaid,

    outstanding,

    status,
  };
}

// =====================================================
// SAFE DATE VALIDATION
// =====================================================

function isValidDate(
  date: Date
) {
  return !Number.isNaN(
    date.getTime()
  );
}

// =====================================================
// FORMAT MONEY FOR LOG
// =====================================================

function formatMoney(
  value: number
) {
  return `Rp ${value.toLocaleString(
    "id-ID"
  )}`;
}

// =====================================================
// FORMAT DATE FOR LOG
// =====================================================

function formatDate(
  date: Date
) {
  return date.toLocaleDateString(
    "id-ID"
  );
}

// =====================================================
// MAIN
// =====================================================

async function main() {
  console.log("");
  console.log(
    "========================================"
  );
  console.log(
    "BACKFILL PURCHASE PAYABLE"
  );
  console.log(
    "========================================"
  );
  console.log(
    "Mode: SAFE / NON-DESTRUCTIVE"
  );
  console.log(
    "Rule: HANYA PURCHASE TEMPO"
  );
  console.log("");

  let pusatCreated = 0;
  let pusatUpdated = 0;

  let outletCreated = 0;
  let outletUpdated = 0;

  let skippedNonTempo = 0;
  let skippedInvalid = 0;

  // ===================================================
  // PURCHASE PUSAT
  // ===================================================

  console.log(
    "----------------------------------------"
  );

  console.log(
    "PURCHASE PUSAT"
  );

  console.log(
    "----------------------------------------"
  );

  const purchases =
    await prisma.purchase.findMany({
      where: {
        status: {
          in: [
            "APPROVED",
            "RECEIVED",
          ],
        },
      },

      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            tempoDays: true,
          },
        },

        payable: true,
      },

      orderBy: {
        id: "asc",
      },
    });

  for (
    const purchase of purchases
  ) {
    console.log("");

    // =================================================
    // PAYMENT METHOD
    // =================================================

    const paymentMethod =
      String(
        purchase.paymentMethod
      )
        .trim()
        .toUpperCase();

    // =================================================
    // HANYA TEMPO
    // =================================================

    if (
      paymentMethod !==
      "TEMPO"
    ) {
      skippedNonTempo++;

      console.log(
        `SKIP ${purchase.number} - non-TEMPO`
      );

      continue;
    }

    // =================================================
    // TOTAL
    // =================================================

    const amount =
      roundMoney(
        Number(
          purchase.total
        )
      );

    if (
      !Number.isFinite(
        amount
      ) ||
      amount <= 0
    ) {
      skippedInvalid++;

      console.log(
        `SKIP ${purchase.number} - total tidak valid`
      );

      continue;
    }

    // =================================================
    // INVOICE DATE
    // =================================================

    const invoiceDate =
      new Date(
        purchase.purchaseDate
      );

    if (
      !isValidDate(
        invoiceDate
      )
    ) {
      skippedInvalid++;

      console.log(
        `SKIP ${purchase.number} - purchaseDate tidak valid`
      );

      continue;
    }

    // =================================================
    // SUPPLIER TEMPO
    // =================================================

    const tempoDaysRaw =
      Number(
        purchase.supplier
          ?.tempoDays ?? 0
      );

    const tempoDays =
      Number.isFinite(
        tempoDaysRaw
      )
        ? Math.max(
            0,
            Math.floor(
              tempoDaysRaw
            )
          )
        : 0;

    // =================================================
    // DUE DATE
    // =================================================

    const dueDate =
      addTempoDays(
        invoiceDate,
        tempoDays
      );

    // =================================================
    // ACTUAL PAYMENT
    // =================================================

    const paidAmount =
      await getPaidAmountForPurchase(
        purchase.id
      );

    // =================================================
    // PAYABLE STATE
    // =================================================

    const state =
      calculatePayableState(
        amount,
        paidAmount
      );

    // =================================================
    // PAYABLE BELUM ADA
    // =================================================

    if (
      !purchase.payable
    ) {
      await prisma.purchasePayable.create({
        data: {
          purchaseId:
            purchase.id,

          supplierId:
            purchase.supplierId,

          outletId:
            null,

          invoiceNumber:
            purchase.number,

          invoiceDate,

          dueDate,

          amount:
            state.amount,

          paidAmount:
            state.paidAmount,

          outstanding:
            state.outstanding,

          status:
            state.status,
        },
      });

      pusatCreated++;

      console.log(
        `✓ CREATE PUSAT ${purchase.number}`
      );

      console.log(
        `  Supplier : ${purchase.supplier.name}`
      );

      console.log(
        `  Tempo    : ${tempoDays} hari`
      );

      console.log(
        `  Invoice  : ${formatDate(
          invoiceDate
        )}`
      );

      console.log(
        `  Due Date : ${formatDate(
          dueDate
        )}`
      );

      console.log(
        `  Amount   : ${formatMoney(
          state.amount
        )}`
      );

      console.log(
        `  Paid     : ${formatMoney(
          state.paidAmount
        )}`
      );

      console.log(
        `  Sisa     : ${formatMoney(
          state.outstanding
        )}`
      );

      console.log(
        `  Status   : ${state.status}`
      );

      continue;
    }

    // =================================================
    // PAYABLE SUDAH ADA
    // =================================================

    const existing =
      purchase.payable;

    /*
     * Tidak membuat duplicate.
     *
     * Field yang disinkronkan:
     * - supplier
     * - outlet
     * - invoiceNumber jika kosong
     * - invoiceDate
     * - dueDate
     * - amount
     * - paidAmount
     * - outstanding
     * - status
     *
     * Tidak ada DELETE.
     */

    await prisma.purchasePayable.update({
      where: {
        id:
          existing.id,
      },

      data: {
        supplierId:
          purchase.supplierId,

        outletId:
          null,

        invoiceNumber:
          existing.invoiceNumber ||
          purchase.number,

        invoiceDate,

        dueDate,

        amount:
          state.amount,

        paidAmount:
          state.paidAmount,

        outstanding:
          state.outstanding,

        status:
          state.status,
      },
    });

    pusatUpdated++;

    console.log(
      `✓ UPDATE PUSAT ${purchase.number}`
    );

    console.log(
      `  Supplier : ${purchase.supplier.name}`
    );

    console.log(
      `  Tempo    : ${tempoDays} hari`
    );

    console.log(
      `  Invoice  : ${formatDate(
        invoiceDate
      )}`
    );

    console.log(
      `  Due Date : ${formatDate(
        dueDate
      )}`
    );

    console.log(
      `  Amount   : ${formatMoney(
        state.amount
      )}`
    );

    console.log(
      `  Paid     : ${formatMoney(
        state.paidAmount
      )}`
    );

    console.log(
      `  Sisa     : ${formatMoney(
        state.outstanding
      )}`
    );

    console.log(
      `  Status   : ${state.status}`
    );
  }

  // ===================================================
  // PURCHASE OUTLET
  // ===================================================

  console.log("");

  console.log(
    "----------------------------------------"
  );

  console.log(
    "PURCHASE OUTLET"
  );

  console.log(
    "----------------------------------------"
  );

  const outletPurchases =
    await prisma.outletPurchase.findMany({
      where: {
        status: {
          in: [
            "APPROVED",
            "RECEIVED",
          ],
        },
      },

      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            tempoDays: true,
          },
        },

        outlet: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },

        payable: true,
      },

      orderBy: {
        id: "asc",
      },
    });

  for (
    const purchase of outletPurchases
  ) {
    console.log("");

    // =================================================
    // PAYMENT METHOD
    // =================================================

    const paymentMethod =
      String(
        purchase.paymentMethod
      )
        .trim()
        .toUpperCase();

    // =================================================
    // HANYA TEMPO
    // =================================================

    if (
      paymentMethod !==
      "TEMPO"
    ) {
      skippedNonTempo++;

      console.log(
        `SKIP ${purchase.number} - non-TEMPO`
      );

      continue;
    }

    // =================================================
    // TOTAL
    // =================================================

    const amount =
      roundMoney(
        Number(
          purchase.total
        )
      );

    if (
      !Number.isFinite(
        amount
      ) ||
      amount <= 0
    ) {
      skippedInvalid++;

      console.log(
        `SKIP ${purchase.number} - total tidak valid`
      );

      continue;
    }

    // =================================================
    // INVOICE DATE
    // =================================================

    const invoiceDate =
      new Date(
        purchase.purchaseDate
      );

    if (
      !isValidDate(
        invoiceDate
      )
    ) {
      skippedInvalid++;

      console.log(
        `SKIP ${purchase.number} - purchaseDate tidak valid`
      );

      continue;
    }

    // =================================================
    // SUPPLIER TEMPO
    // =================================================

    const tempoDaysRaw =
      Number(
        purchase.supplier
          ?.tempoDays ?? 0
      );

    const tempoDays =
      Number.isFinite(
        tempoDaysRaw
      )
        ? Math.max(
            0,
            Math.floor(
              tempoDaysRaw
            )
          )
        : 0;

    // =================================================
    // DUE DATE
    // =================================================

    const dueDate =
      addTempoDays(
        invoiceDate,
        tempoDays
      );

    // =================================================
    // ACTUAL PAYMENT
    // =================================================

    const paidAmount =
      await getPaidAmountForOutletPurchase(
        purchase.id
      );

    // =================================================
    // PAYABLE STATE
    // =================================================

    const state =
      calculatePayableState(
        amount,
        paidAmount
      );

    // =================================================
    // PAYABLE BELUM ADA
    // =================================================

    if (
      !purchase.payable
    ) {
      await prisma.purchasePayable.create({
        data: {
          outletPurchaseId:
            purchase.id,

          supplierId:
            purchase.supplierId,

          outletId:
            purchase.outletId,

          invoiceNumber:
            purchase.number,

          invoiceDate,

          dueDate,

          amount:
            state.amount,

          paidAmount:
            state.paidAmount,

          outstanding:
            state.outstanding,

          status:
            state.status,
        },
      });

      outletCreated++;

      console.log(
        `✓ CREATE OUTLET ${purchase.number}`
      );

      console.log(
        `  Outlet   : ${purchase.outlet.name}`
      );

      console.log(
        `  Supplier : ${purchase.supplier.name}`
      );

      console.log(
        `  Tempo    : ${tempoDays} hari`
      );

      console.log(
        `  Invoice  : ${formatDate(
          invoiceDate
        )}`
      );

      console.log(
        `  Due Date : ${formatDate(
          dueDate
        )}`
      );

      console.log(
        `  Amount   : ${formatMoney(
          state.amount
        )}`
      );

      console.log(
        `  Paid     : ${formatMoney(
          state.paidAmount
        )}`
      );

      console.log(
        `  Sisa     : ${formatMoney(
          state.outstanding
        )}`
      );

      console.log(
        `  Status   : ${state.status}`
      );

      continue;
    }

    // =================================================
    // PAYABLE SUDAH ADA
    // =================================================

    const existing =
      purchase.payable;

    await prisma.purchasePayable.update({
      where: {
        id:
          existing.id,
      },

      data: {
        supplierId:
          purchase.supplierId,

        outletId:
          purchase.outletId,

        invoiceNumber:
          existing.invoiceNumber ||
          purchase.number,

        invoiceDate,

        dueDate,

        amount:
          state.amount,

        paidAmount:
          state.paidAmount,

        outstanding:
          state.outstanding,

        status:
          state.status,
      },
    });

    outletUpdated++;

    console.log(
      `✓ UPDATE OUTLET ${purchase.number}`
    );

    console.log(
      `  Outlet   : ${purchase.outlet.name}`
    );

    console.log(
      `  Supplier : ${purchase.supplier.name}`
    );

    console.log(
      `  Tempo    : ${tempoDays} hari`
    );

    console.log(
      `  Invoice  : ${formatDate(
        invoiceDate
      )}`
    );

    console.log(
      `  Due Date : ${formatDate(
        dueDate
      )}`
    );

    console.log(
      `  Amount   : ${formatMoney(
        state.amount
      )}`
    );

    console.log(
      `  Paid     : ${formatMoney(
        state.paidAmount
      )}`
    );

    console.log(
      `  Sisa     : ${formatMoney(
        state.outstanding
      )}`
    );

    console.log(
      `  Status   : ${state.status}`
    );
  }

  // ===================================================
  // SUMMARY
  // ===================================================

  console.log("");

  console.log(
    "========================================"
  );

  console.log(
    "BACKFILL SELESAI"
  );

  console.log(
    "========================================"
  );

  console.log(
    `Pusat dibuat       : ${pusatCreated}`
  );

  console.log(
    `Pusat diperbaiki   : ${pusatUpdated}`
  );

  console.log(
    `Outlet dibuat      : ${outletCreated}`
  );

  console.log(
    `Outlet diperbaiki  : ${outletUpdated}`
  );

  console.log(
    `Non-TEMPO di-skip  : ${skippedNonTempo}`
  );

  console.log(
    `Invalid di-skip    : ${skippedInvalid}`
  );

  console.log(
    "========================================"
  );

  console.log("");

  console.log(
    "RULE TEMPO:"
  );

  console.log(
    "Supplier.tempoDays -> PurchasePayable.dueDate"
  );

  console.log(
    "PurchasePayable.dueDate = snapshot transaksi"
  );

  console.log("");

  console.log(
    "Tidak ada DELETE."
  );

  console.log(
    "Tidak membuat duplicate payable."
  );

  console.log("");
}

// =====================================================
// RUN
// =====================================================

main()
  .catch((error) => {
    console.error("");

    console.error(
      "========================================"
    );

    console.error(
      "BACKFILL ERROR"
    );

    console.error(
      "========================================"
    );

    console.error(error);

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });