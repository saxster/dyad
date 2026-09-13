// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  process.env.NODE_ENV = "development";
  return { ipcHandlers: new Map() };
});

vi.mock("electron", async () => {
  const { createElectronMock } = await import("@/testing/electron_mock");
  return createElectronMock(h);
});

import {
  setupChatFlowHarness,
  type ChatFlowHarness,
} from "@/testing/chat_flow_harness";
import { getRegisteredHandlerForTesting } from "./base";
import { registerGovernanceHandlers } from "./governance_handlers";
import { ArtifactStore } from "@/governance/artifacts/artifact_store";
import { parseSpecBundle } from "@/governance/core/spec_bundle_schemas";
import { MemoryStore } from "@/governance/memory/memory_store";
import { dispatchGovernedTask } from "@/governance/backends/dispatch";
import { createRegistry } from "@/governance/backends/registry";
import type { GovernedBackend } from "@/governance/backends/types";
import { asc, eq } from "drizzle-orm";
import {
  governanceRuns,
  memoryItems,
  specBundles,
  specVerifications,
  governanceRunEvents,
} from "@/db/schema";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const FIXTURE_PATH = resolve(
  __dirname,
  "../../governance/__fixtures__/spec_bundle.fixture.json",
);

const GOVERNED_PROMPT = "rotate the leaked api key in .env";

