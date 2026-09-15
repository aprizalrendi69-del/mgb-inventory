/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Attendance` table. All the data in the column will be lost.
  - Made the column `employeeId` on table `Attendance` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attendance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "photo" TEXT,
    "note" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "checkIn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOut" DATETIME,
    CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Attendance" ("checkIn", "checkOut", "employeeId", "id", "latitude", "longitude", "note", "photo") SELECT "checkIn", "checkOut", "employeeId", "id", "latitude", "longitude", "note", "photo" FROM "Attendance";
DROP TABLE "Attendance";
ALTER TABLE "new_Attendance" RENAME TO "Attendance";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
