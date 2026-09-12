import { describe, it, expect } from "vitest";
import { screenLane } from "./lane_screen";

// Every security signal from Anvil's LeanLaneEligibility (LeanLane.swift).
const SECURITY_SIGNALS = [
  "rm ",
  "git push",
  "git commit",
  "git reset",
  "force push",
  "sudo ",
  "chmod ",
  "docker ",
  "npm install",
  "brew ",
  "kubectl",
  "terraform",
  "deploy",
  "production",
  ".env",
  "secret",
  "credential",
  "password",
  "api key",
  "api_key",
  "private key",
  "package.swift",
  "migration",
  "drop table",
  "drop database",
  "prod database",
];

describe("screenLane", () => {
  it.each(SECURITY_SIGNALS.map((signal) => ({ signal })))(
    "routes a prompt containing $signal to governed",
    ({ signal }) => {
      const prompt = `operator request: please ${signal}handle the rest carefully`;

      expect(screenLane(prompt)).toBe("governed");
    },
  );

  it("matches signals case-insensitively", () => {
    expect(screenLane("Please GIT PUSH to main")).toBe("governed");
  });
});

describe("screenLane breadth signals", () => {
  it.each(
    [
      "refactor across",
      "rename everywhere",
      "every file",
      "all files",
      "entire codebase",
      "across the codebase",
      "whole repo",
      "migrate ",
      "rewrite the ",
    ].map((signal) => ({ signal })),
  )("routes a prompt containing $signal to governed", ({ signal }) => {
    const prompt = `broad request: ${signal}modules need attention`;

    expect(screenLane(prompt)).toBe("governed");
  });

  it("returns lean for a benign surgical prompt", () => {
    expect(screenLane("fix the typo in button label")).toBe("lean");
  });
});
