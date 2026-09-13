/**
 * Stable import surface for Dyad's build-snapshot worktree machinery. The
 * DAG orchestrator consumes this seam instead of reaching into the run_build
 * tool module.
 *
 * The implementations stay in run_build.ts on purpose: they sit on that
 * module's private snapshot subsystem (marker files, snapshot git runner,
 * submodule materialization), and physically moving them would force an
 * import cycle between the two modules (run_build.ts needs removeSnapshot
 * for its cleanup paths).
 */
export {
  createBuildWorktree,
  removeSnapshot,
} from "@/pro/main/ipc/handlers/local_agent/tools/run_build";
