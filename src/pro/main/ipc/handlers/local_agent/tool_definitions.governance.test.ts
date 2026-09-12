import { describe, expect, it, vi } from "vitest";
import { buildAgentToolSet } from "./tool_definitions";
import type { AgentContext } from "./tools/types";

vi.mock("electron-log", () => ({
  default: {
    scope: () => ({
      log: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

const ctx = {
  appId: 1,
  appPath: "/tmp/unused",
  chatId: 1,
  todos: [],
} as unknown as AgentContext;

describe("write_spec tool gating", () => {
  it("includes write_spec in plan mode when governance is on", () => {
    const toolSet = buildAgentToolSet(ctx, {
      planModeOnly: true,
      enableGovernance: true,
    });

    expect(Object.keys(toolSet)).toContain("write_spec");
  });

  it("excludes write_spec in plan mode when governance is off", () => {
    const toolSet = buildAgentToolSet(ctx, {
      planModeOnly: true,
      enableGovernance: false,
    });

    expect(Object.keys(toolSet)).not.toContain("write_spec");
  });

  it("excludes write_spec outside plan mode even when governance is on", () => {
    const toolSet = buildAgentToolSet(ctx, {
      enableGovernance: true,
    });

    expect(Object.keys(toolSet)).not.toContain("write_spec");
  });
});
