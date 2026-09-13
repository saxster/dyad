import { afterEach, describe, expect, it, vi } from "vitest";
import { setModelClientFetchForTesting } from "@/ipc/utils/test_fetch_override";
import { runCouncil } from "./council_engine";

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

function memberIdForModel(model: string): string {
  return (
    Object.keys(MEMBER_MODEL_NAMES).find((id) =>
      model.includes(MEMBER_MODEL_NAMES[id]),
    ) ?? "architect"
  );
}

function responsesShape(text: string, model: string): Response {
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

function anthropicShape(text: string, model: string): Response {
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

function chatCompletionsShape(text: string, model: string): Response {
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

/** Each engine model keeps its native wire protocol; shape by endpoint. */
function shapeForUrl(url: string, text: string, model: string): Response {
  if (url.includes("/v1/messages")) {
    return anthropicShape(text, model);
  }
  if (url.includes("/v1/chat/completions")) {
    return chatCompletionsShape(text, model);
  }
  return responsesShape(text, model);
}

describe("runCouncil", () => {
  afterEach(() => {
    setModelClientFetchForTesting(undefined);
    vi.unstubAllEnvs();
    mocks.logger.warn.mockClear();
  });

  it("runs a 3-round Delphi across configured members and returns an aggregated verdict", async () => {
    vi.stubEnv("DYAD_ENGINE_URL", "https://engine.example.test/v1");
    const calls: Array<Record<string, unknown>> = [];
    const roundsPerModel = new Map<string, number>();

    setModelClientFetchForTesting(
      vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const urlText = url.toString();
        const body = JSON.parse((init?.body as string) ?? "{}");
        calls.push(body);

        const model: string = body.model ?? "";
        const round = (roundsPerModel.get(model) ?? 0) + 1;
        roundsPerModel.set(model, round);

        const memberId = memberIdForModel(model);
        const content = JSON.stringify({
          findings: [
            {
              severity: MEMBER_SEVERITIES[memberId],
              claim: `${memberId}-r${round}-claim`,
              evidence: "e",
            },
          ],
        });
        return shapeForUrl(urlText, content, model);
      }),
    );

    const verdict = await runCouncil({
      question: "Should we ship the verification spine?",
      context: "The governed pipeline stamps verified checkpoints.",
    });

    expect(calls).toHaveLength(3 * 4);
    // Round-2 prompts cross-critique: members run in DEFAULT_COUNCIL_MEMBERS
    // order per round, so the 6th call (index 5) is the pragmatist's round-2
    // request and must carry the architect's round-1 claim verbatim — while
    // the architect's own round-2 request (index 4) must not carry it.
    expect(JSON.stringify(calls[5])).toContain("architect-r1-claim");
    expect(JSON.stringify(calls[4])).not.toContain("architect-r1-claim");
    expect(verdict.classification).toBe("majority-critical");
    expect(verdict.consensusScore).toBe(0.75);
    expect(verdict.roundsCompleted).toBe(3);
  });

  it("returns unavailable when fewer than two members succeed round 1", async () => {
    vi.stubEnv("DYAD_ENGINE_URL", "https://engine.example.test/v1");
    setModelClientFetchForTesting(
      vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const urlText = url.toString();
        const body = JSON.parse((init?.body as string) ?? "{}");
        const model: string = body.model ?? "";
        if (
          model.includes("claude-sonnet-4.5") ||
          model.includes("gpt-5") ||
          model.includes("gemini-2.5-pro")
        ) {
          throw new Error("provider down");
        }
        return shapeForUrl(
          urlText,
          JSON.stringify({
            findings: [
              {
                severity: "minor",
                claim: "devils-advocate-r1-claim",
                evidence: "e",
              },
            ],
          }),
          model,
        );
      }),
    );

    const verdict = await runCouncil({ question: "q", context: "c" });

    expect(verdict.classification).toBe("unavailable");
  });
});
