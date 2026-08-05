/*
  Warnings:

  - You are about to alter the column `difference` on the `StockOpnameItem` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.
  - You are about to alter the column `physicalQty` on the `StockOpnameItem` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.
  - You are about to alter the column `systemQty` on the `StockOpnameItem` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.
  - Added the required column `updatedAt` to the `StockOpnameItem` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StockOpname" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "createdBy" INTEGER,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_StockOpname" ("createdAt", "createdBy", "date", "id", "locked", "note", "number", "status", "updatedAt") SELECT "createdAt", "createdBy", "date", "id", "locked", "note", "number", "status", "updatedAt" FROM "StockOpname";
DROP TABLE "StockOpname";
ALTER TABLE "new_StockOpname" RENAME TO "StockOpname";
CREATE UNIQUE INDEX "StockOpname_number_key" ON "StockOpname"("number");
CREATE TABLE "new_StockOpnameItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stockOpnameId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "barcode" TEXT NOT NULL,
    "systemQty" REAL NOT NULL DEFAULT 0,
    "physicalQty" REAL NOT NULL DEFAULT 0,
    "difference" REAL NOT NULL DEFAULT 0,
    "scannedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockOpnameItem_stockOpnameId_fkey" FOREIGN KEY ("stockOpnameId") REFERENCES "StockOpname" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockOpnameItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StockOpnameItem" ("barangId", "barcode", "createdAt", "difference", "id", "physicalQty", "stockOpnameId", "systemQty") SELECT "barangId", "barcode", "createdAt", "difference", "id", "physicalQty", "stockOpnameId", "systemQty" FROM "StockOpnameItem";
DROP TABLE "StockOpnameItem";
ALTER TABLE "new_StockOpnameItem" RENAME TO "StockOpnameItem";
CREATE INDEX "StockOpnameItem_barcode_idx" ON "StockOpnameItem"("barcode");
CREATE INDEX "StockOpnameItem_stockOpnameId_idx" ON "StockOpnameItem"("stockOpnameId");
CREATE UNIQUE INDEX "StockOpnameItem_stockOpnameId_barangId_key" ON "StockOpnameItem"("stockOpnameId", "barangId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
