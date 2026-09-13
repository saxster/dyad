import { describe, expect, it } from "vitest";
import {
  TaskNode,
  readySet,
  runWithBackpressure,
  topoOrder,
} from "./task_graph";

/** Drains every pending microtask before continuing. */
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

describe("task graph", () => {
  const diamond: TaskNode[] = [
    { id: "a", title: "Root", deps: [] },
    { id: "b", deps: ["a"], stories: ["US-1"] },
    { id: "c", deps: ["a"] },
    { id: "d", deps: ["b", "c"] },
  ];

  it("orders nodes topologically and rejects cycles", () => {
    const order = topoOrder(diamond);

    // Deps must be respected pairwise; the diamond admits two valid orders
    // ([a, b, c, d] or [a, c, b, d]), so the exact sequence is not asserted.
    expect(order).toHaveLength(diamond.length);
    const position = new Map(order.map((id, index) => [id, index]));
    for (const node of diamond) {
      for (const dep of node.deps) {
        expect(position.get(dep)!).toBeLessThan(position.get(node.id)!);
      }
    }

    const cycle: TaskNode[] = [
      { id: "x", deps: ["y"] },
      { id: "y", deps: ["x"] },
    ];
    expect(() => topoOrder(cycle)).toThrow("cycle detected: x, y");
  });

  it("computes ready set as nodes with all deps completed", () => {
    expect(readySet(diamond, new Set(["a"]))).toEqual(new Set(["b", "c"]));
    expect(readySet(diamond, new Set(["a", "b"]))).toEqual(new Set(["c"]));
    expect(readySet(diamond, new Set(["a", "b", "c", "d"]))).toEqual(
      new Set([]),
    );
  });
});

describe("runWithBackpressure", () => {
  it("caps concurrent runners at 4 and admits queued nodes on completion", async () => {
    const nodes: TaskNode[] = Array.from({ length: 10 }, (_, i) => ({
      id: `n${i}`,
      deps: [],
    }));
    let inFlight = 0;
    let maxObserved = 0;
    const ran: string[] = [];
    const gates: Array<() => void> = [];
    const runner = (node: TaskNode) => {
      ran.push(node.id);
      inFlight += 1;
      maxObserved = Math.max(maxObserved, inFlight);
      return new Promise<string>((resolve) => {
        gates.push(() => {
          inFlight -= 1;
          resolve(node.id);
        });
      });
    };

    const promise = runWithBackpressure(nodes, { runner });
    await tick();
    expect(gates).toHaveLength(4);

    for (let released = 0; released < 10; released++) {
      gates.shift()!();
      await tick();
    }
    expect(gates).toHaveLength(0);

    expect(await promise).toEqual([
      "n0",
      "n1",
      "n2",
      "n3",
      "n4",
      "n5",
      "n6",
      "n7",
      "n8",
      "n9",
    ]);
    expect(ran).toHaveLength(10);
    expect(maxObserved).toBeLessThanOrEqual(4);
  });

  it("starts a dependent node only after its dependency completes", async () => {
    const nodes: TaskNode[] = [
      { id: "a", deps: [] },
      { id: "b", deps: ["a"] },
    ];
    let counter = 0;
    const stamps: Record<string, { start?: number; end?: number }> = {
      a: {},
      b: {},
    };
    const gates: Array<() => void> = [];
    const runner = (node: TaskNode) => {
      stamps[node.id].start = ++counter;
      return new Promise<string>((resolve) => {
        gates.push(() => {
          stamps[node.id].end = ++counter;
          resolve(node.id);
        });
      });
    };

    const promise = runWithBackpressure(nodes, { runner });
    await tick();
    expect(stamps.a.start).toBeDefined();
    expect(stamps.b.start).toBeUndefined();

    gates.shift()!();
    await tick();

    expect(stamps.a.end).toBeDefined();
    expect(stamps.a.end!).toBeLessThan(stamps.b.start!);

    gates.shift()!();
    await tick();
    expect(await promise).toEqual(["a", "b"]);
  });
});
