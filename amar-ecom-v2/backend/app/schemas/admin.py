from datetime import datetime

from pydantic import BaseModel


class SystemHealthServiceStatusRead(BaseModel):
    api: str
    database: str


class MigrationStatusRead(BaseModel):
    current_revision: str | None = None
    head_revision: str | None = None
    up_to_date: bool | None = None


class SystemHealthCountsRead(BaseModel):
    users: int
    products: int
    orders: int
    inventory_items: int
    customers: int
    finance_accounts: int
    tasks: int
    employees: int


class SystemHealthRead(BaseModel):
    service_status: SystemHealthServiceStatusRead
    environment: str
    database_connectivity: bool
    migrations: MigrationStatusRead
    counts: SystemHealthCountsRead
    timestamp: datetime


class BackupGuidanceRead(BaseModel):
    database_name: str | None = None
    pg_dump_command_template: str
    folders_to_back_up: list[str]
    restore_checklist: list[str]
    environment_warning: str
    env_commit_warning: str


class MaintenanceChecklistItemRead(BaseModel):
    key: str
    label: str
    status: str
    value: str
    recommended_action: str
    route: str | None = None


class MaintenanceChecklistRead(BaseModel):
    items: list[MaintenanceChecklistItemRead]
    timestamp: datetime
