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
