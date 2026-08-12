from __future__ import annotations

import hashlib
import hmac
import ipaddress
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.crypto import decrypt_secret, encrypt_secret
from app.core.domains import normalize_hostname, registrable_domain
from app.models.tenant import StoreDomain, StoreDomainCertificate
from app.services.certificate_provider import CertificateProvider, CertificateResult, configured_certificate_provider
from app.services.domain_dns import DNSLookup, SystemDNSLookup


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True, slots=True)
class DNSInstruction:
    purpose: str
    record_type: str
    host: str
    fqdn: str
    value: str


@dataclass(frozen=True, slots=True)
class VerificationResult:
    ownership: str
    routing: str
    ssl: str
    domain_status: str
    message: str | None


def _public_ip(value: str) -> bool:
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        return False
    return bool(address.is_global)


def _configured_targets(raw: str, version: int) -> set[str]:
    targets: set[str] = set()
    for item in raw.split(","):
        value = item.strip()
        if not value:
            continue
        try:
            address = ipaddress.ip_address(value)
        except ValueError as exc:
            raise RuntimeError("Configured custom-domain ingress target is not an IP address") from exc
        if address.version != version or not address.is_global:
            raise RuntimeError("Configured custom-domain ingress targets must be public addresses")
        targets.add(str(address))
    return targets


def build_dns_instructions(domain: StoreDomain) -> list[DNSInstruction]:
    """Build merchant-facing records without initializing DNS/certificate infrastructure."""
    if domain.domain_type != "custom":
        return []
    if not domain.verification_token_encrypted:
        raise ValueError("Custom domain has no verification token")
    token = decrypt_secret(domain.verification_token_encrypted)
    root = registrable_domain(domain.hostname)
    relative = "@" if domain.hostname == root else domain.hostname[: -(len(root) + 1)]
    records = [DNSInstruction(
        "ownership", "TXT", f"_amar-verification.{relative}" if relative != "@" else "_amar-verification",
        f"_amar-verification.{domain.hostname}", f"amar-verification={token}",
    )]
    cname_target = normalize_hostname(settings.CUSTOM_DOMAIN_CNAME_TARGET)
    if domain.hostname != root:
        records.append(DNSInstruction("routing", "CNAME", relative, domain.hostname, cname_target))
        return records
    records.append(DNSInstruction("routing", "ALIAS/ANAME", "@", domain.hostname, cname_target))
    for value in sorted(_configured_targets(settings.CUSTOM_DOMAIN_IPV4_TARGETS, 4)):
        records.append(DNSInstruction("routing", "A", "@", domain.hostname, value))
    for value in sorted(_configured_targets(settings.CUSTOM_DOMAIN_IPV6_TARGETS, 6)):
        records.append(DNSInstruction("routing", "AAAA", "@", domain.hostname, value))
    return records


