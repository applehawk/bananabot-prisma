/*
  Warnings:

  - You are about to drop the column `geminiModelId` on the `UserSettings` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "UserSettings" DROP CONSTRAINT "UserSettings_geminiModelId_fkey";

-- AlterTable
ALTER TABLE "UserSettings" DROP COLUMN "geminiModelId",
ADD COLUMN     "selectedModelId" TEXT NOT NULL DEFAULT 'gemini-2.5-flash-image';

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_selectedModelId_fkey" FOREIGN KEY ("selectedModelId") REFERENCES "ModelTariff"("modelId") ON DELETE RESTRICT ON UPDATE CASCADE;
