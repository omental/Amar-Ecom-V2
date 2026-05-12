from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409
from app.models.user import User
from app.models.woocommerce import WooCommerceSetting, WooCommerceSyncLog
from app.schemas.woocommerce import (
    WooCommerceConnectionTestRead,
    WooCommerceImportRequest,
    WooCommerceImportResult,
    WooCommerceOrderPreviewListRead,
    WooCommerceProductPreviewListRead,
    WooCommerceSettingRead,
    WooCommerceSettingUpdate,
    WooCommerceSyncLogRead,
)
from app.services.activity_log_service import log_activity
from app.services.woocommerce_service import (
    fetch_orders_preview,
    fetch_products_preview,
    import_orders,
    import_products,
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


def _settings_to_read(settings: WooCommerceSetting) -> WooCommerceSettingRead:
    return WooCommerceSettingRead(
        id=settings.id,
        store_url=settings.store_url,
        api_version=settings.api_version,
        is_active=settings.is_active,
        has_consumer_key=bool(settings.consumer_key_encrypted),
        has_consumer_secret=bool(settings.consumer_secret_encrypted),
        last_tested_at=settings.last_tested_at,
        last_test_success=settings.last_test_success,
        last_test_message=settings.last_test_message,
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

    if "store_url" in payload:
        settings.store_url = payload["store_url"]
    if "consumer_key" in payload and payload["consumer_key"] is not None:
        settings.consumer_key_encrypted = payload["consumer_key"]
    if "consumer_secret" in payload and payload["consumer_secret"] is not None:
        settings.consumer_secret_encrypted = payload["consumer_secret"]
    if "api_version" in payload and payload["api_version"] is not None:
        settings.api_version = payload["api_version"]
    if "is_active" in payload and payload["is_active"] is not None:
        settings.is_active = payload["is_active"]

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
    current_user: User = Depends(get_current_user),
) -> WooCommerceProductPreviewListRead:
    _ensure_admin(current_user)
    preview = await fetch_products_preview(db, page=page, per_page=per_page, search=search, current_user=current_user)
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
        message=f"Imported {result['imported']} WooCommerce products, skipped {result['skipped']}, failed {result['failed']}.",
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
    current_user: User = Depends(get_current_user),
) -> WooCommerceOrderPreviewListRead:
    _ensure_admin(current_user)
    preview = await fetch_orders_preview(db, page=page, per_page=per_page, status_value=status, current_user=current_user)
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
        message=f"Imported {result['imported']} WooCommerce orders, skipped {result['skipped']}, failed {result['failed']}.",
        request=request,
    )
    await commit_or_409(db, "Could not complete WooCommerce order import")
    return WooCommerceImportResult(**result)


@router.get("/sync-logs", response_model=list[WooCommerceSyncLogRead])
async def list_sync_logs(
    db: DBSession,
    limit: int = Query(default=100, ge=1, le=200),
    current_user: User = Depends(get_current_user),
) -> list[WooCommerceSyncLog]:
    _ensure_admin(current_user)
    result = await db.execute(
        select(WooCommerceSyncLog)
        .options(selectinload(WooCommerceSyncLog.created_by))
        .order_by(WooCommerceSyncLog.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_woocommerce_sync_log_count(db: DBSession) -> int:
    return int(await db.scalar(select(func.count()).select_from(WooCommerceSyncLog)) or 0)
