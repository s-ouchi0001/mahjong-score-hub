import { NextRequest, NextResponse } from "next/server";
import { badRequest, forbidden, unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "SUPER_ADMIN") return forbidden();

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const storeCode = typeof body?.storeCode === "string" ? body.storeCode.trim().toUpperCase() : "";

  if (!name || !storeCode) {
    return badRequest("雀荘名と店舗IDを入力してください。");
  }

  const store = await prisma.store.create({
    data: { name, storeCode },
    select: { id: true, name: true, storeCode: true },
  });

  return NextResponse.json({ store }, { status: 201 });
}
