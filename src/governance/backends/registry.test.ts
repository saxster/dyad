import { describe, expect, it } from "vitest";
import { createRegistry, type ExternalBackendEntry } from "./registry";
import type { GovernedBackend } from "./types";

function makeBackend(name: string): GovernedBackend & { name: string } {
  return {
    name,
    async *dispatch() {
      yield { type: "started", node: name };
    },
  };
}

function named(backends: GovernedBackend[]): string[] {
  return backends.map(
    (backend) => (backend as unknown as { name: string }).name,
  );
}

describe("createRegistry routing", () => {
  it("routes architectural to builtin always", () => {
    const builtin = makeBackend("builtin");
    const registry = createRegistry({
      builtin,
      external: [
        { backend: makeBackend("claude"), score: 9 },
        { backend: makeBackend("codex"), score: 8 },
      ],
    });
    expect(named([registry.routeBackend("architectural")])).toEqual([
      "builtin",
    ]);
  });

  it("routes other tiers to the highest-scoring external", () => {
    const builtin = makeBackend("builtin");
    const claude = makeBackend("claude");
    const codex = makeBackend("codex");
    const registry = createRegistry({
      builtin,
      external: [
        { backend: claude, score: 8 },
        { backend: codex, score: 6 },
      ],
    });
    expect(named([registry.routeBackend("standard")])).toEqual(["claude"]);
    expect(named([registry.routeBackend("surgical")])).toEqual(["claude"]);
  });

  it("falls back to the next external when one is unavailable", () => {
    const builtin = makeBackend("builtin");
    const claude = makeBackend("claude");
    const codex = makeBackend("codex");
    const externals: ExternalBackendEntry[] = [
      { backend: claude, score: 8, available: () => false },
      { backend: codex, score: 6 },
    ];
    const registry = createRegistry({ builtin, external: externals });
    expect(named([registry.routeBackend("standard")])).toEqual(["codex"]);
  });

  it("falls back to builtin when no external is available", () => {
    const builtin = makeBackend("builtin");
    const registry = createRegistry({
      builtin,
      external: [
        { backend: makeBackend("claude"), score: 8, available: () => false },
        { backend: makeBackend("codex"), score: 6, available: () => false },
      ],
    });
    expect(named([registry.routeBackend("standard")])).toEqual(["builtin"]);
  });
});
