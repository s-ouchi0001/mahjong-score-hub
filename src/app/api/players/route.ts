import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { badRequest, forbidden, unauthorized } from "@/lib/api";
import { hashPassword } from "@/lib/password";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const players = await prisma.player.findMany({
    where: user.role === "PLAYER" && user.playerId ? { id: user.playerId } : { storeId: user.storeId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ players });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "STORE_ADMIN") return forbidden();

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const managementNumber = typeof body?.managementNumber === "string" ? body.managementNumber.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "password";
  const isCheckedIn = Boolean(body?.isCheckedIn);

  if (!name) return badRequest("名前を入力してください。");
  if (!email) return badRequest("ログイン用メールアドレスを入力してください。");

  try {
    const created = await prisma.$transaction(async (tx) => {
      const player = await tx.player.create({
        data: {
          storeId: user.storeId,
          name,
          managementNumber: managementNumber || null,
          isCheckedIn,
          checkedInAt: isCheckedIn ? new Date() : null,
          checkedOutAt: isCheckedIn ? null : new Date(),
        },
      });

      await tx.appUser.create({
        data: {
          storeId: user.storeId,
          playerId: player.id,
          role: "PLAYER",
          email,
          name,
          passwordHash: hashPassword(password),
        },
      });

      return player;
    });

    return NextResponse.json({ player: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return badRequest("同じ名前、管理番号、またはメールアドレスがすでに使われています。");
    }
    throw error;
  }
}
