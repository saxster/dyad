import { spawn } from "node:child_process";
import type { VerificationContract } from "./extract_contracts";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";

// Checked first; a denied command is refused even if it matches an allow prefix.
const DENY_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bsudo\b/i,
  /\bgit\s+push\b/i,
  /\bchmod\s+777\b/i,
  /\|\s*(sh|bash)\s*$/i,
  /\brm\s[^;]*;/i,
];

const ALLOW_PREFIXES = [
  "npm test",
  "npm run",
  "node ",
  "npx tsc",
  "git diff",
  "test ",
  "sh ",
  "touch ",
];

export function isSafeVerificationCommand(command: string): boolean {
  if (DENY_PATTERNS.some((pattern) => pattern.test(command))) {
    return false;
  }
  return ALLOW_PREFIXES.some((prefix) => command.startsWith(prefix));
}

export type ContractStatus = "green" | "red" | "timeout";

export interface ContractResult {
  key: string;
  status: ContractStatus;
  exitCode?: number;
  outputTail: string;
  durationMs: number;
}

export interface RunCommandOutcome {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export type RunCommandFn = (
  command: string,
  cwd: string,
  timeoutMs: number,
) => Promise<RunCommandOutcome>;

const OUTPUT_TAIL_LIMIT = 4000;

function defaultRunCommand(
  command: string,
  cwd: string,
  timeoutMs: number,
): Promise<RunCommandOutcome> {
  return new Promise((resolve) => {
    // detached + group kill so a nested `sh <script>` child cannot outlive the
    // timeout and hold the stdio pipes open (the "close" event never fires).
    const child = spawn("sh", ["-c", command], { cwd, detached: true });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid !== undefined) {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {
          child.kill("SIGTERM");
        }
      } else {
        child.kill("SIGTERM");
      }
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: timedOut ? null : (code ?? 1),
        stdout,
        stderr,
        timedOut,
      });
    });
  });
}

function tail(text: string): string {
  return text.length > OUTPUT_TAIL_LIMIT
    ? text.slice(-OUTPUT_TAIL_LIMIT)
    : text;
}

export async function runContracts(
  contracts: VerificationContract[],
  options: { cwd: string; timeoutMs?: number; runCommand?: RunCommandFn },
): Promise<ContractResult[]> {
  const { cwd, timeoutMs = 30_000, runCommand = defaultRunCommand } = options;
  const results: ContractResult[] = [];

  for (const contract of contracts) {
    if (!isSafeVerificationCommand(contract.command)) {
      throw new DyadError(
        `verification contract "${contract.key}" refused unsafe command: ${contract.command}`,
        DyadErrorKind.Validation,
      );
    }
    const startedAt = Date.now();
    const outcome = await runCommand(contract.command, cwd, timeoutMs);
    const durationMs = Date.now() - startedAt;

    results.push({
      key: contract.key,
      status: outcome.timedOut
        ? "timeout"
        : outcome.exitCode === 0
          ? "green"
          : "red",
      ...(outcome.timedOut ? {} : { exitCode: outcome.exitCode ?? 1 }),
      outputTail: tail(`${outcome.stdout}${outcome.stderr}`),
      durationMs,
    });
  }

  return results;
}
