-- AlterTable
ALTER TABLE "Player" ADD COLUMN "managementNumber" TEXT;
ALTER TABLE "Player" ADD COLUMN "isCheckedIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Player" ADD COLUMN "checkedInAt" TIMESTAMP(3);
ALTER TABLE "Player" ADD COLUMN "checkedOutAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Player_storeId_managementNumber_key" ON "Player"("storeId", "managementNumber");

-- CreateIndex
CREATE INDEX "Player_storeId_isCheckedIn_idx" ON "Player"("storeId", "isCheckedIn");
