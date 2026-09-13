# Governance Merge — Phases 9–12 Execution Plan (fresh-session, Flash-executable)

**Executor:** GLM 5.3 Flash, one task at a time, RED→GREEN→VERIFY→COMMIT.
**This is a DELTA plan.** Full per-task RED/GREEN text lives in the 5–12 companion
(`docs/plans/2026-09-13-phases-5-12-execution-plan.md`, tasks T9.1–T12.6) — read each task's
entry there FIRST, then apply this plan's corrections, wiring anchors, and baked decisions on
top. Conflict order: `AGENTS.md`/`rules/` > parent plan > 5–12 companion > THIS plan.

**Execution repo:** `/Users/amar/Desktop/MyCode/dyad`, branch `governance/main`.
**Reference (READ-ONLY):** `/Users/amar/Desktop/MyCode/anvil_opencode` (`ANVIL/`).

---

## 0. Resume state (verify before T9.1; expected, not assumed)

- HEAD `6d9dbc86` (`gov(P8 gate): Multi-runtime dispatch suites green`), pushed, tree clean
  except untracked `graphify-out/` (NEVER stage it). No `docs/plans/BLOCKED.md`.
- Gates P5–P8 PASSED (see `docs/plans/PROGRESS_LOG.md`); parent-plan §4 checkboxes ticked
  through T8.8. First unchecked task = **T9.1**.
- Env: `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` (node 24 required) and
  `export TMPDIR=/tmp/dyad-tmp && mkdir -p "$TMPDIR"` for every test run. `npm run build`
  unsandboxed with TMPDIR exported (Forge temp dir).
- Next drizzle migration number: **0054**.

## 1. Loop (unchanged; condensed)

Per task: RED (exact named test, hand-worked values, must fail for the asserted reason) →
GREEN (minimum code, listed files only) → VERIFY (task commands + `npm run ts` exit 0) →
COMMIT (`npm run fmt && npm run lint`; stage task files + parent plan EXPLICITLY; message
`gov(<task-id>): <title>`; tick the parent-plan checkbox in the same commit). Push at each
phase gate. Stop conditions: 3 focused attempts / ts errors outside listed files / new
dependency / unrelated test break (except Appendix A) / conflicts with rules or parent plan →
write `docs/plans/BLOCKED.md`, commit, end session.

## 2. Reusable modules (already built in P5–P8 — do NOT rebuild)

| Need                                            | Use                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contracts flatten / run / safety gate           | `src/governance/verification/{extract_contracts,contract_runner}.ts` — `extractContracts(bundle)`, `runContracts(contracts,{cwd,timeoutMs,runCommand?})`, `isSafeVerificationCommand` (deny-then-allow: allow prefixes are `npm test, npm run, node␣, npx tsc, git diff, test␣, sh␣` — **`touch` NOT yet allowed**, see T9.8) |
| Backend protocol                                | `src/governance/backends/types.ts` — `BackendEvent{type:"started"\|"output"\|"completed"\|"failed";node?;text?;exitCode?;error?}`, `BackendTask{id,prompt,cwd}`, `GovernedBackend.dispatch(task): AsyncIterable<BackendEvent>`                                                                                                |
| Builtin backend / registry / dispatch           | `createBuiltinBackend(executor)`; `createRegistry({builtin,external:[{backend,score,available?}]})` with `routeBackend(tier)`; `dispatchGovernedTask(appId,task,registry?)` (records `backend_<type>` run events via `appendRunEvent`)                                                                                        |
| Run events / handlers                           | `src/ipc/handlers/governance_handlers.ts` — `appendRunEvent(runId,type,payload)` (seq-ordered), `stampVerification`, `resolveGate` handler, `runGovernedTurnVerification`                                                                                                                                                     |
| Contracts (preload-safe, relative imports only) | `src/ipc/contracts/governance_contracts.ts` — existing: save/get/history/approve spec bundle, `getGovernanceRun` (**typed shell — handler implemented in T9.7**), `getVersionVerification`, `resolveGate`. New channels added to the same object auto-allowlist                                                               |
| Query keys                                      | `src/lib/queryKeys.ts` `governance.{all,specBundle,specHistory,versionVerification}` — extend in T9.7/T10.6                                                                                                                                                                                                                   |
| Settings                                        | no new settings in P9–P12 (no snapshot regen needed)                                                                                                                                                                                                                                                                          |
| E2E DB assertion pattern                        | Node builtin `node:sqlite` `DatabaseSync(<userData>/sqlite.db,{readOnly:true})` inside `expect(...).toPass({timeout})` — see `e2e-tests/governance_verification.spec.ts`                                                                                                                                                      |
| Harness gotchas                                 | fake-server dump MASKS system messages (assert via `ServerDumpResult.dumpPath` raw read); fake model governed turns arrive as text and cannot execute real writes (seed app state from the test); engine fake-fetch shapes per provider (anthropic `/v1/messages`, gemini/xai `/v1/chat/completions`, openai `/v1/responses`) |

