import type { AggregatedVerdict } from "./verdict_aggregator";

export interface PlannedScope {
  files: number;
}

export interface DiffStats {
  filesChanged: number;
}

export interface GateEvaluationInput {
  verdict?: AggregatedVerdict;
  plannedScope: PlannedScope;
  diffStats: DiffStats;
}

export interface GateEvaluation {
  triggers: string[];
  blocking: boolean;
}

export function evaluateGateTriggers(
  input: GateEvaluationInput,
): GateEvaluation {
  const triggers: string[] = [];
  if (input.verdict?.classification === "contested") {
    triggers.push("split-council-verdict");
  }
  if (input.diffStats.filesChanged > input.plannedScope.files * 2) {
    triggers.push("scope-expansion");
  }
  return { triggers, blocking: triggers.length > 0 };
}
