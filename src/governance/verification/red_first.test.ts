import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { probeRedFirst, recordProbe } from "./red_first";
import { apps, governanceRuns, specVerifications } from "@/db/schema";
import { setDatabaseForTesting } from "@/db";
import { createInMemoryTestDb, type TestDb } from "@/testing/test_db";

let cwd: string;

async function writeScript(name: string, body: string): Promise<void> {
  await fs.writeFile(path.join(cwd, name), body, { mode: 0o755 });
}

describe("probeRedFirst", () => {
  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), "red-first-"));
    await writeScript("pass.sh", "#!/bin/sh\nexit 0\n");
    await writeScript("fail.sh", "#!/bin/sh\nexit 3\n");
  });

  afterEach(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  it("marks a criterion unproven when its command is already green before implementation", async () => {
    const results = await probeRedFirst(
      [{ key: "US-1/AC-1", command: "sh pass.sh" }],
      { cwd },
    );

    expect(results).toEqual([
      { key: "US-1/AC-1", redFirst: false, status: "green" },
    ]);
  });

  it("marks red-first criteria eligible", async () => {
    const results = await probeRedFirst(
      [{ key: "US-1/AC-1", command: "sh fail.sh" }],
      { cwd },
    );

    expect(results).toEqual([
      { key: "US-1/AC-1", redFirst: true, status: "red" },
    ]);
  });
});

describe("recordProbe", () => {
  let db: TestDb;
  let runId: number;

  beforeEach(() => {
    db = createInMemoryTestDb();
    setDatabaseForTesting(db);
    const app = db
      .insert(apps)
      .values({ name: "Probe App", path: "/tmp/gov-probe" })
      .returning({ id: apps.id })
      .get();
    const run = db
      .insert(governanceRuns)
      .values({
        appId: app.id,
        chatId: null,
        lane: "governed",
        tier: "standard",
        status: "running",
      })
      .returning({ id: governanceRuns.id })
      .get();
    runId = run.id;
  });

  afterEach(() => {
    setDatabaseForTesting(null);
    db.$client.close();
  });

  it("persists probe results with kind probe", async () => {
    await recordProbe(runId, [
      { key: "US-1/AC-1", redFirst: false, status: "green" },
      { key: "US-1/AC-2", redFirst: true, status: "red" },
    ]);

    const rows = db
      .select()
      .from(specVerifications)
      .where(eq(specVerifications.runId, runId))
      .all();
    expect(rows).toHaveLength(2);
    const byKey = Object.fromEntries(rows.map((r) => [r.criterionKey, r]));
    expect(byKey["US-1/AC-1"]).toMatchObject({
      runId,
      criterionKey: "US-1/AC-1",
      status: "probe-green",
      kind: "probe",
      exitCode: null,
      outputTail: null,
    });
    expect(byKey["US-1/AC-2"]).toMatchObject({
      runId,
      criterionKey: "US-1/AC-2",
      status: "probe-red",
      kind: "probe",
      exitCode: null,
      outputTail: null,
    });
  });
});
