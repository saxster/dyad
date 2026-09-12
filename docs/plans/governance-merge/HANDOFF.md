# HANDOFF — Governance Merge Implementation Session

You are picking up a pre-approved, fully specified implementation program. Your job is
disciplined execution of one task at a time — not design, not improvement, not scope changes.
The plan is the single source of truth. If anything in this prompt conflicts with the plan,
the plan wins; if the plan conflicts with `AGENTS.md` or `rules/`, the repo rules win and you
stop and report.

## 1. Mission context

We are merging the governance "brain" of one product into the product chassis of another:

- **Execution repo (all edits happen here):** `/Users/amar/Desktop/MyCode/dyad` — an
  Electron + React + TypeScript AI app builder. This becomes the private, company-internal
  merged product.
- **Reference repo (READ-ONLY):** `/Users/amar/Desktop/MyCode/anvil_opencode` — a native
  Swift/macOS spec-first agent workspace. Consult its Swift sources to port behavior
  faithfully. NEVER edit, compile, run, or restructure it. In the plan it is called `ANVIL/`.
- **Direction (do not second-guess this):** Anvil's Swift governance logic is re-implemented
  as TypeScript inside Dyad. No Swift is shipped or executed by the merged product. Dyad is
  never rewritten in Swift. Anvil survives untouched as the reference implementation.

The end state: a governed Dyad where intent becomes an approved EARS spec with executable
verification contracts, implementation runs through tiered rigor with councils and budgets,
checkpoints carry verification evidence, memory persists across sessions, and runs can go
headless — deploying company apps to a Hostinger VPS via Coolify.

## 2. The plan (single source of truth)

`docs/plans/2026-09-12-governance-merge-tdd-plan.md`

Read §1 (execution protocol), §2 (seam registry), §3 (target architecture) in full before
your first task. §4 holds the phases and tasks with progress checkboxes. §5 is the dependency
order, §6 risks, §7 the program's definition of done.

The seam registry in §2 is pre-agreed with the owner. Never write a test at a seam that is
not in that table.

## 3. Session preflight (do this before touching anything)

1. Read `AGENTS.md` at the repo root, in full.
2. Read the plan §1–§3 in full; skim the §4 task headers.
3. `git status` — must be clean. `git branch --show-current`:
   - If `governance/main` does not exist, you are starting fresh: your first task is **T0.1**.
   - If it exists, you are resuming (see step 5).
4. Toolchain check: `ls node_modules/.bin/oxfmt` must succeed. If not, run `npm install`
   (see `AGENTS.md` for worktree/`node_modules` failure modes and remedies).
5. Find your resume point, in this order of authority:
   a. Read `docs/plans/BLOCKED.md` if it exists — a blocked task must not be re-attempted
   in this session unless the block note says it was cleared by the owner.
   b. Walk §4 checkboxes top-down; the first unchecked task whose prerequisites (per §5)
   are all committed is your next task.
   c. Cross-check with `git log --oneline -20` — commits are named `gov(T<id>): <title>`.
   d. Read `docs/plans/PROGRESS_LOG.md` if it exists for phase-gate notes.

## 4. How to work every task (no exceptions — plan §1.1 wins if terse here)

1. **RED** — Create or extend ONLY the test file(s) the task lists. Write exactly the test
   the task names. Run `npm test -- <test-file>`. It must FAIL for the asserted reason.
   If it passes, your test is wrong: fix the test, do not write implementation.
2. **GREEN** — Write the minimum code, in the files the task lists, to pass. No extra
   parameters, options, or branches that no test demands.
3. **VERIFY** — Run the task's verify commands, then `npm run ts`. All green.
4. **COMMIT** — `npm run fmt && npm run lint && git add -A && git commit -m "gov(<task-id>): <title>"`.
   Include the plan-file checkbox tick for the task in the same commit.
   (Until T0.4 lands the pre-commit hook, you run fmt/lint manually as shown.)

Hard rules:

- One task at a time, strictly in §4 order, respecting §5 dependencies. Never batch phases.
- Before entering an area, read the rule files §1.3 names for it (e.g. `rules/electron-ipc.md`
  before any IPC task, `rules/database-drizzle.md` before schema tasks,
  `rules/windows-spawn.md` before any CLI spawn code, `rules/local-agent-tools.md` before
  agent-tool tasks).
- NEVER: add npm dependencies; edit files a task does not list (except the exact
  import/registration lines a task calls for); weaken, skip, or delete a test; run
  `npx tsc` / `npx eslint` / `npx prettier` / `npx oxlint` / `npx oxfmt`; `git push --force`;
  `git reset --hard`; hand-edit `package-lock.json`; touch anything under `ANVIL/`.
- No tautological tests: expected values come from hand-worked examples or Anvil's real
  artifacts/fixtures — never from running your own implementation.
- No refactor-for-refactor: refactoring belongs to review, not the red-green loop.

## 5. Stop conditions (plan §1.4 — hard)

Stop the current task and append `task-id` + one explanatory paragraph to
`docs/plans/BLOCKED.md`, commit that file, and end the session with a summary when:

1. A test is not green after 3 focused attempts (each attempt changes exactly one thing).
2. `npm run ts` reports errors in files the task did not list.
3. A new npm dependency seems required (none are required by this plan).
4. An existing test breaks for a reason unrelated to the new behavior.
5. Any instruction conflicts with `AGENTS.md`, `rules/`, or the plan itself.

Do not improvise past a stop condition. A clean stop is a success; a forced green is a failure.

## 6. Session boundaries

- Work as many tasks in order as you can while giving each the full loop above.
- Always end at a task boundary: clean `git status`, your tests green, `npm run ts` green,
  plan checkboxes accurate, `BLOCKED.md`/`PROGRESS_LOG.md` updated if applicable.
- Your final message must list: tasks completed this session (ids + titles), the next task
  id, and any blocker written. Keep it under 20 lines.

## 7. Command reference (the only supported invocations)

| Purpose                                    | Command                             |
| ------------------------------------------ | ----------------------------------- |
| Targeted test                              | `npm test -- path/to/file.test.ts`  |
| Type-check                                 | `npm run ts`                        |
| Lint / autofix                             | `npm run lint` / `npm run lint:fix` |
| Format                                     | `npm run fmt`                       |
| Migration after schema edit                | `npm run db:generate`               |
| Run app locally (only when a task says so) | `npm start`                         |
| Rebuild before E2E phase gates             | `npm run build`                     |

## 8. If you are starting completely fresh

Your first three tasks are mechanical: T0.1 (create branch `governance/main` from `main`),
T0.2 (write `GOVERNANCE_FORK.md` per the task text), T0.3 (Pro unlock — your first red-green
cycle). Then continue in order. The first genuinely ported logic arrives in Phase 1 (spec
bundle schemas), where T1.2 has you copy a sanitized fixture from
`ANVIL/.anvil/specs/bundle.json` into `src/governance/__fixtures__/`.

Begin with the preflight (§3) now.
