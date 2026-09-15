-- ADDITIVE ONLY: Outlet Manufacture + BOM + POS.
-- Never drops, renames, truncates, or rewrites existing ERP tables.
CREATE TABLE IF NOT EXISTS "PosMenu" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "outletId" INTEGER NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "price" REAL NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PosMenu_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PosMenu_outletId_code_key" ON "PosMenu"("outletId", "code");
CREATE INDEX IF NOT EXISTS "PosMenu_outletId_idx" ON "PosMenu"("outletId");
CREATE INDEX IF NOT EXISTS "PosMenu_active_idx" ON "PosMenu"("active");
CREATE TABLE IF NOT EXISTS "PosMenuBom" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "menuId" INTEGER NOT NULL,
  "barangId" INTEGER NOT NULL,
  "qtyBase" REAL NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PosMenuBom_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "PosMenu" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PosMenuBom_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PosMenuBom_menuId_barangId_key" ON "PosMenuBom"("menuId", "barangId");
CREATE INDEX IF NOT EXISTS "PosMenuBom_menuId_idx" ON "PosMenuBom"("menuId");
CREATE INDEX IF NOT EXISTS "PosMenuBom_barangId_idx" ON "PosMenuBom"("barangId");
CREATE TABLE IF NOT EXISTS "OutletManufacture" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "number" TEXT NOT NULL,
  "outletId" INTEGER NOT NULL,
  "outputBarangId" INTEGER NOT NULL,
  "outputQtyBase" REAL NOT NULL,
  "note" TEXT,
  "createdById" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OutletManufacture_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OutletManufacture_outputBarangId_fkey" FOREIGN KEY ("outputBarangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OutletManufacture_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "OutletManufacture_number_key" ON "OutletManufacture"("number");
CREATE INDEX IF NOT EXISTS "OutletManufacture_outletId_idx" ON "OutletManufacture"("outletId");
CREATE INDEX IF NOT EXISTS "OutletManufacture_outputBarangId_idx" ON "OutletManufacture"("outputBarangId");
CREATE INDEX IF NOT EXISTS "OutletManufacture_createdAt_idx" ON "OutletManufacture"("createdAt");
CREATE TABLE IF NOT EXISTS "OutletManufactureItem" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "manufactureId" INTEGER NOT NULL,
  "barangId" INTEGER NOT NULL,
  "qtyBase" REAL NOT NULL,
  "unitCostBase" REAL NOT NULL DEFAULT 0,
  CONSTRAINT "OutletManufactureItem_manufactureId_fkey" FOREIGN KEY ("manufactureId") REFERENCES "OutletManufacture" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OutletManufactureItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "OutletManufactureItem_manufactureId_idx" ON "OutletManufactureItem"("manufactureId");
CREATE INDEX IF NOT EXISTS "OutletManufactureItem_barangId_idx" ON "OutletManufactureItem"("barangId");
CREATE TABLE IF NOT EXISTS "PosSale" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "number" TEXT NOT NULL,
  "outletId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "subtotal" REAL NOT NULL DEFAULT 0,
  "discount" REAL NOT NULL DEFAULT 0,
  "total" REAL NOT NULL DEFAULT 0,
  "hpp" REAL NOT NULL DEFAULT 0,
  "grossProfit" REAL NOT NULL DEFAULT 0,
  "createdById" INTEGER,
  "paidAt" DATETIME,
  "voidedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PosSale_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PosSale_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PosSale_number_key" ON "PosSale"("number");
CREATE INDEX IF NOT EXISTS "PosSale_outletId_idx" ON "PosSale"("outletId");
CREATE INDEX IF NOT EXISTS "PosSale_status_idx" ON "PosSale"("status");
CREATE INDEX IF NOT EXISTS "PosSale_createdAt_idx" ON "PosSale"("createdAt");
CREATE TABLE IF NOT EXISTS "PosSaleItem" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "saleId" INTEGER NOT NULL,
  "menuId" INTEGER NOT NULL,
  "qty" REAL NOT NULL,
  "unitPrice" REAL NOT NULL,
  "subtotal" REAL NOT NULL,
  CONSTRAINT "PosSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "PosSale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PosSaleItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "PosMenu" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PosSaleItem_saleId_idx" ON "PosSaleItem"("saleId");
CREATE INDEX IF NOT EXISTS "PosSaleItem_menuId_idx" ON "PosSaleItem"("menuId");
CREATE TABLE IF NOT EXISTS "PosSaleConsumption" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "saleItemId" INTEGER NOT NULL,
  "barangId" INTEGER NOT NULL,
  "qtyBase" REAL NOT NULL,
  "unitCostBase" REAL NOT NULL DEFAULT 0,
  "totalCostBase" REAL NOT NULL DEFAULT 0,
  CONSTRAINT "PosSaleConsumption_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "PosSaleItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PosSaleConsumption_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PosSaleConsumption_saleItemId_idx" ON "PosSaleConsumption"("saleItemId");
CREATE INDEX IF NOT EXISTS "PosSaleConsumption_barangId_idx" ON "PosSaleConsumption"("barangId");

-- Optional outlet ownership for NEW outlet stock ledger entries. Existing rows remain untouched.
ALTER TABLE "StockMutation" ADD COLUMN "outletId" INTEGER REFERENCES "Outlet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "StockMutation_outletId_idx" ON "StockMutation"("outletId");
