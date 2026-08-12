from __future__ import annotations

from dataclasses import asdict
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user, get_entitlement_context, get_tenant_context, require_platform_admin
from app.core.tenant import TenantContext, tenant_scope
from app.models.access_control import ActivityLog
from app.models.dns import DnsRecord, DnsZone
from app.models.tenant import StoreDomain
from app.models.user import User
from app.schemas.dns import (
    DnsDelegationRead,
    DnsImportInput,
    DnsImportPreview,
    DnsRecordInput,
    DnsRecordRead,
    DnsRecordUpdate,
    DnsZoneCreate,
    DnsZoneDeactivate,
    DnsZoneRead,
    PlatformDnsAction,
)
from app.services.commercial_access_service import EntitlementService
from app.services.dns_records import InvalidDnsRecord
from app.services.dns_service import DnsService, default_zone_name, utc_now


router = APIRouter()
platform_router = APIRouter()


async def _tenant_domain(db: DBSession, tenant: TenantContext, domain_id: UUID) -> StoreDomain:
    domain = await db.scalar(select(StoreDomain).where(StoreDomain.id == domain_id, StoreDomain.store_id == tenant.store.id))
    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found")
    return domain


async def _tenant_zone(db: DBSession, tenant: TenantContext, zone_id: UUID, *, lock: bool = False) -> DnsZone:
    statement = select(DnsZone).where(DnsZone.id == zone_id, DnsZone.store_id == tenant.store.id)
    if lock:
        statement = statement.with_for_update()
    zone = await db.scalar(statement)
    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DNS zone not found")
    return zone


async def _tenant_record(db: DBSession, tenant: TenantContext, zone_id: UUID, record_id: UUID, *, lock: bool = False) -> DnsRecord:
    statement = select(DnsRecord).where(DnsRecord.id == record_id, DnsRecord.zone_id == zone_id, DnsRecord.store_id == tenant.store.id)
    if lock:
        statement = statement.with_for_update()
    record = await db.scalar(statement)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DNS record not found")
    return record


async def _zone_read(db: DBSession, zone: DnsZone, *, editable: bool) -> DnsZoneRead:
    loaded = await db.scalar(
        select(DnsZone)
        .options(selectinload(DnsZone.records), selectinload(DnsZone.revisions), selectinload(DnsZone.store_domain))
        .where(DnsZone.id == zone.id)
    )
    assert loaded is not None
    health = await DnsService(db).health(loaded, loaded.store_domain)
    return DnsZoneRead(
        id=loaded.id,
        store_domain_id=loaded.store_domain_id,
        zone_name=loaded.zone_name,
        status=loaded.status,
        provider=loaded.provider,
        nameservers=list(loaded.nameservers),
        soa_serial=loaded.soa_serial,
        delegation_status=loaded.delegation_status,
        dnssec_status=loaded.dnssec_status,
        dnssec_ds_records=list(loaded.dnssec_ds_records),
        sync_status=loaded.sync_status,
        provider_error=loaded.provider_error,
        last_synced_at=loaded.last_synced_at,
        last_delegation_checked_at=loaded.last_delegation_checked_at,
        activated_at=loaded.activated_at,
        records=[DnsRecordRead.model_validate(item) for item in loaded.records],
        revisions=list(loaded.revisions),
        health=health,
        editable=editable and loaded.status not in {"disabled", "deactivating"},
    )


def _activity(tenant: TenantContext, *, action: str, entity_type: str, entity_id: UUID, message: str) -> ActivityLog:
    return ActivityLog(
        organization_id=tenant.organization.id,
        user_id=tenant.user.id,
        action=action,
        module="dns",
        entity_type=entity_type,
        entity_id=str(entity_id),
        message=message,
    )


async def _require_dns_edit(access: EntitlementService) -> None:
    # Existing authoritative zones continue serving after downgrade, but
    # commercial mutations are intentionally frozen until migration/upgrade.
    await access.require_feature("amar_dns")


