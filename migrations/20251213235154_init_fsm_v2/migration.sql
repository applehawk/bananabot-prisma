-- CreateEnum
CREATE TYPE "FSMTriggerType" AS ENUM ('EVENT', 'TIME');

-- CreateEnum
CREATE TYPE "FSMEvent" AS ENUM ('BOT_START', 'FIRST_GENERATION', 'GENERATION', 'GENERATION_PENDING', 'GENERATION_FAILED', 'PAYMENT_CLICKED', 'PAYMENT_PENDING', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'CREDITS_CHANGED', 'CREDITS_ZERO', 'TIMEOUT', 'REFERRAL_INVITE', 'REFERRAL_PAID');

-- CreateEnum
CREATE TYPE "FSMActionType" AS ENUM ('SEND_MESSAGE', 'SEND_SPECIAL_OFFER', 'GRANT_BURNABLE_BONUS', 'SHOW_TRIPWIRE', 'ENABLE_REFERRAL', 'SWITCH_MODEL_HINT', 'TAG_USER', 'NO_ACTION');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "FSMVersion" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FSMVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FSMState" (
    "id" TEXT NOT NULL,
    "versionId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isInitial" BOOLEAN NOT NULL DEFAULT false,
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,
    "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FSMState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FSMTransition" (
    "id" TEXT NOT NULL,
    "versionId" INTEGER NOT NULL,
    "fromStateId" TEXT NOT NULL,
    "toStateId" TEXT NOT NULL,
    "triggerType" "FSMTriggerType" NOT NULL DEFAULT 'EVENT',
    "triggerEvent" "FSMEvent",
    "timeFrom" TEXT,
    "timeoutMinutes" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FSMTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FSMCondition" (
    "id" TEXT NOT NULL,
    "transitionId" TEXT NOT NULL,
    "groupId" INTEGER NOT NULL DEFAULT 0,
    "field" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FSMCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FSMAction" (
    "id" TEXT NOT NULL,
    "transitionId" TEXT NOT NULL,
    "type" "FSMActionType" NOT NULL,
    "config" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FSMAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFSMState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "versionId" INTEGER NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "context" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFSMState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFSMHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromStateId" TEXT,
    "toStateId" TEXT NOT NULL,
    "triggerEvent" "FSMEvent",
    "transitionId" TEXT,
    "actionsTaken" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFSMHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FSMStateMetric" (
    "stateId" TEXT NOT NULL,
    "usersCount" INTEGER NOT NULL,
    "avgTimeSeconds" INTEGER NOT NULL,
    "p90TimeSeconds" INTEGER NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FSMStateMetric_pkey" PRIMARY KEY ("stateId","calculatedAt")
);

-- CreateIndex
CREATE UNIQUE INDEX "FSMState_versionId_name_key" ON "FSMState"("versionId", "name");

-- CreateIndex
CREATE INDEX "FSMTransition_fromStateId_idx" ON "FSMTransition"("fromStateId");

-- CreateIndex
CREATE INDEX "FSMTransition_triggerEvent_idx" ON "FSMTransition"("triggerEvent");

-- CreateIndex
CREATE UNIQUE INDEX "UserFSMState_userId_key" ON "UserFSMState"("userId");

-- CreateIndex
CREATE INDEX "UserFSMState_stateId_idx" ON "UserFSMState"("stateId");

-- CreateIndex
CREATE INDEX "UserFSMState_lastCheckedAt_idx" ON "UserFSMState"("lastCheckedAt");

-- CreateIndex
CREATE INDEX "UserFSMHistory_userId_idx" ON "UserFSMHistory"("userId");

-- CreateIndex
CREATE INDEX "UserFSMHistory_createdAt_idx" ON "UserFSMHistory"("createdAt");

-- CreateIndex
CREATE INDEX "UserFSMHistory_toStateId_idx" ON "UserFSMHistory"("toStateId");

-- AddForeignKey
ALTER TABLE "FSMState" ADD CONSTRAINT "FSMState_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "FSMVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FSMTransition" ADD CONSTRAINT "FSMTransition_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "FSMVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FSMTransition" ADD CONSTRAINT "FSMTransition_fromStateId_fkey" FOREIGN KEY ("fromStateId") REFERENCES "FSMState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FSMTransition" ADD CONSTRAINT "FSMTransition_toStateId_fkey" FOREIGN KEY ("toStateId") REFERENCES "FSMState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FSMCondition" ADD CONSTRAINT "FSMCondition_transitionId_fkey" FOREIGN KEY ("transitionId") REFERENCES "FSMTransition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FSMAction" ADD CONSTRAINT "FSMAction_transitionId_fkey" FOREIGN KEY ("transitionId") REFERENCES "FSMTransition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFSMState" ADD CONSTRAINT "UserFSMState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFSMState" ADD CONSTRAINT "UserFSMState_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "FSMState"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFSMHistory" ADD CONSTRAINT "UserFSMHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
