import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/app/change-password/ChangePasswordForm";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await requireUser();

  if (user.role === "PLAYER" && !user.mustChangePassword && user.playerId) {
    redirect(`/players?playerId=${user.playerId}`);
  }

  return (
    <main className="login-page player-login-page">
      <ChangePasswordForm playerId={user.playerId} />
    </main>
  );
}
