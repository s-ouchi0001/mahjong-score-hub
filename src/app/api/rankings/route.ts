import { GameCategory } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildRating } from "@/lib/rating";

function round(value: number, digits = 1) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const mode = request.nextUrl.searchParams.get("mode") === "tournament" ? "tournament" : "total";
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
            ...(mode === "tournament" ? { category: GameCategory.TOURNAMENT } : {}),
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
      const rating = buildRating(summary);

      return {
        id: player.id,
        name: player.name,
        managementNumber: player.managementNumber,
        ...summary,
        ...rating,
      };
    })
    .sort((a, b) => (mode === "tournament" ? b.totalScore - a.totalScore : b.jankiPoint - a.jankiPoint || b.totalScore - a.totalScore))
    .map((player, index) => ({ ...player, rank: index + 1 }));

  return NextResponse.json({ mode, rankings });
}
