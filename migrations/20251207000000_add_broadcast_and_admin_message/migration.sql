-- CreateEnum Safe
DO $$ BEGIN
    CREATE TYPE "BroadcastStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;



-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adminId" TEXT,
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isBroadcast" BOOLEAN NOT NULL DEFAULT false,
    "broadcastId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "error" TEXT,

    CONSTRAINT "AdminMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Broadcast" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "BroadcastStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalUsers" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminMessage_userId_idx" ON "AdminMessage"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminMessage_sentAt_idx" ON "AdminMessage"("sentAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminMessage_broadcastId_idx" ON "AdminMessage"("broadcastId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Broadcast_status_idx" ON "Broadcast"("status");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminMessage_userId_fkey') THEN
        ALTER TABLE "AdminMessage" ADD CONSTRAINT "AdminMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminMessage_adminId_fkey') THEN
        ALTER TABLE "AdminMessage" ADD CONSTRAINT "AdminMessage_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminMessage_broadcastId_fkey') THEN
        ALTER TABLE "AdminMessage" ADD CONSTRAINT "AdminMessage_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Broadcast_createdBy_fkey') THEN
        ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
