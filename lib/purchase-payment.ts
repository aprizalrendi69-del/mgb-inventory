import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from "@prisma/client";

type Tx = Prisma.TransactionClient;

type ProcessPurchasePaymentParams = {
  tx: Tx;

  purchaseId?: number | null;
  outletPurchaseId?: number | null;

  supplierId: number;
  amount: number;

  method: PaymentMethod;

  outletId?: number | null;

  createdBy: number;

  referenceNumber?: string | null;
  note?: string | null;

  purchaseNumber: string;
};

function isPettyCashMethod(method: PaymentMethod) {
  return (
    method === PaymentMethod.CASH ||
    method === PaymentMethod.COD ||
    method === PaymentMethod.CBD
  );
}

function isTransfer(method: PaymentMethod) {
  return method === PaymentMethod.TRANSFER;
}

function isTempo(method: PaymentMethod) {
  return method === PaymentMethod.TEMPO;
}

async function generatePaymentNumber(tx: Tx) {
  const last = await tx.payment.findFirst({
    orderBy: {
      id: "desc",
    },
    select: {
      id: true,
    },
  });

  const next = (last?.id ?? 0) + 1;

  return `PAY-${String(next).padStart(6, "0")}`;
}

async function generatePettyCashNumber(tx: Tx) {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  const prefix = `PC-${year}${month}`;

  const last = await tx.pettyCash.findFirst({
    where: {
      number: {
        startsWith: prefix,
      },
    },
    orderBy: {
      id: "desc",
    },
    select: {
      number: true,
    },
  });

  let next = 1;

  if (last?.number) {
    const match = last.number.match(/(\d+)$/);

    if (match) {
      next = Number(match[1]) + 1;
    }
  }

  return `${prefix}-${String(next).padStart(5, "0")}`;
}

