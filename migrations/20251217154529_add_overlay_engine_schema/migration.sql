/*
  Warnings:

  - The values [SEND_MESSAGE,SEND_SPECIAL_OFFER,GRANT_BONUS,NO_ACTION] on the enum `RuleActionType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `allowedTimeWindow` on the `RuleAction` table. All the data in the column will be lost.
  - You are about to drop the column `delaySeconds` on the `RuleAction` table. All the data in the column will be lost.
  - You are about to drop the `ScheduledRuleAction` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "OverlayEventType" AS ENUM ('REQUESTED', 'ACTIVATED', 'DELIVERED', 'CLICKED', 'CONVERTED', 'EXPIRED', 'DISMISSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OverlayState" ADD VALUE 'DISMISSED';
ALTER TYPE "OverlayState" ADD VALUE 'CONVERTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OverlayType" ADD VALUE 'ONBOARDING';
ALTER TYPE "OverlayType" ADD VALUE 'INFO';

-- AlterEnum
BEGIN;
CREATE TYPE "RuleActionType_new" AS ENUM ('ACTIVATE_OVERLAY', 'DEACTIVATE_OVERLAY', 'EMIT_EVENT', 'TAG_USER', 'LOG_EVENT', 'NO_OP');
ALTER TABLE "RuleAction" ALTER COLUMN "type" TYPE "RuleActionType_new" USING ("type"::text::"RuleActionType_new");
ALTER TYPE "RuleActionType" RENAME TO "RuleActionType_old";
ALTER TYPE "RuleActionType_new" RENAME TO "RuleActionType";
DROP TYPE "public"."RuleActionType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "ScheduledRuleAction" DROP CONSTRAINT "ScheduledRuleAction_ruleActionId_fkey";

-- AlterTable
ALTER TABLE "RuleAction" DROP COLUMN "allowedTimeWindow",
DROP COLUMN "delaySeconds";

-- AlterTable
ALTER TABLE "UserOverlay" ADD COLUMN     "overlayId" TEXT,
ADD COLUMN     "scheduledFor" TIMESTAMP(3),
ADD COLUMN     "variantId" TEXT;

-- DropTable
DROP TABLE "ScheduledRuleAction";

-- CreateTable
CREATE TABLE "Overlay" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "OverlayType" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ttlSeconds" INTEGER,
    "cooldownSeconds" INTEGER,
    "maxImpressions" INTEGER,
    "defaultDelaySeconds" INTEGER,
    "allowedTimeWindow" TEXT,
    "allowedLifecycleStates" "LifecycleState"[],
    "blockedByTypes" "OverlayType"[],
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Overlay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OverlayVariant" (
    "id" TEXT NOT NULL,
    "overlayId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OverlayVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OverlayEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "overlayId" TEXT NOT NULL,
    "variantId" TEXT,
    "event" "OverlayEventType" NOT NULL,
    "sourceRule" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "OverlayEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Overlay_code_key" ON "Overlay"("code");

-- AddForeignKey
ALTER TABLE "UserOverlay" ADD CONSTRAINT "UserOverlay_overlayId_fkey" FOREIGN KEY ("overlayId") REFERENCES "Overlay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOverlay" ADD CONSTRAINT "UserOverlay_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "OverlayVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OverlayVariant" ADD CONSTRAINT "OverlayVariant_overlayId_fkey" FOREIGN KEY ("overlayId") REFERENCES "Overlay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OverlayEvent" ADD CONSTRAINT "OverlayEvent_overlayId_fkey" FOREIGN KEY ("overlayId") REFERENCES "Overlay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OverlayEvent" ADD CONSTRAINT "OverlayEvent_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "OverlayVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
