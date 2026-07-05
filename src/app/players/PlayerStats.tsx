"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type PlayerOption = {
  id: string;
  name: string;
};

type StatsMode = "total" | "recent" | "tournament";

type StatsPayload = {
  player: PlayerOption;
  mode: StatsMode;
  stats: {
    gameCount: number;
    averageRank: number;
    topRate: number;
    lastRate: number;
    averageScore: number;
    totalScore: number;
    recentGames: {
      gameId: string;
      tableNumber: number;
      category: "REGULAR" | "TOURNAMENT";
      finishedAt: string | null;
      finalPoints: number | null;
      rank: number | null;
      score: number | null;
    }[];
  };
};

export function PlayerStats({
  players,
  lockedPlayerId,
}: {
  players: PlayerOption[];
  lockedPlayerId: string | null;
}) {
  const searchParams = useSearchParams();
  const initialPlayerId = searchParams.get("playerId");
  const [playerId, setPlayerId] = useState(lockedPlayerId ?? initialPlayerId ?? players[0]?.id ?? "");
  const [mode, setMode] = useState<StatsMode>("total");
  const [payload, setPayload] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    fetch(`/api/players/${playerId}/stats?mode=${mode}`)
      .then((response) => response.json())
      .then(setPayload)
      .finally(() => setLoading(false));
  }, [playerId, mode]);

  return (
    <div className="grid">
      {lockedPlayerId ? null : (
        <section className="panel">
          <div className="field">
            <label htmlFor="player">プレイヤー</label>
            <select id="player" value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="score-entry-heading">
          <h2>{payload?.player.name ?? "成績"} {loading ? "集計中" : ""}</h2>
          <div className="segment-control compact-segment" role="group" aria-label="成績表示">
            <button className={mode === "total" ? "active" : ""} type="button" onClick={() => setMode("total")}>
              通算
            </button>
            <button className={mode === "recent" ? "active" : ""} type="button" onClick={() => setMode("recent")}>
              直近
            </button>
            <button className={mode === "tournament" ? "active" : ""} type="button" onClick={() => setMode("tournament")}>
              大会
            </button>
          </div>
        </div>
        <div className="metric-grid">
          <div className="metric">
            <span>半荘数</span>
            <strong>{payload?.stats.gameCount ?? 0}</strong>
          </div>
          <div className="metric">
            <span>平均順位</span>
            <strong>{payload?.stats.averageRank.toFixed(2) ?? "0.00"}</strong>
          </div>
          <div className="metric">
            <span>トップ率</span>
            <strong>{payload?.stats.topRate.toFixed(1) ?? "0.0"}%</strong>
          </div>
          <div className="metric">
            <span>ラス率</span>
            <strong>{payload?.stats.lastRate.toFixed(1) ?? "0.0"}%</strong>
          </div>
          <div className="metric">
            <span>平均スコア</span>
            <strong>{payload?.stats.averageScore.toFixed(1) ?? "0.0"}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>{mode === "recent" ? "直近10半荘" : mode === "tournament" ? "大会成績" : "累計スコア"} {payload?.stats.totalScore.toFixed(1) ?? "0.0"}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>日時</th>
                <th>区分</th>
                <th>卓</th>
                <th>順位</th>
                <th>最終点数</th>
                <th>スコア</th>
              </tr>
            </thead>
            <tbody>
              {payload?.stats.recentGames.length ? (
                payload.stats.recentGames.map((game) => (
                  <tr key={game.gameId}>
                    <td>{game.finishedAt ? new Date(game.finishedAt).toLocaleString("ja-JP") : "-"}</td>
                    <td>
                      <span className={`badge ${game.category === "TOURNAMENT" ? "warn" : "idle"}`}>
                        {game.category === "TOURNAMENT" ? "大会" : "通常"}
                      </span>
                    </td>
                    <td>{game.tableNumber}卓</td>
                    <td>{game.rank}位</td>
                    <td>{game.finalPoints?.toLocaleString() ?? "-"}</td>
                    <td>{game.score?.toFixed(1) ?? "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="muted">
                    確定済みの半荘はまだありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
