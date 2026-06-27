"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = "store" | "player";

export function LoginPanel() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("store");
  const [storeEmail, setStoreEmail] = useState("owner@example.com");
  const [password, setPassword] = useState("password");
  const [playerEmail, setPlayerEmail] = useState("player1@store-demo.example.com");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function login() {
    setMessage("");
    setIsSaving(true);

    try {
      const email = role === "store" ? storeEmail : playerEmail;
      if (!email || !password) {
        setMessage("メールアドレスとパスワードを入力してください。");
        return;
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "ログインに失敗しました。");

      if (payload.user.role === "PLAYER" && payload.user.playerId) {
        router.push(`/players?playerId=${payload.user.playerId}`);
      } else {
        router.push("/store/players");
      }
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ログインに失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="login-card" aria-label="ログイン">
      <div className="login-tabs" role="tablist" aria-label="ログイン種別">
        <button
          className={role === "store" ? "active" : ""}
          type="button"
          onClick={() => setRole("store")}
        >
          店舗
        </button>
        <button
          className={role === "player" ? "active" : ""}
          type="button"
          onClick={() => setRole("player")}
        >
          プレイヤー
        </button>
      </div>

      {role === "store" ? (
        <div className="form">
          <div className="field">
            <label htmlFor="store-email">メールアドレス</label>
            <input
              id="store-email"
              type="email"
              value={storeEmail}
              onChange={(event) => setStoreEmail(event.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="store-password">パスワード</label>
            <input
              id="store-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>
        </div>
      ) : (
        <div className="form">
          <div className="field">
            <label htmlFor="player-email">メールアドレス</label>
            <input
              id="player-email"
              type="email"
              value={playerEmail}
              onChange={(event) => setPlayerEmail(event.target.value)}
              autoComplete="email"
            />
          </div>
        </div>
      )}

      <button className="button login-submit" type="button" onClick={login} disabled={isSaving}>
        ログイン
      </button>

      {message ? <div className="message error">{message}</div> : null}
    </section>
  );
}
