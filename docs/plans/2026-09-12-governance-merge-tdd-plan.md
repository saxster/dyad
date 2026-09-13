# Governance Merge — TDD Implementation Plan

**Program:** Port Anvil's governance spine into a private Dyad fork (Option C-complete).

> **Direction, stated plainly: all work happens in this repo (Dyad).** Anvil's Swift code is
> **re-implemented in TypeScript** inside Dyad — no Swift is compiled, shipped, or executed by the
> merged product, and Dyad is never rewritten in Swift. The Anvil repo is a **read-only reference**:
> tasks cite `ANVIL/...` paths so the executor can port behavior faithfully (and copy fixtures),
> never to edit them. After this program, your daily driver is the merged Dyad; Anvil remains as
> the reference implementation and experimental lab.

**Owner:** saxster. **Executor:** GLM 5.3 Flash (or any coding agent), one task at a time.
**Artifact format:** `.dyad/` inside each Dyad app directory. Owner decision 2026-09-12: no existing `.anvil/` projects to preserve, so no Anvil-artifact backward compatibility is required — `.anvil/` paths appear only when reading the `ANVIL/` reference repo or copying its fixtures.
**Reference implementation (read-only):** `/Users/amar/Desktop/MyCode/anvil_opencode` (referred to below as `ANVIL/`).
**Execution repo (all edits):** `/Users/amar/Desktop/MyCode/dyad`, branch `governance/main`.
**Date:** 2026-09-12. **Status:** seams and baked-in decisions approved by owner 2026-09-12 (artifact home adjusted to `.dyad/`). Execute per `docs/plans/governance-merge/HANDOFF.md`.

---

## 1. Global execution protocol (read before every task)

### 1.1 The loop (TDD, non-negotiable)

Every task in this plan is **one vertical slice**: one behavior, one failing test, one minimal implementation.

1. **RED** — Create/extend the test file listed in the task. Write exactly the test named in the task. Run it. It must **fail** (assert `expect` behavior, not "compiles"). If it accidentally passes, the test is wrong — stop and report.
2. **GREEN** — Write the minimum code to pass. Do not add parameters, options, or branches no test demands.
3. **VERIFY** — Run the task's verify commands. All must pass.
4. **COMMIT** — `npm run fmt && npm run lint && git add -A && git commit -m "gov(<task-id>): <title>"`.

Never: write all tests first; weaken an assertion to make it pass; delete an existing test; test private internals; mock the thing under test.

### 1.2 Command cheatsheet

| Purpose                                     | Command                                                       |
| ------------------------------------------- | ------------------------------------------------------------- |
| Targeted unit test                          | `npm test -- path/to/file.test.ts`                            |
| Type-check (only supported way)             | `npm run ts`                                                  |
| Lint / autofix                              | `npm run lint` / `npm run lint:fix`                           |
| Format                                      | `npm run fmt`                                                 |
| DB migration after schema.ts edit           | `npm run db:generate` (then read `rules/database-drizzle.md`) |
| Full local app run                          | `npm start`                                                   |
| E2E (only at phase gates; requires rebuild) | `npm run build` then targeted Playwright                      |

Never run `npx tsc`, `npx eslint`, `npx prettier`, `npx oxlint`, `npx oxfmt`. Use the npm scripts.

### 1.3 Rules files to read before entering an area

| Area (phases)                               | Read first                                                |
| ------------------------------------------- | --------------------------------------------------------- |
| IPC contracts/handlers (P2, P4, P7, P9–P11) | `rules/electron-ipc.md`                                   |
| DB schema/migrations (P2, P7, P10)          | `rules/database-drizzle.md`                               |
| Agent tools (P4–P7)                         | `rules/local-agent-tools.md`                              |
| Chat modes / turn flow (P3, P4)             | `rules/chat-modes.md`, `rules/chat-message-indicators.md` |
| State machines (P4, P9, P10)                | `rules/state-machines.md`                                 |
| Hybrid/IPC tests (P2, P4, P5)               | `rules/hybrid-testing.md`                                 |
| New settings toggles (P0, P3, P6)           | `rules/adding-settings.md`                                |
| Errors (everywhere)                         | `rules/dyad-errors.md`                                    |
| Spawning CLIs on Windows (P8, P11)          | `rules/windows-spawn.md`                                  |
| UI components (P4, P9)                      | `rules/base-ui-components.md`, `rules/ui-styling.md`      |
| Jotai/React Query (P4, P9)                  | `rules/jotai-state.md`                                    |

### 1.4 Stop conditions (hard)

Stop the task and write the blocker into `docs/plans/BLOCKED.md` (append task id + one paragraph) when:

1. A test is not green after **3 focused attempts** (each attempt changes exactly one thing).
2. `npm run ts` reports errors in files the task did not list.
3. A new npm dependency seems required. (None are required by this plan.)
4. An existing test breaks for a reason unrelated to the new behavior.
5. Any instruction in this plan conflicts with a rule in `AGENTS.md` or `rules/`.

Never: `git push --force`, `git reset --hard`, deleting files outside the task's list, editing `package-lock.json` by hand.

### 1.5 Upstream tracking protocol (Phases 0–8 only)

- All new code lives in **new files** under `src/governance/`, `src/ipc/contracts/governance_contracts.ts`, `src/ipc/handlers/governance_handlers.ts`, `src/pro/main/ipc/handlers/local_agent/tools/<new_tools>.ts`, plus additive rows in `src/db/schema.ts` and additive entries in `TOOL_DEFINITIONS` (`src/pro/main/ipc/handlers/local_agent/tool_definitions.ts:140`).
- Once per week: `git fetch upstream-dyad && git rebase <latest-upstream-main>` on `governance/main`. Resolve conflicts keeping both sides' intent.
- **Cord-cut:** the moment Phase 9 rewrites run lifecycle beyond additive hooks, stop rebasing; record the divergence point in `GOVERNANCE_FORK.md`.

---

## 2. Seam registry — APPROVAL GATE

Per the TDD doctrine, tests live only at these pre-agreed seams. **Do not write tests anywhere else.** Execution of the plan starts only after the owner approves this table.

