import { NextRequest, NextResponse } from "next/server";
import { badRequest, forbidden, notFound, unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ playerId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "STORE_ADMIN") return forbidden();

  const { playerId } = await params;
  const body = await request.json().catch(() => null);
  const player = await prisma.player.findUnique({ where: { id: playerId } });

  if (!player) return notFound("プレイヤーが見つかりません。");
  if (player.storeId !== user.storeId) return forbidden("別店舗のプレイヤーは操作できません。");

  const data: {
    name?: string;
    managementNumber?: string | null;
    isCheckedIn?: boolean;
    checkedInAt?: Date | null;
    checkedOutAt?: Date | null;
  } = {};

  if ("name" in body) {
    const value = typeof body.name === "string" ? body.name.trim() : "";
    if (!value) return badRequest("名前を入力してください。");
    data.name = value;
  }

  if ("managementNumber" in body) {
    const value = typeof body.managementNumber === "string" ? body.managementNumber.trim() : "";
    if (!value) return badRequest("ユーザIDを入力してください。");
    data.managementNumber = value;
  }

  if ("isCheckedIn" in body) {
    if (typeof body.isCheckedIn !== "boolean") {
      return badRequest("isCheckedIn は true または false で指定してください。");
    }
    data.isCheckedIn = body.isCheckedIn;
    data.checkedInAt = body.isCheckedIn ? new Date() : player.checkedInAt;
    data.checkedOutAt = body.isCheckedIn ? null : new Date();
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const updatedPlayer = await tx.player.update({
        where: { id: playerId },
        data,
        select: {
          id: true,
          name: true,
          managementNumber: true,
          isCheckedIn: true,
          checkedInAt: true,
          checkedOutAt: true,
        },
      });

      if (data.name) {
        await tx.appUser.updateMany({
          where: { playerId, storeId: user.storeId },
          data: { name: data.name },
        });
      }

      return updatedPlayer;
    });

    return NextResponse.json({ player: updated });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return badRequest("この名前またはユーザIDはすでに使われています。");
    }
    throw error;
  }
}
