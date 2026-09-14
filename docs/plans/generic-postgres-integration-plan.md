# Generic Postgres integration plan (follow-up from T12.3)

Status: **PLAN — not yet scheduled.** Spawned by the T12.3 decision
(2026-09-14): this fork targets **generic, current-generation Postgres** for
a **locally running** program. No Neon, no Supabase, no other database
vendor. Per the T12.3 spec this is a build-out that gets its own execution
program — nothing here is implemented yet.

## Goal

A governed app built with this fork can use any recent Postgres (locally
installed, Docker, or a Coolify-hosted instance) by pointing at a plain
connection string. The whole feature works with the machine offline.

## Non-goals

- No removal of Neon/Supabase code inside this plan — deprecating those
  integrations is a separate decision with its own boundary-inventory and
  test maintenance. This plan only makes generic Postgres a first-class
  peer so nothing depends on a vendor.
- No hosted provisioning story (that is exactly what we are removing).

## Phase A — provider module (foundation)

1. `src/postgres_admin/postgres_client.ts` + test (Seam S3, injected
   runner): verify a connection string, list databases/tables. Use
   `pg` ONLY IF already a dependency — otherwise `node:net`-level checks +
   the `postgres` client dyad already ships; never add deps (program rule).
2. Extract the provider-neutral schema snapshot from
   `src/neon_admin/neon_context.ts` (ts-pg-schema-diff based) into
   `src/postgres_admin/schema_snapshot.ts` + test (Seam S1).
   `neon_context.ts` keeps working by consuming the extracted module.
3. RED-first, hand-worked values, per the standing loop.

## Phase B — agent tool parity

4. `get_postgres_project_info` tool mirroring
   `get_neon_project_info`, gated by the same consent machinery
   (`rules/local-agent-tools.md`). Table of connection-string redaction in
   tool output (never echo credentials).
5. Split `src/prompts/neon_prompt_rules.ts`: provider-neutral rules
   (client-side DATABASE_URL ban, server-only access) stay always-on;
   Neon-specific JWT/RLS/branching caveats render only for Neon apps.
   Prompt snapshots regen per `rules/prompt-guides.md`.

## Phase C — settings + UI

6. Settings: provider selector (none | Neon | generic Postgres) + connection
   string entry (redacted at rest per the dotenv-redaction conventions);
   `rules/adding-settings.md` (snapshot regen required).
7. Surface the selected provider in the governed spec context so plans can
   reason about the real database.

## Phase D — local deployment story

8. Optional: Coolify service integration so a Coolify-hosted Postgres can
   be attached to a deployed app's env (`DATABASE_URL`) with no vendor.
   (Coolify deploy files: `src/coolify_deploy/`.)
9. Docs: local Postgres quickstart (install/Docker + connection string).

## Gates

Per phase: RED→GREEN per task, `npm run ts`/fmt/lint, suites, boundary
inventory updated for any new dispatch/transport access (the
`boundary_inventory` guard will flag new call sites — that is its job).
Full gates at the end.

## Open items to settle before scheduling

1. Which driver the provider module uses without adding dependencies.
2. Whether connection strings live in settings (encrypted at rest via
   safeStorage) or per-app `.env` only.
3. Whether Neon/Supabase removal happens after Phase B or is deferred
   indefinitely (deprecation is its own program: tests, boundary
   inventory, prompts, and the workers/supabase tooling).
