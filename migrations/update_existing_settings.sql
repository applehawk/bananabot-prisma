-- Update existing UserSettings records with default geminiModel value
-- This migration adds the geminiModel field to all existing UserSettings
UPDATE "UserSettings"
SET "geminiModel" = 'gemini-2.5-flash-image'
WHERE "geminiModel" IS NULL OR "geminiModel" = '';