| #   | Seam                          | Where                                                                                                                     | Test style                                            |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| S1  | Pure governance logic         | exported functions in `src/governance/**` (no `electron`, no `node:fs`)                                                   | table-driven unit tests, zero mocks                   |
| S2  | `ArtifactStore`               | class in `src/governance/artifacts/artifact_store.ts`, fs via injected root                                               | unit tests against `fs.mkdtemp` tmp dirs              |
| S3  | `ContractRunner.run`          | `src/governance/verification/contract_runner.ts`, process via injected `runCommand` (default real)                        | unit tests with real `sh -c` against tmp fixtures     |
| S4  | IPC handlers                  | `src/ipc/handlers/governance_handlers.ts` via `getRegisteredHandlerForTesting` (pattern in `src/ipc/handlers/base.ts:17`) | registered-handler unit tests                         |
| S5  | Agent tools                   | `execute(args, ctx)` with hand-built `AgentContext` (pattern in existing tool `*.spec.ts` / `run_build.ts` exports)       | unit + fake ctx                                       |
| S6  | LLM-calling engines (council) | `getModelClient` behind `setModelClientFetchForTesting` (`src/ipc/utils/test_fetch_override.ts`)                          | fake-fetch unit tests                                 |
| S7  | Chat-mode/turn resolution     | `resolveChatModeForTurn`-style pure/injected functions                                                                    | unit (existing `chat_mode_resolution.test.ts` style)  |
| S8  | Drizzle stores                | real sqlite test db (existing `src/db.test.ts` pattern)                                                                   | integration-style unit                                |
| S9  | Prompt assembly               | `src/prompts/*.ts`                                                                                                        | snapshot tests (`src/prompts/__snapshots__/` pattern) |
| S10 | Renderer panels               | React component render with mocked IPC hooks                                                                              | colocated `*.test.tsx`                                |

E2E (Playwright) is reserved for **phase-gate smoke tests only** (P4, P5, P9 ends), never per-task.

---

## 3. Target architecture (additive)

```
src/governance/                     # main-process governance engine (new)
  core/                             # S1 pure logic: schemas, lane, rigor, diff, verdicts, budget
    spec_bundle_schemas.ts          # zod mirror of .dyad/specs/bundle.json (format ported from Anvil)
    requirements_markdown.ts        # requirements.md <-> bundle round-trip
    lane_screen.ts                  # LeanLane port
    rigor_tiers.ts                  # AdaptiveRigor port
    spec_diff.ts                    # story/design delta + markdown render
    verdict_aggregator.ts           # council verdict classification
    budget_governor.ts              # token/cost ceiling
    memory_ranking.ts               # importance x recency
    task_graph.ts                   # DAG model + topo order + backpressure
  artifacts/artifact_store.ts       # S2 .dyad/ read/write (bundle.json, history/, specs/)
  verification/contract_runner.ts   # S3 VERIFY command execution + red-first
  memory/memory_store.ts            # S8 drizzle-backed 3-tier memory
  council/council_engine.ts         # S6 multi-model Delphi
  runs/governed_run_coordinator.ts  # state machine host for governed runs
  backends/                         # P8 multi-runtime dispatch
src/ipc/contracts/governance_contracts.ts
src/ipc/handlers/governance_handlers.ts        (+ register in ipc host: grep registerChatStreamHandlers)
src/prompts/spec_mode_prompt.ts                # plan-mode upgrade (S9)
src/pro/main/ipc/handlers/local_agent/tools/   # write_spec, define_verification, run_verifications,
                                               # convene_council, record_memory (+ TOOL_DEFINITIONS rows)
renderer: src/components/governance/           # SpecReviewPanel, VerificationBadge, RunTimeline (P4/P9)
db: additive tables in src/db/schema.ts        # spec_bundles, spec_stories, governance_runs,
                                               # governance_run_events, spec_verifications,
                                               # memory_items, council_verdicts, thoughts, thought_edges
```

Product decision baked in (v1): **Plan mode is upgraded in place** into spec-governed planning when the `enableGovernance` setting is on. No new chat mode until after cord-cut — keeps `rules/chat-modes.md` surface minimal.

---

## 4. Phases & tasks

Progress: check the box when the task's commit exists and its verify commands pass.

### Phase 0 — Fork rails (4 tasks)

- [x] **T0.1 Create the governance trunk.**
      Files: branch only. `git checkout -b governance/main` from `main`. Push to origin fork per `rules/git-workflow.md`.
      Done when: `git log --oneline -1` on `governance/main` matches main.

- [x] **T0.2 Document the license basis.**
      Files: create `GOVERNANCE_FORK.md` (root). Content: private internal-use fork; core Apache-2.0; `src/pro` FSL-1.1-ALv2 permits internal use; Anvil code is owner's Apache-2.0; no external distribution. No test (docs only).
      Verify: file exists; `npm run fmt` clean.

- [x] **T0.3 Unlock Pro internally.**
      Seam: S7. Files: test `src/lib/__tests__/pro_unlock.test.ts` (or extend existing schemas test file), impl `src/lib/schemas.ts` (`isDyadProEnabled`, line ~662).
      RED: `it("treats Pro as enabled for the internal fork without a gateway key", ...)` asserting `isDyadProEnabled({} as UserSettings)` → `true`.
      GREEN: return `true` with a one-line comment referencing `GOVERNANCE_FORK.md`. Do not touch `hasDyadProKey`.
      Verify: `npm test -- <file>`; `npm run ts`.

- [x] **T0.4 Install pre-commit.**
      `npm run init-precommit`. Verify: `git commit` on a scratch change runs fmt/lint. Revert scratch.

### Phase 1 — Spec bundle schema + artifact store (8 tasks)

Reference: `ANVIL/.anvil/specs/bundle.json` (keys: `approvalStatus, approvedAt, createdAt, design, id, manifest, nonFunctionalRequirements, notDoingList, provenance, rawIntent, releaseReadiness, riskRegister, stories, strategy, threatModel, verificationPlan, version`).

