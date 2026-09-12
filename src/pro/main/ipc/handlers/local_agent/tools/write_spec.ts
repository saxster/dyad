import { z } from "zod";
import crypto from "node:crypto";
import log from "electron-log";
import { ToolDefinition, AgentContext } from "./types";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";
import { db } from "@/db";
import { specBundles } from "@/db/schema";
import { ArtifactStore } from "@/governance/artifacts/artifact_store";
import type {
  SpecBundle,
  UserStory,
} from "@/governance/core/spec_bundle_schemas";

const logger = log.scope("write_spec");

const writeSpecSchema = z.object({
  rawIntent: z
    .string()
    .describe(
      "The user's intent this spec implements, in one or two sentences",
    ),
  stories: z
    .array(
      z.object({
        id: z.string().describe("Stable story id, e.g. US-1"),
        title: z.string().describe("Short imperative title"),
        narrative: z
          .string()
          .describe("As a <role> I want <capability> so that <benefit>"),
        priority: z
          .enum(["must", "should", "could", "wont"])
          .optional()
          .describe("MoSCoW priority"),
        criteria: z
          .array(
            z.object({
              id: z.string().describe("Criterion id, e.g. AC-1"),
              given: z.string().describe("EARS precondition"),
              when: z.string().describe("EARS trigger"),
              then: z.string().describe("EARS observable outcome"),
              verificationContract: z
                .string()
                .optional()
                .describe(
                  "Single shell command exiting 0 when the criterion holds",
                ),
            }),
          )
          .min(1)
          .describe("At least one acceptance criterion per story"),
      }),
    )
    .min(1)
    .describe("The user stories of this spec"),
  notDoingList: z
    .array(z.string())
    .describe("Explicit exclusions — what this spec does not cover"),
  risks: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        likelihood: z.string(),
        impact: z.string(),
        mitigation: z.string().optional(),
      }),
    )
    .describe("Main risks with likelihood, impact, and mitigation"),
});

const DESCRIPTION = `Present the governed spec bundle for user approval. Call this after discovery (planning_questionnaire) with the complete spec.

The spec contains:
- stories: EARS user stories (id, title, narrative, MoSCoW priority) each with Given/When/Then acceptance criteria
- verificationContract: attach to every criterion that is objectively checkable — a single shell command that exits 0 when the criterion holds
- notDoingList: explicit exclusions
- risks: main risks with likelihood, impact, and mitigation

The user will review and approve or reject the spec. Implementation starts only after approval. Call write_spec again to revise after feedback.`;

export const writeSpecTool: ToolDefinition<z.infer<typeof writeSpecSchema>> = {
  name: "write_spec",
  description: DESCRIPTION,
  inputSchema: writeSpecSchema,
  defaultConsent: "always",
  modifiesState: true,

  getConsentPreview: () =>
    "Save the governed spec bundle and submit it for approval",

  buildXml: (args) => {
    const stories = args.stories ?? [];
    const storyCount = stories.length;
    const criterionCount = stories.reduce(
      (sum, story) => sum + (story.criteria?.length ?? 0),
      0,
    );
    return `<dyad-spec title="Spec for review" stories="${storyCount}" criteria="${criterionCount}"></dyad-spec>`;
  },

  execute: async (args, ctx: AgentContext) => {
    const parsed = writeSpecSchema.safeParse(args);
    if (!parsed.success) {
      const failingPaths = parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      throw new DyadError(
        `write_spec input is not a valid spec the model can fix: ${failingPaths}`,
        DyadErrorKind.Validation,
      );
    }

    const now = new Date().toISOString();
    const stories: UserStory[] = parsed.data.stories.map((story) => ({
      id: story.id,
      title: story.title,
      narrative: story.narrative,
      criteria: story.criteria,
      ...(story.priority ? { priority: story.priority } : {}),
    }));

    const bundle: SpecBundle = {
      id: crypto.randomUUID(),
      version: 1,
      rawIntent: parsed.data.rawIntent,
      approvalStatus: "pending_approval",
      createdAt: now,
      notDoingList: parsed.data.notDoingList,
      provenance: {},
      design: {
        specId: "",
        generatedAt: now,
        architecture: [],
        dataModels: "",
        performanceConstraints: [],
        securityConsiderations: [],
        sequenceDiagram: "",
      },
      strategy: {
        generatedAt: now,
        summary: "",
        assumptions: [],
        evaluationAxes: [],
        openQuestions: [],
        deferredDecisions: [],
        decisions: [],
      },
      threatModel: {
        generatedAt: now,
        summary: "",
        sensitiveAssets: [],
        threats: [],
      },
      nonFunctionalRequirements: {
        generatedAt: now,
        summary: "",
        requirements: [],
      },
      releaseReadiness: {
        generatedAt: now,
        summary: "",
        checklist: [],
        observabilityChecks: [],
        rolloutSteps: [],
        rollbackSteps: [],
      },
      riskRegister: {
        generatedAt: now,
        summary: "",
        risks: parsed.data.risks.map((risk) => ({
          id: crypto.randomUUID(),
          key: risk.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          title: risk.title,
          description: risk.description,
          likelihood: risk.likelihood,
          impact: risk.impact,
          mitigation: risk.mitigation ? [risk.mitigation] : [],
          validation: [],
        })),
      },
      verificationPlan: {
        generatedAt: now,
        summary: "",
        layers: [],
        qualityGates: [],
      },
      manifest: {
        specId: "",
        generatedAt: now,
        tasks: [],
        runtimeTasks: [],
      },
      stories,
    };

    const store = new ArtifactStore(ctx.appPath);
    const stamped = await store.saveBundle(bundle);

    db.insert(specBundles)
      .values({
        appId: ctx.appId,
        chatId: ctx.chatId,
        artifactVersion: stamped.version,
        approvalStatus: stamped.approvalStatus,
      })
      .run();

    const criterionCount = stamped.stories.reduce(
      (sum, story) => sum + story.criteria.length,
      0,
    );
    const contractCount = stamped.stories.reduce(
      (sum, story) =>
        sum +
        story.criteria.filter((criterion) => criterion.verificationContract)
          .length,
      0,
    );

    logger.log(
      `write_spec saved artifact version ${stamped.version} for app ${ctx.appId}`,
    );

    return [
      `Spec saved (artifact version ${stamped.version}) and submitted for approval.`,
      `${stamped.stories.length} stories: ${stamped.stories.map((story) => story.id).join(", ")}.`,
      `${criterionCount} acceptance criteria, ${contractCount} with verification contracts.`,
      `Present the spec to the user for approval. Only after the user approves may exit_plan be called.`,
    ].join("\n");
  },
};
