import { NextRequest, NextResponse } from "next/server";
import { badRequest, forbidden, notFound } from "@/lib/api";
import { isAndroidGatewayAuthorized, normalizePointValue } from "@/lib/androidGateway";
import { prisma } from "@/lib/prisma";

type SeatPoint = {
  seat?: number;
  points?: number | string;
};

function normalizeSeatPoints(input: unknown) {
  if (!Array.isArray(input) || input.length !== 4) return null;

  const normalized = input.map((item, index) => {
    if (typeof item === "number" || typeof item === "string") {
      const points = normalizePointValue(item);
      return points === null ? null : { seat: index + 1, points };
    }

    if (item && typeof item === "object") {
      const seatPoint = item as SeatPoint;
      const seat = Number(seatPoint.seat ?? index + 1);
      const points = normalizePointValue(seatPoint.points);
      if (!Number.isInteger(seat) || seat < 1 || seat > 4 || points === null) return null;
      return { seat, points };
    }

    return null;
  });

  if (normalized.some((point) => point === null)) return null;

  const seatSet = new Set(normalized.map((point) => point?.seat));
  if (seatSet.size !== 4) return null;

  return normalized as { seat: number; points: number }[];
}

export async function POST(request: NextRequest) {
  if (!isAndroidGatewayAuthorized(request)) {
    return forbidden("Androidゲートウェイの認証に失敗しました。");
  }

  const body = await request.json().catch(() => null);
  const storeId = body?.storeId as string | undefined;
  const tableNumber = Number(body?.tableNumber);
  const deviceId = body?.deviceId as string | undefined;
  const seatPoints = normalizeSeatPoints(body?.points);

  if (!storeId || !Number.isInteger(tableNumber) || tableNumber < 1 || !seatPoints) {
    return badRequest("storeId、tableNumber、4席分のpointsが必要です。");
  }

  const table = await prisma.mahjongTable.findUnique({
    where: {
      storeId_tableNumber: {
        storeId,
        tableNumber,
      },
    },
  });

  if (!table) {
    return notFound("店舗と卓番号に対応する卓が見つかりません。");
  }

  if (deviceId && table.deviceId !== deviceId) {
    return badRequest("deviceId が対象卓と一致しません。");
  }

  const activeGame = await prisma.game.findFirst({
    where: { tableId: table.id, status: "ACTIVE" },
    include: {
      players: {
        orderBy: { seat: "asc" },
      },
    },
    orderBy: { startedAt: "desc" },
  });

  const payload = JSON.parse(
    JSON.stringify({
      source: "android-tablet-camera",
      storeId,
      tableNumber,
      deviceId: deviceId ?? table.deviceId,
      capturedAt: body?.capturedAt ?? new Date().toISOString(),
      recognition: body?.recognition ?? null,
      points: seatPoints,
      rawPayload: body?.rawPayload,
    }),
  );

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
          deviceId: table.deviceId,
          payload,
        },
      }),
    ]);

    return NextResponse.json({
      accepted: true,
      attachedToGame: false,
      table: {
        id: table.id,
        storeId: table.storeId,
        tableNumber: table.tableNumber,
        deviceId: table.deviceId,
      },
    });
  }

  const playerBySeat = new Map(activeGame.players.map((player) => [player.seat, player]));

  await prisma.$transaction(async (tx) => {
    for (const point of seatPoints) {
      const gamePlayer = playerBySeat.get(point.seat);
      if (!gamePlayer) continue;

      await tx.gamePlayer.update({
        where: {
          gameId_playerId: {
            gameId: activeGame.id,
            playerId: gamePlayer.playerId,
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
        deviceId: table.deviceId,
        payload,
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
    table: {
      id: table.id,
      storeId: table.storeId,
      tableNumber: table.tableNumber,
      deviceId: table.deviceId,
    },
    points: seatPoints.map((point) => ({
      seat: point.seat,
      points: point.points,
    })),
  });
}
