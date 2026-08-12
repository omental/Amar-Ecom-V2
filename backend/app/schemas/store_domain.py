from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class StoreDomainCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    hostname: str = Field(min_length=1, max_length=253)


class PlatformDomainDisable(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=3, max_length=500)


class DNSInstructionRead(BaseModel):
    purpose: str
    record_type: str
    host: str
    fqdn: str
    value: str


class StoreDomainRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    hostname: str
    domain_type: str
    status: str
    is_primary: bool
    redirect_to_primary: bool
    verification_status: str
    routing_status: str
    ssl_status: str
    verified_at: datetime | None
    verification_token_expires_at: datetime | None = None
    last_verification_attempt_at: datetime | None = None
    last_routing_checked_at: datetime | None = None
    verification_failure_reason: str | None = None
    certificate_expires_at: datetime | None = None
    dns_records: list[DNSInstructionRead] = Field(default_factory=list)
    can_make_primary: bool = False
    can_remove: bool = False
    storefront_url: str


class PublicStoreDomainContextRead(BaseModel):
    store_name: str
    store_slug: str
    hostname: str
    canonical_url: str
    redirect_to_primary: bool
