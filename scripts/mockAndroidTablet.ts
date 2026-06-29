export {};

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i], process.argv[i + 1]);
}

const baseUrl = args.get("--baseUrl") ?? "http://localhost:3000";
const fallbackStoreId = args.get("--storeId") ?? "store-demo";
const fallbackTableNumber = Number(args.get("--tableNumber") ?? "1");
const deviceId = args.get("--deviceId") ?? "mock-table-1";
const apiKey = args.get("--apiKey") ?? process.env.ANDROID_GATEWAY_API_KEY;
const intervalMs = Number(args.get("--intervalMs") ?? 0);

type AndroidTableResponse = {
  store: {
    id: string;
    name: string;
  };
  table: {
    tableNumber: number;
    deviceId: string;
  };
  activeGame: null | {
    seatPoints: {
      seat: number;
      points: number;
    }[];
  };
};

function distributeSeatPoints() {
  const deltas = Array.from({ length: 4 }, () => Math.floor((Math.random() - 0.5) * 9000));
  const totalDelta = deltas.reduce((sum, value) => sum + value, 0);
  deltas[0] -= totalDelta;
  return deltas.map((delta) => Math.max(1000, Math.round((25000 + delta) / 100) * 100));
}

async function getTableInfo(headers: Record<string, string>) {
  const response = await fetch(`${baseUrl}/api/android/table?deviceId=${encodeURIComponent(deviceId)}`, {
    headers,
  });

  if (response.status === 404) {
    return null;
  }

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? `卓情報の取得に失敗しました: ${response.status}`);
  }

  return payload as AndroidTableResponse;
}

async function sendPointUpdate() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const tableInfo = await getTableInfo(headers);
  const storeId = tableInfo?.store.id ?? fallbackStoreId;
  const tableNumber = tableInfo?.table.tableNumber ?? fallbackTableNumber;
  const points = distributeSeatPoints();
  const response = await fetch(`${baseUrl}/api/android/point-update`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      storeId,
      tableNumber,
      deviceId,
      capturedAt: new Date().toISOString(),
      recognition: {
        provider: "mock-android-tablet",
        confidence: 0.98,
      },
      points,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? `送信に失敗しました: ${response.status}`);
  }

  console.log(
    `[mockAndroidTablet] ${storeId} ${tableNumber}卓 ${deviceId} -> ${points
      .map((point, index) => `席${index + 1}:${point}`)
      .join(", ")}`,
  );
}

async function main() {
  if (intervalMs > 0) {
    console.log(`[mockAndroidTablet] ${intervalMs}ms 間隔で送信します。`);
    await sendPointUpdate();
    setInterval(() => {
      sendPointUpdate().catch((error) => console.error(error.message));
    }, intervalMs);
    return;
  }

  await sendPointUpdate();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
