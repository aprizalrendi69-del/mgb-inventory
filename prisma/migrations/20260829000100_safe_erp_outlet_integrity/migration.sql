-- Non-destructive MGB ERP integrity migration.
-- Adds missing relations required by the current POS/Manufacture/Payment code.
-- Existing rows are preserved; new foreign-key columns are nullable.

PRAGMA foreign_keys=OFF;

ALTER TABLE "Payment" ADD COLUMN "payableId" INTEGER REFERENCES "PurchasePayable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Payment_payableId_idx" ON "Payment"("payableId");

ALTER TABLE "Recipe" ADD COLUMN "outletId" INTEGER REFERENCES "Outlet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Recipe_outletId_idx" ON "Recipe"("outletId");

ALTER TABLE "ManufactureOrder" ADD COLUMN "outletId" INTEGER REFERENCES "Outlet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "ManufactureOrder_outletId_idx" ON "ManufactureOrder"("outletId");

ALTER TABLE "StockMutation" ADD COLUMN "outletId" INTEGER REFERENCES "Outlet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "StockMutation_outletId_idx" ON "StockMutation"("outletId");

-- OutletSaleItem.barangId is optional because a POS row represents a Menu;
-- the consumed inventory is recorded separately in StockCard/StockMutation.
CREATE TABLE "new_OutletSaleItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "saleId" INTEGER NOT NULL,
    "barangId" INTEGER,
    "menuId" INTEGER,
    "qty" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    CONSTRAINT "OutletSaleItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OutletSaleItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutletSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "OutletSale" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OutletSaleItem" ("id","saleId","barangId","menuId","qty","unitPrice","subtotal")
SELECT "id","saleId","barangId","menuId","qty","unitPrice","subtotal" FROM "OutletSaleItem";
DROP TABLE "OutletSaleItem";
ALTER TABLE "new_OutletSaleItem" RENAME TO "OutletSaleItem";
CREATE INDEX "OutletSaleItem_saleId_idx" ON "OutletSaleItem"("saleId");
CREATE INDEX "OutletSaleItem_barangId_idx" ON "OutletSaleItem"("barangId");
CREATE INDEX "OutletSaleItem_menuId_idx" ON "OutletSaleItem"("menuId");

-- Safe metadata backfill: no stock quantities are changed.
UPDATE "Barang"
SET "baseUnit" = "unit"
WHERE "baseUnit" IS NULL OR trim("baseUnit") = '';

UPDATE "Barang"
SET "conversionRate" = 1
WHERE "conversionRate" IS NULL OR "conversionRate" <= 0;

-- Two unambiguous legacy unit metadata corrections. These preserve
-- the physical package quantity while fixing the base-unit meaning.
UPDATE "Barang" SET "baseUnit" = 'ml', "conversionRate" = 1750
WHERE "id" = 153 AND "unit" = 'pcs' AND "baseUnit" = 'ml' AND "conversionRate" = 1.75;

UPDATE "Barang" SET "baseUnit" = 'gram', "conversionRate" = 1000
WHERE "id" = 260 AND "unit" = 'pack' AND "baseUnit" = 'kg' AND "conversionRate" = 1000;

-- Repair legacy transfers that used 0 as "no source outlet".
UPDATE "OutletTransfer" SET "sourceOutletId" = NULL WHERE "sourceOutletId" = 0;

PRAGMA foreign_keys=ON;
