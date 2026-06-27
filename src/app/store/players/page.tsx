import { AppShell } from "@/app/components/AppShell";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStoreAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

type PlayerSummary = {
  id: string;
  name: string;
  managementNumber: string | null;
  gameCount: number;
  averageRank: number;
  topRate: number;
  lastRate: number;
  averageScore: number;
  totalScore: number;
};

function round(value: number, digits = 1) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export default async function StorePlayersPage() {
  const user = await requireStoreAdmin();

  const players = await prisma.player.findMany({
    where: { storeId: user.storeId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      managementNumber: true,
      gamePlayers: {
        where: {
          game: { status: "FINISHED" },
          rank: { not: null },
          score: { not: null },
        },
        select: {
          rank: true,
          score: true,
        },
      },
    },
  });

  const summaries: PlayerSummary[] = players.map((player) => {
    const records = player.gamePlayers;
    const gameCount = records.length;
    const totalRank = records.reduce((sum, record) => sum + (record.rank ?? 0), 0);
    const totalScore = records.reduce((sum, record) => sum + (record.score ?? 0), 0);
    const topCount = records.filter((record) => record.rank === 1).length;
    const lastCount = records.filter((record) => record.rank === 4).length;

    return {
      id: player.id,
      name: player.name,
      managementNumber: player.managementNumber,
      gameCount,
      averageRank: gameCount ? round(totalRank / gameCount, 2) : 0,
      topRate: gameCount ? round((topCount / gameCount) * 100, 1) : 0,
      lastRate: gameCount ? round((lastCount / gameCount) * 100, 1) : 0,
      averageScore: gameCount ? round(totalScore / gameCount, 1) : 0,
      totalScore: round(totalScore, 1),
    };
  });

  return (
    <AppShell user={user}>
      <section className="page-title">
        <div>
          <h1>ユーザ成績一覧</h1>
          <p>登録プレイヤー全員の成績を照会します。</p>
        </div>
      </section>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>管理番号</th>
                <th>プレイヤー</th>
                <th>半荘数</th>
                <th>平均順位</th>
                <th>トップ率</th>
                <th>ラス率</th>
                <th>平均スコア</th>
                <th>累計スコア</th>
                <th>本人画面</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((player) => (
                <tr key={player.id}>
                  <td>{player.managementNumber ?? "-"}</td>
                  <td>{player.name}</td>
                  <td>{player.gameCount}</td>
                  <td>{player.averageRank.toFixed(2)}</td>
                  <td>{player.topRate.toFixed(1)}%</td>
                  <td>{player.lastRate.toFixed(1)}%</td>
                  <td>{player.averageScore.toFixed(1)}</td>
                  <td>{player.totalScore.toFixed(1)}</td>
                  <td>
                    <Link className="text-link" href={`/players?playerId=${player.id}`}>
                      開く
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
