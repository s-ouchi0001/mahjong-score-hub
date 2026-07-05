export type PlayerPoints = {
  playerId: string;
  points: number;
};

export type CalculatedResult = PlayerPoints & {
  rank: number;
  score: number;
};

export type ScoreSettings = {
  startingPoint?: number;
  returnPoint?: number;
  firstPlaceBonus?: number;
  secondPlaceBonus?: number;
  thirdPlaceBonus?: number;
  fourthPlaceBonus?: number;
};

export const defaultScoreSettings = {
  startingPoint: 25000,
  returnPoint: 30000,
  firstPlaceBonus: 20,
  secondPlaceBonus: 10,
  thirdPlaceBonus: -10,
  fourthPlaceBonus: -20,
};

function normalizeSettings(settings?: ScoreSettings) {
  return { ...defaultScoreSettings, ...settings };
}

export function calculateResults(players: PlayerPoints[], settings?: ScoreSettings): CalculatedResult[] {
  const scoreSettings = normalizeSettings(settings);
  const rankBonus: Record<number, number> = {
    1: scoreSettings.firstPlaceBonus,
    2: scoreSettings.secondPlaceBonus,
    3: scoreSettings.thirdPlaceBonus,
    4: scoreSettings.fourthPlaceBonus,
  };
  const ranked = [...players].sort((a, b) => b.points - a.points);

  return ranked.map((player, index) => {
    const rank = index + 1;
    return {
      ...player,
      rank,
      score: Math.round(((player.points - scoreSettings.returnPoint) / 1000 + rankBonus[rank]) * 10) / 10,
    };
  });
}
