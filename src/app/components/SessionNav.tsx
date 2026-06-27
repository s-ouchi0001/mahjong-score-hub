"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
      playerId: string;
      storeName: string;
    }
  | null;

export function SessionNav() {
  const router = useRouter();
  const [session, setSession] = useState<Session>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((payload) => setSession(payload.user))
      .catch(() => setSession(null));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession(null);
    router.push("/login");
    router.refresh();
  }

  if (session?.role === "PLAYER") {
    return (
      <nav className="nav" aria-label="主要画面">
        <Link href={`/players?playerId=${session.playerId}`}>自分の成績</Link>
        <button className="nav-button" type="button" onClick={logout}>
          ログアウト
        </button>
      </nav>
    );
  }

  return (
    <nav className="nav" aria-label="主要画面">
      <Link href="/">本部</Link>
      <Link href="/store/players">全ユーザ成績</Link>
      <Link href="/tables/participants">メンバー管理</Link>
      <Link href="/results">成績入力</Link>
      <Link href="/players">プレイヤー成績</Link>
      <Link href="/login">ログイン</Link>
      {session?.role === "STORE_ADMIN" ? (
        <button className="nav-button" type="button" onClick={logout}>
          ログアウト
        </button>
      ) : null}
    </nav>
  );
}
