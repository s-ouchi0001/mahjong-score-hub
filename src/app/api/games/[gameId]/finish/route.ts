import { NextRequest, NextResponse } from "next/server";
import { ResultSource } from "@prisma/client";
import { badRequest, forbidden, notFound, unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { FinishGameError, finishGameWithResults } from "@/lib/gameFinish";

type Params = {
  params: Promise<{ gameId: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "STORE_ADMIN") return forbidden();

  const { gameId } = await params;
  const body = await request.json().catch(() => null);
  const results = body?.results as { playerId: string; points: number }[] | undefined;

  try {
    const game = await finishGameWithResults({
      gameId,
      results: results ?? [],
      source: ResultSource.MANUAL,
      payload: body,
      storeId: user.storeId,
    });

    return NextResponse.json({ game });
  } catch (error) {
    if (error instanceof FinishGameError) {
      if (error.status === 404) return notFound(error.message);
      if (error.status === 403) return forbidden(error.message);
      return badRequest(error.message);
    }
    throw error;
  }
}
