from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.domains import InvalidHostname, normalize_hostname, registrable_domain
from app.models.dns import DnsRecord, DnsZone, DnsZoneRevision
from app.models.tenant import Store, StoreDomain
from app.services.dns_provider import AuthoritativeDnsProvider, ProviderRecord, configured_dns_provider, configured_nameservers
from app.services.dns_records import (
    InvalidDnsRecord,
    NormalizedDnsRecord,
    absolute_record_name,
    normalize_record,
    parse_zone_file,
    validate_record_set,
)
from app.services.domain_dns import DNSLookup, SystemDNSLookup


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def default_zone_name(domain: StoreDomain) -> str:
    """Use apex only when the verified hostname itself proves apex control.

    A verified shop.example.com is therefore prepared as a delegatable subzone,
    not as an unproven example.com zone. Apex and www naturally share the apex.
    """
    hostname = normalize_hostname(domain.hostname)
    apex = registrable_domain(hostname)
    return apex if hostname in {apex, f"www.{apex}"} else hostname


class DnsService:
    def __init__(
        self,
        db: AsyncSession,
        *,
        provider: AuthoritativeDnsProvider | None = None,
        lookup: DNSLookup | None = None,
    ) -> None:
        self.db = db
        self.provider = provider or configured_dns_provider()
        self.lookup = lookup or SystemDNSLookup()

    async def create_zone(
        self,
        *,
        store: Store,
        domain: StoreDomain,
        requested_zone_name: str | None = None,
        actor_id: UUID | None = None,
    ) -> DnsZone:
        if domain.store_id != store.id or domain.domain_type != "custom":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found")
        if domain.verification_status != "verified":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Verify domain ownership before enabling Amar DNS")
        expected = default_zone_name(domain)
        zone_name = normalize_hostname(requested_zone_name or expected)
        if zone_name != expected:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=f"This domain may create the authoritative zone {expected}")
        existing = await self.db.scalar(select(DnsZone).where(DnsZone.store_id == store.id, DnsZone.zone_name == zone_name))
        if existing:
            await self._ensure_store_routing(existing, domain)
            await self._snapshot(existing, f"Attached {domain.hostname} Store routing", actor_id)
            await self.reconcile(existing)
            return existing
        zone = DnsZone(
            organization_id=store.organization_id,
            store_id=store.id,
            store_domain_id=domain.id,
            zone_name=zone_name,
            provider=self.provider.key,
            nameservers=list(configured_nameservers()),
            status="preparing",
            sync_status="pending",
        )
        self.db.add(zone)
        await self.db.flush()
        await self._ensure_store_routing(zone, domain)
        await self._snapshot(zone, "Initial Amar DNS zone prepared", actor_id)
        try:
            provisioned = await self.provider.create_zone(
                zone.zone_name,
                nameservers=tuple(zone.nameservers),
                idempotency_key=str(zone.id),
            )
            zone.provider_zone_ref = provisioned.reference
            zone.nameservers = list(provisioned.nameservers)
            zone.soa_serial = provisioned.serial
            zone.status = "pending"
            await self.reconcile(zone)
        except Exception as exc:  # provider failures are persisted and retryable
            zone.status = "error"
            zone.sync_status = "error"
            zone.provider_error = self._safe_provider_error(exc)
        await self.db.flush()
        return zone

    async def reconcile(self, zone: DnsZone) -> DnsZone:
        if not zone.provider_zone_ref:
            try:
                provisioned = await self.provider.create_zone(zone.zone_name, nameservers=tuple(zone.nameservers), idempotency_key=str(zone.id))
                zone.provider_zone_ref = provisioned.reference
            except Exception as exc:
                zone.sync_status = "error"
                zone.provider_error = self._safe_provider_error(exc)
                await self.db.flush()
                return zone
        records = await self._records(zone.id)
        zone.sync_status = "syncing"
        for record in records:
            record.sync_status = "pending"
            record.provider_error = None
        await self.db.flush()
        try:
            provider_records = [self._provider_record(zone, record) for record in records]
            synced = await self.provider.replace_records(zone.provider_zone_ref, provider_records)
            zone.soa_serial = synced.serial
            zone.nameservers = list(synced.nameservers or tuple(zone.nameservers))
            zone.sync_status = "synced"
            zone.provider_error = None
            zone.last_synced_at = utc_now()
            if zone.status not in {"disabled", "deactivating"}:
                zone.status = "active" if zone.delegation_status == "active" else "pending"
            for record in records:
                record.sync_status = "synced"
        except Exception as exc:
            message = self._safe_provider_error(exc)
            zone.sync_status = "error"
            zone.provider_error = message
            for record in records:
                record.sync_status = "error"
                record.provider_error = message
        await self.db.flush()
        return zone

    async def create_record(self, zone: DnsZone, payload, *, actor_id: UUID | None) -> DnsRecord:
        normalized = normalize_record(
            record_type=payload.record_type,
            name=payload.name,
            content=payload.content,
            zone_name=zone.zone_name,
            ttl=payload.ttl,
            priority=payload.priority,
            weight=payload.weight,
            port=payload.port,
        )
        current = await self._records(zone.id)
        self._validate_with_existing(current, normalized)
        record = DnsRecord(zone_id=zone.id, store_id=zone.store_id, managed_by="merchant", **asdict(normalized))
        self.db.add(record)
        await self.db.flush()
        await self._snapshot(zone, f"Created {record.record_type} record {record.name}", actor_id)
        await self.reconcile(zone)
        return record

    async def update_record(self, zone: DnsZone, record: DnsRecord, payload, *, actor_id: UUID | None) -> DnsRecord:
        if record.managed_by != "merchant":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Amar-managed records are read-only")
        values = {
            "record_type": record.record_type,
            "name": record.name,
            "content": payload.content if payload.content is not None else record.content,
            "zone_name": zone.zone_name,
            "ttl": payload.ttl if payload.ttl is not None else record.ttl,
            "priority": payload.priority if payload.priority is not None else record.priority,
            "weight": payload.weight if payload.weight is not None else record.weight,
            "port": payload.port if payload.port is not None else record.port,
        }
        normalized = normalize_record(**values)
        current = [item for item in await self._records(zone.id) if item.id != record.id]
        self._validate_with_existing(current, normalized)
        for key, value in asdict(normalized).items():
            setattr(record, key, value)
        if payload.disabled is not None:
            record.disabled = payload.disabled
        await self._snapshot(zone, f"Updated {record.record_type} record {record.name}", actor_id)
        await self.reconcile(zone)
        return record

    async def delete_record(self, zone: DnsZone, record: DnsRecord, *, actor_id: UUID | None) -> None:
        if record.managed_by != "merchant":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Amar-managed records cannot be deleted")
        label = f"{record.record_type} {record.name}"
        await self.db.delete(record)
        await self.db.flush()
        await self._snapshot(zone, f"Deleted {label}", actor_id)
        await self.reconcile(zone)

    async def import_preview(self, zone: DnsZone, source: str) -> tuple[list[NormalizedDnsRecord], list[str], list[str]]:
        return parse_zone_file(source, zone.zone_name)

    async def apply_import(self, zone: DnsZone, source: str, *, actor_id: UUID | None) -> tuple[int, list[str], list[str]]:
        incoming, warnings, unsupported = parse_zone_file(source, zone.zone_name)
        existing = await self._records(zone.id)
        system = [item for item in existing if item.managed_by == "amar_system"]
        merchant = [item for item in existing if item.managed_by == "merchant"]
        incoming_keys = {(item.name, item.record_type, item.content, item.priority, item.weight, item.port) for item in incoming}
        retained = [item for item in merchant if (item.name, item.record_type, item.content, item.priority, item.weight, item.port) not in incoming_keys]
        combined = [self._normalized(item) for item in system + retained] + incoming
        validate_record_set(combined)
        for item in incoming:
            matching = next((record for record in merchant if (record.name, record.record_type, record.content, record.priority, record.weight, record.port) == (item.name, item.record_type, item.content, item.priority, item.weight, item.port)), None)
            if matching:
                matching.ttl = item.ttl
                matching.disabled = False
            else:
                self.db.add(DnsRecord(zone_id=zone.id, store_id=zone.store_id, managed_by="merchant", **asdict(item)))
        await self.db.flush()
        await self._snapshot(zone, f"Imported {len(incoming)} DNS records", actor_id)
        await self.reconcile(zone)
        return len(incoming), warnings, unsupported

    async def export_zone(self, zone: DnsZone) -> str:
        lines = [f"$ORIGIN {zone.zone_name}.", f"$TTL {settings.DNS_DEFAULT_TTL}"]
        for record in await self._records(zone.id):
            if record.disabled or record.record_type == "ALIAS":
                if record.record_type == "ALIAS":
                    lines.append(f"; Amar managed ALIAS {record.name} -> {record.content}")
                continue
            value = record.content
            if record.record_type in {"CNAME", "MX", "SRV"}:
                value = f"{value.rstrip('.')}."
            if record.record_type == "TXT":
                value = f'"{value.replace(chr(34), chr(92) + chr(34))}"'
            if record.record_type == "MX":
                value = f"{record.priority or 0} {value}"
            elif record.record_type == "SRV":
                value = f"{record.priority or 0} {record.weight or 0} {record.port or 0} {value}"
            lines.append(f"{record.name}\t{record.ttl}\tIN\t{record.record_type}\t{value}")
        return "\n".join(lines) + "\n"

    async def check_delegation(self, zone: DnsZone, *, force: bool = False) -> tuple[str, list[str]]:
        now = utc_now()
        if not force and zone.last_delegation_checked_at and now - zone.last_delegation_checked_at < timedelta(seconds=settings.DNS_DELEGATION_RECHECK_SECONDS):
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Wait before checking nameservers again")
        try:
            observed = sorted({normalize_hostname(value) for value in await self.lookup.ns(zone.zone_name)})
            expected = {normalize_hostname(value) for value in zone.nameservers}
            matching = expected.intersection(observed)
            if expected and expected.issubset(set(observed)):
                state = "active"
                if zone.sync_status == "synced":
                    zone.status = "active"
                    zone.activated_at = zone.activated_at or now
            elif matching:
                state = "partial"
                if zone.status not in {"disabled", "deactivating"}:
                    zone.status = "pending"
            else:
                state = "incorrect"
                if zone.status not in {"disabled", "deactivating"}:
                    zone.status = "pending"
            zone.delegation_status = state
            zone.last_delegation_checked_at = now
            await self.db.flush()
            return state, observed
        except HTTPException:
            raise
        except Exception as exc:
            zone.delegation_status = "error"
            zone.last_delegation_checked_at = now
            zone.provider_error = self._safe_provider_error(exc)
            await self.db.flush()
            return "error", []

    async def enable_dnssec(self, zone: DnsZone) -> DnsZone:
        if not zone.provider_zone_ref:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="DNS provider zone is not ready")
        zone.dnssec_status = "pending"
        try:
            result = await self.provider.enable_dnssec(zone.provider_zone_ref)
            zone.dnssec_status = result.status
            zone.dnssec_ds_records = list(result.ds_records)
        except Exception as exc:
            zone.dnssec_status = "error"
            zone.provider_error = self._safe_provider_error(exc)
        await self.db.flush()
        return zone

    async def verify_dnssec_ds(self, zone: DnsZone) -> DnsZone:
        if zone.dnssec_status not in {"ds_required", "zone_signed"}:
            return zone
        observed = await self.lookup.ds(zone.zone_name)
        expected_digests = {str(item.get("digest", "")).upper() for item in zone.dnssec_ds_records}
        observed_text = {str(item).upper() for item in observed}
        found = {digest for digest in expected_digests if any(digest and digest in item for item in observed_text)}
        zone.dnssec_status = "active" if expected_digests and expected_digests.issubset(found) else "ds_required"
        await self.db.flush()
        return zone

    async def disable_dnssec(self, zone: DnsZone) -> DnsZone:
        if not zone.provider_zone_ref:
            return zone
        try:
            result = await self.provider.disable_dnssec(zone.provider_zone_ref)
            zone.dnssec_status = result.status
            zone.dnssec_ds_records = list(result.ds_records)
        except Exception as exc:
            zone.dnssec_status = "error"
            zone.provider_error = self._safe_provider_error(exc)
        await self.db.flush()
        return zone

    async def deactivate(self, zone: DnsZone) -> DnsZone:
        zone.status = "deactivating"
        zone.deactivated_at = utc_now()
        # Keep the authoritative provider zone serving during migration-away.
        # A platform retention workflow can remove it after delegation changes.
        await self.db.flush()
        return zone

    async def present_certificate_challenge(self, zone: DnsZone, *, name: str, token: str) -> DnsRecord:
        """Idempotently publish an ACME DNS-01 TXT record owned by Amar."""
        normalized = normalize_record(record_type="TXT", name=name, content=token, zone_name=zone.zone_name)
        existing = await self.db.scalar(select(DnsRecord).where(
            DnsRecord.zone_id == zone.id,
            DnsRecord.name == normalized.name,
            DnsRecord.record_type == "TXT",
            DnsRecord.content == normalized.content,
            DnsRecord.managed_by == "amar_system",
            DnsRecord.purpose == "acme_dns01",
        ))
        if existing is None:
            existing = DnsRecord(zone_id=zone.id, store_id=zone.store_id, managed_by="amar_system", purpose="acme_dns01", **asdict(normalized))
            self.db.add(existing)
            await self.db.flush()
            await self._snapshot(zone, f"Presented certificate DNS challenge {normalized.name}", None)
        await self.reconcile(zone)
        return existing

    async def cleanup_certificate_challenge(self, zone: DnsZone, *, name: str) -> None:
        normalized_name = normalize_record(record_type="TXT", name=name, content="challenge-placeholder", zone_name=zone.zone_name).name
        await self.db.execute(delete(DnsRecord).where(
            DnsRecord.zone_id == zone.id,
            DnsRecord.name == normalized_name,
            DnsRecord.managed_by == "amar_system",
            DnsRecord.purpose == "acme_dns01",
        ))
        await self.db.flush()
        await self._snapshot(zone, f"Cleaned certificate DNS challenge {normalized_name}", None)
        await self.reconcile(zone)

    async def health(self, zone: DnsZone, domain: StoreDomain) -> dict:
        records = await self._records(zone.id)
        routing = any(item.managed_by == "amar_system" and item.purpose == "storefront_routing" and item.sync_status == "synced" for item in records)
        return {
            "delegation": zone.delegation_status,
            "store_routing": "healthy" if routing else "error",
            "dnssec": zone.dnssec_status,
            "ssl": domain.ssl_status,
            "mail_records_present": any(item.record_type == "MX" and not item.disabled for item in records),
            "caa_records_present": any(item.record_type == "CAA" and not item.disabled for item in records),
        }

    async def _ensure_store_routing(self, zone: DnsZone, domain: StoreDomain) -> None:
        zone_suffix = f".{zone.zone_name}"
        if domain.hostname == zone.zone_name:
            name, kind = "@", "ALIAS"
        elif domain.hostname.endswith(zone_suffix):
            name, kind = domain.hostname[: -len(zone_suffix)], "CNAME"
        else:
            raise InvalidHostname("Store domain is outside the DNS zone")
        target = normalize_hostname(settings.CUSTOM_DOMAIN_CNAME_TARGET)
        normalized = normalize_record(record_type=kind, name=name, content=target, zone_name=zone.zone_name, allow_system_alias=True)
        existing = await self.db.scalar(select(DnsRecord).where(
            DnsRecord.zone_id == zone.id,
            DnsRecord.name == normalized.name,
            DnsRecord.record_type == normalized.record_type,
            DnsRecord.managed_by == "amar_system",
            DnsRecord.purpose == "storefront_routing",
        ))
        if existing:
            if existing.content != normalized.content:
                existing.content = normalized.content
                existing.sync_status = "pending"
            return
        self.db.add(DnsRecord(
            zone_id=zone.id,
            store_id=zone.store_id,
            managed_by="amar_system",
            purpose="storefront_routing",
            **asdict(normalized),
        ))
        await self.db.flush()

    async def _snapshot(self, zone: DnsZone, reason: str, actor_id: UUID | None) -> None:
        records = await self._records(zone.id)
        previous = int(await self.db.scalar(select(func.max(DnsZoneRevision.revision_number)).where(DnsZoneRevision.zone_id == zone.id)) or 0)
        snapshot = [
            {
                "record_type": item.record_type,
                "name": item.name,
                "content": item.content,
                "ttl": item.ttl,
                "priority": item.priority,
                "weight": item.weight,
                "port": item.port,
                "disabled": item.disabled,
                "managed_by": item.managed_by,
                "purpose": item.purpose,
            }
            for item in records
        ]
        self.db.add(DnsZoneRevision(zone_id=zone.id, store_id=zone.store_id, revision_number=previous + 1, records_snapshot=snapshot, reason=reason[:255], actor_user_id=actor_id))
        await self.db.flush()

    async def _records(self, zone_id: UUID) -> list[DnsRecord]:
        return list((await self.db.execute(select(DnsRecord).where(DnsRecord.zone_id == zone_id).order_by(DnsRecord.name, DnsRecord.record_type, DnsRecord.created_at))).scalars().all())

    def _validate_with_existing(self, existing: list[DnsRecord], incoming: NormalizedDnsRecord) -> None:
        values = [self._normalized(record) for record in existing] + [incoming]
        validate_record_set(values)

    @staticmethod
    def _normalized(record: DnsRecord) -> NormalizedDnsRecord:
        return NormalizedDnsRecord(record.record_type, record.name, record.content, record.ttl, record.priority, record.weight, record.port)

    @staticmethod
    def _provider_record(zone: DnsZone, record: DnsRecord) -> ProviderRecord:
        return ProviderRecord(
            record.record_type,
            absolute_record_name(record.name, zone.zone_name),
            record.content,
            record.ttl,
            record.disabled,
            record.priority,
            record.weight,
            record.port,
        )

    @staticmethod
    def _safe_provider_error(exc: Exception) -> str:
        if settings.APP_ENV not in {"development", "test"}:
            return "Authoritative DNS provider operation failed"
        message = str(exc).strip() or exc.__class__.__name__
        return message[:500]
