import { GameCategory } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/app/components/AppShell";
import { prisma } from "@/lib/prisma";
import { buildRating } from "@/lib/rating";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type RankingMode = "regular" | "tournament";

function round(value: number, digits = 1) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function resolveMode(value: string | string[] | undefined): RankingMode {
  const mode = Array.isArray(value) ? value[0] : value;
  return mode === "tournament" ? "tournament" : "regular";
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const user = await requireUser();
  if (user.role === "SUPER_ADMIN") redirect("/super");

  const mode = resolveMode((await searchParams).mode);
  const players = await prisma.player.findMany({
    where: {
      storeId: user.storeId,
      OR: [{ managementNumber: null }, { managementNumber: { not: { startsWith: "__staff_" } } }],
    },
    orderBy: [{ managementNumber: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      managementNumber: true,
      gamePlayers: {
        where: {
          game: {
            status: "FINISHED",
            category: mode === "tournament" ? GameCategory.TOURNAMENT : GameCategory.REGULAR,
          },
          rank: { not: null },
          score: { not: null },
        },
        select: { rank: true, score: true },
      },
    },
  });

  const rankings = players
    .map((player) => {
      const gameCount = player.gamePlayers.length;
      const totalRank = player.gamePlayers.reduce((sum, record) => sum + (record.rank ?? 0), 0);
      const totalScore = player.gamePlayers.reduce((sum, record) => sum + (record.score ?? 0), 0);
      const topCount = player.gamePlayers.filter((record) => record.rank === 1).length;
      const lastCount = player.gamePlayers.filter((record) => record.rank === 4).length;
      const summary = {
        gameCount,
        averageRank: gameCount ? round(totalRank / gameCount, 2) : 0,
        topRate: gameCount ? round((topCount / gameCount) * 100, 1) : 0,
        lastRate: gameCount ? round((lastCount / gameCount) * 100, 1) : 0,
        totalScore: round(totalScore, 1),
      };

      return {
        id: player.id,
        name: player.name,
        managementNumber: player.managementNumber,
        ...summary,
        ...buildRating(summary),
      };
    })
    .sort((a, b) => b.jankiPoint - a.jankiPoint || b.totalScore - a.totalScore)
    .map((player, index) => ({ ...player, rank: index + 1 }));

  return (
    <AppShell user={user}>
      <section className="page-title">
        <div>
          <h1>ランキング</h1>
          <p>同じ雀荘の通常ランキングと大会ランキングを確認します。</p>
        </div>
        <div className="segment-control compact-segment" role="group" aria-label="ランキング表示">
          <Link className={mode === "regular" ? "active" : ""} href="/rankings">
            通常
          </Link>
          <Link className={mode === "tournament" ? "active" : ""} href="/rankings?mode=tournament">
            大会
          </Link>
        </div>
      </section>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>順位</th>
                <th>プレイヤー</th>
                <th>段位</th>
                <th>雀力P</th>
                <th>半荘数</th>
                <th>平均順位</th>
                <th>トップ率</th>
                <th>ラス率</th>
                <th>累計スコア</th>
              </tr>
            </thead>
            <tbody>
              {rankings.length ? (
                rankings.map((player) => (
                  <tr key={player.id} className={player.id === user.playerId ? "highlight-row" : ""}>
                    <td>{player.rank}位</td>
                    <td>{player.managementNumber ? `${player.managementNumber} / ${player.name}` : player.name}</td>
                    <td>{player.dan}</td>
                    <td>{player.jankiPoint.toLocaleString()}</td>
                    <td>{player.gameCount}</td>
                    <td>{player.averageRank.toFixed(2)}</td>
                    <td>{player.topRate.toFixed(1)}%</td>
                    <td>{player.lastRate.toFixed(1)}%</td>
                    <td>{player.totalScore.toFixed(1)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="muted">
                    まだランキング対象の成績がありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
