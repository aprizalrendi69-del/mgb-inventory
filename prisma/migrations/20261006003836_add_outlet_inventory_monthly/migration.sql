-- CreateTable
CREATE TABLE "OutletInventoryMonthly" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "outletId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "openingStock" REAL NOT NULL DEFAULT 0,
    "incomingQty" REAL NOT NULL DEFAULT 0,
    "outgoingQty" REAL NOT NULL DEFAULT 0,
    "endingStock" REAL NOT NULL DEFAULT 0,
    "averageCost" REAL NOT NULL DEFAULT 0,
    "outgoingCost" REAL NOT NULL DEFAULT 0,
    "usagePercentage" REAL NOT NULL DEFAULT 0,
    "previousOutgoingCost" REAL NOT NULL DEFAULT 0,
    "costChangePercentage" REAL NOT NULL DEFAULT 0,
    "costStatus" TEXT NOT NULL DEFAULT 'STABIL',
    "stockStatus" TEXT NOT NULL DEFAULT 'AMAN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OutletInventoryMonthly_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutletInventoryMonthly_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "OutletInventoryMonthly_outletId_periodYear_periodMonth_idx" ON "OutletInventoryMonthly"("outletId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "OutletInventoryMonthly_barangId_idx" ON "OutletInventoryMonthly"("barangId");

-- CreateIndex
CREATE UNIQUE INDEX "OutletInventoryMonthly_outletId_barangId_periodYear_periodMonth_key" ON "OutletInventoryMonthly"("outletId", "barangId", "periodYear", "periodMonth");
