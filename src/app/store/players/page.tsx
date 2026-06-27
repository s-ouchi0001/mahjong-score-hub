import { AppShell } from "@/app/components/AppShell";
import { StorePlayersClient } from "@/app/store/players/StorePlayersClient";
import { prisma } from "@/lib/prisma";
import { requireStoreAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

type PlayerSummary = {
  id: string;
  name: string;
  managementNumber: string | null;
  isCheckedIn: boolean;
  gameCount: number;
  averageRank: number;
  topRate: number;
  lastRate: number;
  averageScore: number;
  totalScore: number;
};

function round(value: number, digits = 1) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export default async function StorePlayersPage() {
  const user = await requireStoreAdmin();

  const players = await prisma.player.findMany({
    where: { storeId: user.storeId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      managementNumber: true,
      isCheckedIn: true,
      gamePlayers: {
        where: {
          game: { status: "FINISHED" },
          rank: { not: null },
          score: { not: null },
        },
        select: {
          rank: true,
          score: true,
        },
      },
    },
  });

  const summaries: PlayerSummary[] = players.map((player) => {
    const records = player.gamePlayers;
    const gameCount = records.length;
    const totalRank = records.reduce((sum, record) => sum + (record.rank ?? 0), 0);
    const totalScore = records.reduce((sum, record) => sum + (record.score ?? 0), 0);
    const topCount = records.filter((record) => record.rank === 1).length;
    const lastCount = records.filter((record) => record.rank === 4).length;

    return {
      id: player.id,
      name: player.name,
      managementNumber: player.managementNumber,
      isCheckedIn: player.isCheckedIn,
      gameCount,
      averageRank: gameCount ? round(totalRank / gameCount, 2) : 0,
      topRate: gameCount ? round((topCount / gameCount) * 100, 1) : 0,
      lastRate: gameCount ? round((lastCount / gameCount) * 100, 1) : 0,
      averageScore: gameCount ? round(totalScore / gameCount, 1) : 0,
      totalScore: round(totalScore, 1),
    };
  });

  return (
    <AppShell user={user}>
      <section className="page-title">
        <div>
          <h1>全ユーザ成績</h1>
          <p>店舗管理者が、登録プレイヤー全員の成績を横断して確認する画面です。</p>
        </div>
      </section>
      <StorePlayersClient players={summaries} />
    </AppShell>
  );
}
