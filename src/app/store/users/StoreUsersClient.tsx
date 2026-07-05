"use client";

import { useMemo, useState } from "react";

type ManagedPlayer = {
  id: string;
  name: string;
  managementNumber: string | null;
  isCheckedIn: boolean;
  checkedInAt: string | null;
  checkedOutAt: string | null;
};

export function StoreUsersClient({
  players,
  storeCode,
  loginBaseUrl,
}: {
  players: ManagedPlayer[];
  storeCode: string;
  loginBaseUrl: string;
}) {
  const [playerState, setPlayerState] = useState(players);
  const [passwordInputs, setPasswordInputs] = useState<Record<string, string>>({});
  const [searchText, setSearchText] = useState("");
  const [qrPlayer, setQrPlayer] = useState<ManagedPlayer | null>(null);
  const [newPlayer, setNewPlayer] = useState({
    name: "",
    managementNumber: "",
    password: "",
    isCheckedIn: true,
  });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const filteredPlayers = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return playerState;

    return playerState.filter((player) => {
      const status = player.isCheckedIn ? "入場中" : "退場中";
      return [player.name, player.managementNumber ?? "", status].some((value) => value.toLowerCase().includes(keyword));
    });
  }, [playerState, searchText]);

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
      setNewPlayer({ name: "", managementNumber: "", password: "", isCheckedIn: true });
      setMessage({ type: "ok", text: "ユーザを追加しました。" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "追加に失敗しました。" });
    } finally {
      setSavingId(null);
    }
  }

  async function updatePlayer(playerId: string, body: { name?: string; managementNumber?: string | null; isCheckedIn?: boolean; password?: string }) {
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

  async function changePassword(player: ManagedPlayer) {
    const password = passwordInputs[player.id]?.trim() ?? "";
    if (!password) {
      setMessage({ type: "error", text: "新しいパスワードを入力してください。" });
      return;
    }
    if (!window.confirm(`${player.name}さんのパスワードを変更します。よろしいですか？`)) return;

    await updatePlayer(player.id, { password });
    setPasswordInputs((current) => ({ ...current, [player.id]: "" }));
  }

  function updateLocalPlayer(playerId: string, body: Partial<ManagedPlayer>) {
    setPlayerState((current) =>
      current.map((player) => (player.id === playerId ? { ...player, ...body } : player)),
    );
  }

  function formatDate(value: string | null) {
    return value ? new Date(value).toLocaleString("ja-JP") : "-";
  }

  function loginUrl(player: ManagedPlayer) {
    const url = new URL(loginBaseUrl);
    url.searchParams.set("storeCode", storeCode);
    url.searchParams.set("loginId", player.managementNumber ?? "");
    return url.toString();
  }

  function qrImageUrl(player: ManagedPlayer) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(loginUrl(player))}`;
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
              <label htmlFor="new-number">ユーザID</label>
              <input id="new-number" value={newPlayer.managementNumber} onChange={(event) => setNewPlayer((current) => ({ ...current, managementNumber: event.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="new-password">初期パスワード</label>
              <input id="new-password" type="password" value={newPlayer.password} onChange={(event) => setNewPlayer((current) => ({ ...current, password: event.target.value }))} autoComplete="new-password" />
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
        <div className="user-list-toolbar">
          <div className="field">
            <label htmlFor="user-search">ユーザ検索</label>
            <input
              id="user-search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="名前・ユーザID・入場状態"
            />
          </div>
          <span className="muted">
            {filteredPlayers.length} / {playerState.length}件
          </span>
        </div>
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>状態</th>
              <th>ユーザID</th>
              <th>プレイヤー</th>
              <th>パスワード</th>
              <th>入場時刻</th>
              <th>退場時刻</th>
              <th>QR</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredPlayers.map((player) => (
              <tr key={player.id}>
                <td>
                  <span className={`badge ${player.isCheckedIn ? "ok" : "idle"}`}>
                    {player.isCheckedIn ? "入場中" : "退場中"}
                  </span>
                </td>
                <td>
                  <input
                    aria-label={`${player.name} ユーザID`}
                    className="compact-input"
                    value={player.managementNumber ?? ""}
                    onBlur={(event) => updatePlayer(player.id, { managementNumber: event.target.value })}
                    onChange={(event) => updateLocalPlayer(player.id, { managementNumber: event.target.value })}
                    placeholder="ログインID"
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
                <td>
                  <div className="password-cell">
                    <span className="muted">表示不可</span>
                    <input
                      aria-label={`${player.name} 新しいパスワード`}
                      className="compact-input password-input"
                      type="password"
                      value={passwordInputs[player.id] ?? ""}
                      onChange={(event) => setPasswordInputs((current) => ({ ...current, [player.id]: event.target.value }))}
                      placeholder="新パスワード"
                      autoComplete="new-password"
                    />
                    <button
                      className="button secondary compact"
                      type="button"
                      disabled={savingId === player.id}
                      onClick={() => changePassword(player)}
                    >
                      変更
                    </button>
                  </div>
                </td>
                <td>{formatDate(player.checkedInAt)}</td>
                <td>{formatDate(player.checkedOutAt)}</td>
                <td>
                  <button
                    className="button secondary compact"
                    type="button"
                    disabled={!player.managementNumber}
                    onClick={() => setQrPlayer(player)}
                  >
                    QR
                  </button>
                </td>
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
            {!filteredPlayers.length ? (
              <tr>
                <td colSpan={8}>
                  <span className="muted">該当するユーザはいません。</span>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </div>
      </section>
      {qrPlayer ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${qrPlayer.name} ログインQR`}>
          <section className="modal-panel">
            <div className="list-header">
              <div>
                <h2>{qrPlayer.name} ログインQR</h2>
                <p className="muted">店舗IDとユーザIDを入力済みのログインURLです。</p>
              </div>
              <button className="button secondary compact" type="button" onClick={() => setQrPlayer(null)}>
                閉じる
              </button>
            </div>
            <div className="qr-layout">
              <img src={qrImageUrl(qrPlayer)} alt={`${qrPlayer.name} ログインQR`} width={220} height={220} />
              <div className="form">
                <div className="field">
                  <label>店舗ID</label>
                  <input readOnly value={storeCode} />
                </div>
                <div className="field">
                  <label>ユーザID</label>
                  <input readOnly value={qrPlayer.managementNumber ?? ""} />
                </div>
                <div className="field">
                  <label>URL</label>
                  <textarea readOnly rows={3} value={loginUrl(qrPlayer)} />
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
      </div>
  );
}
