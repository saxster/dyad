export type CliName = "claude" | "codex";

export interface CliRunCommandResult {
  stdout: string;
  exitCode?: number;
}

export type CliRunCommand = (command: string) => Promise<CliRunCommandResult>;

export interface CliDetection {
  available: boolean;
  version?: string;
}

const MIN_CLI_VERSION: Record<CliName, [number, number, number]> = {
  claude: [2, 0, 0],
  codex: [0, 100, 0],
};

export function parseFirstSemverToken(stdout: string): string | null {
  const match = stdout.match(/\d+\.\d+\.\d+/);
  return match ? match[0] : null;
}

/** Numeric dot-compare of 1-3 component version strings. */
export function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const ai = pa[i] ?? 0;
    const bi = pb[i] ?? 0;
    if (ai !== bi) {
      return ai - bi;
    }
  }
  return 0;
}

const CACHE_TTL_MS = 300_000;
const cache = new Map<string, CliDetection & { at: number }>();

/** Test-only: reset the module-level detection cache. */
export function clearCliDetectionCacheForTesting(): void {
  cache.clear();
}

export async function detectCli(
  name: CliName,
  options: {
    runCommand: CliRunCommand;
    now?: () => number;
    cacheTtlMs?: number;
  },
): Promise<CliDetection> {
  const { runCommand, now = Date.now, cacheTtlMs = CACHE_TTL_MS } = options;

  const cached = cache.get(name);
  if (cached && now() - cached.at < cacheTtlMs) {
    return { available: cached.available, version: cached.version };
  }

  let detection: CliDetection;
  try {
    const { stdout, exitCode } = await runCommand(`${name} --version`);
    const version = parseFirstSemverToken(stdout);
    const ranCleanly = exitCode === undefined || exitCode === 0;
    const meetsMinimum =
      version !== null &&
      compareSemver(version, MIN_CLI_VERSION[name].join(".")) >= 0;
    detection =
      ranCleanly && meetsMinimum
        ? { available: true, version }
        : { available: false };
  } catch {
    detection = { available: false };
  }

  cache.set(name, { ...detection, at: now() });
  return detection;
}
