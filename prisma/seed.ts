import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

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

    for (const [index, name] of storeConfig.players.entries()) {
      const player = await prisma.player.upsert({
        where: {
          storeId_name: {
            storeId: store.id,
            name,
          },
        },
        update: {},
        create: {
          storeId: store.id,
          name,
        },
      });

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
