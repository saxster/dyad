# BLOCKED

## P5 gate — `e2e-tests/governance_verification.spec.ts` same-view verdict assertion

The Phase 5 gate's new E2E asserts that the governed turn-end verification verdict
(`Spec verification` / `1 green`) is visible in the open chat. Everything behind that
assertion is proven working end-to-end in the packaged app: the hook runs, the contract
executes green, the `spec_verifications` row (`kind: "check"`, exit 0) and the
`governance_run_events` row (`verification_completed`) are persisted, and the final
assistant message's `content` column contains the appended
`<dyad-status title="Spec verification" state="finished">1 green, 0 red</dyad-status>`
(all verified by querying the packaged app's sqlite.db directly, and by the green
`chat_stream_handlers.governance.integration.test.ts` suite at the companion plan's
specified S4 seam).

What is blocked is only the same-view UI assertion. After the turn, the rendered chat does
not show the appended status card, even after a full in-page `location.reload()` re-read
(Playwright `page.reload()` cannot navigate the app's file:// URL; SPA re-navigation via
Apps → Open in Chat also kept a stale in-memory message list). A scratch run of
`parseFullMessage` on the exact persisted content produces the correct `dyad-status` block,
and `getChat` → `toRendererMessage` passes `content` through unchanged, so the divergence is
somewhere in the live render pipeline (ChatMessage/DyadMarkdownParser caching or an
EOM-related masking behavior) that I could not pin down within the task's allowed file
scope. Fixing same-view refresh properly likely means emitting a message-refresh event (or
moving the completion snapshot after the hook) in the renderer stream wiring — a deliberate
change outside T5.7's file list (`chat_stream_handlers.ts` + `governance_handlers.ts` only).

Suggested next step for the owner/next session: decide whether the gate E2E may assert the
verdict via the DB-backed integration test (already green) plus a follow-up renderer task
"push a message refresh after governed turn-end verification", or authorize widening the
file scope to the renderer stream modules.
