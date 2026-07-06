import Link from "next/link";
import { GameCategory, GameStatus, UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { AppShell } from "@/app/components/AppShell";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ storeId: string }>;
};

function formatDateTime(value: Date | null) {
  return value ? value.toLocaleString("ja-JP") : "-";
}

export default async function SuperStoreDetailPage({ params }: Params) {
  const user = await requireSuperAdmin();
  const { storeId } = await params;

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: {
      tables: {
        orderBy: { tableNumber: "asc" },
        include: { currentTournament: { select: { name: true } } },
      },
      tournaments: {
        orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
        include: { _count: { select: { games: true } } },
      },
    },
  });

  if (!store) notFound();

  const [playerCount, checkedInCount, staffUsers, finishedGameCount, tournamentGameCount, latestGames] = await Promise.all([
    prisma.player.count({
      where: {
        storeId,
        OR: [{ managementNumber: null }, { managementNumber: { not: { startsWith: "__staff_" } } }],
      },
    }),
    prisma.player.count({ where: { storeId, isCheckedIn: true } }),
    prisma.appUser.findMany({
      where: { storeId, role: UserRole.STORE_ADMIN },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, name: true, createdAt: true },
    }),
    prisma.game.count({ where: { storeId, status: GameStatus.FINISHED } }),
    prisma.game.count({ where: { storeId, status: GameStatus.FINISHED, category: GameCategory.TOURNAMENT } }),
    prisma.game.findMany({
      where: { storeId, status: GameStatus.FINISHED },
      orderBy: { finishedAt: "desc" },
      take: 10,
      select: {
        id: true,
        category: true,
        finishedAt: true,
        tournament: { select: { name: true } },
        table: { select: { tableNumber: true } },
        players: {
          orderBy: { seat: "asc" },
          select: {
            rank: true,
            score: true,
            player: { select: { name: true, managementNumber: true } },
          },
        },
      },
    }),
  ]);

  return (
    <AppShell user={user}>
      <section className="page-title">
        <div>
          <h1>店舗詳細</h1>
          <p>
            {store.name} の利用状況を確認します。店舗ID: {store.storeCode}
          </p>
        </div>
        <Link className="button secondary" href="/super">
          全体管理へ戻る
        </Link>
      </section>

      <section className="panel">
        <div className="store-detail-grid">
          <div>
            <span className="muted">店舗名</span>
            <strong>{store.name}</strong>
          </div>
          <div>
            <span className="muted">店舗ID</span>
            <strong>{store.storeCode}</strong>
          </div>
          <div>
            <span className="muted">卓数</span>
            <strong>{store.tables.length}</strong>
          </div>
          <div>
            <span className="muted">ユーザ数</span>
            <strong>{playerCount}</strong>
          </div>
          <div>
            <span className="muted">入場中</span>
            <strong>{checkedInCount}</strong>
          </div>
          <div>
            <span className="muted">半荘数</span>
            <strong>{finishedGameCount}</strong>
          </div>
          <div>
            <span className="muted">大会半荘</span>
            <strong>{tournamentGameCount}</strong>
          </div>
          <div>
            <span className="muted">スタッフ</span>
            <strong>{staffUsers.length}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>卓一覧</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>卓番号</th>
                <th>状態</th>
                <th>通信</th>
                <th>通常/大会</th>
                <th>大会名</th>
                <th>端末ID</th>
                <th>最終通信</th>
              </tr>
            </thead>
            <tbody>
              {store.tables.map((table) => (
                <tr key={table.id}>
                  <td>{table.tableNumber}卓</td>
                  <td>{table.status}</td>
                  <td>{table.connectionStatus}</td>
                  <td>{table.defaultCategory === GameCategory.TOURNAMENT ? "大会卓" : "通常卓"}</td>
                  <td>{table.currentTournament?.name ?? "-"}</td>
                  <td>{table.deviceId}</td>
                  <td>{formatDateTime(table.lastSeenAt)}</td>
                </tr>
              ))}
              {!store.tables.length ? (
                <tr>
                  <td colSpan={7} className="muted">
                    卓はまだ登録されていません。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>スタッフアカウント</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>名前</th>
                <th>ログインID</th>
                <th>作成日</th>
              </tr>
            </thead>
            <tbody>
              {staffUsers.map((staff) => (
                <tr key={staff.id}>
                  <td>{staff.name}</td>
                  <td>{staff.email}</td>
                  <td>{formatDateTime(staff.createdAt)}</td>
                </tr>
              ))}
              {!staffUsers.length ? (
                <tr>
                  <td colSpan={3} className="muted">
                    スタッフアカウントはまだありません。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>大会一覧</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>大会名</th>
                <th>開催日</th>
                <th>半荘数</th>
              </tr>
            </thead>
            <tbody>
              {store.tournaments.map((tournament) => (
                <tr key={tournament.id}>
                  <td>{tournament.name}</td>
                  <td>{tournament.startsAt ? tournament.startsAt.toLocaleDateString("ja-JP") : "-"}</td>
                  <td>{tournament._count.games}</td>
                </tr>
              ))}
              {!store.tournaments.length ? (
                <tr>
                  <td colSpan={3} className="muted">
                    大会はまだ登録されていません。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>直近の成績</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>日時</th>
                <th>卓</th>
                <th>区分</th>
                <th>1位</th>
                <th>トップスコア</th>
              </tr>
            </thead>
            <tbody>
              {latestGames.map((game) => {
                const topPlayer = game.players.find((player) => player.rank === 1);
                return (
                  <tr key={game.id}>
                    <td>{formatDateTime(game.finishedAt)}</td>
                    <td>{game.table.tableNumber}卓</td>
                    <td>{game.category === GameCategory.TOURNAMENT ? game.tournament?.name ?? "大会" : "通常"}</td>
                    <td>
                      {topPlayer
                        ? `${topPlayer.player.managementNumber ? `${topPlayer.player.managementNumber} / ` : ""}${topPlayer.player.name}`
                        : "-"}
                    </td>
                    <td>{topPlayer?.score?.toFixed(1) ?? "-"}</td>
                  </tr>
                );
              })}
              {!latestGames.length ? (
                <tr>
                  <td colSpan={5} className="muted">
                    成績はまだありません。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