- [x] **T1.1 Story + criterion schemas.**
      Seam S1. Files: test `src/governance/core/spec_bundle_schemas.test.ts`, impl `src/governance/core/spec_bundle_schemas.ts`.
      RED: `it("accepts an EARS story with a verification contract")` — fixture with `id: "US-1"`, `title`, `narrative` ("As a… I want… So that…"), `criteria: [{ id: "AC-1", given, when, then, verificationContract: "npm test -- foo" }]`, optional `priority: "must"|"should"|"could"|"wont"` (MoSCoW). Second test: `it("rejects a criterion missing given/when/then")`.
      GREEN: zod schemas `EarsCriterionSchema`, `UserStorySchema`. Export types.
      Verify: `npm test -- src/governance/core/spec_bundle_schemas.test.ts`.

- [x] **T1.2 Full bundle schema round-trip.**
      Same files. RED: `it("round-trips a full bundle through parse→serialize→parse")` using a fixture derived from the real Anvil bundle (copy to `src/governance/__fixtures__/spec_bundle.fixture.json`, sanitize project-specific strings). Assert the second parse deep-equals the first.
      GREEN: `SpecBundleSchema` with all 17 keys; `parseSpecBundle(json)`, `serializeSpecBundle(bundle)`.

- [x] **T1.3 Approval status transitions.**
      Same files. RED: table-driven `it.each` — `draft → pending_approval → approved` allowed; `approved → draft` requires `force` flag; `approved` requires `approvedAt`. GREEN: `nextApprovalStatus(current, event)` pure reducer returning `{ status } | { error }`.

- [x] **T1.4 requirements.md serializer.**
      Seam S1. Files: test + impl `src/governance/core/requirements_markdown.ts`.
      RED: `it("renders stories with VERIFY-suffixed acceptance criteria")` — given one story, output contains `### US-1: <title>`, the narrative line, `- Given X, when Y, then Z` and the suffix `` VERIFY `npm test` `` on the criterion line (Anvil convention).
      GREEN: `renderRequirementsMarkdown(bundle)`.

- [x] **T1.5 requirements.md parser (round-trip).**
      Same files. RED: `it("parses its own serialized output back into equal stories")` (serializer output → parser → deep-equal stories array; provenance-level fields ignored).
      GREEN: `parseRequirementsMarkdown(md)`. Edge test: CRLF input parses identically (repo rule on line endings).

- [x] **T1.6 ArtifactStore — save/load bundle.**
      Seam S2. Files: test + impl `src/governance/artifacts/artifact_store.ts`.
      RED: `it("writes bundle.json and loads it back")` with root = `await fs.mkdtemp(...)`: `saveBundle(root, bundle)` then `loadBundle(root)` deep-equals. Also asserts file is written to `<root>/.dyad/specs/bundle.json`.
      GREEN: class with injected root path defaulting to app path; atomic write (tmp file + rename).

- [x] **T1.7 ArtifactStore — version history.**
      Same files. RED: `it("snapshots each save into history with a version stamp")` — save v1, mutate, save v2 → `listHistory(root)` returns two entries with `version` increasing and frozen v1 content.
      GREEN: history under `.dyad/specs/history/<version>-<id>.json`.

- [x] **T1.8 ArtifactStore — writes the human-readable pair.**
      Same files. RED: `it("also writes requirements.md next to bundle.json")` and `it("refuses to save an unparseable bundle")` (zod failure throws `DyadError` kind `Validation` — read `rules/dyad-errors.md`).
      GREEN: pair-write; validation error mapping.

### Phase 2 — Governance DB + IPC spine (6 tasks)

- [x] **T2.1 Tables.**
      Seam S8. Read `rules/database-drizzle.md` first. Files: `src/db/schema.ts` (additive), test `src/db/governance_schema.test.ts`.
      Tables: `spec_bundles(id, appId, chatId?, artifactVersion, approvalStatus, approvedAt?, createdAt, updatedAt)`, `spec_stories(id, bundleId, storyId, title, priority, narrative, json)`, `acceptance_criteria(id, storyRowId, criterionId, given, when, then, verificationContract?)`, `governance_runs(id, appId, chatId, bundleId, lane, tier, status, startedAt, endedAt?)`, `governance_run_events(id, runId, seq, type, payloadJson, at)`, `spec_verifications(id, runId, versionId?, criterionKey, status, exitCode?, outputTail, at)`.
      RED: insert + re-select one row per table through drizzle against a tmp sqlite db (copy the setup from `src/db.test.ts`).
      GREEN: schema + `npm run db:generate`; commit the generated migration.

- [x] **T2.2 Contracts.**
      Files: `src/ipc/contracts/governance_contracts.ts` following the existing contracts module style (grep `IpcContract` in `src/ipc/contracts/`).
      Define: `saveSpecBundle`, `getSpecBundle(appId)`, `listSpecBundleHistory(appId)`, `approveSpecBundle(appId, {decision, feedback?})`, `getGovernanceRun(runId)`. No test yet (typed shells) — the handlers tests exercise them.

- [x] **T2.3 Handlers — save/get round-trip.**
      Seam S4. Files: test `src/ipc/handlers/governance_handlers.test.ts`, impl `src/ipc/handlers/governance_handlers.ts` (+ call `registerGovernanceHandlers()` where siblings register — grep `registerChatStreamHandlers`).
      RED: `it("saves a bundle via IPC and returns the persisted artifact version")` using `getRegisteredHandlerForTesting`; then `it("gets back the saved bundle")`.
      GREEN: handler writes via ArtifactStore + drizzle row; returns `{ bundle, artifactVersion }`.

- [x] **T2.4 Handler — approve with feedback loop.**
      Same files. RED: `it("approves a pending bundle and stamps approvedAt")`; `it("reject routes status back to draft and stores feedback")` (feedback persisted in bundle `provenance.lastRejectionFeedback`).
      GREEN: uses `nextApprovalStatus` from T1.3 (single source of truth).

- [x] **T2.5 Handler — run event log.**
      Same files. RED: `it("appends ordered events to a governance run")` (seq monotonic; payloadJson round-trips).
      GREEN: `appendRunEvent` helper exported for later phases.

- [x] **T2.6 Renderer plumbing (minimal).**
      Seam S10. Files: `src/hooks/use_governance.ts` (React Query hook following existing IPC hook conventions in `rules/electron-ipc.md`), test colocated with mocked invoke.
      RED: `it("loads the spec bundle for an app and exposes approval status")`.
      **Phase gate:** `npm run ts && npm run lint && npm run fmt` clean; full targeted suites green; commit.

