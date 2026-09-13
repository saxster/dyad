# HANDOFF — Governance Merge, Phases 9–12 (cord-cut & close-out leg)

You are picking up a pre-approved, fully specified implementation program mid-flight. Your
job is disciplined execution of one task at a time — not design, not improvement, not scope
changes.

## 1. Mission context

- **Execution repo (all edits happen here):** `/Users/amar/Desktop/MyCode/dyad` — an
  Electron + React + TypeScript AI app builder. This is the private, company-internal merged
  product. Work on branch `governance/main`.
- **Reference repo (READ-ONLY):** `/Users/amar/Desktop/MyCode/anvil_opencode` — a native
  Swift/macOS spec-first agent workspace, called `ANVIL/` in the plans. Consult its Swift
  sources to port behavior faithfully. NEVER edit, compile, run, or restructure it.
- **Direction (do not second-guess this):** Anvil's Swift governance logic is re-implemented
  as TypeScript inside Dyad. No Swift is shipped or executed. Dyad is never rewritten in
  Swift. Anvil survives untouched as the reference implementation.
- **Where things stand:** Phases 0–8 are COMPLETE and pushed. Phase gates P5 (`74c08593`),
  P6 (`d62390ae`), P7 (`762ecfe7`), and P8 (`6d9dbc86`) all PASSED; verification spine,
  councils & budget, project memory, and multi-runtime dispatch are in and green. HEAD
  `f4d32c42` adds the Phases 9–12 delta execution plan. You are finishing the program:
  **P9 — DAG orchestration (CORD-CUT)**, **P10 — incubation & thoughts**, **P11 — headless &
  autopilot**, and **P12 — Hostinger/Coolify + strip-down close-out**.

## 2. Documents — read in this order; conflicts resolve in this priority

1. `AGENTS.md` at the repo root, in full — repo rules ALWAYS win over any plan.
2. `docs/plans/2026-09-12-governance-merge-tdd-plan.md` — the **parent plan**, single source
   of truth (§1 execution protocol, §2 seam registry, §4 task checkboxes, §5 dependency
   order). §4 checkboxes are the progress record; you tick them as you commit.
3. `docs/plans/2026-09-13-phases-5-12-execution-plan.md` — the **5–12 companion**: full
   per-task RED/GREEN specifications with exact files, seams, hand-worked expected values,
   wiring anchors, verify commands, and commit messages for T9.1–T12.6, plus the seam
   inventory, phase-gate table, and Appendix A pre-existing-failure list. Read each task's
   entry here FIRST.
4. `docs/plans/2026-09-13-phases-9-12-execution-plan.md` — the **9–12 delta plan** (new):
   per-task corrections, exact wiring anchors, hand-worked additions, and baked decisions
   that close the spec gaps discovered during P5–P8 (the `touch` allow-prefix line the DAG
   marker executor needs, the write_spec-cannot-carry-manifest-tasks gap and its on-disk
   E2E seeding resolution, the `BackendEvent.file` extension, `getGovernanceRun` still being
   a typed shell, migration 0054 next, the `node:sqlite` E2E assertion pattern). Apply it ON
   TOP of each companion entry. Its baked decisions are binding and pre-authorized.
   Overall priority: `AGENTS.md`/`rules/` > parent plan > 5–12 companion > delta plan.
5. `docs/plans/PROGRESS_LOG.md` — phase-gate results, known deviations, and environment
   notes from every prior session. Append to it at each phase gate.

## 3. Session preflight (do this before touching anything)

Follow 5–12 companion §0 and delta plan §0 exactly. The essentials: node **24** is required
(`export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` — the default node is 22 and
will fail the engine check); tests need `export TMPDIR=/tmp/dyad-tmp && mkdir -p "$TMPDIR"`;
`npm run build` must run unsandboxed with TMPDIR exported (Forge's temp dir needs it, not
just the electron cache — delete a poisoned
`~/Library/Caches/electron/.../electron-v40.0.0-darwin-arm64.zip` only if Forge reports EPERM
on the cache itself).

Resume order: (a) `docs/plans/BLOCKED.md` if it exists — a blocked task must not be
re-attempted unless its note says the owner cleared it; (b) walk the parent plan §4
checkboxes top-down — the first unchecked task whose prerequisites are committed is your
next task (expect **T9.1**); (c) cross-check `git log --oneline -30` (commits are named
`gov(T<id>): <title>`; gates are `gov(P<n> gate): …`); (d) read `docs/plans/PROGRESS_LOG.md`
(through the "Phases 9–12 delta execution plan" entry). Expect branch `governance/main` at
or after `f4d32c42` and a clean tree except untracked `graphify-out/` — a machine-generated
directory you must NEVER stage or commit. Next drizzle migration number: **0054**.

## 4. How to work every task (no exceptions)

5–12 companion §1 is the loop; obey it exactly:

