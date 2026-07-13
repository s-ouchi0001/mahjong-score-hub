import { GameCategory } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { forbidden, notFound, unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildRating } from "@/lib/rating";

type Params = {
  params: Promise<{ playerId: string }>;
};

type StatsMode = "total" | "recent" | "month" | "tournament";
type CategoryFilter = "all" | "regular" | "tournament";

function resolveMode(value: string | null): StatsMode {
  if (value === "recent" || value === "month" || value === "tournament") return value;
  return "total";
}

function resolveCategory(value: string | null): CategoryFilter {
  if (value === "regular" || value === "tournament") return value;
  return "all";
}

function resolveMonthRange(value: string | null) {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  const now = new Date();
  const year = match ? Number(match[1]) : now.getFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : now.getMonth();
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 1);
  const label = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  return { start, end, label };
}

function round(value: number, digits = 1) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function rankRate(records: { rank: number | null }[], rank: number) {
  if (!records.length) return 0;
  return round((records.filter((record) => record.rank === rank).length / records.length) * 100, 1);
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
  const category = resolveCategory(request.nextUrl.searchParams.get("category"));
  const month = resolveMonthRange(request.nextUrl.searchParams.get("month"));
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
      : mode === "month"
        ? records.filter((record) => {
            const finishedAt = record.game.finishedAt;
            const categoryMatch =
              category === "all" ||
              (category === "regular" && record.game.category === GameCategory.REGULAR) ||
              (category === "tournament" && record.game.category === GameCategory.TOURNAMENT);
            return Boolean(finishedAt && finishedAt >= month.start && finishedAt < month.end && categoryMatch);
          })
      : mode === "tournament"
        ? records.filter((record) => record.game.category === GameCategory.TOURNAMENT && (!tournamentId || record.game.tournamentId === tournamentId))
        : records;
  const count = targetRecords.length;
  const totalRank = targetRecords.reduce((sum, record) => sum + (record.rank ?? 0), 0);
  const totalScore = targetRecords.reduce((sum, record) => sum + (record.score ?? 0), 0);
  const topCount = targetRecords.filter((record) => record.rank === 1).length;
  const lastCount = targetRecords.filter((record) => record.rank === 4).length;
  const averageRank = count ? round(totalRank / count, 2) : 0;
  const topRate = count ? round((topCount / count) * 100, 1) : 0;
  const lastRate = count ? round((lastCount / count) * 100, 1) : 0;
  const averageScore = count ? round(totalScore / count, 1) : 0;
  const roundedTotalScore = round(totalScore, 1);
  const ratingCount = records.length;
  const ratingTotalRank = records.reduce((sum, record) => sum + (record.rank ?? 0), 0);
  const ratingTotalScore = records.reduce((sum, record) => sum + (record.score ?? 0), 0);
  const ratingTopCount = records.filter((record) => record.rank === 1).length;
  const ratingLastCount = records.filter((record) => record.rank === 4).length;
  const rating = buildRating({
    gameCount: ratingCount,
    averageRank: ratingCount ? round(ratingTotalRank / ratingCount, 2) : 0,
    topRate: ratingCount ? round((ratingTopCount / ratingCount) * 100, 1) : 0,
    lastRate: ratingCount ? round((ratingLastCount / ratingCount) * 100, 1) : 0,
    totalScore: round(ratingTotalScore, 1),
  });

  return NextResponse.json({
    player,
    mode,
    category,
    month: month.label,
    stats: {
      gameCount: count,
      averageRank,
      topRate,
      lastRate,
      firstRate: rankRate(targetRecords, 1),
      secondRate: rankRate(targetRecords, 2),
      thirdRate: rankRate(targetRecords, 3),
      fourthRate: rankRate(targetRecords, 4),
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
