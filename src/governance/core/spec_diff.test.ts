import { describe, expect, it } from "vitest";
import { diffBundles, renderSpecDiff } from "./spec_diff";
import type { SpecBundle, UserStory } from "./spec_bundle_schemas";

function bundleWith(stories: UserStory[]): Pick<SpecBundle, "stories"> {
  return { stories };
}

function story(id: string, narrative: string, then: string): UserStory {
  return {
    id,
    title: `Story ${id}`,
    narrative,
    criteria: [
      {
        id: "AC-1",
        given: "g",
        when: "w",
        then,
      },
    ],
  };
}

describe("diffBundles", () => {
  it("classifies added/removed/modified stories between bundle versions", () => {
    const before = bundleWith([
      story("US-1", "narrative one", "then A"),
      story("US-2", "narrative two", "then B"),
    ]);
    const after = bundleWith([
      story("US-1", "narrative one changed", "then A"),
      story("US-3", "narrative three", "then C"),
    ]);

    expect(diffBundles(before, after)).toEqual({
      added: ["US-3"],
      removed: ["US-2"],
      modified: ["US-1"],
    });
  });

  it("marks a criterion-only change as modified", () => {
    const before = bundleWith([story("US-1", "same narrative", "then A")]);
    const after = bundleWith([
      story("US-1", "same narrative", "then A changed"),
    ]);

    expect(diffBundles(before, after).modified).toEqual(["US-1"]);
  });

  it("leaves identical stories untouched", () => {
    const before = bundleWith([story("US-1", "same", "same then")]);
    const after = bundleWith([story("US-1", "same", "same then")]);

    expect(diffBundles(before, after)).toEqual({
      added: [],
      removed: [],
      modified: [],
    });
  });
});

describe("renderSpecDiff", () => {
  it("renders a markdown diff", () => {
    const diff = {
      added: ["US-3"],
      removed: ["US-2"],
      modified: ["US-1"],
    };

    const md = renderSpecDiff(diff);

    expect(md).toContain("+ US-3");
    expect(md).toContain("- US-2");
    expect(md).toContain("~ US-1");
  });
});