describe("governance approval gate (integration)", () => {
  let harness: ChatFlowHarness;

  beforeAll(async () => {
    harness = await setupChatFlowHarness({
      electronMock: h,
      chatMode: "local-agent",
      settings: { enableGovernance: true },
    });
    registerGovernanceHandlers();
  }, 30_000);

  afterAll(async () => {
    await harness?.dispose();
  });

  it("refuses an agent turn on a governed chat whose latest bundle is not approved", async () => {
    const store = new ArtifactStore(harness.appDir);
    const bundle = parseSpecBundle(readFileSync(FIXTURE_PATH, "utf8"));
    await store.saveBundle({
      ...bundle,
      approvalStatus: "pending_approval",
      approvedAt: undefined,
    });
    harness.db
      .insert(specBundles)
      .values({
        appId: harness.appId,
        chatId: harness.chatId,
        artifactVersion: 1,
        approvalStatus: "pending_approval",
      })
      .run();

    const turn = await harness.streamChat(GOVERNED_PROMPT);

    const errors = turn.eventsFor("chat:response:error");
    expect(errors).toHaveLength(1);
    expect(JSON.stringify(errors[0].payload)).toContain("approval");

    const messages = await harness.db.query.messages.findMany();
    const assistantMessages = messages.filter((m) => m.role === "assistant");
    expect(assistantMessages).toHaveLength(0);
  }, 60_000);

  it("lets the turn proceed on the same chat after approveSpecBundle", async () => {
    const approve = getRegisteredHandlerForTesting(
      "governance:approve-spec-bundle",
    );
    const decision = (await approve({} as never, {
      appId: harness.appId,
      decision: "approve",
    })) as { approvalStatus: string };
    expect(decision.approvalStatus).toBe("approved");

    const turn = await harness.streamChat(GOVERNED_PROMPT);

    expect(turn.eventsFor("chat:response:error")).toHaveLength(0);
    const endEvent = turn.event("chat:response:end");
    expect(endEvent).toBeTruthy();
    const messages = await harness.db.query.messages.findMany();
    expect(messages.some((m) => m.role === "assistant")).toBe(true);
  }, 60_000);

  it("a rejected bundle returns the chat to planning with feedback injected", async () => {
    // A fresh pending bundle for the reject path (the previous test approved
    // the earlier version, and approved → draft would require force).
    const store = new ArtifactStore(harness.appDir);
    const bundle = parseSpecBundle(readFileSync(FIXTURE_PATH, "utf8"));
    const pending = await store.saveBundle({
      ...bundle,
      approvalStatus: "pending_approval",
      approvedAt: undefined,
    });
    harness.db
      .insert(specBundles)
      .values({
        appId: harness.appId,
        chatId: harness.chatId,
        artifactVersion: pending.version,
        approvalStatus: "pending_approval",
      })
      .run();

    const approve = getRegisteredHandlerForTesting(
      "governance:approve-spec-bundle",
    );
    const decision = (await approve({} as never, {
      appId: harness.appId,
      decision: "reject",
      feedback: "stories lack verification contracts",
    })) as { approvalStatus: string };
    expect(decision.approvalStatus).toBe("draft");

    const latestRow = harness.db
      .select()
      .from(specBundles)
      .all()
      .sort((a, b) => b.id - a.id)[0];
    expect(latestRow.approvalStatus).toBe("draft");

    // The next turn's prepared LLM messages must carry the rejection feedback.
    const turn = await harness.streamChat("[dump]");
    expect(turn.eventsFor("chat:response:error")).toHaveLength(0);
    const dump = harness.getServerDump();
    expect(dump.text).toContain("stories lack verification contracts");
  }, 60_000);

  it("runs verifications automatically at governed turn end and includes the verdict in the final message", async () => {
    const store = new ArtifactStore(harness.appDir);
    const bundle = parseSpecBundle(readFileSync(FIXTURE_PATH, "utf8"));
    const approved = await store.saveBundle({
      ...bundle,
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
              when: "the turn output file is checked",
              then: "it is present",
              verificationContract: "test -f file1.txt",
            },
          ],
        },
      ],
    });
    harness.db
      .insert(specBundles)
      .values({
        appId: harness.appId,
        chatId: harness.chatId,
        artifactVersion: approved.version,
        approvalStatus: "approved",
      })
      .run();

    // The canned governed-turn response arrives as text (no write_file tool
    // call in this harness), so seed the app state the contract checks.
    await writeFile(join(harness.appDir, "file1.txt"), "turn output\n");

    const turn = await harness.streamChat(GOVERNED_PROMPT);

    expect(turn.eventsFor("chat:response:error")).toHaveLength(0);
    const messages = await harness.db.query.messages.findMany();
    const lastAssistant = messages.filter((m) => m.role === "assistant").at(-1);
    expect(lastAssistant?.content).toContain("Spec verification");
    expect(lastAssistant?.content).toContain("1 green");

    const checks = harness.db.select().from(specVerifications).all();
    expect(
      checks.some(
        (row) =>
          row.kind === "check" &&
          row.criterionKey === "US-1/AC-1" &&
          row.status === "green",
      ),
    ).toBe(true);
    const events = harness.db.select().from(governanceRunEvents).all();
    expect(events.some((e) => e.type === "verification_completed")).toBe(true);
  }, 60_000);

  it("pauses a run with a blocking gate and resumes on user resolution", async () => {
    const store = new ArtifactStore(harness.appDir);
    const bundle = parseSpecBundle(readFileSync(FIXTURE_PATH, "utf8"));
    const approved = await store.saveBundle({
      ...bundle,
      approvalStatus: "approved",
      approvedAt: new Date().toISOString(),
    });
    harness.db
      .insert(specBundles)
      .values({
        appId: harness.appId,
        chatId: harness.chatId,
        artifactVersion: approved.version,
        approvalStatus: "approved",
      })
      .run();

    const run = harness.db
      .insert(governanceRuns)
      .values({
        appId: harness.appId,
        chatId: harness.chatId,
        lane: "governed",
        tier: "standard",
        status: "gate_open",
      })
      .returning({ id: governanceRuns.id })
      .get();

    const turn = await harness.streamChat(GOVERNED_PROMPT);
    const errors = turn.eventsFor("chat:response:error");
    expect(errors).toHaveLength(1);
    expect(JSON.stringify(errors[0].payload)).toContain("gate");

    const resolveGate = getRegisteredHandlerForTesting(
      "governance:resolve-gate",
    );
    const result = (await resolveGate({} as never, {
      runId: run.id,
      resolution: "approve",
    })) as { status: string };
    expect(result.status).toBe("running");

    const turn2 = await harness.streamChat(GOVERNED_PROMPT);
    expect(turn2.eventsFor("chat:response:error")).toHaveLength(0);
    const messages = await harness.db.query.messages.findMany();
    expect(messages.some((m) => m.role === "assistant")).toBe(true);
  }, 60_000);

  it("injects the top-N ranked memories as a system-side message on governed turns", async () => {
    new MemoryStore().record(harness.appId, {
      tier: "long",
      category: "userDecision",
      body: "memory-marker-123",
      importance: 9,
    });

    const governedTurn = await harness.streamChat(
      "[dump] rotate the leaked api key in .env",
    );
    expect(governedTurn.eventsFor("chat:response:error")).toHaveLength(0);
    // The harness masks system messages in its dump projection; read the raw
    // recorded request to assert on the real model-visible system prompt.
    const governedRaw = readFileSync(
      governedTurn.getServerDump().dumpPath,
      "utf-8",
    );
    expect(governedRaw).toContain("memory-marker-123");

    const leanTurn = await harness.streamChat(
      "[dump] fix the typo in button label",
    );
    expect(leanTurn.eventsFor("chat:response:error")).toHaveLength(0);
    const leanRaw = readFileSync(leanTurn.getServerDump().dumpPath, "utf-8");
    expect(leanRaw).not.toContain("memory-marker-123");
  }, 60_000);

  it("records an errorPattern memory when a governed run fails verification", async () => {
    const store = new ArtifactStore(harness.appDir);
    const bundle = parseSpecBundle(readFileSync(FIXTURE_PATH, "utf8"));
    const approved = await store.saveBundle({
      ...bundle,
      approvalStatus: "approved",
      approvedAt: new Date().toISOString(),
      stories: [
        {
          id: "US-1",
          title: "Fails verification",
          narrative:
            "As a maintainer I want the failing contract recorded so future turns learn",
          criteria: [
            {
              id: "AC-1",
              given: "the app dir exists",
              when: "the missing file is checked",
              then: "it is absent",
              verificationContract: "test -f missing.txt",
            },
          ],
        },
      ],
    });
    harness.db
      .insert(specBundles)
      .values({
        appId: harness.appId,
        chatId: harness.chatId,
        artifactVersion: approved.version,
        approvalStatus: "approved",
      })
      .run();

    const turn = await harness.streamChat(GOVERNED_PROMPT);
    expect(turn.eventsFor("chat:response:error")).toHaveLength(0);

    const memories = harness.db.select().from(memoryItems).all();
    const errorPattern = memories.find((m) => m.category === "errorPattern");
    expect(errorPattern?.body).toContain("US-1/AC-1");

    const events = harness.db.select().from(governanceRunEvents).all();
    expect(events.some((e) => e.type === "memory_recorded")).toBe(true);
  }, 60_000);

  it("executes a governed task through an external backend and records lifecycle events", async () => {
    const run = harness.db
      .insert(governanceRuns)
      .values({
        appId: harness.appId,
        chatId: harness.chatId,
        lane: "governed",
        tier: "standard",
        status: "running",
      })
      .returning({ id: governanceRuns.id })
      .get();

    const fakeExternal: GovernedBackend = {
      async *dispatch(task) {
        yield { type: "started", node: task.id };
        yield { type: "output", text: "doing the thing" };
        yield { type: "completed", exitCode: 0 };
      },
    };
    const registry = createRegistry({
      builtin: makeFakeBackend("builtin"),
      external: [{ backend: fakeExternal, score: 10 }],
    });

    const events = await dispatchGovernedTask(
      harness.appId,
      { id: "t1", prompt: "true", cwd: harness.appDir },
      registry,
    );

    expect(events.map((event) => event.type)).toEqual([
      "started",
      "output",
      "completed",
    ]);

    const runEvents = harness.db
      .select()
      .from(governanceRunEvents)
      .where(eq(governanceRunEvents.runId, run.id))
      .orderBy(asc(governanceRunEvents.seq))
      .all();
    expect(runEvents.map((e) => e.type)).toEqual([
      "backend_started",
      "backend_output",
      "backend_completed",
    ]);
    expect(JSON.parse(runEvents[0].payloadJson)).toEqual({ node: "t1" });
    expect(JSON.parse(runEvents[1].payloadJson)).toEqual({
      text: "doing the thing",
    });
    expect(JSON.parse(runEvents[2].payloadJson)).toEqual({ exitCode: 0 });
  }, 60_000);
});

function makeFakeBackend(name: string): GovernedBackend {
  return {
    async *dispatch() {
      yield { type: "started", node: name };
    },
  };
}
