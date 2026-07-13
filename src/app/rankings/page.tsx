import { GameCategory } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/app/components/AppShell";
import { prisma } from "@/lib/prisma";
import { buildRating } from "@/lib/rating";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type RankingMode = "total" | "month" | "tournament";
type CategoryFilter = "all" | "regular" | "tournament";

function round(value: number, digits = 1) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function resolveMode(value: string | string[] | undefined): RankingMode {
  const mode = Array.isArray(value) ? value[0] : value;
  return mode === "tournament" || mode === "month" ? mode : "total";
}

function resolveCategory(value: string | string[] | undefined): CategoryFilter {
  const category = Array.isArray(value) ? value[0] : value;
  return category === "regular" || category === "tournament" ? category : "all";
}

function resolveMonth(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const match = raw?.match(/^(\d{4})-(\d{2})$/);
  const now = new Date();
  const year = match ? Number(match[1]) : now.getFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : now.getMonth();
  const label = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  return {
    label,
    start: new Date(year, monthIndex, 1),
    end: new Date(year, monthIndex + 1, 1),
  };
}

function hrefFor(params: { mode?: RankingMode; category?: CategoryFilter; month?: string; tournamentId?: string }) {
  const query = new URLSearchParams();
  if (params.mode && params.mode !== "total") query.set("mode", params.mode);
  if (params.category && params.category !== "all") query.set("category", params.category);
  if (params.mode === "month" && params.month) query.set("month", params.month);
  if (params.mode === "tournament" && params.tournamentId) query.set("tournamentId", params.tournamentId);
  const value = query.toString();
  return value ? `/rankings?${value}` : "/rankings";
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[]; category?: string | string[]; month?: string | string[]; tournamentId?: string | string[] }>;
}) {
  const user = await requireUser();
  if (user.role === "SUPER_ADMIN") redirect("/super");
  if (user.role === "PLAYER" && user.mustChangePassword) redirect("/change-password");

  const params = await searchParams;
  const mode = resolveMode(params.mode);
  const category = resolveCategory(params.category);
  const month = resolveMonth(params.month);
  const selectedTournamentId = Array.isArray(params.tournamentId) ? params.tournamentId[0] : params.tournamentId;
  const tournaments = await prisma.tournament.findMany({
    where: { storeId: user.storeId },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, name: true },
  });
  const tournamentId = mode === "tournament" ? selectedTournamentId || tournaments[0]?.id || "" : "";
  const gameFilter = {
    status: "FINISHED" as const,
    ...(mode === "month" ? { finishedAt: { gte: month.start, lt: month.end } } : {}),
    ...(mode === "tournament"
      ? { category: GameCategory.TOURNAMENT, ...(tournamentId ? { tournamentId } : {}) }
      : category === "regular"
        ? { category: GameCategory.REGULAR }
        : category === "tournament"
          ? { category: GameCategory.TOURNAMENT }
          : {}),
  };
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
          game: gameFilter,
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
        firstRate: gameCount ? round((player.gamePlayers.filter((record) => record.rank === 1).length / gameCount) * 100, 1) : 0,
        secondRate: gameCount ? round((player.gamePlayers.filter((record) => record.rank === 2).length / gameCount) * 100, 1) : 0,
        thirdRate: gameCount ? round((player.gamePlayers.filter((record) => record.rank === 3).length / gameCount) * 100, 1) : 0,
        fourthRate: gameCount ? round((player.gamePlayers.filter((record) => record.rank === 4).length / gameCount) * 100, 1) : 0,
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
          <p>同じ雀荘の通算ランキング、月別ランキング、大会別ランキングを確認します。</p>
        </div>
        <div className="segment-control compact-segment" role="group" aria-label="ランキング表示">
          <Link className={mode === "total" ? "active" : ""} href={hrefFor({ mode: "total", category })}>
            通算
          </Link>
          <Link className={mode === "month" ? "active" : ""} href={hrefFor({ mode: "month", category, month: month.label })}>
            月別
          </Link>
          <Link className={mode === "tournament" ? "active" : ""} href={hrefFor({ mode: "tournament", tournamentId })}>
            大会別
          </Link>
        </div>
      </section>

      {mode !== "tournament" ? (
        <section className="panel">
          <form className="ranking-filter-form" action="/rankings">
            {mode === "month" ? <input type="hidden" name="mode" value="month" /> : null}
            <div className="field">
              <label htmlFor="ranking-category">区分</label>
              <select id="ranking-category" name="category" defaultValue={category}>
                <option value="all">全て</option>
                <option value="regular">通常</option>
                <option value="tournament">大会</option>
              </select>
            </div>
            {mode === "month" ? (
              <div className="field">
                <label htmlFor="ranking-month">月</label>
                <input id="ranking-month" type="month" name="month" defaultValue={month.label} />
              </div>
            ) : null}
            <button className="button secondary" type="submit">
              表示
            </button>
          </form>
        </section>
      ) : null}

      {mode === "tournament" ? (
        <section className="panel">
          <div className="list-header">
            <h2>大会選択</h2>
            <div className="segment-control compact-segment tournament-links" role="group" aria-label="大会選択">
              {tournaments.map((tournament) => (
                <Link
                  key={tournament.id}
                  className={tournament.id === tournamentId ? "active" : ""}
                  href={hrefFor({ mode: "tournament", tournamentId: tournament.id })}
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
                <th className="score-rank-heading">累計スコア</th>
                {mode === "total" ? <th>段位</th> : null}
                {mode === "total" ? <th>雀力P</th> : null}
                <th>半荘数</th>
                <th>平均順位</th>
                <th>1着率</th>
                <th>2着率</th>
                <th>3着率</th>
                <th>4着率</th>
              </tr>
            </thead>
            <tbody>
              {rankings.length ? (
                rankings.map((player) => (
                  <tr key={player.id} className={player.id === user.playerId ? "highlight-row" : ""}>
                    <td>{player.rank}位</td>
                    <td>{player.managementNumber ? `${player.managementNumber} / ${player.name}` : player.name}</td>
                    <td className="score-rank-value">{player.totalScore.toFixed(1)}</td>
                    {mode === "total" ? <td>{player.dan}</td> : null}
                    {mode === "total" ? <td>{player.jankiPoint.toLocaleString()}</td> : null}
                    <td>{player.gameCount}</td>
                    <td>{player.averageRank.toFixed(2)}</td>
                    <td>{player.firstRate.toFixed(1)}%</td>
                    <td>{player.secondRate.toFixed(1)}%</td>
                    <td>{player.thirdRate.toFixed(1)}%</td>
                    <td>{player.fourthRate.toFixed(1)}%</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={mode === "total" ? 11 : 9} className="muted">
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
