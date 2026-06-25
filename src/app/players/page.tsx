import { AppShell } from "@/app/components/AppShell";
import { PlayerStats } from "@/app/players/PlayerStats";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const players = await prisma.player.findMany({ orderBy: { name: "asc" } });

  return (
    <AppShell>
      <section className="page-title">
        <div>
          <h1>プレイヤー成績</h1>
          <p>半荘数、平均順位、トップ率、ラス率、スコア、直近10半荘を確認します。</p>
        </div>
      </section>
      <PlayerStats players={players.map((player) => ({ id: player.id, name: player.name }))} />
    </AppShell>
  );
}
