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
