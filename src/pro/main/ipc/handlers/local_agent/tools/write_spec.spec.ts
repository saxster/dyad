import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentContext } from "./types";
import { writeSpecTool } from "./write_spec";
import { DyadErrorKind } from "@/errors/dyad_error";
import { apps, chats, specBundles } from "@/db/schema";
import { setDatabaseForTesting } from "@/db";
import { createInMemoryTestDb, type TestDb } from "@/testing/test_db";

vi.mock("electron-log", () => ({
  default: {
    scope: () => ({
      log: vi.fn(),
    }),
  },
}));

describe("writeSpecTool", () => {
  let db: TestDb;
  let appPath: string;
  let ctx: AgentContext;

  beforeEach(async () => {
    db = createInMemoryTestDb();
    setDatabaseForTesting(db);
    appPath = await mkdtemp(join(tmpdir(), "gov-write-spec-"));
    const app = db
      .insert(apps)
      .values({ name: "Write Spec App", path: appPath })
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

  it("persists a valid spec bundle draft and returns artifact version", async () => {
    const result = await writeSpecTool.execute(
      {
        rawIntent: "Add exportable verification scripts",
        stories: [
          {
            id: "US-1",
            title: "Export scripts",
            narrative:
              "As a maintainer I want export scripts so that verification is rerunnable",
            priority: "must" as const,
            criteria: [
              {
                id: "AC-1",
                given: "an approved bundle",
                when: "export runs",
                then: "scripts are written",
                verificationContract: "npm test -- foo",
              },
            ],
          },
        ],
        notDoingList: ["No GUI-only verification"],
        risks: [
          {
            title: "Unsafe commands",
            description: "A destructive command could be persisted",
            likelihood: "Medium",
            impact: "High",
          },
        ],
      },
      ctx,
    );

    expect(existsSync(join(appPath, ".dyad", "specs", "bundle.json"))).toBe(
      true,
    );
    expect(existsSync(join(appPath, ".dyad", "specs", "requirements.md"))).toBe(
      true,
    );

    const row = db.select().from(specBundles).all();
    expect(row).toHaveLength(1);
    expect(row[0]).toMatchObject({
      appId: ctx.appId,
      approvalStatus: "pending_approval",
      artifactVersion: 1,
    });

    expect(result).toContain("US-1");
    expect(result).toContain("1");
  });
});

describe("writeSpecTool rejection path", () => {
  let db: TestDb;
  let appPath: string;
  let ctx: AgentContext;

  beforeEach(async () => {
    db = createInMemoryTestDb();
    setDatabaseForTesting(db);
    appPath = await mkdtemp(join(tmpdir(), "gov-write-spec-bad-"));
    const app = db
      .insert(apps)
      .values({ name: "Write Spec Bad App", path: appPath })
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

  it("returns a validation error the model can fix when stories lack criteria", async () => {
    const error = await writeSpecTool
      .execute(
        {
          rawIntent: "Add a thing",
          stories: [
            {
              id: "US-1",
              title: "No criteria story",
              narrative: "As a user I want a thing so that it works",
              criteria: [],
            },
          ],
          notDoingList: [],
          risks: [],
        },
        ctx,
      )
      .catch((e) => e);

    expect(error.name).toBe("DyadError");
    expect(error.kind).toBe(DyadErrorKind.Validation);
    expect(error.message).toContain("stories");
    expect(error.message).toContain("criteria");
  });
});
