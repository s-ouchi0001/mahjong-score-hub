import Link from "next/link";
import { AppShell } from "@/app/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PlayerSummary = {
  id: string;
  name: string;
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
  const session = await getServerSession();
  if (session?.role === "player") {
    redirect(`/players?playerId=${session.playerId}`);
  }

  const players = await prisma.player.findMany({
    orderBy: { name: "asc" },
    include: {
      gamePlayers: {
        where: {
          game: { status: "FINISHED" },
          rank: { not: null },
          score: { not: null },
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
      gameCount,
      averageRank: gameCount ? round(totalRank / gameCount, 2) : 0,
      topRate: gameCount ? round((topCount / gameCount) * 100, 1) : 0,
      lastRate: gameCount ? round((lastCount / gameCount) * 100, 1) : 0,
      averageScore: gameCount ? round(totalScore / gameCount, 1) : 0,
      totalScore: round(totalScore, 1),
    };
  });

  return (
    <AppShell>
      <section className="page-title">
        <div>
          <h1>全ユーザ成績</h1>
          <p>店舗管理者が、登録プレイヤー全員の成績を横断して確認する画面です。</p>
        </div>
      </section>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
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