async function getPettyCashAccount(
  tx: Tx,
  outletId: number | null
) {
  if (outletId === null) {
    let account = await tx.pettyCashAccount.findFirst({
      where: {
        outletId: null,
        isActive: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    if (!account) {
      account = await tx.pettyCashAccount.create({
        data: {
          code: "PC-PUSAT",
          name: "Petty Cash Pusat",
          openingBalance: 0,
          currentBalance: 0,
          isActive: true,
          outletId: null,
        },
      });
    }

    return account;
  }

  let account = await tx.pettyCashAccount.findUnique({
    where: {
      outletId,
    },
  });

  if (!account) {
    const outlet = await tx.outlet.findUnique({
      where: {
        id: outletId,
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    if (!outlet) {
      throw new Error("Outlet untuk petty cash tidak ditemukan.");
    }

    account = await tx.pettyCashAccount.create({
      data: {
        code: `PC-${outlet.code}`,
        name: `Petty Cash ${outlet.name}`,
        openingBalance: 0,
        currentBalance: 0,
        isActive: true,
        outletId: outlet.id,
      },
    });
  }

  return account;
}

async function createPettyCashPayment(
  tx: Tx,
  params: {
    accountId: number;
    amount: number;
    paymentId: number;
    outletId: number | null;
    createdBy: number;
    method: PaymentMethod;
    purchaseNumber: string;
  }
) {
  const account = await tx.pettyCashAccount.findUnique({
    where: {
      id: params.accountId,
    },
  });

  if (!account) {
    throw new Error(
      "Akun petty cash tidak ditemukan."
    );
  }

  if (!account.isActive) {
    throw new Error(
      "Akun petty cash tidak aktif."
    );
  }

  const balanceBefore =
    Number(account.currentBalance) || 0;

  const amount =
    Number(params.amount) || 0;

  if (amount <= 0) {
    throw new Error(
      "Nominal pembayaran tidak valid."
    );
  }

  if (balanceBefore < amount) {
    throw new Error(
      `Saldo petty cash tidak cukup. Saldo tersedia Rp ${balanceBefore.toLocaleString(
        "id-ID"
      )}, kebutuhan Rp ${amount.toLocaleString(
        "id-ID"
      )}.`
    );
  }

  const balanceAfter =
    balanceBefore - amount;

  const pettyCashNumber =
    await generatePettyCashNumber(tx);

  await tx.pettyCash.create({
    data: {
      number: pettyCashNumber,

      trxDate: new Date(),

      type: "OUT",

      category: "PEMBELIAN PO",

      description:
        `Pembayaran ${params.method} PO ${params.purchaseNumber}`,

      amount,

      balanceBefore,

      balanceAfter,

      accountId: account.id,

      paymentId: params.paymentId,

      outletId: params.outletId,

      createdBy: params.createdBy,

      /*
       * PETTY CASH TIDAK MEMAKAI APPROVAL.
       * Begitu transaksi dibuat, langsung selesai.
       */
      status: "APPROVED",

      approvedBy: params.createdBy,

      approvedAt: new Date(),
    },
  });

  await tx.pettyCashAccount.update({
    where: {
      id: account.id,
    },
    data: {
      currentBalance: balanceAfter,
    },
  });
}

export async function processPurchasePayment(
  tx: Tx,
  params: ProcessPurchasePaymentParams
) {
  const amount =
    Number(params.amount) || 0;

  if (amount <= 0) {
    throw new Error(
      "Total Purchase harus lebih dari 0."
    );
  }

  /*
   * =========================================================
   * CASH / COD / CBD
   * =========================================================
   *
   * Petty Cash berkurang.
   * Payment langsung PAID.
   * Tidak membuat hutang.
   */
  if (isPettyCashMethod(params.method)) {
    const paymentNumber =
      await generatePaymentNumber(tx);

    const payment =
      await tx.payment.create({
        data: {
          number: paymentNumber,

          purchaseId:
            params.purchaseId ?? null,

          outletPurchaseId:
            params.outletPurchaseId ?? null,

          supplierId:
            params.supplierId,

          paymentDate: new Date(),

          amount,

          method: params.method,

          status: PaymentStatus.PAID,

          referenceNumber:
            params.referenceNumber ?? null,

          note:
            params.note ??
            `Pembayaran ${params.method} PO ${params.purchaseNumber}`,

          createdBy:
            params.createdBy,

          approvedBy:
            params.createdBy,

          approvedAt:
            new Date(),
        },
      });

    const account =
      await getPettyCashAccount(
        tx,
        params.outletId ?? null
      );

    await createPettyCashPayment(
      tx,
      {
        accountId: account.id,

        amount,

        paymentId: payment.id,

        outletId:
          params.outletId ?? null,

        createdBy:
          params.createdBy,

        method:
          params.method,

        purchaseNumber:
          params.purchaseNumber,
      }
    );

    return {
      payment,
      payable: null,
      pettyCashAccountId: account.id,
    };
  }

  /*
   * =========================================================
   * TRANSFER
   * =========================================================
   *
   * Tidak mengurangi petty cash.
   * Tidak membuat hutang.
   * Langsung PAID.
   */
  if (isTransfer(params.method)) {
    const paymentNumber =
      await generatePaymentNumber(tx);

    const payment =
      await tx.payment.create({
        data: {
          number: paymentNumber,

          purchaseId:
            params.purchaseId ?? null,

          outletPurchaseId:
            params.outletPurchaseId ?? null,

          supplierId:
            params.supplierId,

          paymentDate: new Date(),

          amount,

          method:
            PaymentMethod.TRANSFER,

          status:
            PaymentStatus.PAID,

          referenceNumber:
            params.referenceNumber ?? null,

          note:
            params.note ??
            `Pembayaran TRANSFER PO ${params.purchaseNumber}`,

          createdBy:
            params.createdBy,

          approvedBy:
            params.createdBy,

          approvedAt:
            new Date(),
        },
      });

    return {
      payment,
      payable: null,
      pettyCashAccountId: null,
    };
  }

  /*
   * =========================================================
   * TEMPO
   * =========================================================
   *
   * Tidak mengurangi petty cash.
   * Membuat PurchasePayable.
   */
  if (isTempo(params.method)) {
    const supplier =
      await tx.supplier.findUnique({
        where: {
          id: params.supplierId,
        },
        select: {
          id: true,
          tempoDays: true,
        },
      });

    if (!supplier) {
      throw new Error(
        "Supplier tidak ditemukan."
      );
    }

    const invoiceDate =
      new Date();

    const dueDate =
      new Date(invoiceDate);

    dueDate.setDate(
      dueDate.getDate() +
        Number(supplier.tempoDays || 30)
    );

    const payable =
      await tx.purchasePayable.create({
        data: {
          purchaseId:
            params.purchaseId ?? null,

          outletPurchaseId:
            params.outletPurchaseId ?? null,

          supplierId:
            params.supplierId,

          outletId:
            params.outletId ?? null,

          invoiceNumber:
            params.purchaseNumber,

          invoiceDate,

          dueDate,

          amount,

          paidAmount: 0,

          outstanding: amount,

          status:
            "OUTSTANDING",
        },
      });

    return {
      payment: null,
      payable,
      pettyCashAccountId: null,
    };
  }

  throw new Error(
    `Metode pembayaran ${params.method} tidak dikenali.`
  );
}