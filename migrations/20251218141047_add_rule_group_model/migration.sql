/*
  Warnings:

  - You are about to drop the column `group` on the `Rule` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Rule" DROP COLUMN "group",
ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "RuleGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RuleGroup_name_key" ON "RuleGroup"("name");

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "RuleGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
