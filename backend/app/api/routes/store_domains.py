from __future__ import annotations

from dataclasses import asdict
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user, get_entitlement_context, get_tenant_context, require_platform_admin
from app.core.config import settings
from app.core.domains import InvalidHostname
from app.core.tenant import TenantContext, tenant_scope
from app.models.access_control import ActivityLog
from app.models.dns import DnsZone
from app.models.tenant import Store, StoreDomain, StoreDomainCertificate
from app.models.user import User
from app.schemas.store_domain import DNSInstructionRead, PlatformDomainDisable, StoreDomainCreate, StoreDomainRead
from app.services.commercial_access_service import EntitlementService
from app.services.domain_verification_service import DomainVerificationService, build_dns_instructions
from app.services.store_domain_service import (
    create_custom_domain,
    get_development_storefront_url,
    get_storefront_url_for_hostname,
    make_primary_domain,
)


router = APIRouter()
platform_router = APIRouter()


def _domain_read(domain: StoreDomain, *, store: Store) -> StoreDomainRead:
    records = []
    if domain.domain_type == "custom" and domain.verification_token_encrypted:
        records = [DNSInstructionRead(**asdict(record)) for record in build_dns_instructions(domain)]
    certificate = domain.certificate
    return StoreDomainRead(
        id=domain.id,
        hostname=domain.hostname,
        domain_type=domain.domain_type,
        status=domain.status,
        is_primary=domain.is_primary,
        redirect_to_primary=domain.redirect_to_primary,
        verification_status=domain.verification_status,
        routing_status=domain.routing_status,
        ssl_status=domain.ssl_status,
        verified_at=domain.verified_at,
        verification_token_expires_at=domain.verification_token_expires_at,
        last_verification_attempt_at=domain.last_verification_attempt_at,
        last_routing_checked_at=domain.last_routing_checked_at,
        verification_failure_reason=domain.verification_failure_reason,
        certificate_expires_at=certificate.expires_at if certificate else None,
        dns_records=records,
        can_make_primary=(
            domain.status == "active"
            and (domain.ssl_status == "active" or domain.domain_type == "platform_subdomain")
            and not domain.is_primary
        ),
        can_remove=(domain.domain_type == "custom" and not domain.is_primary),
        storefront_url=(
            get_development_storefront_url(store)
            if domain.domain_type == "platform_subdomain" and settings.APP_ENV in {"development", "test"}
            else get_storefront_url_for_hostname(domain.hostname)
        ),
    )


async def _tenant_domain(db: DBSession, tenant: TenantContext, domain_id: UUID, *, lock: bool = False) -> StoreDomain:
    statement = select(StoreDomain).options(selectinload(StoreDomain.certificate)).where(
        StoreDomain.id == domain_id,
        StoreDomain.store_id == tenant.store.id,
    )
    if lock:
        statement = statement.with_for_update()
    domain = await db.scalar(statement)
    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found")
    return domain