@router.get("/domains/{domain_id}/dns", response_model=DnsZoneRead | None)
async def get_domain_dns(
    domain_id: UUID,
    db: DBSession,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    access: Annotated[EntitlementService, Depends(get_entitlement_context)],
) -> DnsZoneRead | None:
    domain = await _tenant_domain(db, tenant, domain_id)
    zone = await db.scalar(select(DnsZone).where(DnsZone.store_id == tenant.store.id, DnsZone.zone_name == default_zone_name(domain)))
    if zone is None:
        return None
    return await _zone_read(db, zone, editable=await access.has_feature("amar_dns"))


@router.post("/domains/{domain_id}/dns", response_model=DnsZoneRead, status_code=status.HTTP_201_CREATED)
async def use_amar_dns(
    domain_id: UUID,
    payload: DnsZoneCreate,
    db: DBSession,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    access: Annotated[EntitlementService, Depends(get_entitlement_context)],
) -> DnsZoneRead:
    await _require_dns_edit(access)
    domain = await _tenant_domain(db, tenant, domain_id)
    service = DnsService(db)
    try:
        zone = await service.create_zone(store=tenant.store, domain=domain, requested_zone_name=payload.zone_name, actor_id=tenant.user.id)
        db.add(_activity(tenant, action="dns_zone_created", entity_type="dns_zone", entity_id=zone.id, message=f"Amar DNS zone {zone.zone_name} prepared before delegation."))
        await db.commit()
    except (InvalidDnsRecord, ValueError) as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An Amar DNS zone already exists for this domain") from exc
    return await _zone_read(db, zone, editable=True)


@router.get("/dns/zones/{zone_id}", response_model=DnsZoneRead)
async def get_zone(
    zone_id: UUID,
    db: DBSession,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    access: Annotated[EntitlementService, Depends(get_entitlement_context)],
) -> DnsZoneRead:
    return await _zone_read(db, await _tenant_zone(db, tenant, zone_id), editable=await access.has_feature("amar_dns"))


@router.post("/dns/zones/{zone_id}/records", response_model=DnsRecordRead, status_code=status.HTTP_201_CREATED)
async def create_record(
    zone_id: UUID,
    payload: DnsRecordInput,
    db: DBSession,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    access: Annotated[EntitlementService, Depends(get_entitlement_context)],
) -> DnsRecordRead:
    await _require_dns_edit(access)
    zone = await _tenant_zone(db, tenant, zone_id, lock=True)
    try:
        record = await DnsService(db).create_record(zone, payload, actor_id=tenant.user.id)
        db.add(_activity(tenant, action="dns_record_created", entity_type="dns_record", entity_id=record.id, message=f"Created {record.record_type} record {record.name}."))
        await db.commit()
        await db.refresh(record)
    except InvalidDnsRecord as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
    return DnsRecordRead.model_validate(record)


@router.patch("/dns/zones/{zone_id}/records/{record_id}", response_model=DnsRecordRead)
async def update_record(
    zone_id: UUID,
    record_id: UUID,
    payload: DnsRecordUpdate,
    db: DBSession,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    access: Annotated[EntitlementService, Depends(get_entitlement_context)],
) -> DnsRecordRead:
    await _require_dns_edit(access)
    zone = await _tenant_zone(db, tenant, zone_id, lock=True)
    record = await _tenant_record(db, tenant, zone_id, record_id, lock=True)
    try:
        await DnsService(db).update_record(zone, record, payload, actor_id=tenant.user.id)
        db.add(_activity(tenant, action="dns_record_updated", entity_type="dns_record", entity_id=record.id, message=f"Updated {record.record_type} record {record.name}."))
        await db.commit()
        await db.refresh(record)
    except InvalidDnsRecord as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
    return DnsRecordRead.model_validate(record)


@router.delete("/dns/zones/{zone_id}/records/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_record(
    zone_id: UUID,
    record_id: UUID,
    db: DBSession,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    access: Annotated[EntitlementService, Depends(get_entitlement_context)],
) -> Response:
    await _require_dns_edit(access)
    zone = await _tenant_zone(db, tenant, zone_id, lock=True)
    record = await _tenant_record(db, tenant, zone_id, record_id, lock=True)
    label = f"{record.record_type} {record.name}"
    await DnsService(db).delete_record(zone, record, actor_id=tenant.user.id)
    db.add(_activity(tenant, action="dns_record_deleted", entity_type="dns_zone", entity_id=zone.id, message=f"Deleted {label}."))
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/dns/zones/{zone_id}/import/preview", response_model=DnsImportPreview)
async def preview_import(
    zone_id: UUID,
    payload: DnsImportInput,
    db: DBSession,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    access: Annotated[EntitlementService, Depends(get_entitlement_context)],
) -> DnsImportPreview:
    await _require_dns_edit(access)
    zone = await _tenant_zone(db, tenant, zone_id)
    try:
        records, warnings, unsupported = await DnsService(db).import_preview(zone, payload.zone_file)
    except InvalidDnsRecord as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
    return DnsImportPreview(records=[DnsRecordInput(**asdict(record)) for record in records], warnings=warnings, unsupported=unsupported)


