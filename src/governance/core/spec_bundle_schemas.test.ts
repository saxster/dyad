import { describe, it, expect } from "vitest";
import { EarsCriterionSchema, UserStorySchema } from "./spec_bundle_schemas";

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
