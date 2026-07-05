import { headers } from "next/headers";
import { AppShell } from "@/app/components/AppShell";
import { QrPrintClient } from "@/app/store/qr-print/QrPrintClient";
import { prisma } from "@/lib/prisma";
import { requireStoreAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function QrPrintPage() {
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
    select: { id: true, name: true, managementNumber: true, isCheckedIn: true },
  });

  return (
    <AppShell user={user}>
      <section className="page-title no-print">
        <div>
          <h1>QRログインカード印刷</h1>
          <p>ユーザごとのQRログインカードをまとめて印刷します。</p>
        </div>
      </section>
      <QrPrintClient players={players} storeCode={user.store.storeCode} loginBaseUrl={loginBaseUrl} />
    </AppShell>
  );
}
