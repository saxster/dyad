import type { BackendEvent, BackendTask, GovernedBackend } from "./types";

export interface BuiltinExecutorResult {
  exitCode: number;
  output: string;
}

export type BuiltinExecutor = (
  task: BackendTask,
) => Promise<BuiltinExecutorResult>;

/**
 * Builtin passthrough backend: delegates to the injected executor and
 * translates the result into the standard lifecycle event stream
 * (started → output → completed|failed).
 */
export function createBuiltinBackend(
  executor: BuiltinExecutor,
): GovernedBackend {
  return {
    async *dispatch(task: BackendTask): AsyncGenerator<BackendEvent> {
      yield { type: "started", node: task.id };
      try {
        const result = await executor(task);
        yield { type: "output", text: result.output };
        if (result.exitCode === 0) {
          yield { type: "completed", exitCode: 0 };
        } else {
          yield { type: "failed", exitCode: result.exitCode };
        }
      } catch (error) {
        yield {
          type: "failed",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}
