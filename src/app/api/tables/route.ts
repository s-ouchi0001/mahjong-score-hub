import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tables = await prisma.mahjongTable.findMany({
    orderBy: { tableNumber: "asc" },
    select: {
      id: true,
      tableNumber: true,
      deviceId: true,
      status: true,
      connectionStatus: true,
      lastSeenAt: true,
      games: {
        where: { status: "ACTIVE" },
        take: 1,
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          startedAt: true,
          players: {
            orderBy: { seat: "asc" },
            select: {
              seat: true,
              currentPoints: true,
              player: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
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
