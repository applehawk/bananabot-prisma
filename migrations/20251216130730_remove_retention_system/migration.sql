/*
  Warnings:

  - You are about to drop the column `lastRetentionMessageAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `retentionStage` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `RetentionStage` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RetentionStage" DROP CONSTRAINT "RetentionStage_burnableBonusId_fkey";

-- DropForeignKey
ALTER TABLE "RetentionStage" DROP CONSTRAINT "RetentionStage_creditPackageId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "lastRetentionMessageAt",
DROP COLUMN "retentionStage";

-- DropTable
DROP TABLE "RetentionStage";
