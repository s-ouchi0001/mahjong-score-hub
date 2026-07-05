"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LoginRole = "PLAYER" | "STORE_ADMIN";

type LoginFormProps = {
  role: LoginRole;
  title: string;
  description: string;
  defaultIdentifier?: string;
  defaultPassword?: string;
  identifierLabel: string;
};

async function readLoginResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as { error?: string; user?: { role?: "SUPER_ADMIN" | "STORE_ADMIN" | "PLAYER"; playerId?: string | null } };
  } catch {
    return null;
  }
}

export function LoginForm({ role, title, description, defaultIdentifier = "", defaultPassword = "", identifierLabel }: LoginFormProps) {
  const router = useRouter();
  const [storeCode, setStoreCode] = useState("");
  const [identifier, setIdentifier] = useState(defaultIdentifier);
  const [password, setPassword] = useState(defaultPassword);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function login() {
    setMessage("");
    setIsSaving(true);

    try {
      if (role === "PLAYER" && !storeCode.trim()) {
        setMessage("店舗IDを入力してください。");
        return;
      }
      if (!identifier || !password) {
        setMessage(`${identifierLabel}とパスワードを入力してください。`);
        return;
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          role,
          ...(role === "PLAYER" ? { storeCode, loginId: identifier } : { email: identifier }),
        }),
      });
      const payload = await readLoginResponse(response);
      if (!response.ok) {
        throw new Error(payload?.error ?? "ログイン処理でエラーが発生しました。時間をおいて再度お試しください。");
      }
      if (!payload?.user) {
        throw new Error("ログイン情報を確認できませんでした。時間をおいて再度お試しください。");
      }

      if (payload.user.role === "SUPER_ADMIN") {
        router.push("/super");
      } else if (role === "PLAYER" && payload.user.playerId) {
        router.push(`/players?playerId=${payload.user.playerId}`);
      } else {
        router.push("/store/users");
      }
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ログインに失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="login-card" aria-label={title}>
      <div>
        <p className="login-kicker">{role === "PLAYER" ? "Player Login" : "Admin Login"}</p>
        <h2>{title}</h2>
        <p className="login-description">{description}</p>
      </div>

      <div className="form">
        {role === "PLAYER" ? (
          <div className="field">
            <label htmlFor="login-store-code">店舗ID</label>
            <input
              id="login-store-code"
              type="text"
              value={storeCode}
              onChange={(event) => setStoreCode(event.target.value.toUpperCase())}
              autoComplete="organization"
              placeholder="例: DEMO"
            />
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="login-identifier">{identifierLabel}</label>
          <input
            id="login-identifier"
            type="text"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">パスワード</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </div>
      </div>

      <button className="button login-submit" type="button" onClick={login} disabled={isSaving}>
        ログイン
      </button>

      {role === "PLAYER" ? (
        <Link className="admin-login-link" href="/admin/login" target="_blank" rel="noreferrer">
          管理者ログインを別タブで開く
        </Link>
      ) : null}

      {message ? <div className="message error">{message}</div> : null}
    </section>
  );
}
