import { NextResponse } from "next/server";
import { notFound } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ playerId: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  const { playerId } = await params;

  const player = await prisma.player.findUnique({
    where: { id: playerId },
  });

  if (!player) {
    return notFound("プレイヤーが見つかりません。");
  }

  const records = await prisma.gamePlayer.findMany({
    where: {
      playerId,
      game: { status: "FINISHED" },
      rank: { not: null },
      score: { not: null },
    },
    orderBy: {
      game: { finishedAt: "desc" },
    },
    include: {
      game: {
        include: { table: true },
      },
    },
  });

  const count = records.length;
  const totalRank = records.reduce((sum, record) => sum + (record.rank ?? 0), 0);
  const totalScore = records.reduce((sum, record) => sum + (record.score ?? 0), 0);
  const topCount = records.filter((record) => record.rank === 1).length;
  const lastCount = records.filter((record) => record.rank === 4).length;

  return NextResponse.json({
    player,
    stats: {
      gameCount: count,
      averageRank: count ? Math.round((totalRank / count) * 100) / 100 : 0,
      topRate: count ? Math.round((topCount / count) * 1000) / 10 : 0,
      lastRate: count ? Math.round((lastCount / count) * 1000) / 10 : 0,
      averageScore: count ? Math.round((totalScore / count) * 10) / 10 : 0,
      totalScore: Math.round(totalScore * 10) / 10,
      recentGames: records.slice(0, 10).map((record) => ({
        gameId: record.gameId,
        tableNumber: record.game.table.tableNumber,
        finishedAt: record.game.finishedAt,
        finalPoints: record.finalPoints,
        rank: record.rank,
        score: record.score,
      })),
    },
  });
}
