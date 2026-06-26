"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Session =
  | {
      role: "store";
      name: string;
    }
  | {
      role: "player";
      name: string;
      playerId: string;
    }
  | null;

function readSession(): Session {
  const raw = window.localStorage.getItem("mahjong-score-session");
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as Session;
    return session;
  } catch {
    return null;
  }
}

export function SessionNav() {
  const router = useRouter();
  const [session, setSession] = useState<Session>(null);

  useEffect(() => {
    setSession(readSession());
  }, []);

  function logout() {
    window.localStorage.removeItem("mahjong-score-session");
    document.cookie = "mahjong-score-role=; path=/; max-age=0; SameSite=Lax";
    document.cookie = "mahjong-score-player-id=; path=/; max-age=0; SameSite=Lax";
    setSession(null);
    router.push("/login");
  }

  if (session?.role === "player") {
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
      <Link href="/results">結果登録</Link>
      <Link href="/players">プレイヤー成績</Link>
      <Link href="/login">ログイン</Link>
      {session?.role === "store" ? (
        <button className="nav-button" type="button" onClick={logout}>
          ログアウト
        </button>
      ) : null}
    </nav>
  );
}
