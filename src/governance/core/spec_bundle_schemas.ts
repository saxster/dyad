import { z } from "zod";

export const EarsCriterionSchema = z.object({
  id: z.string(),
  given: z.string(),
  when: z.string(),
  then: z.string(),
  verificationContract: z.string().optional(),
});

export type EarsCriterion = z.infer<typeof EarsCriterionSchema>;

export const UserStorySchema = z.object({
  id: z.string(),
  title: z.string(),
  narrative: z.string(),
  criteria: z.array(EarsCriterionSchema),
  priority: z.enum(["must", "should", "could", "wont"]).optional(),
});

export type UserStory = z.infer<typeof UserStorySchema>;

const ArchitectureComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  responsibility: z.string(),
  anvilDomain: z.string().optional(),
  affectedFiles: z.array(z.string()),
  dependencies: z.array(z.string()),
});

const DesignSchema = z.object({
  specId: z.string(),
  generatedAt: z.string(),
  architecture: z.array(ArchitectureComponentSchema),
  dataModels: z.string(),
  performanceConstraints: z.array(z.string()),
  securityConsiderations: z.array(z.string()),
  sequenceDiagram: z.string(),
});

const ManifestTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  estimatedPhase: z.string(),
  status: z.string(),
  requiresTestFirst: z.boolean(),
  dependsOnTitles: z.array(z.string()),
  linkedComponentIds: z.array(z.string()),
  linkedCriterionIds: z.array(z.string()),
  linkedStoryIds: z.array(z.string()),
  verificationContract: z.string().optional(),
});

const ManifestSchema = z.object({
  specId: z.string(),
  generatedAt: z.string(),
  tasks: z.array(ManifestTaskSchema),
  runtimeTasks: z.array(z.unknown()),
});

const NonFunctionalRequirementsSchema = z.object({
  generatedAt: z.string(),
  summary: z.string(),
  requirements: z.array(
    z.object({
      id: z.string(),
      key: z.string(),
      title: z.string(),
      category: z.string(),
      target: z.string(),
      rationale: z.string(),
      verification: z.string(),
    }),
  ),
});

const ReleaseReadinessSchema = z.object({
  generatedAt: z.string(),
  summary: z.string(),
  checklist: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      evidence: z.string(),
    }),
  ),
  observabilityChecks: z.array(z.string()),
  rolloutSteps: z.array(z.string()),
  rollbackSteps: z.array(z.string()),
});

const RiskRegisterSchema = z.object({
  generatedAt: z.string(),
  summary: z.string(),
  risks: z.array(
    z.object({
      id: z.string(),
      key: z.string(),
      title: z.string(),
      description: z.string(),
      likelihood: z.string(),
      impact: z.string(),
      mitigation: z.array(z.string()),
      validation: z.array(z.string()),
    }),
  ),
});

const StrategySchema = z.object({
  generatedAt: z.string(),
  summary: z.string(),
  assumptions: z.array(z.string()),
  evaluationAxes: z.array(z.string()),
  openQuestions: z.array(z.unknown()),
  deferredDecisions: z.array(z.unknown()),
  decisions: z.array(
    z.object({
      id: z.string(),
      key: z.string(),
      title: z.string(),
      category: z.string(),
      chosenOption: z.string(),
      rationale: z.string(),
      confidence: z.number(),
      heuristics: z.array(z.string()),
      alternatives: z.array(z.unknown()),
      validationPlan: z.array(z.string()),
    }),
  ),
});

const ThreatModelSchema = z.object({
  generatedAt: z.string(),
  summary: z.string(),
  sensitiveAssets: z.array(z.string()),
  threats: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      surface: z.string(),
      abuseCase: z.string(),
      controls: z.array(z.string()),
      verification: z.array(z.string()),
    }),
  ),
});

const VerificationPlanSchema = z.object({
  generatedAt: z.string(),
  summary: z.string(),
  layers: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      scope: z.string(),
      owner: z.string(),
      command: z.string(),
    }),
  ),
  qualityGates: z.array(z.string()),
});

export const SpecBundleSchema = z.object({
  id: z.string(),
  version: z.number(),
  rawIntent: z.string(),
  approvalStatus: z.enum(["draft", "pending_approval", "approved"]),
  approvedAt: z.string().optional(),
  createdAt: z.string(),
  notDoingList: z.array(z.string()),
  provenance: z.record(z.string(), z.unknown()),
  design: DesignSchema,
  strategy: StrategySchema,
  threatModel: ThreatModelSchema,
  nonFunctionalRequirements: NonFunctionalRequirementsSchema,
  releaseReadiness: ReleaseReadinessSchema,
  riskRegister: RiskRegisterSchema,
  verificationPlan: VerificationPlanSchema,
  manifest: ManifestSchema,
  stories: z.array(UserStorySchema),
});

export type SpecBundle = z.infer<typeof SpecBundleSchema>;

export function parseSpecBundle(json: unknown): SpecBundle {
  const value = typeof json === "string" ? JSON.parse(json) : json;
  return SpecBundleSchema.parse(value);
}

export function serializeSpecBundle(bundle: SpecBundle): string {
  return JSON.stringify(bundle, null, 2);
}
