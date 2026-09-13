export interface TaskNode {
  id: string;
  title?: string;
  deps: string[];
  stories?: string[];
}

/**
 * Orders node ids so every dependency precedes its dependents (Kahn's
 * algorithm, stable by input order). Throws when the graph contains a cycle,
 * listing the ids that could never reach in-degree zero.
 */
export function topoOrder(nodes: TaskNode[]): string[] {
  const dependents = new Map<string, string[]>();
  const remainingDeps = new Map<string, number>();
  for (const node of nodes) {
    remainingDeps.set(node.id, node.deps.length);
    for (const dep of node.deps) {
      const list = dependents.get(dep);
      if (list) {
        list.push(node.id);
      } else {
        dependents.set(dep, [node.id]);
      }
    }
  }

  const queue: string[] = [];
  for (const node of nodes) {
    if (node.deps.length === 0) {
      queue.push(node.id);
    }
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const dependent of dependents.get(id) ?? []) {
      const left = (remainingDeps.get(dependent) ?? 0) - 1;
      remainingDeps.set(dependent, left);
      if (left === 0) {
        queue.push(dependent);
      }
    }
  }

  if (order.length < nodes.length) {
    const ordered = new Set(order);
    const cycleIds = nodes
      .map((node) => node.id)
      .filter((id) => !ordered.has(id));
    throw new Error(`cycle detected: ${cycleIds.join(", ")}`);
  }

  return order;
}

/**
 * Ids that are not yet completed but whose every dependency is — the nodes a
 * scheduler may admit right now.
 */
export function readySet(
  nodes: TaskNode[],
  completed: Set<string>,
): Set<string> {
  const ready = new Set<string>();
  for (const node of nodes) {
    if (completed.has(node.id)) {
      continue;
    }
    if (node.deps.every((dep) => completed.has(dep))) {
      ready.add(node.id);
    }
  }
  return ready;
}

/**
 * Runs every node through `runner`, keeping at most `maxConcurrent` runners
 * in flight and admitting queued nodes as in-flight ones complete. A node
 * starts only once all of its dependencies have completed. The first runner
 * rejection propagates. Resolves with the results aligned to
 * `topoOrder(nodes)` (which also rejects cyclic graphs).
 */
export function runWithBackpressure<T>(
  nodes: TaskNode[],
  {
    runner,
    maxConcurrent = 4,
  }: { runner: (node: TaskNode) => Promise<T>; maxConcurrent?: number },
): Promise<T[]> {
  const order = topoOrder(nodes);
  const byId = new Map(nodes.map((node) => [node.id, node]));

  return new Promise((resolve, reject) => {
    const completed = new Set<string>();
    const launched = new Set<string>();
    const results = new Map<string, T>();
    const inFlight = new Set<Promise<void>>();
    let failure: { error: unknown } | undefined;

    const settleIfDone = () => {
      if (completed.size === nodes.length) {
        resolve(order.map((id) => results.get(id)!));
      }
    };

    const pump = () => {
      if (failure) {
        return;
      }
      const ready = readySet(nodes, completed);
      for (const id of order) {
        if (inFlight.size >= maxConcurrent) {
          break;
        }
        if (!ready.has(id) || launched.has(id)) {
          continue;
        }
        launched.add(id);
        const run = runner(byId.get(id)!)
          .then((result) => {
            inFlight.delete(run);
            results.set(id, result);
            completed.add(id);
            pump();
            settleIfDone();
          })
          .catch((error: unknown) => {
            inFlight.delete(run);
            if (!failure) {
              failure = { error };
              reject(error);
            }
          });
        inFlight.add(run);
      }
      settleIfDone();
    };

    pump();
  });
}
