import { NextRequest, NextResponse } from "next/server";
import { badRequest, forbidden, notFound, unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateResults } from "@/lib/scoring";

type Params = {
  params: Promise<{ gameId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "STORE_ADMIN") return forbidden();

  const { gameId } = await params;
  const body = await request.json().catch(() => null);
  const results = body?.results as { playerId: string; points: number }[] | undefined;

  if (!Array.isArray(results) || results.length !== 4) {
    return badRequest("4人分の点数が必要です。");
  }

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true, store: true },
  });
  if (!game) return notFound("成績が見つかりません。");
  if (game.storeId !== user.storeId) return forbidden("別店舗の成績は修正できません。");
  if (game.status !== "FINISHED") return badRequest("確定済みの成績だけ修正できます。");

  const playerIds = new Set(game.players.map((player) => player.playerId));
  if (results.some((result) => !playerIds.has(result.playerId) || !Number.isFinite(result.points))) {
    return badRequest("参加者と点数を確認してください。");
  }

  const calculated = calculateResults(results, game.store);
  const updated = await prisma.$transaction(async (tx) => {
    for (const result of calculated) {
      await tx.gamePlayer.update({
        where: { gameId_playerId: { gameId, playerId: result.playerId } },
        data: {
          currentPoints: result.points,
          finalPoints: result.points,
          rank: result.rank,
          score: result.score,
        },
      });
    }
    return tx.game.findUniqueOrThrow({
      where: { id: gameId },
      include: {
        table: true,
        tournament: true,
        players: { orderBy: { seat: "asc" }, include: { player: true } },
      },
    });
  });

  return NextResponse.json({ game: updated });
}
