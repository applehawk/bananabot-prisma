-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FSMActionType" ADD VALUE 'LOG_EVENT';
ALTER TYPE "FSMActionType" ADD VALUE 'RESET_COUNTER';
ALTER TYPE "FSMActionType" ADD VALUE 'SYNC_ANALYTICS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RuleTrigger" ADD VALUE 'STATE_CHANGED';
ALTER TYPE "RuleTrigger" ADD VALUE 'CHANNEL_SUBSCRIPTION';

-- AlterTable
ALTER TABLE "RuleAction" ADD COLUMN     "allowedTimeWindow" TEXT,
ADD COLUMN     "delaySeconds" INTEGER;

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- CreateTable
CREATE TABLE "ScheduledRuleAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleActionId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "params" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "ScheduledRuleAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledRuleAction_status_scheduledAt_idx" ON "ScheduledRuleAction"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "ScheduledRuleAction_userId_idx" ON "ScheduledRuleAction"("userId");

-- AddForeignKey
ALTER TABLE "ScheduledRuleAction" ADD CONSTRAINT "ScheduledRuleAction_ruleActionId_fkey" FOREIGN KEY ("ruleActionId") REFERENCES "RuleAction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
