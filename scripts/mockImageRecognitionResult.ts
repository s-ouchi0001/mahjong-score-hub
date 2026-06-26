type TableResponse = {
  tables: {
    deviceId: string;
    tableNumber: number;
    activeGame: null | {
      id: string;
      players: {
        id: string;
        name: string;
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

function finalPoints(playerCount: number) {
  const deltas = Array.from({ length: playerCount }, () => Math.floor((Math.random() - 0.5) * 16000));
  const totalDelta = deltas.reduce((sum, value) => sum + value, 0);
  deltas[0] -= totalDelta;
  return deltas.map((delta) => Math.max(1000, Math.round((25000 + delta) / 100) * 100));
}

async function main() {
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

  const points = finalPoints(table.activeGame.players.length);
  const payload = {
    provider: "mock-image-recognition",
    deviceId,
    imageUrl: `mock://${deviceId}/final-scoreboard.jpg`,
    confidence: 0.94,
    rawText: points.join(" "),
    results: table.activeGame.players.map((player, index) => ({
      playerId: player.id,
      playerName: player.name,
      points: points[index],
      confidence: Math.round((0.9 + Math.random() * 0.09) * 100) / 100,
    })),
  };

  const response = await fetch(`${baseUrl}/api/games/${table.activeGame.id}/recognized-result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? `画像認識結果の送信に失敗しました: ${response.status}`);
  }

  console.log(`[mockImageRecognitionResult] ${deviceId} game=${table.activeGame.id} finalized`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
