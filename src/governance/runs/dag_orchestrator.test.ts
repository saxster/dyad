import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BackendTask, GovernedBackend } from "@/governance/backends/types";
import { TaskNode } from "@/governance/core/task_graph";
import { BudgetGovernor } from "@/governance/core/budget_governor";
import { DyadErrorKind } from "@/errors/dyad_error";
import { executeDag } from "./dag_orchestrator";

interface FakeNodeBehavior {
  outputText: string;
  completedFile?: string;
}

function fakeBackendSuite(behaviors: Record<string, FakeNodeBehavior>) {
  const tasks: BackendTask[] = [];
  const backendFor = (node: TaskNode): GovernedBackend => ({
    async *dispatch(task) {
      tasks.push(task);
      const behavior = behaviors[node.id];
      yield { type: "started", node: task.id };
      yield { type: "output", node: task.id, text: behavior.outputText };
      yield {
        type: "completed",
        node: task.id,
        file: behavior.completedFile,
      };
    },
  });
  return { backendFor, tasks };
}

function tmpWorktreeFactory() {
  const dirs: string[] = [];
  const worktreeFor = async (_node: TaskNode): Promise<string> => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dag-node-"));
    dirs.push(dir);
    return dir;
  };
  return { worktreeFor, dirs };
}

function recordingEventSink() {
  const events: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const onEvent = (type: string, payload: Record<string, unknown>) => {
    events.push({ type, payload });
  };
  return { events, onEvent };
}

const threeNodeDag: TaskNode[] = [
  { id: "a", deps: [] },
  { id: "b", deps: ["a"] },
  { id: "c", deps: ["a"] },
];

describe("executeDag", () => {
  it("executes a 3-node DAG with isolation, merges results, and emits run events", async () => {
    const backend = fakeBackendSuite({
      a: { outputText: "a-out", completedFile: "a.txt" },
      b: { outputText: "b-out", completedFile: "b.txt" },
      c: { outputText: "c-out", completedFile: "c.txt" },
    });
    const worktree = tmpWorktreeFactory();
    const sink = recordingEventSink();

    const run = await executeDag(threeNodeDag, {
      backendFor: backend.backendFor,
      worktreeFor: worktree.worktreeFor,
      onEvent: sink.onEvent,
    });

    expect(run.status).toBe("completed");
    expect(run.completed).toEqual(["a", "b", "c"]);
    expect(run.blocked).toEqual([]);
    expect(Object.keys(run.results)).toEqual(["a", "b", "c"]);
    expect(run.results).toEqual({
      a: "a-out",
      b: "b-out",
      c: "c-out",
    });

    // Each node ran in its own worktree, which must exist on disk after the
    // run (no cleanup inside executeDag).
    expect(worktree.dirs).toHaveLength(3);
    expect(new Set(worktree.dirs).size).toBe(3);
    for (const dir of worktree.dirs) {
      await fs.access(dir);
    }
    expect(backend.tasks.map((task) => task.cwd)).toEqual(worktree.dirs);

    const types = new Set(sink.events.map((event) => event.type));
    expect(types.has("node_conflict")).toBe(false);
    for (const id of ["a", "b", "c"]) {
      expect(
        sink.events.some(
          (event) => event.type === "node_started" && event.payload.id === id,
        ),
      ).toBe(true);
      expect(
        sink.events.some(
          (event) => event.type === "node_completed" && event.payload.id === id,
        ),
      ).toBe(true);
    }
  });

  it("surfaces a conflict when two nodes report the same file", async () => {
    const backend = fakeBackendSuite({
      a: { outputText: "a-out", completedFile: "a.txt" },
      b: { outputText: "b-out", completedFile: "shared.txt" },
      c: { outputText: "c-out", completedFile: "shared.txt" },
    });
    const worktree = tmpWorktreeFactory();
    const sink = recordingEventSink();

    const run = await executeDag(threeNodeDag, {
      backendFor: backend.backendFor,
      worktreeFor: worktree.worktreeFor,
      onEvent: sink.onEvent,
    });

    expect(run.status).toBe("completed");
    const conflicts = sink.events.filter(
      (event) => event.type === "node_conflict",
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].payload.file).toBe("shared.txt");
    expect(conflicts[0].payload.nodes).toHaveLength(2);
    expect(conflicts[0].payload.nodes).toContain("b");
    expect(conflicts[0].payload.nodes).toContain("c");
  });

  it("fails downstream of a failed node but completes independent subtrees", async () => {
    // a fails; d depends on a; c is an independent subtree.
    const dag: TaskNode[] = [
      { id: "a", deps: [] },
      { id: "c", deps: [] },
      { id: "d", deps: ["a"] },
    ];
    const tasks: BackendTask[] = [];
    const backendFor = (node: TaskNode): GovernedBackend => ({
      async *dispatch(task) {
        tasks.push(task);
        if (node.id === "a") {
          yield { type: "started", node: task.id };
          yield { type: "failed", node: task.id, error: "boom" };
          return;
        }
        yield { type: "started", node: task.id };
        yield { type: "output", node: task.id, text: "c-out" };
        yield { type: "completed", node: task.id, file: "c.txt" };
      },
    });
    const worktree = tmpWorktreeFactory();
    const sink = recordingEventSink();

    const run = await executeDag(dag, {
      backendFor,
      worktreeFor: worktree.worktreeFor,
      onEvent: sink.onEvent,
    });

    expect(run.status).toBe("partial");
    expect(run.completed).toEqual(["c"]);
    expect(run.blocked).toEqual(["d"]);
    expect(Object.keys(run.results)).toEqual(["c"]);
    expect(run.results.c).toBe("c-out");
    expect([...new Set(tasks.map((task) => task.id))].sort()).toEqual([
      "a",
      "c",
    ]);
    const blockedEvents = sink.events.filter(
      (event) => event.type === "node_blocked",
    );
    expect(blockedEvents).toHaveLength(1);
    expect(blockedEvents[0].payload.id).toBe("d");
    expect(blockedEvents[0].payload.by).toBe("a");
  });

  it("halts the whole run when the budget governor throws", async () => {
    const governor = new BudgetGovernor(0);
    const backendFor = (_node: TaskNode): GovernedBackend => ({
      async *dispatch(task) {
        if (task.id === "b") {
          governor.record({ input: 0, output: 0, costUsd: 1 });
        }
        yield { type: "started", node: task.id };
        yield { type: "completed", node: task.id };
      },
    });
    const worktree = tmpWorktreeFactory();
    const sink = recordingEventSink();

    await expect(
      executeDag(threeNodeDag, {
        backendFor,
        worktreeFor: worktree.worktreeFor,
        onEvent: sink.onEvent,
      }),
    ).rejects.toThrow(
      expect.objectContaining({ kind: DyadErrorKind.BudgetExceeded }),
    );
  });
});
