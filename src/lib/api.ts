import { NextResponse } from "next/server";

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function unauthorized(message = "ログインしてください。") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "権限がありません。") {
  return NextResponse.json({ error: message }, { status: 403 });
}
