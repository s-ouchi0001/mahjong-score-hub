import { AppShell } from "@/app/components/AppShell";
import { TableParticipants } from "@/app/tables/participants/TableParticipants";
import { prisma } from "@/lib/prisma";
import { requireStoreAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function TableParticipantsPage() {
  const user = await requireStoreAdmin();

  const [tables, players] = await Promise.all([
    prisma.mahjongTable.findMany({
      where: { storeId: user.storeId },
      orderBy: { tableNumber: "asc" },
      select: {
        id: true,
        tableNumber: true,
        status: true,
        games: {
          where: { status: "ACTIVE" },
          take: 1,
          orderBy: { startedAt: "desc" },
          select: {
            id: true,
            players: {
              orderBy: { seat: "asc" },
              select: {
                seat: true,
                player: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.player.findMany({
      where: { storeId: user.storeId, isCheckedIn: true },
      orderBy: [{ managementNumber: "asc" }, { name: "asc" }],
      select: { id: true, name: true, managementNumber: true },
    }),
  ]);

  return (
    <AppShell user={user}>
      <section className="page-title">
        <div>
          <h1>卓管理</h1>
          <p>卓ごとの着席メンバーを登録・変更し、未着席の入場中ユーザを確認します。</p>
        </div>
      </section>
      <TableParticipants
        tables={tables.map((table) => ({
          id: table.id,
          tableNumber: table.tableNumber,
          status: table.status,
          activeGame: table.games[0]
            ? {
                id: table.games[0].id,
                players: table.games[0].players.map((gamePlayer) => ({
                  id: gamePlayer.player.id,
                  name: gamePlayer.player.name,
                  seat: gamePlayer.seat,
                })),
              }
            : null,
        }))}
        players={players.map((player) => ({
          id: player.id,
          name: player.name,
          managementNumber: player.managementNumber,
        }))}
      />
    </AppShell>
  );
}
