ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tables" ADD COLUMN "defaultCategory" "GameCategory" NOT NULL DEFAULT 'REGULAR';
ALTER TABLE "tables" ADD COLUMN "currentTournamentId" TEXT;
ALTER TABLE "Game" ADD COLUMN "tournamentId" TEXT;

CREATE UNIQUE INDEX "Tournament_storeId_name_key" ON "Tournament"("storeId", "name");
CREATE INDEX "Tournament_storeId_startsAt_idx" ON "Tournament"("storeId", "startsAt");
CREATE INDEX "tables_currentTournamentId_idx" ON "tables"("currentTournamentId");
CREATE INDEX "Game_tournamentId_idx" ON "Game"("tournamentId");

ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tables" ADD CONSTRAINT "tables_currentTournamentId_fkey" FOREIGN KEY ("currentTournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Game" ADD CONSTRAINT "Game_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;
