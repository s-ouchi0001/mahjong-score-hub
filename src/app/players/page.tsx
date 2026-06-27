import { AppShell } from "@/app/components/AppShell";
import { PlayerStats } from "@/app/players/PlayerStats";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const user = await requireUser();
  const players =
    user.role === "PLAYER" && user.playerId
      ? await prisma.player.findMany({ where: { id: user.playerId }, orderBy: { name: "asc" } })
      : await prisma.player.findMany({
          where: {
            storeId: user.storeId,
            OR: [{ managementNumber: null }, { managementNumber: { not: { startsWith: "__staff_" } } }],
          },
          orderBy: { name: "asc" },
        });

  return (
    <AppShell user={user}>
      <section className="page-title">
        <div>
          <h1>プレイヤー成績</h1>
          <p>半荘数、平均順位、トップ率、ラス率、スコア、直近10半荘を確認します。</p>
        </div>
      </section>
      <PlayerStats
        lockedPlayerId={user.role === "PLAYER" ? user.playerId : null}
        players={players.map((player) => ({ id: player.id, name: player.name }))}
      />
    </AppShell>
  );
}
