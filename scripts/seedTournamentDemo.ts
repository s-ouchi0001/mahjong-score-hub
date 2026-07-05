import { PrismaClient } from "@prisma/client";
import { calculateResults } from "../src/lib/scoring";

const prisma = new PrismaClient();

const tournamentPoints = [
  [48200, 27100, 15800, 8900],
  [39300, 31600, 18400, 10700],
  [35600, 34200, 20100, 10100],
  [44100, 25100, 22900, 7900],
  [37700, 30900, 24600, 6800],
  [51200, 19600, 17800, 11400],
  [42100, 28800, 16900, 12200],
  [33300, 32600, 22700, 11400],
  [46700, 24800, 19700, 8800],
  [38900, 29700, 21100, 10300],
  [40800, 30200, 17400, 11600],
  [36100, 33500, 19100, 11300],
  [49200, 22100, 18500, 10200],
  [37400, 36100, 15800, 10700],
  [43300, 27600, 20400, 8700],
  [40100, 28900, 23600, 7400],
];

async function main() {
  const store = await prisma.store.findUniqueOrThrow({
    where: { storeCode: "DEMO" },
  });

  const players = await prisma.player.findMany({
    where: {
      storeId: store.id,
      OR: [{ managementNumber: null }, { managementNumber: { not: { startsWith: "__staff_" } } }],
    },
    orderBy: [{ managementNumber: "asc" }, { name: "asc" }],
  });

  if (players.length < 8) {
    throw new Error("大会データ作成にはDEMO店舗に8人以上のユーザが必要です。");
  }

  const tables = await prisma.mahjongTable.findMany({
    where: { storeId: store.id },
    orderBy: { tableNumber: "asc" },
    take: 4,
  });

  if (tables.length < 4) {
    throw new Error("大会データ作成にはDEMO店舗に4卓以上が必要です。");
  }

  const tournamentStart = new Date();
  tournamentStart.setDate(tournamentStart.getDate() - 3);
  tournamentStart.setHours(13, 0, 0, 0);

  for (const [gameIndex, points] of tournamentPoints.entries()) {
    const table = tables[gameIndex % tables.length];
    const selectedPlayers = [0, 1, 2, 3].map((offset) => players[(gameIndex * 2 + offset) % players.length]);
    const startedAt = new Date(tournamentStart.getTime() + gameIndex * 45 * 60 * 1000);
    const finishedAt = new Date(startedAt.getTime() + 38 * 60 * 1000);
    const gameId = `demo-tournament-final-2026-${String(gameIndex + 1).padStart(2, "0")}`;

    const calculated = calculateResults(
      selectedPlayers.map((player, index) => ({
        playerId: player.id,
        points: points[index],
      })),
    );

    await prisma.$transaction(async (tx) => {
      await tx.game.upsert({
        where: { id: gameId },
        update: {
          storeId: store.id,
          tableId: table.id,
          status: "FINISHED",
          category: "TOURNAMENT",
          resultSource: "MANUAL",
          startedAt,
          finishedAt,
        },
        create: {
          id: gameId,
          storeId: store.id,
          tableId: table.id,
          status: "FINISHED",
          category: "TOURNAMENT",
          resultSource: "MANUAL",
          startedAt,
          finishedAt,
        },
      });

      await tx.gamePlayer.deleteMany({ where: { gameId } });
      await tx.gamePlayer.createMany({
        data: selectedPlayers.map((player, seatIndex) => {
          const result = calculated.find((item) => item.playerId === player.id);
          return {
            gameId,
            playerId: player.id,
            seat: seatIndex + 1,
            currentPoints: points[seatIndex],
            finalPoints: points[seatIndex],
            rank: result?.rank,
            score: result?.score,
          };
        }),
      });
    });
  }

  console.log(`DEMO店舗に大会半荘 ${tournamentPoints.length} 件を追加しました。`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
