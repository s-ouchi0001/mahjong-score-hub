import { redirect } from "next/navigation";
import { AppShell } from "@/app/components/AppShell";
import { PlayerStats } from "@/app/players/PlayerStats";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const user = await requireUser();
  if (user.role === "SUPER_ADMIN") redirect("/super");
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
  const tournaments = await prisma.tournament.findMany({
    where: { storeId: user.storeId },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, name: true },
  });

  return (
    <AppShell user={user}>
      <section className="page-title">
        <div>
          <h1>プレイヤー成績</h1>
          <p>通算成績、直近10半荘、大会成績を切り替えて確認します。</p>
        </div>
      </section>
      <PlayerStats
        lockedPlayerId={user.role === "PLAYER" ? user.playerId : null}
        players={players.map((player) => ({ id: player.id, name: player.name }))}
        tournaments={tournaments}
      />
    </AppShell>
  );
}
