import { AppShell } from "@/app/components/AppShell";
import { ScoreEntry } from "@/app/results/ScoreEntry";
import { prisma } from "@/lib/prisma";
import { requireStoreAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  const user = await requireStoreAdmin();

  const games = await prisma.game.findMany({
    where: { storeId: user.storeId, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      category: true,
      tournament: { select: { name: true } },
      table: { select: { tableNumber: true, defaultCategory: true, currentTournament: { select: { name: true } } } },
      players: {
        orderBy: { seat: "asc" },
        select: {
          seat: true,
          currentPoints: true,
          player: { select: { id: true, name: true } },
        },
      },
    },
  });

  return (
    <AppShell user={user}>
      <section className="page-title">
        <div>
          <h1>各卓成績入力</h1>
          <p>卓管理で設定した通常卓・大会卓に合わせて結果を確定します。</p>
        </div>
      </section>
      <ScoreEntry
        games={games.map((game) => ({
          id: game.id,
          tableNumber: game.table.tableNumber,
          category: game.category ?? game.table.defaultCategory,
          tournamentName: game.tournament?.name ?? game.table.currentTournament?.name ?? null,
          players: game.players.map((gamePlayer) => ({
            id: gamePlayer.player.id,
            name: gamePlayer.player.name,
            seat: gamePlayer.seat,
            currentPoints: gamePlayer.currentPoints,
          })),
        }))}
      />
    </AppShell>
  );
}