### Phase 3 — Routing: LeanLane + AdaptiveRigor (6 tasks)

Reference: `ANVIL/anvil-macOS/Core/Workflow/LeanLane.swift:14-42` (exact signal lists), `Core/AdaptiveRigorEngine.swift` (axes 0–3 ×4 → 0–12; Surgical 0–3, Standard 4–7, Architectural 8–12).

- [x] **T3.1 Lane screen — security signals.**
      Seam S1. Files: test + impl `src/governance/core/lane_screen.ts`.
      RED: `it.each` over EVERY security signal (`"rm ", "git push", "git commit", "git reset", "force push", "sudo ", "chmod ", "docker ", "npm install", "brew ", "kubectl", "terraform", "deploy", "production", ".env", "secret", "credential", "password", "api key", "api_key", "private key", "package.swift", "migration", "drop table", "drop database", "prod database"`) asserting a prompt containing it → `"governed"`.
      GREEN: `screenLane(prompt): "lean" | "governed"`, case-insensitive substring match.

- [x] **T3.2 Lane screen — breadth + lean default.**
      Same files. RED: `it.each` breadth signals (`"refactor across", "rename everywhere", "every file", "all files", "entire codebase", "across the codebase", "whole repo", "migrate ", "rewrite the "`) → governed; `it("returns lean for a benign surgical prompt")` ("fix the typo in button label") → lean.
      GREEN: second list; default lean.

- [x] **T3.3 Rigor axes scoring (deterministic v1).**
      Seam S1. Files: test + impl `src/governance/core/rigor_tiers.ts`.
      RED: table-driven — prompts mentioning auth/payments/migrations raise Security Sensitivity; "rewrite the data layer" raises Domain Breadth; first-ever mention of unknown subsystem raises Novelty (v1: keyword `unfamiliar|new integration|never`); touching `src/db|migrations|package.json` raises Blast Radius. Each axis clamps 0–3.
      GREEN: `scoreRigorAxes(prompt, context): { breadth, security, novelty, blastRadius }`.

- [x] **T3.4 Tier mapping.**
      Same files. RED: composite 0–3 → `surgical`, 4–7 → `standard`, 8–12 → `architectural`; explicit user override wins.
      GREEN: `classifyTier(score, override?)`.

- [x] **T3.5 Setting toggle.**
      Read `rules/adding-settings.md`. Files: settings schema + defaults + Settings page row.
      RED: `it("defaults enableGovernance to true")` in the settings test; UI toggle renders (S10 test).
      GREEN: `enableGovernance: true` default (private fork: governance is the default), `governanceRigor: "auto" | "surgical" | "standard" | "architectural" | "off"`.

- [x] **T3.6 Wire routing into turn dispatch.**
      Seam S7. Files: extend `src/ipc/handlers/chat_mode_resolution.test.ts`-style test; impl in a new `src/governance/core/route_turn.ts` called from the chat stream pre-dispatch (find the seam where mode is resolved per turn; additive call).
      RED: `it("routes a benign prompt in plan mode to lean direct planning")`, `it("routes a secret-touching prompt to governed spec-first")` — assert returned `{ lane, tier, mode }`.
      GREEN: compose T3.1–T3.5. Store decision as a `governance_run` row (lane/tier) via T2.5.
      **Phase gate:** ts/lint/fmt + suites; commit.

### Phase 4 — Spec mode (Plan mode upgrade) (8 tasks)

- [x] **T4.1 Spec-mode prompt.**
      Seam S9. Files: `src/prompts/spec_mode_prompt.ts` + `src/prompts/spec_mode_prompt.test.ts`.
      RED: snapshot test — prompt instructs: gather via `planning_questionnaire`; then produce EARS stories (Given/When/Then criteria), MoSCoW priorities, `verificationContract` per criterion when objectively checkable (shell command exiting 0), notDoingList, risks; present via `write_spec`; only after user approval call `exit_plan`.
      GREEN: export `SPEC_MODE_SYSTEM_PROMPT`, wire where `PLAN_MODE_SYSTEM_PROMPT` is selected when `enableGovernance` (keep old prompt file untouched for non-governed path).
      Verify: snapshot written and committed.

- [x] **T4.2 `write_spec` tool — schema + persistence.**
      Seam S5. Files: tool `src/pro/main/ipc/handlers/local_agent/tools/write_spec.ts` (follow `run_build.ts` structure: zod input, `name`, `description`, `defaultConsent: "always"`, `modifiesState: true`, `buildXml`, `execute`), test colocated.
      RED: `it("persists a valid spec bundle draft and returns artifact version")` with fake ctx (`appId`, `appPath` = tmp dir) → bundle.json + requirements.md exist (reuse T1.6 store), drizzle row created (use the test-db harness), status `pending_approval`.
      GREEN: parse via zod; save; return summary string for the model.

- [x] **T4.3 `write_spec` — rejection path.**
      Same files. RED: `it("returns a validation error the model can fix when stories lack criteria")` — DyadError kind Validation, message lists the failing paths.
      GREEN: zod error formatting.

- [x] **T4.4 Register the tool.**
      Files: add `writeSpecTool` to `TOOL_DEFINITIONS` (`tool_definitions.ts:140`) and include-condition so it only appears in plan mode when governance on (mirror how `planningQuestionnaireTool` is gated — see `shouldIncludeTool`).
      RED: unit test on `buildAgentToolSet` asserting presence/absence per mode × setting.
      GREEN: wiring only.

- [x] **T4.5 Approval gate blocks execution.**
      Seam S4 + hybrid. Read `rules/hybrid-testing.md`. Files: `src/ipc/handlers/chat_stream_handlers.governance.integration.test.ts`.
      RED: `it("refuses an agent turn on a governed chat whose latest bundle is not approved")` — fake LLM harness, chat with pending bundle → turn errors with DyadError kind `Precondition` mentioning approval; same chat after `approveSpecBundle` → turn proceeds.
      GREEN: pre-dispatch check in the chat stream handler (additive, behind `enableGovernance` + lane === governed).
      Verify: integration test passes.

