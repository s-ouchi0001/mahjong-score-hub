import { NextRequest, NextResponse } from "next/server";
import { badRequest } from "@/lib/api";
import { authenticate, authenticatePlayerByLoginId, sessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = body?.email as string | undefined;
  const loginId = body?.loginId as string | undefined;
  const storeCode = body?.storeCode as string | undefined;
  const password = body?.password as string | undefined;
  const role = body?.role as string | undefined;

  if (!password) {
    return badRequest("パスワードを入力してください。");
  }

  if (role === "PLAYER") {
    if (!storeCode || !loginId) return badRequest("店舗ID、ユーザID、パスワードを入力してください。");

    const result = await authenticatePlayerByLoginId(storeCode, loginId, password);
    if (result.status === "INVALID") {
      return badRequest("店舗ID、ユーザID、またはパスワードが違います。");
    }

    const cookie = sessionCookie(result.user.id);
    const response = NextResponse.json({
      user: {
        id: result.user.id,
        role: result.user.role,
        name: result.user.name,
        storeId: result.user.storeId,
        storeName: result.user.store.name,
        playerId: result.user.playerId,
        mustChangePassword: result.user.mustChangePassword,
      },
    });
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  }

  if (!email) {
    return badRequest("ユーザIDとパスワードを入力してください。");
  }

  const user = await authenticate(email, password);
  if (!user) {
    return badRequest("ユーザIDまたはパスワードが違います。");
  }

  if (role === "STORE_ADMIN" && user.role !== "STORE_ADMIN" && user.role !== "SUPER_ADMIN") {
    return badRequest("管理者用アカウントでログインしてください。");
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
      mustChangePassword: user.mustChangePassword,
    },
  });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