1. **RED** — create/extend ONLY the test file(s) the task lists. Write exactly the named
   test with the expected values given in the companion, adjusted only where the delta plan
   corrects them (they are hand-worked — never derive expected values by running your
   implementation). `npm test -- <test-file>` must FAIL for the asserted reason. If it
   passes, your test is wrong: fix the test, not the implementation.
2. **GREEN** — the minimum code, in the listed files only, to pass. No speculative
   parameters, options, or branches.
3. **VERIFY** — the task's verify commands, then `npm run ts` (must exit 0).
4. **COMMIT** — tick the task's checkbox in the parent plan in the same commit; run
   `npm run fmt && npm run lint`; stage the task's files and the plan file EXPLICITLY (never
   `git add -A`); commit as `gov(<task-id>): <title>`.

One task at a time, in order: **P9 (cord-cut)** → P10 → P11 → P12, respecting every phase
gate in the gates table (both the 5–12 companion's and the delta plan's).

Hard rules (still in force): never add npm dependencies; never weaken, skip, or delete a
test; never run `npx tsc` / `npx eslint` / `npx prettier` / `npx oxlint` / `npx oxfmt` (use
the npm scripts); never `git push --force` or `git reset --hard`; never hand-edit
`package-lock.json`; never touch anything under `ANVIL/`; no tautological tests; no
refactor-for-refactor (refactor belongs to review). Re-skim `rules/windows-spawn.md` before
the P11 spawn code; `rules/database-drizzle.md` before the T10.4 migration;
`rules/dyad-errors.md` for P9/P10 error kinds.

Known noise you must NOT chase or "fix": oxlint `no-thenable` warnings on EARS `then:` keys
(pre-existing warning class, 0 errors expected), and the pre-existing test failures
enumerated in companion Appendix A (verified identical on clean `main`; the P11 full-suite
gate accepts them — quote the list in PROGRESS_LOG).

**Cord-cut rule (from the P9 gate onward):** once the P9 gate passes and the cord-cut record
is written into `GOVERNANCE_FORK.md`, rebasing onto upstream is FORBIDDEN; upstream changes
are cherry-picked by need only.

## 5. Stop conditions (hard)

Stop the current task, append `<task-id>` + one explanatory paragraph to
`docs/plans/BLOCKED.md`, commit that file, and end the session with a summary when:

1. A test is not green after 3 focused attempts (each attempt changes exactly one thing).
   T9.8-specific: if the `DYAD_GOVERNANCE_FAKE_BACKEND=1` env plumbing for the packaged app
   fights you for >3 attempts, write the blocker — do NOT hack Forge internals.
2. `npm run ts` reports errors in files the task did not list.
3. A new npm dependency seems required (none are).
4. An existing test breaks for a reason unrelated to the new behavior — except Appendix A
   failures, which are never yours to fix. (T12.4-specific: the `GOVERNANCE_FORK` telemetry
   flag is opt-in; any existing telemetry test failing under the default path is this
   condition.)
5. Any instruction conflicts with `AGENTS.md`, `rules/`, or the parent plan.

Do not improvise past a stop condition. A clean stop is a success; a forced green is a
failure.

## 6. Owner checkpoints (do not improvise)

**T12.1** (Coolify-on-VPS validation runbook — requires the owner's VPS), **T12.2** (fix the
first gap found — becomes concrete ONLY from T12.1's gap log; if the owner reports no gap,
close as no-op quoting their confirmation in PROGRESS_LOG), and **T12.3** (generic-Postgres
decision memo — a product decision). Prepare each artifact exactly as the companion
specifies, commit it, and STOP for the owner. Do not simulate findings and do not choose the
Postgres option yourself. If the owner's input is not yet available, end the session there
and proceed no further into P12 beyond the non-checkpoint tasks (T12.4–T12.6 may be done
only after the checkpoints resolve, since T12.6 close-out requires the full picture).

## 7. Session boundaries

Work as many tasks in order as you can while giving each the full loop above. Always end at
a task boundary: clean `git status` (except `graphify-out/`), your tests green, `npm run ts`
green, parent-plan checkboxes accurate, PROGRESS_LOG updated at each phase gate you cross,
and pushed to `origin governance/main`. Your final message must list: tasks completed this
session (ids + titles), the next task id, and any blocker or owner checkpoint — under 20
lines.

## 8. Program definition of done

All §4 checkboxes green; every phase gate in the gates table passed; and the parent plan §7
items: end-to-end governed chat with verified checkpoints (✓ P5), standalone
`sh .dyad/bin/verify-*.sh` (✓ T5.9), headless `dyadctl` run on a fixture app (T11.2 + P11
gate), the Hostinger/Coolify deployment (owner-assisted, T12.1–T12.2), and the final
`GOVERNANCE_FORK.md`/retro (T9.8 cord-cut record + T12.6 close-out).

Begin with the preflight (§3) now. Your first task is **T9.1 — Task graph model + topo
order**.
