import { Permission } from "@/lib/permissions";

export const menuPermissions: Record<string, Permission[]> = {

  "/dashboard": [
    "dashboard.view",
  ],

  "/master-barang": [
    "barang.view",
  ],

  "/master-supplier": [
    "supplier.view",
  ],

  "/master-customer": [
    "customer.view",
  ],

  "/purchase": [
    "purchase.view",
  ],

  "/purchase/approve": [
    "purchase.approve",
  ],

  "/goods-receipt": [
    "receipt.view",
  ],

  "/barang-masuk": [
    "barang-masuk.view",
  ],

  "/barang-keluar": [
    "barang-keluar.view",
  ],

  "/delivery": [
    "delivery.view",
  ],

  "/stock": [
    "stock.view",
  ],

  "/stock-opname": [
    "stock-opname.view",
  ],

  "/adjustment": [
    "adjustment.view",
  ],

  "/master-harga": [
    "master-harga.view",
  ],

  "/laporan": [
    "report.view",
  ],

  "/attendance": [
    "attendance.view",
  ],

  "/master-user": [
    "user.view",
  ],

  "/company": [
    "company.view",
  ],
};