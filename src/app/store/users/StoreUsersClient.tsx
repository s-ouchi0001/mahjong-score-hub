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
  const [newPlayer, setNewPlayer] = useState({
    name: "",
    managementNumber: "",
    email: "",
    password: "password",
    isCheckedIn: true,
  });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  async function createPlayer() {
    setSavingId("new");
    setMessage(null);
    try {
      const response = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPlayer),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "追加に失敗しました。");
      setPlayerState((current) => [
        ...current,
        {
          id: payload.player.id,
          name: payload.player.name,
          managementNumber: payload.player.managementNumber,
          isCheckedIn: payload.player.isCheckedIn,
          checkedInAt: payload.player.checkedInAt,
          checkedOutAt: payload.player.checkedOutAt,
        },
      ]);
      setNewPlayer({ name: "", managementNumber: "", email: "", password: "password", isCheckedIn: true });
      setMessage({ type: "ok", text: "ユーザを追加しました。" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "追加に失敗しました。" });
    } finally {
      setSavingId(null);
    }
  }

  async function updatePlayer(playerId: string, body: { name?: string; managementNumber?: string | null; isCheckedIn?: boolean }) {
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
                name: payload.player.name,
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

  function updateLocalPlayer(playerId: string, body: Partial<ManagedPlayer>) {
    setPlayerState((current) =>
      current.map((player) => (player.id === playerId ? { ...player, ...body } : player)),
    );
  }

  function formatDate(value: string | null) {
    return value ? new Date(value).toLocaleString("ja-JP") : "-";
  }

  return (
    <div className="grid">
      <section className="panel">
        <h2>ユーザ追加</h2>
        <div className="form">
          <div className="user-form-grid">
            <div className="field">
              <label htmlFor="new-name">名前</label>
              <input id="new-name" value={newPlayer.name} onChange={(event) => setNewPlayer((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="new-number">管理番号</label>
              <input id="new-number" value={newPlayer.managementNumber} onChange={(event) => setNewPlayer((current) => ({ ...current, managementNumber: event.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="new-email">メール</label>
              <input id="new-email" type="email" value={newPlayer.email} onChange={(event) => setNewPlayer((current) => ({ ...current, email: event.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="new-password">初期パスワード</label>
              <input id="new-password" type="text" value={newPlayer.password} onChange={(event) => setNewPlayer((current) => ({ ...current, password: event.target.value }))} />
            </div>
          </div>
          <label className="check-line">
            <input
              type="checkbox"
              checked={newPlayer.isCheckedIn}
              onChange={(event) => setNewPlayer((current) => ({ ...current, isCheckedIn: event.target.checked }))}
            />
            入場中として追加
          </label>
          <div className="actions">
            <button className="button" type="button" onClick={createPlayer} disabled={savingId === "new"}>
              追加
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>登録済みユーザ</h2>
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
                    onChange={(event) => updateLocalPlayer(player.id, { managementNumber: event.target.value })}
                    placeholder="任意"
                  />
                </td>
                <td>
                  <input
                    aria-label={`${player.name} 名前`}
                    className="compact-input name-input"
                    value={player.name}
                    onBlur={(event) => updatePlayer(player.id, { name: event.target.value })}
                    onChange={(event) => updateLocalPlayer(player.id, { name: event.target.value })}
                  />
                </td>
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
      </div>
  );
}
