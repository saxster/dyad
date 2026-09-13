/**
 * Adversarial council system prompts. Each member carries a fixed razor set
 * (distributed per Anvil's AdversarialCouncilEngine) and every round-2+ prompt
 * embeds the other members' round-1 claims verbatim for cross-critique.
 */

const MEMBER_RAZORS: Record<string, string[]> = {
  architect: [
    "Occam: prefer the simplest design that satisfies the requirements; flag unnecessary complexity, layers, or abstractions.",
    "Chesterton's Fence: do not remove or change existing behavior without first understanding why it exists; demand the reason before endorsing removal.",
  ],
  pragmatist: [
    "YAGNI: flag speculative generality and features built for hypothetical future needs.",
    "Inversion: work backward from failure — identify how this could catastrophically fail and whether the design prevents it.",
  ],
  "fact-checker": [
    "factual rigor: verify every factual assertion against the provided context; every claim you make must cite concrete evidence from that context, and you must flag unverified assertions as unverified.",
  ],
  "devils-advocate": [
    "Pre-Mortem: assume this work shipped and failed badly; narrate the most plausible failure story and identify the decisions that led there.",
  ],
};

const JSON_PROTOCOL =
  'Respond with ONLY a JSON object: {"findings":[{"severity":"critical"|"major"|"minor","claim":"...","evidence":"..."}]}';

export function buildCouncilSystemPrompt(
  memberId: string,
  round: number,
  priorRoundTexts: Record<string, string> = {},
): string {
  const razors = MEMBER_RAZORS[memberId];
  const lines = [
    `You are ${memberId}, a member of an adversarial review council (round ${round}).`,
    ...(razors ?? []),
  ];
  if (round >= 2) {
    const others = Object.entries(priorRoundTexts).filter(
      ([id, text]) => id !== memberId && text.length > 0,
    );
    if (others.length > 0) {
      lines.push("Round 1 claims from the other members:");
      for (const [id, text] of others) {
        lines.push(`- ${id}: ${text}`);
      }
    }
  }
  lines.push(JSON_PROTOCOL);
  return lines.join("\n");
}