Chat-stream anchors (symbolic; line numbers drift): governance routing block right after
`assertChatModeCompatibleWithModel`; approval gate + gate_open check inside the
`governanceDecision?.lane === "governed"` block; `let systemPrompt = constructSystemPrompt({`
(with the T7.5 memory injection immediately after); governed local-agent branch is
`if (isLocalAgentMode)` (contains the T5.7 turn-end hook after `streamSuccess`); terminal
`chat:response:end` payload blocks (`terminalResponse`) at the end of the stream try-block —
copy their exact payload shape when the DAG path emits its own end events.

---

# Phase 9 — DAG orchestration & worktrees (CORD-CUT). Full spec: 5–12 companion T9.1–T9.8.

### T9.1 Task graph model + topo order

Files: `src/governance/core/task_graph.ts/.test.ts` (Seam S1).
`TaskNode{id;title?;deps:string[];stories?:string[]}`; `topoOrder(nodes)` Kahn's, cycle →
`Error("cycle detected: <ids>")`; `readySet(nodes, completed:Set<string>)` = not-completed ids
with deps ⊆ completed. RED per companion (diamond pairwise-deps assertion, cycle throw,
readySet cases). Commit `gov(T9.1): Task graph model + topo order`.

### T9.2 Backpressure

Same files. `runWithBackpressure(nodes,{runner,maxConcurrent=4})` — schedule ready nodes, cap
in flight, admit on completion, first rejection propagates, resolve with per-node results in
topo order. RED: 10 independent nodes with manually-resolved promises tracking
`maxObserved<=4`; dep test b-after-a timestamps. Commit `gov(T9.2): Backpressure`.

### T9.3 Extract worktree isolation utility (mechanical; NO new test)

Files: NEW `src/ipc/utils/app_worktree.ts` wrapping/re-exporting `createBuildWorktree` and
`removeSnapshot` moved out of `run_build.ts` (identical signatures; `run_build.ts` imports
from the new module). First `ls src/pro/main/ipc/handlers/local_agent/tools/run_build*` for
the exact suite filenames; verify those suites unchanged-green + `npm run ts`. If the move
creates import cycles, keep the functions in `run_build.ts` and make `app_worktree.ts` a thin
re-export module instead — either shape satisfies the task. Commit
`gov(T9.3): Extract worktree isolation utility`.

### T9.4 Orchestrator happy path

Files: `src/governance/runs/dag_orchestrator.ts` + test (Seam S1 + injected factories).
`executeDag(nodes, deps:{backendFor(node):GovernedBackend; worktreeFor(node):Promise<string>;
onEvent(type,payload):void})` → `{status:"completed"|"partial"; results:Record<id,string>;
completed:string[]; blocked:string[]}` (results = last `output` text per node, keys inserted
in `topoOrder` order). Runs via T9.2. Worktree per node (test factory = `mkdtemp`; assert
dirs exist on disk after run). Events: `node_started`/`node_completed` per node.
Conflicts: when a completed event carries `file` and two nodes report the same file →
`onEvent("node_conflict",{file,nodes})`. **Baked type change (authorized):** add optional
`file?: string` to `BackendEvent` in `src/governance/backends/types.ts` (minimal, additive;
test fakes yield it on `completed`). RED per companion (3-node DAG a→(b,c), distinct
worktrees, events, result key order `[a,b,c]`; conflicting pair → `node_conflict`).
Commit `gov(T9.4): Orchestrator happy path`.

