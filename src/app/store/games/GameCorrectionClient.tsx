"use client";

import { useMemo, useState } from "react";
import { calculateResults, type ScoreSettings } from "@/lib/scoring";

type GameItem = {
  id: string;
  tableNumber: number;
  category: "REGULAR" | "TOURNAMENT";
  tournamentName: string | null;
  finishedAt: string | null;
  players: { id: string; name: string; seat: number; finalPoints: number | null }[];
};

function toUnits(points: number | null) {
  return String(Math.trunc((points ?? 25000) / 100));
}

function fromUnits(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) * 100 : 0;
}

export function GameCorrectionClient({ games, scoreSettings }: { games: GameItem[]; scoreSettings: ScoreSettings }) {
  const [gameState, setGameState] = useState(games);
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const selectedGame = gameState.find((game) => game.id === gameId) ?? gameState[0];
  const [pointUnits, setPointUnits] = useState(selectedGame?.players.map((player) => toUnits(player.finalPoints)) ?? []);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const hasAllPoints = pointUnits.length === 4 && pointUnits.every((point) => point !== "");

  function selectGame(nextGameId: string) {
    const nextGame = gameState.find((game) => game.id === nextGameId);
    setGameId(nextGameId);
    setPointUnits(nextGame?.players.map((player) => toUnits(player.finalPoints)) ?? []);
    setMessage(null);
  }

  const calculated = useMemo(() => {
    if (!selectedGame || !hasAllPoints) return [];
    return calculateResults(
      selectedGame.players.map((player, index) => ({ playerId: player.id, points: fromUnits(pointUnits[index] ?? "0") })),
      scoreSettings,
    );
  }, [pointUnits, scoreSettings, selectedGame, hasAllPoints]);

  function playerName(playerId: string) {
    return selectedGame?.players.find((player) => player.id === playerId)?.name ?? "-";
  }

  async function saveCorrection() {
    if (!selectedGame) return;
    if (!hasAllPoints) {
      setMessage({ type: "error", text: "4人分の点数を入力してください。" });
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/games/${selectedGame.id}/correction`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          results: selectedGame.players.map((player, index) => ({ playerId: player.id, points: fromUnits(pointUnits[index] ?? "0") })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "成績修正に失敗しました。");
      setGameState((current) =>
        current.map((game) =>
          game.id === selectedGame.id
            ? {
                ...game,
                players: payload.game.players.map((gamePlayer: { seat: number; finalPoints: number | null; player: { id: string; name: string } }) => ({
                  id: gamePlayer.player.id,
                  name: gamePlayer.player.name,
                  seat: gamePlayer.seat,
                  finalPoints: gamePlayer.finalPoints,
                })),
              }
            : game,
        ),
      );
      setMessage({ type: "ok", text: "成績を修正しました。" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "成績修正に失敗しました。" });
    } finally {
      setIsSaving(false);
    }
  }

  if (!gameState.length) {
    return <section className="panel"><p className="muted">修正できる確定済み成績はありません。</p></section>;
  }

  return (
    <div className="grid two">
      <section className="panel">
        <h2>成績修正</h2>
        <div className="form">
          <div className="field">
            <label htmlFor="correction-game">半荘</label>
            <select id="correction-game" value={gameId} onChange={(event) => selectGame(event.target.value)}>
              {gameState.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.finishedAt ? new Date(game.finishedAt).toLocaleString("ja-JP") : "-"} / {game.tableNumber}卓 / {game.category === "TOURNAMENT" ? game.tournamentName ?? "大会" : "通常"}
                </option>
              ))}
            </select>
          </div>
          <div className="player-grid">
            {selectedGame.players.map((player, index) => (
              <div className="field" key={player.id}>
                <label className="point-label" htmlFor={`correction-${player.id}`}>
                  <span>{player.name}</span>
                  <strong>{player.seat}席</strong>
                </label>
                <div className="point-unit-input">
                  <input
                    id={`correction-${player.id}`}
                    type="number"
                    min="0"
                    value={pointUnits[index] ?? ""}
                    onChange={(event) => setPointUnits((current) => current.map((point, currentIndex) => currentIndex === index ? event.target.value.replace(/\D/g, "") : point))}
                  />
                  <span className="fixed-point-suffix">00</span>
                </div>
              </div>
            ))}
          </div>
          <div className="actions">
            <button className="button secondary" type="button" onClick={() => setPointUnits(["", "", "", ""])}>
              未入力に戻す
            </button>
            <button className="button" type="button" onClick={saveCorrection} disabled={isSaving}>
              修正を保存
            </button>
          </div>
          {message ? <div className={`message ${message.type}`}>{message.text}</div> : null}
        </div>
      </section>
      <section className="panel">
        <h2>再計算結果</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>順位</th><th>プレイヤー</th><th>点数</th><th>スコア</th></tr>
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
                  <td colSpan={4} className="muted">4人分の点数を入力すると再計算します。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
