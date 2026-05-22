import asyncio
from collections.abc import Sequence
import sys
from pathlib import Path

from sqlalchemy import delete, func, or_, select

BACKEND_ROOT = Path(__file__).resolve().parents[1]

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.database import AsyncSessionLocal
from app.models.brand import Brand
from app.models.category import Category
from app.models.inventory import InventoryItem
from app.models.inventory_ops import StockTransferItem, WastageLog
from app.models.order import Order, OrderItem
from app.models.product import Product, ProductVariant
from app.models.return_request import ReturnItem, ReturnRequest
from app.models.stock_movement import StockMovement
from app.models.supplier import PurchaseOrderItem


TEST_PRODUCT_PATTERNS = [
    "%test%",
    "%phase%",
    "%batch%",
    "%compat%",
    "%summary%",
    "%ops%",
    "%flow%",
    "%warehouse%",
    "%return%",
    "%crm%",
    "%reports%",
    "%pos%",
    "%counter%",
    "%payload%",
    "%history%",
]

TEST_ORDER_PATTERNS = [
    "ORD-%",
    "DIRECT-%",
    "P5B-ORD-%",
]

TEST_CATEGORY_PATTERNS = [
    "batch-category-%",
    "category-%",
]

TEST_BRAND_PATTERNS = [
    "batch-brand-%",
    "brand-%",
]


async def _collect_ids(session, stmt) -> list:
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def main() -> None:
    async with AsyncSessionLocal() as session:
        product_filters = [
            func.lower(Product.name).like(pattern)
            for pattern in TEST_PRODUCT_PATTERNS
        ] + [
            func.lower(Product.slug).like(pattern)
            for pattern in TEST_PRODUCT_PATTERNS
        ] + [
            Product.source == "storefront_demo",
        ]
        product_ids: Sequence = await _collect_ids(
            session,
            select(Product.id).where(or_(*product_filters)),
        )

        order_filters = [Order.order_number.like(pattern) for pattern in TEST_ORDER_PATTERNS]
        order_ids: Sequence = await _collect_ids(
            session,
            select(Order.id).where(or_(*order_filters)),
        )

        if order_ids:
            await session.execute(delete(ReturnItem).where(ReturnItem.order_item_id.in_(select(OrderItem.id).where(OrderItem.order_id.in_(order_ids)))))
            await session.execute(delete(ReturnRequest).where(ReturnRequest.order_id.in_(order_ids)))
            await session.execute(delete(Order).where(Order.id.in_(order_ids)))

        if product_ids:
            await session.execute(delete(InventoryItem).where(InventoryItem.product_id.in_(product_ids)))
            await session.execute(delete(StockMovement).where(StockMovement.product_id.in_(product_ids)))
            await session.execute(delete(StockTransferItem).where(StockTransferItem.product_id.in_(product_ids)))
            await session.execute(delete(WastageLog).where(WastageLog.product_id.in_(product_ids)))
            await session.execute(delete(PurchaseOrderItem).where(PurchaseOrderItem.product_id.in_(product_ids)))
            await session.execute(delete(ReturnItem).where(ReturnItem.product_id.in_(product_ids)))
            await session.execute(delete(OrderItem).where(OrderItem.product_id.in_(product_ids)))
            await session.execute(delete(ProductVariant).where(ProductVariant.product_id.in_(product_ids)))
            await session.execute(delete(Product).where(Product.id.in_(product_ids)))

        await session.execute(
            delete(Category).where(
                or_(
                    *[Category.slug.like(pattern) for pattern in TEST_CATEGORY_PATTERNS],
                    ~Category.products.any(),
                )
            )
        )
        await session.execute(
            delete(Brand).where(
                or_(
                    *[Brand.slug.like(pattern) for pattern in TEST_BRAND_PATTERNS],
                    ~Brand.products.any(),
                )
            )
        )

        await session.commit()

        print(f"Removed test orders: {len(order_ids)}")
        print(f"Removed test/demo products: {len(product_ids)}")


if __name__ == "__main__":
    asyncio.run(main())
