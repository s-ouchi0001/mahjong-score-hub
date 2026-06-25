"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type PlayerOption = {
  id: string;
  name: string;
};

type StatsPayload = {
  player: PlayerOption;
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
      finishedAt: string | null;
      finalPoints: number | null;
      rank: number | null;
      score: number | null;
    }[];
  };
};

export function PlayerStats({ players }: { players: PlayerOption[] }) {
  const searchParams = useSearchParams();
  const initialPlayerId = searchParams.get("playerId");
  const [playerId, setPlayerId] = useState(initialPlayerId ?? players[0]?.id ?? "");
  const [payload, setPayload] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    fetch(`/api/players/${playerId}/stats`)
      .then((response) => response.json())
      .then(setPayload)
      .finally(() => setLoading(false));
  }, [playerId]);

  return (
    <div className="grid">
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

      <section className="panel">
        <h2>{payload?.player.name ?? "成績"} {loading ? "集計中" : ""}</h2>
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
        <h2>累計スコア {payload?.stats.totalScore.toFixed(1) ?? "0.0"}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>日時</th>
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
                    <td>{game.tableNumber}卓</td>
                    <td>{game.rank}位</td>
                    <td>{game.finalPoints?.toLocaleString() ?? "-"}</td>
                    <td>{game.score?.toFixed(1) ?? "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="muted">
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
