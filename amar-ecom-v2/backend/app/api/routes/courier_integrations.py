from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409
from app.models.courier_integration import CourierApiLog
from app.models.user import User
from app.schemas.courier_integration import (
    CourierApiLogRead,
    CourierConnectionTestRead,
    CourierProviderSettingRead,
    CourierProviderSettingUpdate,
    CourierSendShipmentRequest,
    CourierSendShipmentResult,
    CourierStatusSyncRequest,
    CourierStatusSyncResult,
)
from app.services.activity_log_service import log_activity
from app.services.courier_service import (
    count_recent_failed_api_logs,
    courier_log_to_read_model_payload,
    get_provider_setting,
    list_provider_settings,
    provider_setting_metadata,
    save_provider_setting,
    send_shipment_to_provider,
    sync_shipment_status,
    test_provider_connection,
)


router = APIRouter(dependencies=[Depends(get_current_user)])


def _ensure_admin(user: User) -> None:
    if user.role not in {"admin", "super_admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


@router.get("/providers", response_model=list[CourierProviderSettingRead])
async def get_providers(
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> list[CourierProviderSettingRead]:
    _ensure_admin(current_user)
    settings = await list_provider_settings(db)
    return [CourierProviderSettingRead(**provider_setting_metadata(setting)) for setting in settings]


@router.get("/providers/{provider}/settings", response_model=CourierProviderSettingRead)
async def get_provider_settings(
    provider: str,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> CourierProviderSettingRead:
    _ensure_admin(current_user)
    setting = await get_provider_setting(db, provider, create_if_missing=True)
    return CourierProviderSettingRead(**provider_setting_metadata(setting))


@router.patch("/providers/{provider}/settings", response_model=CourierProviderSettingRead)
async def update_provider_settings(
    provider: str,
    settings_in: CourierProviderSettingUpdate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> CourierProviderSettingRead:
    _ensure_admin(current_user)
    payload = settings_in.model_dump(exclude_unset=True)
    setting = await save_provider_setting(db, provider, **payload)
    await log_activity(
        db,
        user_id=current_user.id,
        action="courier_provider_settings_updated",
        module="courier_integrations",
        entity_type="courier_provider_setting",
        entity_id=setting.id,
        message=f"Updated courier provider settings for {setting.display_name}.",
        request=request,
    )
    await commit_or_409(db, "Could not update courier provider settings")
    await db.refresh(setting)
    return CourierProviderSettingRead(**provider_setting_metadata(setting))


@router.post("/providers/{provider}/test-connection", response_model=CourierConnectionTestRead)
async def run_provider_connection_test(
    provider: str,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> CourierConnectionTestRead:
    _ensure_admin(current_user)
    result = await test_provider_connection(db, provider, current_user)
    await log_activity(
        db,
        user_id=current_user.id,
        action="courier_connection_tested",
        module="courier_integrations",
        entity_type="courier_provider_setting",
        entity_id=None,
        message=result["message"],
        request=request,
    )
    await commit_or_409(db, "Could not store courier connection test result")
    return CourierConnectionTestRead(**result)


@router.post("/shipments/{shipment_id}/send", response_model=CourierSendShipmentResult)
async def send_shipment(
    shipment_id: UUID,
    send_in: CourierSendShipmentRequest,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> CourierSendShipmentResult:
    result = await send_shipment_to_provider(db, shipment_id, send_in.provider, current_user)
    if result["status"] == "success":
        await log_activity(
            db,
            user_id=current_user.id,
            action="shipment_sent_to_external_courier",
            module="courier_integrations",
            entity_type="shipment",
            entity_id=shipment_id,
            message=result["message"],
            request=request,
        )
    await commit_or_409(db, "Could not complete courier shipment send")
    return CourierSendShipmentResult(**result)


@router.post("/shipments/{shipment_id}/sync-status", response_model=CourierStatusSyncResult)
async def sync_shipment_external_status(
    shipment_id: UUID,
    sync_in: CourierStatusSyncRequest,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> CourierStatusSyncResult:
    result = await sync_shipment_status(db, shipment_id, current_user, provider=sync_in.provider)
    if result["status"] == "success":
        await log_activity(
            db,
            user_id=current_user.id,
            action="shipment_external_status_synced",
            module="courier_integrations",
            entity_type="shipment",
            entity_id=shipment_id,
            message=result["message"],
            request=request,
        )
    await commit_or_409(db, "Could not sync external courier status")
    return CourierStatusSyncResult(**result)


@router.get("/logs", response_model=list[CourierApiLogRead])
async def list_courier_api_logs(
    db: DBSession,
    provider: str | None = Query(default=None),
    action: str | None = Query(default=None),
    status_value: str | None = Query(default=None, alias="status"),
    shipment_id: UUID | None = Query(default=None),
    external_id: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    current_user: User = Depends(get_current_user),
) -> list[CourierApiLogRead]:
    _ensure_admin(current_user)
    stmt = select(CourierApiLog).options(selectinload(CourierApiLog.created_by)).order_by(CourierApiLog.created_at.desc())
    if provider:
        stmt = stmt.where(CourierApiLog.provider == provider)
    if action:
        stmt = stmt.where(CourierApiLog.action == action)
    if status_value:
        stmt = stmt.where(CourierApiLog.status == status_value)
    if shipment_id:
        stmt = stmt.where(CourierApiLog.shipment_id == shipment_id)
    if external_id:
        stmt = stmt.where(CourierApiLog.external_id.ilike(f"%{external_id}%"))
    if date_from:
        stmt = stmt.where(CourierApiLog.created_at >= date_from)
    if date_to:
        stmt = stmt.where(CourierApiLog.created_at <= date_to)
    stmt = stmt.offset(skip).limit(limit)
    logs = (await db.execute(stmt)).scalars().all()
    return [CourierApiLogRead(**courier_log_to_read_model_payload(log)) for log in logs]


async def get_recent_courier_failure_count(db: DBSession) -> int:
    return await count_recent_failed_api_logs(db)
