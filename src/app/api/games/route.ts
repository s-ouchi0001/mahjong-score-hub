import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const games = await prisma.game.findMany({
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
