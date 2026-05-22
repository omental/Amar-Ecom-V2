from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession
from app.api.utils import commit_or_409, ensure_unique
from app.api.utils import fetch_one_or_404
from app.models.customer import Customer
from app.models.order import Order, OrderEvent, OrderItem
from app.models.product import Product
from app.models.storefront import (
    StorefrontBanner,
    StorefrontCoupon,
    StorefrontMenu,
    StorefrontPage,
    StorefrontSection,
    StorefrontSetting,
)
from app.schemas.storefront import (
    PublicStorefrontCouponValidateInput,
    PublicStorefrontCouponValidateResponse,
    PublicStorefrontOrderCreate,
    PublicStorefrontOrderCreateResponse,
    PublicStorefrontMenuItem,
    PublicStorefrontPage,
    PublicStorefrontResponse,
    PublicStorefrontSection,
    PublicStorefrontSetting,
    PublicStorefrontTrackedOrder,
    PublicStorefrontTrackedOrderItem,
)
from app.services.notification_service import notify_admins
from app.services.storefront_checkout_service import (
    calculate_delivery_charge,
    derive_public_order_timeline,
    validate_coupon_for_checkout,
)
from app.services.storefront_html_service import sanitize_storefront_html
from app.services.storefront_service import (
    banner_is_currently_active,
    build_menu_tree,
    ensure_storefront_defaults,
    get_or_create_storefront_settings,
)
from app.services.storefront_product_service import (
    PRODUCT_SECTION_TYPES,
    PUBLIC_PRODUCT_STATUSES,
    get_public_product_available_quantity,
    get_public_product_prices,
    get_public_product_stock_status,
    resolve_storefront_section_products,
)


router = APIRouter()


def _generate_public_order_code() -> str:
    return f"WEB-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"


def _normalize_phone(value: str | None) -> str:
    if not value:
        return ""
    return "".join(character for character in value if character.isdigit() or character == "+")


def _mask_phone(value: str | None) -> str | None:
    if not value:
        return None
    if len(value) <= 4:
        return value
    return f"{value[:3]}{'*' * max(3, len(value) - 5)}{value[-2:]}"


def _build_public_order_item_name(product: Product, *, selected_size: str | None, selected_color: str | None) -> str:
    option_parts = []
    if selected_size:
        option_parts.append(f"Size: {selected_size}")
    if selected_color:
        option_parts.append(f"Color: {selected_color}")
    if not option_parts:
        return product.name
    return f"{product.name} ({', '.join(option_parts)})"


def _public_order_query():
    return (
        select(Order)
        .options(
            selectinload(Order.items),
            selectinload(Order.customer),
            selectinload(Order.events),
        )
    )


async def _load_public_products_by_ids(db: DBSession, product_ids: list) -> dict[str, Product]:
    result = await db.execute(
        select(Product)
        .options(
            selectinload(Product.inventory_items),
            selectinload(Product.variants),
        )
        .where(Product.id.in_(product_ids))
    )
    products = list(result.scalars().unique().all())
    public_products = {
        str(product.id): product
        for product in products
        if product.status and product.status.lower() in PUBLIC_PRODUCT_STATUSES
    }
    return public_products


async def _get_coupon_by_code(db: DBSession, code: str | None) -> StorefrontCoupon | None:
    normalized = (code or "").strip().upper()
    if not normalized:
        return None
    result = await db.execute(
        select(StorefrontCoupon).where(StorefrontCoupon.code == normalized).limit(1)
    )
    return result.scalar_one_or_none()


async def _resolve_cart_subtotal(
    db: DBSession,
    items: list[tuple[str, int]],
) -> tuple[Decimal, dict[str, Product]]:
    product_ids = [product_id for product_id, _quantity in items]
    public_products = await _load_public_products_by_ids(db, product_ids)

    if len(public_products) != len(set(product_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more selected products are not available publicly.",
        )

    subtotal = Decimal("0.00")
    for product_id, quantity in items:
        product = public_products[product_id]
        available_quantity = get_public_product_available_quantity(product)
        stock_status = get_public_product_stock_status(product)
        if stock_status == "out_of_stock" or available_quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"{product.name} is currently out of stock.",
            )
        if quantity > available_quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Only {available_quantity} unit(s) of {product.name} are available right now.",
            )
        _, current_price = get_public_product_prices(product)
        subtotal += current_price * quantity

    return subtotal, public_products


def _public_menu_item(item) -> PublicStorefrontMenuItem:
    return PublicStorefrontMenuItem(
        label=item.label,
        url=item.url,
        target=item.target,
        children=[_public_menu_item(child) for child in item.children if child.is_active],
    )


