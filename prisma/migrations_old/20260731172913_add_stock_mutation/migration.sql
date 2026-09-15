/*
  Warnings:

  - You are about to drop the column `useExpired` on the `Barang` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Barang" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "brand" TEXT,
    "unit" TEXT NOT NULL,
    "minimumStock" REAL NOT NULL DEFAULT 0,
    "stock" REAL NOT NULL DEFAULT 0,
    "purchasePrice" REAL NOT NULL DEFAULT 0,
    "sellingPrice" REAL NOT NULL DEFAULT 0,
    "hasExpired" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiredWarning" INTEGER NOT NULL DEFAULT 30
);
INSERT INTO "new_Barang" ("active", "barcode", "brand", "category", "code", "createdAt", "expiredWarning", "hasExpired", "id", "minimumStock", "name", "purchasePrice", "sellingPrice", "stock", "unit", "updatedAt") SELECT "active", "barcode", "brand", "category", "code", "createdAt", "expiredWarning", "hasExpired", "id", "minimumStock", "name", "purchasePrice", "sellingPrice", "stock", "unit", "updatedAt" FROM "Barang";
DROP TABLE "Barang";
ALTER TABLE "new_Barang" RENAME TO "Barang";
CREATE UNIQUE INDEX "Barang_code_key" ON "Barang"("code");
CREATE UNIQUE INDEX "Barang_barcode_key" ON "Barang"("barcode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
