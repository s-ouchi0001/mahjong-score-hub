import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

const cookieName = "mahjong-score-session";
const maxAgeSeconds = 60 * 60 * 24 * 30;

function secret() {
  return process.env.AUTH_SECRET || "dev-only-change-me";
}

function base64Url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function createToken(userId: string) {
  const payload = base64Url(JSON.stringify({ userId, exp: Date.now() + maxAgeSeconds * 1000 }));
  return `${payload}.${sign(payload)}`;
}

function parseToken(token?: string) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId?: string; exp?: number };
    if (!data.userId || !data.exp || data.exp < Date.now()) return null;
    return data.userId;
  } catch {
    return null;
  }
}

export async function authenticate(email: string, password: string) {
  const user = await prisma.appUser.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { store: true, player: true },
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return null;
  }

  return user;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = parseToken(cookieStore.get(cookieName)?.value);
  if (!userId) return null;

  return prisma.appUser.findUnique({
    where: { id: userId },
    include: { store: true, player: true },
  });
}

export function sessionCookie(userId: string) {
  return {
    name: cookieName,
    value: createToken(userId),
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: maxAgeSeconds,
    },
  };
}

export function expiredSessionCookie() {
  return {
    name: cookieName,
    value: "",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    },
  };
}
