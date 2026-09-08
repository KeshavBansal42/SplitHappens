-- CreateEnum
CREATE TYPE "SplitStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'RELEASED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "privyUserId" TEXT NOT NULL,
    "walletAddress" TEXT,
    "verifiedHuman" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "splits" (
    "id" BIGSERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "totalAmount" DECIMAL(36,6) NOT NULL,
    "payeeAddress" TEXT NOT NULL,
    "requireVerification" BOOLEAN NOT NULL DEFAULT false,
    "status" "SplitStatus" NOT NULL DEFAULT 'PENDING',
    "releaseTxHash" TEXT,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "split_participants" (
    "id" TEXT NOT NULL,
    "splitId" BIGINT NOT NULL,
    "userId" TEXT NOT NULL,
    "shareAmount" DECIMAL(36,6) NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "txHash" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "split_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_privyUserId_key" ON "users"("privyUserId");

-- CreateIndex
CREATE INDEX "split_participants_splitId_idx" ON "split_participants"("splitId");

-- CreateIndex
CREATE UNIQUE INDEX "split_participants_splitId_userId_key" ON "split_participants"("splitId", "userId");

-- AddForeignKey
ALTER TABLE "split_participants" ADD CONSTRAINT "split_participants_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "splits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_participants" ADD CONSTRAINT "split_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
