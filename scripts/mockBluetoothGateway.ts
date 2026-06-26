type TableResponse = {
  tables: {
    deviceId: string;
    tableNumber: number;
    activeGame: null | {
      id: string;
      players: {
        id: string;
        name: string;
        currentPoints: number;
      }[];
    };
  }[];
};

export {};

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i], process.argv[i + 1]);
}

const deviceId = args.get("--deviceId") ?? args.get("-d") ?? "mock-table-1";
const baseUrl = args.get("--baseUrl") ?? "http://localhost:3000";
const intervalMs = Number(args.get("--intervalMs") ?? 0);

function distributePoints(playerCount: number) {
  const deltas = Array.from({ length: playerCount }, () => Math.floor((Math.random() - 0.5) * 12000));
  const balancedDeltas = [...deltas];
  const totalDelta = balancedDeltas.reduce((sum, value) => sum + value, 0);
  balancedDeltas[0] -= totalDelta;

  return balancedDeltas.map((delta) => Math.max(1000, Math.round((25000 + delta) / 100) * 100));
}

async function sendPointUpdate() {
  const tablesResponse = await fetch(`${baseUrl}/api/tables`);
  if (!tablesResponse.ok) {
    throw new Error(`卓情報の取得に失敗しました: ${tablesResponse.status}`);
  }

  const { tables } = (await tablesResponse.json()) as TableResponse;
  const table = tables.find((candidate) => candidate.deviceId === deviceId);
  if (!table) {
    throw new Error(`deviceId=${deviceId} に対応する卓が見つかりません。`);
  }

  if (!table.activeGame) {
    throw new Error(`${table.tableNumber}卓には進行中の対局がありません。結果登録画面で対局開始してください。`);
  }

  const generatedPoints = distributePoints(table.activeGame.players.length);
  const points = table.activeGame.players.map((player, index) => ({
    playerId: player.id,
    points: generatedPoints[index],
  }));

  const response = await fetch(`${baseUrl}/api/table-events/point-update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deviceId,
      capturedAt: new Date().toISOString(),
      points,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? `送信に失敗しました: ${response.status}`);
  }

  console.log(
    `[mockBluetoothGateway] ${deviceId} -> ${points
      .map((point) => `${point.playerId}:${point.points}`)
      .join(", ")}`,
  );
}

async function main() {
  if (intervalMs > 0) {
    console.log(`[mockBluetoothGateway] ${deviceId} に ${intervalMs}ms 間隔で送信します。`);
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
