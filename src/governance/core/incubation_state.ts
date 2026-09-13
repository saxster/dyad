export type IncubationStage =
  | "ideate"
  | "specify"
  | "challenge"
  | "commit"
  | "build";

export interface CommittedHypothesis {
  problem: string;
  hypothesis: string;
  successCriteria: string[];
}

export type IncubationEvent =
  | { type: "advance"; to?: IncubationStage; hypothesis?: CommittedHypothesis }
  | { type: "regress"; to?: IncubationStage };

const STAGES: IncubationStage[] = [
  "ideate",
  "specify",
  "challenge",
  "commit",
  "build",
];

/**
 * Incubation pipeline state machine (ideate → specify → challenge → commit →
 * build). Advances and regressions are single-step only; an explicit `to`
 * target further than one step is rejected as a jump. Advancing INTO commit
 * demands the committed hypothesis payload (non-empty problem and hypothesis,
 * at least one success criterion).
 */
export function nextIncubationStage(
  current: IncubationStage,
  event: IncubationEvent,
): IncubationStage {
  const index = STAGES.indexOf(current);
  if (event.type === "regress") {
    const target = event.to ?? STAGES[index - 1];
    if (target === undefined) {
      throw new Error("ideate is the first incubation stage");
    }
    if (STAGES.indexOf(target) !== index - 1) {
      throw new Error(`invalid incubation transition: ${current} → ${target}`);
    }
    return target;
  }

  const target = event.to ?? STAGES[index + 1];
  if (target === undefined) {
    throw new Error("build is the final incubation stage");
  }
  if (STAGES.indexOf(target) !== index + 1) {
    throw new Error(`invalid incubation transition: ${current} → ${target}`);
  }
  if (target === "commit") {
    const { hypothesis } = event;
    if (
      !hypothesis ||
      hypothesis.problem.length === 0 ||
      hypothesis.hypothesis.length === 0 ||
      hypothesis.successCriteria.length < 1
    ) {
      throw new Error("hypothesis payload required");
    }
  }
  return target;
}
