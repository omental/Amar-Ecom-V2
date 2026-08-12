from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.domains import InvalidHostname, is_reserved_platform_hostname, normalize_hostname, normalize_request_hostname, platform_hostname
from app.models.tenant import Organization, OrganizationMember, Store, StoreDomain, StoreMember
from app.models.user import User


DEFAULT_ORGANIZATION_SLUG = "amar-ecom"
DEFAULT_STORE_SLUG = "main-store"


@dataclass(frozen=True, slots=True)
class PublicStoreContext:
    store: Store
    organization: Organization
    domain: StoreDomain


async def ensure_default_tenant(db: AsyncSession) -> tuple[Organization, Store]:
    """Idempotent compatibility bootstrap for installs created outside Alembic."""
    organization = await db.scalar(select(Organization).where(Organization.slug == DEFAULT_ORGANIZATION_SLUG))
    if organization is None:
        organization = Organization(name="Amar-eCom", slug=DEFAULT_ORGANIZATION_SLUG, status="active")
        db.add(organization)
        await db.flush()
    store = await db.scalar(
        select(Store).where(Store.slug == DEFAULT_STORE_SLUG).execution_options(include_all_stores=True)
    )
    if store is None:
        store = Store(
            organization_id=organization.id,
            name="Main Store",
            slug=DEFAULT_STORE_SLUG,
            status="active",
            is_primary=True,
        )
        db.add(store)
        await db.flush()
    users = list((await db.execute(select(User))).scalars().all())
    for user in users:
        organization_member = await db.scalar(select(OrganizationMember).where(
            OrganizationMember.organization_id == organization.id,
            OrganizationMember.user_id == user.id,
        ))
        if organization_member is None:
            db.add(OrganizationMember(
                organization_id=organization.id,
                user_id=user.id,
                role="owner" if user.role in {"admin", "super_admin"} else "member",
                status="active",
            ))
        store_member = await db.scalar(select(StoreMember).where(StoreMember.store_id == store.id, StoreMember.user_id == user.id))
        if store_member is None:
            db.add(StoreMember(
                store_id=store.id,
                user_id=user.id,
                role="admin" if user.role in {"admin", "super_admin"} else "staff",
                status="active",
            ))
    await db.flush()
    from app.core.tenant import tenant_scope
    from app.services.store_domain_service import ensure_platform_domain
    with tenant_scope(store_id=store.id, organization_id=organization.id):
        await ensure_platform_domain(db, store)
    return organization, store


async def add_user_to_primary_store(db: AsyncSession, user: User, *, organization_role: str = "member") -> Store:
    store = await db.scalar(
        select(Store)
        .where(Store.status == "active")
        .order_by(Store.is_primary.desc(), Store.created_at.asc())
        .execution_options(include_all_stores=True)
    )
    if store is None:
        raise RuntimeError("No active Store exists; run the tenant migration/bootstrap first")
    organization_membership = await db.scalar(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == store.organization_id,
            OrganizationMember.user_id == user.id,
        )
    )
    if organization_membership is None:
        db.add(OrganizationMember(
            organization_id=store.organization_id,
            user_id=user.id,
            role=organization_role,
            status="active",
        ))
    store_membership = await db.scalar(
        select(StoreMember).where(StoreMember.store_id == store.id, StoreMember.user_id == user.id)
    )
    if store_membership is None:
        db.add(StoreMember(
            store_id=store.id,
            user_id=user.id,
            role="admin" if user.role in {"admin", "super_admin"} else "staff",
            status="active",
        ))
    await db.flush()
    return store


async def get_accessible_stores(db: AsyncSession, user: User) -> list[Store]:
    result = await db.execute(
        select(Store)
        .join(Organization, Organization.id == Store.organization_id)
        .join(OrganizationMember, OrganizationMember.organization_id == Organization.id)
        .outerjoin(
            StoreMember,
            (StoreMember.store_id == Store.id)
            & (StoreMember.user_id == user.id)
            & (StoreMember.status == "active"),
        )
        .where(
            OrganizationMember.user_id == user.id,
            OrganizationMember.status == "active",
            Organization.status == "active",
            Store.status == "active",
            or_(OrganizationMember.role == "owner", StoreMember.id.is_not(None)),
        )
        .order_by(Store.is_primary.desc(), Store.created_at.asc())
        .execution_options(include_all_stores=True)
    )
    return list(result.scalars().unique().all())


