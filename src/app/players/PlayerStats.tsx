"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type PlayerOption = {
  id: string;
  name: string;
};

type TournamentOption = {
  id: string;
  name: string;
};

type StatsMode = "total" | "recent" | "month" | "tournament";
type CategoryFilter = "all" | "regular" | "tournament";

type StatsPayload = {
  player: PlayerOption;
  mode: StatsMode;
  category: CategoryFilter;
  month: string;
  stats: {
    gameCount: number;
    averageRank: number;
    topRate: number;
    lastRate: number;
    firstRate: number;
    secondRate: number;
    thirdRate: number;
    fourthRate: number;
    averageScore: number;
    totalScore: number;
    dan: string;
    jankiPoint: number;
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
  tournaments,
}: {
  players: PlayerOption[];
  lockedPlayerId: string | null;
  tournaments: TournamentOption[];
}) {
  const searchParams = useSearchParams();
  const initialPlayerId = searchParams.get("playerId");
  const [playerId, setPlayerId] = useState(lockedPlayerId ?? initialPlayerId ?? players[0]?.id ?? "");
  const [mode, setMode] = useState<StatsMode>("total");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [tournamentId, setTournamentId] = useState(tournaments[0]?.id ?? "");
  const [payload, setPayload] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    const params = new URLSearchParams({ mode });
    if (mode === "month") {
      params.set("month", month);
      params.set("category", category);
    }
    if (mode === "tournament" && tournamentId) params.set("tournamentId", tournamentId);
    fetch(`/api/players/${playerId}/stats?${params.toString()}`)
      .then((response) => response.json())
      .then(setPayload)
      .finally(() => setLoading(false));
  }, [playerId, mode, tournamentId, month, category]);

  return (
    <div className="grid">
      <section className="player-rating-overview" aria-label="段位と雀力ポイント">
        <div className="rating-hero">
          <div>
            <span>段位</span>
            <strong>{payload?.stats.dan ?? "新人"}</strong>
          </div>
          <div>
            <span>
              雀力ポイント
              <Link className="help-link" href="/janki-point">説明</Link>
            </span>
            <strong>{payload?.stats.jankiPoint.toLocaleString() ?? "1,000"}</strong>
          </div>
        </div>
      </section>

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
        <div className="score-entry-heading player-stats-toolbar">
          <h2>プレイヤー成績 <span className="heading-subname">{payload?.player.name ?? ""} {loading ? "集計中" : ""}</span></h2>
          <div className="stats-select-row">
            <div className="field">
              <label htmlFor="stats-mode">表示</label>
              <select id="stats-mode" value={mode} onChange={(event) => setMode(event.target.value as StatsMode)}>
                <option value="total">通算</option>
                <option value="recent">直近</option>
                <option value="month">月別</option>
                <option value="tournament">大会</option>
              </select>
            </div>
            {mode === "month" ? (
              <>
                <div className="field">
                  <label htmlFor="stats-month">月</label>
                  <input id="stats-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="stats-category">区分</label>
                  <select id="stats-category" value={category} onChange={(event) => setCategory(event.target.value as CategoryFilter)}>
                    <option value="all">全て</option>
                    <option value="regular">通常</option>
                    <option value="tournament">大会</option>
                  </select>
                </div>
              </>
            ) : null}
            {mode === "tournament" ? (
              <div className="field">
                <label htmlFor="stats-tournament">大会</label>
                <select id="stats-tournament" value={tournamentId} onChange={(event) => setTournamentId(event.target.value)}>
                  {tournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.name}
                    </option>
                  ))}
                  {!tournaments.length ? <option value="">大会未登録</option> : null}
                </select>
              </div>
            ) : null}
          </div>
        </div>
        <div className="metric-grid">
          <div className="metric score-emphasis">
            <span>累計スコア</span>
            <strong>{payload?.stats.totalScore.toFixed(1) ?? "0.0"}</strong>
          </div>
          <div className="metric">
            <span>半荘数</span>
            <strong>{payload?.stats.gameCount ?? 0}</strong>
          </div>
          <div className="metric">
            <span>平均順位</span>
            <strong>{payload?.stats.averageRank.toFixed(2) ?? "0.00"}</strong>
          </div>
          <div className="metric">
            <span>1着率</span>
            <strong>{payload?.stats.firstRate.toFixed(1) ?? "0.0"}%</strong>
          </div>
          <div className="metric">
            <span>2着率</span>
            <strong>{payload?.stats.secondRate.toFixed(1) ?? "0.0"}%</strong>
          </div>
          <div className="metric">
            <span>3着率</span>
            <strong>{payload?.stats.thirdRate.toFixed(1) ?? "0.0"}%</strong>
          </div>
          <div className="metric">
            <span>4着率</span>
            <strong>{payload?.stats.fourthRate.toFixed(1) ?? "0.0"}%</strong>
          </div>
          <div className="metric">
            <span>平均スコア</span>
            <strong>{payload?.stats.averageScore.toFixed(1) ?? "0.0"}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>{mode === "recent" ? "直近10半荘" : mode === "month" ? `${month} 成績` : mode === "tournament" ? "大会成績" : "成績履歴"}</h2>
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
