/*
  Warnings:

  - You are about to drop the column `opnameDate` on the `StockOpname` table. All the data in the column will be lost.
  - You are about to drop the column `remarks` on the `StockOpname` table. All the data in the column will be lost.
  - You are about to drop the column `warehouse` on the `StockOpname` table. All the data in the column will be lost.
  - You are about to alter the column `difference` on the `StockOpnameItem` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `physicalQty` on the `StockOpnameItem` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `systemQty` on the `StockOpnameItem` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - Added the required column `barcode` to the `StockOpnameItem` table without a default value. This is not possible if the table is not empty.

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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_StockOpname" ("createdAt", "id", "number", "status", "updatedAt") SELECT "createdAt", "id", "number", "status", "updatedAt" FROM "StockOpname";
DROP TABLE "StockOpname";
ALTER TABLE "new_StockOpname" RENAME TO "StockOpname";
CREATE UNIQUE INDEX "StockOpname_number_key" ON "StockOpname"("number");
CREATE TABLE "new_StockOpnameItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stockOpnameId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "barcode" TEXT NOT NULL,
    "systemQty" INTEGER NOT NULL,
    "physicalQty" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockOpnameItem_stockOpnameId_fkey" FOREIGN KEY ("stockOpnameId") REFERENCES "StockOpname" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockOpnameItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StockOpnameItem" ("barangId", "difference", "id", "physicalQty", "stockOpnameId", "systemQty") SELECT "barangId", "difference", "id", "physicalQty", "stockOpnameId", "systemQty" FROM "StockOpnameItem";
DROP TABLE "StockOpnameItem";
ALTER TABLE "new_StockOpnameItem" RENAME TO "StockOpnameItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
