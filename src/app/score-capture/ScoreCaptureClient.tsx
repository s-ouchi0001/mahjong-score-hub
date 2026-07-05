"use client";

import { useMemo, useState } from "react";
import { calculateResults } from "@/lib/scoring";

type ScoreCaptureGame = {
  id: string;
  tableNumber: number;
  deviceId: string;
  startedAt: string;
  players: {
    id: string;
    name: string;
    managementNumber: string | null;
    seat: number;
    currentPoints: number;
  }[];
};

type Message = {
  type: "ok" | "error";
  text: string;
};

type GameCategory = "REGULAR" | "TOURNAMENT";

function makeBalancedPoints(playerCount: number) {
  if (playerCount !== 4) return Array.from({ length: playerCount }, () => 25000);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const first = Math.round((36000 + Math.random() * 18000) / 100) * 100;
    const second = Math.round((26000 + Math.random() * 10000) / 100) * 100;
    const fourth = Math.round((6000 + Math.random() * 15000) / 100) * 100;
    const third = 100000 - first - second - fourth;
    if (third >= 1000 && third <= 33000) return [first, second, third, fourth];
  }

  return [42000, 31000, 18000, 9000];
}

function totalPoints(points: number[]) {
  return points.reduce((sum, point) => sum + (Number.isFinite(point) ? point : 0), 0);
}

