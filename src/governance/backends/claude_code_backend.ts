import { spawn } from "node:child_process";
import type { BackendEvent, BackendTask, GovernedBackend } from "./types";

const ENV_ALLOWLIST = ["PATH", "HOME", "LANG", "LC_ALL", "TMPDIR", "SHELL"];

export interface BackendChildProcess {
  stdout: {
    on(event: "data", listener: (chunk: string | Buffer) => void): void;
  };
  stderr: {
    on(event: "data", listener: (chunk: string | Buffer) => void): void;
  };
  on(event: "close", listener: (code: number | null) => void): void;
  kill(): void;
}

export type CliSpawnFn = (
  command: string,
  args: string[],
  options: { cwd: string; env: Record<string, string | undefined> },
) => BackendChildProcess;

export interface ClaudeCodeBackendOptions {
  spawnFn?: CliSpawnFn;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  sessionId?: string;
}

function sanitizeEnv(
  env: NodeJS.ProcessEnv,
): Record<string, string | undefined> {
  const sanitized: Record<string, string | undefined> = {};
  for (const key of ENV_ALLOWLIST) {
    if (env[key] !== undefined) {
      sanitized[key] = env[key];
    }
  }
  return sanitized;
}

/**
 * Claude Code CLI backend. Spawns `claude --print --output-format stream-json`
 * and maps its ndjson stream onto the backend event protocol:
 * system→started, assistant→output, result→completed (exitCode from is_error);
 * unparseable lines and timeouts → failed.
 */
export function createClaudeCodeBackend(
  options: ClaudeCodeBackendOptions = {},
): GovernedBackend {
  const {
    spawnFn = spawn as unknown as CliSpawnFn,
    env = process.env,
    timeoutMs = 120_000,
    sessionId,
  } = options;

  return {
    dispatch(task: BackendTask): AsyncIterable<BackendEvent> {
      return (async function* () {
        const args = [
          "--print",
          "--output-format",
          "stream-json",
          ...(sessionId ? ["--resume", sessionId] : []),
          task.prompt,
        ];
        const child = spawnFn("claude", args, {
          cwd: task.cwd,
          env: sanitizeEnv(env),
        });

        const queue: BackendEvent[] = [];
        let wake: (() => void) | null = null;
        const push = (event: BackendEvent) => {
          queue.push(event);
          if (wake) {
            const w = wake;
            wake = null;
            w();
          }
        };

        let buffer = "";
        let sawResult = false;
        child.stdout.on("data", (chunk) => {
          buffer += chunk;
          let newlineIndex = buffer.indexOf("\n");
          while (newlineIndex >= 0) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            if (line.length > 0) {
              try {
                const parsed = JSON.parse(line) as {
                  type?: string;
                  message?: { content?: Array<{ text?: string }> };
                  is_error?: boolean;
                };
                if (parsed.type === "system") {
                  push({ type: "started", node: task.id });
                } else if (parsed.type === "assistant") {
                  const text = (parsed.message?.content ?? [])
                    .map((part) => part.text ?? "")
                    .join("");
                  push({ type: "output", text });
                } else if (parsed.type === "result") {
                  sawResult = true;
                  push({
                    type: "completed",
                    exitCode: parsed.is_error ? 1 : 0,
                  });
                } else {
                  push({
                    type: "failed",
                    error: `unknown claude output line type: ${String(parsed.type)}`,
                  });
                }
              } catch (parseError) {
                push({
                  type: "failed",
                  error: `failed to parse claude output line: ${String(
                    parseError instanceof Error
                      ? parseError.message
                      : parseError,
                  )} (line: ${line.slice(0, 200)})`,
                });
              }
            }
            newlineIndex = buffer.indexOf("\n");
          }
        });

        const timer = setTimeout(() => {
          child.kill();
          push({ type: "failed", error: "timeout" });
        }, timeoutMs);

        child.on("close", () => {
          if (!sawResult) {
            push({ type: "failed", error: "claude exited without a result" });
          }
        });

        try {
          while (true) {
            const event =
              queue.length > 0
                ? queue.shift()!
                : await new Promise<BackendEvent>((resolve) => {
                    wake = () => resolve(queue.shift()!);
                  });
            yield event;
            if (event.type === "completed" || event.type === "failed") {
              return;
            }
          }
        } finally {
          clearTimeout(timer);
        }
      })();
    },
  };
}
