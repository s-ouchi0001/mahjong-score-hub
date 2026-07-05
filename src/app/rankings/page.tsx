import { GameCategory } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/app/components/AppShell";
import { prisma } from "@/lib/prisma";
import { buildRating } from "@/lib/rating";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type RankingMode = "total" | "tournament";

function round(value: number, digits = 1) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function resolveMode(value: string | string[] | undefined): RankingMode {
  const mode = Array.isArray(value) ? value[0] : value;
  return mode === "tournament" ? "tournament" : "total";
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[]; tournamentId?: string | string[] }>;
}) {
  const user = await requireUser();
  if (user.role === "SUPER_ADMIN") redirect("/super");

  const params = await searchParams;
  const mode = resolveMode(params.mode);
  const selectedTournamentId = Array.isArray(params.tournamentId) ? params.tournamentId[0] : params.tournamentId;
  const tournaments = await prisma.tournament.findMany({
    where: { storeId: user.storeId },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, name: true },
  });
  const tournamentId = mode === "tournament" ? selectedTournamentId || tournaments[0]?.id || "" : "";
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
            ...(mode === "tournament" ? { category: GameCategory.TOURNAMENT, ...(tournamentId ? { tournamentId } : {}) } : {}),
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
    .sort((a, b) => (mode === "tournament" ? b.totalScore - a.totalScore : b.jankiPoint - a.jankiPoint || b.totalScore - a.totalScore))
    .map((player, index) => ({ ...player, rank: index + 1 }));

  return (
    <AppShell user={user}>
      <section className="page-title">
        <div>
          <h1>ランキング</h1>
          <p>同じ雀荘の通算ランキングと大会別ランキングを確認します。</p>
        </div>
        <div className="segment-control compact-segment" role="group" aria-label="ランキング表示">
          <Link className={mode === "total" ? "active" : ""} href="/rankings">
            通算
          </Link>
          <Link className={mode === "tournament" ? "active" : ""} href="/rankings?mode=tournament">
            大会別
          </Link>
        </div>
      </section>

      {mode === "tournament" ? (
        <section className="panel">
          <div className="list-header">
            <h2>大会選択</h2>
            <div className="segment-control compact-segment tournament-links" role="group" aria-label="大会選択">
              {tournaments.map((tournament) => (
                <Link
                  key={tournament.id}
                  className={tournament.id === tournamentId ? "active" : ""}
                  href={`/rankings?mode=tournament&tournamentId=${tournament.id}`}
                >
                  {tournament.name}
                </Link>
              ))}
              {!tournaments.length ? <span className="muted">登録済み大会はありません。</span> : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>順位</th>
                <th>プレイヤー</th>
                {mode === "total" ? <th>段位</th> : null}
                {mode === "total" ? <th>雀力P</th> : null}
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
                    {mode === "total" ? <td>{player.dan}</td> : null}
                    {mode === "total" ? <td>{player.jankiPoint.toLocaleString()}</td> : null}
                    <td>{player.gameCount}</td>
                    <td>{player.averageRank.toFixed(2)}</td>
                    <td>{player.topRate.toFixed(1)}%</td>
                    <td>{player.lastRate.toFixed(1)}%</td>
                    <td>{player.totalScore.toFixed(1)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={mode === "total" ? 9 : 7} className="muted">
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
