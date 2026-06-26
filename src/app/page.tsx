import { AppShell } from "@/app/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function formatTime(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

function statusLabel(status: string) {
  return status === "PLAYING" ? "対局中" : status === "FINISHED" ? "終了" : "待機";
}

export default async function DashboardPage() {
  const session = await getServerSession();
  if (session?.role === "player") {
    redirect(`/players?playerId=${session.playerId}`);
  }

  const tables = await prisma.mahjongTable.findMany({
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
  });

  return (
    <AppShell>
      <section className="page-title">
        <div>
          <h1>本部ダッシュボード</h1>
          <p>各卓の状態、参加者、現在点数、通信状態を一覧で確認します。</p>
        </div>
      </section>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>卓番号</th>
                <th>状態</th>
                <th>プレイヤー4人</th>
                <th>現在点数</th>
                <th>最終更新時刻</th>
                <th>通信状態</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => {
                const activeGame = table.games[0];
                return (
                  <tr key={table.id}>
                    <td>{table.tableNumber}卓</td>
                    <td>
                      <span className={`badge ${table.status === "PLAYING" ? "ok" : "idle"}`}>
                        {statusLabel(table.status)}
                      </span>
                    </td>
                    <td>
                      {activeGame
                        ? activeGame.players.map((gamePlayer) => gamePlayer.player.name).join(" / ")
                        : <span className="muted">未設定</span>}
                    </td>
                    <td>
                      {activeGame
                        ? activeGame.players
                            .map((gamePlayer) => `${gamePlayer.player.name}: ${gamePlayer.currentPoints.toLocaleString()}`)
                            .join(" / ")
                        : <span className="muted">-</span>}
                    </td>
                    <td>{formatTime(table.lastSeenAt)}</td>
                    <td>
                      <span className={`badge ${table.connectionStatus === "ONLINE" ? "ok" : "warn"}`}>
                        {table.connectionStatus === "ONLINE" ? "オンライン" : "オフライン"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
