"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ChangePasswordForm({ playerId }: { playerId: string | null }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function save() {
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "パスワード変更に失敗しました。");
      setMessage({ type: "ok", text: "パスワードを変更しました。" });
      router.push(playerId ? `/players?playerId=${playerId}` : "/players");
      router.refresh();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "パスワード変更に失敗しました。" });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="login-card" aria-label="パスワード変更">
      <div>
        <p className="login-kicker">First Login</p>
        <h2>パスワード変更</h2>
        <p className="login-description">初回ログインのため、新しいパスワードを設定してください。</p>
      </div>
      <div className="form">
        <div className="field">
          <label htmlFor="new-password">新しいパスワード</label>
          <input id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
        </div>
        <div className="field">
          <label htmlFor="confirm-password">確認用パスワード</label>
          <input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
        </div>
        <button className="button login-submit" type="button" onClick={save} disabled={isSaving}>
          変更して進む
        </button>
        {message ? <div className={`message ${message.type}`}>{message.text}</div> : null}
      </div>
    </section>
  );
}
