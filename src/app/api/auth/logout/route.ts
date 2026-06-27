import { NextResponse } from "next/server";
import { expiredSessionCookie } from "@/lib/auth";

export async function POST() {
  const cookie = expiredSessionCookie();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
