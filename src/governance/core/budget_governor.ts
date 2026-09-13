import { DyadError, DyadErrorKind } from "@/errors/dyad_error";

export interface BudgetSpend {
  input: number;
  output: number;
  costUsd: number;
}

/**
 * Tracks governance spend against a USD ceiling. Spends that land exactly on
 * the ceiling are allowed; only a spend that would push the running total
 * over it throws.
 */
export class BudgetGovernor {
  private totalUsd = 0;

  constructor(readonly ceilingUsd: number) {}

  record(spend: BudgetSpend): void {
    if (this.totalUsd + spend.costUsd > this.ceilingUsd) {
      throw new DyadError(
        `governance budget exceeded: spent $${(this.totalUsd + spend.costUsd).toFixed(2)} of the $${this.ceilingUsd.toFixed(2)} ceiling`,
        DyadErrorKind.BudgetExceeded,
      );
    }
    this.totalUsd += spend.costUsd;
  }

  remaining(): number {
    return this.ceilingUsd - this.totalUsd;
  }
}

export const BLENDED_USD_PER_MILLION = 3;

export interface CouncilCostEstimate {
  lowUsd: number;
  highUsd: number;
}

export function estimateCouncilCost(
  members: number,
  rounds: number,
  avgTokens: number,
): CouncilCostEstimate {
  const totalTokens = members * rounds * avgTokens;
  const round3 = (value: number) => Math.round(value * 1000) / 1000;
  return {
    lowUsd: round3((totalTokens / 1e6) * BLENDED_USD_PER_MILLION),
    highUsd: round3((totalTokens / 1e6) * (BLENDED_USD_PER_MILLION * 2)),
  };
}
