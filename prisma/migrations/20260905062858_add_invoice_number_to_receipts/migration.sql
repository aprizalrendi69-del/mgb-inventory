-- AlterTable
ALTER TABLE "OutletReceipt" ADD COLUMN "invoiceNumber" TEXT;

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN "invoiceNumber" TEXT;

-- CreateIndex
CREATE INDEX "OutletReceipt_invoiceNumber_idx" ON "OutletReceipt"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Receipt_purchaseId_idx" ON "Receipt"("purchaseId");

-- CreateIndex
CREATE INDEX "Receipt_invoiceNumber_idx" ON "Receipt"("invoiceNumber");
