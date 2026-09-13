import { spawn } from "node:child_process";
import type { BackendEvent, BackendTask, GovernedBackend } from "./types";

const ENV_ALLOWLIST = ["PATH", "HOME", "LANG", "LC_ALL", "TMPDIR", "SHELL"];

export interface CodexChildProcess {
  stdin: { write(data: string): void };
  stdout: {
    on(event: "data", listener: (chunk: string | Buffer) => void): void;
  };
  stderr: {
    on(event: "data", listener: (chunk: string | Buffer) => void): void;
  };
  on(event: "close", listener: (code: number | null) => void): void;
  kill(): void;
}

export type CodexSpawnFn = (
  command: string,
  args: string[],
  options: { cwd: string; env: Record<string, string | undefined> },
) => CodexChildProcess;

export interface CodexBackendOptions {
  spawnFn?: CodexSpawnFn;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

export interface JsonRpcRequestLine {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

export interface ParsedJsonRpcLine {
  valid: boolean;
  method?: string;
  params?: Record<string, unknown>;
}

export function serializeJsonRpcRequest(
  id: number,
  method: string,
  params?: unknown,
): string {
  const request: JsonRpcRequestLine = { jsonrpc: "2.0", id, method, params };
  return JSON.stringify(request) + "\n";
}

export function parseJsonRpcLine(line: string): ParsedJsonRpcLine {
  try {
    const parsed = JSON.parse(line) as {
      jsonrpc?: string;
      method?: string;
      params?: Record<string, unknown>;
    };
    if (parsed.jsonrpc !== "2.0" || typeof parsed.method !== "string") {
      return { valid: false };
    }
    return { valid: true, method: parsed.method, params: parsed.params };
  } catch {
    return { valid: false };
  }
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
 * Codex CLI backend: spawns `codex exec --json <prompt>` and speaks newline
 * delimited JSON-RPC — a `task.start` request goes out on stdin; stdout
 * notifications map task.started→started, task.output→output,
 * task.completed→completed, error→failed.
 */
export function createCodexBackend(
  options: CodexBackendOptions = {},
): GovernedBackend {
  const {
    spawnFn = spawn as unknown as CodexSpawnFn,
    env = process.env,
    timeoutMs = 120_000,
  } = options;

  return {
    dispatch(task: BackendTask): AsyncIterable<BackendEvent> {
      return (async function* () {
        const child = spawnFn("codex", ["exec", "--json", task.prompt], {
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

        child.stdin.write(
          serializeJsonRpcRequest(1, "task.start", {
            prompt: task.prompt,
            cwd: task.cwd,
          }),
        );

        let buffer = "";
        child.stdout.on("data", (chunk) => {
          buffer += chunk;
          let newlineIndex = buffer.indexOf("\n");
          while (newlineIndex >= 0) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            if (line.length > 0) {
              const parsed = parseJsonRpcLine(line);
              if (!parsed.valid) {
                push({
                  type: "failed",
                  error: `invalid codex output line: ${line.slice(0, 200)}`,
                });
              } else if (parsed.method === "task.started") {
                push({ type: "started", node: task.id });
              } else if (parsed.method === "task.output") {
                push({
                  type: "output",
                  text: String(parsed.params?.text ?? ""),
                });
              } else if (parsed.method === "task.completed") {
                push({
                  type: "completed",
                  exitCode:
                    typeof parsed.params?.exitCode === "number"
                      ? parsed.params.exitCode
                      : 0,
                });
              } else if (parsed.method === "error") {
                push({
                  type: "failed",
                  error: String(parsed.params?.message ?? "codex error"),
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
          push({ type: "failed", error: "codex exited without completing" });
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
