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

  const table = await prisma.mahjongTable.create({
    data: {
      storeId,
      tableNumber,
      deviceId: deviceId || `${store.storeCode.toLowerCase()}-table-${tableNumber}`,
    },
    select: { id: true, tableNumber: true, deviceId: true },
  });

  return NextResponse.json({ table }, { status: 201 });
}
