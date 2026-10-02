-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OutletSale" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "outletId" INTEGER NOT NULL,
    "userId" INTEGER,
    "customerName" TEXT,
    "saleDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "discount" REAL NOT NULL DEFAULT 0,
    "serviceCharge" REAL NOT NULL DEFAULT 0,
    "ppn" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "changeAmount" REAL NOT NULL DEFAULT 0,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "voidedAt" DATETIME,
    "voidedBy" INTEGER,
    "voidReason" TEXT,
    "voidedById" INTEGER,
    CONSTRAINT "OutletSale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OutletSale_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_OutletSale" ("changeAmount", "createdAt", "customerName", "discount", "id", "number", "outletId", "paidAmount", "paymentMethod", "saleDate", "status", "subtotal", "total", "updatedAt", "userId", "voidReason", "voidedAt", "voidedBy", "voidedById") SELECT "changeAmount", "createdAt", "customerName", "discount", "id", "number", "outletId", "paidAmount", "paymentMethod", "saleDate", "status", "subtotal", "total", "updatedAt", "userId", "voidReason", "voidedAt", "voidedBy", "voidedById" FROM "OutletSale";
DROP TABLE "OutletSale";
ALTER TABLE "new_OutletSale" RENAME TO "OutletSale";
CREATE UNIQUE INDEX "OutletSale_number_key" ON "OutletSale"("number");
CREATE INDEX "OutletSale_outletId_idx" ON "OutletSale"("outletId");
CREATE INDEX "OutletSale_userId_idx" ON "OutletSale"("userId");
CREATE INDEX "OutletSale_saleDate_idx" ON "OutletSale"("saleDate");
CREATE INDEX "OutletSale_status_idx" ON "OutletSale"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
