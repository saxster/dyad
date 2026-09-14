# Self-hosted Postgres decision memo (generic Postgres vs Neon)

Status: **DECIDED (2026-09-14).** The owner chose **option (b): generic
latest Postgres** — no Neon, no Supabase, no other database vendor — for a
program that **runs locally, not in the cloud**. The follow-up integration
plan this decision spawns lives at
`docs/plans/generic-postgres-integration-plan.md`. The audit below is
retained as the decision's basis.

Question: this fork ships with first-class Neon integration (provisioning,
branching, schema context for the agent). For the private/self-hosted
product, do we (a) keep Neon as the database provider, or (b) add a
generic-Postgres integration so any Postgres (self-hosted, Coolify-deployed,
or any vendor) can be used?

## Where Neon is wired today (read-only audit)

- `src/neon_admin/neon_management_client.ts` — OAuth token refresh against
  Neon's API (`@neondatabase/api-client`), tokens persisted in Dyad
  settings, retry/rate-limit wrapper, error mapping via `neon_errors.ts`.
- `src/neon_admin/neon_context.ts` — project/branch discovery and schema
  snapshots for the agent (uses `@neondatabase/serverless` for data access
  and `ts-pg-schema-diff` for schema SQL).
- `src/neon_admin/neon_prompt_context.ts`, `neon_prompt_rules.ts` —
  prompt-side rules injected for governed/agent turns (RLS-with-JWT caveats,
  "never put DATABASE_URL client-side", etc.).
- `src/neon_admin/neon_return_handler.ts` — post-run handling of Neon
  results.
- Agent tool: `get_neon_project_info`
  (`src/pro/main/ipc/handlers/local_agent/tools/get_neon_project_info.ts`),
  gated by `canUseNeonTools`; companion tools live beside it
  (e.g. `enable_nitro.ts` instructions reference DATABASE_URL when writing
  `server/` code).
- DATABASE_URL itself is mostly a convention the generated apps use
  (server-side only, per the prompt rules) plus redaction handling in env
  files (`src/utils/dotenv_redaction.spec.ts` covers it). Dyad does not
  host Postgres itself; Neon provides the project + branches + connection
  strings.
- Deployment side (`coolify_deploy/`) is database-agnostic today: it builds
  and runs whatever the app declares; if an app needs Postgres, the user
  currently reaches for Neon rather than Coolify's own Postgres service.

## Option (a) — keep Neon

- Zero code movement; everything above keeps working.
- Cost: the private product keeps a hard dependency on a third-party SaaS
  (network egress, accounts, vendor availability) and on Neon-specific
  semantics in agent prompts (branching, Data API/JWT rules).

## Option (b) — generic Postgres integration

Rough, file-level scope estimate (new capability, not a rewrite):

1. New provider module (say `src/postgres_admin/`): accept a plain
   connection string (or Coolify-provisioned Postgres service), verify
   connectivity, list databases/tables. Estimated: 2–4 new files + tests —
   the schema-snapshot machinery in `neon_context.ts` (ts-pg-schema-diff
   based) is provider-neutral and can be extracted/reused.
2. Agent tool parity: `get_postgres_project_info` mirroring
   `get_neon_project_info` (or generalize the tool), gated by the same
   consent machinery. Estimated: 1–2 tools + prompt-rule updates so the
   Neon-specific JWT/RLS caveats apply only to Neon.
3. Settings/UI: a provider selector where Neon credentials live today
   (settings schema addition + Settings page — `rules/adding-settings.md`
   applies). Estimated: settings + snapshot regen.
4. Prompt rules: split `neon_prompt_rules.ts` into provider-neutral rules
   (client-side DATABASE_URL ban) and Neon-specific ones. Estimated:
   prompt snapshot updates.
5. Coolify deploy: optional integration with Coolify's Postgres service so
   a fully self-hosted app+db works with no third party at all. Estimated:
   1 deploy-flow file + tests (this is the piece that makes option (b)
   meaningful for a Coolify-first VPS story).

Ballpark: a mid-size phase of its own (roughly the shape of Phase 8, not a
strip-down task); the schema/agent plumbing is reusable, the account
provisioning half of Neon simply has no generic equivalent.

## Framing (not a recommendation)

- If the private product's apps are expected to keep using Neon projects,
  (a) is strictly cheaper and nothing decays.
- If the goal is a fully self-hosted story (Coolify VPS + no third-party
  database vendor), (b) is required — but it is a build-out, not a
  strip-down, and would deserve its own plan rather than being winged here.

## Open questions for the owner

1. Do any real private apps rely on Neon branching (per-PR databases), or
   only on a single primary database?
2. Is a fully offline deployment (no Neon API reachability) a requirement,
   or is "Neon allowed but not required" acceptable?
3. If (b): should the first target be Coolify's own Postgres service, a
   manually entered connection string, or both?
4. Should Neon-specific prompt rules stay in the prompts when a non-Neon
   provider is selected (harmless but noisy), or be conditionally excluded?
