import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// =====================================================
// ROLE
// =====================================================

type Role =
  | "ADMIN"
  | "MANAGER"
  | "PURCHASING"
  | "GUDANG"
  | "OUTLET_ADMIN"
  | "KASIR";

// =====================================================
// CURRENT USER
// =====================================================

async function getCurrentUser() {
  const cookieStore = await cookies();

  const session = cookieStore.get("erp-session");

  if (!session?.value) {
    return null;
  }

  let sessionData: any;

  try {
    sessionData = JSON.parse(session.value);
  } catch {
    return null;
  }

  const userId = Number(
    sessionData?.user?.id ??
      sessionData?.data?.user?.id ??
      sessionData?.data?.id ??
      sessionData?.id
  );

  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      role: true,
      active: true,
      outletId: true,
    },
  });

  if (!user || user.active === false) {
    return null;
  }

  return user;
}

// =====================================================
// SAFE COUNT
// =====================================================

async function safeCount(
  callback: () => Promise<number>
): Promise<number> {
  try {
    const result = await callback();

    if (!Number.isFinite(result) || result <= 0) {
      return 0;
    }

    return Math.floor(result);
  } catch (error) {
    console.error("SIDEBAR COUNT QUERY ERROR:", error);
    return 0;
  }
}

// =====================================================
// GET
// =====================================================

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    const role = String(user.role) as Role;

    // =================================================
    // DEFAULT COUNTS
    // =================================================

    let approvalPurchase = 0;
    let barangMasuk = 0;
    let deliveryOrder = 0;
    let suratJalan = 0;
    let approvalWastePusat = 0;
    let barangMasukOutlet = 0;
    let approvalWasteOutlet = 0;
    let approvalStockOpname = 0;

    // =================================================
    // APPROVAL PURCHASE
    //
    // Purchase DRAFT = menunggu approval
    //
    // Menu:
    // /purchase/approve
    //
    // Roles:
    // ADMIN
    // MANAGER
    // PURCHASING
    // =================================================

    if (
      role === "ADMIN" ||
      role === "MANAGER" ||
      role === "PURCHASING"
    ) {
      approvalPurchase = await safeCount(() =>
        prisma.purchase.count({
          where: {
            status: "DRAFT",
          },
        })
      );
    }

    // =================================================
    // BARANG MASUK PUSAT
    //
    // Purchase APPROVED = siap diterima
    //
    // Menu:
    // /barang-masuk
    //
    // Roles:
    // ADMIN
    // GUDANG
    // =================================================

    if (role === "ADMIN" || role === "GUDANG") {
      barangMasuk = await safeCount(() =>
        prisma.purchase.count({
          where: {
            status: "APPROVED",
          },
        })
      );
    }

    // =================================================
    // DELIVERY ORDER
    //
    // Delivery DRAFT = menunggu RELEASE
    //
    // Menu:
    // /pengiriman
    //
    // Role:
    // ADMIN
    // =================================================

    if (role === "ADMIN") {
      deliveryOrder = await safeCount(() =>
        prisma.delivery.count({
          where: {
            status: "DRAFT",
          },
        })
      );
    }

    // =================================================
    // SURAT JALAN
    //
    // Delivery RELEASED = siap dibuat / diproses
    // menjadi Surat Jalan.
    //
    // Hanya Delivery yang belum memiliki SuratJalan
    // yang dihitung.
    //
    // Menu:
    // /surat-jalan
    //
    // Roles:
    // ADMIN
    // GUDANG
    // =================================================

    if (role === "ADMIN" || role === "GUDANG") {
      suratJalan = await safeCount(() =>
        prisma.delivery.count({
          where: {
            status: "RELEASED",
            suratJalan: {
              is: null,
            },
          },
        })
      );
    }

    // =================================================
    // APPROVAL WASTE PUSAT
    //
    // StockWaste PENDING = menunggu approval
    //
    // Menu:
    // /waste/approval
    //
    // Roles:
    // ADMIN
    // MANAGER
    // =================================================

    if (role === "ADMIN" || role === "MANAGER") {
      approvalWastePusat = await safeCount(() =>
        prisma.stockWaste.count({
          where: {
            status: "PENDING",
          },
        })
      );
    }

    // =================================================
    // BARANG MASUK OUTLET
    //
    // OutletPurchase APPROVED = siap diterima outlet
    //
    // Menu:
    // /outlet/barang-masuk
    //
    // ADMIN:
    // seluruh outlet
    //
    // OUTLET_ADMIN:
    // hanya outlet miliknya
    // =================================================

    if (role === "ADMIN") {
      barangMasukOutlet = await safeCount(() =>
        prisma.outletPurchase.count({
          where: {
            status: "APPROVED",
          },
        })
      );
    }

    if (role === "OUTLET_ADMIN" && user.outletId) {
      barangMasukOutlet = await safeCount(() =>
        prisma.outletPurchase.count({
          where: {
            outletId: user.outletId!,
            status: "APPROVED",
          },
        })
      );
    }

    // =================================================
    // APPROVAL WASTE OUTLET
    //
    // OutletStockOut PENDING = menunggu approval
    //
    // Menu:
    // /outlet/waste/approval
    //
    // ADMIN:
    // seluruh outlet
    //
    // MANAGER:
    // seluruh outlet
    //
    // OUTLET_ADMIN:
    // tidak memiliki akses menu berdasarkan Sidebar
    // sehingga tidak dihitung.
    // =================================================

    if (role === "ADMIN" || role === "MANAGER") {
      approvalWasteOutlet = await safeCount(() =>
        prisma.outletStockOut.count({
          where: {
            status: "PENDING",
          },
        })
      );
    }

    // =================================================
    // APPROVAL STOCK OPNAME
    //
    // StockOpname.status adalah String.
    //
    // COUNTING = proses opname selesai dibuat dan
    // menunggu approval/finalisasi.
    //
    // Menu:
    // /outlet/stock-opname/approval
    //
    // ADMIN:
    // seluruh outlet
    //
    // OUTLET_ADMIN:
    // hanya outlet miliknya
    // =================================================

    if (role === "ADMIN") {
      approvalStockOpname = await safeCount(() =>
        prisma.stockOpname.count({
          where: {
            status: "COUNTING",
          },
        })
      );
    }

    if (role === "OUTLET_ADMIN" && user.outletId) {
      approvalStockOpname = await safeCount(() =>
        prisma.stockOpname.count({
          where: {
            outletId: user.outletId!,
            status: "COUNTING",
          },
        })
      );
    }

    // =================================================
    // RESPONSE
    // =================================================

    return NextResponse.json(
      {
        success: true,
        counts: {
          approvalPurchase,
          barangMasuk,
          deliveryOrder,
          suratJalan,
          approvalWastePusat,
          barangMasukOutlet,
          approvalWasteOutlet,
          approvalStockOpname,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error(
      "SIDEBAR PENDING COUNTS ERROR:",
      error
    );

    // =================================================
    // FAIL-SAFE
    //
    // Sidebar tetap bisa render walaupun salah satu
    // query bermasalah.
    // =================================================

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil jumlah pending sidebar.",
        counts: {
          approvalPurchase: 0,
          barangMasuk: 0,
          deliveryOrder: 0,
          suratJalan: 0,
          approvalWastePusat: 0,
          barangMasukOutlet: 0,
          approvalWasteOutlet: 0,
          approvalStockOpname: 0,
        },
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  }
}