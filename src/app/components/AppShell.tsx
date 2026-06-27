import Link from "next/link";
import { SessionNav } from "@/app/components/SessionNav";
import { getCurrentUser } from "@/lib/auth";

type ShellUser = {
  role: "STORE_ADMIN" | "PLAYER";
  name: string;
  store: { name: string };
  playerId: string | null;
} | null;

export async function AppShell({
  children,
  user: passedUser,
}: {
  children: React.ReactNode;
  user?: ShellUser;
}) {
  const user = passedUser === undefined ? await getCurrentUser() : passedUser;

  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/">
          雀荘 成績集中管理PoC
        </Link>
        <SessionNav
          session={
            user
              ? {
                  role: user.role,
                  name: user.name,
                  storeName: user.store.name,
                  playerId: user.playerId,
                }
              : null
          }
        />
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
