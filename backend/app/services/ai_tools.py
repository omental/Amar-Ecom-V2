from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Awaitable, Callable
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.business_settings import BusinessSettings
from app.models.customer import Customer
from app.models.inventory import InventoryItem
from app.models.messaging import Conversation, ConversationOrderLink
from app.models.order import Order
from app.models.product import Product, ProductVariant
from app.models.storefront import StorefrontSetting
from app.models.tenant import Store
from app.services.messaging_service import search_products
from app.services.store_domain_service import get_primary_domain, get_storefront_url_for_hostname


class StrictInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class SearchProductsInput(StrictInput):
    query: str = Field(min_length=1, max_length=120)
    limit: int = Field(default=5, ge=1, le=8)


class ProductRefInput(StrictInput):
    product_ref: UUID


class VariantRefInput(StrictInput):
    variant_ref: UUID


class OrderLookupInput(StrictInput):
    order_number: str | None = Field(default=None, max_length=100)


class OrderRefInput(StrictInput):
    order_ref: UUID


class DeliveryInput(StrictInput):
    zone: str | None = Field(default=None, pattern=r"^(inside_dhaka|outside_dhaka)$")
    subtotal: Decimal | None = Field(default=None, ge=0)


class HandoffInput(StrictInput):
    reason: str = Field(min_length=3, max_length=200)


@dataclass(frozen=True, slots=True)
class AIToolContext:
    db: AsyncSession
    store_id: UUID
    organization_id: UUID
    conversation: Conversation


ToolHandler = Callable[[AIToolContext, StrictInput], Awaitable[dict[str, Any]]]


@dataclass(frozen=True, slots=True)
class RegisteredAITool:
    key: str
    description: str
    input_model: type[StrictInput]
    handler: ToolHandler
    read_only: bool = True
    timeout_seconds: float = 5.0

    def provider_schema(self) -> dict[str, Any]:
        schema = self.input_model.model_json_schema()
        schema["additionalProperties"] = False
        return {"type": "function", "name": self.key, "description": self.description, "parameters": schema, "strict": True}


class AIToolValidationError(ValueError):
    pass


def _money(value: Decimal | float | int) -> str:
    return format(Decimal(str(value)), ".2f")


async def _search(ctx: AIToolContext, value: SearchProductsInput) -> dict:
    rows = await search_products(ctx.db, store_id=ctx.store_id, query=value.query, limit=value.limit)
    return {"items": [{
        "product_ref": str(row["product"].id), "name": row["product"].name,
        "price": _money(row["product"].price), "availability": "in_stock" if row["stock"] > 0 else "out_of_stock",
        "url": row["storefront_url"],
    } for row in rows]}


async def _product(ctx: AIToolContext, value: ProductRefInput) -> dict:
    row = await ctx.db.scalar(select(Product).where(Product.id == value.product_ref, Product.store_id == ctx.store_id, Product.status == "active"))
    if row is None:
        return {"found": False}
    primary = await get_primary_domain(ctx.db, ctx.store_id)
    return {
        "found": True, "product_ref": str(row.id), "name": row.name,
        "description": (row.description or "")[:800], "price": _money(row.price),
        "url": f"{get_storefront_url_for_hostname(primary.hostname)}/products/{row.slug}",
    }


async def _variants(ctx: AIToolContext, value: ProductRefInput) -> dict:
    product = await ctx.db.scalar(select(Product.id).where(Product.id == value.product_ref, Product.store_id == ctx.store_id, Product.status == "active"))
    if product is None:
        return {"found": False, "variants": []}
    rows = list((await ctx.db.execute(select(ProductVariant).where(ProductVariant.product_id == value.product_ref, ProductVariant.store_id == ctx.store_id).order_by(ProductVariant.name).limit(50))).scalars().all())
    return {"found": True, "variants": [{
        "variant_ref": str(row.id), "name": row.name, "sku": row.sku,
        "price": _money(row.price),
    } for row in rows]}


