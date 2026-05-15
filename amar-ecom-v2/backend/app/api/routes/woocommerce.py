import json
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409
from app.core.crypto import (
    decrypt_secret,
    is_dedicated_secret_key_configured,
    is_encrypted_secret,
    mask_secret,
)
from app.models.user import User
from app.models.woocommerce import WooCommerceSetting, WooCommerceSyncLog
from app.schemas.woocommerce import (
    WooCommerceBulkOrderRefreshRequest,
    WooCommerceConnectionTestRead,
    WooCommerceImportRequest,
    WooCommerceImportResult,
    WooCommerceOrderPreviewListRead,
    WooCommerceOrderRefreshResult,
    WooCommerceOrderRefreshRequest,
    WooCommerceProductPreviewListRead,
    WooCommerceRunSyncRequest,
    WooCommerceRunSyncResult,
    WooCommerceSettingRead,
    WooCommerceSettingUpdate,
    WooCommerceSyncLogRead,
    WooCommerceSyncStatusRead,
)
from app.services.activity_log_service import log_activity
from app.services.woocommerce_service import (
    fetch_orders_preview,
    fetch_products_preview,
    get_sync_status_summary,
    import_orders,
    import_products,
    refresh_imported_order_from_woocommerce,
    refresh_imported_orders_since_last_sync,
    run_manual_sync,
    test_connection,
)


router = APIRouter(dependencies=[Depends(get_current_user)])


