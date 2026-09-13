import { describe, expect, it } from "vitest";
import { evaluateGateTriggers } from "./heuristic_gate";

describe("evaluateGateTriggers", () => {
  it("fires on split council verdicts", () => {
    expect(
      evaluateGateTriggers({
        verdict: {
          classification: "contested",
          consensusScore: 0.5,
          critiques: [],
        },
        plannedScope: { files: 3 },
        diffStats: { filesChanged: 3 },
      }),
    ).toEqual({ triggers: ["split-council-verdict"], blocking: true });
  });

  it("fires on scope expansion when the diff exceeds N× the planned file count", () => {
    expect(
      evaluateGateTriggers({
        verdict: {
          classification: "unanimous-pass",
          consensusScore: 1,
          critiques: [],
        },
        plannedScope: { files: 3 },
        diffStats: { filesChanged: 7 },
      }),
    ).toEqual({ triggers: ["scope-expansion"], blocking: true });
  });

  it("does not fire on clean small diffs", () => {
    expect(
      evaluateGateTriggers({
        verdict: {
          classification: "unanimous-pass",
          consensusScore: 1,
          critiques: [],
        },
        plannedScope: { files: 3 },
        diffStats: { filesChanged: 6 },
      }),
    ).toEqual({ triggers: [], blocking: false });
  });
});