async def _public_menus_map(db: DBSession) -> dict[str, list[PublicStorefrontMenuItem]]:
    result = await db.execute(
        select(StorefrontMenu)
        .options(selectinload(StorefrontMenu.items))
        .where(StorefrontMenu.is_active.is_(True))
        .order_by(StorefrontMenu.location.asc())
    )
    menus = list(result.scalars().unique().all())
    payload: dict[str, list[PublicStorefrontMenuItem]] = {}
    for menu in menus:
        roots = build_menu_tree(list(menu.items), include_inactive=False)
        payload[menu.location] = [_public_menu_item(item) for item in roots]
    return payload


async def _section_payload(db: DBSession, section: StorefrontSection) -> PublicStorefrontSection:
    products = []
    if section.type in PRODUCT_SECTION_TYPES:
        products = await resolve_storefront_section_products(
            db,
            section_type=section.type,
            settings=section.settings or {},
        )
    return PublicStorefrontSection(
        type=section.type,
        title=section.title,
        subtitle=section.subtitle,
        settings=section.settings or {},
        content=section.content or {},
        products=products,
    )


async def _page_response(db: DBSession, page: StorefrontPage) -> PublicStorefrontPage:
    return PublicStorefrontPage(
        title=page.title,
        slug=page.slug,
        seo_title=page.seo_title,
        seo_description=page.seo_description,
        content=sanitize_storefront_html(page.content),
        sections=[
            await _section_payload(db, section)
            for section in sorted(page.sections, key=lambda item: (item.sort_order, item.created_at))
            if section.is_enabled
        ],
    )


def _settings_payload(settings) -> PublicStorefrontSetting:
    return PublicStorefrontSetting(
        brand_name=settings.brand_name,
        logo_url=settings.logo_url,
        favicon_url=settings.favicon_url,
        phone=settings.phone,
        email=settings.email,
        address=settings.address,
        active_template_key=settings.active_template_key,
        typography_preset=settings.typography_preset,
        color_preset=settings.color_preset,
        animation_preset=settings.animation_preset,
        product_card_style=settings.product_card_style,
        button_style=settings.button_style,
        header_layout=settings.header_layout,
        footer_layout=settings.footer_layout,
        spacing_density=settings.spacing_density,
        corner_radius=settings.corner_radius,
        shadow_style=settings.shadow_style,
        primary_color=settings.primary_color,
        accent_color=settings.accent_color,
        secondary_color=settings.secondary_color,
        currency=settings.currency,
        show_topbar=settings.show_topbar,
        show_search=settings.show_search,
        show_cart=settings.show_cart,
        show_track_order=settings.show_track_order,
        inside_dhaka_delivery_charge=float(settings.inside_dhaka_delivery_charge),
        outside_dhaka_delivery_charge=float(settings.outside_dhaka_delivery_charge),
        free_delivery_minimum=float(settings.free_delivery_minimum) if settings.free_delivery_minimum is not None else None,
        footer_description=settings.footer_description,
        footer_copyright_text=settings.footer_copyright_text,
        social_share_image_url=settings.social_share_image_url,
        social_links=settings.social_links or {},
        seo_title=settings.seo_title,
        seo_description=settings.seo_description,
    )


async def _storefront_response_for_page(db: DBSession, page: StorefrontPage) -> PublicStorefrontResponse:
    settings = await get_or_create_storefront_settings(db)
    if not settings.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storefront is inactive")

    menus = await _public_menus_map(db)
    return PublicStorefrontResponse(
        settings=_settings_payload(settings),
        menus=menus,
        page=await _page_response(db, page),
    )


@router.get("/settings", response_model=PublicStorefrontSetting)
async def get_public_storefront_settings(db: DBSession) -> PublicStorefrontSetting:
    await ensure_storefront_defaults(db)
    settings = await get_or_create_storefront_settings(db)
    if not settings.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storefront is inactive")
    return _settings_payload(settings)


@router.get("/menus")
async def get_public_storefront_menus(db: DBSession) -> dict[str, list[PublicStorefrontMenuItem]]:
    await ensure_storefront_defaults(db)
    return await _public_menus_map(db)


