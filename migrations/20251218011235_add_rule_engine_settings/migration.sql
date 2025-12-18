-- CreateEnum
CREATE TYPE "RuleEngineMode" AS ENUM ('ALL', 'NEW_USERS_ONLY', 'OLD_USERS_ONLY', 'SELECTED_USERS_ONLY');

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "ruleEngineEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ruleEngineMode" "RuleEngineMode" NOT NULL DEFAULT 'ALL',
ADD COLUMN     "ruleEngineReferenceDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isRuleEngineEnabled" BOOLEAN NOT NULL DEFAULT true;
