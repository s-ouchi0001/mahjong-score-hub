-- CreateIndex
CREATE INDEX "tables_storeId_status_idx" ON "tables"("storeId", "status");

-- CreateIndex
CREATE INDEX "Player_storeId_idx" ON "Player"("storeId");

-- CreateIndex
CREATE INDEX "AppUser_storeId_role_idx" ON "AppUser"("storeId", "role");

-- CreateIndex
CREATE INDEX "AppUser_playerId_idx" ON "AppUser"("playerId");

-- CreateIndex
CREATE INDEX "Game_storeId_status_startedAt_idx" ON "Game"("storeId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "Game_tableId_status_idx" ON "Game"("tableId", "status");

-- CreateIndex
CREATE INDEX "GamePlayer_playerId_idx" ON "GamePlayer"("playerId");

-- CreateIndex
CREATE INDEX "GamePlayer_rank_idx" ON "GamePlayer"("rank");

-- CreateIndex
CREATE INDEX "PointSnapshot_tableId_createdAt_idx" ON "PointSnapshot"("tableId", "createdAt");

-- CreateIndex
CREATE INDEX "PointSnapshot_gameId_idx" ON "PointSnapshot"("gameId");
