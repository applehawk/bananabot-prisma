/*
  Warnings:

  - You are about to drop the column `delayHours` on the `RetentionStage` table. All the data in the column will be lost.
  - You are about to drop the column `triggerType` on the `RetentionStage` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "RetentionStage" DROP COLUMN "delayHours",
DROP COLUMN "triggerType",
ADD COLUMN     "hoursSinceLastActivity" INTEGER,
ADD COLUMN     "hoursSinceLastStage" INTEGER,
ADD COLUMN     "hoursSinceRegistration" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastRetentionMessageAt" TIMESTAMP(3);

-- DropEnum
DROP TYPE "public"."RetentionTriggerType";
