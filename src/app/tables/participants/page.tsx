import { AppShell } from "@/app/components/AppShell";
import { TableParticipants } from "@/app/tables/participants/TableParticipants";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TableParticipantsPage() {
  const session = await getServerSession();
  if (session?.role === "player") {
    redirect(`/players?playerId=${session.playerId}`);
  }

  const [tables, players] = await Promise.all([
    prisma.mahjongTable.findMany({
      orderBy: { tableNumber: "asc" },
      include: {
        games: {
          where: { status: "ACTIVE" },
          take: 1,
          orderBy: { startedAt: "desc" },
          include: {
            players: {
              orderBy: { seat: "asc" },
              include: { player: true },
            },
          },
        },
      },
    }),
    prisma.player.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell>
      <section className="page-title">
        <div>
          <h1>各卓メンバー管理</h1>
          <p>卓ごとに現在打っている4人を登録します。</p>
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
        }))}
      />
    </AppShell>
  );
}
