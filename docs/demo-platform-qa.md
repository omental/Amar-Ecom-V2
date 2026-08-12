# Deterministic full-platform QA

Phase 15.5B validates Amar as one integrated platform against the Phase 15.5A Urban Thread and TechNest seed. It supplements—rather than replaces—pytest, frontend tests, and the tenant-integrity checker.

## Run it

From `backend/`:

```bash
venv/bin/python scripts/qa_demo_platform.py
venv/bin/python scripts/qa_demo_platform.py --quick
venv/bin/python scripts/qa_demo_platform.py --tenant
venv/bin/python scripts/qa_demo_platform.py --ai
venv/bin/python scripts/qa_demo_platform.py --full
venv/bin/python scripts/qa_demo_platform.py --full --report ../artifacts/custom-report.json
```

`--clean` first resets and verifies only the two recognized demo tenants. It is refused outside development/test:

```bash
venv/bin/python scripts/qa_demo_platform.py --full --clean
```

The default and `--full` execute all service-level groups. `--quick` is a read-side smoke set. `--tenant` focuses on seed, permissions, and bidirectional tenant attacks. `--ai` focuses on deterministic AI grounding and policy boundaries.

## Execution model

The runner follows this sequence:

```text
production guard
→ canonical seed verification
→ grouped checks
→ rollback of each mutation scenario
→ JSON and Markdown reports
→ final canonical seed verification
```

An invalid seed stops the run before any check. Required failures return exit code 1; invalid seed/environment returns 2. Known unavailable external systems are reported as WARN/SKIP without being presented as passing.

Mutation checks use database rollback and then confirm canonical values. The command performs a second seed verification after every run, so a restore defect cannot be hidden by a green check.

## Reports

By default the runner writes ignored local artifacts:

- `artifacts/qa-demo-platform.json`
- `artifacts/qa-demo-platform.md`

Each result contains its stable key, group, description, PASS/FAIL/WARN/SKIP status, duration, expected/actual evidence, bounded error, and safe metadata. Reports include environment, Git revision where available, the database's actual Alembic revision, seed facts, totals, and external limitations. They intentionally exclude credentials and raw conversation bodies.

## Isolation gauntlet

The gauntlet enters TechNest tenant scope and probes deterministic Urban Thread IDs across product, inventory, procurement, customer, order, logistics, finance, HR, Builder, domains, DNS, messaging, media, and AI models. A representative reverse attack runs from Urban Thread into TechNest. Aggregate and projection queries are also tenant-scoped; entity filtering alone is not considered sufficient.

## Provider boundary

Deterministic QA uses `TestDnsProvider`, Phase 13/14 test messaging channels, test billing state, and `TestAIProvider`. It never claims or attempts real Meta, OpenAI, PowerDNS, public DNS/TLS, production billing, courier, or SMTP verification. Interactive checks are maintained separately in [manual-full-platform-qa.md](manual-full-platform-qa.md).

## Canonical restore sequence

For a release gate, run:

```bash
cd backend
venv/bin/python scripts/seed_demo_platform.py --reset
venv/bin/python scripts/seed_demo_platform.py --verify
venv/bin/python scripts/qa_demo_platform.py --full
venv/bin/python scripts/seed_demo_platform.py --verify
venv/bin/pytest
venv/bin/python scripts/check_tenant_integrity.py
```

The final verification must still report Oxford Black / XL stock 15, BDT 2,490, and `UT-1042` shipped.
