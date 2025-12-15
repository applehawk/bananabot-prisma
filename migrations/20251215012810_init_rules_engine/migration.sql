/*
  Warnings:

  - You are about to drop the column `createdAt` on the `UserOverlay` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `UserOverlay` table. All the data in the column will be lost.
  - Changed the type of `state` on the `UserOverlay` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "OverlayState" AS ENUM ('ELIGIBLE', 'ACTIVE', 'EXPIRING', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RuleTrigger" AS ENUM ('BOT_START', 'GENERATION_REQUESTED', 'GENERATION_COMPLETED', 'CREDITS_CHANGED', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED', 'TIME', 'ADMIN_EVENT', 'OVERLAY_ACTIVATED', 'OVERLAY_EXPIRED');

-- CreateEnum
CREATE TYPE "RuleActionType" AS ENUM ('ACTIVATE_OVERLAY', 'DEACTIVATE_OVERLAY', 'SEND_MESSAGE', 'SEND_SPECIAL_OFFER', 'GRANT_BONUS', 'NO_ACTION');

-- CreateEnum
CREATE TYPE "RuleConditionOperator" AS ENUM ('EQUALS', 'NOT_EQUALS', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'NOT_IN', 'EXISTS', 'NOT_EXISTS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FSMEvent" ADD VALUE 'USER_BLOCKED';
ALTER TYPE "FSMEvent" ADD VALUE 'USER_UNBLOCKED';
ALTER TYPE "FSMEvent" ADD VALUE 'GENERATION_COMPLETED';

-- AlterTable
ALTER TABLE "UserOverlay" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "credits" INTEGER,
ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
DROP COLUMN "state",
ADD COLUMN     "state" "OverlayState" NOT NULL;

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "trigger" "RuleTrigger" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleCondition" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "operator" "RuleConditionOperator" NOT NULL,
    "value" TEXT,
    "groupId" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RuleCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleAction" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "type" "RuleActionType" NOT NULL,
    "params" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RuleAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rule_code_key" ON "Rule"("code");

-- CreateIndex
CREATE INDEX "RuleCondition_ruleId_groupId_idx" ON "RuleCondition"("ruleId", "groupId");

-- CreateIndex
CREATE INDEX "RuleAction_ruleId_order_idx" ON "RuleAction"("ruleId", "order");

-- CreateIndex
CREATE INDEX "UserOverlay_state_expiresAt_idx" ON "UserOverlay"("state", "expiresAt");

-- AddForeignKey
ALTER TABLE "RuleCondition" ADD CONSTRAINT "RuleCondition_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleAction" ADD CONSTRAINT "RuleAction_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
