/*
  Warnings:

  - You are about to drop the column `checkInPhoto` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `checkOutPhoto` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `note` on the `Attendance` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attendance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkIn" DATETIME,
    "checkOut" DATETIME,
    "status" TEXT NOT NULL,
    "selfie" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Attendance" ("checkIn", "checkOut", "date", "employeeId", "id", "latitude", "longitude", "status") SELECT "checkIn", "checkOut", "date", "employeeId", "id", "latitude", "longitude", "status" FROM "Attendance";
DROP TABLE "Attendance";
ALTER TABLE "new_Attendance" RENAME TO "Attendance";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
