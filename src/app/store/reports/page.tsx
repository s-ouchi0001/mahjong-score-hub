import Link from "next/link";
import { GameCategory } from "@prisma/client";
import { AppShell } from "@/app/components/AppShell";
import { prisma } from "@/lib/prisma";
import { requireStoreAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

type ReportMode = "daily" | "monthly";

function resolveMode(value: string | string[] | undefined): ReportMode {
  const mode = Array.isArray(value) ? value[0] : value;
  return mode === "monthly" ? "monthly" : "daily";
}

function keyFor(date: Date, mode: ReportMode) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return mode === "monthly" ? `${year}/${month}` : `${year}/${month}/${day}`;
}

export default async function StoreReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const user = await requireStoreAdmin();
  const mode = resolveMode((await searchParams).mode);
  const games = await prisma.game.findMany({
    where: { storeId: user.storeId, status: "FINISHED", finishedAt: { not: null } },
    orderBy: { finishedAt: "desc" },
    take: 1000,
    select: {
      category: true,
      finishedAt: true,
      players: { select: { score: true } },
    },
  });

  const reports = Array.from(
    games.reduce((map, game) => {
      const key = keyFor(game.finishedAt ?? new Date(), mode);
      const current = map.get(key) ?? { key, gameCount: 0, playerCount: 0, tournamentCount: 0, totalScore: 0 };
      current.gameCount += 1;
      current.playerCount += game.players.length;
      current.tournamentCount += game.category === GameCategory.TOURNAMENT ? 1 : 0;
      current.totalScore += game.players.reduce((sum, player) => sum + (player.score ?? 0), 0);
      map.set(key, current);
      return map;
    }, new Map<string, { key: string; gameCount: number; playerCount: number; tournamentCount: number; totalScore: number }>()),
  ).map(([, value]) => ({ ...value, totalScore: Math.round(value.totalScore * 10) / 10 }));

  return (
    <AppShell user={user}>
      <section className="page-title">
        <div>
          <h1>営業レポート</h1>
          <p>日別・月別の半荘数と利用状況を確認します。</p>
        </div>
        <div className="segment-control compact-segment" role="group" aria-label="集計単位">
          <Link className={mode === "daily" ? "active" : ""} href="/store/reports">
            日別
          </Link>
          <Link className={mode === "monthly" ? "active" : ""} href="/store/reports?mode=monthly">
            月別
          </Link>
        </div>
      </section>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{mode === "monthly" ? "月" : "日付"}</th>
                <th>半荘数</th>
                <th>延べ参加数</th>
                <th>大会半荘</th>
                <th>累計スコア</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.key}>
                  <td>{report.key}</td>
                  <td>{report.gameCount}</td>
                  <td>{report.playerCount}</td>
                  <td>{report.tournamentCount}</td>
                  <td>{report.totalScore.toFixed(1)}</td>
                </tr>
              ))}
              {!reports.length ? (
                <tr>
                  <td colSpan={5} className="muted">集計対象の成績はありません。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
