# Governance Merge — Phases 5–12 Execution Plan (fresh-session, Flash-executable)

**Program parent:** `docs/plans/2026-09-12-governance-merge-tdd-plan.md` (the source of truth — this
document decomposes its remaining tasks, §4 T5.1–T12.6, into Flash-sized steps and bakes in every
lesson from the Phases 0–4 sessions). **Handoff protocol:**
`docs/plans/governance-merge/HANDOFF.md`. **Executor:** GLM 5.3 Flash, one task at a time.

**Execution repo (all edits):** `/Users/amar/Desktop/MyCode/dyad`, branch `governance/main`
(also merged into `main`; keep committing on `governance/main`).
**Reference repo (READ-ONLY):** `/Users/amar/Desktop/MyCode/anvil_opencode` (`ANVIL/`).
Never edit/compile/run ANVIL. Artifact home: `.dyad/` inside each app dir.

---

## 0. Session preflight (do these before T5.1; exact commands)

```sh
cd /Users/amar/Desktop/MyCode/dyad
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"   # node 24 REQUIRED (engines >=24 <26)
export TMPDIR=/tmp/dyad-tmp && mkdir -p "$TMPDIR"            # sandbox denies /var/folders writes
node --version   # must print v24.18.0
ls node_modules/.bin/oxfmt   # if missing: npm install, then npm rebuild better-sqlite3 electron dugite
npm --prefix testing/fake-llm-server install 2>&1 | tail -1  # else npm run ts fails on express types
git status --porcelain       # expect only `?? graphify-out/` (machine-generated; NEVER stage it)
git branch --show-current    # expect governance/main
```

Resume order: (1) `docs/plans/BLOCKED.md` if it exists — a blocked task must not be re-attempted
unless the note says the owner cleared it; (2) first unchecked task below; (3) cross-check
`git log --oneline -30` (commits are `gov(T<id>): …`); (4) `docs/plans/PROGRESS_LOG.md`.

**Build gate note:** `npm run build` needs the Bash sandbox disabled (use the unsandboxed flag).
If Forge fails with `EPERM ... ~/Library/Caches/electron/.../electron-v40.0.0-darwin-arm64.zip`,
delete that cached zip and rebuild — a sandboxed install corrupted it once.

## 1. Execution protocol (non-negotiable)

The loop for EVERY task, in order:

1. **RED** — write/extend ONLY the test file(s) the task lists. Write exactly the named test with
   the exact expected values given here (they are hand-worked — never derive expected values by
   running the implementation). Run `npm test -- <test-file>` (with the two env exports above).
   It must FAIL for the asserted reason. If it passes, your test is wrong — fix the test.
2. **GREEN** — minimum code, in the listed files only, to pass. No speculative params/branches.
3. **VERIFY** — the task's verify commands, then `npm run ts` (exit 0 required).
4. **COMMIT** — tick the task's checkbox in the PARENT plan file
   (`docs/plans/2026-09-12-governance-merge-tdd-plan.md`) in the same commit, then:
   `npm run fmt && npm run lint && git add <exact task files> <plan file> && git commit -m "gov(<id>): <title>"`.
   Stage files EXPLICITLY (never `git add -A` — `graphify-out/` must never be committed).

**TDD doctrine (from the tdd skill):** tests live only at the pre-agreed seams (registry below).
No tautological tests; no mocking the thing under test; no horizontal slicing — one test → one
implementation → repeat; refactoring is NOT part of the loop.

**Stop conditions (write `docs/plans/BLOCKED.md`, commit it, end session with a summary):**

1. Test not green after 3 focused attempts (each attempt changes exactly one thing).
2. `npm run ts` errors in files the task did not list.
3. A new npm dependency seems required (none are).
4. An existing test breaks for a reason unrelated to the new behavior — EXCEPT the documented
   pre-existing failures in Appendix A, which are never yours to fix.
5. Any instruction conflicts with `AGENTS.md`, `rules/`, or the parent plan.

**Rules files to read before each area:** P5/P7 → `rules/dyad-errors.md`; new IPC (S4 tasks) →
`rules/electron-ipc.md`; DB tables → `rules/database-drizzle.md`; agent tools →
`rules/local-agent-tools.md`; P8/P11 spawns → `rules/windows-spawn.md`; UI →
`rules/base-ui-components.md`, `rules/ui-styling.md`; settings fields → `rules/adding-settings.md`.

**Known lint noise (do NOT "fix"):** oxlint `no-thenable` warnings on EARS `then:` object keys —
pre-existing warning class, warnings only, 0 errors expected.

## 2. Seam registry (tests ONLY here — from parent plan §2)

| #   | Seam                  | Where                                                                                                                             | Style                            |
| --- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| S1  | Pure governance logic | exported fns in `src/governance/**` (no electron, no node:fs)                                                                     | table-driven, zero mocks         |
| S2  | ArtifactStore         | `src/governance/artifacts/artifact_store.ts`                                                                                      | fs against `fs.mkdtemp` tmp dirs |
| S3  | Process runners       | injected `runCommand` (default real)                                                                                              | real `sh` vs tmp fixtures        |
| S4  | IPC handlers          | `getRegisteredHandlerForTesting` (`src/ipc/handlers/base.ts`) + `setupHandlerTestHarness` (`src/testing/handler_test_harness.ts`) | registered-handler tests         |
| S5  | Agent tools           | `execute(args, ctx)` with hand-built `AgentContext`                                                                               | unit + fake ctx                  |
| S6  | LLM callers           | `setModelClientFetchForTesting` (`src/ipc/utils/test_fetch_override.ts`)                                                          | fake-fetch                       |
| S7  | Turn routing          | pure/injected `route_turn.ts`                                                                                                     | unit                             |
| S8  | Drizzle stores        | real sqlite via `createInMemoryTestDb()` (`src/testing/test_db.ts`)                                                               | integration-style unit           |
| S9  | Prompts               | `src/prompts/*.ts`                                                                                                                | snapshot                         |
| S10 | Renderer              | React render, mocked IPC client                                                                                                   | colocated `*.test.tsx`           |

E2E (Playwright) only at phase gates. Chat-flow integration tests use
`setupChatFlowHarness` — see `src/testing/CHAT_FLOW_HARNESS.md` (copy its preamble verbatim).

## 3. Existing code you will reuse (exact exports, verified)

- `src/governance/core/spec_bundle_schemas.ts`: `SpecBundleSchema`, `parseSpecBundle(json)` (accepts
  object or JSON string), `serializeSpecBundle`, `nextApprovalStatus`, types `SpecBundle`,
  `UserStory`, `EarsCriterion`, `ApprovalStatus`, `ApprovalEvent`.
- `src/governance/artifacts/artifact_store.ts`: `class ArtifactStore { constructor(root);
saveBundle(bundle): Promise<SpecBundle /* version-stamped */>; loadBundle(); listHistory():
Promise<{version, bundle}[]> }` — saves `.dyad/specs/bundle.json` + `requirements.md` + history.
- `src/governance/core/{lane_screen,rigor_tiers,route_turn,spec_diff,requirements_markdown}.ts`.
- `src/ipc/handlers/governance_handlers.ts`: handlers for save/get/history/approve +
  `appendRunEvent(runId, type, payload)` (exported). App paths MUST go through
  `getDyadAppPath(app.path)` (raw `apps.path` is often relative — this bug bit us once).
- DB tables in `src/db/schema.ts`: `specBundles, specStories, acceptanceCriteria, governanceRuns,
governanceRunEvents, specVerifications` (+ `apps, chats, messages, versions`).
- `src/ipc/contracts/governance_contracts.ts`: uses `defineContract`/`createClient` from
  `../contracts/core` **with RELATIVE imports only** (`../../governance/...`) — the preload Vite
  target cannot resolve `@/` aliases. It is imported once into `src/ipc/preload/channels.ts`, so
  new channels in the same object auto-allowlist.
- Settings: `enableGovernance` (optional bool, default true), `governanceRigor` (optional enum) in
  `src/lib/schemas.ts` + `DEFAULT_SETTINGS` (`src/main/settings.ts`). New fields ⇒ regenerate the
  two inline snapshots: `npm test -- src/main/settings.test.ts -u`, then confirm the diff only
  adds your keys.
- Tool registration: `src/pro/main/ipc/handlers/local_agent/tool_definitions.ts` —
  `TOOL_DEFINITIONS` array, `PLAN_MODE_ONLY_TOOLS`, `PLANNING_SPECIFIC_TOOLS` sets,
  `BuildAgentToolSetOptions.enableGovernance`, and the `shouldIncludeTool` gate pattern
  (`if (tool.name === "write_spec" && options.enableGovernance !== true) return false;`).
  **Production wiring point:** `src/pro/main/ipc/handlers/local_agent/local_agent_handler.ts`
  `const buildOptions = { … enableGovernance: settings.enableGovernance ?? true, }` (the estimator
  call site in tool_definitions.ts also passes it — keep both in sync).
- `AgentContext` (`tools/types.ts`): has `appId, appPath, chatId, event` and
  `onXmlComplete(finalXml)` (line ~203) for `<dyad-status>` emission.
- Turn dispatch: `src/ipc/handlers/chat_stream_handlers.ts` — governed routing block right after
  `assertChatModeCompatibleWithModel(...)` (holds `governanceDecision.lane`), the approval gate
  right after it, `let systemPrompt = constructSystemPrompt({` (~line 2191), and the
  local-agent stream calls at ~2667/2722/2750/2782.
- E2E: `e2e-tests/governance_spec_flow.spec.ts` + fixture
  `e2e-tests/fixtures/engine/local-agent/governance-write-spec.ts` (LocalAgentFixture format).
  Run: `npx playwright test e2e-tests/<file> --timeout=120000` (unsandboxed, after `npm run build`).
