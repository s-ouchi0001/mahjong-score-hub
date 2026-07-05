import { AppShell } from "@/app/components/AppShell";
import { ScoreCaptureClient } from "@/app/score-capture/ScoreCaptureClient";
import { prisma } from "@/lib/prisma";
import { requireStoreAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ScoreCapturePage() {
  const user = await requireStoreAdmin();

  const games = await prisma.game.findMany({
    where: { storeId: user.storeId, status: "ACTIVE" },
    orderBy: [{ table: { tableNumber: "asc" } }, { startedAt: "desc" }],
    select: {
      id: true,
      startedAt: true,
      table: {
        select: {
          tableNumber: true,
          deviceId: true,
        },
      },
      players: {
        orderBy: { seat: "asc" },
        select: {
          seat: true,
          currentPoints: true,
          player: {
            select: {
              id: true,
              name: true,
              managementNumber: true,
            },
          },
        },
      },
    },
  });

  return (
    <AppShell user={user}>
      <section className="page-title">
        <div>
          <h1>卓成績取得</h1>
          <p>点数取得、手直し、成績確定を1画面で行います。</p>
        </div>
      </section>

      <ScoreCaptureClient
        games={games.map((game) => ({
          id: game.id,
          tableNumber: game.table.tableNumber,
          deviceId: game.table.deviceId,
          startedAt: game.startedAt.toISOString(),
          players: game.players.map((gamePlayer) => ({
            id: gamePlayer.player.id,
            name: gamePlayer.player.name,
            managementNumber: gamePlayer.player.managementNumber,
            seat: gamePlayer.seat,
            currentPoints: gamePlayer.currentPoints,
          })),
        }))}
      />
    </AppShell>
  );
}
