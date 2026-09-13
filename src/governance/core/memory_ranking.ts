export interface RankableMemory {
  id: number;
  importance: number;
  createdAt: Date;
}

const HALF_LIFE_DAYS = 7;

/**
 * Recency-weighted importance: score = importance × 2^(−ageDays / 7).
 * Ties break stably by id. Scores are rounded to 3 decimals.
 */
export function rankMemories<T extends RankableMemory>(
  items: T[],
  now: Date,
): Array<T & { score: number }> {
  const nowMs = now.getTime();
  return items
    .map((item) => {
      const ageDays = (nowMs - item.createdAt.getTime()) / 86_400_000;
      const score = item.importance * Math.pow(2, -ageDays / HALF_LIFE_DAYS);
      return { ...item, score: Math.round(score * 1000) / 1000 };
    })
    .sort((a, b) => b.score - a.score || a.id - b.id);
}
