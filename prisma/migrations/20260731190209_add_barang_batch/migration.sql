/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `BarangBatch` table. All the data in the column will be lost.
  - Made the column `batchNumber` on table `BarangBatch` required. This step will fail if there are existing NULL values in that column.
  - Made the column `expiredDate` on table `BarangBatch` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BarangBatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "barangId" INTEGER NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "expiredDate" DATETIME NOT NULL,
    "qty" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BarangBatch_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BarangBatch" ("barangId", "batchNumber", "createdAt", "expiredDate", "id", "qty") SELECT "barangId", "batchNumber", "createdAt", "expiredDate", "id", "qty" FROM "BarangBatch";
DROP TABLE "BarangBatch";
ALTER TABLE "new_BarangBatch" RENAME TO "BarangBatch";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
