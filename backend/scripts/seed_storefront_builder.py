import asyncio

from app.core.database import AsyncSessionLocal
from app.services.storefront_service import ensure_storefront_defaults


async def main() -> None:
    async with AsyncSessionLocal() as session:
        await ensure_storefront_defaults(session)
        print("Storefront builder defaults seeded.")


if __name__ == "__main__":
    asyncio.run(main())
