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
import { specBundles } from "@/db/schema";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

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
});
