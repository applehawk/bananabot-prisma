-- AlterTable
ALTER TABLE "RetentionStage" ADD COLUMN     "buttons" JSONB;

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "tripwirePackageId" TEXT;
