-- CreateTable
CREATE TABLE "Session" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BarangBatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "barangId" INTEGER NOT NULL,
    "batchNumber" TEXT,
    "expiredDate" DATETIME,
    "qty" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BarangBatch_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Adjustment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "adjustmentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "warehouse" TEXT NOT NULL DEFAULT 'MAIN',
    "type" TEXT NOT NULL DEFAULT 'IN',
    "reason" TEXT,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Adjustment" ("adjustmentDate", "createdAt", "id", "number", "reason", "remarks", "type", "updatedAt", "warehouse") SELECT "adjustmentDate", "createdAt", "id", "number", "reason", "remarks", "type", "updatedAt", "warehouse" FROM "Adjustment";
DROP TABLE "Adjustment";
ALTER TABLE "new_Adjustment" RENAME TO "Adjustment";
CREATE UNIQUE INDEX "Adjustment_number_key" ON "Adjustment"("number");
CREATE TABLE "new_AdjustmentItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "adjustmentId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "qty" REAL NOT NULL,
    "price" REAL NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'IN',
    CONSTRAINT "AdjustmentItem_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "Adjustment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdjustmentItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AdjustmentItem" ("adjustmentId", "barangId", "id", "price", "qty") SELECT "adjustmentId", "barangId", "id", "price", "qty" FROM "AdjustmentItem";
DROP TABLE "AdjustmentItem";
ALTER TABLE "new_AdjustmentItem" RENAME TO "AdjustmentItem";
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
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Barang" ("active", "barcode", "brand", "category", "code", "createdAt", "id", "minimumStock", "name", "purchasePrice", "sellingPrice", "stock", "unit", "updatedAt") SELECT "active", "barcode", "brand", "category", "code", "createdAt", "id", "minimumStock", "name", "purchasePrice", "sellingPrice", "stock", "unit", "updatedAt" FROM "Barang";
DROP TABLE "Barang";
ALTER TABLE "new_Barang" RENAME TO "Barang";
CREATE UNIQUE INDEX "Barang_code_key" ON "Barang"("code");
CREATE UNIQUE INDEX "Barang_barcode_key" ON "Barang"("barcode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