@router.get("/pages/home", response_model=PublicStorefrontResponse)
async def get_public_home_page(db: DBSession) -> PublicStorefrontResponse:
    await ensure_storefront_defaults(db)
    page = await fetch_one_or_404(
        db,
        select(StorefrontPage)
        .options(selectinload(StorefrontPage.sections))
        .where(StorefrontPage.slug == "home", StorefrontPage.status == "published"),
        "Public storefront page not found",
    )

    banners_result = await db.execute(
        select(StorefrontBanner)
        .where(StorefrontBanner.location == "hero_slider")
        .order_by(StorefrontBanner.sort_order.asc(), StorefrontBanner.created_at.asc())
    )
    active_banners = [banner for banner in banners_result.scalars().all() if banner_is_currently_active(banner)]
    for section in page.sections:
        if section.type == "hero_slider" and active_banners:
            existing_slides = section.content.get("slides", []) if isinstance(section.content, dict) else []
            section.content = {
                **(section.content or {}),
                "slides": [
                    {
                        "title": banner.title,
                        "subtitle": banner.subtitle,
                        "image_url": banner.image_url,
                        "mobile_image_url": banner.mobile_image_url,
                        "button_text": banner.button_text,
                        "button_url": banner.button_url,
                        "discount": existing_slides[index].get("discount") if index < len(existing_slides) and isinstance(existing_slides[index], dict) else None,
                    }
                    for index, banner in enumerate(active_banners)
                ],
            }
    return await _storefront_response_for_page(db, page)


@router.get("/pages/{slug}", response_model=PublicStorefrontResponse)
async def get_public_storefront_page(slug: str, db: DBSession) -> PublicStorefrontResponse:
    await ensure_storefront_defaults(db)
    page = await fetch_one_or_404(
        db,
        select(StorefrontPage)
        .options(selectinload(StorefrontPage.sections))
        .where(StorefrontPage.slug == slug, StorefrontPage.status == "published"),
        "Public storefront page not found",
    )
    return await _storefront_response_for_page(db, page)


@router.post("/coupons/validate", response_model=PublicStorefrontCouponValidateResponse)
async def validate_public_storefront_coupon(
    payload: PublicStorefrontCouponValidateInput,
    db: DBSession,
) -> PublicStorefrontCouponValidateResponse:
    settings = await get_or_create_storefront_settings(db)
    subtotal, _public_products = await _resolve_cart_subtotal(
        db,
        [(str(item.product_id), item.quantity) for item in payload.items],
    )
    coupon = await _get_coupon_by_code(db, payload.code)
    if coupon is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coupon not found.")

    discount_total = validate_coupon_for_checkout(coupon, subtotal=subtotal)
    discounted_subtotal = subtotal - discount_total
    delivery_charge = calculate_delivery_charge(
        settings,
        subtotal=discounted_subtotal,
        delivery_zone=payload.delivery_zone,
    )
    total = discounted_subtotal + delivery_charge

    return PublicStorefrontCouponValidateResponse(
        code=coupon.code,
        discount_type=coupon.type,
        discount_total=float(discount_total),
        subtotal=float(subtotal),
        delivery_charge=float(delivery_charge),
        total=float(total),
        message="Coupon applied successfully.",
    )


