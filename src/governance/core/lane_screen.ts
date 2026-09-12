// Ported from Anvil's LeanLaneEligibility (ANVIL/anvil-macOS/Core/Workflow/LeanLane.swift).
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

export type ExecutionLane = "lean" | "governed";

export function screenLane(prompt: string): ExecutionLane {
  const lowered = prompt.toLowerCase();
  if (SECURITY_SIGNALS.some((signal) => lowered.includes(signal))) {
    return "governed";
  }
  return "lean";
}
