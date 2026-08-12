from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.domains import normalize_custom_hostname, normalize_hostname, platform_hostname, registrable_domain
from app.models.tenant import Store, StoreDomain


def get_platform_hostname(store: Store | str) -> str:
    slug = store.slug if isinstance(store, Store) else store
    return platform_hostname(slug, settings.STOREFRONT_BASE_DOMAIN)


def get_storefront_url_for_hostname(hostname: str) -> str:
    scheme = settings.STOREFRONT_PUBLIC_SCHEME
    return f"{scheme}://{normalize_hostname(hostname)}"


def get_development_storefront_url(store: Store | str) -> str:
    slug = store.slug if isinstance(store, Store) else store
    host = platform_hostname(slug, settings.STOREFRONT_DEV_BASE_DOMAIN)
    port = f":{settings.STOREFRONT_DEV_PORT}" if settings.STOREFRONT_DEV_PORT else ""
    return f"{settings.STOREFRONT_DEV_SCHEME}://{host}{port}"


async def ensure_platform_domain(db: AsyncSession, store: Store) -> StoreDomain:
    existing = await db.scalar(
        select(StoreDomain)
        .where(StoreDomain.store_id == store.id, StoreDomain.domain_type == "platform_subdomain")
        .execution_options(include_all_stores=True)
    )
    expected = get_platform_hostname(store)
    if existing is not None:
        if existing.hostname != expected:
            raise RuntimeError("Store platform hostname does not match its immutable slug")
        return existing
    domain = StoreDomain(
        store_id=store.id,
        hostname=expected,
        domain_type="platform_subdomain",
        status="active",
        is_primary=True,
        redirect_to_primary=False,
        verification_status="not_required",
        routing_status="not_required",
        ssl_status="active" if settings.STOREFRONT_WILDCARD_TLS_ACTIVE else "pending",
        verified_at=datetime.now(timezone.utc),
    )
    db.add(domain)
    await db.flush()
    return domain


async def get_primary_domain(db: AsyncSession, store_id: UUID) -> StoreDomain:
    domain = await db.scalar(
        select(StoreDomain).where(
            StoreDomain.store_id == store_id,
            StoreDomain.is_primary.is_(True),
            StoreDomain.status == "active",
        )
    )
    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store domain not found")
    return domain


async def create_custom_domain(db: AsyncSession, *, store: Store, hostname: str) -> StoreDomain:
    normalized = normalize_custom_hostname(hostname, platform_base_domain=settings.STOREFRONT_BASE_DOMAIN)
    if db.get_bind().dialect.name == "postgresql":
        await db.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
            {"key": f"amar-custom-domains:{store.id}"},
        )
    custom_domains = list((await db.execute(
        select(StoreDomain).where(StoreDomain.store_id == store.id, StoreDomain.domain_type == "custom")
    )).scalars().all())
    if len(custom_domains) >= settings.CUSTOM_DOMAIN_MAX_PER_STORE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Custom domain limit reached")
    if custom_domains:
        existing_root = registrable_domain(custom_domains[0].hostname)
        if registrable_domain(normalized) != existing_root:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This Store may connect one custom apex domain and its www alias",
            )
        first = custom_domains[0].hostname
        allowed_aliases = {first[4:] if first.startswith("www.") else f"www.{first}"}
        if normalized not in allowed_aliases:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The second custom domain must be the www/non-www alias of the first",
            )
    domain = StoreDomain(
        store_id=store.id,
        hostname=normalized,
        domain_type="custom",
        status="pending",
        is_primary=False,
        redirect_to_primary=False,
        verification_status="pending",
        routing_status="pending",
        ssl_status="pending",
    )
    db.add(domain)
    await db.flush()
    return domain


async def make_primary_domain(db: AsyncSession, *, store_id: UUID, domain_id: UUID) -> StoreDomain:
    domains = list((await db.execute(
        select(StoreDomain).where(StoreDomain.store_id == store_id).with_for_update()
    )).scalars().all())
    target = next((domain for domain in domains if domain.id == domain_id), None)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found")
    ssl_ready = target.ssl_status == "active" or target.domain_type == "platform_subdomain"
    if target.status != "active" or target.verification_status not in {"verified", "not_required"} or not ssl_ready:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Domain must be verified, routed, and SSL-ready")
    # Clear first so PostgreSQL's partial unique index is never transiently violated
    # by statement ordering inside one ORM flush.
    for domain in domains:
        domain.is_primary = False
    await db.flush()
    for domain in domains:
        domain.is_primary = domain.id == target.id
        domain.redirect_to_primary = domain.id != target.id and domain.status == "active"
    await db.flush()
    return target


async def get_custom_domain_count(db: AsyncSession, store_id: UUID) -> int:
    return int(await db.scalar(select(func.count()).select_from(StoreDomain).where(
        StoreDomain.store_id == store_id,
        StoreDomain.domain_type == "custom",
    )) or 0)
