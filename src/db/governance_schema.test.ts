import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  acceptanceCriteria,
  apps,
  chats,
  governanceRunEvents,
  governanceRuns,
  specBundles,
  specStories,
  specVerifications,
} from "@/db/schema";
import { createInMemoryTestDb, type TestDb } from "@/testing/test_db";

describe("governance schema", () => {
  let db: TestDb;
  let appId: number;
  let chatId: number;

  beforeEach(() => {
    db = createInMemoryTestDb();
    const app = db
      .insert(apps)
      .values({ name: "Governance Schema Test", path: "/tmp/gov-schema-test" })
      .returning({ id: apps.id })
      .get();
    appId = app.id;
    chatId = db
      .insert(chats)
      .values({ appId })
      .returning({ id: chats.id })
      .get().id;
  });

  afterEach(() => {
    db.$client.close();
  });

  it("stores spec bundles", () => {
    const inserted = db
      .insert(specBundles)
      .values({
        appId,
        chatId,
        artifactVersion: 3,
        approvalStatus: "pending_approval",
      })
      .returning({ id: specBundles.id })
      .get();

    const row = db
      .select()
      .from(specBundles)
      .where(eq(specBundles.id, inserted.id))
      .get();

    expect(row).toMatchObject({
      appId,
      chatId,
      artifactVersion: 3,
      approvalStatus: "pending_approval",
      approvedAt: null,
    });
    expect(row?.createdAt).toBeInstanceOf(Date);
    expect(row?.updatedAt).toBeInstanceOf(Date);
  });

  it("stores spec stories", () => {
    const bundle = db
      .insert(specBundles)
      .values({ appId, artifactVersion: 1, approvalStatus: "draft" })
      .returning({ id: specBundles.id })
      .get();

    const inserted = db
      .insert(specStories)
      .values({
        bundleId: bundle.id,
        storyId: "US-1",
        title: "Export verification scripts",
        priority: "must",
        narrative: "As a maintainer I want scripts so that verification runs",
        json: JSON.stringify({ id: "US-1", criteria: [] }),
      })
      .returning({ id: specStories.id })
      .get();

    const row = db
      .select()
      .from(specStories)
      .where(eq(specStories.id, inserted.id))
      .get();

    expect(row).toMatchObject({
      bundleId: bundle.id,
      storyId: "US-1",
      title: "Export verification scripts",
      priority: "must",
    });
  });

  it("stores acceptance criteria", () => {
    const bundle = db
      .insert(specBundles)
      .values({ appId, artifactVersion: 1, approvalStatus: "draft" })
      .returning({ id: specBundles.id })
      .get();
    const story = db
      .insert(specStories)
      .values({
        bundleId: bundle.id,
        storyId: "US-1",
        title: "t",
        narrative: "n",
        json: "{}",
      })
      .returning({ id: specStories.id })
      .get();

    const inserted = db
      .insert(acceptanceCriteria)
      .values({
        storyRowId: story.id,
        criterionId: "AC-1",
        given: "an approved bundle",
        when: "export runs",
        then: "scripts are written",
        verificationContract: "npm test -- foo",
      })
      .returning({ id: acceptanceCriteria.id })
      .get();

    const row = db
      .select()
      .from(acceptanceCriteria)
      .where(eq(acceptanceCriteria.id, inserted.id))
      .get();

    expect(row).toMatchObject({
      storyRowId: story.id,
      criterionId: "AC-1",
      given: "an approved bundle",
      when: "export runs",
      then: "scripts are written",
      verificationContract: "npm test -- foo",
    });
  });

  it("stores governance runs", () => {
    const inserted = db
      .insert(governanceRuns)
      .values({
        appId,
        chatId,
        lane: "governed",
        tier: "standard",
        status: "running",
      })
      .returning({ id: governanceRuns.id })
      .get();

    const row = db
      .select()
      .from(governanceRuns)
      .where(eq(governanceRuns.id, inserted.id))
      .get();

    expect(row).toMatchObject({
      appId,
      chatId,
      lane: "governed",
      tier: "standard",
      status: "running",
      endedAt: null,
    });
    expect(row?.startedAt).toBeInstanceOf(Date);
  });

  it("stores governance run events", () => {
    const run = db
      .insert(governanceRuns)
      .values({
        appId,
        chatId,
        lane: "governed",
        tier: "standard",
        status: "running",
      })
      .returning({ id: governanceRuns.id })
      .get();

    const inserted = db
      .insert(governanceRunEvents)
      .values({
        runId: run.id,
        seq: 1,
        type: "run_started",
        payloadJson: JSON.stringify({ lane: "governed" }),
      })
      .returning({ id: governanceRunEvents.id })
      .get();

    const row = db
      .select()
      .from(governanceRunEvents)
      .where(eq(governanceRunEvents.id, inserted.id))
      .get();

    expect(row).toMatchObject({
      runId: run.id,
      seq: 1,
      type: "run_started",
      payloadJson: JSON.stringify({ lane: "governed" }),
    });
    expect(row?.at).toBeInstanceOf(Date);
  });

  it("stores spec verifications", () => {
    const run = db
      .insert(governanceRuns)
      .values({
        appId,
        chatId,
        lane: "governed",
        tier: "standard",
        status: "running",
      })
      .returning({ id: governanceRuns.id })
      .get();

    const inserted = db
      .insert(specVerifications)
      .values({
        runId: run.id,
        criterionKey: "US-1/AC-1",
        status: "green",
        exitCode: 0,
        outputTail: "all tests passed",
      })
      .returning({ id: specVerifications.id })
      .get();

    const row = db
      .select()
      .from(specVerifications)
      .where(eq(specVerifications.id, inserted.id))
      .get();

    expect(row).toMatchObject({
      runId: run.id,
      criterionKey: "US-1/AC-1",
      status: "green",
      exitCode: 0,
      outputTail: "all tests passed",
    });
  });
});
