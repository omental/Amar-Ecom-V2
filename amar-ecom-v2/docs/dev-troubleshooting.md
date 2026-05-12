# Dev Troubleshooting

Last reviewed: 2026-05-12

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
