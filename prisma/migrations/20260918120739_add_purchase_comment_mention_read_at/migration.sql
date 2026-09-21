-- AlterTable
ALTER TABLE "PurchaseCommentMention" ADD COLUMN "readAt" DATETIME;

-- CreateIndex
CREATE INDEX "PurchaseCommentMention_userId_readAt_createdAt_idx" ON "PurchaseCommentMention"("userId", "readAt", "createdAt");