- [x] **T4.6 Spec diff engine.**
      Seam S1. Files: test + impl `src/governance/core/spec_diff.ts`.
      RED: `it("classifies added/removed/modified stories between bundle versions")` (match on `storyId`; modified = any criterion/narrative change); `it("renders a markdown diff")` containing `+ US-3` / `- US-2` / `~ US-1`.
      GREEN: `diffBundles(a, b)`, `renderSpecDiff(diff)`.

- [x] **T4.7 Approval UI panel.**
      Seam S10. Files: `src/components/governance/SpecReviewPanel.tsx` + colocated test. Base UI only (`rules/base-ui-components.md`). Shows stories/criteria/VERIFY commands, diff vs previous version, Approve / Reject-with-feedback buttons calling T2.4 IPC.
      RED: `it("renders criteria with their verification commands and wires approve")` (mocked hook).
      GREEN: component + mount into the chat right panel where plan review renders today (find the plan-mode plan display component and add a governed variant).

- [x] **T4.8 Reject → regenerate loop.**
      Same integration file as T4.5. RED: `it("a rejected bundle returns the chat to planning with feedback injected")` — next agent turn's message list contains the rejection feedback (assert on prepared messages via the harness).
      GREEN: on reject, append feedback message + set status draft.
      **Phase gate:** `npm run build` + one E2E smoke: plan-mode governed flow writes spec → approve → turn runs. Record result in `docs/plans/PROGRESS_LOG.md`.

### Phase 5 — Verification spine (9 tasks)

Reference: `ANVIL/anvil-macOS/Core/Verification/` (`VerificationContractRunner.swift`, `CriterionRedFirstProbe.swift`, `VerificationProofGate.swift`).

- [x] **T5.1 Contract extraction.**
      Seam S1. Files: test + impl `src/governance/verification/extract_contracts.ts`.
      RED: `it("flattens a bundle into criterion-keyed contracts")` → `[{ key: "US-1/AC-2", command: "npm test -- foo" }]`, skipping criteria without contracts (returned separately as `manual`).
      GREEN: pure flatten.

- [x] **T5.2 ContractRunner — execution.**
      Seam S3. Files: test + impl `src/governance/verification/contract_runner.ts`.
      RED: `it("runs a passing command to green and a failing one to red with output tail")` using real `sh` (`exit 0` / `exit 3` scripts in a tmp dir); `it("enforces a timeout")` with a `sleep 5` script and 100 ms limit → status `timeout`.
      GREEN: `runContracts(contracts, { cwd, timeoutMs, runCommand })` returning per-contract `{ status, exitCode?, outputTail, durationMs }`; tail capped at 4,000 chars.

- [x] **T5.3 ContractRunner — safety screen.**
      Same files. RED: `it("refuses commands outside the safe-command policy")` — deny list mirrors Warden patterns (`rm -rf`, `sudo`, `git push`, `curl | sh`, `chmod 777`, anything with `;` after `rm`), allow npm test/node/npx tsc/git diff.
      GREEN: `isSafeVerificationCommand(cmd)` checked before exec; DyadError kind `Validation` otherwise.

- [x] **T5.4 Red-first probe.**
      Same files (or `red_first.ts`). RED: `it("marks a criterion unproven when its command is already green before implementation")` — probe runs contracts at spec-approval time; already-green criteria get `redFirst: false` and are excluded from "verified" claims; `it("marks red-first criteria eligible")` when red pre-implementation.
      GREEN: `probeRedFirst(contracts, cwd)` — run at approval; persist results into `spec_verifications` with type `probe`.

- [x] **T5.5 `run_verifications` tool.**
      Seam S5. Files: tool `run_verifications.ts` + test. `defaultConsent: "ask"` (executes shell), `modifiesState: false`.
      RED: `it("runs all contracts for the approved bundle and reports per-criterion status")` — fake ctx with tmp app containing a passing + failing script; result string lists `US-1/AC-1 green`, `US-1/AC-2 red (exit 1)` + output tail; emits `<dyad-status title="Spec verification">` via `ctx.onXmlComplete` (read `rules/chat-message-indicators.md`).
      GREEN: tool wired into `TOOL_DEFINITIONS` (plan + agent modes, governance on).

- [x] **T5.6 Verified checkpoints.**
      Seam S4/S8. Files: extend `governance_handlers.test.ts`, impl.
      RED: `it("stamps a version as verified only when every red-first contract is green")` — after a governed run ends, coordinator links `spec_verifications` rows to the turn's version (`versions.id`) and returns `{ verified: true, criteriaCount, green, red }`; one red → `verified: false` and the turn-end summary must say so.
      GREEN: `stampVerification(runId, versionId)`.

- [x] **T5.7 Turn-end verification hook.**
      Seam S4. Files: extend the P4 integration test file.
      RED: `it("runs verifications automatically at governed turn end and includes the verdict in the final message")` (fake-LLM harness where the model writes a file satisfying the fixture contract).
      GREEN: coordinator call in turn finalization (additive, governed lane only).

- [x] **T5.8 VerificationBadge (UI).**
      Seam S10. Files: `src/components/governance/VerificationBadge.tsx` + test. Renders on the version/checkpoint row (find version list component): green check + criteria counts, or red with failing criterion keys.
      RED: `it("renders verified state and failing state from props")`.

