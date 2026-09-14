# GOVERNANCE_FORK.md

This repository is a **private, company-internal fork** of Dyad
([dyad-sh/dyad](https://github.com/dyad-sh/dyad)) that merges the governance
spine ported from the owner's Anvil project (`anvil_opencode`). It is not
distributed externally.

## License basis

- **Core Dyad** (everything outside `src/pro/`): Apache-2.0. This fork's
  additions (including everything under `src/governance/`) inherit Apache-2.0.
- **`src/pro/`**: Functional Source License, v1.1 with an Apache-2.0 future
  grant (`FSL-1.1-ALv2`, see `src/pro/LICENSE`). FSL-1.1-ALv2 permits internal
  business use, which is exactly how this fork uses it.
- **Anvil** (`anvil_opencode`, the read-only reference implementation): owned
  by saxster, licensed Apache-2.0. Its Swift governance logic is
  **re-implemented in TypeScript** here; no Anvil Swift is compiled, shipped,
  or executed by this fork, and the Anvil repository itself is never modified.

## Distribution

This fork is for **internal use only. No external distribution.** Do not
publish, relicense, or redistribute the merged product.

## Local-run posture

The program runs **locally, not in the cloud** (owner decision,
2026-09-14). The database direction is **generic latest Postgres** — no
Neon, no Supabase (see `docs/plans/generic-postgres-integration-plan.md`).

Opt-in flags this fork adds:

- `GOVERNANCE_FORK=1` — releases the cloud paths: telemetry senders no-op
  (no renderer PostHog traffic) and the free-quota / auto-update cloud
  gates are released. Set this when running the fork locally.
- `DYAD_GOVERNANCE_FAKE_BACKEND=1` — governed turns execute an approved
  bundle's task manifest through the DAG orchestrator instead of calling
  an LLM.

## Divergence from upstream

Recorded at the Phase 9 cord-cut (see
`docs/plans/2026-09-12-governance-merge-tdd-plan.md` §1.5); before that point
this branch tracks upstream via periodic rebases.

## Cord-cut (Phase 9)

- **Divergence commit:** `aa7e30f018fde8502e0c15a26cab6231d437430f`
  (`gov(T9.7): RunTimeline UI` + the T9.8 DAG wiring)
- **Date:** 2026-09-14
- **Last absorbed upstream commit:** `d6cebfc77ab62b017b3d1202f662813e37d8b53d`
  (`main`)
- **Rule from here on:** rebasing onto upstream is **forbidden**. Upstream
  changes are cherry-picked by need only, and each pick is re-verified
  against the governance suites (`src/governance/**`, the governed chat
  integration suites, and the `.dyad/bin` verification scripts).

Why the cord was cut: Phase 9 rewrote the run lifecycle beyond additive
hooks — governed turns can now bypass the LLM stream entirely (DAG fast
path), the run-events table carries orchestration lifecycle (`dag_*`), and
the verification safety gate gained an executor-oriented allow prefix
(`touch `). These cross the seams upstream also owns (chat stream
terminal payload, message persistence), so rebase-based tracking would
rewrite this logic on every upstream movement.

Notable deliberate deltas vs upstream at the cut (baked during P5–P8):
governance routing/approval/gates wired into `chat_stream_handlers`,
`spec_verifications.kind` column (migration 0051), `council_verdicts`
(0052), `memory_items` (0053), per-tool consent default for `record_memory`,
and the red-first verification spine. Env flags introduced by this fork:
`DYAD_GOVERNANCE_FAKE_BACKEND=1` (DAG fast path over an approved bundle's
task manifest), `GOVERNANCE_FORK=1` (strip-down gates, Phase 12).

## Final state (program close-out, 2026-09-14)

Cord-cut hash: `aa7e30f018fde8502e0c15a26cab6231d437430f` (upstream last
absorbed: `d6cebfc7`). All parent-plan phases 0–12 are complete; T12.2 was
closed as a no-op on the owner's local-deployment confirmation.

Deliberate deltas vs upstream (complete list):

1. Governance spine in `src/governance/**`: lane screening, spec bundles +
   approval, red-first verification (probe → check) with a process-group
   timeout contract runner and a deny-then-allow safety gate (`touch `
   added in P9 for the DAG marker executor), councils, project memory,
   multi-runtime backends, DAG orchestration, incubation/thoughts, and the
   headless stack (`scripts/dyadctl.mjs`, unix-socket RPC, issue-intake
   autopilot).
2. Migrations 0051 (`spec_verifications.kind`), 0052 (`council_verdicts`),
   0053 (`memory_items`), 0054 (`thoughts`/`thought_links`) on top of
   upstream's set.
3. T7.4 deviation: `record_memory` consent is per-tool (`"ask"`) rather
   than the parent plan's per-category consent — `defaultConsent` is
   per-tool, so per-category would have required new machinery.
4. T7.3 correction: the ranking decay constant is 0.461 (formula-derived),
   not the companion's hand-worked 0.462.
5. Cloud-free posture: `GOVERNANCE_FORK=1` no-ops telemetry and releases
   the free-agent quota and auto-updater; `DYAD_GOVERNANCE_FAKE_BACKEND=1`
   runs governed turns through the DAG marker executor.
6. Database direction: generic latest Postgres (decision memo
   `docs/plans/self-hosted-postgres.md`, integration plan
   `docs/plans/generic-postgres-integration-plan.md`); Neon/Supabase stay
   in the tree until the follow-up program replaces them.
7. Boundary inventory: the governance dispatch sites are pinned as
   non-remote access in `src/distributed_machines/boundary_inventory.test_support.ts`.

Known machine-environment test caveats (documented in
`docs/plans/PROGRESS_LOG.md`): the Appendix A set plus git-subprocess
suites that time out under parallel load on this machine (they pass idle
or on other machines; identical failures occur on a clean main worktree).
