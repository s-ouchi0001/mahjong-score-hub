import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const store = await prisma.store.upsert({
    where: { id: "store-demo" },
    update: {},
    create: {
      id: "store-demo",
      name: "本部デモ店舗",
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
        deviceId: `mock-table-${i}`,
      },
      create: {
        storeId: store.id,
        tableNumber: i,
        deviceId: `mock-table-${i}`,
      },
    });
  }

  const names = [
    "佐藤",
    "鈴木",
    "高橋",
    "田中",
    "伊藤",
    "渡辺",
    "山本",
    "中村",
    "小林",
    "加藤",
    "吉田",
    "山田",
  ];

  for (const name of names) {
    await prisma.player.upsert({
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
