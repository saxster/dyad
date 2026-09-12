import { classifyTier, scoreRigorAxes, type RigorTier } from "./rigor_tiers";
import { screenLane, type ExecutionLane } from "./lane_screen";

export interface RouteTurnInput {
  prompt: string;
  mode: string;
  enableGovernance: boolean;
  governanceRigor: "auto" | "surgical" | "standard" | "architectural" | "off";
}

export interface RouteTurnDecision {
  lane: ExecutionLane;
  tier: RigorTier;
  mode: string;
}

export function routeTurn(input: RouteTurnInput): RouteTurnDecision {
  if (!input.enableGovernance || input.governanceRigor === "off") {
    return { lane: "lean", tier: "surgical", mode: input.mode };
  }

  const lane = screenLane(input.prompt);
  const override =
    input.governanceRigor === "auto" ? undefined : input.governanceRigor;
  const axes = scoreRigorAxes(input.prompt, {});
  const composite =
    axes.breadth + axes.security + axes.novelty + axes.blastRadius;

  return {
    lane,
    tier: classifyTier(composite, override),
    mode: input.mode,
  };
}