- `getModelClient` lives in `src/ipc/utils/get_model_client.ts`; the S6 override is
  `setModelClientFetchForTesting` in `src/ipc/utils/test_fetch_override.ts`.

---

# Phase 5 — Verification spine (T5.1–T5.9). Reference: `ANVIL/anvil-macOS/Core/Verification/`

### T5.1 Contract extraction

Files: impl `src/governance/verification/extract_contracts.ts`, test `…/extract_contracts.test.ts` (create both). Seam S1.
RED: `it("flattens a bundle into criterion-keyed contracts")` — hand-build a bundle stories array
(not the fixture): `US-1` with `AC-1` (verificationContract `"npm test -- foo"`), `AC-2`
(`"test -f package.json"`), `AC-3` (no contract); `US-2` with `AC-1` (no contract). Assert
`extractContracts({ stories } as any)` returns exactly
`{ executable: [{ key: "US-1/AC-1", command: "npm test -- foo" }, { key: "US-1/AC-2", command: "test -f package.json" }], manual: [{ key: "US-1/AC-3" }, { key: "US-2/AC-1" }] }`.
GREEN: pure function, keys are `${story.id}/${criterion.id}`; criteria without contracts go to
`manual`. Export types `VerificationContract { key; command }`, `CriterionRef { key }`.
Verify: `npm test -- src/governance/verification/extract_contracts.test.ts`. Commit `gov(T5.1): Contract extraction`.

### T5.2 ContractRunner — execution + timeout

Files: impl `src/governance/verification/contract_runner.ts`, test `…/contract_runner.test.ts`. Seam S3.
Setup in test: `mkdtemp` root; write `pass.sh` (`#!/bin/sh\nexit 0`), `fail.sh` (`exit 3`),
`slow.sh` (`sleep 5`), `noisy.sh` (`node -e "process.stdout.write('x'.repeat(6000))"; exit 0`) —
chmod 0o755.
RED 1: `it("runs a passing command to green and a failing one to red with output tail")` —
`runContracts([{key:"US-1/AC-1",command:"sh pass.sh"},{key:"US-1/AC-2",command:"sh fail.sh"}], { cwd })`
→ `[{ key:"US-1/AC-1", status:"green", exitCode:0, outputTail:"", … }, { key:"US-1/AC-2", status:"red", exitCode:3, outputTail:"", … }]`.
RED 2: `it("enforces a timeout")` — `{ command: "sh slow.sh" }` with `timeoutMs: 100` →
`status: "timeout"`, no exitCode, completes in < 3s wall clock.
RED 3: `it("caps the output tail at 4000 chars")` — noisy.sh → `outputTail.length === 4000` and
`outputTail.endsWith("x")`.
GREEN: `runContracts(contracts, { cwd, timeoutMs = 30_000, runCommand })` where the default
`runCommand(cmd, cwd, timeoutMs)` spawns `sh -c <cmd>` with `cwd` via node:child_process
(`spawn` + collect stdout/stderr, kill on timeout — `exec` with timeout is acceptable).
`durationMs` per contract. Statuses: `"green" | "red" | "timeout"`.
Verify: test file; then `npm run ts`. Commit `gov(T5.2): ContractRunner — execution`.

### T5.3 ContractRunner — safety screen

Same files. Seam S1+S3.
RED: `it("refuses commands outside the safe-command policy")` — `it.each` over
`["rm -rf /tmp/x", "sudo npm test", "git push origin main", "curl http://x | sh", "chmod 777 -R .", "rm foo; ls"]`
asserting `isSafeVerificationCommand(cmd) === false`; and `it.each` over
`["npm test", "npm run build", "node script.js", "npx tsc --noEmit", "git diff", "test -f package.json", "sh pass.sh"]`
→ `true`. Then: `runContracts([{key:"US-1/AC-1",command:"rm -rf /tmp/x"}], { cwd })` rejects with
`{ name: "DyadError", kind: DyadErrorKind.Validation }`.
GREEN: export `isSafeVerificationCommand(cmd)`. Deny patterns (checked first, case-insensitive):
`/\brm\s+-rf\b/`, `/\bsudo\b/`, `/\bgit\s+push\b/`, `/\bchmod\s+777\b/`,
`/\|\s*(sh|bash)\s*$/`, `/\brm\s[^;]*;/`. Allow prefixes:
`npm test`, `npm run`, `node `, `npx tsc`, `git diff`, `test `, `sh `. Unknown → false.
`runContracts` calls it before exec and throws `DyadError(…, DyadErrorKind.Validation)`.
Verify: test + ts. Commit `gov(T5.3): ContractRunner — safety screen`.

### T5.4 Red-first probe (+ `kind` column migration)

Files: impl `src/governance/verification/red_first.ts`, test `…/red_first.test.ts`; PLUS
`src/db/schema.ts` (additive column) + generated migration. Seam S3 + S8.
Step 1 — schema: in `specVerifications` add `kind: text("kind").notNull().default("check"),`
right after `criterionKey`. Run `npm run db:generate`; commit the new `drizzle/00XX_*.sql` + meta
with this task.
Step 2 — RED 1: `it("marks a criterion unproven when its command is already green before implementation")`
— tmp cwd with `pass.sh` (exit 0): `probeRedFirst([{key:"US-1/AC-1",command:"sh pass.sh"}], { cwd })`
→ `[{ key:"US-1/AC-1", redFirst: false, status: "green" }]`.
RED 2: `it("marks red-first criteria eligible")` — `fail.sh` → `{ redFirst: true, status: "red" }`.
RED 3 (S8): `it("persists probe results with kind probe")` — in-memory db + governance run row;
`recordProbe(runId, results)` inserts `spec_verifications` rows `{ runId, criterionKey: key,
status: "probe-green" | "probe-red", kind: "probe" }` (exitCode/outputTail null).
GREEN: `probeRedFirst(contracts, { cwd, timeoutMs, runCommand })` reuses `runContracts`
(timeout/red → redFirst true; green/timeout? — timeout counts as red, i.e. `redFirst: true`).
`recordProbe(runId, results)` uses the global `db` proxy.
Verify: both test files + `npm test -- src/db/governance_schema.test.ts` (must stay green) + ts.
Commit `gov(T5.4): Red-first probe`.

### T5.5 `run_verifications` tool

