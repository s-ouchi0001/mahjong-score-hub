"use client";

import { useState } from "react";

type Tournament = {
  id: string;
  name: string;
  startsAt: string | Date | null;
  endsAt: string | Date | null;
};

export function StoreSettingsClient({ tournaments }: { tournaments: Tournament[] }) {
  const [items, setItems] = useState(tournaments);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function createTournament() {
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "大会登録に失敗しました。");
      setItems((current) => (current.some((item) => item.id === payload.tournament.id) ? current : [payload.tournament, ...current]));
      setName("");
      setMessage({ type: "ok", text: "大会を登録しました。卓管理で大会卓に割り当てできます。" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "大会登録に失敗しました。" });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid two">
      <section className="panel">
        <h2>大会登録</h2>
        <div className="form">
          <div className="field">
            <label htmlFor="tournament-name">大会名</label>
            <input
              id="tournament-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例: 7月度 月例大会"
            />
          </div>
          <div className="actions">
            <button className="button" type="button" onClick={createTournament} disabled={isSaving}>
              大会を登録
            </button>
          </div>
          {message ? <div className={`message ${message.type}`}>{message.text}</div> : null}
        </div>
      </section>

      <section className="panel">
        <h2>登録済み大会</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>大会名</th>
                <th>登録日</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((tournament) => (
                  <tr key={tournament.id}>
                    <td>{tournament.name}</td>
                    <td>{tournament.startsAt ? new Date(tournament.startsAt).toLocaleDateString("ja-JP") : "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="muted">
                    登録済み大会はありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>今後追加する設定</h2>
        <div className="setting-placeholder-list">
          <div>
            <strong>順位点・返し点</strong>
            <span>現在は25,000点持ち、順位点固定で自動計算しています。</span>
          </div>
          <div>
            <strong>段位・雀力ポイント</strong>
            <span>現在は成績から自動算出しています。店舗ごとの係数調整をここに追加できます。</span>
          </div>
          <div>
            <strong>卓・大会運用</strong>
            <span>大会登録後、卓管理で通常卓または大会卓に割り当てます。</span>
          </div>
        </div>
      </section>
    </div>
  );
}
