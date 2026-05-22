import asyncio
import json
from decimal import Decimal
import sys
from pathlib import Path

from sqlalchemy import select

BACKEND_ROOT = Path(__file__).resolve().parents[1]

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.database import AsyncSessionLocal
from app.models.brand import Brand
from app.models.category import Category
from app.models.inventory import InventoryItem
from app.models.product import Product
from app.models.warehouse import Warehouse


STORE_CATEGORIES = [
    "Accessories",
    "Watch",
    "Wallet",
    "Sunglass",
    "Tie",
    "Shirt",
    "Pant",
    "Panjabi",
    "Polo",
    "T-Shirt",
    "Blazer",
    "Waistcoat",
    "Shoe",
    "Belt",
    "Jacket",
    "High Neck",
    "Hoodie",
]

DEMO_NOTICE = (
    "Temporary demo/reference catalog data for storefront layout review. "
    "Replace these images, titles, and prices before production launch."
)

DEMO_PRODUCTS = [
    {
        "name": "International Trending 360 Degree Flexible Sneakers",
        "slug": "international-trending-360-degree-flexible-sneakers-3776",
        "sku": "REF-3776",
        "category": "Shoe",
        "regular_price": "4650",
        "sale_price": "1395",
        "image": "/storefront/demo-products/sneakers-flex-3374.png",
        "gallery": [
            "/storefront/demo-products/sneakers-flex-3374.png",
            "/storefront/demo-products/sneakers-leopard-3772.png",
        ],
        "colors": ["Black", "White", "Mustard"],
        "sizes": ["39", "40", "41", "42", "43", "44"],
        "short": "Stain-resistant synthetic leather, glossy embossed pattern, 360-degree flexible footwear, sports-grip outsole.",
        "description": (
            "Temporary storefront demo product inspired by a reference catalog layout. "
            "Stain-resistant synthetic leather, glossy embossed pattern, 360-degree flexible comfort, and a sports-grip outsole built for daily wear."
        ),
        "support_notes": [
            "Cash on delivery available across Bangladesh.",
            "Exchange support subject to size availability.",
            "Demo/reference product data, replace before production.",
        ],
        "inventory": 16,
    },
    {
        "name": "Leopard Motion Inspired Branded Sneakers Zoom Flex || Magnet Grip",
        "slug": "leopard-motion-inspired-branded-sneakers-zoom-flex-magnet-grip-3772",
        "sku": "REF-3772",
        "category": "Shoe",
        "regular_price": "2750",
        "sale_price": "1375",
        "image": "/storefront/demo-products/sneakers-leopard-3772.png",
        "gallery": [
            "/storefront/demo-products/sneakers-leopard-3772.png",
            "/storefront/demo-products/sneakers-flex-3374.png",
        ],
        "colors": ["Ash", "Black", "Blue"],
        "sizes": ["40", "41", "42", "43", "44"],
        "short": "Lightweight sneaker with zoom-flex comfort, magnet grip outsole, and a sharp performance silhouette.",
        "description": (
            "Temporary storefront demo product for layout review. A lightweight everyday sneaker with zoom-flex comfort, magnet grip traction, and a fashion-forward upper."
        ),
        "support_notes": [
            "Fast dispatch for in-stock sizes.",
            "Please confirm color before placing the order.",
            "Demo/reference product data, replace before production.",
        ],
        "inventory": 10,
    },
    {
        "name": "The Modern Monogram Bomber Jacket",
        "slug": "the-modern-monogram-bomber-jacket-3153",
        "sku": "REF-3153",
        "category": "Jacket",
        "regular_price": "10500",
        "sale_price": "7875",
        "image": "/storefront/demo-products/jacket-monogram-3153.jpg",
        "gallery": [
            "/storefront/demo-products/jacket-monogram-3153.jpg",
            "/storefront/demo-products/jacket-italian-3154.jpg",
        ],
        "colors": ["Black"],
        "sizes": ["XL", "XXL", "3XL", "4XL"],
        "short": "Structured bomber jacket with monogram-inspired texture and a premium winter finish.",
        "description": (
            "Temporary storefront demo product. A structured winter-ready bomber jacket with a monogram-inspired outer texture, elevated hardware, and a premium fashion silhouette."
        ),
        "support_notes": [
            "Winter collection support available via phone or inbox.",
            "Size exchange subject to stock confirmation.",
            "Demo/reference product data, replace before production.",
        ],
        "inventory": 6,
    },
    {
        "name": "Italian Silk Zipper Jacket",
        "slug": "italian-silk-zipper-jacket-3154",
        "sku": "REF-3154",
        "category": "Jacket",
        "regular_price": "8500",
        "sale_price": "6800",
        "image": "/storefront/demo-products/jacket-italian-3154.jpg",
        "gallery": [
            "/storefront/demo-products/jacket-italian-3154.jpg",
            "/storefront/demo-products/jacket-monogram-3153.jpg",
        ],
        "colors": ["Black"],
        "sizes": ["XL", "XXL", "3XL", "4XL"],
        "short": "Refined zip-front jacket with smooth finish, premium drape, and cold-weather styling.",
        "description": (
            "Temporary storefront demo product for design review. A refined zip-front jacket with a smooth finish, premium drape, and dressy winter styling."
        ),
        "support_notes": [
            "Ideal for winter and evening wear.",
            "Delivery timeline varies by district.",
            "Demo/reference product data, replace before production.",
        ],
        "inventory": 5,
    },
    {
        "name": "Heritage-Inspired Puffer Jacket",
        "slug": "heritage-inspired-puffer-jacket-3159",
        "sku": "REF-3159",
        "category": "Jacket",
        "regular_price": "7200",
        "sale_price": "5850",
        "image": "/storefront/demo-products/jacket-puffer-3159.jpg",
        "gallery": [
            "/storefront/demo-products/jacket-puffer-3159.jpg",
            "/storefront/demo-products/jacket-monogram-3153.jpg",
        ],
        "colors": ["Black"],
        "sizes": ["XL", "XXL", "3XL", "4XL"],
        "short": "Puffer outerwear with bold shape, winter-ready insulation, and strong storefront visual appeal.",
        "description": (
            "Temporary demo/reference catalog item added to round out the winter collection. Built for cold-season merchandising with a fuller padded shape and strong visual impact."
        ),
        "support_notes": [
            "Popular for winter campaign layouts.",
            "Order confirmation available by phone.",
            "Demo/reference product data, replace before production.",
        ],
        "inventory": 8,
    },
]