### T9.5 Failure + partial continuation

Same files. Downstream-of-failure: a fails → d (dep a) gets `node_blocked`; independent
subtree c completes; resolves `{status:"partial",completed:["c"],blocked:["d"]}` (exact
arrays per the built graph). Budget: injected `BudgetGovernor(0)`-style throw on node b
(record inside the fake backendFor runner) → whole `executeDag` REJECTS with kind
`BudgetExceeded`. Commit `gov(T9.5): Failure + partial continuation`.

### T9.6 Manifest → DAG compiler

Files: `src/governance/core/manifest_to_graph.ts` + test (Seam S1). Nodes from
`bundle.manifest.tasks`: `{id, title, deps: dependsOnTitles.map(title→task id), stories:
linkedStoryIds}` (unknown title → `Error("unknown dependency title: …")` — one guard test).
RED per companion: parse the fixture bundle, rewrite `manifest.tasks` with 2 tasks (second
`dependsOnTitles:[first.title]`, `linkedStoryIds:["US-1"]`); ManifestTask required fields are
`id,title,description,estimatedPhase,status,requiresTestFirst,dependsOnTitles,
linkedComponentIds,linkedCriterionIds,linkedStoryIds` (+optional `verificationContract`) —
build the literal exactly to the zod shape. Commit `gov(T9.6): Manifest → DAG compiler`.

### T9.7 RunTimeline UI + getGovernanceRun/getLatestGovernanceRun

Files: `src/components/governance/RunTimeline.tsx` + colocated test (Seam S10, props only);
`src/ipc/contracts/governance_contracts.ts` (+`getLatestGovernanceRun:{appId}→run|null`,
same output shape as `getGovernanceRun`); `governance_handlers.ts` (implement BOTH handlers:
run+events rows → `{...,startedAt/endedAt: ISO, events:[{seq,type,payload:
JSON.parse(payloadJson),at:ISO}]}`; missing run → `DyadError NotFound` / latest → null);
`queryKeys.governance.run({runId})` + `.latestRun({appId})`; mount `<RunTimeline>` at the
bottom of `SpecReviewPanel.tsx` when a latest run exists (useQuery latestRun → useQuery run;
`nodes: []` placeholder, `events` mapped to `{seq,type,at}` — node-status derivation is
deferred wiring, not tested here). Component RED per companion: five states
pending/running/green/red/blocked with testid `run-node-<id>`, event list, empty events →
empty list. Handler RED: seed run + events, assert `governance:get-run` round-trip and
`governance:get-latest-run` newest-first/null. Commit `gov(T9.7): RunTimeline UI`.

### T9.8 Cord-cut record + P9 GATE

1. **Wiring** in `chat_stream_handlers.ts`, governed-lane branch (place right after the
   approval-gate block passes, BEFORE mode dispatch): when
   `process.env.DYAD_GOVERNANCE_FAKE_BACKEND === "1"` and the approved bundle has
   `manifest.tasks.length > 0` → instead of the LLM stream: load bundle, `executeDag(
manifestToGraph(bundle), { backendFor: () => defaultGovernedBuiltin, worktreeFor: async ()
=> mkdtemp, onEvent: (type,payload) => appendRunEvent(latestRunId, "dag_"+type, payload) })`
   wrapped in try/catch (`log.warn` on failure, fall through to the normal stream), then on
   success: update the placeholder assistant message content to
   `` `DAG completed: ${completed.join(", ")}` ``, `safeSend` a `chat:response:chunk` with the
   full text, then a `chat:response:end` payload copied EXACTLY from the existing
   `terminalResponse` shape, and `return req.chatId`.
