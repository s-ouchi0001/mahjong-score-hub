import { PrismaClient } from "@prisma/client";
import { calculateResults } from "../src/lib/scoring";

const prisma = new PrismaClient();

const monthlyTournaments = [
  {
    id: "demo-tournament-2026-07",
    name: "7月麻雀大会",
    startsAt: new Date("2026-07-20T13:00:00+09:00"),
    points: [
      [48200, 27100, 15800, 8900],
      [39300, 31600, 18400, 10700],
      [35600, 34200, 20100, 10100],
      [44100, 25100, 22900, 7900],
      [37700, 30900, 24600, 6800],
      [51200, 19600, 17800, 11400],
      [42100, 28800, 16900, 12200],
      [33300, 32600, 22700, 11400],
    ],
  },
  {
    id: "demo-tournament-2026-08",
    name: "8月麻雀大会",
    startsAt: new Date("2026-08-17T13:00:00+09:00"),
    points: [
      [46800, 29200, 17300, 6700],
      [40200, 33400, 15800, 10600],
      [37100, 28600, 26400, 7900],
      [53300, 21100, 16800, 8800],
      [34900, 32200, 24100, 8800],
      [44600, 27600, 18300, 9500],
      [38800, 35100, 15900, 10200],
      [50100, 24400, 17100, 8400],
    ],
  },
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

  for (const tournamentSeed of monthlyTournaments) {
    const tournament = await prisma.tournament.upsert({
      where: {
        storeId_name: {
          storeId: store.id,
          name: tournamentSeed.name,
        },
      },
      update: {
        startsAt: tournamentSeed.startsAt,
      },
      create: {
        id: tournamentSeed.id,
        storeId: store.id,
        name: tournamentSeed.name,
        startsAt: tournamentSeed.startsAt,
      },
    });

    for (const [gameIndex, points] of tournamentSeed.points.entries()) {
      const table = tables[gameIndex % tables.length];
      const selectedPlayers = [0, 1, 2, 3].map((offset) => players[(gameIndex * 2 + offset) % players.length]);
      const startedAt = new Date(tournamentSeed.startsAt.getTime() + gameIndex * 45 * 60 * 1000);
      const finishedAt = new Date(startedAt.getTime() + 38 * 60 * 1000);
      const gameId = `${tournamentSeed.id}-game-${String(gameIndex + 1).padStart(2, "0")}`;

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
            tournamentId: tournament.id,
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
            tournamentId: tournament.id,
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
  }

  console.log("DEMO店舗に7月麻雀大会・8月麻雀大会のデータを追加しました。");
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
