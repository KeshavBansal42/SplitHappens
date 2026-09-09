-- AlterTable
ALTER TABLE "splits" ADD COLUMN     "participantCount" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email" TEXT;

-- CreateTable
CREATE TABLE "split_invites" (
    "id" TEXT NOT NULL,
    "splitId" BIGINT NOT NULL,
    "email" TEXT NOT NULL,
    "shareAmount" DECIMAL(36,6) NOT NULL,
    "claimedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "split_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "split_invites_splitId_idx" ON "split_invites"("splitId");

-- CreateIndex
CREATE UNIQUE INDEX "split_invites_splitId_email_key" ON "split_invites"("splitId", "email");

-- AddForeignKey
ALTER TABLE "split_invites" ADD CONSTRAINT "split_invites_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "splits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_invites" ADD CONSTRAINT "split_invites_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
