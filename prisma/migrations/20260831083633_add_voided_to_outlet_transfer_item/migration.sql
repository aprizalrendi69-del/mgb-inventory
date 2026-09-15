-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OutletSaleItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "saleId" INTEGER NOT NULL,
    "barangId" INTEGER,
    "menuId" INTEGER,
    "qty" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    CONSTRAINT "OutletSaleItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OutletSaleItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OutletSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "OutletSale" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OutletSaleItem" ("barangId", "id", "menuId", "qty", "saleId", "subtotal", "unitPrice") SELECT "barangId", "id", "menuId", "qty", "saleId", "subtotal", "unitPrice" FROM "OutletSaleItem";
DROP TABLE "OutletSaleItem";
ALTER TABLE "new_OutletSaleItem" RENAME TO "OutletSaleItem";
CREATE INDEX "OutletSaleItem_saleId_idx" ON "OutletSaleItem"("saleId");
CREATE INDEX "OutletSaleItem_barangId_idx" ON "OutletSaleItem"("barangId");
CREATE INDEX "OutletSaleItem_menuId_idx" ON "OutletSaleItem"("menuId");
CREATE TABLE "new_OutletTransferItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "transferId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "qty" REAL NOT NULL,
    "receivedQty" REAL NOT NULL DEFAULT 0,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "voidedAt" DATETIME,
    "voidedById" INTEGER,
    "voidReason" TEXT,
    CONSTRAINT "OutletTransferItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutletTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "OutletTransfer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OutletTransferItem" ("barangId", "id", "qty", "receivedQty", "transferId") SELECT "barangId", "id", "qty", "receivedQty", "transferId" FROM "OutletTransferItem";
DROP TABLE "OutletTransferItem";
ALTER TABLE "new_OutletTransferItem" RENAME TO "OutletTransferItem";
CREATE INDEX "OutletTransferItem_transferId_idx" ON "OutletTransferItem"("transferId");
CREATE INDEX "OutletTransferItem_barangId_idx" ON "OutletTransferItem"("barangId");
CREATE INDEX "OutletTransferItem_voided_idx" ON "OutletTransferItem"("voided");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "StockMutation_barangId_idx" ON "StockMutation"("barangId");
