import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  setupHandlerTestHarness,
  type HandlerTestHarness,
} from "@/testing/handler_test_harness";
import {
  apps,
  governanceRunEvents,
  governanceRuns,
  specVerifications,
  versions,
} from "@/db/schema";
import {
  parseSpecBundle,
  type SpecBundle,
} from "@/governance/core/spec_bundle_schemas";
import {
  appendRunEvent,
  registerGovernanceHandlers,
  stampVerification,
} from "./governance_handlers";

const FIXTURE_PATH = resolve(
  __dirname,
  "../../governance/__fixtures__/spec_bundle.fixture.json",
);

describe("governance handlers", () => {
  let harness: HandlerTestHarness;
  let appId: number;
  let appPath: string;
  let bundle: SpecBundle;

  beforeEach(async () => {
    harness = setupHandlerTestHarness();
    registerGovernanceHandlers();
    appPath = await mkdtemp(join(tmpdir(), "gov-handlers-"));
    const app = harness.db
      .insert(apps)
      .values({ name: "Governed App", path: appPath })
      .returning({ id: apps.id })
      .get();
    appId = app.id;
    bundle = parseSpecBundle(readFileSync(FIXTURE_PATH, "utf8"));
  });

  afterEach(async () => {
    harness.dispose();
    await rm(appPath, { recursive: true, force: true });
  });

  it("saves a bundle via IPC and returns the persisted artifact version", async () => {
    const result = await harness.invokeHandler<{
      bundle: SpecBundle;
      artifactVersion: number;
    }>("governance:save-spec-bundle", { appId, bundle });

    expect(result.artifactVersion).toBe(1);
    expect(result.bundle.version).toBe(1);
  });

  it("gets back the saved bundle", async () => {
    await harness.invokeHandler("governance:save-spec-bundle", {
      appId,
      bundle,
    });

    const got = await harness.invokeHandler<{
      bundle: SpecBundle;
      artifactVersion: number;
    } | null>("governance:get-spec-bundle", { appId });

    expect(got).not.toBeNull();
    expect(got?.artifactVersion).toBe(1);
    expect(got?.bundle.rawIntent).toBe(bundle.rawIntent);
    expect(got?.bundle.stories).toHaveLength(bundle.stories.length);
  });

  it("returns null when the app has no saved bundle", async () => {
    const got = await harness.invokeHandler("governance:get-spec-bundle", {
      appId,
    });
    expect(got).toBeNull();
  });

  it("lists the saved bundle versions oldest first", async () => {
    await harness.invokeHandler("governance:save-spec-bundle", {
      appId,
      bundle,
    });
    const mutated = {
      ...bundle,
      rawIntent: "Changed intent for the second version",
    };
    await harness.invokeHandler("governance:save-spec-bundle", {
      appId,
      bundle: mutated,
    });

    const history = await harness.invokeHandler<
      { version: number; bundle: SpecBundle }[]
    >("governance:list-spec-bundle-history", { appId });

    expect(history.map((entry) => entry.version)).toEqual([1, 2]);
    expect(history[0].bundle.rawIntent).toBe(bundle.rawIntent);
    expect(history[1].bundle.rawIntent).toBe(
      "Changed intent for the second version",
    );
  });
});

describe("governance approval handler", () => {
  let harness: HandlerTestHarness;
  let appId: number;
  let appPath: string;
  let pendingBundle: SpecBundle;

  beforeEach(async () => {
    harness = setupHandlerTestHarness();
    registerGovernanceHandlers();
    appPath = await mkdtemp(join(tmpdir(), "gov-approval-"));
    const app = harness.db
      .insert(apps)
      .values({ name: "Approval App", path: appPath })
      .returning({ id: apps.id })
      .get();
    appId = app.id;
    const bundle = parseSpecBundle(readFileSync(FIXTURE_PATH, "utf8"));
    pendingBundle = { ...bundle, approvalStatus: "pending_approval" };
    await harness.invokeHandler("governance:save-spec-bundle", {
      appId,
      bundle: pendingBundle,
    });
  });

  afterEach(async () => {
    harness.dispose();
    await rm(appPath, { recursive: true, force: true });
  });

  it("approves a pending bundle and stamps approvedAt", async () => {
    const result = await harness.invokeHandler<{
      approvalStatus: string;
      approvedAt: string | null;
    }>("governance:approve-spec-bundle", { appId, decision: "approve" });

    expect(result.approvalStatus).toBe("approved");
    expect(result.approvedAt).toBeTruthy();

    const got = await harness.invokeHandler<{
      bundle: SpecBundle;
    } | null>("governance:get-spec-bundle", { appId });
    expect(got?.bundle.approvalStatus).toBe("approved");
    expect(typeof got?.bundle.approvedAt).toBe("string");
  });

  it("reject routes status back to draft and stores feedback", async () => {
    const result = await harness.invokeHandler<{
      approvalStatus: string;
    }>("governance:approve-spec-bundle", {
      appId,
      decision: "reject",
      feedback: "stories lack verification contracts",
    });

    expect(result.approvalStatus).toBe("draft");

    const got = await harness.invokeHandler<{
      bundle: SpecBundle;
    } | null>("governance:get-spec-bundle", { appId });
    expect(got?.bundle.approvalStatus).toBe("draft");
    expect(got?.bundle.provenance.lastRejectionFeedback).toBe(
      "stories lack verification contracts",
    );
  });
});

