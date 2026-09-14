/**
 * True when the fork runs in its local, cloud-free posture.
 *
 * Preload-safe by design: no imports, a plain environment read, so both the
 * renderer bundle and the main process can call it.
 */
export const isGovernanceFork = (): boolean =>
  process.env.GOVERNANCE_FORK === "1";
