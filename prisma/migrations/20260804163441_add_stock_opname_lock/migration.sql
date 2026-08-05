-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StockOpname" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "createdBy" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_StockOpname" ("createdAt", "createdBy", "date", "id", "note", "number", "status", "updatedAt") SELECT "createdAt", "createdBy", "date", "id", "note", "number", "status", "updatedAt" FROM "StockOpname";
DROP TABLE "StockOpname";
ALTER TABLE "new_StockOpname" RENAME TO "StockOpname";
CREATE UNIQUE INDEX "StockOpname_number_key" ON "StockOpname"("number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
