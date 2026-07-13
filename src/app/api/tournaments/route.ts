import { NextRequest, NextResponse } from "next/server";
import { GameCategory } from "@prisma/client";
import { badRequest, forbidden, unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "STORE_ADMIN") return forbidden();

  const tournaments = await prisma.tournament.findMany({
    where: { storeId: user.storeId },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, name: true, tableCount: true, startsAt: true, endsAt: true },
  });

  return NextResponse.json({ tournaments });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "STORE_ADMIN") return forbidden();

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const tableCount = Number(body?.tableCount ?? 0);

  if (!name) {
    return badRequest("大会名を入力してください。");
  }
  if (!Number.isInteger(tableCount) || tableCount < 0) {
    return badRequest("使用卓数は0以上の整数で入力してください。");
  }
  const availableTableCount = await prisma.mahjongTable.count({ where: { storeId: user.storeId } });
  if (tableCount > availableTableCount) {
    return badRequest(`登録済みの卓数は${availableTableCount}卓です。使用卓数を見直してください。`);
  }

  const tournament = await prisma.$transaction(async (tx) => {
    const saved = await tx.tournament.upsert({
      where: {
        storeId_name: {
          storeId: user.storeId,
          name,
        },
      },
      update: { tableCount },
      create: {
        storeId: user.storeId,
        name,
        tableCount,
        startsAt: new Date(),
      },
      select: { id: true, name: true, tableCount: true, startsAt: true, endsAt: true },
    });

    if (tableCount > 0) {
      await tx.mahjongTable.updateMany({
        where: { storeId: user.storeId, tableNumber: { lte: tableCount } },
        data: {
          defaultCategory: GameCategory.TOURNAMENT,
          currentTournamentId: saved.id,
        },
      });
      await tx.game.updateMany({
        where: {
          storeId: user.storeId,
          status: "ACTIVE",
          table: { tableNumber: { lte: tableCount } },
        },
        data: {
          category: GameCategory.TOURNAMENT,
          tournamentId: saved.id,
        },
      });
    }

    return saved;
  });

  return NextResponse.json({ tournament }, { status: 201 });
}
