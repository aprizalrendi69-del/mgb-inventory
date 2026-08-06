/*
  Warnings:

  - You are about to drop the column `locked` on the `StockOpname` table. All the data in the column will be lost.
  - You are about to drop the column `note` on the `StockOpname` table. All the data in the column will be lost.
  - You are about to drop the column `number` on the `StockOpname` table. All the data in the column will be lost.
  - You are about to drop the column `barcode` on the `StockOpnameItem` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `StockOpnameItem` table. All the data in the column will be lost.
  - You are about to drop the column `scanned` on the `StockOpnameItem` table. All the data in the column will be lost.
  - You are about to drop the column `scannedAt` on the `StockOpnameItem` table. All the data in the column will be lost.
  - You are about to drop the column `stockOpnameId` on the `StockOpnameItem` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `StockOpnameItem` table. All the data in the column will be lost.
  - Added the required column `code` to the `StockOpname` table without a default value. This is not possible if the table is not empty.
  - Added the required column `opnameId` to the `StockOpnameItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "StockOpnameHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "opnameId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "systemQty" REAL NOT NULL,
    "physicalQty" REAL NOT NULL,
    "difference" REAL NOT NULL,
    "createdBy" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockOpnameHistory_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockOpnameHistory_opnameId_fkey" FOREIGN KEY ("opnameId") REFERENCES "StockOpname" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MasterHarga" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "barangId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "purchaseId" INTEGER,
    "purchaseItemId" INTEGER,
    "poNumber" TEXT,
    "hargaLama" REAL NOT NULL,
    "hargaBaru" REAL NOT NULL,
    "selisihHarga" REAL NOT NULL DEFAULT 0,
    "persenNaik" REAL NOT NULL DEFAULT 0,
    "qty" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "akumulasi" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "receiveDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MasterHarga_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MasterHarga_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriceSummary" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "barangId" INTEGER NOT NULL,
    "supplierId" INTEGER,
    "lastPrice" REAL NOT NULL DEFAULT 0,
    "averagePrice" REAL NOT NULL DEFAULT 0,
    "highestPrice" REAL NOT NULL DEFAULT 0,
    "lowestPrice" REAL NOT NULL DEFAULT 0,
    "totalPurchase" REAL NOT NULL DEFAULT 0,
    "lastReceiveDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PriceSummary_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PriceSummary_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StockOpname" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'COUNTING',
    "createdBy" INTEGER,
    "approvedBy" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_StockOpname" ("createdAt", "createdBy", "date", "id", "status", "updatedAt") SELECT "createdAt", "createdBy", "date", "id", "status", "updatedAt" FROM "StockOpname";
DROP TABLE "StockOpname";
ALTER TABLE "new_StockOpname" RENAME TO "StockOpname";
CREATE UNIQUE INDEX "StockOpname_code_key" ON "StockOpname"("code");
CREATE TABLE "new_StockOpnameItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "opnameId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "systemQty" REAL NOT NULL,
    "physicalQty" REAL NOT NULL DEFAULT 0,
    "difference" REAL NOT NULL DEFAULT 0,
    "note" TEXT,
    CONSTRAINT "StockOpnameItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockOpnameItem_opnameId_fkey" FOREIGN KEY ("opnameId") REFERENCES "StockOpname" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StockOpnameItem" ("barangId", "difference", "id", "physicalQty", "systemQty") SELECT "barangId", "difference", "id", "physicalQty", "systemQty" FROM "StockOpnameItem";
DROP TABLE "StockOpnameItem";
ALTER TABLE "new_StockOpnameItem" RENAME TO "StockOpnameItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "MasterHarga_barangId_idx" ON "MasterHarga"("barangId");

-- CreateIndex
CREATE INDEX "MasterHarga_supplierId_idx" ON "MasterHarga"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceSummary_barangId_key" ON "PriceSummary"("barangId");

-- CreateIndex
CREATE INDEX "PriceSummary_supplierId_idx" ON "PriceSummary"("supplierId");
