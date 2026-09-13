import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCliDetectionCacheForTesting, detectCli } from "./cli_detect";

function runCommandFor(stdout: string, exitCode = 0) {
  return vi.fn(async () => ({ stdout, exitCode }));
}

describe("detectCli", () => {
  afterEach(() => {
    clearCliDetectionCacheForTesting();
  });

  it.each([
    ["claude", "2.1.3 (Claude Code)", true, "2.1.3"],
    ["claude", "1.9.0", false, undefined],
    ["codex", "0.110.0", true, "0.110.0"],
    ["codex", "0.99.0", false, undefined],
    ["claude", "", false, undefined],
  ])(
    "detects %s from %j → available %s",
    async (name, stdout, expectedAvailable, expectedVersion) => {
      const result = await detectCli(name as "claude" | "codex", {
        runCommand: runCommandFor(stdout),
      });
      expect(result).toEqual(
        expectedVersion
          ? { available: expectedAvailable, version: expectedVersion }
          : { available: expectedAvailable },
      );
    },
  );

  it("treats a nonzero exit as unavailable", async () => {
    const result = await detectCli("claude", {
      runCommand: runCommandFor("2.1.3 (Claude Code)", 1),
    });
    expect(result).toEqual({ available: false });
  });

  it("caches results within the TTL and re-invokes after expiry", async () => {
    let nowMs = 1_000_000;
    const runCommand = vi.fn(async () => ({
      stdout: "2.1.3 (Claude Code)",
      exitCode: 0,
    }));
    const options = { runCommand, now: () => nowMs };

    await detectCli("claude", options);
    await detectCli("claude", options);
    expect(runCommand).toHaveBeenCalledTimes(1);

    nowMs += 300_001;
    await detectCli("claude", options);
    expect(runCommand).toHaveBeenCalledTimes(2);
  });
});
