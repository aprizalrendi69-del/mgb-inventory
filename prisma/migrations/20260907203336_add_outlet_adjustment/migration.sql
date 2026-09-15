-- CreateTable
CREATE TABLE "OutletAdjustment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "outletId" INTEGER NOT NULL,
    "adjustmentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL DEFAULT 'IN',
    "reason" TEXT,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OutletAdjustment_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutletAdjustmentItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "outletAdjustmentId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "qty" REAL NOT NULL,
    "price" REAL NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'IN',
    CONSTRAINT "OutletAdjustmentItem_outletAdjustmentId_fkey" FOREIGN KEY ("outletAdjustmentId") REFERENCES "OutletAdjustment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutletAdjustmentItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "OutletAdjustment_number_key" ON "OutletAdjustment"("number");

-- CreateIndex
CREATE INDEX "OutletAdjustment_outletId_idx" ON "OutletAdjustment"("outletId");

-- CreateIndex
CREATE INDEX "OutletAdjustment_adjustmentDate_idx" ON "OutletAdjustment"("adjustmentDate");

-- CreateIndex
CREATE INDEX "OutletAdjustment_status_idx" ON "OutletAdjustment"("status");

-- CreateIndex
CREATE INDEX "OutletAdjustmentItem_outletAdjustmentId_idx" ON "OutletAdjustmentItem"("outletAdjustmentId");

-- CreateIndex
CREATE INDEX "OutletAdjustmentItem_barangId_idx" ON "OutletAdjustmentItem"("barangId");
