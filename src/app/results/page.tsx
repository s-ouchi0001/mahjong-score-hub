import { AppShell } from "@/app/components/AppShell";
import { ResultRegistration } from "@/app/results/ResultRegistration";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  const session = await getServerSession();
  if (session?.role === "player") {
    redirect(`/players?playerId=${session.playerId}`);
  }

  const [tables, players] = await Promise.all([
    prisma.mahjongTable.findMany({ orderBy: { tableNumber: "asc" } }),
    prisma.player.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell>
      <section className="page-title">
        <div>
          <h1>対局結果登録</h1>
          <p>卓と4人を選び、最終点数から順位とスコアを自動計算して確定します。</p>
        </div>
      </section>
      <ResultRegistration
        tables={tables.map((table) => ({
          id: table.id,
          tableNumber: table.tableNumber,
          status: table.status,
        }))}
        players={players.map((player) => ({
          id: player.id,
          name: player.name,
        }))}
      />
    </AppShell>
  );
}
