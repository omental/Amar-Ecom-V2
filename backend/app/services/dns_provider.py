from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

import httpx

from app.core.config import settings
from app.core.domains import normalize_hostname


@dataclass(frozen=True, slots=True)
class ProviderRecord:
    record_type: str
    name: str
    content: str
    ttl: int
    disabled: bool = False
    priority: int | None = None
    weight: int | None = None
    port: int | None = None


@dataclass(frozen=True, slots=True)
class ProviderZone:
    reference: str
    name: str
    nameservers: tuple[str, ...]
    serial: int = 1


@dataclass(frozen=True, slots=True)
class ProviderDnssec:
    status: str
    ds_records: tuple[dict, ...] = ()


class AuthoritativeDnsProvider(Protocol):
    key: str

    async def create_zone(self, zone_name: str, *, nameservers: tuple[str, ...], idempotency_key: str) -> ProviderZone: ...
    async def get_zone(self, provider_zone_ref: str) -> ProviderZone | None: ...
    async def replace_records(self, provider_zone_ref: str, records: list[ProviderRecord]) -> ProviderZone: ...
    async def delete_zone(self, provider_zone_ref: str) -> None: ...
    async def enable_dnssec(self, provider_zone_ref: str) -> ProviderDnssec: ...
    async def disable_dnssec(self, provider_zone_ref: str) -> ProviderDnssec: ...
    async def get_dnssec_state(self, provider_zone_ref: str) -> ProviderDnssec: ...
    async def health_check(self) -> bool: ...


@dataclass(slots=True)
class TestDnsProvider:
    """In-memory authoritative control-plane backend for deterministic tests only."""

    key: str = "test"
    fail_operations: set[str] = field(default_factory=set)
    zones: dict[str, ProviderZone] = field(default_factory=dict)
    records: dict[str, list[ProviderRecord]] = field(default_factory=dict)
    dnssec: dict[str, ProviderDnssec] = field(default_factory=dict)

    def _fail(self, operation: str) -> None:
        if operation in self.fail_operations:
            raise RuntimeError(f"Test DNS provider {operation} failure")

    async def create_zone(self, zone_name: str, *, nameservers: tuple[str, ...], idempotency_key: str) -> ProviderZone:
        self._fail("create_zone")
        reference = f"test-zone:{idempotency_key}"
        existing = self.zones.get(reference)
        if existing:
            return existing
        zone = ProviderZone(reference, normalize_hostname(zone_name), nameservers, 1)
        self.zones[reference] = zone
        self.records[reference] = []
        self.dnssec[reference] = ProviderDnssec("disabled")
        return zone

    async def get_zone(self, provider_zone_ref: str) -> ProviderZone | None:
        self._fail("get_zone")
        return self.zones.get(provider_zone_ref)

    async def replace_records(self, provider_zone_ref: str, records: list[ProviderRecord]) -> ProviderZone:
        self._fail("replace_records")
        zone = self.zones.get(provider_zone_ref)
        if not zone:
            raise RuntimeError("Authoritative zone not found")
        updated = ProviderZone(zone.reference, zone.name, zone.nameservers, zone.serial + 1)
        self.zones[provider_zone_ref] = updated
        self.records[provider_zone_ref] = list(records)
        return updated

    async def delete_zone(self, provider_zone_ref: str) -> None:
        self._fail("delete_zone")
        self.zones.pop(provider_zone_ref, None)
        self.records.pop(provider_zone_ref, None)
        self.dnssec.pop(provider_zone_ref, None)

    async def enable_dnssec(self, provider_zone_ref: str) -> ProviderDnssec:
        self._fail("enable_dnssec")
        if provider_zone_ref not in self.zones:
            raise RuntimeError("Authoritative zone not found")
        state = ProviderDnssec("ds_required", ({"key_tag": 12345, "algorithm": 13, "digest_type": 2, "digest": "TEST-DIGEST-NOT-FOR-PRODUCTION"},))
        self.dnssec[provider_zone_ref] = state
        return state

    async def disable_dnssec(self, provider_zone_ref: str) -> ProviderDnssec:
        self._fail("disable_dnssec")
        state = ProviderDnssec("disabled")
        self.dnssec[provider_zone_ref] = state
        return state

    async def get_dnssec_state(self, provider_zone_ref: str) -> ProviderDnssec:
        return self.dnssec.get(provider_zone_ref, ProviderDnssec("disabled"))

    async def health_check(self) -> bool:
        self._fail("health_check")
        return True