async def _variant(ctx: AIToolContext, value: VariantRefInput) -> dict:
    row = await ctx.db.scalar(select(ProductVariant).join(Product, Product.id == ProductVariant.product_id).where(
        ProductVariant.id == value.variant_ref, ProductVariant.store_id == ctx.store_id,
        Product.store_id == ctx.store_id, Product.status == "active",
    ))
    return {"found": False} if row is None else {
        "found": True, "variant_ref": str(row.id), "product_ref": str(row.product_id),
        "name": row.name, "sku": row.sku,
    }


async def _stock(ctx: AIToolContext, value: VariantRefInput) -> dict:
    variant = await ctx.db.scalar(select(ProductVariant).join(Product, Product.id == ProductVariant.product_id).where(
        ProductVariant.id == value.variant_ref, ProductVariant.store_id == ctx.store_id,
        Product.store_id == ctx.store_id, Product.status == "active",
    ))
    if variant is None:
        return {"found": False}
    quantity = int(await ctx.db.scalar(select(func.coalesce(func.sum(InventoryItem.quantity), 0)).where(
        InventoryItem.store_id == ctx.store_id, InventoryItem.variant_id == variant.id,
    )) or 0)
    # InventoryItem is the authoritative warehouse aggregate; do not expose warehouse internals.
    threshold = 5
    availability = "out_of_stock" if quantity <= 0 else "low_stock" if quantity <= threshold else "in_stock"
    return {"found": True, "variant_ref": str(variant.id), "in_stock": quantity > 0, "availability": availability}


async def _price(ctx: AIToolContext, value: VariantRefInput) -> dict:
    row = (await ctx.db.execute(select(ProductVariant, Product, StorefrontSetting.currency).join(
        Product, Product.id == ProductVariant.product_id,
    ).outerjoin(StorefrontSetting, StorefrontSetting.store_id == ctx.store_id).where(
        ProductVariant.id == value.variant_ref, ProductVariant.store_id == ctx.store_id,
        Product.store_id == ctx.store_id, Product.status == "active",
    ))).first()
    if row is None:
        return {"found": False}
    variant, product, currency = row
    return {"found": True, "variant_ref": str(variant.id), "amount": _money(variant.price if variant.price is not None else product.price), "currency": currency or "BDT"}


async def _url(ctx: AIToolContext, value: ProductRefInput) -> dict:
    product = await ctx.db.scalar(select(Product).where(Product.id == value.product_ref, Product.store_id == ctx.store_id, Product.status == "active"))
    if product is None:
        return {"found": False}
    primary = await get_primary_domain(ctx.db, ctx.store_id)
    return {"found": True, "url": f"{get_storefront_url_for_hostname(primary.hostname)}/products/{product.slug}"}


async def _customer(ctx: AIToolContext, _value: StrictInput) -> dict:
    if not ctx.conversation.customer_id:
        return {"linked": False}
    customer = await ctx.db.scalar(select(Customer).where(Customer.id == ctx.conversation.customer_id, Customer.store_id == ctx.store_id))
    if customer is None:
        return {"linked": False}
    return {"linked": True, "name": customer.name, "city": customer.city, "email_available": bool(customer.email), "phone_available": bool(customer.phone)}


async def _resolve_private_order(ctx: AIToolContext, order_number: str | None = None, order_ref: UUID | None = None) -> Order | None:
    linked = select(ConversationOrderLink.order_id).where(ConversationOrderLink.conversation_id == ctx.conversation.id)
    statement = select(Order).where(Order.store_id == ctx.store_id)
    if order_ref:
        statement = statement.where(Order.id == order_ref)
    if order_number:
        statement = statement.where(Order.order_number == order_number)
    if ctx.conversation.customer_id:
        statement = statement.where((Order.customer_id == ctx.conversation.customer_id) | (Order.id.in_(linked)))
    else:
        statement = statement.where(Order.id.in_(linked))
    return await ctx.db.scalar(statement.order_by(Order.created_at.desc()).limit(1))


async def _lookup_order(ctx: AIToolContext, value: OrderLookupInput) -> dict:
    row = await _resolve_private_order(ctx, value.order_number)
    return {"found": False, "privacy_verified": False} if row is None else {
        "found": True, "privacy_verified": True, "order_ref": str(row.id), "order_number": row.order_number,
    }


