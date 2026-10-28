-- CreateTable
CREATE TABLE "EmployeeLeaveBalance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "entitlement" REAL NOT NULL DEFAULT 12,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmployeeLeaveBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EmployeeLeaveBalance_year_idx" ON "EmployeeLeaveBalance"("year");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeLeaveBalance_employeeId_year_key" ON "EmployeeLeaveBalance"("employeeId", "year");
