from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DnsZoneCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    zone_name: str | None = Field(default=None, max_length=253)


class DnsRecordInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    record_type: str = Field(min_length=1, max_length=10)
    name: str = Field(min_length=1, max_length=253)
    content: str = Field(min_length=1, max_length=4096)
    ttl: int | None = None
    priority: int | None = None
    weight: int | None = None
    port: int | None = None


class DnsRecordUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str | None = Field(default=None, min_length=1, max_length=4096)
    ttl: int | None = None
    priority: int | None = None
    weight: int | None = None
    port: int | None = None
    disabled: bool | None = None


class DnsRecordRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    record_type: str
    name: str
    content: str
    ttl: int
    priority: int | None
    weight: int | None
    port: int | None
    disabled: bool
    managed_by: str
    purpose: str | None
    sync_status: str
    provider_error: str | None
    created_at: datetime
    updated_at: datetime


class DnsZoneRevisionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    revision_number: int
    reason: str
    actor_user_id: UUID | None
    created_at: datetime


class DnsHealthRead(BaseModel):
    delegation: str
    store_routing: str
    dnssec: str
    ssl: str
    mail_records_present: bool
    caa_records_present: bool


class DnsZoneRead(BaseModel):
    id: UUID
    store_domain_id: UUID
    zone_name: str
    status: str
    provider: str
    nameservers: list[str]
    soa_serial: int
    delegation_status: str
    dnssec_status: str
    dnssec_ds_records: list[dict]
    sync_status: str
    provider_error: str | None
    last_synced_at: datetime | None
    last_delegation_checked_at: datetime | None
    activated_at: datetime | None
    records: list[DnsRecordRead]
    revisions: list[DnsZoneRevisionRead]
    health: DnsHealthRead
    editable: bool


class DnsImportInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    zone_file: str = Field(min_length=1, max_length=500_000)


class DnsImportPreview(BaseModel):
    records: list[DnsRecordInput]
    warnings: list[str]
    unsupported: list[str]


class DnsDelegationRead(BaseModel):
    status: str
    expected_nameservers: list[str]
    observed_nameservers: list[str]
    checked_at: datetime


class DnsZoneDeactivate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    confirmation: str


class PlatformDnsAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=3, max_length=500)
