import { NextRequest, NextResponse } from "next/server";
import { GameCategory } from "@prisma/client";
import { badRequest, forbidden, notFound, unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ tableId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "STORE_ADMIN") return forbidden();

  const { tableId } = await params;
  const body = await request.json().catch(() => null);
  const category = body?.category === GameCategory.TOURNAMENT ? GameCategory.TOURNAMENT : GameCategory.REGULAR;
  const tournamentId = typeof body?.tournamentId === "string" && body.tournamentId ? body.tournamentId : null;
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId.trim() : undefined;

  const table = await prisma.mahjongTable.findUnique({ where: { id: tableId } });
  if (!table) return notFound("卓が見つかりません。");
  if (table.storeId !== user.storeId) return forbidden("別店舗の卓は操作できません。");

  if (category === GameCategory.TOURNAMENT) {
    if (!tournamentId) return badRequest("大会卓にする場合は大会を選択してください。");
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament || tournament.storeId !== user.storeId) {
      return badRequest("選択した大会が見つかりません。");
    }
  }

  if (deviceId !== undefined) {
    if (!deviceId) return badRequest("カメラ端末IDを入力してください。");
    const duplicate = await prisma.mahjongTable.findUnique({ where: { deviceId } });
    if (duplicate && duplicate.id !== tableId) {
      return badRequest("このカメラ端末IDは別の卓で使われています。");
    }
  }

  const updated = await prisma.mahjongTable.update({
    where: { id: tableId },
    data: {
      defaultCategory: category,
      currentTournamentId: category === GameCategory.TOURNAMENT ? tournamentId : null,
      ...(deviceId !== undefined ? { deviceId } : {}),
    },
    select: {
      id: true,
      deviceId: true,
      defaultCategory: true,
      currentTournament: { select: { id: true, name: true } },
    },
  });

  await prisma.game.updateMany({
    where: { tableId, status: "ACTIVE" },
    data: {
      category,
      tournamentId: category === GameCategory.TOURNAMENT ? tournamentId : null,
    },
  });

  return NextResponse.json({ table: updated });
}
