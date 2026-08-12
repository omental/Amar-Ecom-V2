import asyncio
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import AsyncSessionLocal, engine
from app.core.tenant import tenant_scope
from app.main import app
from app.models.commercial import StorePlanAssignment
from app.models.dns import DnsRecord, DnsZone
from app.models.tenant import Store, StoreDomain
from app.services.dns_provider import TestDnsProvider as DnsTestProvider, configured_dns_provider
from app.services.dns_records import InvalidDnsRecord, normalize_record, parse_zone_file, validate_record_set
from app.services.dns_service import DnsService
from app.services.domain_dns import TestDNSLookup as LookupTestAdapter
from tests.test_merchant_onboarding import _cleanup, _find_test_identities, _payload


def test_dns_record_validation_and_safe_zone_import() -> None:
    records = [
        normalize_record(record_type="A", name="@", content="203.0.113.10", zone_name="example.com"),
        normalize_record(record_type="AAAA", name="www", content="2001:db8::1", zone_name="example.com"),
        normalize_record(record_type="TXT", name="_dmarc", content="v=DMARC1; p=none", zone_name="example.com"),
        normalize_record(record_type="MX", name="@", content="mail.example.com", priority=10, zone_name="example.com"),
        normalize_record(record_type="CAA", name="@", content='0 issue "letsencrypt.org"', zone_name="example.com"),
    ]
    validate_record_set(records)
    with pytest.raises(InvalidDnsRecord, match="apex"):
        normalize_record(record_type="CNAME", name="@", content="target.example.com", zone_name="example.com")
    with pytest.raises(InvalidDnsRecord, match="CNAME and other"):
        validate_record_set([
            normalize_record(record_type="CNAME", name="www", content="target.example.com", zone_name="example.com"),
            normalize_record(record_type="TXT", name="www", content="conflict", zone_name="example.com"),
        ])
    parsed, warnings, unsupported = parse_zone_file(
        "$ORIGIN example.com.\n$TTL 3600\n@ IN MX 10 mail.example.com.\n_dmarc IN TXT \"v=DMARC1; p=none\"\nwww IN CNAME shop.example.com.\n",
        "example.com",
    )
    assert len(parsed) == 3 and warnings == [] and unsupported == []
    with pytest.raises(InvalidDnsRecord, match="directive"):
        parse_zone_file("$INCLUDE /etc/passwd", "example.com")


