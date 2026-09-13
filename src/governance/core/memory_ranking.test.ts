import { describe, expect, it } from "vitest";
import { rankMemories } from "./memory_ranking";

describe("rankMemories", () => {
  it("ranks by recency-weighted importance", () => {
    const now = new Date("2026-09-13T12:00:00Z");
    const items = [
      {
        id: 1,
        importance: 9,
        createdAt: new Date(now.getTime() - 30 * 86_400_000),
        body: "A",
      },
      {
        id: 2,
        importance: 5,
        createdAt: new Date(now.getTime() - 3_600_000),
        body: "B",
      },
      {
        id: 3,
        importance: 7,
        createdAt: new Date(now.getTime() - 7 * 86_400_000),
        body: "C",
      },
    ];

    const ranked = rankMemories(items, now);

    expect(ranked.map((item) => item.body)).toEqual(["B", "C", "A"]);
    // Companion plan's literal said 0.462; the parent plan's formula
    // (importance × 2^(−ageDays/7)) yields 0.4614 → 0.461. Formula wins.
    expect(ranked.map((item) => item.score)).toEqual([4.979, 3.5, 0.461]);
  });
});
