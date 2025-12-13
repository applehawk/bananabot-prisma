-- CreateEnum
CREATE TYPE "BurnableBonusStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'REVOKED');

-- AlterTable
ALTER TABLE "AdminMessage" ADD COLUMN     "burnableBonusId" TEXT;

-- AlterTable
ALTER TABLE "Broadcast" ADD COLUMN     "burnableBonusId" TEXT;

-- AlterTable
ALTER TABLE "RetentionStage" ADD COLUMN     "burnableBonusId" TEXT;

-- CreateTable
CREATE TABLE "BurnableBonus" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "expiresInHours" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "conditionGenerations" INTEGER DEFAULT 1,
    "conditionTopUpAmount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BurnableBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBurnableBonus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "generationsRequired" INTEGER,
    "topUpAmountRequired" DOUBLE PRECISION,
    "generationsMade" INTEGER NOT NULL DEFAULT 0,
    "topUpMade" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "BurnableBonusStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBurnableBonus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserBurnableBonus_userId_idx" ON "UserBurnableBonus"("userId");

-- CreateIndex
CREATE INDEX "UserBurnableBonus_status_idx" ON "UserBurnableBonus"("status");

-- CreateIndex
CREATE INDEX "UserBurnableBonus_deadline_idx" ON "UserBurnableBonus"("deadline");

-- AddForeignKey
ALTER TABLE "AdminMessage" ADD CONSTRAINT "AdminMessage_burnableBonusId_fkey" FOREIGN KEY ("burnableBonusId") REFERENCES "BurnableBonus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_burnableBonusId_fkey" FOREIGN KEY ("burnableBonusId") REFERENCES "BurnableBonus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionStage" ADD CONSTRAINT "RetentionStage_burnableBonusId_fkey" FOREIGN KEY ("burnableBonusId") REFERENCES "BurnableBonus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBurnableBonus" ADD CONSTRAINT "UserBurnableBonus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