@router.get("/domains", response_model=list[StoreDomainRead])
async def list_store_domains(
    db: DBSession,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> list[StoreDomainRead]:
    domains = list((await db.execute(
        select(StoreDomain)
        .options(selectinload(StoreDomain.certificate))
        .where(StoreDomain.store_id == tenant.store.id)
        .order_by(StoreDomain.is_primary.desc(), StoreDomain.domain_type, StoreDomain.created_at)
    )).scalars().all())
    return [_domain_read(domain, store=tenant.store) for domain in domains]


@router.post("/domains", response_model=StoreDomainRead, status_code=status.HTTP_201_CREATED)
async def add_custom_domain(
    payload: StoreDomainCreate,
    db: DBSession,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    access: Annotated[EntitlementService, Depends(get_entitlement_context)],
) -> StoreDomainRead:
    await access.require_feature("custom_domain")
    try:
        domain = await create_custom_domain(db, store=tenant.store, hostname=payload.hostname)
        verifier = DomainVerificationService(db)
        verifier.rotate_token(domain)
        db.add(ActivityLog(
            organization_id=tenant.organization.id,
            user_id=tenant.user.id,
            action="custom_domain_added",
            module="domains",
            entity_type="store_domain",
            entity_id=str(domain.id),
            message=f"Custom domain {domain.hostname} added pending verification.",
        ))
        db.add(ActivityLog(
            organization_id=tenant.organization.id,
            user_id=tenant.user.id,
            action="domain_verification_generated",
            module="domains",
            entity_type="store_domain",
            entity_id=str(domain.id),
            message=f"Ownership verification generated for {domain.hostname}.",
        ))
        await db.commit()
    except InvalidHostname as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This domain is already connected") from exc
    domain = await _tenant_domain(db, tenant, domain.id)
    return _domain_read(domain, store=tenant.store)


@router.post("/domains/{domain_id}/check", response_model=StoreDomainRead)
async def check_domain(
    domain_id: UUID,
    db: DBSession,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> StoreDomainRead:
    domain = await _tenant_domain(db, tenant, domain_id, lock=True)
    old_verification, old_routing, old_ssl = domain.verification_status, domain.routing_status, domain.ssl_status
    await DomainVerificationService(db).verify(domain)
    if old_verification != "verified" and domain.verification_status == "verified":
        db.add(ActivityLog(organization_id=tenant.organization.id, user_id=tenant.user.id, action="domain_verified", module="domains", entity_type="store_domain", entity_id=str(domain.id), message=f"Ownership verified for {domain.hostname}."))
    if old_routing != "valid" and domain.routing_status == "valid":
        db.add(ActivityLog(organization_id=tenant.organization.id, user_id=tenant.user.id, action="domain_routing_verified", module="domains", entity_type="store_domain", entity_id=str(domain.id), message=f"Routing verified for {domain.hostname}."))
    if old_ssl == "pending" and domain.ssl_status in {"provisioning", "active", "failed"}:
        db.add(ActivityLog(organization_id=tenant.organization.id, user_id=tenant.user.id, action="ssl_requested", module="domains", entity_type="store_domain", entity_id=str(domain.id), message=f"SSL provisioning requested for {domain.hostname}."))
    if old_ssl != "failed" and domain.ssl_status == "failed":
        db.add(ActivityLog(organization_id=tenant.organization.id, user_id=tenant.user.id, action="ssl_failed", module="domains", entity_type="store_domain", entity_id=str(domain.id), message=f"SSL provisioning failed for {domain.hostname}."))
    if old_ssl != "active" and domain.ssl_status == "active":
        db.add(ActivityLog(organization_id=tenant.organization.id, user_id=tenant.user.id, action="ssl_active", module="domains", entity_type="store_domain", entity_id=str(domain.id), message=f"SSL became active for {domain.hostname}."))
    await db.commit()
    domain = await _tenant_domain(db, tenant, domain.id)
    return _domain_read(domain, store=tenant.store)


@router.post("/domains/{domain_id}/rotate-token", response_model=StoreDomainRead)
async def rotate_verification_token(
    domain_id: UUID,
    db: DBSession,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> StoreDomainRead:
    domain = await _tenant_domain(db, tenant, domain_id, lock=True)
    DomainVerificationService(db).rotate_token(domain)
    db.add(ActivityLog(organization_id=tenant.organization.id, user_id=tenant.user.id, action="domain_verification_generated", module="domains", entity_type="store_domain", entity_id=str(domain.id), message=f"Verification token rotated for {domain.hostname}."))
    await db.commit()
    domain = await _tenant_domain(db, tenant, domain.id)
    return _domain_read(domain, store=tenant.store)


@router.post("/domains/{domain_id}/retry-ssl", response_model=StoreDomainRead)
async def retry_ssl(
    domain_id: UUID,
    db: DBSession,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> StoreDomainRead:
    domain = await _tenant_domain(db, tenant, domain_id, lock=True)
    await DomainVerificationService(db).retry_certificate(domain)
    db.add(ActivityLog(organization_id=tenant.organization.id, user_id=tenant.user.id, action="ssl_requested", module="domains", entity_type="store_domain", entity_id=str(domain.id), message=f"SSL provisioning retried for {domain.hostname}."))
    await db.commit()
    domain = await _tenant_domain(db, tenant, domain.id)
    return _domain_read(domain, store=tenant.store)


@router.post("/domains/{domain_id}/make-primary", response_model=StoreDomainRead)
async def make_primary(
    domain_id: UUID,
    db: DBSession,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> StoreDomainRead:
    domain = await make_primary_domain(db, store_id=tenant.store.id, domain_id=domain_id)
    db.add(ActivityLog(organization_id=tenant.organization.id, user_id=tenant.user.id, action="primary_domain_changed", module="domains", entity_type="store_domain", entity_id=str(domain.id), message=f"{domain.hostname} is now the primary Store domain."))
    await db.commit()
    domain = await _tenant_domain(db, tenant, domain.id)
    return _domain_read(domain, store=tenant.store)


@router.delete("/domains/{domain_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_custom_domain(
    domain_id: UUID,
    db: DBSession,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> None:
    domain = await _tenant_domain(db, tenant, domain_id, lock=True)
    if domain.domain_type == "platform_subdomain":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The Amar-hosted domain is permanent")
    if domain.is_primary:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Choose another primary domain before removing this one")
    managed_zone = await db.scalar(select(DnsZone).where(DnsZone.store_id == tenant.store.id, DnsZone.store_domain_id == domain.id))
    if managed_zone is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Move DNS away from Amar and complete the DNS zone retention workflow before removing this domain",
        )
    await DomainVerificationService(db).revoke(domain)
    certificate = await db.scalar(select(StoreDomainCertificate).where(StoreDomainCertificate.store_domain_id == domain.id))
    hostname = domain.hostname
    if certificate:
        await db.delete(certificate)
        await db.flush()
    await db.delete(domain)
    db.add(ActivityLog(organization_id=tenant.organization.id, user_id=tenant.user.id, action="custom_domain_removed", module="domains", entity_type="store_domain", entity_id=str(domain.id), message=f"Custom domain {hostname} removed after certificate cleanup."))
    await db.commit()


@platform_router.get("/domains", dependencies=[Depends(require_platform_admin)])
async def inspect_domains(db: DBSession) -> list[dict]:
    domains = list((await db.execute(
        select(StoreDomain).options(selectinload(StoreDomain.store)).order_by(StoreDomain.created_at.desc()).execution_options(include_all_stores=True)
    )).scalars().all())
    return [{"id": domain.id, "store_id": domain.store_id, "hostname": domain.hostname, "status": domain.status, "verification_status": domain.verification_status, "routing_status": domain.routing_status, "ssl_status": domain.ssl_status} for domain in domains]


@platform_router.post("/domains/{domain_id}/retry-ssl", dependencies=[Depends(require_platform_admin)])
async def platform_retry_ssl(domain_id: UUID, db: DBSession, actor: Annotated[User, Depends(get_current_user)]) -> dict:
    domain = await db.scalar(select(StoreDomain).options(selectinload(StoreDomain.store)).where(StoreDomain.id == domain_id).execution_options(include_all_stores=True))
    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found")
    with tenant_scope(store_id=domain.store_id, organization_id=domain.store.organization_id):
        await DomainVerificationService(db).retry_certificate(domain)
        db.add(ActivityLog(organization_id=domain.store.organization_id, user_id=actor.id, action="ssl_requested", module="domains", entity_type="store_domain", entity_id=str(domain.id), message=f"Platform administrator retried SSL for {domain.hostname}."))
        await db.commit()
    return {"status": domain.ssl_status}


@platform_router.post("/domains/{domain_id}/disable", dependencies=[Depends(require_platform_admin)])
async def platform_disable_domain(
    domain_id: UUID,
    payload: PlatformDomainDisable,
    db: DBSession,
    actor: Annotated[User, Depends(get_current_user)],
) -> dict:
    domain = await db.scalar(select(StoreDomain).options(selectinload(StoreDomain.store)).where(StoreDomain.id == domain_id).execution_options(include_all_stores=True))
    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found")
    if domain.domain_type == "platform_subdomain":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Mandatory hosted domains cannot be disabled")
    with tenant_scope(store_id=domain.store_id, organization_id=domain.store.organization_id):
        if domain.is_primary:
            hosted = await db.scalar(select(StoreDomain).where(
                StoreDomain.store_id == domain.store_id,
                StoreDomain.domain_type == "platform_subdomain",
            ))
            if hosted is None:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Hosted fallback domain not found")
            await make_primary_domain(db, store_id=domain.store_id, domain_id=hosted.id)
        domain.status = "disabled"
        domain.redirect_to_primary = False
        db.add(ActivityLog(organization_id=domain.store.organization_id, user_id=actor.id, action="custom_domain_disabled", module="domains", entity_type="store_domain", entity_id=str(domain.id), message=f"Platform administrator disabled {domain.hostname}: {payload.reason}"))
        await db.commit()
    return {"status": domain.status}
