import { generateText } from "ai";
import log from "electron-log";
import { readSettings } from "@/main/settings";
import { getModelClient } from "@/ipc/utils/get_model_client";
import type { UserSettings } from "@/lib/schemas";
import { buildCouncilSystemPrompt } from "@/prompts/council_prompts";
import {
  aggregateVerdict,
  type AggregatedVerdict,
  type MemberFinding,
  type MemberReport,
} from "@/governance/core/verdict_aggregator";

const logger = log.scope("council_engine");

export interface CouncilMember {
  id: string;
  provider: string;
  model: string;
}

export const DEFAULT_COUNCIL_MEMBERS: CouncilMember[] = [
  { id: "architect", provider: "anthropic", model: "claude-sonnet-4.5" },
  { id: "pragmatist", provider: "openai", model: "gpt-5" },
  { id: "fact-checker", provider: "google", model: "gemini-2.5-pro" },
  { id: "devils-advocate", provider: "xai", model: "grok-code-fast-1" },
];

export interface CouncilInput {
  question: string;
  context: string;
}

export interface CouncilRunResult extends AggregatedVerdict {
  roundsCompleted: number;
}

export async function runCouncil(
  input: CouncilInput,
  { rounds = 3 }: { rounds?: number } = {},
): Promise<CouncilRunResult> {
  const settings = readSettings() as UserSettings;
  const unavailable: CouncilRunResult = {
    classification: "unavailable",
    consensusScore: 0,
    critiques: [],
    roundsCompleted: 0,
  };

  let roundOneTexts: Record<string, string> = {};
  let finalReports: MemberReport[] = [];
  let roundsCompleted = 0;

  for (let round = 1; round <= rounds; round++) {
    const reports: MemberReport[] = [];
    for (const member of DEFAULT_COUNCIL_MEMBERS) {
      try {
        const { modelClient } = await getModelClient(
          { provider: member.provider, name: member.model },
          settings,
        );
        const { text } = await generateText({
          model: modelClient.model,
          system: buildCouncilSystemPrompt(member.id, round, roundOneTexts),
          prompt: `Question: ${input.question}\n\nContext:\n${input.context}`,
          maxRetries: 0,
        });
        const parsed = JSON.parse(text) as { findings: MemberFinding[] };
        reports.push({ memberId: member.id, findings: parsed.findings });
      } catch (error) {
        // A member that fails a round simply does not report.
        logger.warn(`council member ${member.id} failed round ${round}`, error);
      }
    }

    if (round === 1) {
      if (reports.length < 2) {
        return unavailable;
      }
      roundOneTexts = Object.fromEntries(
        reports.map((report) => [
          report.memberId,
          report.findings.map((finding) => finding.claim).join("\n"),
        ]),
      );
    }
    finalReports = reports;
    roundsCompleted = round;
  }

  return { ...aggregateVerdict(finalReports), roundsCompleted };
}
