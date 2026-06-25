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

          <div className="actions">
            <button className="button secondary" type="button" onClick={startGame} disabled={isSaving || Boolean(gameId)}>
              対局開始
            </button>
            <button className="button" type="button" onClick={finishGame} disabled={isSaving || !gameId}>
              結果を確定
            </button>
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
