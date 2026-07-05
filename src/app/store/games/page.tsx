import { AppShell } from "@/app/components/AppShell";
import { GameCorrectionClient } from "@/app/store/games/GameCorrectionClient";
import { prisma } from "@/lib/prisma";
import { requireStoreAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function StoreGamesPage() {
  const user = await requireStoreAdmin();
  const [games, scoreSettings] = await Promise.all([
    prisma.game.findMany({
      where: { storeId: user.storeId, status: "FINISHED" },
      orderBy: { finishedAt: "desc" },
      take: 100,
      select: {
        id: true,
        category: true,
        finishedAt: true,
        tournament: { select: { name: true } },
        table: { select: { tableNumber: true } },
        players: {
          orderBy: { seat: "asc" },
          select: {
            seat: true,
            finalPoints: true,
            player: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.store.findUniqueOrThrow({
      where: { id: user.storeId },
      select: {
        startingPoint: true,
        returnPoint: true,
        firstPlaceBonus: true,
        secondPlaceBonus: true,
        thirdPlaceBonus: true,
        fourthPlaceBonus: true,
      },
    }),
  ]);

  return (
    <AppShell user={user}>
      <section className="page-title">
        <div>
          <h1>成績入力履歴の修正</h1>
          <p>確定済み半荘の点数を修正し、順位とスコアを再計算します。</p>
        </div>
      </section>
      <GameCorrectionClient
        scoreSettings={scoreSettings}
        games={games.map((game) => ({
          id: game.id,
          tableNumber: game.table.tableNumber,
          category: game.category,
          tournamentName: game.tournament?.name ?? null,
          finishedAt: game.finishedAt?.toISOString() ?? null,
          players: game.players.map((gamePlayer) => ({
            id: gamePlayer.player.id,
            name: gamePlayer.player.name,
            seat: gamePlayer.seat,
            finalPoints: gamePlayer.finalPoints,
          })),
        }))}
      />
    </AppShell>
  );
}
