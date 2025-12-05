-- AlterTable
ALTER TABLE "Generation" ADD COLUMN     "costDetails" JSONB,
ADD COLUMN     "inputTokens" INTEGER,
ADD COLUMN     "modelId" TEXT,
ADD COLUMN     "outputTokens" INTEGER,
ADD COLUMN     "totalCostUsd" DOUBLE PRECISION,
ADD COLUMN     "totalTokens" INTEGER;

-- CreateIndex
CREATE INDEX "Generation_modelId_idx" ON "Generation"("modelId");

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ModelTariff"("modelId") ON DELETE SET NULL ON UPDATE CASCADE;
