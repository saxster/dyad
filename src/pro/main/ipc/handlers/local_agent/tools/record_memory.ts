import { z } from "zod";
import {
  MemoryStore,
  MEMORY_TIERS,
  MEMORY_CATEGORIES,
} from "@/governance/memory/memory_store";
import { ToolDefinition, AgentContext } from "./types";

const recordMemorySchema = z.object({
  body: z
    .string()
    .min(1)
    .describe("The memory content to store, one durable fact or decision"),
  category: z
    .enum(MEMORY_CATEGORIES)
    .describe(
      "auditHistory, userDecision, styleInference, errorPattern, or architecturalDecision",
    ),
  tier: z
    .enum(MEMORY_TIERS)
    .default("short")
    .describe("short = session-scoped, medium = evictable, long = permanent"),
  importance: z
    .number()
    .min(0)
    .max(10)
    .optional()
    .describe("0-10; higher ranks earlier in turn-start injection"),
});

const DESCRIPTION = `Record a durable project memory (a user decision, style inference, error pattern, or architectural decision) so future governed turns are injected with it. Keep each memory a single self-contained fact.`;

export const recordMemoryTool: ToolDefinition<
  z.infer<typeof recordMemorySchema>
> = {
  name: "record_memory",
  description: DESCRIPTION,
  inputSchema: recordMemorySchema,
  defaultConsent: "ask",
  modifiesState: true,

  getConsentPreview: () => "Store a project memory",

  execute: async (args, ctx: AgentContext) => {
    const id = new MemoryStore().record(ctx.appId, {
      tier: args.tier,
      category: args.category,
      body: args.body,
      ...(args.importance !== undefined ? { importance: args.importance } : {}),
    });
    return `Recorded memory ${id} (tier ${args.tier}, category ${args.category}).`;
  },
};
