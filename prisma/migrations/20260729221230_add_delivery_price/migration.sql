-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DeliveryItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deliveryId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "qty" REAL NOT NULL,
    "price" REAL NOT NULL DEFAULT 0,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "note" TEXT,
    CONSTRAINT "DeliveryItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DeliveryItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DeliveryItem" ("barangId", "deliveryId", "id", "note", "qty") SELECT "barangId", "deliveryId", "id", "note", "qty" FROM "DeliveryItem";
DROP TABLE "DeliveryItem";
ALTER TABLE "new_DeliveryItem" RENAME TO "DeliveryItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
