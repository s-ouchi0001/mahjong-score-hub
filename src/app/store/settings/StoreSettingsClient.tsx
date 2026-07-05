"use client";

import { useState } from "react";

type Tournament = {
  id: string;
  name: string;
  startsAt: string | Date | null;
  endsAt: string | Date | null;
};

type ScoreSettings = {
  startingPoint: number;
  returnPoint: number;
  firstPlaceBonus: number;
  secondPlaceBonus: number;
  thirdPlaceBonus: number;
  fourthPlaceBonus: number;
};

export function StoreSettingsClient({
  tournaments,
  scoreSettings,
}: {
  tournaments: Tournament[];
  scoreSettings: ScoreSettings;
}) {
  const [items, setItems] = useState(tournaments);
  const [settings, setSettings] = useState(scoreSettings);
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

  async function saveScoreSettings() {
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/store/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "スコア設定の保存に失敗しました。");
      setSettings(payload.store);
      setMessage({ type: "ok", text: "スコア設定を保存しました。次回以降の成績確定から反映されます。" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "スコア設定の保存に失敗しました。" });
    } finally {
      setIsSaving(false);
    }
  }

  function updateSetting(key: keyof ScoreSettings, value: string) {
    setSettings((current) => ({ ...current, [key]: Number(value) }));
  }

  return (
    <div className="grid two">
      <section className="panel">
        <h2>スコア設定</h2>
        <div className="form">
          <div className="user-form-grid">
            <div className="field">
              <label htmlFor="starting-point">持ち点</label>
              <input id="starting-point" type="number" step="100" value={settings.startingPoint} onChange={(event) => updateSetting("startingPoint", event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="return-point">返し点</label>
              <input id="return-point" type="number" step="100" value={settings.returnPoint} onChange={(event) => updateSetting("returnPoint", event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="first-bonus">1位 順位点</label>
              <input id="first-bonus" type="number" value={settings.firstPlaceBonus} onChange={(event) => updateSetting("firstPlaceBonus", event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="second-bonus">2位 順位点</label>
              <input id="second-bonus" type="number" value={settings.secondPlaceBonus} onChange={(event) => updateSetting("secondPlaceBonus", event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="third-bonus">3位 順位点</label>
              <input id="third-bonus" type="number" value={settings.thirdPlaceBonus} onChange={(event) => updateSetting("thirdPlaceBonus", event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fourth-bonus">4位 順位点</label>
              <input id="fourth-bonus" type="number" value={settings.fourthPlaceBonus} onChange={(event) => updateSetting("fourthPlaceBonus", event.target.value)} />
            </div>
          </div>
          <button className="button" type="button" onClick={saveScoreSettings} disabled={isSaving}>
            スコア設定を保存
          </button>
          {message ? <div className={`message ${message.type}`}>{message.text}</div> : null}
        </div>
      </section>

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
            <span>この画面で店舗ごとの計算ルールを変更できます。</span>
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
