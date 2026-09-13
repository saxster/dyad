import { BackendTask, GovernedBackend } from "@/governance/backends/types";
import {
  TaskNode,
  runWithBackpressure,
  topoOrder,
} from "@/governance/core/task_graph";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";

export type DagEventType =
  | "node_started"
  | "node_completed"
  | "node_blocked"
  | "node_conflict";

export interface DagRunResult {
  status: "completed" | "partial";
  /** Last output text per completed node, keyed in topoOrder sequence. */
  results: Record<string, string>;
  completed: string[];
  blocked: string[];
}

export interface ExecuteDagDeps {
  backendFor(node: TaskNode): GovernedBackend;
  worktreeFor(node: TaskNode): Promise<string>;
  onEvent(type: DagEventType, payload: Record<string, unknown>): void;
}

/**
 * Runs every node in its own worktree through the backpressure scheduler.
 * Each node gets a fresh backend from `backendFor`; node prompts follow the
 * marker-executor convention (`touch <id>.done`) because the backend factory
 * is injected and cannot carry per-node prompts itself. Completed events that
 * report the same `file` from different nodes are surfaced as conflicts.
 *
 * A failed node resolves the run as "partial": its transitive dependents are
 * blocked (emitting node_blocked) while independent subtrees still complete.
 * A DyadError with kind BudgetExceeded is fatal and rejects the whole run.
 */
export async function executeDag(
  nodes: TaskNode[],
  deps: ExecuteDagDeps,
): Promise<DagRunResult> {
  const order = topoOrder(nodes);
  const outputs = new Map<string, string>();
  const reportedFiles = new Map<string, string>();
  const failed = new Set<string>();
  const blocked = new Set<string>();

  await runWithBackpressure(nodes, {
    runner: async (node) => {
      const blockingDep = node.deps.find(
        (dep) => failed.has(dep) || blocked.has(dep),
      );
      if (blockingDep !== undefined) {
        blocked.add(node.id);
        deps.onEvent("node_blocked", { id: node.id, by: blockingDep });
        return;
      }
      const worktree = await deps.worktreeFor(node);
      deps.onEvent("node_started", { id: node.id, worktree });
      const task: BackendTask = {
        id: node.id,
        prompt: `touch ${node.id}.done`,
        cwd: worktree,
      };
      let lastOutput = "";
      let reportedFile: string | undefined;
      try {
        for await (const event of deps.backendFor(node).dispatch(task)) {
          if (event.type === "output") {
            lastOutput = event.text ?? "";
          } else if (event.type === "completed") {
            reportedFile = event.file;
            if (event.file) {
              reportedFiles.set(node.id, event.file);
            }
          } else if (event.type === "failed") {
            throw new Error(
              `node ${node.id} failed: ${event.error ?? "unknown error"}`,
            );
          }
        }
      } catch (error) {
        if (
          error instanceof DyadError &&
          error.kind === DyadErrorKind.BudgetExceeded
        ) {
          throw error;
        }
        failed.add(node.id);
        return;
      }
      outputs.set(node.id, lastOutput);
      deps.onEvent("node_completed", {
        id: node.id,
        result: lastOutput,
        file: reportedFile,
      });
    },
  });

  const fileReporters = new Map<string, string[]>();
  for (const [id, file] of reportedFiles) {
    const reporters = fileReporters.get(file);
    if (reporters) {
      reporters.push(id);
    } else {
      fileReporters.set(file, [id]);
    }
  }
  for (const [file, reporters] of fileReporters) {
    if (reporters.length > 1) {
      deps.onEvent("node_conflict", { file, nodes: reporters });
    }
  }

  const completed = order.filter((id) => !failed.has(id) && !blocked.has(id));
  const results: Record<string, string> = {};
  for (const id of completed) {
    results[id] = outputs.get(id) ?? "";
  }
  return {
    status: failed.size + blocked.size > 0 ? "partial" : "completed",
    results,
    completed,
    blocked: order.filter((id) => blocked.has(id)),
  };
}
