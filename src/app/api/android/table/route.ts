import { NextRequest, NextResponse } from "next/server";
import { badRequest, forbidden, notFound } from "@/lib/api";
import { isAndroidGatewayAuthorized } from "@/lib/androidGateway";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  if (!isAndroidGatewayAuthorized(request)) {
    return forbidden("Androidゲートウェイの認証に失敗しました。");
  }

  const deviceId = request.nextUrl.searchParams.get("deviceId")?.trim();
  if (!deviceId) {
    return badRequest("deviceId が必要です。");
  }

  const table = await prisma.mahjongTable.findUnique({
    where: { deviceId },
    include: {
      store: {
        select: {
          id: true,
          name: true,
        },
      },
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
            },
          },
        },
      },
    },
  });

  if (!table) {
    return notFound("deviceId に対応する卓が見つかりません。");
  }

  const updatedTable = await prisma.mahjongTable.update({
    where: { id: table.id },
    data: {
      connectionStatus: "ONLINE",
      lastSeenAt: new Date(),
    },
  });

  const activeGame = table.games[0] ?? null;

  return NextResponse.json({
    store: {
      id: table.store.id,
      name: table.store.name,
    },
    table: {
      id: table.id,
      tableNumber: table.tableNumber,
      deviceId: table.deviceId,
      status: table.status,
      connectionStatus: updatedTable.connectionStatus,
      lastSeenAt: updatedTable.lastSeenAt,
    },
    activeGame: activeGame
      ? {
          id: activeGame.id,
          startedAt: activeGame.startedAt,
          seatPoints: activeGame.players.map((player) => ({
            seat: player.seat,
            points: player.currentPoints,
          })),
        }
      : null,
  });
}
