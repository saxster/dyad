import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EarsCriterionSchema,
  parseSpecBundle,
  serializeSpecBundle,
  UserStorySchema,
} from "./spec_bundle_schemas";

describe("spec bundle story schemas", () => {
  it("accepts an EARS story with a verification contract", () => {
    const story = {
      id: "US-1",
      title: "Export verification scripts",
      narrative:
        "As a maintainer I want deterministic verification scripts so that verification can be rerun without an agent loop",
      criteria: [
        {
          id: "AC-1",
          given: ".dyad/specs/bundle.json is present and approved",
          when: "verification export runs",
          then: "verify scripts and an index are written",
          verificationContract: "npm test -- foo",
        },
      ],
      priority: "must",
    };

    const parsed = UserStorySchema.parse(story);

    expect(parsed.id).toBe("US-1");
    expect(parsed.title).toBe("Export verification scripts");
    expect(parsed.criteria).toHaveLength(1);
    expect(parsed.criteria[0]).toMatchObject({
      id: "AC-1",
      given: ".dyad/specs/bundle.json is present and approved",
      when: "verification export runs",
      then: "verify scripts and an index are written",
      verificationContract: "npm test -- foo",
    });
    expect(parsed.priority).toBe("must");
  });

  it("accepts a story without an optional priority", () => {
    const parsed = UserStorySchema.parse({
      id: "US-2",
      title: "Ship the thing",
      narrative: "As a user I want it to work so that I am happy",
      criteria: [
        {
          id: "AC-1",
          given: "the app is installed",
          when: "the user opens it",
          then: "the window appears",
        },
      ],
    });

    expect(parsed.priority).toBeUndefined();
  });

  it("rejects a criterion missing given/when/then", () => {
    const result = EarsCriterionSchema.safeParse({
      id: "AC-1",
      given: "the app is installed",
      when: "the user opens it",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a priority outside the MoSCoW scale", () => {
    const result = UserStorySchema.safeParse({
      id: "US-1",
      title: "Bad priority",
      narrative: "As a user I want it so that it works",
      criteria: [
        {
          id: "AC-1",
          given: "g",
          when: "w",
          then: "t",
        },
      ],
      priority: "extreme",
    });

    expect(result.success).toBe(false);
  });
});

const FIXTURE_PATH = resolve(
  __dirname,
  "../__fixtures__/spec_bundle.fixture.json",
);

// The 17 keys of a .dyad spec bundle (plan §4 Phase 1 reference).
const BUNDLE_KEYS = [
  "approvalStatus",
  "approvedAt",
  "createdAt",
  "design",
  "id",
  "manifest",
  "nonFunctionalRequirements",
  "notDoingList",
  "provenance",
  "rawIntent",
  "releaseReadiness",
  "riskRegister",
  "stories",
  "strategy",
  "threatModel",
  "verificationPlan",
  "version",
].sort();

describe("SpecBundleSchema round-trip", () => {
  it("round-trips a full bundle through parse→serialize→parse", () => {
    const raw = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));

    const first = parseSpecBundle(raw);
    const second = parseSpecBundle(serializeSpecBundle(first));

    expect(second).toEqual(first);
  });

  it("preserves all 17 top-level bundle keys", () => {
    const raw = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
    const parsed = parseSpecBundle(raw);

    expect(Object.keys(parsed).sort()).toEqual(BUNDLE_KEYS);
  });
});