@router.post("/orders", response_model=PublicStorefrontOrderCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_public_storefront_order(
    payload: PublicStorefrontOrderCreate,
    db: DBSession,
) -> PublicStorefrontOrderCreateResponse:
    settings = await get_or_create_storefront_settings(db)
    subtotal, public_products = await _resolve_cart_subtotal(
        db,
        [(str(item.product_id), item.quantity) for item in payload.items],
    )
    normalized_phone = _normalize_phone(payload.phone)
    order_items: list[OrderItem] = []

    for item in payload.items:
        product = public_products[str(item.product_id)]
        _, current_price = get_public_product_prices(product)
        line_total = current_price * item.quantity

        option_suffix = []
        if item.selected_size:
            option_suffix.append(f"size={item.selected_size}")
        if item.selected_color:
            option_suffix.append(f"color={item.selected_color}")

        order_items.append(
            OrderItem(
                product_id=product.id,
                variant_id=None,
                product_name=_build_public_order_item_name(
                    product,
                    selected_size=item.selected_size,
                    selected_color=item.selected_color,
                ),
                sku=product.sku if not option_suffix else f"{product.sku} [{' | '.join(option_suffix)}]",
                quantity=item.quantity,
                unit_price=current_price,
                total_price=line_total,
            )
        )

    coupon = await _get_coupon_by_code(db, payload.coupon_code)
    if payload.coupon_code and coupon is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coupon not found.")
    discount_total = validate_coupon_for_checkout(coupon, subtotal=subtotal) if coupon else Decimal("0.00")
    discounted_subtotal = subtotal - discount_total
    delivery_charge = calculate_delivery_charge(
        settings,
        subtotal=discounted_subtotal,
        delivery_zone=payload.delivery_zone,
    )
    total = discounted_subtotal + delivery_charge

    customer_result = await db.execute(
        select(Customer).where(Customer.phone == payload.phone).limit(1)
    )
    customer = customer_result.scalar_one_or_none()
    customer_notes_parts = []
    if payload.alternative_phone:
        customer_notes_parts.append(f"Alternative phone: {payload.alternative_phone}")
    customer_notes_parts.append(f"Delivery zone: {payload.delivery_zone}")
    if payload.delivery_note:
        customer_notes_parts.append(f"Delivery note: {payload.delivery_note}")
    if coupon:
        customer_notes_parts.append(f"Coupon applied: {coupon.code}")
    customer_notes = "\n".join(customer_notes_parts) if customer_notes_parts else None

    if customer is None:
        customer = Customer(
            name=payload.customer_name,
            phone=payload.phone,
            email=payload.email,
            address=payload.address,
            city=payload.district,
            customer_type="regular",
            notes=customer_notes,
        )
        db.add(customer)
        await db.flush()
    else:
        customer.name = payload.customer_name
        customer.email = payload.email
        customer.address = payload.address
        customer.city = payload.district
        if customer_notes:
            customer.notes = customer_notes

    order_number = _generate_public_order_code()
    await ensure_unique(db, Order, "order_number", order_number, "Generated public order code already exists")

    order = Order(
        order_number=order_number,
        customer_id=customer.id,
        customer_name=payload.customer_name,
        customer_phone=normalized_phone or payload.phone,
        shipping_address=payload.address,
        notes=customer_notes,
        tags=",".join(
            part
            for part in [
                "storefront",
                "cod",
                payload.delivery_zone,
                f"coupon:{coupon.code}" if coupon else None,
            ]
            if part
        ),
        status="pending",
        payment_status="unpaid",
        payment_method=payload.payment_method,
        source="storefront",
        subtotal=subtotal,
        discount=discount_total,
        delivery_charge=delivery_charge,
        paid_amount=Decimal("0.00"),
        total=total,
        stock_deducted=False,
    )
    order.items.extend(order_items)
    order.events.append(
        OrderEvent(
            event_type="order_created",
            message="Public storefront order placed.",
            created_by_id=None,
        )
    )
    db.add(order)
    await db.flush()

    if coupon is not None:
        coupon.usage_count = (coupon.usage_count or 0) + 1

    await notify_admins(
        db,
        title="New storefront order",
        message=f"Storefront order {order.order_number} was placed by {payload.customer_name}.",
        notification_type="order",
        link=f"/dashboard/orders/{order.id}",
        module="orders",
        metadata={"order_id": str(order.id), "status": order.status, "source": order.source},
    )

    await commit_or_409(db, "Could not place storefront order")
    await db.refresh(order)

    return PublicStorefrontOrderCreateResponse(
        public_order_code=order.order_number,
        tracking_code=order.order_number,
        status=order.status,
        discount_total=float(order.discount),
        subtotal=float(order.subtotal),
        delivery_charge=float(order.delivery_charge),
        total=float(order.total),
        delivery_zone=payload.delivery_zone,
        coupon_code=coupon.code if coupon else None,
        created_at=order.created_at,
    )


@router.get("/orders/track", response_model=PublicStorefrontTrackedOrder)
async def track_public_storefront_order(
    db: DBSession,
    code: str = Query(min_length=3),
    phone: str = Query(min_length=5),
) -> PublicStorefrontTrackedOrder:
    order = await fetch_one_or_404(
        db,
        _public_order_query().where(Order.order_number == code.strip()),
        "Order not found",
    )

    normalized_input_phone = _normalize_phone(phone)
    stored_phone_candidates = {
        _normalize_phone(order.customer_phone),
        _normalize_phone(order.customer.phone if order.customer else None),
    }
    stored_phone_candidates.discard("")
    if normalized_input_phone not in stored_phone_candidates:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    return PublicStorefrontTrackedOrder(
        tracking_code=order.order_number,
        status=order.status,
        created_at=order.created_at,
        customer_name=order.customerName,
        customer_phone_masked=_mask_phone(order.customerPhone),
        items=[
            PublicStorefrontTrackedOrderItem(
                product_name=item.product_name,
                quantity=item.quantity,
                price=float(item.unit_price),
                total=float(item.total_price),
            )
            for item in order.items
        ],
        discount_total=float(order.discount),
        subtotal=float(order.subtotal),
        delivery_charge=float(order.delivery_charge),
        total=float(order.total),
        delivery_zone="outside_dhaka" if "outside_dhaka" in (order.tags or "") else "inside_dhaka",
        coupon_code=next(
            (
                fragment.split(":", 1)[1]
                for fragment in (order.tags or "").split(",")
                if fragment.startswith("coupon:")
            ),
            None,
        ),
        timeline=derive_public_order_timeline(order),
    )
