import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { governanceRuns } from "@/db/schema";
import { appendRunEvent } from "@/ipc/handlers/governance_handlers";
import { runContracts } from "@/governance/verification/contract_runner";
import { createBuiltinBackend } from "./builtin_backend";
import { createRegistry, type BackendRegistry } from "./registry";
import type { BackendEvent, BackendTask } from "./types";

/**
 * Builtin v1 executor: treats the task prompt as a shell command run in the
 * task cwd (the seam the P9 fake-backend env flag will replace).
 */
function createDefaultRegistry(): BackendRegistry {
  const builtin = createBuiltinBackend(async (task) => {
    const [result] = await runContracts(
      [{ key: task.id, command: task.prompt }],
      { cwd: task.cwd, timeoutMs: 30_000 },
    );
    return {
      exitCode: result.status === "green" ? 0 : (result.exitCode ?? 1),
      output: result.outputTail,
    };
  });
  return createRegistry({ builtin, external: [] });
}

/**
 * Dispatches a governed task through the registry's chosen backend, recording
 * every lifecycle event as `backend_<type>` on the app's latest governance
 * run. Returns the collected events in order.
 */
export async function dispatchGovernedTask(
  appId: number,
  task: BackendTask,
  registry: BackendRegistry = createDefaultRegistry(),
): Promise<BackendEvent[]> {
  const run = await db
    .select({ id: governanceRuns.id })
    .from(governanceRuns)
    .where(eq(governanceRuns.appId, appId))
    .orderBy(desc(governanceRuns.id))
    .get();
  if (!run) {
    throw new Error(`no governance run found for app ${appId}`);
  }

  const backend = registry.routeBackend("standard");
  const events: BackendEvent[] = [];
  for await (const event of backend.dispatch(task)) {
    events.push(event);
    await appendRunEvent(run.id, `backend_${event.type}`, {
      node: event.node,
      text: event.text,
      exitCode: event.exitCode,
      error: event.error,
    });
  }
  return events;
}
