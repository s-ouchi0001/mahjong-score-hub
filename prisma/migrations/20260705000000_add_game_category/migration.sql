-- CreateEnum
CREATE TYPE "GameCategory" AS ENUM ('REGULAR', 'TOURNAMENT');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN "category" "GameCategory" NOT NULL DEFAULT 'REGULAR';

-- CreateIndex
CREATE INDEX "Game_storeId_category_status_startedAt_idx" ON "Game"("storeId", "category", "status", "startedAt");
