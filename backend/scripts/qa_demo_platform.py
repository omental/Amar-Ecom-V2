#!/usr/bin/env python3
"""Run the deterministic Amar full-platform integration and tenant gauntlet."""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = BACKEND_ROOT.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.database import AsyncSessionLocal
from app.services.demo_qa_service import DemoPlatformQARunner, QAStatus, write_qa_report
from app.services.demo_seed_service import (
    DemoSeedSafetyError, DemoSeedVerificationError, seed_demo_platform, verify_demo_platform,
)


def parser() -> argparse.ArgumentParser:
    value = argparse.ArgumentParser(description="Run full-platform QA against the deterministic Amar demo seed.")
    modes = value.add_mutually_exclusive_group()
    modes.add_argument("--quick", action="store_true", help="Run the core read-side smoke integration set.")
    modes.add_argument("--full", action="store_true", help="Run all integration, mutation-rollback, tenant, and AI checks.")
    modes.add_argument("--tenant", action="store_true", help="Run seed, tenancy, permissions, and cross-tenant gauntlet checks.")
    modes.add_argument("--ai", action="store_true", help="Run commerce grounding and AI policy checks.")
    value.add_argument("--clean", action="store_true", help="Reset and verify the deterministic demo before QA (development/test only).")
    value.add_argument("--report", type=Path, default=REPOSITORY_ROOT / "artifacts" / "qa-demo-platform.json", help="JSON report path; Markdown uses the same stem.")
    value.add_argument("--quiet", action="store_true", help="Suppress per-check console output.")
    return value


def selected_mode(args: argparse.Namespace) -> str:
    if args.quick: return "quick"
    if args.tenant: return "tenant"
    if args.ai: return "ai"
    return "full"


async def run(args: argparse.Namespace) -> int:
    try:
        if args.clean:
            async with AsyncSessionLocal() as db:
                await seed_demo_platform(db, reset=True)
                await db.commit()
            async with AsyncSessionLocal() as db:
                await verify_demo_platform(db)
        report = await DemoPlatformQARunner(mode=selected_mode(args)).run()
        # Mutating checks use rollback, but this final assertion is deliberately part
        # of the command so a broken restore can never be hidden by report generation.
        async with AsyncSessionLocal() as db:
            final_seed = await verify_demo_platform(db)
        report.seed_verification = {**report.seed_verification, "post_qa": final_seed}
        json_path, markdown_path = write_qa_report(report, args.report)
    except (DemoSeedSafetyError, DemoSeedVerificationError) as exc:
        print(f"Demo QA refused: {exc}", file=sys.stderr)
        return 2

    if not args.quiet:
        for result in report.results:
            detail = f" — {result.error}" if result.error and result.status != QAStatus.PASS else ""
            print(f"{result.status.value:<4}  {result.group:<27} {result.key}{detail}")
        totals = report.totals
        print()
        print(f"Amar Demo QA: {totals['PASS']} PASS / {totals['FAIL']} FAIL / {totals['WARN']} WARN / {totals['SKIP']} SKIP")
        print(f"JSON: {json_path}")
        print(f"Markdown: {markdown_path}")
        print("Post-QA canonical seed verification: PASS")
    return 1 if report.failed else 0


def main() -> int:
    return asyncio.run(run(parser().parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())
