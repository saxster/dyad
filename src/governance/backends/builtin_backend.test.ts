import { describe, expect, it } from "vitest";
import { createBuiltinBackend } from "./builtin_backend";
import type { BackendTask } from "./types";

describe("createBuiltinBackend", () => {
  it("yields started → output → completed for a successful task", async () => {
    const seenTasks: BackendTask[] = [];
    const backend = createBuiltinBackend(async (task) => {
      seenTasks.push(task);
      return { exitCode: 0, output: "did the thing" };
    });

    const events = [];
    for await (const event of backend.dispatch({
      id: "t1",
      prompt: "true",
      cwd: "/tmp/somewhere",
    })) {
      events.push(event);
    }

    expect(seenTasks).toEqual([
      { id: "t1", prompt: "true", cwd: "/tmp/somewhere" },
    ]);
    expect(events.map((event) => event.type)).toEqual([
      "started",
      "output",
      "completed",
    ]);
    expect(events[0]).toEqual({ type: "started", node: "t1" });
    expect(events[1]).toEqual({ type: "output", text: "did the thing" });
    expect(events[2]).toEqual({ type: "completed", exitCode: 0 });
  });

  it("yields failed for a nonzero exit and when the executor throws", async () => {
    const nonzeroBackend = createBuiltinBackend(async () => ({
      exitCode: 3,
      output: "partial output",
    }));
    const nonzeroEvents = [];
    for await (const event of nonzeroBackend.dispatch({
      id: "t2",
      prompt: "false",
      cwd: "/tmp",
    })) {
      nonzeroEvents.push(event);
    }
    expect(nonzeroEvents.map((event) => event.type)).toEqual([
      "started",
      "output",
      "failed",
    ]);
    expect(nonzeroEvents[2]).toEqual({ type: "failed", exitCode: 3 });

    const throwingBackend = createBuiltinBackend(async () => {
      throw new Error("boom");
    });
    const throwingEvents = [];
    for await (const event of throwingBackend.dispatch({
      id: "t3",
      prompt: "x",
      cwd: "/tmp",
    })) {
      throwingEvents.push(event);
    }
    expect(throwingEvents.map((event) => event.type)).toEqual([
      "started",
      "failed",
    ]);
    expect(throwingEvents[1].error).toBe("boom");
  });
});