Files: tool `src/pro/main/ipc/handlers/local_agent/tools/run_verifications.ts` + colocated
`run_verifications.spec.ts`; wiring lines in `tool_definitions.ts`. Seam S5.
Test ctx: real tmp app dir with a saved pending→approved bundle — build it with `ArtifactStore`
(`parseSpecBundle` of the fixture, approvalStatus `"approved"`) plus `apps`+`chats` rows via
`createInMemoryTestDb()` + `setDatabaseForTesting` (copy the setup from
`write_spec.spec.ts`, including the `chatId` seed — FK constraint needs it). Give the bundle one
story `US-1` whose criteria you rewrite to: `AC-1` contract `test -f package.json` (the fixture
app tmp dir contains `package.json`? NO — tmp dir is empty; write `package.json` into it in the
test) and `AC-2` contract `test -f missing.txt`.
RED: `it("runs all contracts for the approved bundle and reports per-criterion status")` —
`execute({} as never, ctx)` resolves to a string containing `US-1/AC-1 green` and
`US-1/AC-2 red`; `ctx.onXmlComplete` (vi.fn) received xml containing
`title="Spec verification"`; and the harness db has 2 `spec_verifications` rows
`kind: "check"` (one green exitCode 0, one red).
GREEN: ToolDefinition `name: "run_verifications"`, zod input `z.object({}).passthrough()` or
`z.object({})` (no args), `defaultConsent: "ask"`, `modifiesState: false`, `getConsentPreview: () => "Run the spec verification contracts"`,
`buildXml` optional (status emitted via onXmlComplete). `execute`: load bundle via
`ArtifactStore(ctx.appPath).loadBundle()`; refuse with DyadError Precondition
(`"spec bundle is not approved"`) unless `bundle.approvalStatus === "approved"`; then
`extractContracts`; `runContracts(executable, { cwd: ctx.appPath })`;
persist rows `kind:"check"` tied to the latest `governanceRuns` row for the chat (create one if
none, lane governed/tier standard/status running); call
`ctx.onXmlComplete('<dyad-status title="Spec verification" state="' + (all green ? 'complete' : 'error') + '">' + lines.join(" ") + '</dyad-status>')`;
return the human summary lines `US-1/AC-1 green`, `US-1/AC-2 red (exit 1)` + first 200 chars of
the failing tail.
WIRING: add `runVerificationsTool` to `TOOL_DEFINITIONS` (NOT to plan-mode-only sets), and in
`shouldIncludeTool`: `if (tool.name === "run_verifications" && options.enableGovernance !== true) return false;`
(build profile auto-excludes it; plan mode keeps it because planModeOnly only drops
state-modifying tools and this one isn't).
Verify: `npm test -- src/pro/main/ipc/handlers/local_agent/tools/run_verifications.spec.ts` +
`npm test -- src/pro/main/ipc/handlers/local_agent/tool_definitions.governance.test.ts` + ts.
Commit `gov(T5.5): run_verifications tool`.

### T5.6 Verified checkpoints — `stampVerification`

Files: extend `src/ipc/handlers/governance_handlers.test.ts`; impl adds to
`src/ipc/handlers/governance_handlers.ts`. Seam S4/S8.
RED: new describe in the handler test (uses `setupHandlerTestHarness` + an app row):
`it("stamps a version as verified only when every red-first contract is green")` —
seed run row + probe rows (`kind:"probe"`, statuses: `US-1/AC-1 probe-red`, `US-1/AC-2 probe-green`)

- check rows (`US-1/AC-1` green, `US-1/AC-2` green, `kind:"check"`, versionId null) +
  a `versions` row (insert via `db.insert(versions).values({ appId, … })` — copy required
  non-null fields from `src/db/schema.ts` lines ~450+). Call exported
  `stampVerification(runId, versionId)` → `{ verified: true, criteriaCount: 2, green: 2, red: 0 }`;
  check rows now have `versionId` set.
  `it("returns verified false when one red-first contract is red")` — check rows: AC-1 red →
  `{ verified: false, …, red: 1 }`.
  `it("returns verified false when no red-first criteria exist")` — only probe-green rows →
  `verified: false, criteriaCount: 0`.
  GREEN: exported `stampVerification(runId, versionId)`: `redFirstKeys` = probe rows with
  `probe-red` status; `verified = redFirstKeys.length > 0 && every redFirstKey has a green check row`;
  update check rows' `versionId`; return counts over check rows.
  Verify: handler test + ts. Commit `gov(T5.6): Verified checkpoints`.

### T5.7 Turn-end verification hook

Files: extend `src/ipc/handlers/chat_stream_handlers.governance.integration.test.ts`; impl in
`src/ipc/handlers/chat_stream_handlers.ts` (+ small helper allowed in governance_handlers.ts). Seam S4.
RED: `it("runs verifications automatically at governed turn end and includes the verdict in the final message")` —
chat-flow harness, `enableGovernance: true`, `chatMode: "local-agent"`. Seed an APPROVED bundle
via ArtifactStore (+ spec_bundles row, approvalStatus approved — copy the pattern from the
existing gate tests) with story `US-1` criterion `AC-1` contract `test -f file1.txt`.
`await harness.streamChat("rotate the leaked api key in .env")` (governed prompt). The fake
model's unmarked prompt returns the canned `<dyad-write path="file1.txt">` — the turn writes the
file, then the hook runs. Assert: no `chat:response:error`; the LAST assistant message row in db
contains `Spec verification` and `1 green`; a `spec_verifications` row `kind:"check"`,
`criterionKey:"US-1/AC-1"`, `status:"green"` exists; a `governance_run_events` row type
`verification_completed` exists.
GREEN: in `chat_stream_handlers.ts`, in the governed-lane branch after the turn's stream
completes (wrap so failures only `log.warn`): load bundle, `extractContracts`, `runContracts`
(cwd = the app's resolved path via `getDyadAppPath`), persist check rows for the latest
governance run, `appendRunEvent(runId, "verification_completed", {green, red})`, and append
`\n<dyad-status title="Spec verification" state="{green===total?'complete':'error'}">${green} green, ${red} red</dyad-status>`
to the final assistant message content (db update). Governed lane ONLY.
Verify: the integration file (all 4 tests green) + `npm test -- src/ipc/handlers/chat_stream_handlers.test.ts` + ts.
Commit `gov(T5.7): Turn-end verification hook`.

### T5.8 VerificationBadge (UI) + version-verification IPC

Files: `src/components/governance/VerificationBadge.tsx` + colocated test; contract addition in
`src/ipc/contracts/governance_contracts.ts`; handler in `governance_handlers.ts` (+ its test);
mount in `src/components/chat/VersionPane.tsx`. Seam S10 + S4.
RED 1 (S10): `it("renders verified state and failing state from props")` —
`<VerificationBadge verified green={2} red={0} failing={[]} />` shows a green-check icon role
`img`/testid `verification-badge` with text `2/2 criteria green`;
`verified={false} green={1} red={1} failing={["US-1/AC-2"]}` shows red styling and the text
`US-1/AC-2`. No IPC in the component — props only.
RED 2 (S4): handler test `it("returns the stamped verification summary for a version")` — seed
check rows with `versionId` set → `governance:get-version-verification` `{ versionId }` returns
`{ verified, green, red, failing: ["US-1/AC-2"] }` (failing = red check keys).
GREEN: contract `getVersionVerification: defineContract({ channel: "governance:get-version-verification",
input: z.object({ versionId: z.number() }), output: z.object({ verified: z.boolean(), green: z.number(), red: z.number(), failing: z.array(z.string()) }) })`
in the same contracts object (relative imports only!). Handler reads check rows by versionId.
Component + mount: in `VersionPane.tsx`, per version row, `useQuery` on
`queryKeys.governance.versionVerification({ versionId })` (add the key factory entry) calling
`governanceClient.getVersionVerification`; render `<VerificationBadge {...data} />` when data
exists. Query client comes from the existing root provider.
Verify: badge test, handler test, `npm test -- src/components/chat/VersionPane.test.tsx` if it
exists (grep first; if its harness lacks QueryClientProvider, wrap like
`PlanPanel.test.tsx` does — see its `renderPlanPanel` helper). ts. Commit `gov(T5.8): VerificationBadge`.

### T5.9 Verification script export

Files: extend `src/governance/artifacts/artifact_store.ts` + its test. Seam S2.
Format (Anvil `ANVIL/.anvil/bin/` faithful, `.dyad` home):

- `<root>/.dyad/bin/verify-<story>-<criterion>.sh` (e.g. `verify-US-1-AC-1.sh`) per executable
  contract whose command passes `isSafeVerificationCommand`:

  ```bash
  #!/bin/bash
  set -euo pipefail

  cd '<root>'
  command=(
    '<argv0>'
    '<argv1>'
  )

  "${command[@]}"
  ```

  (argv = command split on whitespace; escape single quotes in argv as `'\''`.)

- `<root>/.dyad/bin/verification-tasks.json`:
  `{ "binDirectoryRelativePath": ".dyad/bin", "exportedScripts": [{ "argv": [...],
"scriptRelativePath": ".dyad/bin/verify-US-1-AC-1.sh", "criterionKey": "US-1/AC-1",
"verificationContract": "<cmd>" }], "skippedTasks": [{ "criterionKey": "US-2/AC-1",
"reason": "no verification contract" }] }` (also skip unsafe commands with reason
  `"unsafe command"`).
- `<root>/.dyad/bin/README.md` listing each script and each skipped reason (plain markdown,
  model on ANVIL's README above).
  RED: `it("exports standalone verify-*.sh scripts and an index")` — bundle with US-1/AC-1 contract
  `test -f package.json` (green in root: write `package.json` into the tmp root) and US-2/AC-1 no
  contract. `exportVerificationScripts(root, bundle)` → files exist; `sh <root>/.dyad/bin/verify-US-1-AC-1.sh`
  exits 0; index JSON parses with exactly the shapes above; README contains `verify-US-1-AC-1.sh`
  and the skip reason.
  GREEN: method `exportVerificationScripts(root, bundle)` on ArtifactStore (or exported fn) using
  `extractContracts` + `isSafeVerificationCommand`; mkdir recursive; reuse `atomicWrite`.
  Verify: artifact_store test + ts. **PHASE 5 GATE** (below) then Commit `gov(T5.9): Verification script export`.

**P5 gate:** `npm run ts && npm run fmt && npm run lint` clean; targeted suites green; `npm run
build` (unsandboxed; see §0 note); new E2E `e2e-tests/governance_verification.spec.ts` (copy the
preamble/flow from `governance_spec_flow.spec.ts`; fixture `governance-verify-flow.ts` =
write_spec with contract `test -f file1.txt`, then approve, then an agent-mode turn — assert the
chat shows `Spec verification` and `1 green`; use `po.chatActions.selectChatMode("local-agent")`
for the second turn). Log results in PROGRESS_LOG.md, commit gate.

---

# Phase 6 — Councils & budget (T6.1–T6.8). Reference: `ANVIL/anvil-macOS/Core/Incubation/AdversarialCouncilEngine.swift`, `Core/Critic/`, `Core/Autopilot/TokenBudgetGovernor.swift`

### T6.1 Verdict aggregation

Files: impl+test `src/governance/core/verdict_aggregator.ts/.test.ts`. Seam S1.
Types (export): `MemberFinding { severity: "critical"|"major"|"minor"; claim: string; evidence: string }`,
`MemberReport { memberId: string; findings: MemberFinding[] }`.
Semantics (baked): a member "fails" the work iff any finding is `critical` or `major`.
`aggregateVerdict(reports)` → `{ classification, consensusScore, critiques }` where
`critiques` = reports passthrough; `consensusScore = round(max(failCount, passCount)/total, 2)`:

- 0 reports → `{ classification: "unavailable", consensusScore: 0 }`
- all fail → `"unanimous-critical"`; none fail → `"unanimous-pass"`
- fail === pass → `"contested"`
- else `"majority-critical"` (fail majority) / `"majority-pass"`
  RED (hand-worked): 4 members each with a critical finding → `unanimous-critical`, score `1`;
  3 fail + 1 pass (only minor findings) → `majority-critical`, score `0.75`; 2 fail + 2 pass →
  `contested`, score `0.5`; all minor-only → `unanimous-pass`, score `1`; empty → `unavailable`.
  GREEN: pure reduce. Verify + Commit `gov(T6.1): Verdict aggregation`.

### T6.2 Council engine — 3-round Delphi via fake fetch

Files: impl+test `src/governance/council/council_engine.ts/.test.ts`. Seam S6.
Export `DEFAULT_COUNCIL_MEMBERS = [
 { id: "architect", provider: "anthropic", model: "claude-sonnet-4.5" },
 { id: "pragmatist", provider: "openai", model: "gpt-5" },
 { id: "fact-checker", provider: "google", model: "gemini-2.5-pro" },
 { id: "devils-advocate", provider: "xai", model: "grok-code-fast-1" } ]` (plan-baked; all
four model names have repo precedent in `src/components/ModelPicker.test.tsx`; Anvil uses
openrouter for devils-advocate — plan wins).
API: `runCouncil({ question, context }, { rounds = 3 } = {})` →
`Promise<{ classification; consensusScore; critiques; roundsCompleted }>` and throws/returns
`{ classification: "unavailable" }` when fewer than 2 members succeed round 1.
Impl: per member per round call `getModelClient` (build minimal settings
`{ providerSettings: {} } as UserSettings`-shaped object the client factory accepts — copy the
smallest working call pattern from existing tests that use `getModelClient`; if direct use is
awkward under fake fetch, call `generateText` from the `ai` package with the returned model) with
system prompt from T6.3's `buildCouncilSystemPrompt(memberId, round, priorRoundTexts)`; parse
`JSON.parse(text)` `{ findings: [...] }`; round ≥ 2 prompts include every OTHER member's round-1
claim texts verbatim; aggregate final round reports with `aggregateVerdict`.
Test: `setModelClientFetchForTesting(fakeFetch)` where fakeFetch inspects the request URL/body to
identify the member (inject per-model scripted responses by matching the model name in the body)
returning `{ findings: [{ severity: "major", claim: "<member>-r<round>-claim", evidence: "e" }] }`
as an OpenAI-shaped JSON (`{ choices: [{ message: { content: "<json string>" } }] }` — check what
the AI SDK fake-server tests return and mirror that shape; the hybrid tests in
`src/ipc/handlers/__tests__/` that fake model calls are the reference).
RED asserts: total fetch calls `=== 3 rounds × 4 members = 12`; the round-2 request body for
member X contains the string `architect-r1-claim` (another member's round-1 claim); the return
feeds `aggregateVerdict` (`majority-critical` when 3 members scripted major, 1 scripted minor);
`roundsCompleted === 3`; with 3 of 4 fetches rejecting → `{ classification: "unavailable" }`.
Verify + Commit `gov(T6.2): Council engine`.

### T6.3 Council razors in prompts

Files: `src/prompts/council_prompts.ts` + `src/prompts/council_prompts.test.ts`. Seam S9.
Baked razor distribution: architect = Occam + Chesterton's Fence; pragmatist = YAGNI + Inversion;
devils-advocate = Pre-Mortem; fact-checker = factual rigor (every claim must cite evidence).
Export `buildCouncilSystemPrompt(memberId, round, priorRoundTexts)` embedding the member's razor
list, the round number, prior round texts (round ≥ 2), and the JSON demand exactly:
`Respond with ONLY a JSON object: {"findings":[{"severity":"critical"|"major"|"minor","claim":"...","evidence":"..."}]}`.
RED: snapshot test of each member's round-1 prompt + a round-2 prompt (contains round-1 text);
plus `it("demands the JSON findings protocol")` asserting every prompt contains the JSON line.
Commit `gov(T6.3): Council razors in prompts`.

### T6.4 `convene_council` tool + `council_verdicts` table

Files: table in `src/db/schema.ts` + `npm run db:generate` migration; tool
`src/pro/main/ipc/handlers/local_agent/tools/convene_council.ts` + spec; wiring in
`tool_definitions.ts` (same pattern as run_verifications: enableGovernance gate, not in
build set). Seam S5+S8.
Table: `councilVerdicts = sqliteTable("council_verdicts", { id, appId (fk apps cascade),
question: text notNull, classification: text notNull, consensusScore: real notNull,
verdictJson: text notNull, createdAt default unixepoch })`.
Tool: input `{ question: z.string().min(1) }`; `defaultConsent: "ask"`, `modifiesState: false`;
`getConsentPreview: () => "Convene the multi-model council (may cost tokens)"`.
RED: `it("convenes the council on a question and persists the verdict")` — fake fetch scripted
majority-critical; `execute({ question }, ctx)` (ctx from write_spec.spec.ts pattern) → returned
string contains `majority-critical`; `council_verdicts` row exists with the question and score.
GREEN: execute → `runCouncil({ question })` → insert row → summary string.
Commit `gov(T6.4): convene_council tool`.

### T6.5 Heuristic gate triggers v1

Files: impl+test `src/governance/core/heuristic_gate.ts/.test.ts`. Seam S1.
`evaluateGateTriggers({ verdict, plannedScope, diffStats })` → `{ triggers: string[], blocking: boolean }`:

- `"split-council-verdict"` iff `verdict?.classification === "contested"`
- `"scope-expansion"` iff `diffStats.filesChanged > plannedScope.files * 2` (strictly greater)
- `blocking = triggers.length > 0`
  RED (hand-worked): contested → fires/blocking; planned `{files:3}` diff `{filesChanged:7}` fires
  (7 > 6); `{files:3}`/`{filesChanged:6}` does NOT (6 > 6 false); clean small diff + unanimous-pass
  → `{ triggers: [], blocking: false }`.
  Commit `gov(T6.5): Heuristic gate triggers v1`.

### T6.6 Budget governor (+ `BudgetExceeded` kind + `governanceBudgetUsd` setting)

Files: impl+test `src/governance/core/budget_governor.ts/.test.ts`; `src/errors/dyad_error.ts`
(add `BudgetExceeded = "budget_exceeded"` to `DyadErrorKind` AND to `TELEMETRY_FILTERED_KINDS`);
settings: optional `governanceBudgetUsd: z.number().optional()` in schemas.ts +
`governanceBudgetUsd: 5` in DEFAULT_SETTINGS + regenerate settings snapshots (`-u`, diff must
only add the key). Read `rules/dyad-errors.md` + `rules/adding-settings.md` first. Seam S1.
`class BudgetGovernor { constructor(ceilingUsd: number); record({ input, output, costUsd }):
void — throws DyadError(message, DyadErrorKind.BudgetExceeded) when the running total would
EXCEED the ceiling; remaining(): number }`.
RED: ceiling 1.0 — `record({input:1,output:1,costUsd:0.5})` ok, second `costUsd:0.5` ok (total
=== ceiling, not over), third `costUsd:0.01` throws `kind BudgetExceeded`;
`remaining()` after first record `=== 0.5`.
Commit `gov(T6.6): Budget governor`.

### T6.7 Wire gate + budget into governed runs

Files: extend `src/ipc/handlers/chat_stream_handlers.governance.integration.test.ts`; impl:
`governance:resolve-gate` contract+handler in governance_contracts.ts/governance_handlers.ts;
gate marking in `convene_council.ts` execute; gate check in `chat_stream_handlers.ts` approval-gate
block. Seam S4.
Wiring: (a) convene_council execute, after persisting verdict: if
`evaluateGateTriggers({ verdict, plannedScope: { files: 0 }, diffStats: { filesChanged: 0 } })` is
blocking (i.e. contested), set the app's latest running `governance_runs` row to
`status: "gate_open"`. (b) New contract `resolveGate { runId, resolution: "approve"|"cancel" } →
{ status }`: handler sets status `running`/`cancelled` + `appendRunEvent(runId, "gate_resolved",
{ resolution })`. (c) In the chat approval-gate block: also refuse (DyadError Precondition,
message containing `gate`) when the app's latest governance run has `status === "gate_open"`.
RED: `it("pauses a run with a blocking gate and resumes on user resolution")` — harness; seed
governance run `gate_open` + an approved bundle; governed prompt → exactly 1
`chat:response:error` whose payload mentions `gate`; then invoke
`governance:resolve-gate` `{ runId, resolution: "approve" }`; same governed prompt → no error,
assistant message exists.
Commit `gov(T6.7): Wire gate + budget into governed runs` (budget consumption point = council
engine: runCouncil builds `new BudgetGovernor(settings.governanceBudgetUsd ?? 5)` and records
`costUsd` per member-round using T6.8's estimate low value — one added test in T6.8 covers it).

### T6.8 Council cost estimate up front

Files: extend `src/governance/core/budget_governor.ts/.test.ts` + surface in convene_council. Seam S1.
`estimateCouncilCost(members, rounds, avgTokens)`: totalTokens = members × rounds × avgTokens;
`BLENDDED_USD_PER_MILLION = 3`; → `{ lowUsd: round(totalTokens/1e6*3, 3), highUsd: round(…*6, 3) }`.
RED (hand-worked): `(4, 3, 8000)` → total 96,000 → `{ lowUsd: 0.288, highUsd: 0.576 }`.
Also `it("records council cost against the budget")`: governor ceiling 0.2; runCouncil-style
record of lowUsd throws BudgetExceeded (wire the actual record call in runCouncil — extend the
T6.2 test with a tiny ceiling via injected settings to prove the throw).
Surface: convene_council `getConsentPreview: (args) => "Convene the council (~$0.29–$0.58)"` —
compute via estimate with DEFAULT members.
**P6 GATE:** ts/fmt/lint + all P5/P6 suites + integration file green; commit; PROGRESS_LOG entry.
Commit `gov(T6.8): Council cost estimate up front`.

---

# Phase 7 — Project memory (T7.1–T7.6). Reference: `ANVIL/anvil-macOS/Core/Context/ProjectMemoryStore.swift`

### T7.1 `memory_items` table + store CRUD

Files: table in schema.ts + migration (`npm run db:generate`); impl+test
`src/governance/memory/memory_store.ts/.test.ts`. Seam S8.
Table: `memoryItems = sqliteTable("memory_items", { id, appId fk cascade, namespace text notNull
default "project", tier text enum-ish notNull, category text notNull, body text notNull,
importance integer notNull default 5, expiresAt timestamp nullable, createdAt/updatedAt
unixepoch, lastAccessedAt timestamp nullable })`.
Constants (export): `MEMORY_TIERS = ["short","medium","long"]`,
`MEMORY_CATEGORIES = ["auditHistory","userDecision","styleInference","errorPattern","architecturalDecision"]`.
Store: `class MemoryStore { constructor(db = globalDb) record(appId, {tier, category, body,
importance?, expiresAt?}) → id; get(id); listForApp(appId); setImportance(id, n);
remove(id); touch(id) (sets lastAccessedAt) }` — validate tier/category against the enums
(DyadError Validation on unknown, e.g. `"bogus"`).
RED: insert/read/update-importance/delete round-trip; rejects unknown category
(`"bogus"` → `{ name: "DyadError", kind: "validation" }`); clamps importance 0–10
(record importance 42 → read back 10).
Commit `gov(T7.1): Memory table + store CRUD`.

### T7.2 Eviction sweep

Same files. RED: `it("evicts expired medium-tier items and never evicts long-tier")` — seed
medium+expiresAt past, medium+future, long+expiresAt past → `sweepExpired(new Date())` (inject
now) deletes exactly the first; long survives. GREEN: delete-where
`tier = "medium" AND expiresAt < now`; call sites: `record` and `listForApp` trigger a sweep at
most once per 60s (module-level `lastSweepAt`, injectable clock for the test — no timers).
Commit `gov(T7.2): Eviction sweep`.

### T7.3 Ranking

Files: impl+test `src/governance/core/memory_ranking.ts/.test.ts`. Seam S1.
Formula (baked): `score = importance × 2^(−ageDays / 7)` (half-life 7 days).
`rankMemories(items, now)` returns items sorted by score desc (stable by id for ties), each
decorated `{ …item, score }` rounded to 3 decimals.
RED (hand-worked — these literals, not recomputed): A {importance 9, age 30d} → `0.462`;
B {importance 5, age 1h} → `4.979`; C {importance 7, age 7d} → `3.5`; expected order `[B, C, A]`.
GREEN: pure function; `ageDays = (now − createdAt)/86400000`.
Commit `gov(T7.3): Ranking`.

### T7.4 `record_memory` tool

Files: tool `…/tools/record_memory.ts` + spec; wiring in tool_definitions.ts (enableGovernance
gate; not plan-mode-only). Seam S5.
Input zod: `{ body: z.string().min(1), category: z.enum(MEMORY_CATEGORIES), tier:
z.enum(MEMORY_TIERS).default("short"), importance: z.number().min(0).max(10).optional() }`.
Consent: the framework's `defaultConsent` is per-TOOL, not per-args — use `defaultConsent: "ask"`
and record the deviation from the parent plan's per-category consent in PROGRESS_LOG (one line).
RED: `it("stores a memory with tier and category validation")` — execute with
`category: "userDecision", tier: "long"` → row exists (via harness db) and result string mentions
the id; `it("rejects unknown categories")` — zod input parse of `"bogus"` fails (assert via
`tool.inputSchema.safeParse` like planning_questionnaire.spec.ts does) AND execute throws
DyadError Validation.
GREEN: execute → `new MemoryStore().record(ctx.appId, …)` → summary string.
Commit `gov(T7.4): record_memory tool`.

### T7.5 Turn-start injection

Files: impl `src/governance/memory/build_memory_context.ts` (S1: pure
`buildMemoryContextMessage(items)` — header `Project memories:` + `- ${body}` lines, whole string
sliced to 2000 chars); integration RED in the governance integration file; wiring in
`chat_stream_handlers.ts` after `let systemPrompt = constructSystemPrompt({ … })` (line ~2191):
if governed lane → `systemPrompt += "\n\n" + buildMemoryContextMessage(rankMemories(await new
MemoryStore().listForApp(chat.appId), new Date()).slice(0, 10))`. Seam S4/S7.
RED: `it("injects the top-N ranked memories as a system-side message on governed turns")` —
harness; insert a memory row (importance 9, recent) with a distinctive body
`memory-marker-123`; governed prompt `[dump] rotate the leaked api key in .env` →
`getServerDump().text` contains `memory-marker-123`; a lean prompt `[dump] fix the typo in button label`
→ does NOT contain it.
Commit `gov(T7.5): Turn-start injection`.

### T7.6 Post-run learning hook

Files: extend the governance integration test; impl in the T5.7 turn-end verification branch. Seam S4.
RED: `it("records an errorPattern memory when a governed run fails verification")` — approved
bundle whose contract `test -f missing.txt` (red after the turn) → after the governed turn, a
`memory_items` row exists with `category: "errorPattern"` and body containing `US-1/AC-1`.
GREEN: in the turn-end hook, when `red > 0`: `record(appId, { tier: "medium", category:
"errorPattern", body: \`Verification failed for: ${redKeys.join(", ")}\`, importance: 7 })`+`appendRunEvent(…, "memory_recorded", { keys: redKeys })`.
**P7 GATE:** ts/fmt/lint + suites + integration green; PROGRESS_LOG; commit
`gov(T7.6): Post-run learning hook`.

---

# Phase 8 — Multi-runtime dispatch (T8.1–T8.8). READ `rules/windows-spawn.md` FIRST.

Reference: `ANVIL/anvil-macOS/Core/AgentBackend/`

### T8.1 Backend protocol + builtin passthrough

Files: `src/governance/backends/types.ts` + `builtin_backend.ts` + `builtin_backend.test.ts`. Seam S1-ish.
Types: `BackendEvent = { type: "started"|"output"|"completed"|"failed"; node?: string; text?;
exitCode?; error? }`; `BackendTask = { id: string; prompt: string; cwd: string }`;
`interface GovernedBackend { dispatch(task: BackendTask): AsyncIterable<BackendEvent> }`.
`createBuiltinBackend(executor: (task) => Promise<{ exitCode: number; output: string }>)` →
backend whose dispatch yields started → output → completed (exitCode 0) or failed (nonzero or
throw). RED: fake executor; `for await` collect events; assert exact sequence
`["started","output","completed"]` and payload fields; throwing executor → `["started","failed"]`
with error text.
Commit `gov(T8.1): Backend protocol + builtin passthrough`.

### T8.2 CLI detection

Files: `src/governance/backends/cli_detect.ts` + test. Seam S3 (injected runCommand + injected now).
`detectCli(name: "claude"|"codex", { runCommand, now = Date.now, cacheTtlMs = 300_000 })` →
`{ available: boolean; version?: string }`: run `<name> --version` (runCommand returns
`{ stdout }`), parse first semver token, compare: claude ≥ 2.0.0, codex ≥ 0.100.0 (numeric
dot-compare helper — do NOT add a semver dependency). Missing/nonzero → `{ available: false }`.
Cache: module-level `Map` keyed by name with timestamp; second call within TTL does not invoke
runCommand (assert call count).
RED (hand-worked): claude stdout `"2.1.3 (Claude Code)"` → available; `"1.9.0"` → not; codex
`"0.110.0"` → available; `"0.99.0"` → not; empty → not; cache test: two calls, runCommand
called once; TTL expiry (now + 300_001) re-invokes.
Commit `gov(T8.2): CLI detection`.

### T8.3 Claude Code backend

Files: `src/governance/backends/claude_code_backend.ts` + test. Seam S3 (injected spawn).
`createClaudeCodeBackend({ spawnFn = spawn, env = process.env, timeoutMs = 120_000, sessionId? })`.
dispatch(task): argv = `["claude","--print","--output-format","stream-json", …(sessionId ?
["--resume", sessionId] : []), "--", task.prompt]` — wait, `--` then prompt only if the CLI
needs it; BAKED: argv is `["claude", "--print", "--output-format", "stream-json",
...(sessionId ? ["--resume", sessionId] : []), task.prompt]`. Env sanitization: pass ONLY
`{ PATH, HOME, LANG, LC_ALL, TMPDIR, SHELL }` (filter from provided env). Parse ndjson stdout
lines `JSON.parse` → map `type`: `"system"`→started, `"assistant"`→output (concat text deltas),
`"result"`→completed (exitCode from `is_error`), parse/unknown-line errors → failed. Timeout:
kill() → failed with `error: "timeout"`.
RED: fake spawnFn returns `{ stdout: EventEmitter, stderr, kill }` — script emissions
`{"type":"system"}`, `{"type":"assistant","message":{"content":[{"text":"hi"}]}}`,
`{"type":"result","is_error":false}`; assert argv exactly, env has no `DYAD_*` keys, event
sequence, and a timeout case (no result line; advance a fake timer or use timeoutMs: 50 +
delayed result → failed).
Commit `gov(T8.3): Claude Code backend`.

### T8.4 Codex backend

Files: `src/governance/backends/codex_backend.ts` + test. Same pattern.
Framing (baked): ndjson JSON-RPC — serialize requests as
`JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"`; parse response lines the same
way. dispatch sends `{ method: "task.start", params: { prompt, cwd } }` then relays
notifications: `task.started`→started, `task.output` (param `text`)→output, `task.completed`
(param `exitCode`)→completed, `error`→failed.
RED: `it("round-trips JSON-RPC framing")` — pure serialize/parse helpers (export them);
`it("dispatch → events")` with fake spawn echoing a scripted stream; argv assertion
`["codex", "exec", "--json", task.prompt]` (baked); timeout test mirrors T8.3.
Commit `gov(T8.4): Codex backend`.

### T8.5 Skill materializer

Files: `src/governance/backends/skill_materializer.ts` + test. Seam S2.
`materializeSkills(root, skills: { id: string; body: string }[], targets: ("claude"|"codex")[])`
writes `<root>/.claude/skills/<id>/SKILL.md` and `<root>/.codex/skills/<id>/SKILL.md` with YAML
frontmatter `---\nid: <id>\n---\n` + body; returns cleanup `() => Promise<void>` removing them;
callers use try/finally. Neutralize injection: if body starts with `---` or id/body contains
`---\n`, reject with DyadError Validation; escape double quotes in frontmatter as `\"`.
RED: writes both files + cleanup removes them (finally semantics: cleanup runs after an
artificial throw); malicious id `"x\n---\ninjected: true"` rejected.
Commit `gov(T8.5): Skill materializer`.

### T8.6 Session resumption store

Files: `src/governance/backends/session_resumption.ts` + test. Seam S2.
`saveSession(root, { backend, sessionId, cwd })` writes `<root>/.dyad/sessions/<backend>.json`
(mode 0o600 — `writeFile(path, data, { mode: 0o600 })`); `loadSession(root, backend, now?)` →
the record if age ≤ 24h else null (missing → null). RED: round-trip; `stat().mode & 0o777 ===
0o600` (POSIX only — guard with `process.platform !== "win32"`); expired (savedAt = now − 25h)
→ null.
Commit `gov(T8.6): Session resumption store`.

### T8.7 Registry + tier routing

Files: `src/governance/backends/registry.ts` + test. Seam S1 (pure, injected).
`createRegistry({ builtin, external: { backend, score }[] })`;
`routeBackend(tier: "surgical"|"standard"|"architectural")`: architectural → builtin ALWAYS;
others → highest-scoring available external; tie → first registered; none available → builtin.
RED (hand-worked scores): architectural with externals scored 9/8 → builtin; standard with
claude 8 / codex 6 → claude; claude unavailable → codex; both unavailable → builtin.
Commit `gov(T8.7): Registry + tier routing`.

### T8.8 Dispatch integration

Files: extend `src/ipc/handlers/chat_stream_handlers.governance.integration.test.ts`. Seam S4.
Impl: exported `dispatchGovernedTask(appId, task, registry?)` (new small module
`src/governance/backends/dispatch.ts`): default registry = builtin passthrough executor that
runs the prompt through `runContracts`-style `sh -c`? NO — builtin v1 executes the task by
writing `<cwd>/<task.id>.done` marker (the fake/executable seam): BAKED — builtin executor runs
`runCommand(task.prompt, task.cwd, 30_000)` treating prompt as a shell command (this is what the
P9 fake-backend env flag will use). Every lifecycle event → `appendRunEvent(latestRunId, "backend_" + type, payload)`.
RED: `it("executes a governed task through an external backend and records lifecycle events")` —
inject registry with fake external backend (async generator yielding started/output/completed);
seed governance run; call `dispatchGovernedTask(appId, { id: "t1", prompt: "true", cwd: tmpdir })`
→ run_events rows `backend_started`, `backend_output`, `backend_completed` in seq order.
**P8 GATE:** ts/fmt/lint + suites. Commit `gov(T8.8): Dispatch integration`.

---

# Phase 9 — DAG orchestration & worktrees (T9.1–T9.8) — CORD-CUT PHASE

### T9.1 Task graph model + topo order

Files: impl+test `src/governance/core/task_graph.ts/.test.ts`. Seam S1.
`TaskNode { id: string; title?: string; deps: string[]; stories?: string[] }`,
`topoOrder(nodes)`: Kahn's algorithm; cycle → throw `Error("cycle detected: <ids>")`.
`readySet(nodes, completed: Set<string>)`: ids not completed whose deps ⊆ completed.
RED: diamond a→(b,c)→d orders `[a,b,c,d]` or `[a,c,b,d]` (assert deps respected pairwise, not
exact order); cycle `x↔y` throws; readySet of diamond with completed={a} → {b,c}; with
completed={a,b} → {c}.
Commit `gov(T9.1): Task graph model + topo order`.

### T9.2 Backpressure

Same files. `runWithBackpressure(nodes, { runner, maxConcurrent = 4 })`: schedules ready nodes,
never exceeding maxConcurrent in flight, admits queued on completion, resolves when all done
(or first rejection propagates); returns per-node results in topo order.
RED: 10 independent nodes with a runner that tracks `inFlight`/`maxObserved` and defers via
manually-resolved promises — assert `maxObserved <= 4`, all 10 ran, results ordered; dependency
test: b depends on a → a's completion timestamp < b's start.
Commit `gov(T9.2): Backpressure`.

### T9.3 Extract worktree isolation utility

Files: NEW `src/ipc/utils/app_worktree.ts` that re-exports/wraps `createBuildWorktree` and
`removeSnapshot` from `run_build.ts`; `run_build.ts` imports from the new module (mechanical
move of those two exports — keep signatures identical). Verify ONLY:
`npm test -- src/pro/main/ipc/handlers/local_agent/tools/run_build*` (grep the exact suite
filename first: `ls src/pro/main/ipc/handlers/local_agent/tools/run_build*`) — unchanged-green,
PLUS `npm run ts`. This task has NO new test (mechanical move; existing suite is the proof).
Commit `gov(T9.3): Extract worktree isolation utility`.

### T9.4 Orchestrator happy path

Files: `src/governance/runs/dag_orchestrator.ts` + test. Seam S1+fake (injected backend factory

- injected worktree factory + injected event sink).
  `executeDag(nodes, deps: { backendFor(node): GovernedBackend; worktreeFor(node): Promise<string>;
onEvent(type, payload): void })` — worktree per node (factory returns tmp dirs in the test),
  runs via `runWithBackpressure`, merges per-node `output` results into a map ordered by
  `topoOrder`, surfaces conflicts: if two nodes report the same `file` in their completed payload →
  `onEvent("node_conflict", { file, nodes })`.
  RED: 3-node DAG (a → b, a → c); fake backends complete with payload files `{file: "a.txt"}` /
  `{file: "b.txt"}`; assert each node got a distinct worktree dir (exist on disk), events include
  `node_started`/`node_completed` per node, merged result keys `[a,b,c]` order; conflicting pair →
  `node_conflict` event.
  Commit `gov(T9.4): Orchestrator happy path`.

### T9.5 Failure + partial continuation

Same files. RED 1: `it("fails downstream of a failed node but completes independent subtrees")` —
a fails → d (dep a) gets `node_blocked`; independent subtree c completes; run resolves
`{ status: "partial", completed: [..c..], blocked: [d] }`. RED 2: `it("halts the whole run when
the budget governor throws")` — backendFor's runner records cost into an injected
`BudgetGovernor(0)`-style object that throws on node b → whole run rejects with
`BudgetExceeded`.
Commit `gov(T9.5): Failure + partial continuation`.

### T9.6 Manifest → DAG compiler

Files: `src/governance/core/manifest_to_graph.ts` + test. Seam S1.
`manifestToGraph(bundle)`: nodes from `bundle.manifest.tasks` — `{ id: task.id, title:
task.title, deps: task.dependsOnTitles.map(title → task id), stories: task.linkedStoryIds }`.
RED: hand-build a bundle (fixture parse + rewrite manifest.tasks with 2 tasks, second depends on
first's title, linkedStoryIds ["US-1"]) → graph nodes carry deps by ID and stories traceability.
Commit `gov(T9.6): Manifest → DAG compiler`.

### T9.7 RunTimeline UI

Files: `src/components/governance/RunTimeline.tsx` + colocated test. Seam S10 (props only).
Props `{ nodes: { id; title; status: "pending"|"running"|"green"|"red"|"blocked" }[], events:
{ seq; type; at }[] }`. Render each node with testid `run-node-<id>` and a status class/text;
render the event stream as a list. RED: snapshot/`it("renders node states from a run snapshot")`
asserting all five states visible with correct labels; empty events → empty list.
Mount (wiring only, no new test): into `VersionPane.tsx`? NO — mount where run state is visible:
add to `SpecReviewPanel.tsx` bottom: a `useQuery` on a new `governance:get-run-events`
contract? Parent plan's `getGovernanceRun` contract already exists in
governance_contracts.ts — IMPLEMENT its handler now (it was a typed shell): reads run + events
(rows → `{ seq, type, payload: JSON.parse(payloadJson), at: iso }`). Add queryKeys entry
`governance.run({ runId })`, render `<RunTimeline …>` inside SpecReviewPanel when a latest run
exists (simplest: extend `governance:get-spec-bundle` response? NO — add tiny handler test for
getGovernanceRun in the handler test file; panel queries by latest run id from the runs list —
keep it minimal: query `governanceRuns` latest via a new `getLatestRun(appId)` contract — if
that's scope creep, render RunTimeline in the P9 E2E page area only. DECISION (baked): add
contract `getLatestGovernanceRun { appId } → run | null` + handler + panel mount; test the
handler in governance_handlers.test.ts).
Commit `gov(T9.7): RunTimeline UI`.

### T9.8 Cord-cut record + P9 gate

Files: append to `GOVERNANCE_FORK.md`. Content: `## Cord-cut (Phase 9)` with divergence commit
(`git rev-parse HEAD`), date, last absorbed upstream commit (`git rev-parse main`), and the rule
change: from here on NO rebase; upstream changes are cherry-picked by need.
**P9 GATE:** `npm run build`; E2E `e2e-tests/governance_dag.spec.ts` (new): preamble copied from
governance_spec_flow; fixture `governance-dag-flow.ts` writes a spec whose manifest.tasks = 2
nodes (second dependsOn first) each with contracts `test -f node-a.done` / `test -f node-b.done`;
approve the spec; then set env `DYAD_GOVERNANCE_FAKE_BACKEND=1` for the packaged app (add to
`launchArgs` in the E2E via fixture options if supported — else set in `playwright.config.ts`
`env` — grep how other specs pass env; last resort: forge `process.env` read at dispatch). BAKED
wiring: in the chat governed-lane branch, when the approved bundle has `manifest.tasks.length >
0` AND `process.env.DYAD_GOVERNANCE_FAKE_BACKEND === "1"`: instead of the LLM stream, run
`executeDag(manifestToGraph(bundle), { backendFor: builtin-with-marker-executor (prompt runs
`sh -c "touch <cwd>/<node.id>.done"` via dispatchGovernedTask), worktreeFor: mkdtemp,
onEvent → appendRunEvent })`, append a summary to the final assistant message (`DAG completed:
a, b`), emit end events, return. Assert in E2E: chat shows `DAG completed`; db check not
possible from Playwright — assert UI text. If the env plumbing fights you for >3 attempts,
write the blocker per protocol (stop condition 1) — do NOT hack forge internals.
Commit `gov(T9.8): Cord-cut record`.

---

# Phase 10 — Incubation & thoughts (T10.1–T10.6). Reference: `ANVIL/anvil-macOS/Core/Incubation/IncubationSession.swift` (stages), `Core/ThoughtGraph/`

### T10.1 Incubation state machine

Files: impl+test `src/governance/core/incubation_state.ts/.test.ts`. Seam S1.
Stages `"ideate"|"specify"|"challenge"|"commit"|"build"`. `nextIncubationStage(current, event?)`
where event = `{ type: "advance", hypothesis?: { problem: string; hypothesis: string;
successCriteria: string[] } } | { type: "regress" }`. Forward one step only; regress exactly one
step; `advance` INTO commit requires the hypothesis payload with ≥1 successCriteria.
RED (table): ideate→specify ok; specify→challenge ok; challenge→commit ok WITH payload, error
`hypothesis payload required` without; commit→build ok; ideate→build error; build→(none) error;
specify→ideate (regress) ok; challenge→ideate (regress two) error; commit with
successCriteria `[]` error.
Commit `gov(T10.1): Incubation state machine`.

### T10.2 Incubation session persistence

Files: extend `src/governance/artifacts/artifact_store.ts` + test. Seam S2.
`saveIncubationSession(root, session { id, stage, createdAt, … })` →
`<root>/.dyad/incubation/sessions/<id>/session.json`; `loadIncubationSession(root, id)` round-trip
(deep equal); `appendTranscript(root, id, line)` appends `line + "\n"` to `transcript.md` in the
same dir (creates if missing; two appends → two lines; CRLF-safe read back via split(/\r?\n/)).
Commit `gov(T10.2): Incubation session persistence`.

### T10.3 Hypothesis → spec bridge

Files: impl+test `src/governance/core/hypothesis_to_spec.ts`. Seam S1.
`seedSpecBundleFromHypothesis(h: { problem; hypothesis; successCriteria: string[] })` → SpecBundle:
`rawIntent = h.problem`; `approvalStatus: "draft"`; `createdAt` = fixed injectable `now`
(default new Date().toISOString()); one story: `{ id: "US-1", title: "Hypothesis: " +
hypothesis.slice(0, 60), narrative: "As a user I want " + h.hypothesis + " so that " +
h.successCriteria[0], criteria: h.successCriteria.map((c, i) => ({ id: "AC-" + (i+1), given:
"the system is in its current state", when: c, then: "the criterion holds" })) }` (NO
verificationContracts); all other bundle sections = empty skeletons (copy the empty-shape values
from `write_spec.ts`'s bundle literal — read that file first; do NOT refactor it).
RED: hand-built hypothesis `{ problem: "P1", hypothesis: "H1", successCriteria: ["S1","S2"] }`
→ assert rawIntent, story id/title/narrative exactly, 2 criteria with ids AC-1/AC-2 and no
verificationContract keys, approvalStatus draft.
Commit `gov(T10.3): Hypothesis → spec bridge`.

### T10.4 Thoughts table + capture

Files: tables `thoughts` + `thought_edges` in schema.ts + migration; impl+test
`src/governance/memory/thought_store.ts/.test.ts`. Seam S8.
`thoughts = sqliteTable("thoughts", { id, appId fk cascade, body text notNull, tagsJson text
notNull default "[]", todoStatus text notNull default "none" /* "none"|"todo"|"done" */,
createdAt/UpdatedAt unixepoch })`; `thought_edges = sqliteTable("thought_edges", { id,
fromThoughtId fk cascade, toThoughtId fk cascade, kind text notNull default "related" })`.
Store: `record(appId, { body, tags? })` (tags stored as JSON, read back as array);
`list(appId, { tag?, status? })` (tag filter = tag present in tagsJson array); `promoteToTodo(id)`
(none→todo; todo→todo no-op; done→error Conflict); `markDone(id)` (todo→done); `link(from, to, kind?)`.
RED: CRUD + tag filter (two thoughts, filter `"a"` returns one) + transitions (promote→todo,
markDone→done; markDone on "none" throws Conflict) + link round-trip.
Commit `gov(T10.4): Thoughts table + capture`.

### T10.5 Constellation detection

Files: impl+test `src/governance/core/constellations.ts/.test.ts`. Seam S1.
`detectConstellations(thoughts: { id; tags: string[] }[], { minSize = 3, minSharedTags = 2,
threshold = 0.5 })`: a constellation = a maximal subset where EVERY pair shares ≥2 tags AND pair
Jaccard `|∩|/|∪| ≥ 0.5`; returns `[{ thoughtIds, dominantTags }]` — dominantTags = tags present
in ≥ half the members, ordered by member-count desc then alpha. Simple O(n³) is fine.
RED (hand-worked): A{a,b,c}, B{a,b,d}, C{a,b,e} → pair share {a,b}=2, Jaccard 2/4=0.5 → one
constellation `[A,B,C]` dominant `["a","b"]`; adding D{x,y} → D in none; only A,B (2 thoughts)
→ `[]`; A{a,b},B{a,b},C{a,b}+D{a} → D pairs share 1 tag → excluded.
Commit `gov(T10.5): Constellation detection`.

### T10.6 Thought panel (minimal)

Files: `src/components/governance/ThoughtPanel.tsx` + colocated test; contract
`startIncubation { appId, body } → { sessionId }` + handler (creates T10.2 session stage
`ideate` + transcript seeded with body; if body non-empty also saves the T10.3 draft bundle via
ArtifactStore with hypothesis=body, problem=body, successCriteria: []). Seam S10.
Component: textarea (placeholder `Capture a thought…`), ⌘⏎ / Ctrl+⏎ submits (keyDown handler),
tabs All/Todo/Tags filtering a `thoughts` prop-driven list (keep it props-only for the test:
`{ thoughts: { id, body, tags, todoStatus }[], onStartIncubation }`), and a
`Promote to incubation` button per thought calling the prop callback (the mount wires the prop
to a mutation calling `governanceClient.startIncubation`). Mount: add a `Thoughts` entry —
BAKED minimal: render inside SpecReviewPanel bottom (governance surface) with a useQuery on a
`governance:list-thoughts` contract+handler (add both + handler test). Keep the list
contract/response tiny: `{ thoughts: [{ id, body, tags: string[], todoStatus }] }`.
RED: panel test — renders thoughts, ⌘⏎ on textarea calls submit callback, tab switch filters
(Todo shows only todoStatus "todo"), promote button calls callback with the thought id.
**P10 GATE:** ts/fmt/lint + suites. Commit `gov(T10.6): Thought panel (minimal)`.

---

# Phase 11 — Headless & autopilot (T11.1–T11.6). READ `rules/windows-spawn.md`.

Reference: `ANVIL/anvil-macOS/Core/RPC/RPCServer+Dispatch.swift` (methods initialize/execute/status…), `Core/HeadlessPRDRun.swift`, `scripts/anvilctl`, `Core/Autopilot/`

### T11.1 Engine callable without Electron

Files: test `src/governance/__tests__/no_electron_imports.test.ts` (new dir). Seam S1 (guard).
Test: walk `src/governance/**` (recursive `readdir`, ignore `.test.`), read each `.ts`, assert no
line matches `/from\s+"electron"/` — fail listing offenders. It will be GREEN immediately
(that's the goal state); prove non-vacuity ONCE by temporarily adding `import "electron";` to
`lane_screen.ts`, running the test (must fail), reverting — record that you did this in the
commit message. Commit `gov(T11.1): Engine callable without Electron`.

### T11.2 `dyadctl` CLI entry

Files: `scripts/dyadctl.mjs` (plain Node ESM — no TS imports); test
`src/governance/headless/dyadctl.test.ts` (vitest only picks up `src/**/*.{test,spec}.{ts,tsx}`
— do NOT colocate under scripts/; the test spawns the script via
`node <resolve(process.cwd(), "scripts/dyadctl.mjs")>`). Seam S3.
CLI: `node scripts/dyadctl.mjs run --app <dir> --prompt <str|-> --json`. Behavior: read
`<dir>/.dyad/specs/bundle.json` (if missing → `verifications: []`, status `"completed"`);
extract contracts with a minimal inline flatten (stories → criteria → verificationContract;
keys `${story.id}/${criterion.id}`); run each via `child_process.spawn("sh", ["-c", cmd])` in
`cwd: dir`, 30s timeout; print `JSON.stringify({ status: "completed", verifications:
[{ key, status: "green"|"red"|"timeout", exitCode }], versions: [] })`. Prompt `-` reads stdin
(readable stream; not covered by the test). Local model config from env = accepted but unused v1.
RED: tmp app dir: copy `e2e-tests/fixtures/import-app/minimal/package.json` into it; seed the
bundle via `ArtifactStore`-shaped JSON written by the test (simplest: write bundle.json +
requirements.md by hand from the fixture file with one contract `test -f package.json`);
spawn `node scripts/dyadctl.mjs run --app <dir> --prompt x --json` → parse stdout →
`{ status: "completed", verifications: [{ key: "US-1/AC-1", status: "green", exitCode: 0 }] }`.
Also a red case (`test -f missing.txt` → status red).
Commit `gov(T11.2): dyadctl CLI entry`.

### T11.3 Unix-socket RPC server

Files: `src/governance/headless/rpc_server.ts` + test. Seam S3.
`createGovernanceRpcServer({ socketPath, handlers })` using `node:http` +
`server.listen(socketPath)`; after listen `chmodSync(socketPath, 0o700)`. JSON-RPC 2.0:
`initialize` → `{ protocol: "governance-rpc/1" }`; `execute` → handlers.execute(params);
`status` → handlers.status(); `shutdown` → close server + resolve. Requests > 1 MiB → JSON-RPC
error `-32600` then destroy socket. Unknown method → `-32601`. Malformed JSON → `-32700`.
Client in the test: `node:http` request over `{ socketPath }` (or `fetch` with a unix-socket
dispatcher — plain `http.request({ socketPath })` is simplest).
RED: initialize/status/execute (fake handlers recording calls)/shutdown round-trips; perms
`stat().mode & 0o777 === 0o700`; 2 MiB body → error + closed; unknown method error code.
Commit `gov(T11.3): Unix-socket RPC server`.

### T11.4 RPC ↔ engine wiring

Same files. `createGovernanceEngine({ startRun })` state machine `idle → running → completed |
failed`; wire as RPC handlers: `execute` starts (fake `startRun` async), `status` reports
transitions. RED: execute returns `{ runId: "run-1" }`; immediate status → `running`; await
startRun → status `completed`; startRun rejecting → `failed` with message.
Commit `gov(T11.4): RPC ↔ engine wiring`.

### T11.5 GitHub issue intake

Files: `src/governance/headless/issue_intake.ts` + test. Seam S3 (injected runCommand).
`fetchIssueDetails(repo, issueNumber, { runCommand })`: runs `runCommand("gh", ["issue",
"view", String(n), "--repo", repo, "--json", "title,body,url"])`; parse JSON →
`{ rawIntent: title + "\n\n" + body, metadata: { source: "github-issue", url, repo,
issueNumber } }`; gh failure (nonzero) → DyadError External.
RED: hand-worked gh JSON `{"title":"T","body":"B","url":"U"}` → rawIntent `"T\n\nB"`, argv
asserted exactly; nonzero exit → External.
Commit `gov(T11.5): GitHub issue intake`.

### T11.6 Autopilot loop (PR out)

Same module + test. Seam S3.
`autopilotRun({ repo, issueNumber }, deps { runCommand (recording fake), fetchIssue, executeRun })`:
1 `gh issue view …` (via fetchIssue); 2 `git checkout -b auto/issue-<n>`; 3 executeRun (governed
run fake); 4 `git add -A`; 5 `git commit -m "fix(issue <n>): <title>"`; 6 `git push -u origin
HEAD`; 7 `gh pr create --draft --title "Issue #<n>: <title>" --body-file -` (body written to
stdin — assert the body string contains the title). Failure path (executeRun throws): still
pushes the branch and creates the draft PR with a body containing `Verification report` and the
failure message.
RED: assert the exact ordered argv sequence for both paths via the recording fake.
**P11 GATE:** FULL `npm test` (pre-existing failures per Appendix A are acceptable — quote the
list in PROGRESS_LOG) + `npm run build` + dyadctl smoke re-run. Commit `gov(T11.6): Autopilot loop`.

---

# Phase 12 — Hostinger/Coolify + strip-down (T12.1–T12.6)

### T12.1 Coolify-on-VPS validation runbook ⏸ OWNER CHECKPOINT

Files: `docs/plans/hostinger-coolify-runbook.md` (template + gap log). Manual owner task.
Write the runbook template: install Coolify on the Hostinger VPS (official curl script), point
Dyad's Coolify setup (`src/coolify_setup/` — read `capabilities.ts`, `commands.ts`,
`build_config.ts` first and list the exact Dyad-side steps: Settings → Coolify → server URL +
API token), deploy one fixture app (`e2e-tests/fixtures/import-app/minimal` or `astro`),
attach a custom domain, and a `## Gaps hit` table (columns: step / expected / actual / blocked?).
Then STOP and hand to the owner — the VPS actions cannot be executed from this machine.
Commit `gov(T12.1): Coolify-on-VPS validation runbook`.

### T12.2 Fix the first gap found ⏸ OWNER INPUT

Placeholder: becomes concrete ONLY from T12.1's gap log. If the owner reports no gap, close as
no-op with the owner's confirmation quoted in PROGRESS_LOG. Do not invent work.

### T12.3 Generic Postgres decision memo ⏸ OWNER DECISION

Files: `docs/plans/self-hosted-postgres.md`. Audit (read-only): `src/neon_admin/` (list files,
summarize responsibilities), the `get_neon_project_info` tool (grep it), every `DATABASE_URL`
flow (grep). Write the memo: option (a) keep Neon (zero work, external dependency), option (b)
generic-Postgres integration (scope estimate: which files, what abstraction). Recommendation +
open questions for the owner. If (b) is chosen, SPAWN A FOLLOW-UP PLAN file — do not wing it
here. Commit `gov(T12.3): Generic Postgres decision memo`.

### T12.4 Strip telemetry

Files: `src/ipc/utils/telemetry.ts` (+ extend `src/ipc/utils/telemetry.test.ts`). RED FIRST:
`it("resolves sendTelemetryEvent without network when the fork flag is set")` — in
`vi.hoisted` set `process.env.GOVERNANCE_FORK = "1"`; `vi.resetModules()` + dynamic import so
the flag is read at module load; set `global.fetch = vi.fn(() => { throw new Error("network") })`;
`await sendTelemetryEvent("x", {})` resolves (and `sendTelemetryException` too).
GREEN: at the top of telemetry.ts add
`const IS_GOVERNANCE_FORK = process.env.GOVERNANCE_FORK === "1";` — when set, `sendTelemetryEvent`,
`sendTelemetryEventToWindow`, and `sendTelemetryException` return immediately (no PostHog client
init). Flag is OPT-IN (default behavior unchanged) so existing tests stay green — if any existing
telemetry test fails, that's stop-condition 4 → BLOCKED.md. Also update `GOVERNANCE_FORK.md`:
launch the app with `GOVERNANCE_FORK=1` to strip telemetry.
Commit `gov(T12.4): Strip telemetry`.

### T12.5 Strip quota/auto-update gates

Files: `src/ipc/handlers/free_model_quota_handlers.ts`, `src/ipc/handlers/free_agent_quota_handlers.ts`
(grep its actual name first), `src/main.ts` (line ~630 `updateElectronApp({`). Same
`GOVERNANCE_FORK=1` flag.
RED: extend the quota handler test — with the flag set (hoisted env + resetModules if the module
reads env at load; otherwise read at call time — prefer call time via a tiny helper
`isGovernanceFork()` in `src/ipc/utils/test_utils.ts`? NO — put `export const IS_GOVERNANCE_FORK =
() => process.env.GOVERNANCE_FORK === "1"` inline in each file or a new
`src/shared/governance_fork.ts` (new shared file, no imports, preload-safe)): quota endpoints
return `{ messagesLimit: Number.MAX_SAFE_INTEGER, messagesRemaining: Number.MAX_SAFE_INTEGER,
isQuotaExceeded: false, resetTime: null }`; without the flag, unchanged.
Auto-update: guard `if (!IS_GOVERNANCE_FORK()) { updateElectronApp({ … }) }` — verified by
ts + build only (note manual verification in PROGRESS_LOG).
Commit `gov(T12.5): Strip quota/auto-update gates`.

### T12.6 Program close-out

`npm run ts && npm run lint && npm run fmt && npm test && npm run build` — all green except the
Appendix A pre-existing list (quote it). Update `GOVERNANCE_FORK.md` (final state: cord-cut hash,
known deltas vs upstream — including the per-category consent deviation from T7.4 and the
opt-in env flags). Tick every remaining box in the parent plan. Write the retro in
PROGRESS_LOG.md (what worked, what bit us, env quirks). Commit `gov(T12.6): Program close-out`.

---

## Phase gates summary

| Gate | Commands                               | Extra                                                                                                       |
| ---- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| P5   | ts/fmt/lint + suites                   | `npm run build` + new E2E `governance_verification.spec.ts`; PROGRESS_LOG                                   |
| P6   | ts/fmt/lint + suites                   | integration suite green                                                                                     |
| P7   | ts/fmt/lint + suites                   | integration suite green                                                                                     |
| P8   | ts/fmt/lint + suites                   | `rules/windows-spawn.md` read BEFORE T8.2                                                                   |
| P9   | ts/fmt/lint + suites + `npm run build` | E2E `governance_dag.spec.ts` (fake-backend env flag); GOVERNANCE_FORK.md cord-cut; STOP rebasing after this |
| P10  | ts/fmt/lint + suites                   | —                                                                                                           |
| P11  | FULL `npm test` + `npm run build`      | dyadctl smoke                                                                                               |
| P12  | full gates                             | owner checkpoints T12.1–T12.3; close-out                                                                    |

## Appendix A — Pre-existing test failures (NEVER yours to fix)

These fail identically on clean `main` (verified 2026-09-13 in a `/tmp/main-check` worktree):
`src/ipc/utils/git_utils.test.ts`, `.../tools/run_pre_commit.spec.ts`,
`src/ipc/handlers/__tests__/{retry,undo,git_collaboration,voice_to_text}.integration.*`,
`src/ipc/handlers/compaction/compaction_handler.integration.test.ts`,
`src/ipc/handlers/__tests__/local_agent_request.integration.test.ts` (expects a tool list without
`run_pre_commit`). Separately, a volatile set of happy-dom integration suites (chat*annotations,
theme_selection, notification_banner, neon_branch, local_agent_consent, pause_queue,
user_input_follow_up, supabase*\*, github_import) is load-flaky — re-run the file alone before
believing a failure; it passes idle on both branches. If a failure is not in these lists and not
caused by your change, stop-condition 4 → BLOCKED.md.

## Appendix B — Session-boundary rules

End only at a task boundary: clean `git status` (except `graphify-out/`), your tests green,
`npm run ts` green, parent-plan checkboxes accurate, BLOCKED/PROGRESS_LOG updated. Final message:
tasks completed (ids+titles), next task id, any blocker. If context runs low mid-phase, commit
the finished task and stop — the resume protocol in §0 picks up cleanly.