@router.post("/dns/zones/{zone_id}/import")
async def apply_import(
    zone_id: UUID,
    payload: DnsImportInput,
    db: DBSession,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    access: Annotated[EntitlementService, Depends(get_entitlement_context)],
) -> dict:
    await _require_dns_edit(access)
    zone = await _tenant_zone(db, tenant, zone_id, lock=True)
    try:
        count, warnings, unsupported = await DnsService(db).apply_import(zone, payload.zone_file, actor_id=tenant.user.id)
        db.add(_activity(tenant, action="dns_imported", entity_type="dns_zone", entity_id=zone.id, message=f"Imported {count} DNS records."))
        await db.commit()
    except InvalidDnsRecord as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
    return {"applied": count, "warnings": warnings, "unsupported": unsupported, "sync_status": zone.sync_status}


@router.get("/dns/zones/{zone_id}/export", response_class=Response)
async def export_zone(
    zone_id: UUID,
    db: DBSession,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> Response:
    zone = await _tenant_zone(db, tenant, zone_id)
    content = await DnsService(db).export_zone(zone)
    return Response(content, media_type="text/dns", headers={"Content-Disposition": f'attachment; filename="{zone.zone_name}.zone"'})


@router.post("/dns/zones/{zone_id}/check-delegation", response_model=DnsDelegationRead)
async def check_delegation(
    zone_id: UUID,
    db: DBSession,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> DnsDelegationRead:
    zone = await _tenant_zone(db, tenant, zone_id, lock=True)
    old_status = zone.delegation_status
    state, observed = await DnsService(db).check_delegation(zone)
    if old_status != "active" and state == "active":
        db.add(_activity(tenant, action="nameserver_delegation_verified", entity_type="dns_zone", entity_id=zone.id, message=f"Nameserver delegation verified for {zone.zone_name}."))
    await db.commit()
    return DnsDelegationRead(status=state, expected_nameservers=list(zone.nameservers), observed_nameservers=observed, checked_at=zone.last_delegation_checked_at or utc_now())


@router.post("/dns/zones/{zone_id}/reconcile", response_model=DnsZoneRead)
async def reconcile_zone(
    zone_id: UUID,
    db: DBSession,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    access: Annotated[EntitlementService, Depends(get_entitlement_context)],
) -> DnsZoneRead:
    await _require_dns_edit(access)
    zone = await _tenant_zone(db, tenant, zone_id, lock=True)
    await DnsService(db).reconcile(zone)
    await db.commit()
    return await _zone_read(db, zone, editable=True)


@router.post("/dns/zones/{zone_id}/dnssec/enable", response_model=DnsZoneRead)
async def enable_dnssec(
    zone_id: UUID,
    db: DBSession,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    access: Annotated[EntitlementService, Depends(get_entitlement_context)],
) -> DnsZoneRead:
    await _require_dns_edit(access)
    zone = await _tenant_zone(db, tenant, zone_id, lock=True)
    await DnsService(db).enable_dnssec(zone)
    db.add(_activity(tenant, action="dnssec_enabled", entity_type="dns_zone", entity_id=zone.id, message=f"DNSSEC signing requested for {zone.zone_name}."))
    await db.commit()
    return await _zone_read(db, zone, editable=True)


@router.post("/dns/zones/{zone_id}/dnssec/check", response_model=DnsZoneRead)
async def check_dnssec(
    zone_id: UUID,
    db: DBSession,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    access: Annotated[EntitlementService, Depends(get_entitlement_context)],
) -> DnsZoneRead:
    zone = await _tenant_zone(db, tenant, zone_id, lock=True)
    await DnsService(db).verify_dnssec_ds(zone)
    await db.commit()
    return await _zone_read(db, zone, editable=await access.has_feature("amar_dns"))


@router.post("/dns/zones/{zone_id}/dnssec/disable", response_model=DnsZoneRead)
async def disable_dnssec(
    zone_id: UUID,
    db: DBSession,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    access: Annotated[EntitlementService, Depends(get_entitlement_context)],
) -> DnsZoneRead:
    await _require_dns_edit(access)
    zone = await _tenant_zone(db, tenant, zone_id, lock=True)
    await DnsService(db).disable_dnssec(zone)
    db.add(_activity(tenant, action="dnssec_disabled", entity_type="dns_zone", entity_id=zone.id, message=f"DNSSEC disable requested for {zone.zone_name}."))
    await db.commit()
    return await _zone_read(db, zone, editable=True)


@router.post("/dns/zones/{zone_id}/deactivate", response_model=DnsZoneRead)
async def deactivate_zone(
    zone_id: UUID,
    payload: DnsZoneDeactivate,
    db: DBSession,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> DnsZoneRead:
    zone = await _tenant_zone(db, tenant, zone_id, lock=True)
    if payload.confirmation != zone.zone_name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Type the zone name to confirm migration away")
    await DnsService(db).deactivate(zone)
    db.add(_activity(tenant, action="dns_zone_deactivated", entity_type="dns_zone", entity_id=zone.id, message=f"Migration away from Amar DNS started for {zone.zone_name}; authoritative data is retained."))
    await db.commit()
    return await _zone_read(db, zone, editable=False)


@platform_router.get("/dns/zones", dependencies=[Depends(require_platform_admin)])
async def platform_list_zones(db: DBSession) -> list[dict]:
    zones = list((await db.execute(select(DnsZone).order_by(DnsZone.created_at.desc()).execution_options(include_all_stores=True))).scalars().all())
    return [{"id": item.id, "organization_id": item.organization_id, "store_id": item.store_id, "zone_name": item.zone_name, "status": item.status, "sync_status": item.sync_status, "delegation_status": item.delegation_status, "provider": item.provider} for item in zones]


@platform_router.post("/dns/zones/{zone_id}/reconcile", dependencies=[Depends(require_platform_admin)])
async def platform_reconcile_zone(
    zone_id: UUID,
    payload: PlatformDnsAction,
    db: DBSession,
    actor: Annotated[User, Depends(get_current_user)],
) -> dict:
    zone = await db.scalar(select(DnsZone).where(DnsZone.id == zone_id).execution_options(include_all_stores=True))
    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DNS zone not found")
    with tenant_scope(zone.store_id, zone.organization_id):
        await DnsService(db).reconcile(zone)
        db.add(ActivityLog(organization_id=zone.organization_id, user_id=actor.id, action="dns_zone_reconciled", module="dns", entity_type="dns_zone", entity_id=str(zone.id), message=f"Platform reconciliation: {payload.reason}"))
        await db.commit()
    return {"id": zone.id, "sync_status": zone.sync_status, "provider_error": zone.provider_error}


@platform_router.post("/dns/zones/{zone_id}/disable", dependencies=[Depends(require_platform_admin)])
async def platform_disable_zone(
    zone_id: UUID,
    payload: PlatformDnsAction,
    db: DBSession,
    actor: Annotated[User, Depends(get_current_user)],
) -> dict:
    zone = await db.scalar(select(DnsZone).where(DnsZone.id == zone_id).execution_options(include_all_stores=True))
    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DNS zone not found")
    with tenant_scope(store_id=zone.store_id, organization_id=zone.organization_id):
        if zone.provider_zone_ref:
            await DnsService(db).provider.delete_zone(zone.provider_zone_ref)
            zone.provider_zone_ref = None
        zone.status = "disabled"
        zone.sync_status = "pending"
        zone.provider_error = f"Disabled by platform administrator: {payload.reason}"[:500]
        db.add(ActivityLog(organization_id=zone.organization_id, user_id=actor.id, action="dns_zone_disabled", module="dns", entity_type="dns_zone", entity_id=str(zone.id), message=f"Platform administrator disabled the zone: {payload.reason}"))
        await db.commit()
    return {"id": zone.id, "status": zone.status}
