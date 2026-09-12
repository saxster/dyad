import type { SpecBundle } from "./spec_bundle_schemas";

export interface SpecDiff {
  added: string[];
  removed: string[];
  modified: string[];
}

function storiesEqual(
  a: SpecBundle["stories"][number],
  b: SpecBundle["stories"][number],
): boolean {
  return (
    a.narrative === b.narrative &&
    a.title === b.title &&
    JSON.stringify(a.criteria) === JSON.stringify(b.criteria)
  );
}

export function diffBundles(
  before: Pick<SpecBundle, "stories">,
  after: Pick<SpecBundle, "stories">,
): SpecDiff {
  const beforeById = new Map(before.stories.map((story) => [story.id, story]));
  const afterById = new Map(after.stories.map((story) => [story.id, story]));

  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  for (const story of after.stories) {
    const previous = beforeById.get(story.id);
    if (!previous) {
      added.push(story.id);
    } else if (!storiesEqual(previous, story)) {
      modified.push(story.id);
    }
  }
  for (const story of before.stories) {
    if (!afterById.has(story.id)) {
      removed.push(story.id);
    }
  }

  return { added, removed, modified };
}

export function renderSpecDiff(diff: SpecDiff): string {
  const lines: string[] = [];
  for (const id of diff.added) {
    lines.push(`+ ${id} (added)`);
  }
  for (const id of diff.removed) {
    lines.push(`- ${id} (removed)`);
  }
  for (const id of diff.modified) {
    lines.push(`~ ${id} (modified)`);
  }
  return lines.join("\n");
}
