import { NextRequest, NextResponse } from "next/server";
import { forbidden, notFound, unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ tableId: string }>;
};

export async function POST(_request: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "STORE_ADMIN") return forbidden();

  const { tableId } = await params;
  const table = await prisma.mahjongTable.findUnique({ where: { id: tableId } });
  if (!table) return notFound("卓が見つかりません。");
  if (table.storeId !== user.storeId) return forbidden("別店舗の卓は操作できません。");

  const activeGame = await prisma.game.findFirst({
    where: { tableId, status: "ACTIVE" },
  });

  await prisma.$transaction(async (tx) => {
    if (activeGame) {
      await tx.game.update({
        where: { id: activeGame.id },
        data: {
          status: "FINISHED",
          finishedAt: new Date(),
        },
      });
    }

    await tx.mahjongTable.update({
      where: { id: tableId },
      data: {
        status: "IDLE",
        lastSeenAt: new Date(),
      },
    });
  });

  return NextResponse.json({ ok: true });
}
