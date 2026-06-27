import { NextRequest, NextResponse } from "next/server";
import { badRequest } from "@/lib/api";
import { authenticate, sessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = body?.email as string | undefined;
  const password = body?.password as string | undefined;

  if (!email || !password) {
    return badRequest("メールアドレスとパスワードを入力してください。");
  }

  const user = await authenticate(email, password);
  if (!user) {
    return badRequest("メールアドレスまたはパスワードが違います。");
  }

  const cookie = sessionCookie(user.id);
  const response = NextResponse.json({
    user: {
      id: user.id,
      role: user.role,
      name: user.name,
      storeId: user.storeId,
      storeName: user.store.name,
      playerId: user.playerId,
    },
  });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
