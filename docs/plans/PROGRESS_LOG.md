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

## 2026-09-13 — Companion execution plan for Phases 5–12

`docs/plans/2026-09-13-phases-5-12-execution-plan.md` decomposes every remaining task
(T5.1–T12.6) into Flash-sized RED/GREEN steps with exact files, seams, hand-worked expected
values, wiring anchors, verify commands, and commit messages. It also bakes in the session
learnings (env preflight, preload relative-import rule, getDyadAppPath, buildOptions wiring
point, settings snapshot regen, Appendix A pre-existing-failure list, owner checkpoints for
T12.1–T12.3). Future sessions: read the HANDOFF, then this companion plan.

## 2026-09-13 — Phase 5 (T5.1–T5.9 complete; gate E2E partially blocked)

- T5.1–T5.9 all implemented RED→GREEN and committed (`gov(T5.1)`…`gov(T5.9)`), including the
  `spec_verifications.kind` migration (drizzle 0051), the ContractRunner with process-group
  timeout kill, the safe-command screen, the red-first probe, the `run_verifications` tool with
  governance gating in `shouldIncludeTool`, `stampVerification`, the governed turn-end
  verification hook, the VerificationBadge + `governance:get-version-verification` IPC, and the
  `.dyad/bin` verification script export.
- Gate status: `npm run ts` exit 0; fmt/lint clean (0 errors; warnings are the documented
  EARS/then-key class); all 10 targeted P5 suites green (50 tests); `npm run build` ✓
  (TMPDIR must be exported for the Forge temp dir, not just the electron cache).
- Packaged-app verification (via direct sqlite inspection of the e2e userData): governed
  agent-mode turn → hook runs → contract green → `spec_verifications` check row + `verification_completed`
  event + `<dyad-status title="Spec verification" state="finished">1 green, 0 red</dyad-status>`
  appended to the final assistant message content. The backend/DB side of the gate is proven.
- Gate E2E blocked on its final same-view assertion (see `docs/plans/BLOCKED.md`): the open
  chat does not re-render the appended status; needs a renderer message-refresh mechanism
  outside T5.7's file scope.

Deviations recorded (all consistent with the parent plan's semantics):

1. T5.5 wiring adds `run_verifications` to the read-only (ask) toolset, which required adding
   it to the exact-tool-list assertion in `local_agent_ask.integration.test.ts` (repo rules
   prescribe this maintenance; test updated and green).
2. `<dyad-status>` state uses `finished` (valid per `rules/chat-message-indicators.md`), not
   the companion plan's literal `complete`.
3. The `governance:get-version-verification` contract keys on `{ appId, commitHash }` instead
   of the companion's `versionId` because `Version` rows in the VersionPane carry only the git
   oid; the handler resolves the version row, then reads check rows — same output shape.
4. T5.7/T5.9 tests seed the app state (`file1.txt`) themselves: the fake model's canned
   governed-turn response arrives as text and cannot execute a real write in either the vitest
   or the packaged-E2E harness. All companion-specified assertions kept verbatim.
5. Ask-mode fixture note: the fake server's canned governed response never writes files, so
   E2E model-writes-file scenarios need a real `write_file` tool-call fixture turn (the
   fixture continuation across prompts did not serve later turns in this flow).

## 2026-09-13 — P5 gate PASSED (resolution)

- The blocked gate E2E was resolved by re-scoping its final assertion to the persisted verdict
  evidence, as sanctioned by the owner decision: the same-view DOM assertion is replaced by
  direct sqlite verification (Node builtin `node:sqlite`, readOnly) of the packaged app's DB —
  green `spec_verifications` check row for `US-1/AC-1`, `verification_completed` run event, and
  the `<dyad-status title="Spec verification" state="finished">1 green, 0 red</dyad-status>`
  suffix on the final assistant message — plus UI assertions for the governed turn itself
  (no approval-gate refusal, contract target file visible). Result: `1 passed (21.2s)`.
- `docs/plans/BLOCKED.md` removed (blocker resolved). Renderer follow-up (push a message
  refresh after governed turn-end verification so the verdict appears without a remount) is
  deferred to review as a UX polish item; it is not required by the parent plan's T5.7 GREEN.
- Gate commands all green: `npm run ts`, fmt/lint (0 errors), `npm run build`, targeted suites,
  and the new `e2e-tests/governance_verification.spec.ts`.

## 2026-09-13 — Phase 6 gate PASSED

- T6.1–T6.8 complete and pushed: verdict aggregation (T6.1), 3-round Delphi council engine over
  `setModelClientFetchForTesting` (T6.2), member razors in prompts with snapshots (T6.3),
  `convene_council` tool + `council_verdicts` table (migration 0052, T6.4), heuristic gate
  triggers (T6.5), `BudgetGovernor` + `DyadErrorKind.BudgetExceeded` (telemetry-filtered) +
  `governanceBudgetUsd` setting default 5 (T6.6), gate wiring: contested council verdict marks
  the latest running `governance_runs` row `gate_open`, governed turns refused until
  `governance:resolve-gate` (T6.7), `estimateCouncilCost` + per-member-round budget recording in
  `runCouncil` + consent-preview cost estimate (T6.8).
- Gate result: `npm run ts` exit 0; fmt/lint clean (0 errors); consolidated P5+P6 batch
  21 suites / 251 tests green, including both integration suites
  (`chat_stream_handlers.governance.integration.test.ts` 5/5,
  `local_agent_ask.integration.test.ts` 3/3 — its exact-tool list gained `convene_council`,
  same maintenance rule as T5.5).
- Engine-test notes for future sessions: under `DYAD_ENGINE_URL` + Pro settings, council members
  route through the engine keeping their native wire protocols (anthropic → `/v1/messages`,
  gemini/xai → `/v1/chat/completions`, openai → `/v1/responses`); the test fake fetch shapes
  responses per endpoint. `getModelClient` requires the mocked `getLanguageModelProviders` to
  return the provider configs (empty list → "Configuration not found for provider").
- Deviation: T6.4's checkbox in the parent plan was malformed (`- [ **T6.4` — no `]`/no x);
  normalized to `- [x]` in this task's commit.

## 2026-09-13 — Phase 7 gate PASSED

- T7.1–T7.6 complete and pushed: `memory_items` table (migration 0053) + `MemoryStore` CRUD with
  tier/category validation and 0–10 importance clamping (T7.1), 60s-throttled `sweepExpired`
  eviction of expired medium-tier items (T7.2), `rankMemories` recency-weighted ranking
  (T7.3), `record_memory` tool with governance gating (T7.4), governed-turn memory injection
  `buildMemoryContextMessage` (T7.5), and the post-run `errorPattern` learning hook with a
  `memory_recorded` run event (T7.6).
- Gate result: `npm run ts` exit 0; fmt/lint clean (0 errors); 9 suites / 130 tests green
  including both integration suites.
- Deviations (per plan or harness reality):
  1. T7.4 consent: `defaultConsent` is per-TOOL, so `record_memory` uses `"ask"` instead of the
     parent plan's per-category consent (plan-directed deviation).
  2. T7.3 literal: the companion plan's hand-worked `0.462` for A {importance 9, age 30d} is an
     arithmetic slip — the parent plan's formula yields 0.4614 → `0.461`; formula wins.
  3. T7.5 assertion: the harness dump masks all system messages
     (`server_dump.ts maskSystemMessages`), so the integration test asserts the memory marker
     against the raw recorded request via `ServerDumpResult.dumpPath` instead of the masked
     `text` projection.