- [x] **T5.9 Verification script export.**
      Seam S2. Files: extend `artifact_store` tests.
      RED: `it("exports standalone verify-*.sh scripts and an index")` — `.dyad/bin/verification-tasks.json`, `README.md`, one `verify-<story>-<criterion>.sh` per contract (format modeled on Anvil's export, see `ANVIL/.anvil/bin/`), runnable via `sh` in the test.
      GREEN: `exportVerificationScripts(root, bundle)`.
      **Phase gate:** build + E2E smoke: governed turn whose contract fails blocks the verified badge; passing run stamps green. Log to PROGRESS_LOG.md.

### Phase 6 — Councils & budget (8 tasks)

Reference: `ANVIL/anvil-macOS/Core/Critic/`, `AdversarialCouncilEngine` (3-round Delphi, razors), `ConfidenceHeuristicGate` (5 triggers), `TokenBudgetGovernor`.

- [x] **T6.1 Verdict aggregation.**
      Seam S1. Files: test + impl `src/governance/core/verdict_aggregator.ts`.
      RED: `it("classifies unanimous / majority / contested verdicts")` — 4 members all-fail → `unanimous-critical`; 3/4 → `majority`; 2/2 → `contested`; includes per-member critiques and a consensus score (fraction agreeing).
      GREEN: `aggregateVerdict(memberFindings)`.

- [x] **T6.2 Council engine — members via fake fetch.**
      Seam S6. Files: test + impl `src/governance/council/council_engine.ts`.
      RED: `it("runs a 3-round Delphi across configured members and returns an aggregated verdict")` using `setModelClientFetchForTesting` to return scripted JSON critiques per round; assert 3 rounds of fetches per member, cross-critique from round 2 includes round-1 text, output feeds T6.1.
      GREEN: members = provider/model pairs from settings (`councilMembers` default: architect=claude, pragmatist=openai/gpt, fact-checker=gemini, devils-advocate=xai — degrade gracefully to ≥2 available, else return `unavailable`).

- [x] **T6.3 Council razors in prompts.**
      Seam S9. Files: `src/prompts/council_prompts.ts` + snapshot test. Each member's system prompt embeds its razor set (YAGNI, Occam, Chesterton's Fence, Inversion, Pre-Mortem distributed per Anvil) and demands JSON `{ findings: [{ severity, claim, evidence }] }`.

- [x] **T6.4 `convene_council` tool.**
      Seam S5. Files: tool + test; `defaultConsent: "ask"` (expensive), `modifiesState: false`.
      RED: `it("convenes the council on a question and persists the verdict")` (fake fetch; verdict row in `council_verdicts` table — add table in this task following T2.1 pattern + migration).

- [x] **T6.5 Heuristic gate triggers v1.**
      Seam S1. Files: test + impl `src/governance/core/heuristic_gate.ts`.
      RED: `it("fires on split council verdicts")`; `it("fires on scope expansion when the diff exceeds N× the planned file count")` (inputs: planned scope {files}, actual diff stats; factor 2 default); `it("does not fire on clean small diffs")`.
      GREEN: `evaluateGateTriggers({ verdict, plannedScope, diffStats })` → `{ triggers: [...], blocking: boolean }`.

- [x] **T6.6 Budget governor.**
      Seam S1. Files: test + impl `src/governance/core/budget_governor.ts`.
      RED: `it("accumulates usage and halts at the ceiling")` — `record({input, output, costUsd})` ×n → third record past ceiling throws `DyadError` kind `BudgetExceeded` (add kind per `rules/dyad-errors.md`); `it("computes remaining budget")`.
      GREEN: class; default ceiling from settings (`governanceBudgetUsd`, default $5/run; read `rules/adding-settings.md`).

- [x] **T6.7 Wire gate + budget into governed runs.**
      Seam S4. Files: extend integration test.
      RED: `it("pauses a run with a blocking gate and resumes on user resolution")` — harness produces a split verdict → run status `gate_open`, downstream turn blocked; approving resolution resumes.
      GREEN: coordinator consumes T6.5/T6.6; run events logged via T2.5.

- [x] **T6.8 Council cost estimate up front.**
      Seam S1. Files: extend budget test. `estimateCouncilCost(members, rounds, avgTokens)` → USD range; surfaced in the `convene_council` consent preview (`getConsentPreview`).
      **Phase gate:** ts/lint/fmt; integration suites green; commit.

### Phase 7 — Project memory (6 tasks)

Reference: `ANVIL` `ProjectMemoryStore` (3 tiers, 5 categories: auditHistory, userDecision, styleInference, errorPattern, architecturalDecision; importance × recency).

- [x] **T7.1 Memory table + store CRUD.**
      Seam S8. Files: `memory_items` table (add migration), `src/governance/memory/memory_store.ts` + test.
      RED: insert/read/update-importance/delete round-trip; fields: `id, appId, namespace, tier("short"|"medium"|"long"), category, body, importance(0–10), expiresAt?, createdAt, updatedAt, lastAccessedAt`.

- [x] **T7.2 Eviction sweep.**
      Same files. RED: `it("evicts expired medium-tier items and never evicts long-tier")` — seed with past/future expiry, run `sweepExpired()`, assert.
      GREEN: delete-where query; call site scheduled lazily on store access (no timer in tests).

- [x] **T7.3 Ranking.**
      Seam S1. Files: test + impl `src/governance/core/memory_ranking.ts`.
      RED: `it("ranks by importance × recency decay")` — item A importance 9 age 30d vs B importance 5 age 1h → order depends on decay half-life 7d; exact expected order computed from a worked example in the test (independent source of truth: hand-computed numbers, not the formula).
      GREEN: `rankMemories(items, now)`.

- [x] **T7.4 `record_memory` tool.**
      Seam S5. Files: tool + test, `defaultConsent: "always"` for `userDecision`/`styleInference`, `"ask"` otherwise.
      RED: `it("stores a memory with tier and category validation")`; `it("rejects unknown categories")`.

- [x] **T7.5 Turn-start injection.**
      Seam S5/S4. Files: extend `prepare_step_utils` additively (`buildMemoryContextMessage`) + integration test.
      RED: `it("injects the top-N ranked memories as a system-side message on governed turns")` (N=10, cap 2,000 chars) — assert present in prepared messages, absent on lean turns.
      GREEN: message builder + call in prepare step (governed lane only).

- [x] **T7.6 Post-run learning hook.**
      Same integration file. RED: `it("records an errorPattern memory when a governed run fails verification")` — failing T5 run leaves a memory row with the failing criterion keys.
      **Phase gate:** ts/lint/fmt; suites; commit.

### Phase 8 — Multi-runtime dispatch (8 tasks)

Reference: `ANVIL/anvil-macOS/Core/AgentBackend/` (protocol + registry + `SkillMaterializer` + `SessionResumptionStore`). Read `rules/windows-spawn.md` before any spawn code.

- [x] **T8.1 Backend protocol + builtin passthrough.**
      Seam S1-ish (interface + fake). Files: `src/governance/backends/types.ts`, `builtin_backend.ts` + test.
      RED: `it("dispatches via the builtin backend and emits typed events")` — interface `GovernedBackend.dispatch(task): AsyncStream<BackendEvent>`; builtin wraps a fake executor; events `started|output|completed|failed`.

