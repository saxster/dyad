// Deterministic v1 scoring ported from Anvil's AdaptiveRigorEngine: each axis
// scores 0–3 and the composite feeds classifyTier (0–12).
const SECURITY_KEYWORDS = [
  "auth",
  "password",
  "permission",
  "payment",
  "billing",
  "checkout",
  "migration",
  "secret",
  "token",
  "credential",
  "api key",
  "private key",
  "drop table",
];

const BREADTH_KEYWORDS = [
  "rewrite the ",
  "data layer",
  "entire codebase",
  "across the codebase",
  "whole repo",
  "every file",
  "all files",
  "refactor across",
  "rename everywhere",
];

// v1 novelty is keyword-only (Anvil uses an LLM-assisted evaluation here).
const NOVELTY_KEYWORDS = ["unfamiliar", "new integration", "never"];

const BLAST_RADIUS_PATTERNS = ["src/db", "migrations", "package.json"];

export interface RigorContext {
  touchedPaths?: string[];
}

export interface RigorAxes {
  breadth: number;
  security: number;
  novelty: number;
  blastRadius: number;
}

function countHits(lowered: string, keywords: string[]): number {
  let count = 0;
  for (const keyword of keywords) {
    if (lowered.includes(keyword)) {
      count += 1;
    }
  }
  return Math.min(count, 3);
}

export function scoreRigorAxes(
  prompt: string,
  context: RigorContext,
): RigorAxes {
  const lowered = prompt.toLowerCase();
  const touched = (context.touchedPaths ?? []).join("\n").toLowerCase();
  return {
    breadth: countHits(lowered, BREADTH_KEYWORDS),
    security: countHits(lowered, SECURITY_KEYWORDS),
    novelty: countHits(lowered, NOVELTY_KEYWORDS),
    blastRadius: countHits(touched, BLAST_RADIUS_PATTERNS),
  };
}

export type RigorTier = "surgical" | "standard" | "architectural";

export function classifyTier(score: number, override?: RigorTier): RigorTier {
  if (override) {
    return override;
  }
  if (score <= 3) {
    return "surgical";
  }
  if (score <= 7) {
    return "standard";
  }
  return "architectural";
}
