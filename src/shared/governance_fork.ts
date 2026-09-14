/**
 * True unless explicitly disabled: the fork's default posture is local and
 * cloud-free — telemetry no-ops, the free-agent quota gate is released, and
 * the auto-updater never runs. Set GOVERNANCE_FORK=0 to restore the
 * upstream cloud paths (telemetry pipeline, quota accounting, updater).
 *
 * Preload-safe by design: no imports, a plain environment read, so both the
 * renderer bundle and the main process can call it.
 */
export const isGovernanceFork = (): boolean =>
  process.env.GOVERNANCE_FORK !== "0";
