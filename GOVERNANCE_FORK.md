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

## Divergence from upstream

Recorded at the Phase 9 cord-cut (see
`docs/plans/2026-09-12-governance-merge-tdd-plan.md` §1.5); before that point
this branch tracks upstream via periodic rebases.
