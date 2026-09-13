import { describe, expect, it } from "vitest";
import { TaskNode, readySet, topoOrder } from "./task_graph";

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
