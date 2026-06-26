import { NextRequest, NextResponse } from "next/server";
import { ResultSource } from "@prisma/client";
import { badRequest, notFound } from "@/lib/api";
import { FinishGameError, finishGameWithResults } from "@/lib/gameFinish";

type Params = {
  params: Promise<{ gameId: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { gameId } = await params;
  const body = await request.json().catch(() => null);
  const results = body?.results as { playerId: string; points: number; confidence?: number }[] | undefined;

  if (!body || typeof body !== "object") {
    return badRequest("画像認識結果のJSONを送信してください。");
  }

  try {
    const payload = JSON.parse(
      JSON.stringify({
        provider: body.provider ?? "external-ocr",
        deviceId: body.deviceId,
        imageUrl: body.imageUrl,
        recognizedAt: body.recognizedAt ?? new Date().toISOString(),
        confidence: body.confidence,
        rawText: body.rawText,
        results: results ?? [],
        rawPayload: body.rawPayload,
      }),
    );

    const game = await finishGameWithResults({
      gameId,
      results: results ?? [],
      source: ResultSource.IMAGE_RECOGNITION,
      payload,
    });

    return NextResponse.json({ game });
  } catch (error) {
    if (error instanceof FinishGameError) {
      return error.status === 404 ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
