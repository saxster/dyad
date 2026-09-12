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
import { apps, governanceRunEvents, governanceRuns } from "@/db/schema";
import {
  parseSpecBundle,
  type SpecBundle,
} from "@/governance/core/spec_bundle_schemas";
import {
  appendRunEvent,
  registerGovernanceHandlers,
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
