-- AlterTable
ALTER TABLE "UserSettings" ALTER COLUMN "enhancementPrompt" SET DEFAULT 'You are an expert at writing prompts for AI image generation.
Take this user prompt and enhance it to create a detailed, high-quality image generation prompt.
Add details about style, lighting, composition, and quality while keeping the original intent.
Return ONLY the enhanced prompt, nothing else.';
