import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSpecBundle } from "./spec_bundle_schemas";
import { manifestToGraph } from "./manifest_to_graph";

const FIXTURE_PATH = resolve(
  __dirname,
  "../__fixtures__/spec_bundle.fixture.json",
);

describe("manifestToGraph", () => {
  it("compiles an approved bundle's task manifest into a graph with traceability", () => {
    const bundle = parseSpecBundle(readFileSync(FIXTURE_PATH, "utf8"));
    bundle.manifest.tasks = [
      {
        id: "task-1",
        title: "Ship the widget",
        description: "Build it",
        estimatedPhase: "phase-1",
        status: "pending",
        requiresTestFirst: false,
        dependsOnTitles: [],
        linkedComponentIds: [],
        linkedCriterionIds: [],
        linkedStoryIds: [],
      },
      {
        id: "task-2",
        title: "Polish the widget",
        description: "Refine it",
        estimatedPhase: "phase-2",
        status: "pending",
        requiresTestFirst: false,
        dependsOnTitles: ["Ship the widget"],
        linkedComponentIds: [],
        linkedCriterionIds: [],
        linkedStoryIds: ["US-1"],
      },
    ];

    const graph = manifestToGraph(bundle);

    expect(graph).toEqual([
      {
        id: "task-1",
        title: "Ship the widget",
        deps: [],
        stories: [],
      },
      {
        id: "task-2",
        title: "Polish the widget",
        deps: ["task-1"],
        stories: ["US-1"],
      },
    ]);
  });

  it("rejects dependencies on unknown task titles", () => {
    const bundle = parseSpecBundle(readFileSync(FIXTURE_PATH, "utf8"));
    bundle.manifest.tasks = [
      {
        id: "task-1",
        title: "Ship the widget",
        description: "Build it",
        estimatedPhase: "phase-1",
        status: "pending",
        requiresTestFirst: false,
        dependsOnTitles: ["No such title"],
        linkedComponentIds: [],
        linkedCriterionIds: [],
        linkedStoryIds: [],
      },
    ];

    expect(() => manifestToGraph(bundle)).toThrow(
      "unknown dependency title: No such title",
    );
  });
});
