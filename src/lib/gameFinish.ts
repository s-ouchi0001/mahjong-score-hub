import { Prisma, ResultSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateResults } from "@/lib/scoring";

export type FinishResultInput = {
  playerId: string;
  points: number;
};

export class FinishGameError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404 = 400,
  ) {
    super(message);
  }
}

export async function finishGameWithResults({
  gameId,
  results,
  source,
  payload,
  storeId,
}: {
  gameId: string;
  results: FinishResultInput[];
  source: ResultSource;
  payload?: Prisma.InputJsonValue;
  storeId?: string;
}) {
  if (!Array.isArray(results) || results.length !== 4) {
    throw new FinishGameError("results は playerId と points を持つ4件が必要です。");
  }

  if (results.some((result) => !result.playerId || !Number.isFinite(result.points))) {
    throw new FinishGameError("プレイヤーと点数を確認してください。");
  }

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true, table: true },
  });

  if (!game) {
    throw new FinishGameError("対局が見つかりません。", 404);
  }

  if (storeId && game.storeId !== storeId) {
    throw new FinishGameError("別店舗の対局は操作できません。", 403);
  }

  if (game.status === "FINISHED") {
    throw new FinishGameError("この対局はすでに確定済みです。");
  }

  const gamePlayerIds = new Set(game.players.map((player) => player.playerId));
  if (results.some((result) => !gamePlayerIds.has(result.playerId))) {
    throw new FinishGameError("対局に参加していないプレイヤーが含まれています。");
  }

  const calculated = calculateResults(results);

  return prisma.$transaction(async (tx) => {
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
        resultSource: source,
        resultPayload: payload ?? undefined,
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
}
