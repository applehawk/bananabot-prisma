-- AlterTable
ALTER TABLE "Broadcast" ADD COLUMN     "creditPackageId" TEXT;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_creditPackageId_fkey" FOREIGN KEY ("creditPackageId") REFERENCES "CreditPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
