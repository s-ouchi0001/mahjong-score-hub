import { GameCategory } from "@prisma/client";
import { AppShell } from "@/app/components/AppShell";
import { SuperAdminPanel } from "@/app/super/SuperAdminPanel";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SuperPage() {
  const user = await requireSuperAdmin();

  const stores = await prisma.store.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      storeCode: true,
      _count: {
        select: {
          tables: true,
          players: true,
        },
      },
    },
  });

  const summaries = await Promise.all(
    stores.map(async (store) => {
      const [checkedInCount, finishedGameCount, tournamentGameCount, staffCount] = await Promise.all([
        prisma.player.count({ where: { storeId: store.id, isCheckedIn: true } }),
        prisma.game.count({ where: { storeId: store.id, status: "FINISHED" } }),
        prisma.game.count({ where: { storeId: store.id, status: "FINISHED", category: GameCategory.TOURNAMENT } }),
        prisma.appUser.count({ where: { storeId: store.id, role: "STORE_ADMIN" } }),
      ]);

      return {
        id: store.id,
        name: store.name,
        storeCode: store.storeCode,
        tableCount: store._count.tables,
        playerCount: store._count.players,
        checkedInCount,
        finishedGameCount,
        tournamentGameCount,
        staffCount,
      };
    }),
  );

  return (
    <AppShell user={user}>
      <section className="page-title">
        <div>
          <h1>全体管理</h1>
          <p>雀荘スタッフ、卓、店舗ごとの利用状況を管理します。</p>
        </div>
      </section>
      <SuperAdminPanel stores={summaries} />
    </AppShell>
  );
}
