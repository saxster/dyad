import type { SpecBundle } from "./spec_bundle_schemas";
import type { TaskNode } from "./task_graph";

/**
 * Compiles an approved bundle's task manifest into a task graph. Manifest
 * tasks declare dependencies by title; the graph carries them by task id so
 * the DAG orchestrator can schedule them, and keeps the linked story ids for
 * traceability back to the spec.
 */
export function manifestToGraph(bundle: SpecBundle): TaskNode[] {
  const idByTitle = new Map(
    bundle.manifest.tasks.map((task) => [task.title, task.id]),
  );
  return bundle.manifest.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    deps: task.dependsOnTitles.map((title) => {
      const id = idByTitle.get(title);
      if (id === undefined) {
        throw new Error(`unknown dependency title: ${title}`);
      }
      return id;
    }),
    stories: [...task.linkedStoryIds],
  }));
}
