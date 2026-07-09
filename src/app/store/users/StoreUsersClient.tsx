"use client";

import { useMemo, useState } from "react";

type ManagedPlayer = {
  id: string;
  name: string;
  managementNumber: string | null;
  isCheckedIn: boolean;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  visitCount: number;
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
  const [searchText, setSearchText] = useState("");
  const [qrPlayer, setQrPlayer] = useState<ManagedPlayer | null>(null);
  const [passwordPlayer, setPasswordPlayer] = useState<ManagedPlayer | null>(null);
  const [passwordValue, setPasswordValue] = useState("");
  const [newPlayer, setNewPlayer] = useState({
    name: "",
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
          visitCount: payload.player.visitCount,
        },
      ]);
      setNewPlayer({ name: "", isCheckedIn: true });
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
                visitCount: payload.player.visitCount,
              }
            : player,
        ),
      );
      setMessage({ type: "ok", text: "更新しました。" });
      return true;
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "更新に失敗しました。" });
      return false;
    } finally {
      setSavingId(null);
    }
  }

  async function changePassword() {
    if (!passwordPlayer) return;
    const password = passwordValue.trim();
    if (!password) {
      setMessage({ type: "error", text: "新しいパスワードを入力してください。" });
      return;
    }

    const ok = await updatePlayer(passwordPlayer.id, { password });
    if (!ok) return;
    setPasswordValue("");
    setPasswordPlayer(null);
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
              <label>ユーザID</label>
              <div className="readonly-setting">
                <strong>自動採番</strong>
                <span>10000から店舗横断で連番</span>
              </div>
            </div>
            <div className="field">
              <label>初期パスワード</label>
              <div className="readonly-setting">
                <strong>0000</strong>
                <span>初回ログイン時に変更します</span>
              </div>
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
              <th>操作</th>
              <th>ユーザID</th>
              <th>プレイヤー</th>
              <th>入場時間</th>
              <th>退場時間</th>
              <th>累積来店回数</th>
              <th>QR</th>
              <th>パスワード変更</th>
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
                  <button
                    className={player.isCheckedIn ? "button secondary compact" : "button compact"}
                    type="button"
                    disabled={savingId === player.id}
                    onClick={() => updatePlayer(player.id, { isCheckedIn: !player.isCheckedIn })}
                  >
                    {player.isCheckedIn ? "退場" : "入場"}
                  </button>
                </td>
                <td>
                  <span className="fixed-id">{player.managementNumber ?? "-"}</span>
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
                <td>{player.visitCount.toLocaleString()}回</td>
                <td>
                  <button
                    className="button secondary compact"
                    type="button"
                    disabled={!player.managementNumber}
                    onClick={() => {
                      setQrPlayer(player);
                    }}
                  >
                    QR
                  </button>
                </td>
                <td>
                  <button
                    className="button secondary compact"
                    type="button"
                    disabled={savingId === player.id}
                    onClick={() => {
                      setPasswordPlayer(player);
                      setPasswordValue("");
                      setMessage(null);
                    }}
                  >
                    変更
                  </button>
                </td>
              </tr>
            ))}
            {!filteredPlayers.length ? (
              <tr>
                <td colSpan={9}>
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
              <div className="qr-preview-card">
                <img src={qrImageUrl(qrPlayer)} alt={`${qrPlayer.name} ログインQR`} width={220} height={220} />
                <p className="initial-password">初回パスワード 0000</p>
              </div>
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
      {passwordPlayer ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${passwordPlayer.name} パスワード変更`}>
          <section className="modal-panel password-modal">
            <div className="list-header">
              <div>
                <h2>{passwordPlayer.name} パスワード変更</h2>
                <p className="muted">変更後、次回ログイン時に本人が再設定します。</p>
              </div>
              <button className="button secondary compact" type="button" onClick={() => setPasswordPlayer(null)}>
                閉じる
              </button>
            </div>
            <div className="form">
              <div className="field">
                <label htmlFor="password-reset-value">新しい仮パスワード</label>
                <input
                  id="password-reset-value"
                  type="password"
                  value={passwordValue}
                  onChange={(event) => setPasswordValue(event.target.value)}
                  autoComplete="new-password"
                  autoFocus
                />
              </div>
              <div className="actions">
                <button className="button" type="button" disabled={savingId === passwordPlayer.id} onClick={changePassword}>
                  パスワードを変更
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
      </div>
  );
}
