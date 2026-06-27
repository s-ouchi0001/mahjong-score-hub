import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const players = await prisma.player.findMany({
    where: user.role === "PLAYER" && user.playerId ? { id: user.playerId } : { storeId: user.storeId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ players });
}