- [x] **T8.2 CLI detection.**
      Seam S3 (process). Files: `src/governance/backends/cli_detect.ts` + test with injected `runCommand`.
      RED: `it("detects claude/codex binaries and validates semver minimums")` (claude ≥2.0.0, codex ≥0.100.0 — parse `--version` outputs; missing → unavailable; cache 5 min).

- [x] **T8.3 Claude Code backend.**
      Seam S3/S6. Files: `claude_code_backend.ts` + test with fake process.
      RED: `it("spawns claude with stream-json prompt and parses event stream")` — assert argv (`--print`, `--output-format`, `stream-json`, `--resume` when session id exists), env sanitization, event translation; timeout enforcement test.

- [x] **T8.4 Codex backend.**
      Same pattern. RED: JSON-RPC over stdio framing parse/serialize round-trip; dispatch → events.

- [x] **T8.5 Skill materializer.**
      Seam S2. Files: `skill_materializer.ts` + test.
      RED: `it("writes SKILL.md files to provider skill dirs and cleans up after")` — claude `.claude/skills/<id>/SKILL.md`, codex `.codex/skills/...`; YAML frontmatter escaped (injection attempt with `---` and quotes is neutralized); cleanup via defer-equivalent finally.

- [x] **T8.6 Session resumption store.**
      Seam S2. Files: `session_resumption.ts` + test.
      RED: `it("stores and resumes CLI sessions with TTL")` — save `{backend, sessionId, cwd}`, lookup within 24h, expired → null; file perms 0600 (`mode` assert via stat).

- [x] **T8.7 Registry + tier routing.**
      Seam S1. Files: `registry.ts` + test.
      RED: `it("routes architectural tier to builtin always")`; `it("routes standard/surgical to the highest-scoring available backend")` (scores injected); fallback on unavailable.

- [x] **T8.8 Dispatch integration.**
      Seam S4. Files: extend integration tests with a fake external backend injected through the registry.
      RED: `it("executes a governed task through an external backend and records lifecycle events")` (hooks into run events T2.5).
      **Phase gate:** ts/lint/fmt; suites; commit.

### Phase 9 — DAG orchestration & worktrees (8 tasks) — **CORD-CUT PHASE**

Reference: `ANVIL` `TaskGraphOrchestrator`, `BackPressurePolicy` (max 4 runners), `WorktreeIsolator`. Dyad already has the hard part: `createBuildWorktree` in `src/pro/main/ipc/handlers/local_agent/tools/run_build.ts:823` (git worktree + overlay + submodule handling).

- [x] **T9.1 Task graph model + topo order.**
      Seam S1. Files: test + impl `src/governance/core/task_graph.ts`.
      RED: `it("orders nodes topologically and rejects cycles")`; `it("computes ready set as nodes with all deps completed")`.

- [x] **T9.2 Backpressure.**
      Same files. RED: `it("caps concurrent runners at 4 and admits queued nodes on completion")` — simulated executor, assert max observed concurrency and final order respects deps.

- [x] **T9.3 Extract worktree isolation utility.**
      Files: new `src/ipc/utils/app_worktree.ts` that re-exports/wraps `createBuildWorktree`/`removeSnapshot` (no behavior change; run_build.ts imports from the new module — mechanical move, existing run_build tests must stay green untouched).
      Verify: `npm test -- src/pro/main/ipc/handlers/local_agent/tools/run_build*` (existing suite name — grep it) unchanged-green.

- [x] **T9.4 Orchestrator happy path.**
      Seam S1+fake. Files: `src/governance/runs/dag_orchestrator.ts` + test with injected backend + injected worktree factory.
      RED: `it("executes a 3-node DAG with isolation, merges results, and emits run events")` — each node gets a worktree (factory returns tmp dirs), results merged in topo order, conflict → surfaced.

- [x] **T9.5 Failure + partial continuation.**
      Same files. RED: `it("fails downstream of a failed node but completes independent subtrees")`; `it("halts the whole run when the budget governor throws")`.

- [x] **T9.6 Manifest → DAG compiler.**
      Seam S1. Files: `src/governance/core/manifest_to_graph.ts` + test. RED: `it("compiles an approved bundle's task manifest into a graph with traceability")` — task→story links preserved on nodes.

- [x] **T9.7 RunTimeline UI.**
      Seam S10. Files: `src/components/governance/RunTimeline.tsx` + test — node states (pending/running/green/red/blocked), event stream consumption via IPC subscription.
      RED: `it("renders node states from a run snapshot")`.

- [x] **T9.8 Cord-cut record.**
      Files: append to `GOVERNANCE_FORK.md`: divergence commit hash, date, last absorbed upstream commit. From here on: no rebase; upstream changes are cherry-picked by need.
      **Phase gate:** `npm run build` + E2E smoke of a 2-node governed run (fake backend acceptable via env flag).

### Phase 10 — Incubation & thoughts (6 tasks)

Reference: `ANVIL` `[INCUB]` (Ideate→Specify→Challenge→Commit→Build; `CommittedHypothesis`), `[CART]` ThoughtStore (v1: concept tags only, no embeddings).

- [x] **T10.1 Incubation state machine.**
      Seam S1. Files: test + impl `src/governance/core/incubation_state.ts`.
      RED: allowed transitions Ideate→Specify→Challenge→Commit→Build, regression allowed one stage back, invalid jumps rejected; `CommittedHypothesis` payload requires `problem, hypothesis, successCriteria`.

- [x] **T10.2 Incubation session persistence.**
      Seam S2. Files: extend artifact store — `.dyad/incubation/sessions/<id>/session.json` + `transcript.md`; RED: save/load round-trip + append-transcript.

- [x] **T10.3 Hypothesis → spec bridge.**
      Seam S1. Files: test + impl `src/governance/core/hypothesis_to_spec.ts`.
      RED: `it("seeds a spec bundle draft from a committed hypothesis")` — rawIntent from problem, first story from successCriteria (criteria become EARS criteria without contracts), status draft.

- [x] **T10.4 Thoughts table + capture.**
      Seam S8. Files: `thoughts`, `thought_edges` tables + `src/governance/memory/thought_store.ts` + test — CRUD, tag filter, todo status transitions (`promoteToTodo`, `markDone`).

