# Hostinger VPS + Coolify validation runbook

Status: **TEMPLATE — awaiting owner execution** (T12.1 owner checkpoint).

Purpose: prove this fork's Coolify integration end-to-end against a real
Hostinger VPS, recording every gap hit along the way. The result decides
T12.2 (fix the first gap found; if none, T12.2 closes as a no-op with the
owner's confirmation quoted in `PROGRESS_LOG.md`).

Reference reading (what the automation does, so the manual run can tell
"broken product" from "expected question"):

- `src/coolify_setup/install.ts` — fetches the official Coolify installer on
  the server and runs it in a shell seeded with the admin account details.
- `src/coolify_setup/server_key.ts` — Dyad's own SSH identity
  (`server_key.ts` generates it once, stores it under userData, expects its
  public half to be added to the VPS user's `authorized_keys`).
- `src/coolify_setup/api_token.ts` — after Coolify is up, Dyad reads the
  token through `tinker` one-liners (30s timeouts each).
- `src/coolify_setup/https_setup.ts` — instance domain validation
  (`isPlausibleInstanceDomain`, DNS checks) before HTTPS is attempted.
- `src/coolify_deploy/commands.ts` + `build_config.ts` — deploy side: the
  build pack reads the app's own files (framework detection via
  `detectFrameworkType`, Nitro start command when applicable).

## 0. Prerequisites

- [ ] A fresh Hostinger VPS (Ubuntu LTS, ≥ 2 vCPU / 4 GB recommended for
      Coolify + one small app), with the owner's SSH access working.
- [ ] This fork built and running locally (`npm run dev` is fine; the
      Coolify setup UI lives in Settings).
- [ ] The fixture app to deploy: `e2e-tests/fixtures/import-app/minimal`
      (import it into Dyad as a local app before step 2).

## 1. Point the machine at Dyad (server key)

1. [ ] Open Dyad → Settings → Coolify and start the setup flow; when it
       shows Dyad's public deploy key, copy it.
2. [ ] Add that public key to `/root/.ssh/authorized_keys` (or the
       dedicated deploy user's) on the VPS.
3. [ ] From the VPS, confirm inbound SSH works and that
       `/var/folders`-style local restrictions do not apply (bare metal,
       not a container).

## 2. Install Coolify

1. [ ] Let Dyad run the installer (or, to mirror it manually on the VPS:
       `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash` with
       the admin email/password exported — Dyad seeds the admin account this
       way to save a dashboard trip).
2. [ ] Expected: Dyad's setup panel reaches "Coolify is up" without
       falling back to the dashboard. Record anything the panel asked that
       this runbook did not warn about.

## 3. API access

1. [ ] Dyad reads/creates the API token via tinker (scopes per
       `src/shared/coolify_scopes.ts`).
2. [ ] Expected: "Setting up API access" clears within ~30s per tinker
       question. A wedged Docker leaving that label forever is a known
       timeout hazard — note which step wedged if hit.

## 4. Instance domain + HTTPS

1. [ ] Give the VPS a DNS name (A record) and enter it as the instance
       domain when Dyad asks; it validates plausibility + DNS before HTTPS.
2. [ ] Expected: HTTPS setup completes; the Coolify dashboard opens on the
       domain with a trusted certificate.

## 5. Deploy the fixture app

1. [ ] In Dyad, deploy the imported `minimal` app to the Coolify server.
2. [ ] Expected: build pack picks the framework up from the app files
       (no manual build config), the deploy goes green, and the app answers
       HTTP on its Coolify-assigned port.
3. [ ] Attach a custom domain to the deployed app through Coolify and
       confirm it serves over HTTPS.

## 6. Redeploy loop

1. [ ] Make a trivial change to the app in Dyad, redeploy.
2. [ ] Expected: new build goes green with zero manual Coolify UI steps.

## Gaps hit

| Step | Expected | Actual | Blocked? |
| ---- | -------- | ------ | -------- |
|      |          |        |          |

(Owner: fill one row per surprise. The first row becomes T12.2's concrete
fix; zero rows closes T12.2 as a no-op.)
