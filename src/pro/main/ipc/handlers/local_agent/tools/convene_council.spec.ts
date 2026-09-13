import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentContext } from "./types";
import { conveneCouncilTool } from "./convene_council";
import { apps, chats, councilVerdicts } from "@/db/schema";
import { setDatabaseForTesting } from "@/db";
import { createInMemoryTestDb, type TestDb } from "@/testing/test_db";
import { setModelClientFetchForTesting } from "@/ipc/utils/test_fetch_override";

const mocks = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("electron-log", () => ({
  default: { scope: () => mocks.logger },
}));

vi.mock("@/main/settings", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  readSettings: vi.fn(() => ({
    enableDyadPro: true,
    providerSettings: {
      auto: { apiKey: { value: "dyad-pro-key" } },
      anthropic: { apiKey: { value: "k-anthropic" } },
      openai: { apiKey: { value: "k-openai" } },
      google: { apiKey: { value: "k-google" } },
      xai: { apiKey: { value: "k-xai" } },
    },
  })),
}));

vi.mock("@/ipc/utils/model_effort", () => ({
  resolveModelSelection: vi.fn(async ({ model, preferredEffortLevel }) => ({
    ...model,
    effortLevel: preferredEffortLevel ?? "medium",
  })),
}));

vi.mock("@/ipc/shared/language_model_helpers", () => ({
  getLanguageModels: vi.fn(async () => []),
  getLanguageModelProviders: vi.fn(async () => [
    { id: "auto", name: "Dyad", gatewayPrefix: "dyad/", type: "cloud" },
    { id: "openai", name: "OpenAI", gatewayPrefix: "", type: "cloud" },
    {
      id: "anthropic",
      name: "Anthropic",
      gatewayPrefix: "anthropic/",
      type: "cloud",
    },
    { id: "google", name: "Google", gatewayPrefix: "gemini/", type: "cloud" },
    { id: "xai", name: "xAI", gatewayPrefix: "xai/", type: "cloud" },
  ]),
}));

vi.mock("@/ipc/shared/remote_language_model_catalog", () => ({
  resolveBuiltinModelAlias: vi.fn(async () => null),
}));

const MEMBER_SEVERITIES: Record<string, string> = {
  architect: "major",
  pragmatist: "major",
  "fact-checker": "major",
  "devils-advocate": "minor",
};

const MEMBER_MODEL_NAMES: Record<string, string> = {
  architect: "claude-sonnet-4.5",
  pragmatist: "gpt-5",
  "fact-checker": "gemini-2.5-pro",
  "devils-advocate": "grok-code-fast-1",
};

function shapeForUrl(url: string, text: string, model: string): Response {
  if (url.includes("/v1/messages")) {
    return new Response(
      JSON.stringify({
        id: "msg-test",
        type: "message",
        role: "assistant",
        model,
        content: [{ type: "text", text }],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }
  if (url.includes("/v1/chat/completions")) {
    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        model,
        choices: [
          {
            message: { role: "assistant", content: text },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }
  return new Response(
    JSON.stringify({
      id: "resp-test",
      created_at: 1_700_000_000,
      model,
      output: [
        {
          type: "message",
          role: "assistant",
          id: "msg-test",
          content: [{ type: "output_text", text, annotations: [] }],
        },
      ],
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}

describe("conveneCouncilTool", () => {
  let db: TestDb;
  let appPath: string;
  let ctx: AgentContext;

  beforeEach(async () => {
    db = createInMemoryTestDb();
    setDatabaseForTesting(db);
    appPath = await mkdtemp(join(tmpdir(), "gov-convene-council-"));
    const app = db
      .insert(apps)
      .values({ name: "Convene Council App", path: appPath })
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

    vi.stubEnv("DYAD_ENGINE_URL", "https://engine.example.test/v1");
    const roundsPerModel = new Map<string, number>();
    setModelClientFetchForTesting(
      vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const body = JSON.parse((init?.body as string) ?? "{}");
        const model: string = body.model ?? "";
        const round = (roundsPerModel.get(model) ?? 0) + 1;
        roundsPerModel.set(model, round);
        const memberId =
          Object.keys(MEMBER_MODEL_NAMES).find((id) =>
            model.includes(MEMBER_MODEL_NAMES[id]),
          ) ?? "architect";
        const content = JSON.stringify({
          findings: [
            {
              severity: MEMBER_SEVERITIES[memberId],
              claim: `${memberId}-r${round}-claim`,
              evidence: "e",
            },
          ],
        });
        return shapeForUrl(url, content, model);
      }),
    );
  });

  afterEach(async () => {
    setModelClientFetchForTesting(undefined);
    vi.unstubAllEnvs();
    setDatabaseForTesting(null);
    db.$client.close();
    await rm(appPath, { recursive: true, force: true });
  });

  it("convenes the council on a question and persists the verdict", async () => {
    const result = await conveneCouncilTool.execute(
      { question: "Should we rewrite the data layer?" },
      ctx,
    );

    expect(result).toContain("majority-critical");

    const rows = db.select().from(councilVerdicts).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].question).toBe("Should we rewrite the data layer?");
    expect(rows[0].classification).toBe("majority-critical");
    expect(rows[0].consensusScore).toBe(0.75);
  });
});
