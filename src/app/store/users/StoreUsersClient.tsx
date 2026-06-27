"use client";

import { useState } from "react";

type ManagedPlayer = {
  id: string;
  name: string;
  managementNumber: string | null;
  isCheckedIn: boolean;
  checkedInAt: string | null;
  checkedOutAt: string | null;
};

export function StoreUsersClient({ players }: { players: ManagedPlayer[] }) {
  const [playerState, setPlayerState] = useState(players);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  async function updatePlayer(playerId: string, body: { managementNumber?: string | null; isCheckedIn?: boolean }) {
    setSavingId(playerId);
    setMessage(null);
    try {
      const response = await fetch(`/api/players/${playerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "更新に失敗しました。");
      setPlayerState((current) =>
        current.map((player) =>
          player.id === playerId
            ? {
                ...player,
                managementNumber: payload.player.managementNumber,
                isCheckedIn: payload.player.isCheckedIn,
                checkedInAt: payload.player.checkedInAt,
                checkedOutAt: payload.player.checkedOutAt,
              }
            : player,
        ),
      );
      setMessage({ type: "ok", text: "更新しました。" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "更新に失敗しました。" });
    } finally {
      setSavingId(null);
    }
  }

  function updateLocalNumber(playerId: string, value: string) {
    setPlayerState((current) =>
      current.map((player) => (player.id === playerId ? { ...player, managementNumber: value } : player)),
    );
  }

  function formatDate(value: string | null) {
    return value ? new Date(value).toLocaleString("ja-JP") : "-";
  }

  return (
    <section className="panel">
      {message ? <div className={`message ${message.type}`}>{message.text}</div> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>状態</th>
              <th>管理番号</th>
              <th>プレイヤー</th>
              <th>入場時刻</th>
              <th>退場時刻</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {playerState.map((player) => (
              <tr key={player.id}>
                <td>
                  <span className={`badge ${player.isCheckedIn ? "ok" : "idle"}`}>
                    {player.isCheckedIn ? "入場中" : "退場中"}
                  </span>
                </td>
                <td>
                  <input
                    aria-label={`${player.name} 管理番号`}
                    className="compact-input"
                    value={player.managementNumber ?? ""}
                    onBlur={(event) => updatePlayer(player.id, { managementNumber: event.target.value })}
                    onChange={(event) => updateLocalNumber(player.id, event.target.value)}
                    placeholder="任意"
                  />
                </td>
                <td>{player.name}</td>
                <td>{formatDate(player.checkedInAt)}</td>
                <td>{formatDate(player.checkedOutAt)}</td>
                <td>
                  <button
                    className={player.isCheckedIn ? "button secondary compact" : "button compact"}
                    type="button"
                    disabled={savingId === player.id}
                    onClick={() => updatePlayer(player.id, { isCheckedIn: !player.isCheckedIn })}
                  >
                    {player.isCheckedIn ? "退場" : "入場"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
