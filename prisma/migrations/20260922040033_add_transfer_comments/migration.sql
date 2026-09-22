-- CreateTable
CREATE TABLE "OutletTransferComment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "transferId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutletTransferComment_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "OutletTransfer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutletTransferComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutletTransferCommentMention" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "commentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    CONSTRAINT "OutletTransferCommentMention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "OutletTransferComment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutletTransferCommentMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "OutletTransferComment_transferId_idx" ON "OutletTransferComment"("transferId");

-- CreateIndex
CREATE INDEX "OutletTransferComment_userId_idx" ON "OutletTransferComment"("userId");

-- CreateIndex
CREATE INDEX "OutletTransferComment_createdAt_idx" ON "OutletTransferComment"("createdAt");

-- CreateIndex
CREATE INDEX "OutletTransferCommentMention_commentId_idx" ON "OutletTransferCommentMention"("commentId");

-- CreateIndex
CREATE INDEX "OutletTransferCommentMention_userId_idx" ON "OutletTransferCommentMention"("userId");

-- CreateIndex
CREATE INDEX "OutletTransferCommentMention_createdAt_idx" ON "OutletTransferCommentMention"("createdAt");

-- CreateIndex
CREATE INDEX "OutletTransferCommentMention_userId_readAt_createdAt_idx" ON "OutletTransferCommentMention"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutletTransferCommentMention_commentId_userId_key" ON "OutletTransferCommentMention"("commentId", "userId");