class PowerDnsProvider:
    """PowerDNS Authoritative HTTP API adapter; query serving remains outside Amar."""

    key = "powerdns"

    def __init__(self, api_url: str, api_key: str, server_id: str) -> None:
        self.api_url = api_url.rstrip("/")
        self.server_id = server_id
        self.headers = {"X-API-Key": api_key, "Accept": "application/json"}

    def _zone_url(self, reference: str = "") -> str:
        suffix = f"/{reference}" if reference else ""
        return f"{self.api_url}/api/v1/servers/{self.server_id}/zones{suffix}"

    async def create_zone(self, zone_name: str, *, nameservers: tuple[str, ...], idempotency_key: str) -> ProviderZone:
        del idempotency_key
        name = f"{normalize_hostname(zone_name)}."
        payload = {"name": name, "kind": "Native", "nameservers": [f"{item}." for item in nameservers]}
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(self._zone_url(), headers=self.headers, json=payload)
            if response.status_code == 409:
                response = await client.get(self._zone_url(name), headers=self.headers)
            response.raise_for_status()
            data = response.json()
        return ProviderZone(data.get("id", name), name.rstrip("."), nameservers, int(data.get("serial") or 1))

    async def get_zone(self, provider_zone_ref: str) -> ProviderZone | None:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(self._zone_url(provider_zone_ref), headers=self.headers)
        if response.status_code == 404:
            return None
        response.raise_for_status()
        data = response.json()
        nameservers = tuple(str(item).rstrip(".") for item in data.get("nameservers", ()))
        return ProviderZone(data.get("id", provider_zone_ref), str(data["name"]).rstrip("."), nameservers, int(data.get("serial") or 1))

    async def replace_records(self, provider_zone_ref: str, records: list[ProviderRecord]) -> ProviderZone:
        grouped: dict[tuple[str, str, int], list[dict]] = {}
        for record in records:
            content = _powerdns_content(record)
            grouped.setdefault((f"{record.name.rstrip('.')}.", record.record_type, record.ttl), []).append({"content": content, "disabled": record.disabled})
        rrsets = [
            {"name": name, "type": record_type, "ttl": ttl, "changetype": "REPLACE", "records": values}
            for (name, record_type, ttl), values in grouped.items()
        ]
        async with httpx.AsyncClient(timeout=8.0) as client:
            current_response = await client.get(self._zone_url(provider_zone_ref), headers=self.headers)
            current_response.raise_for_status()
            desired_keys = {(name, record_type) for name, record_type, _ttl in grouped}
            for rrset in current_response.json().get("rrsets", []):
                key = (str(rrset.get("name", "")), str(rrset.get("type", "")))
                if key[1] not in {"SOA", "NS"} and key not in desired_keys:
                    rrsets.append({"name": key[0], "type": key[1], "changetype": "DELETE"})
            response = await client.patch(self._zone_url(provider_zone_ref), headers=self.headers, json={"rrsets": rrsets})
            response.raise_for_status()
        zone = await self.get_zone(provider_zone_ref)
        if zone is None:
            raise RuntimeError("PowerDNS zone disappeared after record synchronization")
        return zone

    async def delete_zone(self, provider_zone_ref: str) -> None:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.delete(self._zone_url(provider_zone_ref), headers=self.headers)
        if response.status_code not in {204, 404}:
            response.raise_for_status()

    async def enable_dnssec(self, provider_zone_ref: str) -> ProviderDnssec:
        raise RuntimeError("PowerDNS DNSSEC automation requires deployment-specific key policy configuration")

    async def disable_dnssec(self, provider_zone_ref: str) -> ProviderDnssec:
        raise RuntimeError("PowerDNS DNSSEC automation requires deployment-specific key policy configuration")

    async def get_dnssec_state(self, provider_zone_ref: str) -> ProviderDnssec:
        del provider_zone_ref
        return ProviderDnssec("disabled")

    async def health_check(self) -> bool:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{self.api_url}/api/v1/servers/{self.server_id}", headers=self.headers)
        return response.is_success


def _powerdns_content(record: ProviderRecord) -> str:
    if record.record_type == "MX":
        return f"{record.priority or 0} {record.content.rstrip('.')}."
    if record.record_type == "SRV":
        return f"{record.priority or 0} {record.weight or 0} {record.port or 0} {record.content.rstrip('.')}."
    if record.record_type == "TXT":
        return f'"{record.content.replace(chr(34), chr(92) + chr(34))}"'
    if record.record_type in {"CNAME", "ALIAS"}:
        return f"{record.content.rstrip('.')}."
    return record.content


_test_provider = TestDnsProvider()


def configured_dns_provider() -> AuthoritativeDnsProvider:
    provider = settings.DNS_PROVIDER.strip().lower()
    if provider == "test":
        if settings.APP_ENV not in {"development", "test"}:
            raise RuntimeError("The test DNS provider is forbidden outside development/test")
        return _test_provider
    if provider == "powerdns":
        if not settings.DNS_PROVIDER_API_URL or not settings.DNS_PROVIDER_API_KEY:
            raise RuntimeError("PowerDNS requires DNS_PROVIDER_API_URL and DNS_PROVIDER_API_KEY")
        return PowerDnsProvider(settings.DNS_PROVIDER_API_URL, settings.DNS_PROVIDER_API_KEY, settings.DNS_PROVIDER_SERVER_ID)
    raise RuntimeError(f"Unknown authoritative DNS provider: {provider}")


def configured_nameservers() -> tuple[str, ...]:
    values = tuple(dict.fromkeys(normalize_hostname(item.strip()) for item in settings.DNS_NAMESERVERS.split(",") if item.strip()))
    if len(values) < 2:
        raise RuntimeError("DNS_NAMESERVERS must configure at least two authoritative nameservers")
    return values
