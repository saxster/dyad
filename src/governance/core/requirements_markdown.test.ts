import { describe, it, expect } from "vitest";
import { renderRequirementsMarkdown } from "./requirements_markdown";
import type { SpecBundle, UserStory } from "./spec_bundle_schemas";

function makeStory(overrides: Partial<UserStory>): UserStory {
  return {
    id: "US-1",
    title: "Export verification scripts",
    narrative:
      "As a maintainer I want deterministic scripts so that verification is rerunnable",
    criteria: [
      {
        id: "AC-1",
        given: "an approved bundle",
        when: "export runs",
        then: "scripts are written",
        verificationContract: "npm test -- foo",
      },
    ],
    ...overrides,
  };
}

function makeBundle(stories: UserStory[]): SpecBundle {
  return {
    id: "11111111-1111-5111-8111-111111111111",
    version: 1,
    rawIntent: "Export deterministic verification scripts.",
    approvalStatus: "approved",
    approvedAt: "2026-07-04T03:45:00Z",
    createdAt: "2026-07-04T03:45:00Z",
    notDoingList: [],
    provenance: {},
    design: {
      specId: "11111111-1111-5111-8111-111111111111",
      generatedAt: "2026-07-04T03:45:00Z",
      architecture: [],
      dataModels: "",
      performanceConstraints: [],
      securityConsiderations: [],
      sequenceDiagram: "",
    },
    strategy: {
      generatedAt: "2026-07-04T03:45:00Z",
      summary: "",
      assumptions: [],
      evaluationAxes: [],
      openQuestions: [],
      deferredDecisions: [],
      decisions: [],
    },
    threatModel: {
      generatedAt: "2026-07-04T03:45:00Z",
      summary: "",
      sensitiveAssets: [],
      threats: [],
    },
    nonFunctionalRequirements: {
      generatedAt: "2026-07-04T03:45:00Z",
      summary: "",
      requirements: [],
    },
    releaseReadiness: {
      generatedAt: "2026-07-04T03:45:00Z",
      summary: "",
      checklist: [],
      observabilityChecks: [],
      rolloutSteps: [],
      rollbackSteps: [],
    },
    riskRegister: {
      generatedAt: "2026-07-04T03:45:00Z",
      summary: "",
      risks: [],
    },
    verificationPlan: {
      generatedAt: "2026-07-04T03:45:00Z",
      summary: "",
      layers: [],
      qualityGates: [],
    },
    manifest: {
      specId: "11111111-1111-5111-8111-111111111111",
      generatedAt: "2026-07-04T03:45:00Z",
      tasks: [],
      runtimeTasks: [],
    },
    stories,
  };
}

describe("renderRequirementsMarkdown", () => {
  it("renders stories with VERIFY-suffixed acceptance criteria", () => {
    const md = renderRequirementsMarkdown(
      makeBundle([
        makeStory({
          id: "US-1",
          title: "Export verification scripts",
          criteria: [
            {
              id: "AC-1",
              given: "an approved bundle",
              when: "export runs",
              then: "scripts are written",
              verificationContract: "npm test -- foo",
            },
          ],
        }),
      ]),
    );

    expect(md).toContain("### US-1: Export verification scripts");
    expect(md).toContain(
      "As a maintainer I want deterministic scripts so that verification is rerunnable",
    );
    expect(md).toContain(
      "- Given an approved bundle, when export runs, then scripts are written",
    );
    expect(md).toMatch(
      /- Given an approved bundle, when export runs, then scripts are written VERIFY `npm test -- foo`/,
    );
  });

  it("omits the VERIFY suffix for criteria without a contract", () => {
    const md = renderRequirementsMarkdown(
      makeBundle([
        makeStory({
          criteria: [
            {
              id: "AC-1",
              given: "manual work",
              when: "a human does it",
              then: "it is done",
            },
          ],
        }),
      ]),
    );

    expect(md).toContain(
      "- Given manual work, when a human does it, then it is done",
    );
    expect(md).not.toContain("VERIFY");
  });
});
