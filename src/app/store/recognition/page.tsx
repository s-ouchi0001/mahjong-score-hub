import { AppShell } from "@/app/components/AppShell";
import { AutoRefresh } from "@/app/components/AutoRefresh";
import { prisma } from "@/lib/prisma";
import { requireStoreAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

type SnapshotPayload = {
  capturedAt?: string;
  recognition?: {
    provider?: string;
    stableSeats?: number[];
    previewImage?: string | null;
  } | null;
  points?: Array<number | { seat?: number; points?: number }>;
};

function payloadOf(value: unknown): SnapshotPayload {
  return value && typeof value === "object" ? (value as SnapshotPayload) : {};
}

function pointsLabel(points: SnapshotPayload["points"]) {
  if (!Array.isArray(points)) return "-";
  return points
    .map((item, index) => {
      if (typeof item === "number") return `席${index + 1} ${item.toLocaleString()}`;
      if (item && typeof item === "object" && typeof item.points === "number") {
        return `席${item.seat ?? index + 1} ${item.points.toLocaleString()}`;
      }
      return `席${index + 1} -`;
    })
    .join(" / ");
}

function formatTime(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function providerLabel(provider?: string) {
  if (!provider) return "不明";
  if (provider === "pc-red-led-recognizer") return "PC赤色LED認識";
  if (provider === "android-camera-ocr") return "AndroidカメラOCR";
  return provider;
}

export default async function StoreRecognitionPage() {
  const user = await requireStoreAdmin();
  const tables = await prisma.mahjongTable.findMany({
    where: { storeId: user.storeId },
    orderBy: { tableNumber: "asc" },
    select: {
      id: true,
      tableNumber: true,
      deviceId: true,
      connectionStatus: true,
      lastSeenAt: true,
      pointSnapshots: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          createdAt: true,
          payload: true,
        },
      },
    },
  });

  const recentSnapshots = await prisma.pointSnapshot.findMany({
    where: { table: { storeId: user.storeId } },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      createdAt: true,
      deviceId: true,
      payload: true,
      table: { select: { tableNumber: true } },
    },
  });

  return (
    <AppShell user={user}>
      <section className="page-title">
        <div>
          <h1>カメラ認識確認</h1>
          <p>ミニPCやMacから送られた点数、認識状態、最後の確認画像を見ます。</p>
        </div>
        <AutoRefresh />
      </section>

      <section className="recognition-grid">
        {tables.map((table) => {
          const snapshot = table.pointSnapshots[0] ?? null;
          const payload = payloadOf(snapshot?.payload);
          const recognition = payload.recognition ?? null;
          return (
            <article className="recognition-card" key={table.id}>
              <div className="recognition-card-heading">
                <div>
                  <h2>{table.tableNumber}卓</h2>
                  <p>{table.deviceId}</p>
                </div>
                <span className={`badge ${table.connectionStatus === "ONLINE" ? "ok" : "warn"}`}>
                  {table.connectionStatus === "ONLINE" ? "オンライン" : "オフライン"}
                </span>
              </div>
              <div className="recognition-image-frame">
                {recognition?.previewImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={recognition.previewImage} alt={`${table.tableNumber}卓の最後の認識画像`} />
                ) : (
                  <span>画像なし</span>
                )}
              </div>
              <dl className="recognition-meta">
                <div>
                  <dt>現在点数</dt>
                  <dd>{pointsLabel(payload.points)}</dd>
                </div>
                <div>
                  <dt>認識方式</dt>
                  <dd>{providerLabel(recognition?.provider)}</dd>
                </div>
                <div>
                  <dt>安定席</dt>
                  <dd>{recognition?.stableSeats?.length ? recognition.stableSeats.map((seat) => `席${seat}`).join(" / ") : "-"}</dd>
                </div>
                <div>
                  <dt>最終送信</dt>
                  <dd>{formatTime(snapshot?.createdAt ?? table.lastSeenAt)}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </section>

      <section className="panel recognition-log-panel">
        <h2>直近の認識ログ</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>時刻</th>
                <th>卓</th>
                <th>端末ID</th>
                <th>点数</th>
                <th>方式</th>
              </tr>
            </thead>
            <tbody>
              {recentSnapshots.length ? (
                recentSnapshots.map((snapshot) => {
                  const payload = payloadOf(snapshot.payload);
                  return (
                    <tr key={snapshot.id}>
                      <td>{formatTime(snapshot.createdAt)}</td>
                      <td>{snapshot.table.tableNumber}卓</td>
                      <td>{snapshot.deviceId}</td>
                      <td>{pointsLabel(payload.points)}</td>
                      <td>{providerLabel(payload.recognition?.provider)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="muted">
                    認識ログはまだありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
