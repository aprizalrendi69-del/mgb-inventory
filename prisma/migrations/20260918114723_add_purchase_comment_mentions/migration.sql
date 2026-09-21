-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN "jenisRekening" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "namaRekening" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "noRekening" TEXT;

-- CreateTable
CREATE TABLE "PurchaseCommentMention" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "commentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseCommentMention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "PurchaseComment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseCommentMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PurchaseCommentMention_commentId_idx" ON "PurchaseCommentMention"("commentId");

-- CreateIndex
CREATE INDEX "PurchaseCommentMention_userId_idx" ON "PurchaseCommentMention"("userId");

-- CreateIndex
CREATE INDEX "PurchaseCommentMention_createdAt_idx" ON "PurchaseCommentMention"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseCommentMention_commentId_userId_key" ON "PurchaseCommentMention"("commentId", "userId");
