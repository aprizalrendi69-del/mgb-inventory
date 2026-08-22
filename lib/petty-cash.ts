import {
  PaymentMethod,
  PettyCashType,
  Prisma,
} from "@prisma/client";

type Tx = Prisma.TransactionClient;

type PettyCashPaymentParams = {
  tx: Tx;
  accountId: number;
  amount: number;
  category: string;
  description: string;
  paymentId?: number | null;
  outletId?: number | null;
  createdBy?: number | null;
};

export async function createPettyCashOut({
  tx,
  accountId,
  amount,
  category,
  description,
  paymentId = null,
  outletId = null,
  createdBy = null,
}: PettyCashPaymentParams) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Nominal petty cash tidak valid.");
  }

  const account = await tx.pettyCashAccount.findUnique({
    where: {
      id: accountId,
    },
  });

  if (!account) {
    throw new Error("Akun petty cash tidak ditemukan.");
  }

  if (!account.isActive) {
    throw new Error("Akun petty cash tidak aktif.");
  }

  const balanceBefore = Number(account.currentBalance || 0);

  if (balanceBefore < amount) {
    throw new Error(
      `Saldo petty cash tidak cukup. Saldo saat ini Rp ${balanceBefore.toLocaleString(
        "id-ID"
      )}.`
    );
  }

  const balanceAfter = balanceBefore - amount;

  const number = await generatePettyCashNumber(tx);

  const transaction = await tx.pettyCash.create({
    data: {
      number,
      trxDate: new Date(),

      type: PettyCashType.OUT,

      category,
      description,

      amount,

      balanceBefore,
      balanceAfter,

      accountId,

      paymentId,

      outletId,

      createdBy,

      // LANGSUNG SELESAI.
      // TIDAK ADA APPROVAL.
      status: "APPROVED",

      approvedBy: createdBy,
      approvedAt: new Date(),
    },
  });

  await tx.pettyCashAccount.update({
    where: {
      id: accountId,
    },
    data: {
      currentBalance: balanceAfter,
    },
  });

  return transaction;
}

export async function createPettyCashIn({
  tx,
  accountId,
  amount,
  category,
  description,
  outletId = null,
  createdBy = null,
}: {
  tx: Tx;
  accountId: number;
  amount: number;
  category: string;
  description: string;
  outletId?: number | null;
  createdBy?: number | null;
}) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Nominal petty cash tidak valid.");
  }

  const account = await tx.pettyCashAccount.findUnique({
    where: {
      id: accountId,
    },
  });

  if (!account) {
    throw new Error("Akun petty cash tidak ditemukan.");
  }

  const balanceBefore = Number(account.currentBalance || 0);
  const balanceAfter = balanceBefore + amount;

  const number = await generatePettyCashNumber(tx);

  const transaction = await tx.pettyCash.create({
    data: {
      number,
      trxDate: new Date(),

      type: PettyCashType.IN,

      category,
      description,

      amount,

      balanceBefore,
      balanceAfter,

      accountId,

      outletId,

      createdBy,

      status: "APPROVED",

      approvedBy: createdBy,
      approvedAt: new Date(),
    },
  });

  await tx.pettyCashAccount.update({
    where: {
      id: accountId,
    },
    data: {
      currentBalance: balanceAfter,
    },
  });

  return transaction;
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

export function isPettyCashPayment(
  method: PaymentMethod
) {
  return (
    method === PaymentMethod.CASH ||
    method === PaymentMethod.COD ||
    method === PaymentMethod.CBD
  );
}

export function isTransferPayment(
  method: PaymentMethod
) {
  return method === PaymentMethod.TRANSFER;
}

export function isTempoPayment(
  method: PaymentMethod
) {
  return method === PaymentMethod.TEMPO;
}