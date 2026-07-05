import { AppShell } from "@/app/components/AppShell";
import { StoreSettingsClient } from "@/app/store/settings/StoreSettingsClient";
import { prisma } from "@/lib/prisma";
import { requireStoreAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function StoreSettingsPage() {
  const user = await requireStoreAdmin();
  const [tournaments, storeSettings] = await Promise.all([
    prisma.tournament.findMany({
      where: { storeId: user.storeId },
      orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, name: true, startsAt: true, endsAt: true },
    }),
    prisma.store.findUniqueOrThrow({
      where: { id: user.storeId },
      select: {
        startingPoint: true,
        returnPoint: true,
        firstPlaceBonus: true,
        secondPlaceBonus: true,
        thirdPlaceBonus: true,
        fourthPlaceBonus: true,
      },
    }),
  ]);

  return (
    <AppShell user={user}>
      <section className="page-title">
        <div>
          <h1>設定</h1>
          <p>大会登録と、今後の成績計算・運用設定を管理します。</p>
        </div>
      </section>
      <StoreSettingsClient tournaments={tournaments} scoreSettings={storeSettings} />
    </AppShell>
  );
}
