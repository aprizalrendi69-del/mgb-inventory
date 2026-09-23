-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DeliveryRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "outletId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "customerId" INTEGER,
    "requestDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "deliveryId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryRequest_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DeliveryRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DeliveryRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DeliveryRequest_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DeliveryRequest" ("createdAt", "createdById", "deliveryId", "id", "number", "outletId", "remarks", "requestDate", "status", "updatedAt") SELECT "createdAt", "createdById", "deliveryId", "id", "number", "outletId", "remarks", "requestDate", "status", "updatedAt" FROM "DeliveryRequest";
DROP TABLE "DeliveryRequest";
ALTER TABLE "new_DeliveryRequest" RENAME TO "DeliveryRequest";
CREATE UNIQUE INDEX "DeliveryRequest_number_key" ON "DeliveryRequest"("number");
CREATE UNIQUE INDEX "DeliveryRequest_deliveryId_key" ON "DeliveryRequest"("deliveryId");
CREATE INDEX "DeliveryRequest_outletId_idx" ON "DeliveryRequest"("outletId");
CREATE INDEX "DeliveryRequest_createdById_idx" ON "DeliveryRequest"("createdById");
CREATE INDEX "DeliveryRequest_customerId_idx" ON "DeliveryRequest"("customerId");
CREATE INDEX "DeliveryRequest_requestDate_idx" ON "DeliveryRequest"("requestDate");
CREATE INDEX "DeliveryRequest_status_idx" ON "DeliveryRequest"("status");
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullname" TEXT NOT NULL,
    "photo" TEXT,
    "role" TEXT NOT NULL,
    "outletId" INTEGER,
    "customerId" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSeen" DATETIME,
    CONSTRAINT "User_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("active", "createdAt", "fullname", "id", "lastSeen", "outletId", "password", "photo", "role", "updatedAt", "username") SELECT "active", "createdAt", "fullname", "id", "lastSeen", "outletId", "password", "photo", "role", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