def test_amar_dns_zone_records_delegation_sync_and_tenant_isolation() -> None:
    suffix = uuid.uuid4().hex[:10]
    slug_a = f"dns-a-{suffix}"
    slug_b = f"dns-b-{suffix}"
    hostname = f"dns-{suffix}.example.com"
    payload_a = _payload(suffix, email_prefix="dns-a", slug=slug_a)
    payload_b = _payload(suffix, email_prefix="dns-b", slug=slug_b)
    try:
        with TestClient(app) as client:
            signup_a = client.post("/api/v1/onboarding/signup", json=payload_a)
            signup_b = client.post("/api/v1/onboarding/signup", json=payload_b)
            assert signup_a.status_code == signup_b.status_code == 201
            verified_a = client.post("/api/v1/onboarding/verify-email", json={"token": signup_a.json()["verification_token"]}).json()
            verified_b = client.post("/api/v1/onboarding/verify-email", json={"token": signup_b.json()["verification_token"]}).json()
            headers_a = {"Authorization": f"Bearer {verified_a['access_token']}", "X-Amar-Store": slug_a}
            headers_b = {"Authorization": f"Bearer {verified_b['access_token']}", "X-Amar-Store": slug_b}

            async def enable_and_verify() -> None:
                async with AsyncSessionLocal() as db:
                    store = await db.scalar(select(Store).where(Store.slug == slug_a).execution_options(include_all_stores=True))
                    assert store is not None
                    with tenant_scope(store_id=store.id, organization_id=store.organization_id):
                        assignment = await db.scalar(select(StorePlanAssignment).where(StorePlanAssignment.store_id == store.id))
                        assert assignment is not None
                        assignment.entitlement_snapshot = {**assignment.entitlement_snapshot, "custom_domain": True, "amar_dns": True}
                        await db.commit()

            asyncio.run(enable_and_verify())
            asyncio.run(engine.dispose())
            domain_response = client.post("/api/v1/admin/storefront/domains", headers=headers_a, json={"hostname": hostname})
            assert domain_response.status_code == 201, domain_response.text
            domain_id = domain_response.json()["id"]

            async def mark_verified() -> None:
                async with AsyncSessionLocal() as db:
                    store = await db.scalar(select(Store).where(Store.slug == slug_a).execution_options(include_all_stores=True))
                    assert store is not None
                    with tenant_scope(store_id=store.id, organization_id=store.organization_id):
                        domain = await db.scalar(select(StoreDomain).where(StoreDomain.id == uuid.UUID(domain_id)))
                        assert domain is not None
                        domain.verification_status = "verified"
                        domain.routing_status = "valid"
                        domain.ssl_status = "active"
                        domain.status = "active"
                        await db.commit()

            asyncio.run(mark_verified())
            asyncio.run(engine.dispose())
            created = client.post(
                f"/api/v1/admin/storefront/domains/{domain_id}/dns",
                headers=headers_a,
                json={},
            )
            assert created.status_code == 201, created.text
            zone = created.json()
            assert zone["zone_name"] == hostname
            assert len(zone["nameservers"]) >= 2
            assert zone["sync_status"] == "synced"
            system = next(record for record in zone["records"] if record["managed_by"] == "amar_system")
            assert system["record_type"] == "ALIAS" and system["name"] == "@"
            zone_id = zone["id"]

            assert client.get(f"/api/v1/admin/storefront/dns/zones/{zone_id}", headers=headers_b).status_code == 404
            assert client.delete(f"/api/v1/admin/storefront/dns/zones/{zone_id}/records/{system['id']}", headers=headers_a).status_code == 409

            payloads = [
                {"record_type": "A", "name": "api", "content": "203.0.113.12", "ttl": 3600},
                {"record_type": "AAAA", "name": "ipv6", "content": "2001:db8::12", "ttl": 3600},
                {"record_type": "TXT", "name": "_dmarc", "content": "v=DMARC1; p=none", "ttl": 3600},
                {"record_type": "MX", "name": "@", "content": "mail.example.com", "ttl": 3600, "priority": 10},
                {"record_type": "CAA", "name": "@", "content": '0 issue "letsencrypt.org"', "ttl": 3600},
                {"record_type": "CNAME", "name": "blog", "content": "pages.example.net", "ttl": 3600},
            ]
            for payload in payloads:
                response = client.post(f"/api/v1/admin/storefront/dns/zones/{zone_id}/records", headers=headers_a, json=payload)
                assert response.status_code == 201, response.text
            conflict = client.post(f"/api/v1/admin/storefront/dns/zones/{zone_id}/records", headers=headers_a, json={"record_type": "TXT", "name": "blog", "content": "conflict", "ttl": 3600})
            assert conflict.status_code == 422

            preview = client.post(f"/api/v1/admin/storefront/dns/zones/{zone_id}/import/preview", headers=headers_a, json={"zone_file": f"$ORIGIN {hostname}.\nmail 3600 IN A 203.0.113.20\n"})
            assert preview.status_code == 200 and len(preview.json()["records"]) == 1
            malicious = client.post(f"/api/v1/admin/storefront/dns/zones/{zone_id}/import/preview", headers=headers_a, json={"zone_file": "$INCLUDE /etc/passwd"})
            assert malicious.status_code == 422
            exported = client.get(f"/api/v1/admin/storefront/dns/zones/{zone_id}/export", headers=headers_a)
            assert exported.status_code == 200 and "MX" in exported.text and "$ORIGIN" in exported.text

        asyncio.run(engine.dispose())

        async def verify_service_states() -> None:
            async with AsyncSessionLocal() as db:
                store = await db.scalar(select(Store).where(Store.slug == slug_a).execution_options(include_all_stores=True))
                assert store is not None
                with tenant_scope(store_id=store.id, organization_id=store.organization_id):
                    zone = await db.scalar(select(DnsZone).where(DnsZone.zone_name == hostname))
                    assert zone is not None
                    partial = LookupTestAdapter(ns_records={hostname: {zone.nameservers[0]}})
                    state, observed = await DnsService(db, lookup=partial).check_delegation(zone, force=True)
                    assert state == "partial" and observed == [zone.nameservers[0]]
                    active = LookupTestAdapter(ns_records={hostname: set(zone.nameservers)})
                    state, _ = await DnsService(db, lookup=active).check_delegation(zone, force=True)
                    assert state == "active" and zone.status == "active"

                    provider = configured_dns_provider()
                    assert isinstance(provider, DnsTestProvider)
                    failure_service = DnsService(db, provider=provider)
                    provider.fail_operations.add("replace_records")
                    await failure_service.reconcile(zone)
                    assert zone.sync_status == "error"
                    provider.fail_operations.clear()
                    await failure_service.reconcile(zone)
                    assert zone.sync_status == "synced"
                    await db.commit()

        asyncio.run(verify_service_states())
    finally:
        asyncio.run(engine.dispose())
        stores, organizations, users = asyncio.run(_find_test_identities((slug_a, slug_b)))
        if stores:
            asyncio.run(_cleanup(stores, organizations, users))
        asyncio.run(engine.dispose())
