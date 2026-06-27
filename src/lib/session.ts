import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export async function getServerSession() {
  return getCurrentUser();
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireStoreAdmin() {
  const user = await requireUser();
  if (user.role === "PLAYER" && user.playerId) {
    redirect(`/players?playerId=${user.playerId}`);
  }
  return user;
}
