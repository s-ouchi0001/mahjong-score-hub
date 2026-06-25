export type PlayerPoints = {
  playerId: string;
  points: number;
};

export type CalculatedResult = PlayerPoints & {
  rank: number;
  score: number;
};

const rankBonus: Record<number, number> = {
  1: 20,
  2: 10,
  3: -10,
  4: -20,
};

export function calculateResults(players: PlayerPoints[]): CalculatedResult[] {
  const ranked = [...players].sort((a, b) => b.points - a.points);

  return ranked.map((player, index) => {
    const rank = index + 1;
    return {
      ...player,
      rank,
      score: Math.round(((player.points - 25000) / 1000 + rankBonus[rank]) * 10) / 10,
    };
  });
}