2. **Baked one-line safety-gate addition (authorized edit to a P5 file):** add `"touch "` to
   `ALLOW_PREFIXES` in `src/governance/verification/contract_runner.ts` — the default builtin
   registry executes node prompts through `runContracts`, whose allow-list would otherwise
   refuse `touch <id>.done`. Deny patterns still apply first. Extend the T5.3 allow-list
   `it.each` with `"touch node-a.done"` → `true` (one line; not a weakening).
3. **Marker executor:** node prompts are `` `touch ${node.id}.done` `` run by
   `dispatchGovernedTask`'s default registry in each node's worktree.
4. **E2E** `e2e-tests/governance_dag.spec.ts` + fixture `governance-dag-flow.ts`: copy the
   preamble/flow from `governance_verification.spec.ts`. **Manifest gap (baked resolution):
   `write_spec` cannot carry manifest tasks (stories-only schema), so seed them on disk** —
   run the real write_spec→Approve UI flow (DB row becomes approved), then AFTER approval
   rewrite `<appDir>/.dyad/specs/bundle.json` from the test (parse, set `manifest.tasks` to
   `[{id:"node-a",title:"Node A",description:"",estimatedPhase:"",status:"",
requiresTestFirst:false,dependsOnTitles:[],linkedComponentIds:[],linkedCriterionIds:[],
linkedStoryIds:[]},{id:"node-b",title:"Node B",…,dependsOnTitles:["Node A"],…}]`), switch
   to local-agent mode, send the governed prompt, assert page text `DAG completed`
   (fallback if the completion snapshot races: the §2 `node:sqlite` messages assertion).
   **Env flag plumbing:** read `e2e-tests/helpers/fixtures.ts`'s `electron.launch` call;
   Playwright's Electron launcher accepts `env` — thread a fixture option (e.g.
   `launchEnv`) through, or set `DYAD_GOVERNANCE_FAKE_BACKEND: "1"` in the launch env for
   this spec only. >3 attempts fighting it → BLOCKED.md per stop-condition 1 (do NOT hack
   Forge internals).
5. **Cord-cut record:** append to `GOVERNANCE_FORK.md` — `## Cord-cut (Phase 9)` with
   divergence commit (`git rev-parse HEAD`), date, last absorbed upstream commit
   (`git rev-parse main`), and the rule: NO rebase from here on; upstream changes are
   cherry-picked by need.
   **P9 GATE:** `npm run ts && npm run fmt && npm run lint`; targeted suites green; `npm run
build` (unsandboxed); `npx playwright test e2e-tests/governance_dag.spec.ts
--timeout=180000`; PROGRESS_LOG entry; push. Commit `gov(T9.8): Cord-cut record`.

---

# Phase 10 — Incubation & thoughts. Full spec: companion T10.1–T10.6.

- **T10.1** `src/governance/core/incubation_state.ts/.test.ts` (S1): stages
  ideate→specify→challenge→commit→build; `nextIncubationStage(current, event?)`; forward one
  step only; regress exactly one; advance INTO commit requires hypothesis payload with ≥1
  successCriteria (`Error("hypothesis payload required")` otherwise; `successCriteria: []`
  also errors). Full table per companion. Commit `gov(T10.1): Incubation state machine`.
- **T10.2** extend `src/governance/artifacts/artifact_store.ts` + test (S2): exported fns
  `saveIncubationSession(root,{id,stage,createdAt,…})` →
  `<root>/.dyad/incubation/sessions/<id>/session.json`; `loadIncubationSession(root,id)`
  deep-equal round-trip; `appendTranscript(root,id,line)` appends `line+"\n"` to
  `transcript.md` (creates; two appends → two lines; read back split(/\r?\n/)).
  Commit `gov(T10.2): Incubation session persistence`.
- **T10.3** `src/governance/core/hypothesis_to_spec.ts` + test (S1):
  `seedSpecBundleFromHypothesis(h,{now}={})` — copy the EMPTY skeleton section literals
  verbatim from `write_spec.ts`'s bundle construction (read it first; do NOT refactor it).
  Story: `US-1`, title `"Hypothesis: "+h.hypothesis.slice(0,60)`, narrative
  `` `As a user I want ${h} so that ${successCriteria[0]}` ``, criteria
  `h.successCriteria.map((c,i)=>({id:"AC-"+(i+1),given:"the system is in its current state",
when:c,then:"the criterion holds"}))` — NO verificationContract keys; `rawIntent=problem`;
  `approvalStatus:"draft"`. Hand-worked RED per companion (`{P1,H1,[S1,S2]}`).
  Commit `gov(T10.3): Hypothesis → spec bridge`.
