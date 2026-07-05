import { NextRequest, NextResponse } from "next/server";
import { badRequest, forbidden, unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function toInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "STORE_ADMIN") return forbidden();

  const body = await request.json().catch(() => null);
  const startingPoint = toInt(body?.startingPoint);
  const returnPoint = toInt(body?.returnPoint);
  const firstPlaceBonus = toInt(body?.firstPlaceBonus);
  const secondPlaceBonus = toInt(body?.secondPlaceBonus);
  const thirdPlaceBonus = toInt(body?.thirdPlaceBonus);
  const fourthPlaceBonus = toInt(body?.fourthPlaceBonus);

  if (
    startingPoint === null ||
    returnPoint === null ||
    firstPlaceBonus === null ||
    secondPlaceBonus === null ||
    thirdPlaceBonus === null ||
    fourthPlaceBonus === null
  ) {
    return badRequest("スコア設定は整数で入力してください。");
  }

  const store = await prisma.store.update({
    where: { id: user.storeId },
    data: {
      startingPoint,
      returnPoint,
      firstPlaceBonus,
      secondPlaceBonus,
      thirdPlaceBonus,
      fourthPlaceBonus,
    },
    select: {
      startingPoint: true,
      returnPoint: true,
      firstPlaceBonus: true,
      secondPlaceBonus: true,
      thirdPlaceBonus: true,
      fourthPlaceBonus: true,
    },
  });

  return NextResponse.json({ store });
}
