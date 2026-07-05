"use client";

import { useMemo, useState } from "react";
import { calculateResults, type ScoreSettings } from "@/lib/scoring";

type ActiveGame = {
  id: string;
  tableNumber: number;
  category: "REGULAR" | "TOURNAMENT";
  tournamentName: string | null;
  players: {
    id: string;
    name: string;
    seat: number;
    currentPoints: number;
  }[];
};

function totalPoints(points: number[]) {
  return points.reduce((sum, point) => sum + (Number.isFinite(point) ? point : 0), 0);
}

function fromPointUnits(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed) * 100);
}

export function ScoreEntry({ games, scoreSettings }: { games: ActiveGame[]; scoreSettings: ScoreSettings }) {
  const [gameState, setGameState] = useState(games);
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const selectedGame = gameState.find((game) => game.id === gameId) ?? gameState[0];
  const [pointUnits, setPointUnits] = useState<string[]>(selectedGame?.players.map(() => "") ?? ["", "", "", ""]);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const hasAllPoints = pointUnits.length === 4 && pointUnits.every((point) => point !== "");
  const points = pointUnits.map(fromPointUnits);
  const pointTotal = hasAllPoints ? totalPoints(points) : 0;
  const isTotalOk = hasAllPoints && pointTotal === 100000;

  function selectGame(nextGameId: string) {
    const nextGame = gameState.find((game) => game.id === nextGameId);
    setGameId(nextGameId);
    setPointUnits(nextGame?.players.map(() => "") ?? ["", "", "", ""]);
    setMessage(null);
  }

  function updatePoints(index: number, value: string) {
    setPointUnits((current) => current.map((point, currentIndex) => (currentIndex === index ? value.replace(/\D/g, "") : point)));
  }

  function resetPoints() {
    setPointUnits(["", "", "", ""]);
    setMessage({ type: "ok", text: "点数入力を空欄に戻しました。" });
  }

  const calculated = useMemo(() => {
    if (!selectedGame || !hasAllPoints) return [];
    return calculateResults(
      selectedGame.players.map((player, index) => ({
        playerId: player.id,
        points: points[index] ?? 0,
      })),
      scoreSettings,
    );
  }, [selectedGame, pointUnits, scoreSettings, hasAllPoints]);

  function playerName(playerId: string) {
    return selectedGame?.players.find((player) => player.id === playerId)?.name ?? "-";
  }

  async function finishGame() {
    if (!selectedGame) return;
    if (!hasAllPoints) {
      setMessage({ type: "error", text: "4人分の点数を入力してください。" });
      return;
    }
    if (!isTotalOk) {
      setMessage({ type: "error", text: "4人の合計が100,000点になるように確認してください。" });
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/games/${selectedGame.id}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          results: selectedGame.players.map((player, index) => ({
            playerId: player.id,
            points: points[index],
          })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "結果確定に失敗しました。");
      setGameState((current) => {
        const nextGames = current.filter((game) => game.id !== selectedGame.id);
        setGameId(nextGames[0]?.id ?? "");
        setPointUnits(nextGames[0]?.players.map(() => "") ?? ["", "", "", ""]);
        return nextGames;
      });
      setMessage({ type: "ok", text: `${selectedGame.tableNumber}卓の${selectedGame.category === "TOURNAMENT" ? "大会" : "通常"}成績を確定しました。` });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "結果確定に失敗しました。" });
    } finally {
      setIsSaving(false);
    }
  }

  if (!gameState.length) {
    return (
      <section className="panel">
        <p className="muted">成績入力できる対局中の卓はありません。先に卓管理画面で卓のメンバーを登録してください。</p>
      </section>
    );
  }

  return (
    <div className="grid two">
      <section className="panel">
        <div className="score-entry-heading">
          <h2>成績入力</h2>
          <span className={`badge ${isTotalOk ? "ok" : "warn"}`}>合計 {hasAllPoints ? pointTotal.toLocaleString() : "-"}</span>
        </div>
        <div className="form">
          <div className="field">
            <label htmlFor="game">卓</label>
            <select id="game" value={gameId} onChange={(event) => selectGame(event.target.value)}>
              {gameState.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.tableNumber}卓 / {game.players.map((player) => player.name).join("・")}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>卓設定</label>
            <div className="readonly-setting">
              <strong>{selectedGame.category === "TOURNAMENT" ? "大会卓" : "通常卓"}</strong>
              <span>{selectedGame.category === "TOURNAMENT" ? selectedGame.tournamentName ?? "大会未設定" : "卓管理で変更できます"}</span>
            </div>
          </div>

          <div className="player-grid">
            {selectedGame.players.map((player, index) => (
              <div className="field" key={player.id}>
                <label className="point-label" htmlFor={`point-${player.id}`}>
                  <span>{player.name} 最終点数</span>
                  <strong>{player.seat}席</strong>
                </label>
                <div className="point-unit-input">
                  <input
                    id={`point-${player.id}`}
                    type="number"
                    min="0"
                    step="1"
                    value={pointUnits[index] ?? ""}
                    onChange={(event) => updatePoints(index, event.target.value)}
                  />
                  <span className="fixed-point-suffix">00</span>
                </div>
              </div>
            ))}
          </div>

          <div className="actions">
            <button className="button secondary" type="button" onClick={resetPoints}>
              未入力に戻す
            </button>
            <button className="button" type="button" onClick={finishGame} disabled={isSaving}>
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
              {calculated.length ? calculated.map((result) => (
                <tr key={result.playerId}>
                  <td>{result.rank}位</td>
                  <td>{playerName(result.playerId)}</td>
                  <td>{result.points.toLocaleString()}</td>
                  <td>{result.score.toFixed(1)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="muted">4人分の点数を入力すると自動計算します。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
