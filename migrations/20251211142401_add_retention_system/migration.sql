-- CreateEnum
CREATE TYPE "RetentionTriggerType" AS ENUM ('SINCE_REGISTRATION', 'SINCE_LAST_ACTIVITY');

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "isRetentionEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "retentionStage" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RetentionStage" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "delayHours" INTEGER NOT NULL,
    "triggerType" "RetentionTriggerType" NOT NULL DEFAULT 'SINCE_REGISTRATION',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetentionStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RetentionStage_isActive_idx" ON "RetentionStage"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionStage_order_key" ON "RetentionStage"("order");
