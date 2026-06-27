import { NextRequest, NextResponse } from "next/server";
import { badRequest, forbidden, notFound, unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const staffSeatValue = "__STAFF__";
const staffNumberPrefix = "__staff_";

function isStaffNumber(value: string | null) {
  return Boolean(value?.startsWith(staffNumberPrefix));
}

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

  if (playerIds.some((playerId) => !playerId)) {
    return badRequest("4席すべて選択してください。");
  }

  const table = await prisma.mahjongTable.findUnique({ where: { id: tableId } });
  if (!table) {
    return notFound("卓が見つかりません。");
  }
  if (table.storeId !== user.storeId) {
    return forbidden("別店舗の卓は操作できません。");
  }

  const requestedPlayerIds = playerIds.filter((playerId) => playerId !== staffSeatValue);
  const requestedPlayers = requestedPlayerIds.length
    ? await prisma.player.findMany({
        where: { id: { in: requestedPlayerIds }, storeId: table.storeId },
      })
    : [];
  const requestedPlayerMap = new Map(requestedPlayers.map((player) => [player.id, player]));
  if (requestedPlayerIds.some((playerId) => !requestedPlayerMap.has(playerId))) {
    return badRequest("選択されたユーザが見つかりません。");
  }

  const realPlayerIds = playerIds.filter((playerId) => {
    if (playerId === staffSeatValue) return false;
    const player = requestedPlayerMap.get(playerId);
    return player ? !isStaffNumber(player.managementNumber) : false;
  });
  if (new Set(realPlayerIds).size !== realPlayerIds.length) {
    return badRequest("一般ユーザは同じ卓に重複して設定できません。");
  }

  const realPlayers = realPlayerIds.map((playerId) => requestedPlayerMap.get(playerId));
  if (realPlayers.some((player) => !player?.isCheckedIn)) {
    return badRequest("一般ユーザは入場中の人だけ選択してください。");
  }

  const seatedOnOtherTable = await prisma.gamePlayer.findFirst({
    where: {
      playerId: { in: realPlayerIds },
      game: {
        status: "ACTIVE",
        tableId: { not: tableId },
        storeId: table.storeId,
      },
    },
    include: {
      player: { select: { name: true } },
      game: { include: { table: { select: { tableNumber: true } } } },
    },
  });
  if (seatedOnOtherTable) {
    return badRequest(`${seatedOnOtherTable.player.name}さんは${seatedOnOtherTable.game.table.tableNumber}卓に着席中です。`);
  }

  const resolvedPlayerIds = await Promise.all(
    playerIds.map(async (playerId, index) => {
      const player = requestedPlayerMap.get(playerId);
      if (playerId !== staffSeatValue && player && !isStaffNumber(player.managementNumber)) return playerId;

      const managementNumber = `${staffNumberPrefix}${tableId}_${index + 1}`;
      const staffPlayer = await prisma.player.upsert({
        where: {
          storeId_managementNumber: {
            storeId: table.storeId,
            managementNumber,
          },
        },
        update: { name: "スタッフ", isCheckedIn: false },
        create: {
          storeId: table.storeId,
          name: "スタッフ",
          managementNumber,
          isCheckedIn: false,
        },
      });
      return staffPlayer.id;
    }),
  );

  const activeGame = await prisma.game.findFirst({
    where: { tableId, status: "ACTIVE" },
  });
  if (activeGame) {
    const game = await prisma.$transaction(async (tx) => {
      await tx.gamePlayer.deleteMany({ where: { gameId: activeGame.id } });
      await tx.gamePlayer.createMany({
        data: resolvedPlayerIds.map((playerId, index) => ({
          gameId: activeGame.id,
          playerId,
          seat: index + 1,
          currentPoints: 25000,
        })),
      });

      await tx.mahjongTable.update({
        where: { id: tableId },
        data: {
          status: "PLAYING",
          connectionStatus: "ONLINE",
          lastSeenAt: new Date(),
        },
      });

      return tx.game.findUniqueOrThrow({
        where: { id: activeGame.id },
        include: {
          players: {
            orderBy: { seat: "asc" },
            include: { player: true },
          },
        },
      });
    });

    return NextResponse.json({ game });
  }

  const game = await prisma.$transaction(async (tx) => {
    const created = await tx.game.create({
      data: {
        storeId: table.storeId,
        tableId,
        players: {
          create: resolvedPlayerIds.map((playerId, index) => ({
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
