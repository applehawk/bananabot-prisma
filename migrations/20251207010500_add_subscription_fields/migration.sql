-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSubscribed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "isSubscriptionRequired" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "isSubscriptionRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "telegramChannelId" TEXT;

-- AlterTable
ALTER TABLE "Broadcast" ADD COLUMN     "targetNotSubscribed" BOOLEAN NOT NULL DEFAULT false;
