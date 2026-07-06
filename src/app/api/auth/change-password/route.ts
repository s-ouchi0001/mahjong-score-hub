import { NextRequest, NextResponse } from "next/server";
import { badRequest, unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  const confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : "";

  if (password.length < 4) {
    return badRequest("新しいパスワードは4文字以上で入力してください。");
  }
  if (password !== confirmPassword) {
    return badRequest("確認用パスワードが一致しません。");
  }
  if (password === "0000") {
    return badRequest("初期パスワード以外を設定してください。");
  }

  const updated = await prisma.appUser.update({
    where: { id: user.id },
    data: {
      passwordHash: hashPassword(password),
      mustChangePassword: false,
    },
    select: { role: true, playerId: true },
  });

  return NextResponse.json({ user: updated });
}
