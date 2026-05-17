# Release Candidate Readiness

Last reviewed: 2026-05-16

This document is the internal release-candidate checklist for the current Amar-eCom v2 scope inside `amar-ecom-v2`.

## Scope Snapshot

- WooCommerce integration is complete for the current v2 scope and remains manual plus read-only from WooCommerce to local.
- Courier integration is complete for the current v2 scope and remains manual plus safe.
- Orders, shipments, logistics, and reconciliation operator polish is complete for the current scope.
- No background workers are included yet.

## Required Backend Environment Variables

Minimum required values in `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:5432/DB_NAME
SECRET_KEY=replace-this-in-real-deployments
FRONTEND_URL=http://localhost:3000
```

Recommended additional values:

```env
APP_ENV=development
ACCESS_TOKEN_EXPIRE_MINUTES=1440
FERNET_SECRET_KEY=YOUR_FERNET_KEY
# or
APP_SECRET_KEY=YOUR_APP_SECRET_KEY
```

Notes:

- Configure `FERNET_SECRET_KEY` or `APP_SECRET_KEY` for encrypted WooCommerce and courier credential storage.
- If neither dedicated key is set, the backend falls back to `SECRET_KEY`, which works but should not be the preferred production posture.
- PostgreSQL is required for the current backend stack.

## Required Frontend Environment Variables

Recommended `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

Notes:

- If `NEXT_PUBLIC_API_BASE_URL` is missing, the frontend falls back to `http://127.0.0.1:8000/api/v1`.
- Keep frontend and backend origins aligned with CORS settings before deployment.

## Core Commands

Backend from `D:\Amar-eCom\amar-ecom-v2\backend`:

```powershell
venv\Scripts\pip.exe install -r requirements.txt
venv\Scripts\alembic.exe upgrade head
venv\Scripts\uvicorn.exe app.main:app --reload
venv\Scripts\pytest.exe -q
```

Frontend from `D:\Amar-eCom\amar-ecom-v2\frontend`:

```powershell
npm install
npm run lint
npx tsc --noEmit
npm run build
npm run start
```

## Current Validation Commands

Backend:

```powershell
venv\Scripts\alembic.exe upgrade head
venv\Scripts\pytest.exe -q
```

Frontend:

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

## Fresh Migration Validation

Validated on 2026-05-16 with a temporary PostgreSQL database:

1. Created a throwaway database.
2. Pointed `DATABASE_URL` to the temporary database.
3. Ran `venv\Scripts\alembic.exe upgrade head`.
4. Imported `app.main`.
5. Called `GET /api/v1/health`.
6. Dropped the temporary database.

Result:

- full migration chain upgraded successfully
- app import succeeded
- health endpoint returned `200 OK`

## Build Environment Notes

### Windows `.next` file lock

If `npm run build` fails with `EPERM` against `.next`, run:

```powershell
taskkill /F /IM node.exe
Remove-Item -Recurse -Force .next
npm run build
```

### Google Fonts / network-restricted builds

The frontend currently uses `next/font/google` for `Geist` and `Geist Mono`.

In restricted or offline environments, `npm run build` can fail with font download errors such as:

- `Failed to fetch 'Geist' from Google Fonts`
- `Failed to fetch 'Geist Mono' from Google Fonts`

Treat that as an environment limitation unless you intentionally decide to replace remote font usage later.

Current local known issue:

- recent validation is failing on the Windows `.next` file-lock path:
  - `EPERM: operation not permitted, unlink 'D:\Amar-eCom\amar-ecom-v2\frontend\.next\build\chunks\node_modules_13sb.px._.js'`

## Do Not Commit

Keep these out of commits:

- `.env`
- `.env.local`
- `.next`
- `node_modules`
- `venv`
- `backend/venv`
- `__pycache__`
- `*.pyc`
- `.pytest_cache`

The root `.gitignore` already covers these, and it now also ignores `backend/pytest-cache-files-*` Windows temp cache directories.

## Production Notes

- Configure `FERNET_SECRET_KEY` or `APP_SECRET_KEY`.
- Configure a real PostgreSQL `DATABASE_URL`.
- Configure `FRONTEND_URL` and deployment CORS properly.
- Configure domain, SSL, and reverse proxy separately later.
- WooCommerce sync is manual and read-only against WooCommerce for this scope.
- Courier sync is manual and safe for this scope.
- No background workers, cron jobs, or queue consumers are bundled yet.
- No local-to-WooCommerce push-back exists.
- No destructive courier-driven shipment or order mutation exists by default.

## UI Status

- The v1-inspired redesign has been applied across the main dashboard shell and the highest-value module pages.
- Responsive shell and content containment were fixed at code level in Phase `14J`.
- Final browser viewport verification should still be executed with [ui-release-candidate-checklist.md](/d:/Amar-eCom/amar-ecom-v2/docs/ui-release-candidate-checklist.md) before client or demo release.

## Integration Safety Notes

WooCommerce:

- credentials are encrypted at rest and masked on read
- legacy plaintext credentials remain readable only for compatibility until the next clean save
- product and order refresh remain conservative
- imported WooCommerce orders do not deduct local stock automatically
- WooCommerce stock visibility does not overwrite local inventory

Courier integrations:

- credentials are encrypted at rest and masked on read
- request and response snapshots are sanitized
- `apply_safe_status` is opt-in and intentionally narrow
- external delivered can update local shipment status only when explicitly allowed and conflict-free
- failed, cancelled, and returned states do not auto-apply destructively by default
- Steadfast base URL and endpoint mapping should still be confirmed before production rollout

## Permission Smoke Notes

- `admin` and `super_admin` users can access the full current app surface.
- Non-admin sidebar visibility is still a light frontend gating aid, not a complete security boundary.
- Backend route-level deep permission enforcement is not complete across every module yet.
- Do not rely on sidebar hiding alone as full access control.

## Parent Parity Audit Note

The parity audit file visible in the parent workspace is outside `amar-ecom-v2`, so it was not edited during this RC pass.

Update that parent audit manually to reflect:

- WooCommerce complete for current scope
- Courier integration complete for current scope
- Orders, logistics, and reconciliation operator polish complete
- current estimated parity should be reviewed before release sign-off