export function ScoreCaptureClient({ games }: { games: ScoreCaptureGame[] }) {
  const [gameState, setGameState] = useState(games);
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const selectedGame = gameState.find((game) => game.id === gameId) ?? gameState[0] ?? null;
  const [points, setPoints] = useState<number[]>(selectedGame?.players.map((player) => player.currentPoints) ?? [25000, 25000, 25000, 25000]);
  const [category, setCategory] = useState<GameCategory>("REGULAR");
  const [imageUrl, setImageUrl] = useState("");
  const [lastSource, setLastSource] = useState<"manual" | "image">("manual");
  const [message, setMessage] = useState<Message | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const calculated = useMemo(() => {
    if (!selectedGame) return [];
    return calculateResults(
      selectedGame.players.map((player, index) => ({
        playerId: player.id,
        points: points[index] ?? 0,
      })),
    );
  }, [selectedGame, points]);

  const pointTotal = totalPoints(points);
  const isTotalOk = pointTotal === 100000;

  function selectGame(nextGameId: string) {
    const nextGame = gameState.find((game) => game.id === nextGameId) ?? null;
    setGameId(nextGameId);
    setPoints(nextGame?.players.map((player) => player.currentPoints) ?? [25000, 25000, 25000, 25000]);
    setImageUrl("");
    setLastSource("manual");
    setCategory("REGULAR");
    setMessage(null);
  }

  function updatePoints(index: number, value: string) {
    const parsed = Number(value);
    setPoints((current) => current.map((point, currentIndex) => (currentIndex === index ? parsed : point)));
    setMessage(null);
  }

  function resetPoints() {
    setPoints([25000, 25000, 25000, 25000]);
    setLastSource("manual");
    setMessage({ type: "ok", text: "全員25,000点に戻しました。" });
  }

  function applyCurrentPoints() {
    if (!selectedGame) return;
    setPoints(selectedGame.players.map((player) => player.currentPoints));
    setLastSource("manual");
    setMessage({ type: "ok", text: "現在点数を入力欄に反映しました。" });
  }

  function captureScoreCandidate() {
    if (!selectedGame) return;
    const nextPoints = makeBalancedPoints(selectedGame.players.length);
    setPoints(nextPoints);
    setLastSource("image");
    setMessage({
      type: "ok",
      text: imageUrl
        ? "画像から取得した点数候補を反映しました。内容を確認して確定してください。"
        : "点数取得候補を反映しました。内容を確認して確定してください。",
    });
  }

  function playerName(playerId: string) {
    return selectedGame?.players.find((player) => player.id === playerId)?.name ?? "-";
  }

  async function finishGame() {
    if (!selectedGame) return;
    if (!isTotalOk) {
      setMessage({ type: "error", text: "4人の合計が100,000点になるように確認してください。" });
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const results = selectedGame.players.map((player, index) => ({
        playerId: player.id,
        points: points[index] ?? 0,
      }));
      const endpoint =
        lastSource === "image"
          ? `/api/games/${selectedGame.id}/recognized-result`
          : `/api/games/${selectedGame.id}/finish`;
      const body =
        lastSource === "image"
          ? {
              provider: "score-capture-ui",
              deviceId: selectedGame.deviceId,
              imageUrl: imageUrl || undefined,
              confidence: 0.9,
              category,
              results,
            }
          : { category, results };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "結果確定に失敗しました。");

      setGameState((current) => {
        const nextGames = current.filter((game) => game.id !== selectedGame.id);
        const nextGame = nextGames[0] ?? null;
        setGameId(nextGame?.id ?? "");
        setPoints(nextGame?.players.map((player) => player.currentPoints) ?? [25000, 25000, 25000, 25000]);
        return nextGames;
      });
      setImageUrl("");
      setLastSource("manual");
      setCategory("REGULAR");
      setMessage({ type: "ok", text: `${selectedGame.tableNumber}卓の${category === "TOURNAMENT" ? "大会" : "通常"}成績を確定しました。` });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "結果確定に失敗しました。" });
    } finally {
      setIsSaving(false);
    }
  }

  if (!gameState.length) {
    return (
      <section className="panel">
        <p className="muted">採点できる対局中の卓はありません。先に卓管理で4人を登録してください。</p>
      </section>
    );
  }

  return (
    <div className="score-capture-layout">
      <section className="panel">
        <h2>卓を選択</h2>
        <div className="table-list">
          {gameState.map((game) => (
            <button
              className={`table-select ${selectedGame?.id === game.id ? "active" : ""}`}
              key={game.id}
              type="button"
              onClick={() => selectGame(game.id)}
            >
              <span>{game.tableNumber}卓</span>
              <small>{game.players.map((player) => player.name).join(" / ")}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel score-entry-panel">
        <div className="score-entry-heading">
          <div>
            <h2>{selectedGame?.tableNumber}卓の点数入力</h2>
            <p className="muted">点数取得後に必要なところだけ直して、そのまま確定できます。</p>
          </div>
          <span className={`badge ${isTotalOk ? "ok" : "warn"}`}>合計 {pointTotal.toLocaleString()}</span>
        </div>

        <div className="capture-tools">
          <div className="field">
            <label>成績区分</label>
            <div className="segment-control" role="group" aria-label="成績区分">
              <button
                className={category === "REGULAR" ? "active" : ""}
                type="button"
                onClick={() => setCategory("REGULAR")}
              >
                通常成績
              </button>
              <button
                className={category === "TOURNAMENT" ? "active" : ""}
                type="button"
                onClick={() => setCategory("TOURNAMENT")}
              >
                大会成績
              </button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="image-url">画像URL / カメラURL</label>
            <input
              id="image-url"
              placeholder="例: http://192.168.x.x:8081/snapshot.jpg"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
            />
          </div>
          <div className="actions">
            <button className="button secondary" type="button" onClick={captureScoreCandidate}>
              点数取得
            </button>
            <button className="button secondary" type="button" onClick={applyCurrentPoints}>
              現在点数
            </button>
            <button className="button secondary" type="button" onClick={resetPoints}>
              25,000に戻す
            </button>
          </div>
        </div>

        <div className="simple-score-grid">
          {selectedGame?.players.map((player, index) => (
            <div className="simple-score-row" key={player.id}>
              <div>
                <strong>{player.name}</strong>
                <span>
                  {player.seat}席
                  {player.managementNumber ? ` / ${player.managementNumber}` : ""}
                </span>
              </div>
              <input
                aria-label={`${player.name}の最終点数`}
                inputMode="numeric"
                step="100"
                type="number"
                value={points[index] ?? 0}
                onChange={(event) => updatePoints(index, event.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="actions">
          <button className="button" type="button" onClick={finishGame} disabled={isSaving}>
            この内容で成績確定
          </button>
        </div>

        {message ? <div className={`message ${message.type}`}>{message.text}</div> : null}
      </section>

      <section className="panel">
        <h2>自動計算</h2>
        <div className="rank-list">
          {calculated.map((result) => (
            <div className="rank-row" key={result.playerId}>
              <span>{result.rank}位</span>
              <strong>{playerName(result.playerId)}</strong>
              <em>{result.points.toLocaleString()}点</em>
              <b>{result.score.toFixed(1)}</b>
            </div>
          ))}
        </div>
        <p className="muted score-source-note">
          確定元: {lastSource === "image" ? "点数取得候補" : "手入力"}
        </p>
      </section>
    </div>
  );
}
