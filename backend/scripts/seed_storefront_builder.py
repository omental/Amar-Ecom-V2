import asyncio
import sys
from pathlib import Path

# Direct script execution puts ``scripts/`` on sys.path. Add the backend package
# root so ``python scripts/seed_storefront_builder.py`` behaves like other entrypoints.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.database import AsyncSessionLocal
from app.services.storefront_service import ensure_storefront_defaults


async def main() -> None:
    async with AsyncSessionLocal() as session:
        await ensure_storefront_defaults(session)
        print("Storefront builder defaults seeded.")


if __name__ == "__main__":
    asyncio.run(main())
