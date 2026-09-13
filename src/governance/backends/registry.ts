import type { GovernedBackend } from "./types";

export type BackendTier = "surgical" | "standard" | "architectural";

export interface ExternalBackendEntry {
  backend: GovernedBackend;
  score: number;
  /** Deferred availability probe; defaults to available. */
  available?: () => boolean;
}

export interface BackendRegistry {
  builtin: GovernedBackend;
  routeBackend(tier: BackendTier): GovernedBackend;
}

/**
 * Tier-based backend routing: architectural work always runs on the builtin
 * backend; other tiers take the highest-scoring available external (ties keep
 * registration order), falling back to builtin when none are available.
 */
export function createRegistry({
  builtin,
  external,
}: {
  builtin: GovernedBackend;
  external: ExternalBackendEntry[];
}): BackendRegistry {
  return {
    builtin,
    routeBackend(tier: BackendTier): GovernedBackend {
      if (tier === "architectural") {
        return builtin;
      }
      const candidates = external
        .filter((entry) => entry.available?.() ?? true)
        .sort((a, b) => b.score - a.score);
      return candidates[0]?.backend ?? builtin;
    },
  };
}
