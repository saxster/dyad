export function buildCouncilSystemPrompt(
  memberId: string,
  round: number,
  priorRoundTexts: Record<string, string> = {},
): string {
  const lines = [
    `You are ${memberId}, a member of an adversarial review council (round ${round}).`,
    "Critique the work under review and respond with ONLY a JSON object of the shape:",
    '{ "findings": [{ "severity": "critical" | "major" | "minor", "claim": string, "evidence": string }] }',
    "severity: critical = ship-blocker, major = must fix before ship, minor = nice to fix.",
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
  return lines.join("\n");
}
