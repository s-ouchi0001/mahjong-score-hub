"use client";

import { useState } from "react";

type StoreSummary = {
  id: string;
  name: string;
  storeCode: string;
  tableCount: number;
  playerCount: number;
  checkedInCount: number;
  finishedGameCount: number;
  tournamentGameCount: number;
  staffCount: number;
};

export function SuperAdminPanel({ stores }: { stores: StoreSummary[] }) {
  const [storeState, setStoreState] = useState(stores);
  const [selectedStoreId, setSelectedStoreId] = useState(stores[0]?.id ?? "");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function postJson(url: string, body: Record<string, string | number>) {
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "保存に失敗しました。");
      setMessage({ type: "ok", text: "保存しました。画面を更新すると集計に反映されます。" });
      return payload;
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "保存に失敗しました。" });
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function createStore(formData: FormData) {
    const payload = await postJson("/api/super/stores", {
      name: String(formData.get("name") ?? ""),
      storeCode: String(formData.get("storeCode") ?? ""),
    });
    if (payload?.store) {
      setStoreState((current) => [
        ...current,
        {
          ...payload.store,
          tableCount: 0,
          playerCount: 0,
          checkedInCount: 0,
          finishedGameCount: 0,
          tournamentGameCount: 0,
          staffCount: 0,
        },
      ]);
      setSelectedStoreId(payload.store.id);
    }
  }

  async function createStaff(formData: FormData) {
    await postJson("/api/super/staff", {
      storeId: String(formData.get("storeId") ?? ""),
      loginId: String(formData.get("loginId") ?? ""),
      name: String(formData.get("name") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
  }

  async function createTable(formData: FormData) {
    await postJson("/api/super/tables", {
      storeId: String(formData.get("storeId") ?? ""),
      tableNumber: Number(formData.get("tableNumber") ?? 0),
      deviceId: String(formData.get("deviceId") ?? ""),
    });
  }

  return (
    <div className="super-layout">
      <section className="panel">
        <h2>利用状況サマリ</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>店舗</th>
                <th>店舗ID</th>
                <th>卓</th>
                <th>ユーザ</th>
                <th>入場中</th>
                <th>半荘</th>
                <th>大会</th>
                <th>スタッフ</th>
              </tr>
            </thead>
            <tbody>
              {storeState.map((store) => (
                <tr key={store.id}>
                  <td>{store.name}</td>
                  <td>{store.storeCode}</td>
                  <td>{store.tableCount}</td>
                  <td>{store.playerCount}</td>
                  <td>{store.checkedInCount}</td>
                  <td>{store.finishedGameCount}</td>
                  <td>{store.tournamentGameCount}</td>
                  <td>{store.staffCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>雀荘を追加</h2>
        <form className="form" action={createStore}>
          <div className="field">
            <label htmlFor="super-store-name">雀荘名</label>
            <input id="super-store-name" name="name" type="text" placeholder="例: 中央店" />
          </div>
          <div className="field">
            <label htmlFor="super-store-code">店舗ID</label>
            <input id="super-store-code" name="storeCode" type="text" placeholder="例: CHUO" />
          </div>
          <button className="button" type="submit" disabled={isSaving}>
            追加
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>雀荘スタッフを追加</h2>
        <form className="form" action={createStaff}>
          <div className="field">
            <label htmlFor="super-staff-store">店舗</label>
            <select id="super-staff-store" name="storeId" value={selectedStoreId} onChange={(event) => setSelectedStoreId(event.target.value)}>
              {storeState.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
          <div className="player-grid">
            <div className="field">
              <label htmlFor="super-staff-login">ログインID</label>
              <input id="super-staff-login" name="loginId" type="text" placeholder="例: STAFF01" />
            </div>
            <div className="field">
              <label htmlFor="super-staff-name">スタッフ名</label>
              <input id="super-staff-name" name="name" type="text" />
            </div>
            <div className="field">
              <label htmlFor="super-staff-password">初期パスワード</label>
              <input id="super-staff-password" name="password" type="text" />
            </div>
          </div>
          <button className="button" type="submit" disabled={isSaving}>
            作成
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>卓を追加</h2>
        <form className="form" action={createTable}>
          <div className="field">
            <label htmlFor="super-table-store">店舗</label>
            <select id="super-table-store" name="storeId" defaultValue={selectedStoreId}>
              {storeState.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
          <div className="player-grid">
            <div className="field">
              <label htmlFor="super-table-number">卓番号</label>
              <input id="super-table-number" name="tableNumber" type="number" min="1" />
            </div>
            <div className="field">
              <label htmlFor="super-table-device">端末ID</label>
              <input id="super-table-device" name="deviceId" type="text" placeholder="未入力なら自動" />
            </div>
          </div>
          <button className="button" type="submit" disabled={isSaving}>
            追加
          </button>
        </form>
      </section>

      {message ? <div className={`message ${message.type}`}>{message.text}</div> : null}
    </div>
  );
}
