export type PlayerRatingInput = {
  gameCount: number;
  averageRank: number;
  topRate: number;
  lastRate: number;
  totalScore: number;
};

const ranks = [
  { name: "新人", min: 0 },
  { name: "9級", min: 900 },
  { name: "8級", min: 1000 },
  { name: "7級", min: 1100 },
  { name: "6級", min: 1200 },
  { name: "5級", min: 1300 },
  { name: "4級", min: 1400 },
  { name: "3級", min: 1500 },
  { name: "2級", min: 1600 },
  { name: "1級", min: 1700 },
  { name: "初段", min: 1800 },
  { name: "二段", min: 1950 },
  { name: "三段", min: 2100 },
  { name: "四段", min: 2250 },
  { name: "五段", min: 2400 },
  { name: "六段", min: 2550 },
  { name: "七段", min: 2700 },
  { name: "八段", min: 2900 },
  { name: "九段", min: 3100 },
  { name: "十段", min: 3350 },
];

export function calculateJankiPoint(input: PlayerRatingInput) {
  if (input.gameCount === 0) return 1000;

  const scorePower = input.totalScore * 8;
  const rankPower = (2.5 - input.averageRank) * 220;
  const topPower = input.topRate * 4;
  const lastPenalty = input.lastRate * 5;
  const experience = Math.min(input.gameCount, 120) * 4;

  return Math.max(0, Math.round(1200 + scorePower + rankPower + topPower - lastPenalty + experience));
}

export function resolveDan(jankiPoint: number) {
  return ranks.reduce((current, rank) => (jankiPoint >= rank.min ? rank : current), ranks[0]).name;
}

export function buildRating(input: PlayerRatingInput) {
  const jankiPoint = calculateJankiPoint(input);
  return {
    jankiPoint,
    dan: resolveDan(jankiPoint),
  };
}
