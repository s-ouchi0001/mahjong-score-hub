"use client";

import { useMemo, useState } from "react";
import { calculateResults } from "@/lib/scoring";

type ActiveGame = {
  id: string;
  tableNumber: number;
  players: {
    id: string;
    name: string;
    seat: number;
    currentPoints: number;
  }[];
};

export function ScoreEntry({ games }: { games: ActiveGame[] }) {
  const [gameState, setGameState] = useState(games);
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const selectedGame = gameState.find((game) => game.id === gameId) ?? gameState[0];
  const [points, setPoints] = useState<number[]>(selectedGame?.players.map((player) => player.currentPoints) ?? [25000, 25000, 25000, 25000]);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function selectGame(nextGameId: string) {
    const nextGame = gameState.find((game) => game.id === nextGameId);
    setGameId(nextGameId);
    setPoints(nextGame?.players.map((player) => player.currentPoints) ?? [25000, 25000, 25000, 25000]);
    setMessage(null);
  }

  function updatePoints(index: number, value: string) {
    const parsed = Number(value);
    setPoints((current) => current.map((point, currentIndex) => (currentIndex === index ? parsed : point)));
  }

  const calculated = useMemo(() => {
    if (!selectedGame) return [];
    return calculateResults(
      selectedGame.players.map((player, index) => ({
        playerId: player.id,
        points: points[index] ?? 0,
      })),
    );
  }, [selectedGame, points]);

  function playerName(playerId: string) {
    return selectedGame?.players.find((player) => player.id === playerId)?.name ?? "-";
  }

  async function finishGame() {
    if (!selectedGame) return;
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
        setPoints(nextGames[0]?.players.map((player) => player.currentPoints) ?? [25000, 25000, 25000, 25000]);
        return nextGames;
      });
      setMessage({ type: "ok", text: `${selectedGame.tableNumber}卓の結果を確定しました。` });
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
        <h2>成績入力</h2>
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

          <div className="player-grid">
            {selectedGame.players.map((player, index) => (
              <div className="field" key={player.id}>
                <label htmlFor={`point-${player.id}`}>{player.name} 最終点数</label>
                <input
                  id={`point-${player.id}`}
                  type="number"
                  step="100"
                  value={points[index] ?? 0}
                  onChange={(event) => updatePoints(index, event.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="actions">
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
      </section>
    </div>
  );
}
