import { NextRequest, NextResponse } from "next/server";
import { badRequest, forbidden, unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "SUPER_ADMIN") return forbidden();

  const body = await request.json().catch(() => null);
  const storeId = typeof body?.storeId === "string" ? body.storeId : "";
  const loginId = typeof body?.loginId === "string" ? body.loginId.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!storeId || !loginId || !name || !password) {
    return badRequest("店舗、ログインID、スタッフ名、パスワードを入力してください。");
  }

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return badRequest("店舗が見つかりません。");

  try {
    const staff = await prisma.appUser.create({
      data: {
        storeId,
        email: loginId,
        name,
        role: "STORE_ADMIN",
        passwordHash: hashPassword(password),
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    return NextResponse.json({ staff }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return badRequest("このログインIDはすでに使われています。");
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "SUPER_ADMIN") return forbidden();

  const body = await request.json().catch(() => null);
  const staffId = typeof body?.staffId === "string" ? body.staffId : "";
  const storeId = typeof body?.storeId === "string" ? body.storeId : "";

  if (!staffId || !storeId) return badRequest("削除するスタッフを指定してください。");

  const staff = await prisma.appUser.findUnique({ where: { id: staffId } });
  if (!staff || staff.storeId !== storeId || staff.role !== "STORE_ADMIN") {
    return badRequest("削除対象のスタッフが見つかりません。");
  }

  await prisma.appUser.delete({ where: { id: staffId } });
  return NextResponse.json({ ok: true });
}
