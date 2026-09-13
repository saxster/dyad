const MAX_MEMORY_CONTEXT_CHARS = 2000;

/**
 * Renders ranked project memories as a system-side context message. The whole
 * message is sliced to a hard character budget.
 */
export function buildMemoryContextMessage(
  items: Array<{ body: string }>,
): string {
  const lines = ["Project memories:", ...items.map((item) => `- ${item.body}`)];
  return lines.join("\n").slice(0, MAX_MEMORY_CONTEXT_CHARS);
}
