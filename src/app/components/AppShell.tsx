import Link from "next/link";
import { SessionNav } from "@/app/components/SessionNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/">
          雀荘 成績集中管理PoC
        </Link>
        <SessionNav />
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
