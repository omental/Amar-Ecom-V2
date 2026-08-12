import asyncio
import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.core.database import AsyncSessionLocal, engine
from app.core.domains import InvalidHostname, normalize_hostname, normalize_request_hostname, platform_hostname
from app.models.tenant import Store, StoreDomain
from app.services.tenant_service import StoreResolver


def test_hostname_normalization_and_platform_generation() -> None:
    assert normalize_hostname("FASHION.AMAR-ECOM.COM.") == "fashion.amar-ecom.com"
    assert normalize_request_hostname("fashion.amar-ecom.com:443") == "fashion.amar-ecom.com"
    assert platform_hostname("fashion-house", "amar-ecom.com") == "fashion-house.amar-ecom.com"
    for invalid in ("https://fashion.amar-ecom.com", "fashion.amar-ecom.com/products", "fashion..amar-ecom.com"):
        with pytest.raises(InvalidHostname):
            normalize_hostname(invalid)


def test_domain_resolver_is_authoritative_and_fails_closed() -> None:
    async def run() -> None:
        async with AsyncSessionLocal() as db:
            domain = await db.scalar(
                select(StoreDomain)
                .join(Store, Store.id == StoreDomain.store_id)
                .where(Store.status == "active", StoreDomain.domain_type == "platform_subdomain")
                .limit(1)
                .execution_options(include_all_stores=True)
            )
            if domain is None:
                pytest.skip("No migrated Store domain is available")
            resolved = await StoreResolver.resolve_by_hostname(db, domain.hostname.upper() + ".")
            assert resolved.store.id == domain.store_id
            assert resolved.domain.id == domain.id
            local = await StoreResolver.resolve_by_hostname(db, f"{resolved.store.slug}.localhost:3000")
            assert local.store.id == resolved.store.id
            for host in ("unknown-" + uuid.uuid4().hex[:8] + ".amar-ecom.com", "amar-ecom.com", "api.amar-ecom.com"):
                with pytest.raises(HTTPException) as error:
                    await StoreResolver.resolve_by_hostname(db, host)
                assert error.value.status_code == 404

    try:
        asyncio.run(run())
    finally:
        asyncio.run(engine.dispose())
