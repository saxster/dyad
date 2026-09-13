import { describe, expect, it } from "vitest";
import { seedSpecBundleFromHypothesis } from "./hypothesis_to_spec";
import { parseSpecBundle } from "./spec_bundle_schemas";

describe("seedSpecBundleFromHypothesis", () => {
  it("seeds a draft spec bundle from a committed hypothesis", () => {
    const bundle = seedSpecBundleFromHypothesis(
      {
        problem: "P1",
        hypothesis: "H1",
        successCriteria: ["S1", "S2"],
      },
      { now: "2026-09-14T00:00:00.000Z" },
    );

    expect(bundle.rawIntent).toBe("P1");
    expect(bundle.approvalStatus).toBe("draft");
    expect(bundle.createdAt).toBe("2026-09-14T00:00:00.000Z");
    expect(bundle.version).toBe(1);

    expect(bundle.stories).toHaveLength(1);
    const story = bundle.stories[0];
    expect(story.id).toBe("US-1");
    expect(story.title).toBe("Hypothesis: H1");
    expect(story.narrative).toBe("As a user I want H1 so that S1");

    expect(story.criteria).toHaveLength(2);
    expect(story.criteria.map((c) => c.id)).toEqual(["AC-1", "AC-2"]);
    for (const criterion of story.criteria) {
      expect(criterion.given).toBe("the system is in its current state");
      expect(criterion.then).toBe("the criterion holds");
      expect("verificationContract" in criterion).toBe(false);
    }
    expect(story.criteria[0].when).toBe("S1");
    expect(story.criteria[1].when).toBe("S2");

    // Everything else stays an empty skeleton.
    expect(bundle.notDoingList).toEqual([]);
    expect(bundle.provenance).toEqual({});
    expect(bundle.design.architecture).toEqual([]);
    expect(bundle.manifest.tasks).toEqual([]);
    expect(bundle.riskRegister.risks).toEqual([]);

    // The seeded bundle must parse against the real spec schema.
    expect(() =>
      parseSpecBundle(JSON.parse(JSON.stringify(bundle))),
    ).not.toThrow();
  });

  it("defaults createdAt to the current time", () => {
    const before = new Date().toISOString();
    const bundle = seedSpecBundleFromHypothesis({
      problem: "P",
      hypothesis: "H",
      successCriteria: ["S"],
    });
    const after = new Date().toISOString();
    expect(bundle.createdAt >= before && bundle.createdAt <= after).toBe(true);
  });
});
