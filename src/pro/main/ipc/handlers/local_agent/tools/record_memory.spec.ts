import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentContext } from "./types";
import { recordMemoryTool } from "./record_memory";
import { apps, chats, memoryItems } from "@/db/schema";
import { setDatabaseForTesting } from "@/db";
import { createInMemoryTestDb, type TestDb } from "@/testing/test_db";
import { DyadErrorKind } from "@/errors/dyad_error";

vi.mock("electron-log", () => ({
  default: {
    scope: () => ({
      log: vi.fn(),
    }),
  },
}));

describe("recordMemoryTool", () => {
  let db: TestDb;
  let appPath: string;
  let ctx: AgentContext;

  beforeEach(async () => {
    db = createInMemoryTestDb();
    setDatabaseForTesting(db);
    appPath = await mkdtemp(join(tmpdir(), "gov-record-memory-"));
    const app = db
      .insert(apps)
      .values({ name: "Record Memory App", path: appPath })
      .returning({ id: apps.id })
      .get();
    const chat = db
      .insert(chats)
      .values({ appId: app.id })
      .returning({ id: chats.id })
      .get();
    ctx = {
      appId: app.id,
      appPath,
      chatId: chat.id,
    } as AgentContext;
  });

  afterEach(async () => {
    setDatabaseForTesting(null);
    db.$client.close();
    await rm(appPath, { recursive: true, force: true });
  });

  it("stores a memory with tier and category validation", async () => {
    const result = await recordMemoryTool.execute(
      {
        body: "User prefers pnpm workspaces",
        category: "userDecision",
        tier: "long",
      },
      ctx,
    );

    const rows = db.select().from(memoryItems).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe("userDecision");
    expect(rows[0].tier).toBe("long");
    expect(rows[0].body).toBe("User prefers pnpm workspaces");
    expect(result).toContain(String(rows[0].id));
  });

  it("rejects unknown categories", async () => {
    const parsed = recordMemoryTool.inputSchema.safeParse({
      body: "x",
      category: "bogus",
    });
    expect(parsed.success).toBe(false);

    await expect(
      recordMemoryTool.execute(
        { body: "x", category: "bogus" as never, tier: "short" },
        ctx,
      ),
    ).rejects.toMatchObject({
      name: "DyadError",
      kind: DyadErrorKind.Validation,
    });
  });
});
