-- AlterTable
ALTER TABLE "RetentionStage" ADD COLUMN     "activeHoursEnd" INTEGER,
ADD COLUMN     "activeHoursStart" INTEGER,
ADD COLUMN     "conditionGenerations" INTEGER,
ADD COLUMN     "conditionPaymentPresent" BOOLEAN,
ADD COLUMN     "creditPackageId" TEXT,
ADD COLUMN     "hoursSinceFirstPayment" INTEGER,
ADD COLUMN     "isRandomGenerationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSpecialOffer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "randomGenerationLabel" TEXT,
ADD COLUMN     "specialOfferLabel" TEXT;

-- AddForeignKey
ALTER TABLE "RetentionStage" ADD CONSTRAINT "RetentionStage_creditPackageId_fkey" FOREIGN KEY ("creditPackageId") REFERENCES "CreditPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