async def resolve_user_store(db: AsyncSession, user: User, requested_store: str | None) -> tuple[OrganizationMember, StoreMember | None, Store]:
    stores = await get_accessible_stores(db, user)
    store = next(
        (item for item in stores if str(item.id) == requested_store or item.slug == requested_store),
        None,
    ) if requested_store else (stores[0] if stores else None)
    if store is None:
        # A safe not-found response does not disclose whether another tenant exists.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")

    organization_membership = await db.scalar(
        select(OrganizationMember).options(selectinload(OrganizationMember.organization)).where(
            OrganizationMember.organization_id == store.organization_id,
            OrganizationMember.user_id == user.id,
            OrganizationMember.status == "active",
        )
    )
    if organization_membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    store_membership = await db.scalar(
        select(StoreMember).where(
            StoreMember.store_id == store.id,
            StoreMember.user_id == user.id,
            StoreMember.status == "active",
        )
    )
    return organization_membership, store_membership, store


class StoreResolver:
    """Authoritative public hostname -> StoreDomain -> Store boundary."""

    @staticmethod
    async def resolve_by_hostname(db: AsyncSession, hostname: str) -> PublicStoreContext:
        try:
            normalized = normalize_request_hostname(hostname)
        except InvalidHostname as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storefront not found") from exc

        production_base = normalize_hostname(settings.STOREFRONT_BASE_DOMAIN)
        development_base = normalize_hostname(settings.STOREFRONT_DEV_BASE_DOMAIN)
        if settings.APP_ENV in {"development", "test"} and (
            normalized == development_base or normalized.endswith(f".{development_base}")
        ):
            label = normalized[: -(len(development_base) + 1)] if normalized != development_base else ""
            if not label or "." in label:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storefront not found")
            normalized = platform_hostname(label, production_base)
        if is_reserved_platform_hostname(normalized, production_base):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storefront not found")

        domain = await db.scalar(
            select(StoreDomain)
            .options(selectinload(StoreDomain.store).selectinload(Store.organization))
            .where(StoreDomain.hostname == normalized, StoreDomain.status == "active")
            .execution_options(include_all_stores=True)
        )
        if domain is None or domain.store.status != "active" or domain.store.organization.status != "active":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storefront not found")
        return PublicStoreContext(store=domain.store, organization=domain.store.organization, domain=domain)

    @staticmethod
    async def resolve(
        db: AsyncSession,
        *,
        hostname: str | None = None,
        requested_store: str | None = None,
    ) -> PublicStoreContext:
        if hostname and not (
            settings.APP_ENV in {"development", "test"}
            and settings.STOREFRONT_ALLOW_LEGACY_FALLBACK
            and hostname.split(":", 1)[0].lower() in {"testserver", "localhost", "127.0.0.1"}
        ):
            return await StoreResolver.resolve_by_hostname(db, hostname)
        if requested_store and settings.APP_ENV in {"development", "test"}:
            # Compatibility is explicit and still resolves through StoreDomain.
            requested = requested_store.lower().strip()
            return await StoreResolver.resolve_by_hostname(
                db,
                requested if "." in requested else platform_hostname(requested, settings.STOREFRONT_BASE_DOMAIN),
            )
        if settings.APP_ENV in {"development", "test"} and settings.STOREFRONT_ALLOW_LEGACY_FALLBACK:
            store = await db.scalar(
                select(Store)
                .where(Store.status == "active")
                .order_by(Store.is_primary.desc(), Store.created_at.asc())
                .execution_options(include_all_stores=True)
            )
            if store is not None:
                return await StoreResolver.resolve_by_hostname(db, platform_hostname(store.slug, settings.STOREFRONT_BASE_DOMAIN))
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storefront not found")


def _as_uuid(value: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(value)
    except (TypeError, ValueError):
        return None
