-- CreateEnum
CREATE TYPE "LifecycleState" AS ENUM ('NEW', 'ACTIVATING', 'ACTIVE_FREE', 'PAYWALL', 'PAID_ACTIVE', 'INACTIVE', 'CHURNED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "OverlayType" AS ENUM ('TRIPWIRE', 'BONUS', 'REFERRAL', 'SPECIAL_OFFER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lifecycleState" "LifecycleState" NOT NULL DEFAULT 'NEW';

-- CreateTable
CREATE TABLE "UserOverlay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "OverlayType" NOT NULL,
    "state" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOverlay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserOverlay_userId_type_idx" ON "UserOverlay"("userId", "type");

-- AddForeignKey
ALTER TABLE "UserOverlay" ADD CONSTRAINT "UserOverlay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
