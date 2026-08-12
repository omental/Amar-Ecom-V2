from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Protocol

from app.core.config import settings


@dataclass(frozen=True, slots=True)
class CertificateResult:
    status: str
    provider_ref: str | None = None
    issued_at: datetime | None = None
    expires_at: datetime | None = None
    failure_reason: str | None = None


class CertificateProvider(Protocol):
    key: str

    async def request_certificate(self, hostname: str, *, idempotency_key: str) -> CertificateResult: ...
    async def get_status(self, provider_ref: str | None, hostname: str) -> CertificateResult: ...
    async def revoke_certificate(self, provider_ref: str | None, hostname: str) -> None: ...


class CertificateDnsChallenge(Protocol):
    """Control-plane hook for future ACME DNS-01 capable adapters.

    Implementations must create an ephemeral system record through the DNS
    service, reconcile it, and clean it after the certificate order completes.
    """

    async def present(self, hostname: str, token: str, *, idempotency_key: str) -> None: ...
    async def cleanup(self, hostname: str, *, idempotency_key: str) -> None: ...


class TestCertificateProvider:
    key = "test"

    def __init__(self, outcome: str = "active") -> None:
        if outcome not in {"active", "failed", "provisioning"}:
            raise ValueError("Unsupported test certificate outcome")
        self.outcome = outcome
        self.requests: dict[str, CertificateResult] = {}

    async def request_certificate(self, hostname: str, *, idempotency_key: str) -> CertificateResult:
        if idempotency_key in self.requests:
            return self.requests[idempotency_key]
        now = datetime.now(timezone.utc)
        if self.outcome == "active":
            result = CertificateResult("active", f"test-cert:{idempotency_key}", now, now + timedelta(days=90))
        elif self.outcome == "failed":
            result = CertificateResult("failed", f"test-cert:{idempotency_key}", failure_reason="Test certificate issuance failed")
        else:
            result = CertificateResult("provisioning", f"test-cert:{idempotency_key}")
        self.requests[idempotency_key] = result
        return result

    async def get_status(self, provider_ref: str | None, hostname: str) -> CertificateResult:
        del hostname
        return next((result for result in self.requests.values() if result.provider_ref == provider_ref), CertificateResult("pending"))

    async def revoke_certificate(self, provider_ref: str | None, hostname: str) -> None:
        del hostname
        for key, result in list(self.requests.items()):
            if result.provider_ref == provider_ref:
                self.requests[key] = CertificateResult("revoked", provider_ref)


class ExternalCertificateProvider:
    """Infrastructure-owned placeholder: records an order without claiming TLS is active."""

    key = "external"

    async def request_certificate(self, hostname: str, *, idempotency_key: str) -> CertificateResult:
        del hostname
        return CertificateResult("provisioning", f"external:{idempotency_key}")

    async def get_status(self, provider_ref: str | None, hostname: str) -> CertificateResult:
        del hostname
        return CertificateResult("provisioning", provider_ref)

    async def revoke_certificate(self, provider_ref: str | None, hostname: str) -> None:
        del provider_ref, hostname


def configured_certificate_provider() -> CertificateProvider:
    provider = settings.CERTIFICATE_PROVIDER.strip().lower()
    if provider == "test":
        if settings.APP_ENV not in {"development", "test"}:
            raise RuntimeError("The test certificate provider is forbidden outside development/test")
        return TestCertificateProvider(settings.CERTIFICATE_TEST_OUTCOME)
    if provider == "external":
        return ExternalCertificateProvider()
    raise RuntimeError(f"Unknown certificate provider: {provider}")
