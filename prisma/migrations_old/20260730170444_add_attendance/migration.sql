/*
  Warnings:

  - You are about to drop the column `latitude` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `selfie` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Attendance` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attendance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkIn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOut" DATETIME,
    "photo" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Attendance" ("checkIn", "checkOut", "date", "employeeId", "id") SELECT coalesce("checkIn", CURRENT_TIMESTAMP) AS "checkIn", "checkOut", "date", "employeeId", "id" FROM "Attendance";
DROP TABLE "Attendance";
ALTER TABLE "new_Attendance" RENAME TO "Attendance";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
