import { AppShell } from "@/app/components/AppShell";
import { ScoreEntry } from "@/app/results/ScoreEntry";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  const session = await getServerSession();
  if (session?.role === "player") {
    redirect(`/players?playerId=${session.playerId}`);
  }

  const games = await prisma.game.findMany({
    where: { status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
    include: {
      table: true,
      players: {
        orderBy: { seat: "asc" },
        include: { player: true },
      },
    },
  });

  return (
    <AppShell>
      <section className="page-title">
        <div>
          <h1>各卓成績入力</h1>
          <p>対局中の卓を選び、最終点数を入力して結果を確定します。</p>
        </div>
      </section>
      <ScoreEntry
        games={games.map((game) => ({
          id: game.id,
          tableNumber: game.table.tableNumber,
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
