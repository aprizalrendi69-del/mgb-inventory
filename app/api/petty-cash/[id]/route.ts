import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Role, PettyCashStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    { success: false, message },
    { status },
  );
}

async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("erp-session");
    if (!sessionCookie?.value) return null;

    let sessionData: any;
    try {
      sessionData = JSON.parse(sessionCookie.value);
    } catch {
      return null;
    }

    const sessionUser = sessionData?.user ?? sessionData;
    const userId = Number(sessionUser?.id);

    if (!Number.isInteger(userId) || userId <= 0) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        active: true,
        outletId: true,
      },
    });

    return user?.active ? user : null;
  } catch (error) {
    console.error("GET CURRENT USER DELETE PETTY CASH ERROR:", error);
    return null;
  }
}

function isTopUp(category: string) {
  const normalized = category.trim().toUpperCase().replace(/[_-]+/g, " ");
  return normalized === "TOP UP" || normalized === "TOPUP";
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return jsonError("Tidak login atau session tidak valid.", 401);
    }

    const role = String(user.role).toUpperCase();
    const allowedRoles = [
      Role.ADMIN,
      Role.MANAGER,
      Role.OUTLET_ADMIN,
    ].map(String);

    if (!allowedRoles.includes(role)) {
      return jsonError("Anda tidak memiliki akses menghapus transaksi Petty Cash.", 403);
    }

    const { id: rawId } = await params;
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      return jsonError("ID transaksi Petty Cash tidak valid.", 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.pettyCash.findUnique({
        where: { id },
      });

      if (!transaction) {
        throw new Error("NOT_FOUND");
      }

      // Transaksi dari Payment tidak boleh dihapus dari halaman Petty Cash.
      if (transaction.paymentId !== null) {
        throw new Error("PAYMENT_LINKED");
      }

      const topUp = isTopUp(transaction.category);

      // Manual = transaksi OUT tanpa paymentId; Top Up = transaksi IN kategori TOP UP.
      const isManual = transaction.type === "OUT" && !topUp;
      if (!isManual && !(transaction.type === "IN" && topUp)) {
        throw new Error("NOT_MANUAL_OR_TOPUP");
      }

      // Outlet admin hanya boleh menghapus transaksi milik outletnya sendiri.
      if (role === String(Role.OUTLET_ADMIN)) {
        if (!user.outletId || transaction.outletId !== user.outletId) {
          throw new Error("FORBIDDEN_OUTLET");
        }
      }

      if (!transaction.accountId) {
        throw new Error("ACCOUNT_MISSING");
      }

      const account = await tx.pettyCashAccount.findUnique({
        where: { id: transaction.accountId },
      });

      if (!account) {
        throw new Error("ACCOUNT_NOT_FOUND");
      }

      // Pastikan outlet pada transaksi dan akun tidak silang.
      if (account.outletId !== transaction.outletId) {
        throw new Error("ACCOUNT_SCOPE_MISMATCH");
      }

      const wasApproved = transaction.status === PettyCashStatus.APPROVED;
      let restoredBalance = Number(account.currentBalance);

      if (wasApproved) {
        // Membatalkan OUT mengembalikan uang; membatalkan IN menarik kembali Top Up.
        const delta =
          transaction.type === "OUT"
            ? Number(transaction.amount)
            : -Number(transaction.amount);

        restoredBalance = Math.round((restoredBalance + delta) * 100) / 100;

        if (!Number.isFinite(restoredBalance)) {
          throw new Error("INVALID_BALANCE");
        }

        await tx.pettyCashAccount.update({
          where: { id: account.id },
          data: { currentBalance: restoredBalance },
        });
      }

      // Penghapusan dan koreksi saldo dilakukan dalam satu transaksi DB.
      await tx.pettyCash.delete({
        where: { id: transaction.id },
      });

      return {
        id: transaction.id,
        number: transaction.number,
        amount: transaction.amount,
        type: transaction.type,
        status: transaction.status,
        balance: restoredBalance,
        balanceAdjusted: wasApproved,
      };
    });

    return NextResponse.json({
      success: true,
      message: result.balanceAdjusted
        ? "Transaksi dihapus dan saldo Petty Cash telah dikoreksi."
        : "Transaksi dihapus. Saldo tidak berubah karena transaksi belum APPROVED.",
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message === "NOT_FOUND") {
      return jsonError("Transaksi Petty Cash tidak ditemukan.", 404);
    }
    if (message === "PAYMENT_LINKED") {
      return jsonError("Transaksi yang berasal dari Payment tidak boleh dihapus dari halaman Petty Cash.", 403);
    }
    if (message === "NOT_MANUAL_OR_TOPUP") {
      return jsonError("Hanya transaksi Manual OUT dan Top Up IN yang boleh dihapus.", 403);
    }
    if (message === "FORBIDDEN_OUTLET") {
      return jsonError("Outlet Admin hanya boleh menghapus transaksi dari outlet sendiri.", 403);
    }
    if (message === "ACCOUNT_MISSING" || message === "ACCOUNT_NOT_FOUND") {
      return jsonError("Akun Petty Cash transaksi tidak ditemukan. Saldo tidak diubah.", 409);
    }
    if (message === "ACCOUNT_SCOPE_MISMATCH") {
      return jsonError("Outlet transaksi tidak sesuai dengan akun Petty Cash. Penghapusan dibatalkan.", 409);
    }
    if (message === "INVALID_BALANCE") {
      return jsonError("Perhitungan saldo tidak valid. Penghapusan dibatalkan.", 409);
    }

    console.error("DELETE PETTY CASH ERROR:", error);
    return jsonError("Terjadi kesalahan saat menghapus transaksi Petty Cash.", 500);
  }
}
