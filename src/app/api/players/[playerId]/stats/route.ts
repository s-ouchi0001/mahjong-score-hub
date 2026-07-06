import { GameCategory } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { forbidden, notFound, unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildRating } from "@/lib/rating";

type Params = {
  params: Promise<{ playerId: string }>;
};

type StatsMode = "total" | "recent" | "tournament";

function resolveMode(value: string | null): StatsMode {
  if (value === "recent" || value === "tournament") return value;
  return "total";
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { playerId } = await params;
  if (user.role === "PLAYER" && user.playerId !== playerId) {
    return forbidden("自分以外の成績は閲覧できません。");
  }

  const player = await prisma.player.findUnique({
    where: { id: playerId },
  });

  if (!player) {
    return notFound("プレイヤーが見つかりません。");
  }
  if (player.storeId !== user.storeId) {
    return forbidden("別店舗の成績は閲覧できません。");
  }

  const mode = resolveMode(request.nextUrl.searchParams.get("mode"));
  const tournamentId = request.nextUrl.searchParams.get("tournamentId");
  const records = await prisma.gamePlayer.findMany({
    where: {
      playerId,
      game: {
        status: "FINISHED",
      },
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

  const targetRecords =
    mode === "recent"
      ? records.slice(0, 10)
      : mode === "tournament"
        ? records.filter((record) => record.game.category === GameCategory.TOURNAMENT && (!tournamentId || record.game.tournamentId === tournamentId))
        : records;
  const count = targetRecords.length;
  const totalRank = targetRecords.reduce((sum, record) => sum + (record.rank ?? 0), 0);
  const totalScore = targetRecords.reduce((sum, record) => sum + (record.score ?? 0), 0);
  const topCount = targetRecords.filter((record) => record.rank === 1).length;
  const lastCount = targetRecords.filter((record) => record.rank === 4).length;
  const averageRank = count ? Math.round((totalRank / count) * 100) / 100 : 0;
  const topRate = count ? Math.round((topCount / count) * 1000) / 10 : 0;
  const lastRate = count ? Math.round((lastCount / count) * 1000) / 10 : 0;
  const averageScore = count ? Math.round((totalScore / count) * 10) / 10 : 0;
  const roundedTotalScore = Math.round(totalScore * 10) / 10;
  const ratingCount = records.length;
  const ratingTotalRank = records.reduce((sum, record) => sum + (record.rank ?? 0), 0);
  const ratingTotalScore = records.reduce((sum, record) => sum + (record.score ?? 0), 0);
  const ratingTopCount = records.filter((record) => record.rank === 1).length;
  const ratingLastCount = records.filter((record) => record.rank === 4).length;
  const rating = buildRating({
    gameCount: ratingCount,
    averageRank: ratingCount ? Math.round((ratingTotalRank / ratingCount) * 100) / 100 : 0,
    topRate: ratingCount ? Math.round((ratingTopCount / ratingCount) * 1000) / 10 : 0,
    lastRate: ratingCount ? Math.round((ratingLastCount / ratingCount) * 1000) / 10 : 0,
    totalScore: Math.round(ratingTotalScore * 10) / 10,
  });

  return NextResponse.json({
    player,
    mode,
    stats: {
      gameCount: count,
      averageRank,
      topRate,
      lastRate,
      averageScore,
      totalScore: roundedTotalScore,
      dan: rating.dan,
      jankiPoint: rating.jankiPoint,
      recentGames: targetRecords.slice(0, 10).map((record) => ({
        gameId: record.gameId,
        tableNumber: record.game.table.tableNumber,
        category: record.game.category,
        finishedAt: record.game.finishedAt,
        finalPoints: record.finalPoints,
        rank: record.rank,
        score: record.score,
      })),
    },
  });
}
