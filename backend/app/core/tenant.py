from __future__ import annotations

import uuid
from contextvars import ContextVar, Token
from contextlib import contextmanager
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.tenant import Organization, OrganizationMember, Store, StoreMember
    from app.models.user import User


current_store_id: ContextVar[uuid.UUID | None] = ContextVar("current_store_id", default=None)
current_organization_id: ContextVar[uuid.UUID | None] = ContextVar("current_organization_id", default=None)


@dataclass(frozen=True, slots=True)
class TenantContext:
    organization: Organization
    store: Store
    user: User
    organization_membership: OrganizationMember
    store_membership: StoreMember | None


@dataclass(frozen=True, slots=True)
class TenantTokens:
    store: Token[uuid.UUID | None]
    organization: Token[uuid.UUID | None]


def activate_tenant(*, store_id: uuid.UUID, organization_id: uuid.UUID) -> TenantTokens:
    return TenantTokens(
        store=current_store_id.set(store_id),
        organization=current_organization_id.set(organization_id),
    )


def deactivate_tenant(tokens: TenantTokens) -> None:
    current_store_id.reset(tokens.store)
    current_organization_id.reset(tokens.organization)


@contextmanager
def tenant_scope(*, store_id: uuid.UUID, organization_id: uuid.UUID):
    """Restore explicit tenant identity in workers or non-request service boundaries."""
    tokens = activate_tenant(store_id=store_id, organization_id=organization_id)
    try:
        yield
    finally:
        deactivate_tenant(tokens)
