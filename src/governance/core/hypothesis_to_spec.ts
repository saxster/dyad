import {
  SpecBundleSchema,
  type SpecBundle,
  type UserStory,
} from "./spec_bundle_schemas";
import type { CommittedHypothesis } from "./incubation_state";

/**
 * Seeds a draft spec bundle from a committed incubation hypothesis. The
 * problem becomes the raw intent; the success criteria become EARS criteria
 * on a single story without verification contracts (verification is chosen
 * later, during specify/challenge, not at seed time). Empty bundle sections
 * mirror write_spec's skeleton so the seed parses against the same schema.
 */
export function seedSpecBundleFromHypothesis(
  hypothesis: CommittedHypothesis,
  { now = new Date().toISOString() }: { now?: string } = {},
): SpecBundle {
  const story: UserStory = {
    id: "US-1",
    title: `Hypothesis: ${hypothesis.hypothesis.slice(0, 60)}`,
    narrative: `As a user I want ${hypothesis.hypothesis} so that ${hypothesis.successCriteria[0]}`,
    criteria: hypothesis.successCriteria.map((criterion, index) => ({
      id: `AC-${index + 1}`,
      given: "the system is in its current state",
      when: criterion,
      then: "the criterion holds",
    })),
  };

  const bundle: SpecBundle = {
    id: crypto.randomUUID(),
    version: 1,
    rawIntent: hypothesis.problem,
    approvalStatus: "draft",
    createdAt: now,
    notDoingList: [],
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
      risks: [],
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
    stories: [story],
  };
  return SpecBundleSchema.parse(bundle);
}