def _ensure_admin(user: User) -> None:
    if user.role not in {"admin", "super_admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


async def _get_or_create_settings(db: DBSession) -> WooCommerceSetting:
    result = await db.execute(select(WooCommerceSetting).order_by(WooCommerceSetting.created_at.asc()).limit(1))
    settings = result.scalar_one_or_none()
    if settings is None:
        settings = WooCommerceSetting()
        db.add(settings)
        await db.flush()
    return settings


def _parse_payload_snapshot(payload_snapshot: str | None):
    if not payload_snapshot:
        return None
    try:
        return json.loads(payload_snapshot)
    except json.JSONDecodeError:
        return payload_snapshot


def _sync_log_to_read(log: WooCommerceSyncLog) -> WooCommerceSyncLogRead:
    return WooCommerceSyncLogRead(
        id=log.id,
        sync_type=log.sync_type,
        direction=log.direction,
        status=log.status,
        external_id=log.external_id,
        local_entity_type=log.local_entity_type,
        local_entity_id=log.local_entity_id,
        message=log.message,
        payload_snapshot=_parse_payload_snapshot(log.payload_snapshot),
        created_by_id=log.created_by_id,
        started_at=log.started_at,
        finished_at=log.finished_at,
        created_at=log.created_at,
        created_by=log.created_by,
    )


def _settings_to_read(settings: WooCommerceSetting) -> WooCommerceSettingRead:
    decrypted_key = None
    credentials_encrypted = True

    if settings.consumer_key_encrypted:
        try:
            decrypted_key = decrypt_secret(settings.consumer_key_encrypted)
            credentials_encrypted = is_encrypted_secret(settings.consumer_key_encrypted)
        except ValueError:
            decrypted_key = None
            credentials_encrypted = False

    if settings.consumer_secret_encrypted and not is_encrypted_secret(settings.consumer_secret_encrypted):
        credentials_encrypted = False

    encryption_warning = None
    if not is_dedicated_secret_key_configured():
        encryption_warning = "Set FERNET_SECRET_KEY or APP_SECRET_KEY for a dedicated WooCommerce credential encryption key."
    if not credentials_encrypted and (settings.consumer_key_encrypted or settings.consumer_secret_encrypted):
        encryption_warning = "Stored WooCommerce credentials include legacy plaintext values. Save settings again to re-encrypt them."

    return WooCommerceSettingRead(
        id=settings.id,
        store_url=settings.store_url,
        api_version=settings.api_version,
        is_active=settings.is_active,
        has_consumer_key=bool(settings.consumer_key_encrypted),
        has_consumer_secret=bool(settings.consumer_secret_encrypted),
        consumer_key_masked=mask_secret(decrypted_key) if decrypted_key else None,
        credentials_encrypted=credentials_encrypted,
        encryption_key_configured=is_dedicated_secret_key_configured(),
        encryption_warning=encryption_warning,
        last_tested_at=settings.last_tested_at,
        last_test_success=settings.last_test_success,
        last_test_message=settings.last_test_message,
        auto_sync_enabled=settings.auto_sync_enabled,
        sync_products_enabled=settings.sync_products_enabled,
        sync_orders_enabled=settings.sync_orders_enabled,
        sync_interval_minutes=settings.sync_interval_minutes,
        last_product_sync_at=settings.last_product_sync_at,
        last_order_sync_at=settings.last_order_sync_at,
        last_sync_started_at=settings.last_sync_started_at,
        last_sync_finished_at=settings.last_sync_finished_at,
        last_sync_status=settings.last_sync_status,
        last_sync_message=settings.last_sync_message,
        created_at=settings.created_at,
        updated_at=settings.updated_at,
    )


@router.get("/settings", response_model=WooCommerceSettingRead)
async def get_settings(db: DBSession, current_user: User = Depends(get_current_user)) -> WooCommerceSettingRead:
    _ensure_admin(current_user)
    settings = await _get_or_create_settings(db)
    return _settings_to_read(settings)


@router.patch("/settings", response_model=WooCommerceSettingRead)
async def update_settings(
    settings_in: WooCommerceSettingUpdate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> WooCommerceSettingRead:
    _ensure_admin(current_user)
    settings = await _get_or_create_settings(db)
    payload = settings_in.model_dump(exclude_unset=True)
    credentials_updated = False

    if "store_url" in payload:
        settings.store_url = payload["store_url"]
    if "consumer_key" in payload and payload["consumer_key"] is not None:
        from app.core.crypto import encrypt_secret

        settings.consumer_key_encrypted = encrypt_secret(payload["consumer_key"])
        credentials_updated = True
    if "consumer_secret" in payload and payload["consumer_secret"] is not None:
        from app.core.crypto import encrypt_secret

        settings.consumer_secret_encrypted = encrypt_secret(payload["consumer_secret"])
        credentials_updated = True
    if "api_version" in payload and payload["api_version"] is not None:
        settings.api_version = payload["api_version"]
    if "is_active" in payload and payload["is_active"] is not None:
        settings.is_active = payload["is_active"]
    sync_settings_updated = False
    if "auto_sync_enabled" in payload and payload["auto_sync_enabled"] is not None:
        settings.auto_sync_enabled = payload["auto_sync_enabled"]
        sync_settings_updated = True
    if "sync_products_enabled" in payload and payload["sync_products_enabled"] is not None:
        settings.sync_products_enabled = payload["sync_products_enabled"]
        sync_settings_updated = True
    if "sync_orders_enabled" in payload and payload["sync_orders_enabled"] is not None:
        settings.sync_orders_enabled = payload["sync_orders_enabled"]
        sync_settings_updated = True
    if "sync_interval_minutes" in payload and payload["sync_interval_minutes"] is not None:
        settings.sync_interval_minutes = payload["sync_interval_minutes"]
        sync_settings_updated = True

    await log_activity(
        db,
        user_id=current_user.id,
        action="woocommerce_settings_updated",
        module="woocommerce",
        entity_type="woocommerce_setting",
        entity_id=settings.id,
        message="Updated WooCommerce connection settings.",
        request=request,
    )
    if credentials_updated:
        await log_activity(
            db,
            user_id=current_user.id,
            action="woocommerce_credentials_updated",
            module="woocommerce",
            entity_type="woocommerce_setting",
            entity_id=settings.id,
            message="Updated WooCommerce credentials.",
            request=request,
        )
    if sync_settings_updated:
        await log_activity(
            db,
            user_id=current_user.id,
            action="woocommerce_sync_settings_updated",
            module="woocommerce",
            entity_type="woocommerce_setting",
            entity_id=settings.id,
            message="Updated WooCommerce sync schedule settings.",
            request=request,
        )
    await commit_or_409(db, "Could not update WooCommerce settings")
    await db.refresh(settings)
    return _settings_to_read(settings)


@router.post("/test-connection", response_model=WooCommerceConnectionTestRead)
async def run_test_connection(
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> WooCommerceConnectionTestRead:
    _ensure_admin(current_user)
    result = await test_connection(db, current_user)
    await log_activity(
        db,
        user_id=current_user.id,
        action="woocommerce_connection_tested",
        module="woocommerce",
        entity_type="woocommerce_setting",
        entity_id=None,
        message=result["message"],
        request=request,
    )
    await commit_or_409(db, "Could not store WooCommerce connection test result")
    return WooCommerceConnectionTestRead(**result)


@router.get("/products-preview", response_model=WooCommerceProductPreviewListRead)
async def get_products_preview(
    db: DBSession,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None),
    modified_after: datetime | None = Query(default=None),
    current_user: User = Depends(get_current_user),
) -> WooCommerceProductPreviewListRead:
    _ensure_admin(current_user)
    preview = await fetch_products_preview(
        db,
        page=page,
        per_page=per_page,
        search=search,
        modified_after=modified_after,
        current_user=current_user,
    )
    await commit_or_409(db, "Could not store WooCommerce product preview log")
    return WooCommerceProductPreviewListRead(**preview)


@router.post("/products-import", response_model=WooCommerceImportResult)
async def import_selected_products(
    import_in: WooCommerceImportRequest,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> WooCommerceImportResult:
    _ensure_admin(current_user)
    result = await import_products(db, import_in.external_ids, current_user)
    await log_activity(
        db,
        user_id=current_user.id,
        action="woocommerce_products_imported",
        module="woocommerce",
        entity_type="product",
        entity_id=None,
        message=f"Imported {result['imported_count']} WooCommerce products, skipped {result['skipped_count']}, failed {result['failed_count']}.",
        request=request,
    )
    await log_activity(
        db,
        user_id=current_user.id,
        action="woocommerce_import_completed",
        module="woocommerce",
        entity_type="product",
        entity_id=None,
        message=f"Completed WooCommerce product import: {result['imported_count']} imported, {result['skipped_count']} skipped, {result['failed_count']} failed.",
        request=request,
    )
    await commit_or_409(db, "Could not complete WooCommerce product import")
    return WooCommerceImportResult(**result)


@router.get("/orders-preview", response_model=WooCommerceOrderPreviewListRead)
async def get_orders_preview(
    db: DBSession,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    status: str | None = Query(default=None),
    after: datetime | None = Query(default=None),
    current_user: User = Depends(get_current_user),
) -> WooCommerceOrderPreviewListRead:
    _ensure_admin(current_user)
    preview = await fetch_orders_preview(
        db,
        page=page,
        per_page=per_page,
        status_value=status,
        after=after,
        current_user=current_user,
    )
    await commit_or_409(db, "Could not store WooCommerce order preview log")
    return WooCommerceOrderPreviewListRead(**preview)


@router.post("/orders-import", response_model=WooCommerceImportResult)
async def import_selected_orders(
    import_in: WooCommerceImportRequest,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> WooCommerceImportResult:
    _ensure_admin(current_user)
    result = await import_orders(db, import_in.external_ids, current_user)
    await log_activity(
        db,
        user_id=current_user.id,
        action="woocommerce_orders_imported",
        module="woocommerce",
        entity_type="order",
        entity_id=None,
        message=f"Imported {result['imported_count']} WooCommerce orders, skipped {result['skipped_count']}, failed {result['failed_count']}.",
        request=request,
    )
    await log_activity(
        db,
        user_id=current_user.id,
        action="woocommerce_import_completed",
        module="woocommerce",
        entity_type="order",
        entity_id=None,
        message=f"Completed WooCommerce order import: {result['imported_count']} imported, {result['skipped_count']} skipped, {result['failed_count']} failed.",
        request=request,
    )
    await commit_or_409(db, "Could not complete WooCommerce order import")
    return WooCommerceImportResult(**result)


@router.post("/orders/{local_order_id}/refresh", response_model=WooCommerceOrderRefreshResult)
async def refresh_single_imported_order(
    local_order_id: UUID,
    refresh_in: WooCommerceOrderRefreshRequest,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> WooCommerceOrderRefreshResult:
    _ensure_admin(current_user)
    result = await refresh_imported_order_from_woocommerce(db, local_order_id, current_user)
    row = result["rows"][0] if result["rows"] else None
    await log_activity(
        db,
        user_id=current_user.id,
        action="woocommerce_order_refreshed",
        module="woocommerce",
        entity_type="order",
        entity_id=row["local_order_id"] if row else None,
        message=row["message"] if row else "Refreshed WooCommerce order.",
        request=request,
    )
    await commit_or_409(db, "Could not refresh WooCommerce order")
    return WooCommerceOrderRefreshResult(**result)


@router.post("/orders-refresh", response_model=WooCommerceOrderRefreshResult)
async def refresh_orders_bulk(
    refresh_in: WooCommerceBulkOrderRefreshRequest,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> WooCommerceOrderRefreshResult:
    _ensure_admin(current_user)
    result = await refresh_imported_orders_since_last_sync(
        db,
        current_user,
        per_page=refresh_in.per_page,
        since_last_sync=refresh_in.since_last_sync,
        status_value=refresh_in.status,
    )
    await log_activity(
        db,
        user_id=current_user.id,
        action="woocommerce_orders_bulk_refreshed",
        module="woocommerce",
        entity_type="order",
        entity_id=None,
        message=(
            f"WooCommerce bulk order refresh: {result['refreshed_count']} refreshed, "
            f"{result['imported_count']} imported, {result['skipped_count']} skipped, {result['failed_count']} failed."
        ),
        request=request,
    )
    await commit_or_409(db, "Could not complete WooCommerce bulk order refresh")
    return WooCommerceOrderRefreshResult(**result)


@router.post("/run-sync", response_model=WooCommerceRunSyncResult)
async def trigger_manual_sync(
    sync_in: WooCommerceRunSyncRequest,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> WooCommerceRunSyncResult:
    _ensure_admin(current_user)
    await log_activity(
        db,
        user_id=current_user.id,
        action="woocommerce_manual_sync_started",
        module="woocommerce",
        entity_type="woocommerce_setting",
        entity_id=None,
        message="Started WooCommerce manual sync.",
        request=request,
    )
    try:
        result = await run_manual_sync(
            db,
            current_user,
            sync_products=sync_in.sync_products,
            sync_orders=sync_in.sync_orders,
            since_last_sync=sync_in.since_last_sync,
            per_page=sync_in.per_page,
        )
    except HTTPException as exc:
        await log_activity(
            db,
            user_id=current_user.id,
            action="woocommerce_manual_sync_failed",
            module="woocommerce",
            entity_type="woocommerce_setting",
            entity_id=None,
            message=str(exc.detail),
            request=request,
        )
        await commit_or_409(db, "Could not store WooCommerce manual sync failure")
        raise

    await log_activity(
        db,
        user_id=current_user.id,
        action="woocommerce_manual_sync_completed",
        module="woocommerce",
        entity_type="woocommerce_setting",
        entity_id=None,
        message=result["message"],
        request=request,
    )
    await commit_or_409(db, "Could not complete WooCommerce manual sync")
    return WooCommerceRunSyncResult(**result)


@router.get("/sync-status", response_model=WooCommerceSyncStatusRead)
async def get_sync_status(
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> WooCommerceSyncStatusRead:
    _ensure_admin(current_user)
    summary = await get_sync_status_summary(db)
    return WooCommerceSyncStatusRead(
        settings=_settings_to_read(summary["settings"]),
        recent_sync_logs=[_sync_log_to_read(log) for log in summary["recent_sync_logs"]],
        failed_sync_count=summary["failed_sync_count"],
        recent_order_refresh_failures_count=summary["recent_order_refresh_failures_count"],
        imported_woocommerce_orders_count=summary["imported_woocommerce_orders_count"],
        last_order_refresh_at=summary["last_order_refresh_at"],
        ready_to_sync=summary["ready_to_sync"],
        readiness_warnings=summary["readiness_warnings"],
    )


@router.get("/sync-logs", response_model=list[WooCommerceSyncLogRead])
async def list_sync_logs(
    db: DBSession,
    sync_type: str | None = Query(default=None),
    status_value: str | None = Query(default=None, alias="status"),
    direction: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    external_id: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    current_user: User = Depends(get_current_user),
) -> list[WooCommerceSyncLogRead]:
    _ensure_admin(current_user)
    stmt = select(WooCommerceSyncLog).options(selectinload(WooCommerceSyncLog.created_by)).order_by(WooCommerceSyncLog.created_at.desc())
    if sync_type:
        stmt = stmt.where(WooCommerceSyncLog.sync_type == sync_type)
    if status_value:
        stmt = stmt.where(WooCommerceSyncLog.status == status_value)
    if direction:
        stmt = stmt.where(WooCommerceSyncLog.direction == direction)
    if date_from:
        stmt = stmt.where(WooCommerceSyncLog.created_at >= date_from)
    if date_to:
        stmt = stmt.where(WooCommerceSyncLog.created_at <= date_to)
    if external_id:
        stmt = stmt.where(WooCommerceSyncLog.external_id.ilike(f"%{external_id}%"))
    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    return [_sync_log_to_read(log) for log in result.scalars().all()]


@router.get("/sync-logs/{log_id}", response_model=WooCommerceSyncLogRead)
async def get_sync_log_detail(
    log_id: str,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> WooCommerceSyncLogRead:
    _ensure_admin(current_user)
    result = await db.execute(
        select(WooCommerceSyncLog).options(selectinload(WooCommerceSyncLog.created_by)).where(WooCommerceSyncLog.id == log_id)
    )
    log = result.scalar_one_or_none()
    if log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="WooCommerce sync log not found")
    return _sync_log_to_read(log)


async def get_woocommerce_sync_log_count(db: DBSession) -> int:
    return int(await db.scalar(select(func.count()).select_from(WooCommerceSyncLog)) or 0)