- **T10.4** tables `thoughts`+`thought_edges` in schema.ts + migration **0054**; impl+test
  `src/governance/memory/thought_store.ts/.test.ts` (S8, T7.1 pattern):
  `ThoughtStore.record(appId,{body,tags?})` (tags ↔ JSON), `list(appId,{tag?,status?})`,
  `promoteToTodo(id)` (none→todo, todo no-op, done→DyadError Conflict), `markDone(id)`
  (todo→done; none→Conflict), `link(from,to,kind="related")`. RED per companion.
  Commit `gov(T10.4): Thoughts table + capture`.
- **T10.5** `src/governance/core/constellations.ts/.test.ts` (S1):
  `detectConstellations(thoughts,{minSize=3,minSharedTags=2,threshold=0.5})` — maximal
  subsets where every pair shares ≥2 tags AND Jaccard ≥0.5; `dominantTags` = tags in ≥ half
  the members, ordered member-count desc then alpha; O(n³) fine. Hand-worked RED per
  companion (A{a,b,c},B{a,b,d},C{a,b,e} → one constellation dominant ["a","b"]; D{x,y} in
  none; two-thoughts → []; D{a} excluded by pair-share).
  Commit `gov(T10.5): Constellation detection`.
- **T10.6** `src/components/governance/ThoughtPanel.tsx` + colocated test (S10 props only);
  contracts `startIncubation{appId,body}→{sessionId}` + `listThoughts{appId}→
{thoughts:[{id,body,tags:string[],todoStatus}]}` in governance_contracts.ts (relative
  imports); handlers in governance_handlers.ts (+tests: start creates a T10.2 session stage
  `ideate` with transcript seeded, and when body non-empty ALSO saves the T10.3 draft bundle
  via ArtifactStore; list round-trips). Component: textarea placeholder `Capture a thought…`,
  ⌘⏎/Ctrl+⏎ submit, All/Todo/Tags tabs filtering the `thoughts` prop, `Promote to
incubation` button → `onStartIncubation(id)` callback. Mount at SpecReviewPanel bottom with
  `useQuery(queryKeys.governance.thoughts({appId}))` + a startIncubation mutation (wiring
  only). **P10 GATE:** ts/fmt/lint + suites. Commit `gov(T10.6): Thought panel (minimal)`.

---

# Phase 11 — Headless & autopilot. READ `rules/windows-spawn.md` (already read once this

# program — re-skim). Full spec: companion T11.1–T11.6.

- **T11.1** guard test `src/governance/__tests__/no_electron_imports.test.ts` (new dir):
  recursive readdir of `src/governance/**`, skip `.test.`, assert no `/from\s+"electron"/`.
  GREEN immediately (goal state); prove non-vacuity ONCE by temporarily adding
  `import "electron";` to `lane_screen.ts`, seeing it fail, reverting — record in the commit
  message. Commit `gov(T11.1): Engine callable without Electron`.
- **T11.2** `scripts/dyadctl.mjs` (plain Node ESM, ZERO repo imports, self-contained);
  test `src/governance/headless/dyadctl.test.ts` spawning
  `node <resolve(process.cwd(),"scripts/dyadctl.mjs")> run --app <dir> --prompt x --json`.
  Behavior: read `<dir>/.dyad/specs/bundle.json` (plain JSON, missing → `verifications: []`,
  status completed); INLINE flatten stories→criteria→verificationContract, key
  `${story.id}/${criterion.id}`; run each via `spawn("sh",["-c",cmd],{cwd:dir})` with a 30s
  timeout (own timer + kill — no runContracts, no safety gate); stdout =
  `JSON.stringify({status:"completed",verifications:[{key,status:"green"|"red"|"timeout",
exitCode}],versions:[]})`; `--prompt -` reads stdin (untested). RED: tmp dir seeded with a
  hand-written minimal `bundle.json` (NOT the full zod shape — dyadctl reads it raw) whose
  US-1/AC-1 contract is `test -f package.json`, plus a copied
  `e2e-tests/fixtures/import-app/minimal/package.json`; green and red cases.
  Commit `gov(T11.2): dyadctl CLI entry`.
