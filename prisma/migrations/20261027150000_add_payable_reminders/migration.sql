-- Additive-only migration: keeps all existing ERP data and transactions.
ALTER TABLE "User" ADD COLUMN "whatsappPhone" TEXT;

CREATE TABLE "PayableReminderLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "payableId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "stage" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "outstanding" REAL NOT NULL DEFAULT 0,
    "message" TEXT NOT NULL,
    "readAt" DATETIME,
    "whatsappStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "whatsappSentAt" DATETIME,
    "whatsappError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayableReminderLog_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "PurchasePayable" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PayableReminderLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PayableReminderLog_payableId_userId_stage_dueDate_key"
ON "PayableReminderLog"("payableId", "userId", "stage", "dueDate");

CREATE INDEX "PayableReminderLog_userId_createdAt_idx"
ON "PayableReminderLog"("userId", "createdAt");

CREATE INDEX "PayableReminderLog_payableId_stage_idx"
ON "PayableReminderLog"("payableId", "stage");

CREATE INDEX "PayableReminderLog_whatsappStatus_idx"
ON "PayableReminderLog"("whatsappStatus");
