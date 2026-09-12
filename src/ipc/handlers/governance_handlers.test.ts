import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  setupHandlerTestHarness,
  type HandlerTestHarness,
} from "@/testing/handler_test_harness";
import { apps } from "@/db/schema";
import {
  parseSpecBundle,
  type SpecBundle,
} from "@/governance/core/spec_bundle_schemas";
import { registerGovernanceHandlers } from "./governance_handlers";

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
