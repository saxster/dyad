import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile, stat, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSession, saveSession } from "./session_resumption";

describe("session resumption store", () => {
  const roots: string[] = [];

  afterEach(async () => {
    for (const root of roots.splice(0)) {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("round-trips a saved session", async () => {
    const root = await mkdtemp(join(tmpdir(), "gov-sessions-"));
    roots.push(root);

    await saveSession(root, {
      backend: "claude",
      sessionId: "sess-42",
      cwd: "/tmp/task",
    });

    const record = await loadSession(root, "claude");
    expect(record).toMatchObject({
      backend: "claude",
      sessionId: "sess-42",
      cwd: "/tmp/task",
    });
  });

  it.skipIf(process.platform === "win32")(
    "saves the session file with mode 0o600",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "gov-sessions-mode-"));
      roots.push(root);

      await saveSession(root, {
        backend: "codex",
        sessionId: "sess-7",
        cwd: "/tmp",
      });

      const file = join(root, ".dyad", "sessions", "codex.json");
      const info = await stat(file);
      expect(info.mode & 0o777).toBe(0o600);
    },
  );

  it("returns null for missing and expired sessions", async () => {
    const root = await mkdtemp(join(tmpdir(), "gov-sessions-exp-"));
    roots.push(root);

    expect(await loadSession(root, "claude")).toBeNull();

    const now = new Date();
    const sessionsDir = join(root, ".dyad", "sessions");
    await mkdir(sessionsDir, { recursive: true });
    await writeFile(
      join(sessionsDir, "claude.json"),
      JSON.stringify({
        backend: "claude",
        sessionId: "old",
        cwd: "/tmp",
        savedAt: new Date(now.getTime() - 25 * 3_600_000).toISOString(),
      }),
    );
    expect(await loadSession(root, "claude", now)).toBeNull();
  });
});
