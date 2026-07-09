import { AppShell } from "@/app/components/AppShell";
import { StoreUsersClient } from "@/app/store/users/StoreUsersClient";
import { prisma } from "@/lib/prisma";
import { requireStoreAdmin } from "@/lib/session";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function StoreUsersPage() {
  const user = await requireStoreAdmin();
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "mahjong.hsou-con.com";
  const protocol = headerStore.get("x-forwarded-proto") ?? (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
  const loginBaseUrl = `${protocol}://${host}/login`;

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
      visitCount: true,
    },
  });

  return (
    <AppShell user={user}>
      <section className="page-title">
        <div>
          <h1>ユーザ管理</h1>
          <p>
            {user.store.name} のユーザを管理します。店舗ID: {user.store.storeCode}
          </p>
        </div>
      </section>
      <StoreUsersClient
        storeCode={user.store.storeCode}
        loginBaseUrl={loginBaseUrl}
        players={players.map((player) => ({
          ...player,
          checkedInAt: player.checkedInAt?.toISOString() ?? null,
          checkedOutAt: player.checkedOutAt?.toISOString() ?? null,
        }))}
      />
    </AppShell>
  );
}
