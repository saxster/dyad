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
