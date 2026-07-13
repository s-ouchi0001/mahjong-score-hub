"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Session =
  | {
      role: "SUPER_ADMIN";
      name: string;
      playerId: string | null;
      storeName: string;
    }
  | {
      role: "STORE_ADMIN";
      name: string;
      playerId: string | null;
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
  const pathname = usePathname();
  const [session, setSession] = useState<Session>(initialSession);
  const adminLinks = [
    { href: "/dashboard", label: "本部" },
    { href: "/store/users", label: "ユーザ管理" },
    { href: "/store/qr-print", label: "QR印刷" },
    { href: "/store/players", label: "成績一覧" },
    { href: "/tables/participants", label: "卓管理" },
    { href: "/store/recognition", label: "認識確認" },
    { href: "/results", label: "成績入力" },
    { href: "/store/games", label: "成績修正" },
    { href: "/store/reports", label: "レポート" },
    { href: "/store/settings", label: "設定" },
    { href: "/rankings", label: "ランキング" },
    { href: "/players", label: "プレイヤー成績" },
  ];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession(null);
    router.push("/login");
    router.refresh();
  }

  function moveAdminMenu(value: string) {
    if (value === "__logout") {
      void logout();
      return;
    }
    if (value) router.push(value);
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
          <Link href="/rankings">ランキング</Link>
          <button className="nav-button" type="button" onClick={logout}>
            ログアウト
          </button>
        </nav>
      </div>
    );
  }

  if (session?.role === "SUPER_ADMIN") {
    return (
      <div className="topbar-actions">
        <div className="session-badge" aria-label="ログイン中スーパー管理者">
          <span>スーパー管理者</span>
          <strong>{session.name}</strong>
          <small>全店舗</small>
        </div>
        <nav className="nav" aria-label="主要画面">
          <Link href="/super">全体管理</Link>
          <button className="nav-button" type="button" onClick={logout}>
            ログアウト
          </button>
        </nav>
      </div>
    );
  }

  if (session?.role === "STORE_ADMIN") {
    const currentPath = adminLinks.find((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))?.href ?? "/dashboard";
    return (
      <div className="topbar-actions admin-layout-nav">
        <div className="session-badge" aria-label="ログイン中管理者">
          <span>管理者</span>
          <strong>{session.name}</strong>
          <small>{session.storeName}</small>
        </div>
        <select
          className="mobile-nav-select"
          aria-label="管理メニュー"
          value={currentPath}
          onChange={(event) => moveAdminMenu(event.target.value)}
        >
          {adminLinks.map((link) => (
            <option key={link.href} value={link.href}>
              {link.label}
            </option>
          ))}
          <option value="__logout">ログアウト</option>
        </select>
        <nav className="nav admin-side-nav" aria-label="管理メニュー">
          {adminLinks.map((link) => (
            <Link key={link.href} className={currentPath === link.href ? "active" : ""} href={link.href}>
              {link.label}
            </Link>
          ))}
          <button className="nav-button" type="button" onClick={logout}>
            ログアウト
          </button>
        </nav>
      </div>
    );
  }

  return (
    <div className="topbar-actions">
      <nav className="nav" aria-label="主要画面">
        <Link href="/login">ログイン</Link>
      </nav>
    </div>
  );
}
