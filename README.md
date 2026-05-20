# Amar-eCom V2

A modern e-commerce operations platform rebuilt from the legacy React/Firebase system into a modular Next.js, FastAPI, and PostgreSQL architecture.

## Overview

Amar-eCom V2 is the active replacement for the previous v1 application. The current milestone focused on achieving exact v1 UI, UX, and workflow parity while moving the platform onto a more maintainable and safer stack built with Next.js, FastAPI, and PostgreSQL.

The platform is designed to support day-to-day commerce operations across order management, inventory, CRM, logistics, POS, HR, finance, WooCommerce visibility, reporting, and administrative workflows.

## Tech Stack

### Frontend

- Next.js App Router
- TypeScript
- Tailwind CSS

### Backend

- FastAPI
- SQLAlchemy
- Alembic
- PostgreSQL 17
- Pytest

## Core Modules

- Dashboard
- Orders
- Inventory hub
- Products
- CRM / Customers
- Logistics
- Reports
- Finance
- POS
- HR
- WooCommerce exposure
- Settings
- Team / Users
- Activity logs
- Admin tools

## Exact V1 Parity Milestone

Exact v1 parity work has been completed through the following milestones:

- 15B Shell / sidebar / topbar exact-v1 clone
- 15C Dashboard exact-v1 clone
- 15D Orders exact-v1 workflow
- 15E Inventory hub exact-v1 clone
- 15F CRM exact-v1 clone
- 15G Logistics exact-v1 clone
- 15H Settings / Team / Admin exact-v1 clone
- 15I Reports / Finance / POS / HR / WooCommerce exact-v1 matching
- 15J Final exact-parity code-level QA

In this phase, v1 served as the UI, UX, and workflow source of truth. Where legacy behavior introduced avoidable risk, backend safety and maintainability were preserved in the V2 implementation.

## Repository Structure

```text
backend/   FastAPI application, Alembic migrations, tests
frontend/  Next.js App Router application
docs/      Audits, setup notes, QA checklists, migration planning
```

## Backend Setup

The backend runs on FastAPI and uses PostgreSQL for persistence.

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
venv\Scripts\alembic.exe upgrade head
venv\Scripts\uvicorn.exe app.main:app --reload
```

Notes:

- Configure the database and security settings through environment variables.
- Local development currently targets PostgreSQL 17.
- Alembic migrations should be applied before running API or integration tests.

## Frontend Setup

The frontend uses Next.js App Router and communicates with the backend through `NEXT_PUBLIC_API_BASE_URL`.

```powershell
cd frontend
npm install
npm run dev
```

Default local app URL:

- `http://localhost:3000`

## Environment Variables

Keep local environment files out of Git. Use example files where available and provide real values locally.

Backend variables should include:

- `DATABASE_URL`
- `SECRET_KEY`
- `APP_SECRET_KEY` or `FERNET_SECRET_KEY` for dedicated encryption where applicable
- `FRONTEND_URL`
- Optional integration secrets for courier, WooCommerce, or other external services

Frontend variables should include:

- `NEXT_PUBLIC_API_BASE_URL`

Notes:

- `backend/.env` is used by the FastAPI settings loader in local development.
- `frontend/.env.example` provides the expected local API base URL format.
- Do not commit real credentials, tokens, or production-only values.

## Database And Migration Commands

Apply latest schema:

```powershell
cd backend
venv\Scripts\alembic.exe upgrade head
```

Run backend tests after migrations:

```powershell
cd backend
venv\Scripts\pytest.exe
```

Known local PostgreSQL note:

```powershell
"C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" start -D "C:\Program Files\PostgreSQL\17\data" -l "C:\Program Files\PostgreSQL\17\data\manual-start.log"
```

## Validation Commands

### Backend

```powershell
cd backend
venv\Scripts\alembic.exe upgrade head
venv\Scripts\pytest.exe
```

Latest reported backend result:

- `38 passed, 1 warning`

### Frontend

```powershell
cd frontend
npm run lint
npx tsc --noEmit
npm run build
```

Latest reported frontend status:

- `npm run lint` passed
- `npx tsc --noEmit` passed

## Known Local Issues

On Windows, `npm run build` may fail locally because of a `.next` file lock issue such as:

```text
EPERM: operation not permitted, unlink ... .next/app-path-routes-manifest.json
```

If that happens, clear the running Node processes and rebuild:

```powershell
taskkill /F /IM node.exe
Remove-Item -Recurse -Force .next
npm run build
```

This is a local Windows environment issue and not necessarily a code defect.

## Deployment Overview

Production deployment is expected to follow this general shape:

- Build and serve the Next.js frontend with `npm run build`
- Run the FastAPI backend behind Nginx or another reverse proxy
- Use PostgreSQL as the production database
- Configure all required environment variables on the server
- Run migrations before switching traffic
- Perform manual browser and operator QA before a live production cutover

## Project Status

Amar-eCom V2 is the active codebase and intended replacement for the legacy v1 system. Exact v1 parity across shell, dashboard, orders, inventory, CRM, logistics, settings, team, admin, reports, finance, POS, HR, and WooCommerce-facing workflows has been completed at the code and UI level.

Current validation status:

- Frontend lint passed
- Frontend TypeScript validation passed
- Backend migrations passed
- Backend test suite passed

Next recommended step:

- Manual browser and operator QA before live production use