describe("governance run event log", () => {
  let harness: HandlerTestHarness;
  let appId: number;

  beforeEach(() => {
    harness = setupHandlerTestHarness();
    registerGovernanceHandlers();
    const app = harness.db
      .insert(apps)
      .values({ name: "Events App", path: "/tmp/gov-events" })
      .returning({ id: apps.id })
      .get();
    appId = app.id;
  });

  afterEach(() => harness.dispose());

  it("appends ordered events to a governance run", async () => {
    const run = harness.db
      .insert(governanceRuns)
      .values({
        appId,
        chatId: null,
        lane: "governed",
        tier: "standard",
        status: "running",
      })
      .returning({ id: governanceRuns.id })
      .get();

    const first = await appendRunEvent(run.id, "run_started", {
      lane: "governed",
    });
    const second = await appendRunEvent(run.id, "verdict", {
      green: 2,
      red: 1,
    });

    expect(first.seq).toBe(1);
    expect(second.seq).toBe(2);

    const events = harness.db
      .select()
      .from(governanceRunEvents)
      .where(eq(governanceRunEvents.runId, run.id))
      .all();
    expect(events.map((e) => e.seq)).toEqual([1, 2]);
    expect(events.map((e) => e.type)).toEqual(["run_started", "verdict"]);
    expect(JSON.parse(events[0].payloadJson)).toEqual({ lane: "governed" });
    expect(JSON.parse(events[1].payloadJson)).toEqual({ green: 2, red: 1 });
  });
});

describe("verified checkpoints", () => {
  let harness: HandlerTestHarness;
  let appId: number;
  let runId: number;
  let versionId: number;

  beforeEach(() => {
    harness = setupHandlerTestHarness();
    registerGovernanceHandlers();
    const app = harness.db
      .insert(apps)
      .values({ name: "Checkpoint App", path: "/tmp/gov-checkpoints" })
      .returning({ id: apps.id })
      .get();
    appId = app.id;
    const run = harness.db
      .insert(governanceRuns)
      .values({
        appId,
        chatId: null,
        lane: "governed",
        tier: "standard",
        status: "running",
      })
      .returning({ id: governanceRuns.id })
      .get();
    runId = run.id;
    const version = harness.db
      .insert(versions)
      .values({ appId, commitHash: "abc1234567890" })
      .returning({ id: versions.id })
      .get();
    versionId = version.id;
  });

  afterEach(() => harness.dispose());

  function insertVerification(
    criterionKey: string,
    kind: "probe" | "check",
    status: string,
  ): void {
    harness.db
      .insert(specVerifications)
      .values({ runId, criterionKey, kind, status })
      .run();
  }

  function checkRows() {
    return harness.db
      .select()
      .from(specVerifications)
      .where(eq(specVerifications.runId, runId))
      .all()
      .filter((row) => row.kind === "check");
  }

  it("stamps a version as verified only when every red-first contract is green", () => {
    insertVerification("US-1/AC-1", "probe", "probe-red");
    insertVerification("US-1/AC-2", "probe", "probe-green");
    insertVerification("US-1/AC-1", "check", "green");
    insertVerification("US-1/AC-2", "check", "green");

    const result = stampVerification(runId, versionId);

    expect(result).toEqual({
      verified: true,
      criteriaCount: 2,
      green: 2,
      red: 0,
    });
    for (const row of checkRows()) {
      expect(row.versionId).toBe(versionId);
    }
  });

  it("returns verified false when one red-first contract is red", () => {
    insertVerification("US-1/AC-1", "probe", "probe-red");
    insertVerification("US-1/AC-2", "probe", "probe-green");
    insertVerification("US-1/AC-1", "check", "red");
    insertVerification("US-1/AC-2", "check", "green");

    const result = stampVerification(runId, versionId);

    expect(result.verified).toBe(false);
    expect(result.red).toBe(1);
  });

  it("returns verified false when no red-first criteria exist", () => {
    insertVerification("US-1/AC-1", "probe", "probe-green");
    insertVerification("US-1/AC-2", "probe", "probe-green");

    const result = stampVerification(runId, versionId);

    expect(result.verified).toBe(false);
    expect(result.criteriaCount).toBe(0);
  });

  it("returns the stamped verification summary for a version", async () => {
    insertVerification("US-1/AC-1", "check", "green");
    insertVerification("US-1/AC-2", "check", "red");
    harness.db
      .update(specVerifications)
      .set({ versionId })
      .where(eq(specVerifications.runId, runId))
      .run();

    const summary = await harness.invokeHandler<{
      verified: boolean;
      green: number;
      red: number;
      failing: string[];
    }>("governance:get-version-verification", {
      appId,
      commitHash: "abc1234567890",
    });

    expect(summary).toEqual({
      verified: false,
      green: 1,
      red: 1,
      failing: ["US-1/AC-2"],
    });
  });
});
