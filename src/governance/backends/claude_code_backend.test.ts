import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { createClaudeCodeBackend } from "./claude_code_backend";
import type { BackendEvent } from "./types";

function makeChild() {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const child = Object.assign(new EventEmitter(), {
    stdout,
    stderr,
    kill: vi.fn(),
  });
  return child;
}

function ndjsonLine(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

describe("createClaudeCodeBackend", () => {
  it("spawns claude with the baked argv, sanitized env, and maps ndjson to events", async () => {
    const child = makeChild();
    const spawnFn = vi.fn(
      (
        _command: string,
        _args: string[],
        _options: { cwd: string; env: Record<string, string | undefined> },
      ) => child,
    );
    const backend = createClaudeCodeBackend({
      spawnFn,
      env: {
        PATH: "/usr/bin",
        HOME: "/home/tester",
        DYAD_SECRET: "leak-me",
        DYAD_APP_ID: "1",
        LANG: "en_US.UTF-8",
      },
      timeoutMs: 5_000,
    });

    const collected: BackendEvent[] = [];
    const done = (async () => {
      for await (const event of backend.dispatch({
        id: "t1",
        prompt: "hello",
        cwd: "/tmp/task",
      })) {
        collected.push(event);
      }
    })();

    // Let the generator start and attach listeners before emitting.
    await new Promise((resolve) => setImmediate(resolve));
    child.stdout.emit(
      "data",
      ndjsonLine({ type: "system" }) +
        ndjsonLine({
          type: "assistant",
          message: { content: [{ text: "hi" }] },
        }) +
        ndjsonLine({ type: "result", is_error: false }),
    );
    await done;

    expect(spawnFn).toHaveBeenCalledTimes(1);
    const [command, args, options] = spawnFn.mock.calls[0];
    expect(command).toBe("claude");
    expect(args).toEqual([
      "--print",
      "--output-format",
      "stream-json",
      "hello",
    ]);
    expect(options.cwd).toBe("/tmp/task");
    expect(Object.keys(options.env).sort()).toEqual(["HOME", "LANG", "PATH"]);
    expect(Object.values(options.env)).not.toContain("leak-me");

    expect(collected.map((event) => event.type)).toEqual([
      "started",
      "output",
      "completed",
    ]);
    expect(collected[1].text).toBe("hi");
    expect(collected[2].exitCode).toBe(0);
  });

  it("resumes a session with --resume before the prompt", async () => {
    const child = makeChild();
    const spawnFn = vi.fn(
      (
        _command: string,
        _args: string[],
        _options: { cwd: string; env: Record<string, string | undefined> },
      ) => child,
    );
    const backend = createClaudeCodeBackend({
      spawnFn,
      env: { PATH: "/usr/bin" },
      sessionId: "sess-7",
      timeoutMs: 5_000,
    });

    const done = (async () => {
      for await (const _event of backend.dispatch({
        id: "t2",
        prompt: "continue",
        cwd: "/tmp",
      })) {
        // drain
      }
    })();
    await new Promise((resolve) => setImmediate(resolve));
    child.stdout.emit("data", ndjsonLine({ type: "system" }));
    child.stdout.emit("data", ndjsonLine({ type: "result", is_error: false }));
    await done;

    const args = spawnFn.mock.calls[0][1];
    expect(args).toEqual([
      "--print",
      "--output-format",
      "stream-json",
      "--resume",
      "sess-7",
      "continue",
    ]);
  });

  it("fails on unparseable output lines", async () => {
    const child = makeChild();
    const spawnFn = vi.fn(
      (
        _command: string,
        _args: string[],
        _options: { cwd: string; env: Record<string, string | undefined> },
      ) => child,
    );
    const backend = createClaudeCodeBackend({
      spawnFn,
      env: { PATH: "/usr/bin" },
      timeoutMs: 5_000,
    });

    const collected: BackendEvent[] = [];
    const done = (async () => {
      for await (const event of backend.dispatch({
        id: "t3",
        prompt: "x",
        cwd: "/tmp",
      })) {
        collected.push(event);
      }
    })();
    await new Promise((resolve) => setImmediate(resolve));
    child.stdout.emit("data", "not-json-at-all\n");
    await done;

    expect(collected.map((event) => event.type)).toEqual(["failed"]);
    expect(collected[0].error).toContain("not-json-at-all");
  });

  it("kills the process and fails with timeout when no result arrives", async () => {
    const child = makeChild();
    const spawnFn = vi.fn(
      (
        _command: string,
        _args: string[],
        _options: { cwd: string; env: Record<string, string | undefined> },
      ) => child,
    );
    const backend = createClaudeCodeBackend({
      spawnFn,
      env: { PATH: "/usr/bin" },
      timeoutMs: 50,
    });

    const collected: BackendEvent[] = [];
    const done = (async () => {
      for await (const event of backend.dispatch({
        id: "t4",
        prompt: "slow",
        cwd: "/tmp",
      })) {
        collected.push(event);
      }
    })();
    await new Promise((resolve) => setImmediate(resolve));
    child.stdout.emit("data", ndjsonLine({ type: "system" }));
    // The result arrives only after the timeout has fired.
    await new Promise((resolve) => setTimeout(resolve, 120));
    child.stdout.emit("data", ndjsonLine({ type: "result", is_error: false }));
    await done;

    expect(collected.map((event) => event.type)).toEqual(["started", "failed"]);
    expect(collected[1].error).toBe("timeout");
    expect(child.kill).toHaveBeenCalled();
  });
});
