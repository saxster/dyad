import { BackendTask, GovernedBackend } from "@/governance/backends/types";
import {
  TaskNode,
  runWithBackpressure,
  topoOrder,
} from "@/governance/core/task_graph";

export type DagEventType = "node_started" | "node_completed" | "node_conflict";

export interface DagRunResult {
  status: "completed" | "partial";
  /** Last output text per node, keyed in topoOrder sequence. */
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
 */
export async function executeDag(
  nodes: TaskNode[],
  deps: ExecuteDagDeps,
): Promise<DagRunResult> {
  const order = topoOrder(nodes);
  const outputs = new Map<string, string>();
  const reportedFiles = new Map<string, string>();

  await runWithBackpressure(nodes, {
    runner: async (node) => {
      const worktree = await deps.worktreeFor(node);
      deps.onEvent("node_started", { id: node.id, worktree });
      const task: BackendTask = {
        id: node.id,
        prompt: `touch ${node.id}.done`,
        cwd: worktree,
      };
      let lastOutput = "";
      let reportedFile: string | undefined;
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

  const results: Record<string, string> = {};
  for (const id of order) {
    results[id] = outputs.get(id) ?? "";
  }
  return { status: "completed", results, completed: order, blocked: [] };
}
