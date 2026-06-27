import { Player, PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { calculateResults } from "../src/lib/scoring";

const prisma = new PrismaClient();

async function main() {
  const stores = [
    {
      id: "store-demo",
      name: "本部デモ店舗",
      adminEmail: "owner@example.com",
      tablePrefix: "mock-table",
      players: ["佐藤", "鈴木", "高橋", "田中", "伊藤", "渡辺", "山本", "中村", "小林", "加藤", "吉田", "山田"],
    },
    {
      id: "store-demo-2",
      name: "駅前デモ店舗",
      adminEmail: "owner2@example.com",
      tablePrefix: "mock-store2-table",
      players: ["青木", "森", "林", "清水", "池田", "橋本", "阿部", "石川"],
    },
  ];

  for (const storeConfig of stores) {
    const store = await prisma.store.upsert({
      where: { id: storeConfig.id },
      update: { name: storeConfig.name },
      create: {
        id: storeConfig.id,
        name: storeConfig.name,
      },
    });

    await prisma.appUser.upsert({
      where: { email: storeConfig.adminEmail },
      update: {
        name: `${store.name} 管理者`,
        role: "STORE_ADMIN",
        storeId: store.id,
        passwordHash: hashPassword("password"),
      },
      create: {
        storeId: store.id,
        email: storeConfig.adminEmail,
        name: `${store.name} 管理者`,
        role: "STORE_ADMIN",
        passwordHash: hashPassword("password"),
      },
    });

    for (let i = 1; i <= 6; i += 1) {
      await prisma.mahjongTable.upsert({
        where: {
          storeId_tableNumber: {
            storeId: store.id,
            tableNumber: i,
          },
        },
        update: {
          deviceId: `${storeConfig.tablePrefix}-${i}`,
        },
        create: {
          storeId: store.id,
          tableNumber: i,
          deviceId: `${storeConfig.tablePrefix}-${i}`,
        },
      });
    }

    const seededPlayers: Player[] = [];

    for (const [index, name] of storeConfig.players.entries()) {
      const managementNumber = `${store.id === "store-demo" ? "A" : "B"}${String(index + 1).padStart(3, "0")}`;
      const player = await prisma.player.upsert({
        where: {
          storeId_name: {
            storeId: store.id,
            name,
          },
        },
        update: {
          managementNumber,
          isCheckedIn: index < 8,
          checkedInAt: index < 8 ? new Date() : null,
          checkedOutAt: index < 8 ? null : new Date(),
        },
        create: {
          storeId: store.id,
          name,
          managementNumber,
          isCheckedIn: index < 8,
          checkedInAt: index < 8 ? new Date() : null,
          checkedOutAt: index < 8 ? null : new Date(),
        },
      });
      seededPlayers.push(player);

      await prisma.appUser.upsert({
        where: { email: `player${index + 1}@${store.id}.example.com` },
        update: {
          name,
          role: "PLAYER",
          storeId: store.id,
          playerId: player.id,
          passwordHash: hashPassword("password"),
        },
        create: {
          storeId: store.id,
          playerId: player.id,
          email: `player${index + 1}@${store.id}.example.com`,
          name,
          role: "PLAYER",
          passwordHash: hashPassword("password"),
        },
      });
    }

    const demoPoints = [
      [34100, 28500, 22100, 15300],
      [30100, 29200, 24700, 16000],
      [41200, 22300, 20100, 16400],
      [27800, 27200, 26000, 19000],
      [35200, 30500, 18900, 15400],
      [32200, 28800, 23800, 15200],
      [38900, 26400, 21300, 13400],
      [29600, 28100, 27100, 15200],
      [36800, 29900, 21400, 11900],
      [31500, 30200, 22600, 15700],
      [40300, 25100, 20500, 14100],
      [33300, 27600, 25400, 13700],
    ];

    for (const [gameIndex, points] of demoPoints.entries()) {
      const tableNumber = (gameIndex % 4) + 1;
      const table = await prisma.mahjongTable.findUniqueOrThrow({
        where: {
          storeId_tableNumber: {
            storeId: store.id,
            tableNumber,
          },
        },
      });
      const selectedPlayers = [0, 1, 2, 3].map((offset) => seededPlayers[(gameIndex + offset) % seededPlayers.length]);
      const gameId = `demo-game-${store.id}-${gameIndex + 1}`;

      await prisma.game.upsert({
        where: { id: gameId },
        update: {
          storeId: store.id,
          tableId: table.id,
          status: "FINISHED",
          resultSource: "MANUAL",
          finishedAt: new Date(Date.now() - (gameIndex + 1) * 60 * 60 * 1000),
        },
        create: {
          id: gameId,
          storeId: store.id,
          tableId: table.id,
          status: "FINISHED",
          resultSource: "MANUAL",
          startedAt: new Date(Date.now() - (gameIndex + 2) * 60 * 60 * 1000),
          finishedAt: new Date(Date.now() - (gameIndex + 1) * 60 * 60 * 1000),
        },
      });

      const calculated = calculateResults(
        selectedPlayers.map((player, index) => ({
          playerId: player.id,
          points: points[index],
        })),
      );

      for (const [seatIndex, player] of selectedPlayers.entries()) {
        const result = calculated.find((item) => item.playerId === player.id);
        await prisma.gamePlayer.upsert({
          where: {
            gameId_playerId: {
              gameId,
              playerId: player.id,
            },
          },
          update: {
            seat: seatIndex + 1,
            currentPoints: points[seatIndex],
            finalPoints: points[seatIndex],
            rank: result?.rank,
            score: result?.score,
          },
          create: {
            gameId,
            playerId: player.id,
            seat: seatIndex + 1,
            currentPoints: points[seatIndex],
            finalPoints: points[seatIndex],
            rank: result?.rank,
            score: result?.score,
          },
        });
      }
    }
  }
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
