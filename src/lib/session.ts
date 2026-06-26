import { cookies } from "next/headers";

export async function getServerSession() {
  const cookieStore = await cookies();
  const role = cookieStore.get("mahjong-score-role")?.value;
  const playerId = cookieStore.get("mahjong-score-player-id")?.value;

  if (role === "player" && playerId) {
    return { role, playerId } as const;
  }

  if (role === "store") {
    return { role } as const;
  }

  return null;
}
