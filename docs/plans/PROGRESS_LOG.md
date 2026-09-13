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

## 2026-09-12 — Phase 4 gate

- T4.1–T4.8 complete. Spec-mode prompt (S9 snapshot), write_spec tool,
  TOOL_DEFINITIONS gating, approval gate (integration), spec diff engine,
  SpecReviewPanel, reject→regenerate loop (integration).
- Gate result:
  - `npm run build` ✓ (initially failed on a corrupted
    `~/Library/Caches/electron/…/electron-v40.0.0-darwin-arm64.zip` written by
    the sandboxed install; removing the cached zip fixed packaging).
  - E2E smoke ✓ `e2e-tests/governance_spec_flow.spec.ts` (19.7s): plan-mode
    governed chat writes the spec via write_spec, the review panel surfaces
    with the pending spec, Approve flips the status to approved, and a
    subsequent governed-lane turn runs.
- Gate-driven fixes (found only by the packaged-E2E run):
  - `local_agent_handler.ts` buildOptions now passes `enableGovernance` (the
    tool-set option was previously wired only at the estimator call site, so
    write_spec was unavailable in real turns).
  - `governance_handlers.ts` resolves app paths via `getDyadAppPath` (raw
    relative `apps.path` broke loadBundle in the packaged app).
  - `governanceContracts` imported into `src/ipc/preload/channels.ts`
    (channels were missing from the preload allowlist; renderer invokes
    failed). `governance_contracts.ts` uses a relative import for
    SpecBundleSchema per the preload Vite alias limitation.
  - `dyad-spec` registered in `streamingMessageParser.ts` and
    `DyadMarkdownParser.tsx`; new `DyadWriteSpec` card surfaces the plan
    panel once the bundle is queryable; `PlanPanel` keeps the plan tab open
    (and renders its review UI) while a governed bundle exists.

## 2026-09-13 — Full-program audit (Phases 0–4)

Fixed:

- Two committed debug remnants removed: renderer-console capture in the E2E
  smoke spec and a `data-debug-bundle` attribute on the DyadWriteSpec card.
- Missing `governance:list-spec-bundle-history` handler implemented
  (SpecReviewPanel's diff feature invoked it but no handler was registered);
  RED→GREEN with a two-version history test.
- Four malformed task checkboxes in the plan file (`- [ **T6.2/T8.2/T9.2/T11.2`)
  normalized to `- [ ]`.
- Branch-caused full-suite failures fixed by updating tests to the fork's
  intended post-T0.3 behavior (Pro always unlocked; referenced in each):
  chatMode, useChatMode, useChatModeToggle, ModelPicker (locked-model/unlock
  UX is unreachable), useFixPreCommitWithAI, local_agent_handler Pro-status
  validation, chat_mode + default_chat_mode integration (Google-only Build
  fallback and Basic Agent quota refusal no longer apply).

Audit verification:

- Full unit suite: 7864+ passing; the only deterministic failures are
  pre-existing on clean `main` (verified in a main worktree: git_utils,
  run_pre_commit, retry/undo/git_collaboration/voice_to_text/compaction
  integrations, local_agent_request tool-list). A volatile set of
  happy-dom integration tests is load-flaky and passes idle on both branches.
- ts/fmt/lint clean (0 errors; warnings are the documented EARS `then:`
  no-thenable false-positive class).
- `npm run build` ✓ and the governed E2E smoke re-passed (26.5s) after the
  fixes.
- Note: `governance:get-run` remains an unregistered typed shell per plan
  (first consumed by Phase 9's RunTimeline); do not call it from the
  renderer before then.
