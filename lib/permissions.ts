import { Role } from "@prisma/client";

export type Permission =
  // Dashboard
  | "dashboard.view"

  // User
  | "user.view"
  | "user.create"
  | "user.edit"
  | "user.delete"

  // Barang
  | "barang.view"
  | "barang.create"
  | "barang.edit"
  | "barang.delete"
  | "barang.import"
  | "barang.print"

  // Supplier
  | "supplier.view"
  | "supplier.create"
  | "supplier.edit"
  | "supplier.delete"
  | "supplier.import"

  // Customer
  | "customer.view"
  | "customer.create"
  | "customer.edit"
  | "customer.delete"
  | "customer.import"

  // Purchase / PO
  | "purchase.view"
  | "purchase.create"
  | "purchase.edit"
  | "purchase.delete"
  | "purchase.approve"
  | "purchase.print"

  // Receive
  | "receipt.view"
  | "receipt.create"
  | "receipt.edit"
  | "receipt.delete"
  | "receipt.print"

  // Gudang
  | "barang-masuk.view"
  | "barang-masuk.create"
  | "barang-masuk.edit"
  | "barang-masuk.delete"

  | "barang-keluar.view"
  | "barang-keluar.create"
  | "barang-keluar.edit"
  | "barang-keluar.delete"

  // Delivery
  | "delivery.view"
  | "delivery.create"
  | "delivery.edit"
  | "delivery.delete"
  | "delivery.release"
  | "delivery.print"

  // Stock
  | "stock.view"
  | "stock.card"
  | "stock.mutation"

  // Stock Opname
  | "stock-opname.view"
  | "stock-opname.create"
  | "stock-opname.edit"
  | "stock-opname.approve"

  // Adjustment
  | "adjustment.view"
  | "adjustment.create"
  | "adjustment.edit"
  | "adjustment.approve"

  // Master Harga
  | "master-harga.view"
  | "master-harga.edit"

  // Laporan
  | "report.view"
  | "report.purchase"
  | "report.receipt"
  | "report.delivery"
  | "report.inventory"
  | "report.supplier"
  | "report.customer"
  | "report.export"

  // Attendance
  | "attendance.view"
  | "attendance.create"
  | "attendance.edit"
  | "attendance.history"

  // Company
  | "company.view"
  | "company.edit";

