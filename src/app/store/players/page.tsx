import { AppShell } from "@/app/components/AppShell";
import { GameCategory } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buildRating } from "@/lib/rating";
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
  firstRate: number;
  secondRate: number;
  thirdRate: number;
  fourthRate: number;
  averageScore: number;
  totalScore: number;
  dan: string;
  jankiPoint: number;
};

type StatsMode = "total" | "recent" | "tournament";

function round(value: number, digits = 1) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function resolveMode(value: string | string[] | undefined): StatsMode {
  const mode = Array.isArray(value) ? value[0] : value;
  if (mode === "recent" || mode === "tournament") return mode;
  return "total";
}

function modeLabel(mode: StatsMode) {
  if (mode === "recent") return "直近成績";
  if (mode === "tournament") return "大会成績";
  return "通算成績";
}

export default async function StorePlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const user = await requireStoreAdmin();
  const mode = resolveMode((await searchParams).mode);

  const players = await prisma.player.findMany({
    where: {
      storeId: user.storeId,
      OR: [{ managementNumber: null }, { managementNumber: { not: { startsWith: "__staff_" } } }],
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      managementNumber: true,
      gamePlayers: {
        where: {
          game: {
            status: "FINISHED",
          },
          rank: { not: null },
          score: { not: null },
        },
        orderBy: {
          game: { finishedAt: "desc" },
        },
        select: {
          rank: true,
          score: true,
          game: {
            select: {
              category: true,
              finishedAt: true,
            },
          },
        },
      },
    },
  });

  const summaries: PlayerSummary[] = players.map((player) => {
    const records = mode === "recent" ? player.gamePlayers.slice(0, 10) : mode === "tournament" ? player.gamePlayers.filter((record) => record.game.category === GameCategory.TOURNAMENT) : player.gamePlayers;
    const gameCount = records.length;
    const totalRank = records.reduce((sum, record) => sum + (record.rank ?? 0), 0);
    const totalScore = records.reduce((sum, record) => sum + (record.score ?? 0), 0);
    const topCount = records.filter((record) => record.rank === 1).length;
    const lastCount = records.filter((record) => record.rank === 4).length;

    const summary = {
      id: player.id,
      name: player.name,
      managementNumber: player.managementNumber,
      gameCount,
      averageRank: gameCount ? round(totalRank / gameCount, 2) : 0,
      topRate: gameCount ? round((topCount / gameCount) * 100, 1) : 0,
      lastRate: gameCount ? round((lastCount / gameCount) * 100, 1) : 0,
      firstRate: gameCount ? round((records.filter((record) => record.rank === 1).length / gameCount) * 100, 1) : 0,
      secondRate: gameCount ? round((records.filter((record) => record.rank === 2).length / gameCount) * 100, 1) : 0,
      thirdRate: gameCount ? round((records.filter((record) => record.rank === 3).length / gameCount) * 100, 1) : 0,
      fourthRate: gameCount ? round((records.filter((record) => record.rank === 4).length / gameCount) * 100, 1) : 0,
      averageScore: gameCount ? round(totalScore / gameCount, 1) : 0,
      totalScore: round(totalScore, 1),
    };
    return {
      ...summary,
      ...buildRating({
        gameCount: player.gamePlayers.length,
        averageRank: player.gamePlayers.length ? round(player.gamePlayers.reduce((sum, record) => sum + (record.rank ?? 0), 0) / player.gamePlayers.length, 2) : 0,
        topRate: player.gamePlayers.length ? round((player.gamePlayers.filter((record) => record.rank === 1).length / player.gamePlayers.length) * 100, 1) : 0,
        lastRate: player.gamePlayers.length ? round((player.gamePlayers.filter((record) => record.rank === 4).length / player.gamePlayers.length) * 100, 1) : 0,
        totalScore: round(player.gamePlayers.reduce((sum, record) => sum + (record.score ?? 0), 0), 1),
      }),
    };
  });

  return (
    <AppShell user={user}>
      <section className="page-title">
        <div>
          <h1>ユーザ成績一覧</h1>
          <p>登録プレイヤー全員の{modeLabel(mode)}を照会します。</p>
        </div>
      </section>
      <section className="panel">
        <div className="list-header">
          <div className="segment-control compact-segment" role="group" aria-label="成績表示">
            <Link className={mode === "total" ? "active" : ""} href="/store/players">
              通算
            </Link>
            <Link className={mode === "recent" ? "active" : ""} href="/store/players?mode=recent">
              直近
            </Link>
            <Link className={mode === "tournament" ? "active" : ""} href="/store/players?mode=tournament">
              大会
            </Link>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>管理番号</th>
                <th>プレイヤー</th>
                <th>半荘数</th>
                <th>平均順位</th>
                <th>1着率</th>
                <th>2着率</th>
                <th>3着率</th>
                <th>4着率</th>
                <th>平均スコア</th>
                <th>累計スコア</th>
                <th>段位</th>
                <th>雀力P</th>
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
                  <td>{player.firstRate.toFixed(1)}%</td>
                  <td>{player.secondRate.toFixed(1)}%</td>
                  <td>{player.thirdRate.toFixed(1)}%</td>
                  <td>{player.fourthRate.toFixed(1)}%</td>
                  <td>{player.averageScore.toFixed(1)}</td>
                  <td>{player.totalScore.toFixed(1)}</td>
                  <td>{player.dan}</td>
                  <td>{player.jankiPoint.toLocaleString()}</td>
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
