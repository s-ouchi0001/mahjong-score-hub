import { NextRequest, NextResponse } from "next/server";
import { badRequest, notFound } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type PointUpdate = {
  playerId: string;
  points: number;
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const deviceId = body?.deviceId as string | undefined;
  const points = body?.points as PointUpdate[] | undefined;

  if (!deviceId || !Array.isArray(points) || points.length !== 4) {
    return badRequest("deviceId と points 4件が必要です。");
  }

  const table = await prisma.mahjongTable.findUnique({
    where: { deviceId },
  });

  if (!table) {
    return notFound("deviceId に対応する卓が見つかりません。");
  }

  const activeGame = await prisma.game.findFirst({
    where: { tableId: table.id, status: "ACTIVE" },
    include: { players: true },
    orderBy: { startedAt: "desc" },
  });

  if (!activeGame) {
    await prisma.$transaction([
      prisma.mahjongTable.update({
        where: { id: table.id },
        data: {
          connectionStatus: "ONLINE",
          lastSeenAt: new Date(),
        },
      }),
      prisma.pointSnapshot.create({
        data: {
          tableId: table.id,
          deviceId,
          payload: body,
        },
      }),
    ]);

    return NextResponse.json({
      accepted: true,
      attachedToGame: false,
    });
  }

  const activePlayerIds = new Set(activeGame.players.map((player) => player.playerId));
  if (points.some((point) => !activePlayerIds.has(point.playerId))) {
    return badRequest("進行中の対局に含まれないプレイヤーの点数が含まれています。");
  }

  await prisma.$transaction(async (tx) => {
    for (const point of points) {
      await tx.gamePlayer.update({
        where: {
          gameId_playerId: {
            gameId: activeGame.id,
            playerId: point.playerId,
          },
        },
        data: {
          currentPoints: point.points,
        },
      });
    }

    await tx.pointSnapshot.create({
      data: {
        tableId: table.id,
        gameId: activeGame.id,
        deviceId,
        payload: body,
      },
    });

    await tx.mahjongTable.update({
      where: { id: table.id },
      data: {
        status: "PLAYING",
        connectionStatus: "ONLINE",
        lastSeenAt: new Date(),
      },
    });
  });

  return NextResponse.json({
    accepted: true,
    attachedToGame: true,
    gameId: activeGame.id,
  });
}
