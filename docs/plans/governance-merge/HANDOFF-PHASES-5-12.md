# HANDOFF — Governance Merge, Phases 5–12 (completion leg)

You are picking up a pre-approved, fully specified implementation program mid-flight. Your job
is disciplined execution of one task at a time — not design, not improvement, not scope changes.

## 1. Mission context

- **Execution repo (all edits happen here):** `/Users/amar/Desktop/MyCode/dyad` — an
  Electron + React + TypeScript AI app builder. This is the private, company-internal merged
  product. Work on branch `governance/main`.
- **Reference repo (READ-ONLY):** `/Users/amar/Desktop/MyCode/anvil_opencode` — a native
  Swift/macOS spec-first agent workspace, called `ANVIL/` in the plans. Consult its Swift
  sources to port behavior faithfully. NEVER edit, compile, run, or restructure it.
- **Direction (do not second-guess this):** Anvil's Swift governance logic is re-implemented as
  TypeScript inside Dyad. No Swift is shipped or executed. Dyad is never rewritten in Swift.
  Anvil survives untouched as the reference implementation.
- **Where things stand:** Phases 0–4 are complete, audited, merged to `main`, and pushed
  (governance commits through `d6cebfc7`, plan docs after). The spec-bundle schemas and
  ArtifactStore, governance DB tables + IPC handlers, LeanLane/AdaptiveRigor routing, and the
  spec-mode plan upgrade (`write_spec` tool, approval gate, SpecReviewPanel) are all in and
  green. You are finishing the program: **Phases 5–12** — verification spine, councils &
  budget, project memory, multi-runtime dispatch, DAG orchestration (cord-cut), incubation &
  thoughts, headless & autopilot, and the Hostinger/Coolify + strip-down close-out.

## 2. Documents — read in this order; conflicts resolve in this priority

1. `AGENTS.md` at the repo root, in full — repo rules ALWAYS win over any plan.
2. `docs/plans/2026-09-12-governance-merge-tdd-plan.md` — the **parent plan**, the single
   source of truth (§1 execution protocol, §2 seam registry, §4 task checkboxes, §5 dependency
   order). §4 checkboxes are the progress record; you tick them as you commit.
3. `docs/plans/2026-09-13-phases-5-12-execution-plan.md` — the **companion execution plan**:
   per-task RED/GREEN specifications with exact files, seams, hand-worked expected values,
   wiring anchors, verify commands, and commit messages for T5.1–T12.6, plus the environment
   preflight (§0), execution protocol (§1), seam inventory (§2–3), phase-gate table, and the
   pre-existing-test-failure appendix. **This is your task list.** If anything in it conflicts
   with the parent plan, the parent plan wins and you stop and report.
4. `docs/plans/PROGRESS_LOG.md` — phase-gate results, known deviations, and environment notes
   from every prior session. Append to it at each phase gate.

## 3. Session preflight (do this before touching anything)

Follow companion plan §0 exactly. The essentials: node **24** is required (`export
PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` — the default node is 22 and will fail the
engine check), tests need `export TMPDIR=/tmp/dyad-tmp && mkdir -p "$TMPDIR"`, and
`npm run build` must run unsandboxed (delete a poisoned
`~/Library/Caches/electron/.../electron-v40.0.0-darwin-arm64.zip` if Forge reports EPERM).

Resume order: (a) `docs/plans/BLOCKED.md` if it exists — a blocked task must not be re-attempted
unless its note says the owner cleared it; (b) walk the parent plan §4 checkboxes top-down — the
first unchecked task whose prerequisites are committed is your next task (expect **T5.1**);
(c) cross-check `git log --oneline -30` (commits are named `gov(T<id>): <title>`);
(d) read `docs/plans/PROGRESS_LOG.md`. Expect branch `governance/main` and a clean tree except
untracked `graphify-out/` — a machine-generated directory you must NEVER stage or commit.

## 4. How to work every task (no exceptions)

Companion plan §1 is the loop; obey it exactly:

1. **RED** — create/extend ONLY the test file(s) the task lists. Write exactly the named test
   with the expected values given there (they are hand-worked — never derive expected values by
   running your implementation). `npm test -- <test-file>` must FAIL for the asserted reason.
   If it passes, your test is wrong: fix the test, not the implementation.
2. **GREEN** — the minimum code, in the listed files only, to pass. No speculative parameters,
   options, or branches.
3. **VERIFY** — the task's verify commands, then `npm run ts` (must exit 0).
4. **COMMIT** — tick the task's checkbox in the parent plan in the same commit; run
   `npm run fmt && npm run lint`; stage the task's files and the plan file EXPLICITLY (never
   `git add -A`); commit as `gov(<task-id>): <title>`.

One task at a time, in companion-plan order: P5 → P6 → P7 → P8 → **P9 (cord-cut)** → P10 →
P11 → P12, respecting every phase gate in the gates table.

Hard rules (still in force): never add npm dependencies; never weaken, skip, or delete a test;
never run `npx tsc` / `npx eslint` / `npx prettier` / `npx oxlint` / `npx oxfmt` (use the npm
scripts); never `git push --force` or `git reset --hard`; never hand-edit `package-lock.json`;
never touch anything under `ANVIL/`; no tautological tests; no refactor-for-refactor (refactor
belongs to review). Read the `rules/` file each area names before entering it (the companion
plan lists them per phase; `rules/windows-spawn.md` is a hard read-gate before T8.2 and any
P11 spawn code).

Known noise you must NOT chase or "fix": oxlint `no-thenable` warnings on EARS `then:` keys
(pre-existing warning class, 0 errors expected), and the pre-existing test failures enumerated
in companion plan Appendix A (verified identical on clean `main`).

## 5. Stop conditions (hard)

Stop the current task, append `<task-id>` + one explanatory paragraph to
`docs/plans/BLOCKED.md`, commit that file, and end the session with a summary when:

1. A test is not green after 3 focused attempts (each attempt changes exactly one thing).
2. `npm run ts` reports errors in files the task did not list.
3. A new npm dependency seems required (none are).
4. An existing test breaks for a reason unrelated to the new behavior — except Appendix A
   failures, which are never yours to fix.
5. Any instruction conflicts with `AGENTS.md`, `rules/`, or the parent plan.

Do not improvise past a stop condition. A clean stop is a success; a forced green is a failure.

## 6. Owner checkpoints (do not improvise)

T12.1 (Coolify-on-VPS runbook), T12.2 (fix the first gap), and T12.3 (Postgres decision memo)
require the owner — a VPS and a product decision. Prepare the artifact exactly as the companion
plan specifies, commit it, and stop for the owner. Do not simulate findings and do not choose
the Postgres option yourself.

## 7. Session boundaries

Work as many tasks in order as you can while giving each the full loop above. Always end at a
task boundary: clean `git status` (except `graphify-out/`), your tests green, `npm run ts`
green, parent-plan checkboxes accurate, PROGRESS_LOG updated at each phase gate you cross, and
push to `origin governance/main`. Your final message must list: tasks completed this session
(ids + titles), the next task id, and any blocker or owner checkpoint — under 20 lines.

## 8. Program definition of done

All §4 checkboxes green; every phase gate in the companion-plan gates table passed; and the
parent plan §7 items: end-to-end governed chat with verified checkpoints, standalone
`sh .dyad/bin/verify-*.sh`, headless `dyadctl` run on a fixture app, the Hostinger/Coolify
deployment (owner-assisted), and the final `GOVERNANCE_FORK.md`/retro.

Begin with the preflight (§3) now. Your first task is **T5.1 — Contract extraction**.
