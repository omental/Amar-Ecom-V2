import asyncio
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine
from app.core.domains import InvalidHostname, normalize_custom_hostname, registrable_domain
from app.core.tenant import tenant_scope
from app.main import app
from app.models.commercial import StorePlanAssignment
from app.models.tenant import Store, StoreDomain
from app.services.certificate_provider import TestCertificateProvider as CertificateTestAdapter
from app.services.domain_dns import TestDNSLookup as DNSTestAdapter
from app.services.domain_verification_service import DomainVerificationService
from app.services.tenant_service import StoreResolver
from tests.test_merchant_onboarding import _cleanup, _find_test_identities, _payload


def test_custom_hostname_uses_public_suffix_and_protects_amar_hosts() -> None:
    assert registrable_domain("shop.example.co.uk") == "example.co.uk"
    assert normalize_custom_hostname("Example.COM.", platform_base_domain="amar-ecom.com") == "example.com"
    for hostname in ("co.uk", "localhost", "127.0.0.1", "amar-ecom.com", "api.amar-ecom.com", "x.amar-ecom.com"):
        with pytest.raises(InvalidHostname):
            normalize_custom_hostname(hostname, platform_base_domain="amar-ecom.com")


def test_custom_domain_entitlement_dns_tls_primary_and_removal() -> None:
    suffix = uuid.uuid4().hex[:10]
    slug = f"domain-{suffix}"
    custom_hostname = f"shop-{suffix}.example.com"
    alias_hostname = f"www.shop-{suffix}.example.com"
    payload = _payload(suffix, email_prefix="domain", slug=slug)
    try:
        with TestClient(app) as client:
            signup = client.post("/api/v1/onboarding/signup", json=payload)
            assert signup.status_code == 201, signup.text
            verified = client.post("/api/v1/onboarding/verify-email", json={"token": signup.json()["verification_token"]})
            headers = {"Authorization": f"Bearer {verified.json()['access_token']}", "X-Amar-Store": slug}

            async def toggle_entitlement(value: bool) -> None:
                async with AsyncSessionLocal() as db:
                    store = await db.scalar(select(Store).where(Store.slug == slug).execution_options(include_all_stores=True))
                    assert store is not None
                    with tenant_scope(store_id=store.id, organization_id=store.organization_id):
                        assignment = await db.scalar(select(StorePlanAssignment).where(StorePlanAssignment.store_id == store.id))
                        assert assignment is not None
                        assignment.entitlement_snapshot = {**assignment.entitlement_snapshot, "custom_domain": value}
                        await db.commit()

            asyncio.run(toggle_entitlement(False))
            asyncio.run(engine.dispose())
            blocked = client.post("/api/v1/admin/storefront/domains", headers=headers, json={"hostname": custom_hostname})
            assert blocked.status_code == 403
            assert blocked.json()["detail"]["feature"] == "custom_domain"
            asyncio.run(toggle_entitlement(True))
            asyncio.run(engine.dispose())

            invalid = client.post("/api/v1/admin/storefront/domains", headers=headers, json={"hostname": "api.amar-ecom.com"})
            assert invalid.status_code == 422
            mass_assignment = client.post("/api/v1/admin/storefront/domains", headers=headers, json={"hostname": custom_hostname, "is_primary": True, "ssl_status": "active"})
            assert mass_assignment.status_code == 422
            created = client.post("/api/v1/admin/storefront/domains", headers=headers, json={"hostname": custom_hostname})
            assert created.status_code == 201, created.text
            custom = created.json()
            assert custom["status"] == "pending"
            assert custom["verification_status"] == "pending"
            txt = next(record for record in custom["dns_records"] if record["record_type"] == "TXT")
            assert txt["fqdn"] == f"_amar-verification.{custom_hostname}"

            duplicate = client.post("/api/v1/admin/storefront/domains", headers=headers, json={"hostname": custom_hostname.upper()})
            assert duplicate.status_code == 409

        asyncio.run(engine.dispose())

        async def verify_lifecycle() -> None:
            async with AsyncSessionLocal() as db:
                store = await db.scalar(select(Store).where(Store.slug == slug).execution_options(include_all_stores=True))
                assert store is not None
                with tenant_scope(store_id=store.id, organization_id=store.organization_id):
                    domain = await db.scalar(select(StoreDomain).where(StoreDomain.hostname == custom_hostname))
                    assert domain is not None
                    instructions = DomainVerificationService(db, dns=DNSTestAdapter(), certificates=CertificateTestAdapter()).instructions(domain)
                    txt_value = next(record.value for record in instructions if record.record_type == "TXT")

                    wrong_dns = DNSTestAdapter(
                        txt_records={f"_amar-verification.{custom_hostname}": {"amar-verification=wrong"}},
                        cname_records={custom_hostname: {settings.CUSTOM_DOMAIN_CNAME_TARGET}},
                    )
                    result = await DomainVerificationService(db, dns=wrong_dns, certificates=CertificateTestAdapter()).verify(domain, bypass_rate_limit=True)
                    assert result.ownership == "failed" and result.routing == "valid" and domain.status == "pending"

                    certificates = CertificateTestAdapter("active")
                    correct_dns = DNSTestAdapter(
                        txt_records={f"_amar-verification.{custom_hostname}": {txt_value}},
                        cname_records={custom_hostname: {settings.CUSTOM_DOMAIN_CNAME_TARGET}},
                    )
                    service = DomainVerificationService(db, dns=correct_dns, certificates=certificates)
                    result = await service.verify(domain, bypass_rate_limit=True)
                    assert result.ownership == "verified" and result.routing == "valid"
                    assert result.ssl == "active" and result.domain_status == "active"
                    await service.verify(domain, bypass_rate_limit=True)
                    assert len(certificates.requests) == 1
                    await db.commit()

                    resolved = await StoreResolver.resolve_by_hostname(db, custom_hostname)
                    assert resolved.store.id == store.id and resolved.domain.id == domain.id

        asyncio.run(verify_lifecycle())
        asyncio.run(engine.dispose())

        with TestClient(app) as client:
            login = client.post("/api/v1/auth/login", json={"email": payload["email"], "password": payload["password"]})
            headers = {"Authorization": f"Bearer {login.json()['access_token']}", "X-Amar-Store": slug}
            domains = client.get("/api/v1/admin/storefront/domains", headers=headers).json()
            custom = next(domain for domain in domains if domain["hostname"] == custom_hostname)
            hosted = next(domain for domain in domains if domain["domain_type"] == "platform_subdomain")
            assert client.post(f"/api/v1/platform/domains/{custom['id']}/disable", headers=headers, json={"reason": "merchant probe"}).status_code == 403
            product_slug = f"custom-host-product-{suffix}"
            product = client.post("/api/v1/products", headers=headers, json={
                "name": "Custom host product",
                "slug": product_slug,
                "sku": f"DOMAIN-{suffix}",
                "price": "25.00",
                "cost_price": "10.00",
                "variants": [],
            })
            assert product.status_code == 201, product.text
            public_product = client.get(f"/api/v1/public/products/slug/{product_slug}", headers={"Host": custom_hostname})
            assert public_product.status_code == 200 and public_product.json()["id"] == product.json()["id"]
            primary = client.post(f"/api/v1/admin/storefront/domains/{custom['id']}/make-primary", headers=headers)
            assert primary.status_code == 200, primary.text
            domains = client.get("/api/v1/admin/storefront/domains", headers=headers).json()
            assert sum(domain["is_primary"] for domain in domains) == 1
            assert next(domain for domain in domains if domain["id"] == hosted["id"])["redirect_to_primary"] is True
            hosted_context = client.get("/api/v1/public/storefront/context", headers={"Host": hosted["hostname"]})
            custom_context = client.get("/api/v1/public/storefront/context", headers={"Host": custom_hostname})
            assert hosted_context.json()["redirect_to_primary"] is True
            assert hosted_context.json()["canonical_url"] == f"https://{custom_hostname}"
            assert custom_context.json()["redirect_to_primary"] is False
            assert client.delete(f"/api/v1/admin/storefront/domains/{custom['id']}", headers=headers).status_code == 409
            assert client.delete(f"/api/v1/admin/storefront/domains/{hosted['id']}", headers=headers).status_code == 409

            alias = client.post("/api/v1/admin/storefront/domains", headers=headers, json={"hostname": alias_hostname})
            assert alias.status_code == 201, alias.text
            assert client.delete(f"/api/v1/admin/storefront/domains/{alias.json()['id']}", headers=headers).status_code == 204
            assert client.post(f"/api/v1/admin/storefront/domains/{hosted['id']}/make-primary", headers=headers).status_code == 200
            assert client.delete(f"/api/v1/admin/storefront/domains/{custom['id']}", headers=headers).status_code == 204
    finally:
        asyncio.run(engine.dispose())
        stores, organizations, users = asyncio.run(_find_test_identities((slug,)))
        if stores:
            asyncio.run(_cleanup(stores, organizations, users))
        asyncio.run(engine.dispose())


def test_private_dns_targets_are_never_accepted() -> None:
    async def run() -> None:
        dns = DNSTestAdapter(a_records={"private.example.com": {"127.0.0.1", "10.0.0.5", "169.254.169.254"}})
        service = DomainVerificationService(None, dns=dns, certificates=CertificateTestAdapter())  # type: ignore[arg-type]
        valid, message = await service._check_routing("private.example.com")
        assert valid is False
        assert message == "Routing resolves to a private or non-public address"

    asyncio.run(run())


def test_certificate_test_adapter_is_idempotent_and_supports_new_retry_attempt() -> None:
    async def run() -> None:
        provider = CertificateTestAdapter("failed")
        first = await provider.request_certificate("example.com", idempotency_key="domain:initial")
        duplicate = await provider.request_certificate("example.com", idempotency_key="domain:initial")
        assert first.status == "failed" and duplicate == first and len(provider.requests) == 1
        provider.outcome = "active"
        retry = await provider.request_certificate("example.com", idempotency_key="domain:retry-1")
        assert retry.status == "active" and len(provider.requests) == 2

    asyncio.run(run())
