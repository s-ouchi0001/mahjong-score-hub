import { NextRequest, NextResponse } from "next/server";
import { badRequest, forbidden, unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "SUPER_ADMIN") return forbidden();

  const body = await request.json().catch(() => null);
  const storeId = typeof body?.storeId === "string" ? body.storeId : "";
  const tableNumber = Number(body?.tableNumber);
  const deviceId = typeof body?.deviceId === "string" && body.deviceId.trim() ? body.deviceId.trim() : "";

  if (!storeId || !Number.isInteger(tableNumber) || tableNumber < 1) {
    return badRequest("店舗と卓番号を入力してください。");
  }

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return badRequest("店舗が見つかりません。");

  try {
    const table = await prisma.mahjongTable.create({
      data: {
        storeId,
        tableNumber,
        deviceId: deviceId || `${store.storeCode.toLowerCase()}-table-${tableNumber}`,
      },
      select: {
        id: true,
        tableNumber: true,
        deviceId: true,
        status: true,
        connectionStatus: true,
        defaultCategory: true,
        lastSeenAt: true,
        currentTournament: { select: { name: true } },
        _count: { select: { games: true, pointSnapshots: true } },
      },
    });

    return NextResponse.json({ table }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return badRequest("この卓番号または端末IDはすでに使われています。");
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "SUPER_ADMIN") return forbidden();

  const body = await request.json().catch(() => null);
  const tableId = typeof body?.tableId === "string" ? body.tableId : "";
  const storeId = typeof body?.storeId === "string" ? body.storeId : "";

  if (!tableId || !storeId) return badRequest("削除する卓を指定してください。");

  const table = await prisma.mahjongTable.findUnique({
    where: { id: tableId },
    include: { _count: { select: { games: true, pointSnapshots: true } } },
  });
  if (!table || table.storeId !== storeId) return badRequest("削除対象の卓が見つかりません。");
  if (table._count.games > 0 || table._count.pointSnapshots > 0) {
    return badRequest("成績または点数履歴がある卓は削除できません。");
  }

  await prisma.mahjongTable.delete({ where: { id: tableId } });
  return NextResponse.json({ ok: true });
}