const permissions: Record<Role, Permission[]> = {

  ADMIN: [
    "dashboard.view",

    // User
    "user.view",
    "user.create",
    "user.edit",
    "user.delete",

    // Barang
    "barang.view",
    "barang.create",
    "barang.edit",
    "barang.delete",
    "barang.import",
    "barang.print",

    // Supplier
    "supplier.view",
    "supplier.create",
    "supplier.edit",
    "supplier.delete",
    "supplier.import",

    // Customer
    "customer.view",
    "customer.create",
    "customer.edit",
    "customer.delete",
    "customer.import",

    // Purchase
    "purchase.view",
    "purchase.create",
    "purchase.edit",
    "purchase.delete",
    "purchase.approve",
    "purchase.print",

    // Receipt
    "receipt.view",
    "receipt.create",
    "receipt.edit",
    "receipt.delete",
    "receipt.print",

    // Gudang
    "barang-masuk.view",
    "barang-masuk.create",
    "barang-masuk.edit",
    "barang-masuk.delete",

    "barang-keluar.view",
    "barang-keluar.create",
    "barang-keluar.edit",
    "barang-keluar.delete",

    // Delivery
    "delivery.view",
    "delivery.create",
    "delivery.edit",
    "delivery.delete",
    "delivery.release",
    "delivery.print",

    // Stock
    "stock.view",
    "stock.card",
    "stock.mutation",

    // Stock Opname
    "stock-opname.view",
    "stock-opname.create",
    "stock-opname.edit",
    "stock-opname.approve",

    // Adjustment
    "adjustment.view",
    "adjustment.create",
    "adjustment.edit",
    "adjustment.approve",

    // Master Harga
    "master-harga.view",
    "master-harga.edit",

    // Reports
    "report.view",
    "report.purchase",
    "report.receipt",
    "report.delivery",
    "report.inventory",
    "report.supplier",
    "report.customer",
    "report.export",

    // Attendance
    "attendance.view",
    "attendance.create",
    "attendance.edit",
    "attendance.history",

    // Company
    "company.view",
    "company.edit",
  ],

  MANAGER: [
    "dashboard.view",

    // Master
    "barang.view",
    "barang.print",

    "supplier.view",

    "customer.view",

    // Purchase
    "purchase.view",
    "purchase.approve",
    "purchase.print",

    // Receipt
    "receipt.view",
    "receipt.print",

    // Gudang
    "barang-masuk.view",
    "barang-keluar.view",

    // Delivery
    "delivery.view",
    "delivery.print",

    // Stock
    "stock.view",
    "stock.card",
    "stock.mutation",

    // Stock Opname
    "stock-opname.view",
    "stock-opname.approve",

    // Adjustment
    "adjustment.view",
    "adjustment.approve",

    // Master Harga
    "master-harga.view",

    // Reports
    "report.view",
    "report.purchase",
    "report.receipt",
    "report.delivery",
    "report.inventory",
    "report.supplier",
    "report.customer",
    "report.export",

    // Attendance
    "attendance.view",
    "attendance.history",

    // Company
    "company.view",
  ],

  PURCHASING: [
    "dashboard.view",

    // Barang
    "barang.view",
    "barang.print",

    // Supplier
    "supplier.view",
    "supplier.create",
    "supplier.edit",
    "supplier.import",

    // Purchase
    "purchase.view",
    "purchase.create",
    "purchase.edit",
    "purchase.delete",
    "purchase.print",

    // Receipt
    "receipt.view",

    // Master Harga
    "master-harga.view",
    "master-harga.edit",

    // Reports
    "report.view",
    "report.purchase",
    "report.supplier",
    "report.export",
  ],

  GUDANG: [
    "dashboard.view",

    // Barang
    "barang.view",
    "barang.print",

    // Customer
    "customer.view",

    // Purchase
    "purchase.view",

    // Receipt
    "receipt.view",
    "receipt.create",
    "receipt.print",

    // Gudang
    "barang-masuk.view",
    "barang-masuk.create",
    "barang-masuk.edit",

    "barang-keluar.view",
    "barang-keluar.create",
    "barang-keluar.edit",

    // Delivery
    "delivery.view",
    "delivery.create",
    "delivery.edit",
    "delivery.release",
    "delivery.print",

    // Stock
    "stock.view",
    "stock.card",
    "stock.mutation",

    // Stock Opname
    "stock-opname.view",
    "stock-opname.create",
    "stock-opname.edit",

    // Reports
    "report.view",
    "report.inventory",
    "report.delivery",
    "report.export",
  ],
};

/**
 * Mengecek apakah sebuah role mempunyai permission tertentu.
 */
export function hasPermission(
  role: Role,
  permission: Permission
): boolean {
  return permissions[role]?.includes(permission) ?? false;
}

/**
 * Mengambil seluruh permission milik sebuah role.
 */
export function getPermissions(role: Role): Permission[] {
  return permissions[role] ?? [];
}

/**
 * Mengecek beberapa permission sekaligus.
 *
 * mode:
 * - "all" = harus mempunyai semuanya
 * - "any" = cukup mempunyai salah satu
 */
export function hasPermissions(
  role: Role,
  required: Permission[],
  mode: "all" | "any" = "all"
): boolean {
  const userPermissions = permissions[role] ?? [];

  if (mode === "any") {
    return required.some((permission) =>
      userPermissions.includes(permission)
    );
  }

  return required.every((permission) =>
    userPermissions.includes(permission)
  );
}