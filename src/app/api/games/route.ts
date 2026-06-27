import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const games = await prisma.game.findMany({
    where: user.role === "PLAYER" && user.playerId ? { players: { some: { playerId: user.playerId } } } : { storeId: user.storeId },
    orderBy: [{ status: "asc" }, { startedAt: "desc" }],
    include: {
      table: true,
      players: {
        orderBy: [{ rank: "asc" }, { seat: "asc" }],
        include: { player: true },
      },
    },
  });

  return NextResponse.json({
    games: games.map((game) => ({
      id: game.id,
      status: game.status,
      startedAt: game.startedAt,
      finishedAt: game.finishedAt,
      table: {
        id: game.table.id,
        tableNumber: game.table.tableNumber,
      },
      players: game.players.map((gamePlayer) => ({
        playerId: gamePlayer.playerId,
        name: gamePlayer.player.name,
        seat: gamePlayer.seat,
        currentPoints: gamePlayer.currentPoints,
        finalPoints: gamePlayer.finalPoints,
        rank: gamePlayer.rank,
        score: gamePlayer.score,
      })),
    })),
  });
}
