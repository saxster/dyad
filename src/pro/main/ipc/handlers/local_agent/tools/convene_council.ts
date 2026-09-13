import { z } from "zod";
import { db } from "@/db";
import { councilVerdicts } from "@/db/schema";
import { runCouncil } from "@/governance/council/council_engine";
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

  getConsentPreview: () => "Convene the multi-model council (may cost tokens)",

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
