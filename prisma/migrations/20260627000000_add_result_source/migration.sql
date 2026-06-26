-- CreateEnum
CREATE TYPE "ResultSource" AS ENUM ('MANUAL', 'IMAGE_RECOGNITION');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN "resultSource" "ResultSource";
ALTER TABLE "Game" ADD COLUMN "resultPayload" JSONB;
