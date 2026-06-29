import { NextRequest } from "next/server";

export function isAndroidGatewayAuthorized(request: NextRequest) {
  const expectedToken = process.env.ANDROID_GATEWAY_API_KEY;
  if (!expectedToken) return true;

  const authorization = request.headers.get("authorization");
  if (authorization === `Bearer ${expectedToken}`) return true;

  const apiKey = request.headers.get("x-api-key");
  return apiKey === expectedToken;
}

export function normalizePointValue(value: unknown) {
  const numberValue = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numberValue) || typeof numberValue !== "number") return null;
  return Math.round(numberValue);
}
