"use client";

import { useMemo, useState } from "react";
import { calculateResults } from "@/lib/scoring";

type TableOption = {
  id: string;
  tableNumber: number;
  status: string;
};

type PlayerOption = {
  id: string;
  name: string;
};

type Props = {
  tables: TableOption[];
  players: PlayerOption[];
};

export function ResultRegistration({ tables, players }: Props) {
  const [tableId, setTableId] = useState(tables[0]?.id ?? "");
  const [playerIds, setPlayerIds] = useState<string[]>(players.slice(0, 4).map((player) => player.id));
  const [points, setPoints] = useState<number[]>([25000, 25000, 25000, 25000]);
  const [gameId, setGameId] = useState("");
  const [finishMode, setFinishMode] = useState<"manual" | "recognition">("manual");
  const [recognizedJson, setRecognizedJson] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const calculated = useMemo(() => {
    if (playerIds.some((id) => !id)) return [];
    return calculateResults(
      playerIds.map((playerId, index) => ({
        playerId,
        points: points[index] ?? 0,
      })),
    );
  }, [playerIds, points]);

  const playerName = (playerId: string) => players.find((player) => player.id === playerId)?.name ?? "-";

  const recognitionSample = useMemo(
    () =>
      JSON.stringify(
        {
          provider: "score-image-ocr",
          deviceId: tables.find((table) => table.id === tableId)?.tableNumber
            ? `mock-table-${tables.find((table) => table.id === tableId)?.tableNumber}`
            : undefined,
          imageUrl: "https://example.com/scoreboard.jpg",
          confidence: 0.94,
          rawText: "34100 28500 22100 15300",
          results: playerIds.map((playerId, index) => ({
            playerId,
            playerName: playerName(playerId),
            points: [34100, 28500, 22100, 15300][index],
            confidence: [0.98, 0.96, 0.93, 0.91][index],
          })),
        },
        null,
        2,
      ),
    [playerIds, tableId, tables],
  );

  function updatePlayer(index: number, value: string) {
    setPlayerIds((current) => current.map((playerId, currentIndex) => (currentIndex === index ? value : playerId)));
  }

  function updatePoints(index: number, value: string) {
    const parsed = Number(value);
    setPoints((current) => current.map((point, currentIndex) => (currentIndex === index ? parsed : point)));
  }

  async function startGame() {
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/games/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId, playerIds }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "対局開始に失敗しました。");
      setGameId(payload.game.id);
      setMessage({ type: "ok", text: "対局を開始しました。モックゲートウェイの点数更新も受け付けます。" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "対局開始に失敗しました。" });
    } finally {
      setIsSaving(false);
    }
  }

  async function finishGame() {
    setIsSaving(true);
    setMessage(null);
    try {
      const activeGameId = gameId;
      if (!activeGameId) throw new Error("先に対局を開始してください。");

      const response = await fetch(`/api/games/${activeGameId}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          results: playerIds.map((playerId, index) => ({
            playerId,
            points: points[index],
          })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "結果確定に失敗しました。");
      setGameId("");
      setMessage({ type: "ok", text: "結果を確定しました。本部画面とプレイヤー成績に反映されています。" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "結果確定に失敗しました。" });
    } finally {
      setIsSaving(false);
    }
  }

  async function finishGameFromRecognition() {
    setIsSaving(true);
    setMessage(null);
    try {
      const activeGameId = gameId;
      if (!activeGameId) throw new Error("先に対局を開始してください。");

      const parsed = JSON.parse(recognizedJson || recognitionSample);
      if (!Array.isArray(parsed.results)) {
        throw new Error("画像認識結果JSONには results が必要です。");
      }

      const response = await fetch(`/api/games/${activeGameId}/recognized-result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "画像認識結果の確定に失敗しました。");

      const recognizedPoints = parsed.results.map((result: { points: number }) => Number(result.points));
      if (recognizedPoints.length === 4 && recognizedPoints.every(Number.isFinite)) {
        setPoints(recognizedPoints);
      }

      setGameId("");
      setMessage({ type: "ok", text: "画像認識結果をAPIで取り込み、結果を確定しました。" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "画像認識結果の確定に失敗しました。",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid two">
      <section className="panel">
        <h2>登録内容</h2>
        <div className="form">
          <div className="field">
            <label htmlFor="table">卓</label>
            <select id="table" value={tableId} onChange={(event) => setTableId(event.target.value)} disabled={Boolean(gameId)}>
              {tables.map((table) => (
                <option key={table.id} value={table.id}>
                  {table.tableNumber}卓
                </option>
              ))}
            </select>
          </div>

          <div className="player-grid">
            {[0, 1, 2, 3].map((index) => (
              <div className="field" key={index}>
                <label htmlFor={`player-${index}`}>プレイヤー{index + 1}</label>
                <select
                  id={`player-${index}`}
                  value={playerIds[index] ?? ""}
                  onChange={(event) => updatePlayer(index, event.target.value)}
                  disabled={Boolean(gameId)}
                >
                  <option value="">選択</option>
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="player-grid">
            {[0, 1, 2, 3].map((index) => (
              <div className="field" key={index}>
                <label htmlFor={`point-${index}`}>{playerName(playerIds[index])} 最終点数</label>
                <input
                  id={`point-${index}`}
                  type="number"
                  step="100"
                  value={points[index]}
                  onChange={(event) => updatePoints(index, event.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="mode-tabs" role="tablist" aria-label="結果確定方法">
            <button
              className={finishMode === "manual" ? "active" : ""}
              type="button"
              onClick={() => setFinishMode("manual")}
            >
              手入力
            </button>
            <button
              className={finishMode === "recognition" ? "active" : ""}
              type="button"
              onClick={() => setFinishMode("recognition")}
            >
              画像認識API
            </button>
          </div>

          {finishMode === "recognition" ? (
            <div className="field">
              <label htmlFor="recognized-json">画像認識結果JSON</label>
              <textarea
                id="recognized-json"
                value={recognizedJson || recognitionSample}
                onChange={(event) => setRecognizedJson(event.target.value)}
                rows={12}
                spellCheck={false}
              />
            </div>
          ) : null}

          <div className="actions">
            <button className="button secondary" type="button" onClick={startGame} disabled={isSaving || Boolean(gameId)}>
              対局開始
            </button>
            {finishMode === "manual" ? (
              <button className="button" type="button" onClick={finishGame} disabled={isSaving || !gameId}>
                手入力で確定
              </button>
            ) : (
              <button className="button" type="button" onClick={finishGameFromRecognition} disabled={isSaving || !gameId}>
                画像認識結果で確定
              </button>
            )}
          </div>

          {message ? <div className={`message ${message.type}`}>{message.text}</div> : null}
        </div>
      </section>

      <section className="panel">
        <h2>自動計算</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>順位</th>
                <th>プレイヤー</th>
                <th>点数</th>
                <th>スコア</th>
              </tr>
            </thead>
            <tbody>
              {calculated.map((result) => (
                <tr key={result.playerId}>
                  <td>{result.rank}位</td>
                  <td>{playerName(result.playerId)}</td>
                  <td>{result.points.toLocaleString()}</td>
                  <td>{result.score.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">スコアは「25,000点持ち + 順位点（+20 / +10 / -10 / -20）」で計算しています。</p>
      </section>
    </div>
  );
}