- **T11.3** `src/governance/headless/rpc_server.ts` + test (S3):
  `createGovernanceRpcServer({socketPath,handlers})` via `node:http` +
  `server.listen(socketPath)`, then `chmodSync(socketPath,0o700)`. JSON-RPC 2.0: `initialize`
  → `{protocol:"governance-rpc/1"}`; `execute` → handlers.execute(params); `status` →
  handlers.status(); `shutdown` → close + resolve. >1 MiB body → error `-32600` then destroy;
  unknown method `-32601`; malformed JSON `-32700`. Test client: `http.request({socketPath})`.
  RED per companion incl. `stat().mode & 0o777 === 0o700`.
  Commit `gov(T11.3): Unix-socket RPC server`.
- **T11.4** same files: `createGovernanceEngine({startRun})` state machine
  idle→running→completed|failed wired as the RPC handlers. RED: execute → `{runId:"run-1"}`;
  status running; await startRun → completed; rejecting startRun → failed with message.
  Commit `gov(T11.4): RPC ↔ engine wiring`.
- **T11.5** `src/governance/headless/issue_intake.ts` + test (S3). NOTE the runCommand
  signature here is TWO-ARG (unlike cli_detect): `runCommand(command, argv[])`.
  `fetchIssueDetails(repo,issueNumber,{runCommand})` runs `("gh",["issue","view",String(n),
"--repo",repo,"--json","title,body,url"])`; parse → `{rawIntent:title+"\n\n"+body,
metadata:{source:"github-issue",url,repo,issueNumber}}`; nonzero → DyadError External.
  Hand-worked RED per companion (`{"title":"T","body":"B","url":"U"}` → `"T\n\nB"`).
  Commit `gov(T11.5): GitHub issue intake`.
- **T11.6** same module + test: `autopilotRun({repo,issueNumber},deps{runCommand(recording
fake),fetchIssue,executeRun})` — ordered argv: gh issue view → `git checkout -b
auto/issue-<n>` → executeRun → `git add -A` → `git commit -m "fix(issue <n>): <title>"` →
  `git push -u origin HEAD` → `gh pr create --draft --title "Issue #<n>: <title>"
--body-file -` (body via stdin; assert it contains the title). Failure path (executeRun
  throws): still pushes + creates the draft PR with a body containing `Verification report`
  and the failure message. Assert the exact ordered argv sequence both paths.
  **P11 GATE:** FULL `npm test` (Appendix A failures acceptable — QUOTE the list in
  PROGRESS_LOG; happy-dom load-flaky suites: re-run alone before believing a failure) +
  `npm run build` + dyadctl smoke re-run. Commit `gov(T11.6): Autopilot loop`.

---

# Phase 12 — Hostinger/Coolify + strip-down. Full spec: companion T12.1–T12.6.

- **T12.1 ⏸ OWNER CHECKPOINT** — write `docs/plans/hostinger-coolify-runbook.md` template
  (read `src/coolify_setup/{capabilities,commands,build_config}.ts` first; list exact Dyad
  steps: Settings → Coolify → server URL + API token; deploy `e2e-tests/fixtures/import-app/
minimal`; custom domain; `## Gaps hit` table step/expected/actual/blocked?). Commit
  `gov(T12.1): Coolify-on-VPS validation runbook` and STOP for the owner.
- **T12.2 ⏸ OWNER INPUT** — placeholder; concrete ONLY from T12.1's gap log; no gap + owner
  confirmation → close as no-op quoting the confirmation in PROGRESS_LOG. Do not invent work.