def slugify(value: str) -> str:
    return (
        value.lower()
        .replace(" ", "-")
        .replace("/", "-")
        .replace("--", "-")
    )


async def ensure_category(session, name: str) -> Category:
    slug = slugify(name)
    existing = await session.scalar(select(Category).where(Category.slug == slug))
    if existing:
        return existing

    category = Category(
        name=name,
        slug=slug,
        description=f"{name} category for the public storefront.",
    )
    session.add(category)
    await session.flush()
    return category


async def ensure_brand(session) -> Brand:
    slug = "amar-studio"
    existing = await session.scalar(select(Brand).where(Brand.slug == slug))
    if existing:
        return existing

    brand = Brand(
        name="Amar Studio",
        slug=slug,
        description="Neutral placeholder storefront brand for Amar eCom demo catalog.",
    )
    session.add(brand)
    await session.flush()
    return brand


async def ensure_demo_product(session, warehouse_id, brand: Brand, categories: dict[str, Category], payload: dict) -> None:
    existing = await session.scalar(select(Product).where(Product.slug == payload["slug"]))
    if existing:
        return

    product = Product(
        name=payload["name"],
        slug=payload["slug"],
        sku=payload["sku"],
        description=payload["description"],
        source="storefront_demo",
        external_id=payload["sku"].replace("REF-", ""),
        category_id=categories[payload["category"]].id,
        brand_id=brand.id,
        price=Decimal(payload["sale_price"]),
        cost_price=Decimal(payload["sale_price"]) * Decimal("0.65"),
        image_url=payload["image"],
        status="active",
        external_payload_snapshot=json.dumps(
            {
                "woo_product": {
                    "regular_price": payload["regular_price"],
                    "sale_price": payload["sale_price"],
                    "price": payload["sale_price"],
                },
                "storefront_demo": {
                    "is_demo_reference": True,
                    "demo_notice": DEMO_NOTICE,
                    "gallery": payload["gallery"],
                    "colors": payload["colors"],
                    "sizes": payload["sizes"],
                    "support_notes": payload["support_notes"],
                },
            }
        ),
    )
    session.add(product)
    await session.flush()

    if warehouse_id:
        session.add(
            InventoryItem(
                product_id=product.id,
                variant_id=None,
                warehouse_id=warehouse_id,
                quantity=payload["inventory"],
                low_stock_threshold=3,
            )
        )


async def main() -> None:
    async with AsyncSessionLocal() as session:
        warehouse = await session.scalar(select(Warehouse).order_by(Warehouse.created_at.asc()).limit(1))
        categories = {}
        for category_name in STORE_CATEGORIES:
            categories[category_name] = await ensure_category(session, category_name)

        brand = await ensure_brand(session)

        for product in DEMO_PRODUCTS:
            await ensure_demo_product(
                session,
                warehouse.id if warehouse else None,
                brand,
                categories,
                product,
            )

        await session.commit()
        print("Storefront demo seed completed.")
        print("Demo notice: temporary reference catalog data, replace before production.")


if __name__ == "__main__":
    asyncio.run(main())
