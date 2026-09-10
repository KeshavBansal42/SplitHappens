-- AlterTable
ALTER TABLE "splits" ADD COLUMN     "creatorId" TEXT,
ADD COLUMN     "openTxHash" TEXT,
ADD COLUMN     "openedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "splits_creatorId_idx" ON "splits"("creatorId");

-- AddForeignKey
ALTER TABLE "splits" ADD CONSTRAINT "splits_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
