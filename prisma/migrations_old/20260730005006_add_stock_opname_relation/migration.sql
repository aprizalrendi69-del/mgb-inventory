/*
  Warnings:

  - You are about to drop the column `opnameId` on the `StockOpnameItem` table. All the data in the column will be lost.
  - Added the required column `stockOpnameId` to the `StockOpnameItem` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StockOpnameItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stockOpnameId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "systemQty" REAL NOT NULL,
    "physicalQty" REAL NOT NULL,
    "difference" REAL NOT NULL,
    CONSTRAINT "StockOpnameItem_stockOpnameId_fkey" FOREIGN KEY ("stockOpnameId") REFERENCES "StockOpname" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockOpnameItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StockOpnameItem" ("barangId", "difference", "id", "physicalQty", "systemQty") SELECT "barangId", "difference", "id", "physicalQty", "systemQty" FROM "StockOpnameItem";
DROP TABLE "StockOpnameItem";
ALTER TABLE "new_StockOpnameItem" RENAME TO "StockOpnameItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
