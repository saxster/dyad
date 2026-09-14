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
