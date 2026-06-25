import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/">
          雀荘 成績集中管理PoC
        </Link>
        <nav className="nav" aria-label="主要画面">
          <Link href="/">本部</Link>
          <Link href="/store/players">全ユーザ成績</Link>
          <Link href="/results">結果登録</Link>
          <Link href="/players">プレイヤー成績</Link>
          <Link href="/login">ログイン</Link>
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
