"use client";

import Link from "next/link";
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
    }
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
                <th>詳細</th>
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
                  <td>
                    <Link className="button secondary compact" href={`/super/stores/${store.id}`}>
                      開く
                    </Link>
                  </td>
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

      {message ? <div className={`message ${message.type}`}>{message.text}</div> : null}
    </div>
  );
}
