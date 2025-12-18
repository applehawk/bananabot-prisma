-- AlterTable
ALTER TABLE "FSMState" ADD COLUMN     "group" TEXT DEFAULT 'General';

-- AlterTable
ALTER TABLE "Rule" ADD COLUMN     "group" TEXT DEFAULT 'General';