async def _order_status(ctx: AIToolContext, value: OrderRefInput) -> dict:
    row = await _resolve_private_order(ctx, order_ref=value.order_ref)
    if row is None:
        return {"found": False, "privacy_verified": False}
    return {
        "found": True, "privacy_verified": True, "order_number": row.order_number,
        "status": row.status, "payment_status": row.payment_status,
    }


async def _delivery(ctx: AIToolContext, value: DeliveryInput) -> dict:
    settings = await ctx.db.scalar(select(StorefrontSetting).where(StorefrontSetting.store_id == ctx.store_id))
    if settings is None or value.zone is None:
        return {"available": False, "needs": ["delivery zone"]}
    amount = Decimal(str(settings.outside_dhaka_delivery_charge if value.zone == "outside_dhaka" else settings.inside_dhaka_delivery_charge))
    if settings.free_delivery_minimum is not None and value.subtotal is not None and value.subtotal >= Decimal(str(settings.free_delivery_minimum)):
        amount = Decimal("0")
    return {"available": True, "zone": value.zone, "amount": _money(amount), "currency": settings.currency}


async def _store_info(ctx: AIToolContext, _value: StrictInput) -> dict:
    store = await ctx.db.scalar(select(Store).where(Store.id == ctx.store_id).execution_options(include_all_stores=True))
    info = await ctx.db.scalar(select(BusinessSettings).where(BusinessSettings.store_id == ctx.store_id))
    primary = await get_primary_domain(ctx.db, ctx.store_id)
    return {
        "name": store.name if store else None, "email": info.business_email if info else None,
        "phone": info.business_phone if info else None, "address": info.business_address if info else None,
        "url": get_storefront_url_for_hostname(primary.hostname),
    }


async def _handoff(ctx: AIToolContext, value: HandoffInput) -> dict:
    ctx.conversation.handling_mode = "human"
    if ctx.conversation.status == "resolved":
        ctx.conversation.status = "open"
    return {"handed_off": True, "reason": value.reason}


EMPTY_INPUT = type("EmptyInput", (StrictInput,), {})

TOOLS = (
    RegisteredAITool("search_products", "Search active products in this Store. Use before choosing product references.", SearchProductsInput, _search),
    RegisteredAITool("get_product", "Get a safe factual projection of one Store product.", ProductRefInput, _product),
    RegisteredAITool("list_variants", "List the actual variants for one product.", ProductRefInput, _variants),
    RegisteredAITool("get_variant", "Get one actual product variant.", VariantRefInput, _variant),
    RegisteredAITool("check_stock", "Check current authoritative warehouse inventory for a variant.", VariantRefInput, _stock),
    RegisteredAITool("get_price", "Get current Store currency and selling price for a variant.", VariantRefInput, _price),
    RegisteredAITool("get_product_url", "Get the canonical primary-domain product URL.", ProductRefInput, _url),
    RegisteredAITool("lookup_customer", "Get minimal details for the Customer already linked to this conversation.", EMPTY_INPUT, _customer),
    RegisteredAITool("lookup_order", "Find only an order linked to this conversation or its linked Customer.", OrderLookupInput, _lookup_order),
    RegisteredAITool("get_order_status", "Read current status for a privacy-verified order reference.", OrderRefInput, _order_status),
    RegisteredAITool("get_delivery_information", "Calculate configured delivery charge when zone and optional subtotal are known.", DeliveryInput, _delivery),
    RegisteredAITool("get_store_information", "Read configured public Store information.", EMPTY_INPUT, _store_info),
    RegisteredAITool("handoff_to_agent", "Hand the conversation to a human without sending provider content.", HandoffInput, _handoff, read_only=False),
)

AI_TOOL_REGISTRY = {tool.key: tool for tool in TOOLS}


def validate_tool_arguments(tool: RegisteredAITool, arguments: dict[str, Any]) -> StrictInput:
    try:
        return tool.input_model.model_validate(arguments)
    except ValidationError as exc:
        raise AIToolValidationError("Tool arguments failed strict validation") from exc
