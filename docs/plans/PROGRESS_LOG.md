# Progress Log — Governance Merge

## 2026-09-12 — Phase 0 gate

- T0.1–T0.4 complete on branch `governance/main` (pushed to origin).
- Environment notes for future sessions:
  - Node **24** is required (repo engines `>=24 <26`); the default `node` on
    PATH here is v22. Prefix commands with
    `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` and run
    `npm rebuild better-sqlite3 electron dugite` after a fresh install
    (npm 12 blocks install scripts; AGENTS.md remedies apply).
  - Run `npm --prefix testing/fake-llm-server install` or `npm run ts` fails
    with missing express/cors types.
  - A machine-level `graphify` pre-commit hook writes an untracked
    `graphify-out/` directory into the repo. It is machine-generated; it is
    never staged (task files are staged explicitly instead of `git add -A`).

## 2026-09-12 — Phase 1 gate

- T1.1–T1.8 complete. Spec bundle schemas round-trip the sanitized Anvil
  fixture (`src/governance/__fixtures__/spec_bundle.fixture.json`); approval
  reducer is the single source of truth; requirements.md serializer/parser
  round-trip; ArtifactStore stamps versions, snapshots history, writes the
  requirements.md pair, and throws `DyadError(Validation)` on unparseable
  bundles.
- Known lint noise: oxlint `no-thenable` warnings fire on the EARS
  Given/When/Then object literals (`then:` key) — pre-existing warning class
  in this repo (spec schemas/fixtures, not fixable without renaming EARS
  fields). Warnings only, 0 errors.

## 2026-09-12 — Phase 2 gate

- T2.1–T2.6 complete. Six governance tables + migration `0050`; typed IPC
  contracts; save/get/approve handlers + `appendRunEvent`; `use_governance`
  hook with `queryKeys.governance` entries.
- Gate: `npm run ts` exit 0; `npm run fmt` clean; `npm run lint` 0 errors;
  34/34 tests green across the six governance suites.
- T2.6 note: the hook imports `governanceClient` directly from
  `@/ipc/contracts/governance_contracts` instead of adding a re-export in
  `src/ipc/types/index.ts` (outside the task's file list). If a later task
  needs the unified `ipc` namespace, add the re-export there.

## 2026-09-12 — Phase 3 gate

- T3.1–T3.6 complete. Lane screen (Anvil signal lists), rigor axes
  (deterministic v1, hand-worked table), tier mapping, `enableGovernance` /
  `governanceRigor` settings with Settings-page switch, and `routeTurn`
  wired additively into the chat stream pre-dispatch right after mode
  resolution (records a `governance_runs` row + `turn_routed` event
  best-effort via `appendRunEvent`).
- Gate: `npm run ts` exit 0; fmt/lint clean (0 errors); 187/187 tests green
  across 11 suites including the existing chat stream handler suites.
- Environment: after the session sandbox began denying writes under
  `/var/folders/.../T`, tests must run with `export TMPDIR=/tmp/dyad-tmp`
  (os.tmpdir() is honored by vitest and the node --test pre-chain).
