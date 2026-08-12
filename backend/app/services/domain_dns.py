from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Protocol

import dns.asyncresolver
import dns.exception
import dns.resolver

from app.core.config import settings


class DNSLookup(Protocol):
    async def txt(self, hostname: str) -> set[str]: ...
    async def cname(self, hostname: str) -> set[str]: ...
    async def addresses(self, hostname: str, record_type: str) -> set[str]: ...
    async def ns(self, hostname: str) -> set[str]: ...
    async def ds(self, hostname: str) -> set[str]: ...


class SystemDNSLookup:
    """Bounded DNS-only lookups. No merchant-controlled URL is ever fetched."""

    def __init__(self, timeout: float | None = None) -> None:
        self.timeout = timeout or settings.DNS_RESOLVER_TIMEOUT_SECONDS
        self.resolver = dns.asyncresolver.Resolver()
        self.resolver.timeout = self.timeout
        self.resolver.lifetime = self.timeout

    async def _resolve(self, hostname: str, record_type: str):
        try:
            return await self.resolver.resolve(hostname, record_type, lifetime=self.timeout, search=False)
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers, dns.exception.Timeout):
            return ()

    async def txt(self, hostname: str) -> set[str]:
        answers = await self._resolve(hostname, "TXT")
        return {
            b"".join(getattr(answer, "strings", ())).decode("utf-8", "replace")
            for answer in answers
        }

    async def cname(self, hostname: str) -> set[str]:
        answers = await self._resolve(hostname, "CNAME")
        return {str(answer.target).rstrip(".").lower() for answer in answers}

    async def addresses(self, hostname: str, record_type: str) -> set[str]:
        if record_type not in {"A", "AAAA"}:
            raise ValueError("Only A and AAAA lookups are supported")
        answers = await self._resolve(hostname, record_type)
        return {str(answer.address) for answer in answers}

    async def ns(self, hostname: str) -> set[str]:
        answers = await self._resolve(hostname, "NS")
        return {str(answer.target).rstrip(".").lower() for answer in answers}

    async def ds(self, hostname: str) -> set[str]:
        answers = await self._resolve(hostname, "DS")
        return {str(answer).strip() for answer in answers}


@dataclass(slots=True)
class TestDNSLookup:
    """Deterministic DNS adapter for unit/integration tests; never selected in production."""

    txt_records: dict[str, set[str]] = field(default_factory=dict)
    cname_records: dict[str, set[str]] = field(default_factory=dict)
    a_records: dict[str, set[str]] = field(default_factory=dict)
    aaaa_records: dict[str, set[str]] = field(default_factory=dict)
    ns_records: dict[str, set[str]] = field(default_factory=dict)
    ds_records: dict[str, set[str]] = field(default_factory=dict)

    async def txt(self, hostname: str) -> set[str]:
        await asyncio.sleep(0)
        return set(self.txt_records.get(hostname, set()))

    async def cname(self, hostname: str) -> set[str]:
        await asyncio.sleep(0)
        return set(self.cname_records.get(hostname, set()))

    async def addresses(self, hostname: str, record_type: str) -> set[str]:
        await asyncio.sleep(0)
        records = self.a_records if record_type == "A" else self.aaaa_records
        return set(records.get(hostname, set()))

    async def ns(self, hostname: str) -> set[str]:
        await asyncio.sleep(0)
        return set(self.ns_records.get(hostname, set()))

    async def ds(self, hostname: str) -> set[str]:
        await asyncio.sleep(0)
        return set(self.ds_records.get(hostname, set()))
