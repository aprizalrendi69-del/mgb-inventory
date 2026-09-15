-- Additive POS tables. Existing data is preserved.
CREATE TABLE "OutletSale" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "number" TEXT NOT NULL,
  "outletId" INTEGER NOT NULL,
  "cashierId" INTEGER NOT NULL,
  "saleDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "subtotal" REAL NOT NULL DEFAULT 0,
  "discount" REAL NOT NULL DEFAULT 0,
  "tax" REAL NOT NULL DEFAULT 0,
  "total" REAL NOT NULL DEFAULT 0,
  "paidAmount" REAL NOT NULL DEFAULT 0,
  "changeAmount" REAL NOT NULL DEFAULT 0,
  "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "note" TEXT,
  "voidedAt" DATETIME,
  "voidedById" INTEGER,
  "voidReason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OutletSale_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OutletSale_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User" ("id") ON UPDATE CASCADE,
  CONSTRAINT "OutletSale_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User" ("id") ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OutletSale_number_key" ON "OutletSale"("number");
CREATE INDEX "OutletSale_outletId_idx" ON "OutletSale"("outletId");
CREATE INDEX "OutletSale_cashierId_idx" ON "OutletSale"("cashierId");
CREATE INDEX "OutletSale_saleDate_idx" ON "OutletSale"("saleDate");
CREATE INDEX "OutletSale_status_idx" ON "OutletSale"("status");
CREATE INDEX "OutletSale_paymentMethod_idx" ON "OutletSale"("paymentMethod");
CREATE INDEX "OutletSale_voidedById_idx" ON "OutletSale"("voidedById");

CREATE TABLE "OutletSaleItem" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "saleId" INTEGER NOT NULL,
  "barangId" INTEGER NOT NULL,
  "qty" REAL NOT NULL,
  "price" REAL NOT NULL DEFAULT 0,
  "discount" REAL NOT NULL DEFAULT 0,
  "subtotal" REAL NOT NULL DEFAULT 0,
  CONSTRAINT "OutletSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "OutletSale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OutletSaleItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON UPDATE CASCADE
);
CREATE INDEX "OutletSaleItem_saleId_idx" ON "OutletSaleItem"("saleId");
CREATE INDEX "OutletSaleItem_barangId_idx" ON "OutletSaleItem"("barangId");
