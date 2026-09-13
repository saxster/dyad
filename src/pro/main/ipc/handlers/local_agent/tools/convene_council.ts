import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { councilVerdicts, governanceRuns } from "@/db/schema";
import {
  runCouncil,
  DEFAULT_COUNCIL_MEMBERS,
  COUNCIL_AVG_TOKENS_PER_MEMBER_ROUND,
} from "@/governance/council/council_engine";
import { evaluateGateTriggers } from "@/governance/core/heuristic_gate";
import { estimateCouncilCost } from "@/governance/core/budget_governor";
import { ToolDefinition, AgentContext } from "./types";

const conveneCouncilSchema = z.object({
  question: z
    .string()
    .min(1)
    .describe("The decision or concern for the council to critique"),
});

const DESCRIPTION = `Convene the multi-model adversarial council on a question or concern. The council runs multiple critique rounds across different models and returns an aggregated verdict (classification plus consensus score). Use it for high-stakes or contested design decisions before implementing them.`;

export const conveneCouncilTool: ToolDefinition<
  z.infer<typeof conveneCouncilSchema>
> = {
  name: "convene_council",
  description: DESCRIPTION,
  inputSchema: conveneCouncilSchema,
  defaultConsent: "ask",
  modifiesState: false,

  getConsentPreview: () => {
    const { lowUsd, highUsd } = estimateCouncilCost(
      DEFAULT_COUNCIL_MEMBERS.length,
      3,
      COUNCIL_AVG_TOKENS_PER_MEMBER_ROUND,
    );
    return `Convene the council (~$${lowUsd.toFixed(2)}–$${highUsd.toFixed(2)})`;
  },

  execute: async (args, ctx: AgentContext) => {
    const verdict = await runCouncil({ question: args.question, context: "" });

    db.insert(councilVerdicts)
      .values({
        appId: ctx.appId,
        question: args.question,
        classification: verdict.classification,
        consensusScore: verdict.consensusScore,
        verdictJson: JSON.stringify(verdict),
      })
      .run();

    // A contested verdict is a blocking heuristic gate: mark the app's latest
    // running governance run as gate_open so governed turns are refused until
    // the user resolves it (governance:resolve-gate).
    const gate = evaluateGateTriggers({
      verdict,
      plannedScope: { files: 0 },
      diffStats: { filesChanged: 0 },
    });
    if (gate.blocking) {
      const runningRun = db
        .select({ id: governanceRuns.id })
        .from(governanceRuns)
        .where(
          and(
            eq(governanceRuns.appId, ctx.appId),
            eq(governanceRuns.status, "running"),
          ),
        )
        .orderBy(desc(governanceRuns.id))
        .get();
      if (runningRun) {
        db.update(governanceRuns)
          .set({ status: "gate_open" })
          .where(eq(governanceRuns.id, runningRun.id))
          .run();
      }
    }

    const findingCount = verdict.critiques.reduce(
      (sum, report) => sum + report.findings.length,
      0,
    );
    return [
      `Council verdict: ${verdict.classification} (consensus ${verdict.consensusScore}).`,
      `${verdict.critiques.length} member reports, ${findingCount} findings, ${verdict.roundsCompleted} rounds.`,
    ].join("\n");
  },
};
