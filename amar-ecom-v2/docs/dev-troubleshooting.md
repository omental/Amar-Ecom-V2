# Dev Troubleshooting

Last reviewed: 2026-05-16

## Frontend Build Lock On Windows

Symptom:
- `npm run build` fails with an `EPERM` error while trying to remove or rewrite files under `.next`
- example from Phase 11A validation:
  - `EPERM: operation not permitted, unlink 'D:\Amar-eCom\amar-ecom-v2\frontend\.next\trace'`

Cause:
- Windows can keep `.next` files locked if a dev server or another Node process still has file handles open.

Recommended cleanup:

```powershell
taskkill /F /IM node.exe
Remove-Item -Recurse -Force .next
npm run build
```

Run those commands from:
- `D:\Amar-eCom\amar-ecom-v2\frontend`

## Backend Fresh Migration Validation

Do not drop the main local database automatically.

Suggested fresh-db validation flow:

1. Create a temporary PostgreSQL database.
2. Point `DATABASE_URL` to that temporary database.
3. Run:

```powershell
venv\Scripts\alembic.exe upgrade head
```

4. Smoke test:
   - import `app.main`
   - call `GET /api/v1/health`
5. Drop the temporary database after verification.

## WooCommerce Credential Encryption Key

Symptom:
- `/api/v1/woocommerce/settings` returns an encryption warning
- the WooCommerce workspace says a dedicated encryption key is not configured

Recommended setup:

Add one of these to `backend/.env`:

```env
FERNET_SECRET_KEY=YOUR_FERNET_KEY_HERE
```

or:

```env
APP_SECRET_KEY=YOUR_APP_SECRET_KEY_HERE
```

Notes:
- `FERNET_SECRET_KEY` is preferred when you want to control the Fernet key directly
- `APP_SECRET_KEY` is also supported and is derived into a Fernet-compatible key by the backend
- if neither is set, the backend falls back to `SECRET_KEY`, which still works but keeps the dedicated-key warning visible in the WooCommerce UI
- legacy plaintext WooCommerce credentials from Phase 12A are still readable for backward compatibility, but the settings should be saved again so they are re-encrypted

## WooCommerce Auto-Sync Warning

Symptoms:

- `/dashboard/woocommerce` shows a readiness warning that auto-sync is enabled but no worker is configured
- `/api/v1/woocommerce/sync-status` returns a warning about configuration-only auto-sync

What to check:

- this is expected in Phase 12D
- `auto_sync_enabled` only stores preference and interval metadata
- no background worker, cron process, or queue consumer is bundled in this phase
- manual sync through `POST /api/v1/woocommerce/run-sync` remains the only supported execution path
- the current manual sync path refreshes existing imported WooCommerce products and orders, then imports new changed rows safely

## Next.js Workspace Root Warning

Observed during build during Phase 11A:
- Next.js inferred the workspace root from a parent `package-lock.json`

Impact:
- warning only during Phase 11A validation
- build failure came from `.next` file locking, not this warning

Phase 11B follow-up:
- the frontend now sets an explicit local Next root in `frontend/next.config.ts`

If the warning still appears in a local environment:
- verify the app is started from `D:\Amar-eCom\amar-ecom-v2\frontend`
- check whether another parent workspace tool is overriding the root at runtime
- confirm the build command is being run from the frontend workspace before changing config again

## Next Font Download Failure In Restricted Environments

Symptom:

- `npm run build` fails while downloading Google-hosted fonts
- example:
  - `Failed to fetch 'Geist' from Google Fonts`

Cause:

- the frontend currently uses `next/font/google`
- builds in restricted or offline environments can fail during font download even when application code is valid

Recommended checks:

- confirm the machine can reach Google Fonts
- rerun the build from `D:\Amar-eCom\amar-ecom-v2\frontend`
- if the environment is intentionally offline or filtered, treat this as an environment limitation rather than a courier integration regression

Note:

- this is separate from the Windows `.next` `EPERM` file-lock issue above
- Phase 13A courier integration validation still passed backend tests, frontend lint, and frontend type-checking when this network-dependent build step failed

## Phase 14A Build Validation Note

Recent Phase 14A validation still hit the Windows `.next` lock path rather than an application-code failure:

- example:
  - `EPERM: operation not permitted, unlink 'D:\Amar-eCom\amar-ecom-v2\frontend\.next\build\chunks\node_modules_13sb.px._.js'`

Interpretation:

- if backend tests, frontend lint, and frontend type-check all pass, treat this as an environment cleanup issue first
- rerun the cleanup steps from `D:\Amar-eCom\amar-ecom-v2\frontend` before treating it as a product regression

## Steadfast Configuration Check vs Live Connection Test

Symptom:

- `Test connection` for the Steadfast provider succeeds with a configuration-check message instead of proving a live remote API handshake

Why this happens:

- the adapter currently validates:
  - `base_url`
  - credential presence
  - safe request construction
- but it intentionally avoids pretending a production-safe probe endpoint is confirmed when that endpoint mapping has not been verified yet

What to check:

- confirm the exact Steadfast base URL with the courier team
- confirm the live create-order and status endpoint paths before production rollout
- if a safe profile or probe endpoint is confirmed later, the adapter can be upgraded to use that for a stronger connection test

Notes:

- sandbox mode only changes labeling unless the configured `base_url` is actually a sandbox URL
- shipment send and status sync remain manual only in this phase
- logs stay sanitized and should not expose raw credentials even when Steadfast returns an error

## Courier Status Sync Safety Notes

When testing external courier status sync:

- `apply_safe_status` defaults to off
- if a remote shipment returns `delivered` while the local shipment was never in a shipped-ready state, the sync may record a warning and keep the local shipment status unchanged
- returned, cancelled, and failed remote states stay warning-first and do not auto-apply destructively by default
- use the bulk status sync endpoint or UI only for manual operator-driven reconciliation; no background worker exists yet
