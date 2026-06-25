import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tables = await prisma.mahjongTable.findMany({
    orderBy: { tableNumber: "asc" },
    include: {
      games: {
        where: { status: "ACTIVE" },
        take: 1,
        orderBy: { startedAt: "desc" },
        include: {
          players: {
            orderBy: { seat: "asc" },
            include: { player: true },
          },
        },
      },
    },
  });

  return NextResponse.json({
    tables: tables.map((table) => {
      const activeGame = table.games[0] ?? null;
      return {
        id: table.id,
        tableNumber: table.tableNumber,
        deviceId: table.deviceId,
        status: table.status,
        connectionStatus: table.connectionStatus,
        lastSeenAt: table.lastSeenAt,
        activeGame: activeGame
          ? {
              id: activeGame.id,
              startedAt: activeGame.startedAt,
              players: activeGame.players.map((gamePlayer) => ({
                id: gamePlayer.player.id,
                name: gamePlayer.player.name,
                seat: gamePlayer.seat,
                currentPoints: gamePlayer.currentPoints,
              })),
            }
          : null,
      };
    }),
  });
}