- **T12.3 ⏸ OWNER DECISION** — write `docs/plans/self-hosted-postgres.md` (read-only audit:
  `src/neon_admin/` file listing + responsibilities, `get_neon_project_info` tool, every
  `DATABASE_URL` flow; options (a) keep Neon vs (b) generic-Postgres with file-level scope
  estimate; recommendation framing + open questions — DO NOT choose). Commit
  `gov(T12.3): Generic Postgres decision memo` and STOP for the owner.
- **T12.4** telemetry strip (opt-in `GOVERNANCE_FORK=1`): RED FIRST in
  `src/ipc/utils/telemetry.test.ts` — `vi.hoisted` sets the env, `vi.resetModules()` +
  dynamic import, `global.fetch = vi.fn(()=>{throw new Error("network")})`;
  `sendTelemetryEvent("x",{})` and `sendTelemetryException` still resolve. GREEN: module-load
  `const IS_GOVERNANCE_FORK = process.env.GOVERNANCE_FORK === "1";` short-circuits
  sendTelemetryEvent / sendTelemetryEventToWindow / sendTelemetryException (no PostHog init).
  Default behavior UNCHANGED — if any existing telemetry test fails, stop-condition 4 →
  BLOCKED.md. Update GOVERNANCE_FORK.md usage note. Commit `gov(T12.4): Strip telemetry`.
- **T12.5** quota/auto-update gates: NEW `src/shared/governance_fork.ts` (no imports,
  preload-safe): `export const isGovernanceFork = () => process.env.GOVERNANCE_FORK === "1";`
  Grep the real free-agent quota handler filename first. With flag: quota endpoints return
  `{messagesLimit:Number.MAX_SAFE_INTEGER,messagesRemaining:Number.MAX_SAFE_INTEGER,
isQuotaExceeded:false,resetTime:null}`; without: unchanged (RED: extend the quota handler
  test both ways — call-time check, no resetModules needed). `src/main.ts`
  `updateElectronApp({…})` (~line 630) guarded `if (!isGovernanceFork())` — verified by
  ts + build only; note manual verification in PROGRESS_LOG.
  Commit `gov(T12.5): Strip quota/auto-update gates`.
- **T12.6** close-out: `npm run ts && npm run lint && npm run fmt && npm test && npm run
build` green except the quoted Appendix A list; GOVERNANCE_FORK.md final state (cord-cut
  hash, deltas vs upstream incl. the T7.4 per-category-consent deviation, the T7.3 0.461
  literal fix, and the opt-in env flags); tick every remaining parent-plan box; retro in
  PROGRESS_LOG (what worked / what bit us / env quirks). Commit
  `gov(T12.6): Program close-out`.

---

## Phase gates (P9–P12)

| Gate | Commands                               | Extra                                                                                              |
| ---- | -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| P9   | ts/fmt/lint + suites + `npm run build` | E2E `governance_dag.spec.ts` (env flag); GOVERNANCE_FORK.md cord-cut; **STOP rebasing after this** |
| P10  | ts/fmt/lint + suites                   | —                                                                                                  |
| P11  | FULL `npm test` + `npm run build`      | dyadctl smoke; quote Appendix A                                                                    |
| P12  | full gates                             | owner checkpoints T12.1–T12.3; close-out + retro                                                   |

## Session rules (unchanged)

- Never stage `graphify-out/`; explicit `git add`; never add npm deps; never
  `npx tsc/eslint/prettier/oxlint/oxfmt`; never force-push/reset-hard; never touch `ANVIL/`.
- Known noise: EARS `then:` oxlint warnings (0 errors expected); Appendix A pre-existing
  failures (never yours to fix); happy-dom load-flaky suites (re-run alone).
- End every session at a task boundary: clean tree (except `graphify-out/`), tests green,
  `npm run ts` green, checkboxes accurate, PROGRESS_LOG current, pushed to
  `origin governance/main`. Final message: tasks done (ids+titles), next task id, blockers /
  owner checkpoints — under 20 lines.
- Owner checkpoints T12.1–T12.3 are HARD STOPS: prepare the artifact, commit, stop.
