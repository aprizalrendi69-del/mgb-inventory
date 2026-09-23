-- CreateTable
CREATE TABLE "DeliveryRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "outletId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "requestDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "deliveryId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryRequest_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DeliveryRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DeliveryRequest_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryRequestItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deliveryRequestId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "qty" REAL NOT NULL,
    "note" TEXT,
    CONSTRAINT "DeliveryRequestItem_deliveryRequestId_fkey" FOREIGN KEY ("deliveryRequestId") REFERENCES "DeliveryRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeliveryRequestItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Delivery" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "customerId" INTEGER,
    "outletId" INTEGER,
    "deliveryDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "totalQty" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "voidReason" TEXT,
    "voidedAt" DATETIME,
    "voidedBy" INTEGER,
    CONSTRAINT "Delivery_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Delivery_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Delivery" ("createdAt", "customerId", "deliveryDate", "id", "number", "outletId", "remarks", "status", "totalQty", "updatedAt", "voidReason", "voidedAt", "voidedBy") SELECT "createdAt", "customerId", "deliveryDate", "id", "number", "outletId", "remarks", "status", "totalQty", "updatedAt", "voidReason", "voidedAt", "voidedBy" FROM "Delivery";
DROP TABLE "Delivery";
ALTER TABLE "new_Delivery" RENAME TO "Delivery";
CREATE UNIQUE INDEX "Delivery_number_key" ON "Delivery"("number");
CREATE INDEX "Delivery_outletId_idx" ON "Delivery"("outletId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryRequest_number_key" ON "DeliveryRequest"("number");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryRequest_deliveryId_key" ON "DeliveryRequest"("deliveryId");

-- CreateIndex
CREATE INDEX "DeliveryRequest_outletId_idx" ON "DeliveryRequest"("outletId");

-- CreateIndex
CREATE INDEX "DeliveryRequest_createdById_idx" ON "DeliveryRequest"("createdById");

-- CreateIndex
CREATE INDEX "DeliveryRequest_requestDate_idx" ON "DeliveryRequest"("requestDate");

-- CreateIndex
CREATE INDEX "DeliveryRequest_status_idx" ON "DeliveryRequest"("status");

-- CreateIndex
CREATE INDEX "DeliveryRequestItem_deliveryRequestId_idx" ON "DeliveryRequestItem"("deliveryRequestId");

-- CreateIndex
CREATE INDEX "DeliveryRequestItem_barangId_idx" ON "DeliveryRequestItem"("barangId");
