-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "referralBonusAmount" DOUBLE PRECISION NOT NULL DEFAULT 50,
ADD COLUMN     "referralFirstPurchaseBonus" DOUBLE PRECISION NOT NULL DEFAULT 150;
