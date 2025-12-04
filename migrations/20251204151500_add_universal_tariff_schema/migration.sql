-- CreateEnum
CREATE TYPE "AuthType" AS ENUM ('API_KEY', 'BEARER_TOKEN', 'X_API_KEY', 'GOOGLE_OAUTH', 'NONE');

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "password" TEXT,
ALTER COLUMN "telegramId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "personalMargin" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "UserSettings" DROP COLUMN "geminiModel",
ADD COLUMN     "geminiModelId" TEXT NOT NULL DEFAULT 'gemini-2.5-flash-image';

-- CreateTable
CREATE TABLE "ModelTariff" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "description" TEXT,
    "inputPrice" DOUBLE PRECISION,
    "inputLongPrice" DOUBLE PRECISION,
    "outputPrice" DOUBLE PRECISION,
    "outputLongPrice" DOUBLE PRECISION,
    "outputImagePrice" DOUBLE PRECISION,
    "outputVideoPrice" DOUBLE PRECISION,
    "outputAudioPrice" DOUBLE PRECISION,
    "priceUnit" TEXT,
    "creditsPerSecond" DOUBLE PRECISION,
    "creditsPerGeneration" DOUBLE PRECISION,
    "creditPriceUsd" DOUBLE PRECISION,
    "imageTokensLowRes" INTEGER,
    "imageTokensHighRes" INTEGER,
    "videoTokensPerSecond" INTEGER,
    "audioTokensPerMinute" INTEGER,
    "maxTokens" INTEGER,
    "maxVideoDuration" INTEGER,
    "maxImageResolution" TEXT,
    "supportedResolutions" TEXT[],
    "hasNativeAudio" BOOLEAN NOT NULL DEFAULT false,
    "hasImageGeneration" BOOLEAN NOT NULL DEFAULT false,
    "hasVideoGeneration" BOOLEAN NOT NULL DEFAULT false,
    "modelNameOnProvider" TEXT,
    "endpoints" JSONB,
    "modelMargin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPreview" BOOLEAN NOT NULL DEFAULT false,
    "isSelfHosted" BOOLEAN NOT NULL DEFAULT false,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelTariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT,
    "authType" "AuthType" NOT NULL,
    "authHeaderName" TEXT,
    "authHeaderPrefix" TEXT,
    "authQueryParam" TEXT,
    "authTokenUrl" TEXT,
    "authScope" TEXT,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "key" TEXT NOT NULL,
    "usdRubRate" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "hostingCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "systemMargin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModelTariff_modelId_key" ON "ModelTariff"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_slug_key" ON "Provider"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSettings_key_key" ON "SystemSettings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE INDEX "AdminUser_username_idx" ON "AdminUser"("username");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_geminiModelId_fkey" FOREIGN KEY ("geminiModelId") REFERENCES "ModelTariff"("modelId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelTariff" ADD CONSTRAINT "ModelTariff_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

