/*
  Warnings:

  - You are about to drop the `Attendance` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `position` on table `Employee` required. This step will fail if there are existing NULL values in that column.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Attendance";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nik" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "position" TEXT NOT NULL,
    "department" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "photo" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Employee" ("active", "address", "createdAt", "department", "id", "name", "nik", "phone", "position", "updatedAt") SELECT "active", "address", "createdAt", "department", "id", "name", "nik", "phone", "position", "updatedAt" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_nik_key" ON "Employee"("nik");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
