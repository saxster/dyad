import { describe, expect, it } from "vitest";
import { BudgetGovernor } from "./budget_governor";
import { DyadErrorKind } from "@/errors/dyad_error";

describe("BudgetGovernor", () => {
  it("allows spends up to the ceiling and throws beyond it", () => {
    const governor = new BudgetGovernor(1.0);

    governor.record({ input: 1, output: 1, costUsd: 0.5 });
    expect(governor.remaining()).toBe(0.5);

    // Hitting the ceiling exactly is allowed; only exceeding it throws.
    governor.record({ input: 1, output: 1, costUsd: 0.5 });

    expect(() =>
      governor.record({ input: 1, output: 1, costUsd: 0.01 }),
    ).toThrow(expect.objectContaining({ kind: DyadErrorKind.BudgetExceeded }));
  });
});
