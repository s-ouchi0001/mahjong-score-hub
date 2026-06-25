import { NextRequest, NextResponse } from "next/server";
import { badRequest, notFound } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { calculateResults } from "@/lib/scoring";

type Params = {
  params: Promise<{ gameId: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { gameId } = await params;
  const body = await request.json().catch(() => null);
  const results = body?.results as { playerId: string; points: number }[] | undefined;

  if (!Array.isArray(results) || results.length !== 4) {
    return badRequest("results は playerId と points を持つ4件が必要です。");
  }

  if (results.some((result) => !result.playerId || !Number.isFinite(result.points))) {
    return badRequest("プレイヤーと点数を確認してください。");
  }

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true, table: true },
  });

  if (!game) {
    return notFound("対局が見つかりません。");
  }

  if (game.status === "FINISHED") {
    return badRequest("この対局はすでに確定済みです。");
  }

  const gamePlayerIds = new Set(game.players.map((player) => player.playerId));
  if (results.some((result) => !gamePlayerIds.has(result.playerId))) {
    return badRequest("対局に参加していないプレイヤーが含まれています。");
  }

  const calculated = calculateResults(results);

  const finished = await prisma.$transaction(async (tx) => {
    for (const result of calculated) {
      await tx.gamePlayer.update({
        where: {
          gameId_playerId: {
            gameId,
            playerId: result.playerId,
          },
        },
        data: {
          currentPoints: result.points,
          finalPoints: result.points,
          rank: result.rank,
          score: result.score,
        },
      });
    }

    await tx.game.update({
      where: { id: gameId },
      data: {
        status: "FINISHED",
        finishedAt: new Date(),
      },
    });

    await tx.mahjongTable.update({
      where: { id: game.tableId },
      data: {
        status: "FINISHED",
        lastSeenAt: new Date(),
      },
    });

    return tx.game.findUniqueOrThrow({
      where: { id: gameId },
      include: {
        table: true,
        players: {
          orderBy: { rank: "asc" },
          include: { player: true },
        },
      },
    });
  });

  return NextResponse.json({ game: finished });
}
