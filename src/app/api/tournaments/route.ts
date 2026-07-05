import { NextRequest, NextResponse } from "next/server";
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
    select: { id: true, name: true, startsAt: true, endsAt: true },
  });

  return NextResponse.json({ tournaments });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "STORE_ADMIN") return forbidden();

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return badRequest("大会名を入力してください。");
  }

  const tournament = await prisma.tournament.upsert({
    where: {
      storeId_name: {
        storeId: user.storeId,
        name,
      },
    },
    update: {},
    create: {
      storeId: user.storeId,
      name,
      startsAt: new Date(),
    },
    select: { id: true, name: true, startsAt: true, endsAt: true },
  });

  return NextResponse.json({ tournament }, { status: 201 });
}