class DomainVerificationService:
    def __init__(
        self,
        db: AsyncSession,
        *,
        dns: DNSLookup | None = None,
        certificates: CertificateProvider | None = None,
        clock=utc_now,
    ) -> None:
        self.db = db
        self.dns = dns or SystemDNSLookup()
        self.certificates = certificates or configured_certificate_provider()
        self.clock = clock

    def rotate_token(self, domain: StoreDomain) -> str:
        if domain.domain_type != "custom":
            raise ValueError("Platform domains do not require ownership tokens")
        token = secrets.token_urlsafe(32)
        domain.verification_token_hash = hashlib.sha256(token.encode()).hexdigest()
        domain.verification_token_encrypted = encrypt_secret(token)
        domain.verification_token_expires_at = self.clock() + timedelta(hours=settings.DOMAIN_VERIFICATION_TOKEN_HOURS)
        domain.verification_status = "pending"
        domain.verified_at = None
        domain.verification_failure_reason = None
        return token

    def verification_token(self, domain: StoreDomain) -> str:
        if not domain.verification_token_encrypted:
            return self.rotate_token(domain)
        return decrypt_secret(domain.verification_token_encrypted)

    def instructions(self, domain: StoreDomain) -> list[DNSInstruction]:
        if domain.domain_type != "custom":
            return []
        if not domain.verification_token_encrypted:
            self.rotate_token(domain)
        return build_dns_instructions(domain)

    async def verify(self, domain: StoreDomain, *, bypass_rate_limit: bool = False) -> VerificationResult:
        if domain.domain_type != "custom":
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Hosted domains do not require DNS verification")
        now = self.clock()
        if (
            not bypass_rate_limit
            and domain.last_verification_attempt_at
            and (now - domain.last_verification_attempt_at).total_seconds() < settings.DOMAIN_VERIFICATION_RECHECK_SECONDS
        ):
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Wait before checking DNS again")
        if domain.verification_token_expires_at and domain.verification_token_expires_at <= now:
            self.rotate_token(domain)
        token = self.verification_token(domain)
        expected = f"amar-verification={token}"
        domain.last_verification_attempt_at = now
        domain.last_routing_checked_at = now
        domain.verification_status = "verifying"
        await self.db.flush()

        txt_values = await self.dns.txt(f"_amar-verification.{domain.hostname}")
        ownership_valid = any(hmac.compare_digest(value.strip(), expected) for value in txt_values)
        if ownership_valid and domain.verification_token_hash:
            ownership_valid = hmac.compare_digest(
                domain.verification_token_hash,
                hashlib.sha256(token.encode()).hexdigest(),
            )
        routing_valid, routing_message = await self._check_routing(domain.hostname)
        domain.routing_status = "valid" if routing_valid else "invalid"
        domain.verification_status = "verified" if ownership_valid else "failed"
        if ownership_valid:
            domain.verified_at = domain.verified_at or now
        domain.verification_failure_reason = None if ownership_valid and routing_valid else (
            "TXT ownership record was not found" if not ownership_valid else routing_message
        )

        if ownership_valid and routing_valid:
            await self._ensure_certificate(domain)
        elif domain.status != "disabled":
            domain.status = "pending"
        await self.db.flush()
        return VerificationResult(
            domain.verification_status,
            domain.routing_status,
            domain.ssl_status,
            domain.status,
            domain.verification_failure_reason,
        )

    async def _check_routing(self, hostname: str) -> tuple[bool, str | None]:
        cname_target = normalize_hostname(settings.CUSTOM_DOMAIN_CNAME_TARGET)
        cnames = {normalize_hostname(value) for value in await self.dns.cname(hostname)}
        if cname_target in cnames:
            return True, None
        addresses_v4 = await self.dns.addresses(hostname, "A")
        addresses_v6 = await self.dns.addresses(hostname, "AAAA")
        if any(not _public_ip(value) for value in addresses_v4 | addresses_v6):
            return False, "Routing resolves to a private or non-public address"
        expected_v4 = _configured_targets(settings.CUSTOM_DOMAIN_IPV4_TARGETS, 4)
        expected_v6 = _configured_targets(settings.CUSTOM_DOMAIN_IPV6_TARGETS, 6)
        if (expected_v4 and addresses_v4 & expected_v4) or (expected_v6 and addresses_v6 & expected_v6):
            return True, None
        return False, "DNS routing does not point to the configured Amar ingress"

    async def _ensure_certificate(self, domain: StoreDomain, *, retry: bool = False) -> StoreDomainCertificate:
        certificate = await self.db.scalar(select(StoreDomainCertificate).where(StoreDomainCertificate.store_domain_id == domain.id))
        if certificate and certificate.status in {"active", "provisioning"} and not retry:
            if certificate.status == "active":
                domain.ssl_status = "active"
                domain.status = "active"
            else:
                result = await self.certificates.get_status(certificate.provider_certificate_ref, domain.hostname)
                self._apply_certificate_result(domain, certificate, result)
            return certificate
        if certificate is None:
            certificate = StoreDomainCertificate(
                store_id=domain.store_id,
                store_domain_id=domain.id,
                provider=self.certificates.key,
                status="pending",
            )
            self.db.add(certificate)
            await self.db.flush()
        certificate.status = "provisioning"
        certificate.requested_at = self.clock()
        certificate.failure_reason = None
        domain.ssl_status = "provisioning"
        idempotency_key = str(domain.id) if not retry else f"{domain.id}:{certificate.requested_at.isoformat()}"
        result = await self.certificates.request_certificate(domain.hostname, idempotency_key=idempotency_key)
        self._apply_certificate_result(domain, certificate, result)
        return certificate

    def _apply_certificate_result(
        self,
        domain: StoreDomain,
        certificate: StoreDomainCertificate,
        result: CertificateResult,
    ) -> None:
        certificate.provider_certificate_ref = result.provider_ref
        certificate.status = result.status
        certificate.issued_at = result.issued_at
        certificate.expires_at = result.expires_at
        certificate.last_checked_at = self.clock()
        certificate.failure_reason = result.failure_reason
        domain.ssl_status = result.status
        if result.status == "active":
            domain.status = "active"
            domain.verification_failure_reason = None
        elif result.status == "failed":
            domain.status = "error"
            domain.verification_failure_reason = "SSL certificate provisioning failed"
        else:
            domain.status = "pending"

    async def retry_certificate(self, domain: StoreDomain) -> StoreDomainCertificate:
        if domain.verification_status != "verified" or domain.routing_status != "valid":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Verify domain ownership and routing first")
        certificate = await self._ensure_certificate(domain, retry=True)
        await self.db.flush()
        return certificate

    async def revoke(self, domain: StoreDomain) -> None:
        certificate = await self.db.scalar(select(StoreDomainCertificate).where(StoreDomainCertificate.store_domain_id == domain.id))
        if certificate:
            await self.certificates.revoke_certificate(certificate.provider_certificate_ref, domain.hostname)
            certificate.status = "revoked"
            domain.ssl_status = "revoked"
            await self.db.flush()
