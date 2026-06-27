import { AppShell } from "@/app/components/AppShell";
import { StoreUsersClient } from "@/app/store/users/StoreUsersClient";
import { prisma } from "@/lib/prisma";
import { requireStoreAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function StoreUsersPage() {
  const user = await requireStoreAdmin();

  const players = await prisma.player.findMany({
    where: {
      storeId: user.storeId,
      OR: [{ managementNumber: null }, { managementNumber: { not: { startsWith: "__staff_" } } }],
    },
    orderBy: [{ managementNumber: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      managementNumber: true,
      isCheckedIn: true,
      checkedInAt: true,
      checkedOutAt: true,
    },
  });

  return (
    <AppShell user={user}>
      <section className="page-title">
        <div>
          <h1>ユーザ管理</h1>
          <p>管理番号の設定と入退場を管理します。</p>
        </div>
      </section>
      <StoreUsersClient
        players={players.map((player) => ({
          ...player,
          checkedInAt: player.checkedInAt?.toISOString() ?? null,
          checkedOutAt: player.checkedOutAt?.toISOString() ?? null,
        }))}
      />
    </AppShell>
  );
}
