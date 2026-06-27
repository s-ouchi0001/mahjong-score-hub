"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Session =
  | {
      role: "STORE_ADMIN";
      name: string;
      storeName: string;
    }
  | {
      role: "PLAYER";
      name: string;
      playerId: string | null;
      storeName: string;
    }
  | null;

export function SessionNav({ session: initialSession }: { session: Session }) {
  const router = useRouter();
  const [session, setSession] = useState<Session>(initialSession);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession(null);
    router.push("/login");
    router.refresh();
  }

  if (session?.role === "PLAYER" && session.playerId) {
    return (
      <div className="topbar-actions">
        <div className="session-badge" aria-label="ログイン中ユーザ">
          <span>ユーザ</span>
          <strong>{session.name}</strong>
          <small>{session.storeName}</small>
        </div>
        <nav className="nav" aria-label="主要画面">
          <Link href={`/players?playerId=${session.playerId}`}>自分の成績</Link>
          <button className="nav-button" type="button" onClick={logout}>
            ログアウト
          </button>
        </nav>
      </div>
    );
  }

  return (
    <div className="topbar-actions">
      {session?.role === "STORE_ADMIN" ? (
        <div className="session-badge" aria-label="ログイン中管理者">
          <span>管理者</span>
          <strong>{session.name}</strong>
          <small>{session.storeName}</small>
        </div>
      ) : null}
      <nav className="nav" aria-label="主要画面">
        <Link href="/">本部</Link>
        <Link href="/store/users">ユーザ管理</Link>
        <Link href="/store/players">成績一覧</Link>
        <Link href="/tables/participants">卓管理</Link>
        <Link href="/results">成績入力</Link>
        <Link href="/players">プレイヤー成績</Link>
        <Link href="/login">ログイン</Link>
        {session?.role === "STORE_ADMIN" ? (
          <button className="nav-button" type="button" onClick={logout}>
            ログアウト
          </button>
        ) : null}
      </nav>
    </div>
  );
}
