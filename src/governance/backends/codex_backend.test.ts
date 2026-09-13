import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import {
  createCodexBackend,
  parseJsonRpcLine,
  serializeJsonRpcRequest,
} from "./codex_backend";

function makeChild() {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const stdin = { write: vi.fn() };
  const child = Object.assign(new EventEmitter(), {
    stdout,
    stderr,
    stdin,
    kill: vi.fn(),
  });
  return child;
}

describe("codex JSON-RPC framing", () => {
  it("round-trips JSON-RPC framing", () => {
    const line = serializeJsonRpcRequest(1, "task.start", {
      prompt: "p",
      cwd: "/tmp",
    });
    expect(line.endsWith("\n")).toBe(true);
    expect(parseJsonRpcLine(line)).toEqual({
      valid: true,
      method: "task.start",
      params: { prompt: "p", cwd: "/tmp" },
    });
    expect(parseJsonRpcLine("totally not json").valid).toBe(false);
  });
});

describe("createCodexBackend", () => {
  it("dispatch → events", async () => {
    const child = makeChild();
    const spawnFn = vi.fn(
      (
        _command: string,
        _args: string[],
        _options: { cwd: string; env: Record<string, string | undefined> },
      ) => child,
    );
    const backend = createCodexBackend({
      spawnFn,
      env: { PATH: "/usr/bin", DYAD_SECRET: "leak-me" },
      timeoutMs: 5_000,
    });

    const collected: Array<{
      type: string;
      text?: string;
      exitCode?: number;
      error?: string;
    }> = [];
    const done = (async () => {
      for await (const event of backend.dispatch({
        id: "t1",
        prompt: "refactor the widget",
        cwd: "/tmp/task",
      })) {
        collected.push(event);
      }
    })();

    await new Promise((resolve) => setImmediate(resolve));
    child.stdout.emit(
      "data",
      serializeJsonRpcRequest(0, "task.started") +
        serializeJsonRpcRequest(0, "task.output", { text: "working" }) +
        serializeJsonRpcRequest(0, "task.completed", { exitCode: 0 }),
    );
    await done;

    const [command, args, options] = spawnFn.mock.calls[0];
    expect(command).toBe("codex");
    expect(args).toEqual(["exec", "--json", "refactor the widget"]);
    expect(options.cwd).toBe("/tmp/task");

    const startRequest = (child.stdin.write as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(parseJsonRpcLine(startRequest)).toEqual({
      valid: true,
      method: "task.start",
      params: { prompt: "refactor the widget", cwd: "/tmp/task" },
    });

    expect(collected.map((event) => event.type)).toEqual([
      "started",
      "output",
      "completed",
    ]);
    expect(collected[1].text).toBe("working");
    expect(collected[2].exitCode).toBe(0);
  });

  it("fails on an error notification and on timeout", async () => {
    const child = makeChild();
    const spawnFn = vi.fn(
      (
        _command: string,
        _args: string[],
        _options: { cwd: string; env: Record<string, string | undefined> },
      ) => child,
    );
    const backend = createCodexBackend({
      spawnFn,
      env: { PATH: "/usr/bin" },
      timeoutMs: 50,
    });

    const collected: Array<{ type: string; error?: string }> = [];
    const done = (async () => {
      for await (const event of backend.dispatch({
        id: "t2",
        prompt: "x",
        cwd: "/tmp",
      })) {
        collected.push(event);
      }
    })();

    await new Promise((resolve) => setImmediate(resolve));
    child.stdout.emit(
      "data",
      serializeJsonRpcRequest(0, "error", { message: "backend exploded" }),
    );
    await done;

    expect(collected.map((event) => event.type)).toEqual(["failed"]);
    expect(collected[0].error).toContain("backend exploded");

    // Timeout mirror of the claude backend.
    const slowChild = makeChild();
    const slowSpawnFn = vi.fn(
      (
        _command: string,
        _args: string[],
        _options: { cwd: string; env: Record<string, string | undefined> },
      ) => slowChild,
    );
    const slowBackend = createCodexBackend({
      spawnFn: slowSpawnFn,
      env: { PATH: "/usr/bin" },
      timeoutMs: 50,
    });

    const slowCollected: Array<{ type: string; error?: string }> = [];
    const slowDone = (async () => {
      for await (const event of slowBackend.dispatch({
        id: "t3",
        prompt: "slow",
        cwd: "/tmp",
      })) {
        slowCollected.push(event);
      }
    })();

    await new Promise((resolve) => setTimeout(resolve, 120));
    slowChild.stdout.emit(
      "data",
      serializeJsonRpcRequest(0, "task.completed", { exitCode: 0 }),
    );
    await slowDone;

    expect(slowCollected.map((event) => event.type)).toEqual(["failed"]);
    expect(slowCollected[0].error).toBe("timeout");
    expect(slowChild.kill).toHaveBeenCalled();
  });
});
