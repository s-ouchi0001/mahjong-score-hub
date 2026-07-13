import Link from "next/link";
import { SessionNav } from "@/app/components/SessionNav";
import { getCurrentUser } from "@/lib/auth";

type ShellUser = {
  role: "SUPER_ADMIN" | "STORE_ADMIN" | "PLAYER";
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
  const isStoreAdmin = user?.role === "STORE_ADMIN";

  return (
    <div className={isStoreAdmin ? "shell admin-shell" : "shell"}>
      <header className="topbar">
        <Link className="brand" href={isStoreAdmin ? "/dashboard" : "/"}>
          雀荘 成績管理クラウド
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
