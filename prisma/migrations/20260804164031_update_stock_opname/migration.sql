-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StockOpnameItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stockOpnameId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "barcode" TEXT NOT NULL,
    "systemQty" REAL NOT NULL DEFAULT 0,
    "physicalQty" REAL NOT NULL DEFAULT 0,
    "difference" REAL NOT NULL DEFAULT 0,
    "scanned" BOOLEAN NOT NULL DEFAULT false,
    "scannedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockOpnameItem_stockOpnameId_fkey" FOREIGN KEY ("stockOpnameId") REFERENCES "StockOpname" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockOpnameItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StockOpnameItem" ("barangId", "barcode", "createdAt", "difference", "id", "physicalQty", "scannedAt", "stockOpnameId", "systemQty", "updatedAt") SELECT "barangId", "barcode", "createdAt", "difference", "id", "physicalQty", "scannedAt", "stockOpnameId", "systemQty", "updatedAt" FROM "StockOpnameItem";
DROP TABLE "StockOpnameItem";
ALTER TABLE "new_StockOpnameItem" RENAME TO "StockOpnameItem";
CREATE INDEX "StockOpnameItem_barcode_idx" ON "StockOpnameItem"("barcode");
CREATE UNIQUE INDEX "StockOpnameItem_stockOpnameId_barangId_key" ON "StockOpnameItem"("stockOpnameId", "barangId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
