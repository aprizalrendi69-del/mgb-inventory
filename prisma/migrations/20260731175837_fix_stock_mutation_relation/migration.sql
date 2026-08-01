-- CreateTable
CREATE TABLE "StockMutation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "barangId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "qty" REAL NOT NULL,
    "stockBefore" REAL NOT NULL,
    "stockAfter" REAL NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMutation_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
