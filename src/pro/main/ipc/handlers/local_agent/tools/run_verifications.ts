import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { governanceRuns, specVerifications } from "@/db/schema";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";
import { ArtifactStore } from "@/governance/artifacts/artifact_store";
import { extractContracts } from "@/governance/verification/extract_contracts";
import { runContracts } from "@/governance/verification/contract_runner";
import { ToolDefinition, AgentContext } from "./types";

const runVerificationsSchema = z.object({}).passthrough();

const DESCRIPTION = `Run the verification contracts of the approved spec bundle for this app and report the per-criterion result. Use it after implementing (or revising) work to prove which acceptance criteria hold.`;

function resolveRunId(ctx: AgentContext): number {
  const existing = db
    .select({ id: governanceRuns.id })
    .from(governanceRuns)
    .where(eq(governanceRuns.chatId, ctx.chatId))
    .orderBy(desc(governanceRuns.id))
    .get();
  if (existing) {
    return existing.id;
  }
  const created = db
    .insert(governanceRuns)
    .values({
      appId: ctx.appId,
      chatId: ctx.chatId,
      lane: "governed",
      tier: "standard",
      status: "running",
    })
    .returning({ id: governanceRuns.id })
    .get();
  return created.id;
}

export const runVerificationsTool: ToolDefinition<
  z.infer<typeof runVerificationsSchema>
> = {
  name: "run_verifications",
  description: DESCRIPTION,
  inputSchema: runVerificationsSchema,
  defaultConsent: "ask",
  modifiesState: false,

  getConsentPreview: () => "Run the spec verification contracts",

  execute: async (_args, ctx: AgentContext) => {
    const bundle = await new ArtifactStore(ctx.appPath).loadBundle();
    if (bundle.approvalStatus !== "approved") {
      throw new DyadError(
        "spec bundle is not approved",
        DyadErrorKind.Precondition,
      );
    }

    const { executable } = extractContracts(bundle);
    const results = await runContracts(executable, { cwd: ctx.appPath });

    const runId = resolveRunId(ctx);
    for (const result of results) {
      db.insert(specVerifications)
        .values({
          runId,
          criterionKey: result.key,
          kind: "check",
          status: result.status,
          exitCode: result.exitCode ?? null,
          outputTail: result.outputTail ? result.outputTail : null,
        })
        .run();
    }

    const lines = results.map((result) => {
      if (result.status === "green") {
        return `${result.key} green`;
      }
      if (result.status === "timeout") {
        return `${result.key} timeout`;
      }
      return `${result.key} red (exit ${result.exitCode})`;
    });
    const failingTails = results
      .filter((result) => result.status === "red")
      .map((result) => result.outputTail.slice(0, 200))
      .filter((tail) => tail.length > 0);

    const allGreen = results.every((result) => result.status === "green");
    ctx.onXmlComplete(
      `<dyad-status title="Spec verification" state="${allGreen ? "finished" : "error"}">${lines.join(" ")}</dyad-status>`,
    );

    return [...lines, ...failingTails].join("\n");
  },
};
