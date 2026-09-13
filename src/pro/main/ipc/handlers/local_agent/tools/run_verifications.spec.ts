import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { readFileSync } from "node:fs";
import type { AgentContext } from "./types";
import { runVerificationsTool } from "./run_verifications";
import { apps, chats, specVerifications } from "@/db/schema";
import { setDatabaseForTesting } from "@/db";
import { createInMemoryTestDb, type TestDb } from "@/testing/test_db";
import { ArtifactStore } from "@/governance/artifacts/artifact_store";
import {
  parseSpecBundle,
  type SpecBundle,
} from "@/governance/core/spec_bundle_schemas";
import { eq } from "drizzle-orm";

vi.mock("electron-log", () => ({
  default: {
    scope: () => ({
      log: vi.fn(),
    }),
  },
}));

const FIXTURE_PATH = resolve(
  __dirname,
  "../../../../../../governance/__fixtures__/spec_bundle.fixture.json",
);

describe("runVerificationsTool", () => {
  let db: TestDb;
  let appPath: string;
  let ctx: AgentContext;

  beforeEach(async () => {
    db = createInMemoryTestDb();
    setDatabaseForTesting(db);
    appPath = await mkdtemp(join(tmpdir(), "gov-run-verifications-"));
    const app = db
      .insert(apps)
      .values({ name: "Run Verifications App", path: appPath })
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
      onXmlComplete: vi.fn(),
    } as unknown as AgentContext;

    await writeFile(join(appPath, "package.json"), "{}");

    const fixture = parseSpecBundle(readFileSync(FIXTURE_PATH, "utf8"));
    const bundle: SpecBundle = {
      ...fixture,
      approvalStatus: "approved",
      approvedAt: new Date().toISOString(),
      stories: [
        {
          id: "US-1",
          title: "Verification spine",
          narrative:
            "As a maintainer I want verified checkpoints so that turns are provable",
          criteria: [
            {
              id: "AC-1",
              given: "the app dir exists",
              when: "the manifest is checked",
              then: "it is present",
              verificationContract: "test -f package.json",
            },
            {
              id: "AC-2",
              given: "the app dir exists",
              when: "the missing file is checked",
              then: "it is absent",
              verificationContract: "test -f missing.txt",
            },
          ],
        },
      ],
    };
    await new ArtifactStore(appPath).saveBundle(bundle);
  });

  afterEach(async () => {
    setDatabaseForTesting(null);
    db.$client.close();
    await rm(appPath, { recursive: true, force: true });
  });

  it("runs all contracts for the approved bundle and reports per-criterion status", async () => {
    const result = await runVerificationsTool.execute({} as never, ctx);

    expect(result).toContain("US-1/AC-1 green");
    expect(result).toContain("US-1/AC-2 red");
    expect(ctx.onXmlComplete).toHaveBeenCalledWith(
      expect.stringContaining('title="Spec verification"'),
    );

    const rows = db
      .select()
      .from(specVerifications)
      .where(eq(specVerifications.kind, "check"))
      .all();
    expect(rows).toHaveLength(2);
    const byKey = Object.fromEntries(rows.map((r) => [r.criterionKey, r]));
    expect(byKey["US-1/AC-1"]).toMatchObject({
      status: "green",
      exitCode: 0,
      kind: "check",
    });
    expect(byKey["US-1/AC-2"]).toMatchObject({
      status: "red",
      kind: "check",
    });
  });
});
