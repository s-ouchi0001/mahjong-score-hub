import { NextRequest, NextResponse } from "next/server";
import { badRequest, forbidden, notFound, unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "STORE_ADMIN") return forbidden();

  const body = await request.json().catch(() => null);
  const tableId = body?.tableId as string | undefined;
  const playerIds = body?.playerIds as string[] | undefined;

  if (!tableId || !Array.isArray(playerIds) || playerIds.length !== 4) {
    return badRequest("tableId と playerIds 4件が必要です。");
  }

  if (new Set(playerIds).size !== 4) {
    return badRequest("プレイヤーは4人すべて別々にしてください。");
  }

  const table = await prisma.mahjongTable.findUnique({ where: { id: tableId } });
  if (!table) {
    return notFound("卓が見つかりません。");
  }
  if (table.storeId !== user.storeId) {
    return forbidden("別店舗の卓は操作できません。");
  }

  const players = await prisma.player.findMany({
    where: { id: { in: playerIds }, storeId: table.storeId },
  });
  if (players.length !== 4) {
    return badRequest("選択されたプレイヤーを確認してください。");
  }

  const activeGame = await prisma.game.findFirst({
    where: { tableId, status: "ACTIVE" },
  });
  if (activeGame) {
    return badRequest("この卓ではすでに対局が進行中です。");
  }

  const game = await prisma.$transaction(async (tx) => {
    const created = await tx.game.create({
      data: {
        storeId: table.storeId,
        tableId,
        players: {
          create: playerIds.map((playerId, index) => ({
            playerId,
            seat: index + 1,
            currentPoints: 25000,
          })),
        },
      },
      include: {
        players: {
          orderBy: { seat: "asc" },
          include: { player: true },
        },
      },
    });

    await tx.mahjongTable.update({
      where: { id: tableId },
      data: {
        status: "PLAYING",
        connectionStatus: "ONLINE",
        lastSeenAt: new Date(),
      },
    });

    return created;
  });

  return NextResponse.json({ game }, { status: 201 });
}