- [x] **T10.5 Constellation detection.**
      Seam S1. Files: `src/governance/core/constellations.ts` + test. RED: ≥3 thoughts sharing ≥2 tags with pairwise overlap ≥ threshold → one constellation with dominant tags; below → none.

- [x] **T10.6 Thought panel (minimal).**
      Seam S10. Files: `src/components/governance/ThoughtPanel.tsx` + test — quick capture (⌘⏎), All/Todo/Tags tabs, promote-to-incubation button calling T10.3 via IPC.
      **Phase gate:** ts/lint/fmt; suites; commit.

### Phase 11 — Headless & autopilot (6 tasks)

Reference: `ANVIL` `AnvilCoreSDK`, `RPCServer` (unix socket JSON-RPC), `HeadlessPRDRun`, `anvilctl`, `AutopilotDaemon`.

- [ ] **T11.1 Engine callable without Electron.**
      Files: refactor-coating only — ensure `src/governance/**` imports no `electron` (write a lint-style unit test: scan files for `from "electron"` and fail if found in `src/governance/`).
      RED: the scan test fails on first run if any import exists (fix by injection until green).

- [ ] **T11.2 `dyadctl` CLI entry.**
      Files: `scripts/dyadctl.mjs` (node, no electron) + test invoking it as a subprocess: commands `run --app <dir> --prompt <str|-> --json` → executes a governed run headlessly (builtin backend, local model config from env) and prints `{ status, verifications, versions }`.
      RED: subprocess test against a fixture Vite app with one passing contract.

- [ ] **T11.3 Unix-socket RPC server.**
      Seam S3. Files: `src/governance/headless/rpc_server.ts` + test — JSON-RPC `initialize|execute|status|shutdown` over `node:http` on a tmp socket path; owner-only perms (stat mode 0o700); 1 MB request cap.

- [ ] **T11.4 RPC ↔ engine wiring.**
      Same files. RED: `execute` starts a governed run (injected fakes) and `status` reports run state transitions.

- [ ] **T11.5 GitHub issue intake.**
      Seam S3 (exec gh). Files: `src/governance/headless/issue_intake.ts` + test with injected runCommand. RED: fetches issue title/body via `gh issue view --json`, maps to `ProjectIntentBundle` (rawIntent + metadata).

- [ ] **T11.6 Autopilot loop (PR out).**
      Same files. RED: `it("turns an issue into a branch, governed run, and a draft PR")` — injected gh/git commands asserted in order (branch, commit, push, `gh pr create --draft`); failure path → PR body contains verification report.
      **Phase gate:** full `npm test`; `npm run build`; commit.

### Phase 12 — Hostinger/Coolify + strip-down (6 tasks)

- [ ] **T12.1 Coolify-on-VPS validation runbook.**
      Files: `docs/plans/hostinger-coolify-runbook.md` — manual: install Coolify on the Hostinger VPS, point Dyad's Coolify setup (`src/coolify_setup/`) at it, deploy one fixture app, custom domain. Record every gap hit.

- [ ] **T12.2 Fix the first gap found.** (Placeholder — becomes a concrete TDD task from T12.1 findings; if no gap, close as no-op with evidence.)

- [ ] **T12.3 Generic Postgres decision memo.**
      Files: `docs/plans/self-hosted-postgres.md` — audit `src/neon_admin/`, `get_neon_project_info` tool, `DATABASE_URL` flows; decide: (a) keep Neon, (b) generic-Postgres integration. If (b): spawn a follow-up plan (do not wing it here).

- [ ] **T12.4 Strip telemetry.**
      Files: replace PostHog calls with a no-op shim preserving exports (grep `posthog` across src). RED first: a unit test asserting the shim's `sendTelemetryEvent` resolves without network. Existing tests must stay green.

- [ ] **T12.5 Strip quota/auto-update gates.**
      Files: free-quota handlers + auto-update wiring. RED: tests asserting quota endpoints return unlimited and update check is a no-op behind `GOVERNANCE_FORK` flag. Do not delete files — no-op them (cheaper, reversible).

- [ ] **T12.6 Program close-out.**
      `npm run ts && npm run lint && npm run fmt && npm test && npm run build` all green; update `GOVERNANCE_FORK.md` with final state; mark every box in this file; write a retro in `docs/plans/PROGRESS_LOG.md`.

---

## 5. Dependency graph

```
P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7        (spine; strictly ordered)
                     P4 → P8 → P9 (cord-cut) → P11
                          P9 → P10
P12 anytime after P5 (T12.4/T12.5 best post-cord-cut)
```

P6 and P7 can swap. P8 can start after P4 (needs runs + events only). Nothing in P1–P8 touches existing behavior outside additive calls — that is what keeps rebase alive until P9.

## 6. Risks & mitigations

| Risk                                     | Mitigation                                                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Flash drifts from test-first             | §1.1 loop + commit message must reference task id; review diffs for test-after-code                       |
| Tautological tests (recompute like impl) | Fixture values must come from hand-worked examples or Anvil's real artifacts, never from running the impl |
| Cost blowup from councils/probes         | Budget governor (T6.6) ships before council wiring (T6.7); consent-gated `convene_council`                |
| Migration conflicts on rebase            | Additive tables only; never edit existing migrations                                                      |
| Windows CLI spawn breakage               | `rules/windows-spawn.md` read gate in P8/P11; `.cmd` resolution in T8.2                                   |
| Scope creep into Dyad core               | Every task lists exact files; anything else → BLOCKED.md                                                  |

## 7. Definition of done (program)

1. All checkboxes green; `npm test` suite green on macOS.
2. A governed chat end-to-end: intent → EARS spec → approval → implementation (builtin or CLI backend) → red-first-aware verification → verified checkpoint badge → memory recorded.
3. `sh .dyad/bin/verify-*.sh` runs standalone against an app produced by the fork.
4. `scripts/dyadctl.mjs run` completes a headless governed run on a fixture app.
5. One real app deployed to the Hostinger VPS through Coolify from the fork.
6. `GOVERNANCE_FORK.md` records license basis, cord-cut point, and known deltas vs upstream.
