#!/usr/bin/env python3
"""Create or verify the deterministic Amar full-platform demo environment."""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.database import AsyncSessionLocal
from app.services.demo_seed_service import (
    DemoSeedSafetyError, DemoSeedVerificationError, seed_demo_platform, verify_demo_platform,
)
from scripts.demo_seed_manifest import CANONICAL, TECHNEST, URBAN


def parser() -> argparse.ArgumentParser:
    value = argparse.ArgumentParser(description="Seed two deterministic, isolated Amar demo businesses.")
    mode = value.add_mutually_exclusive_group()
    mode.add_argument("--reset", action="store_true", help="Explicitly rebuild the recognized demo tenants.")
    mode.add_argument("--verify", action="store_true", help="Assert canonical demo facts without repairing them.")
    value.add_argument("--quiet", action="store_true", help="Suppress the human-readable summary.")
    return value


async def run(args: argparse.Namespace) -> int:
    async with AsyncSessionLocal() as db:
        try:
            if args.verify:
                facts = await verify_demo_platform(db)
                if not args.quiet:
                    print("Amar Demo Seed Verified")
                    print(f"Seed version: {facts['seed_version']}")
                    print(f"Products: {facts['products']} | Customers: {facts['customers']} | Orders: {facts['orders']} | Conversations: {facts['conversations']}")
                    print(f"{CANONICAL['product']} / {CANONICAL['variant']} = {facts['stock_total']} stock @ BDT {facts['price']}")
                    print(f"{CANONICAL['order_number']} = {facts['order_status']}")
                return 0
            result = await seed_demo_platform(db, reset=args.reset)
            await db.commit()
        except (DemoSeedSafetyError, DemoSeedVerificationError, RuntimeError, ValueError) as exc:
            await db.rollback()
            print(f"Demo seed failed: {exc}", file=sys.stderr)
            return 1
    if not args.quiet:
        print("Amar Demo Seed Ready")
        print()
        print("Urban Thread:")
        print(f"  Owner: {URBAN['owner_email']}")
        print(f"  Manager: {URBAN['manager_email']}")
        print(f"  Support: {URBAN['support_email']}")
        print()
        print("TechNest:")
        print(f"  Owner: {TECHNEST['owner_email']}")
        print()
        print("Known fixtures:")
        print("  Classic Oxford Shirt / Black / XL = 15 stock")
        print("  Main Warehouse 12 | Dhanmondi Outlet 3 | Chattogram Warehouse 0")
        print("  Price = BDT 2490")
        print("  UT-1042 = shipped")
        print(f"  Totals: {result.products} products, {result.customers} customers, {result.orders} orders, {result.conversations} conversations")
        print("Password: use AMAR_DEMO_PASSWORD, or the documented local-only default (never printed here).")
    return 0


def main() -> int:
    return asyncio.run(run(parser().parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())

