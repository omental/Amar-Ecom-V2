import json
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.crypto import (
    decrypt_secret,
    encrypt_secret,
    is_dedicated_secret_key_configured,
    is_encrypted_secret,
)
from app.models.courier import Shipment, ShipmentEvent
from app.models.courier_integration import CourierApiLog, CourierProviderSetting
from app.models.order import Order
from app.models.user import User
from app.services.courier_adapters import ManualCourierAdapter, SteadfastCourierAdapter
from app.services.courier_adapters.base import BaseCourierAdapter


SUPPORTED_COURIER_PROVIDERS = ("manual", "steadfast", "pathao", "redx", "paperfly")
PROVIDER_DISPLAY_NAMES = {
    "manual": "Manual",
    "steadfast": "Steadfast",
    "pathao": "Pathao",
    "redx": "RedX",
    "paperfly": "Paperfly",
}
REDACTED = "[redacted]"
SENSITIVE_KEYS = {
    "api_key",
    "api_secret",
    "merchant_id",
    "merchant_secret",
    "password",
    "token",
    "authorization",
    "authorization_header",
    "basic_auth",
    "headers",
    "secret",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _validate_provider(provider: str) -> str:
    normalized = (provider or "").strip().lower()
    if normalized not in SUPPORTED_COURIER_PROVIDERS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Courier provider is not supported.")
    return normalized


def _validate_base_url(base_url: str | None) -> str | None:
    normalized = (base_url or "").strip()
    if not normalized:
        return None
    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Courier provider base URL is invalid. Use a full http:// or https:// URL.",
        )
    return normalized.rstrip("/")


def _decrypt_for_runtime(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return decrypt_secret(value).strip() or None
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Courier provider credentials could not be decrypted. Save the provider settings again and retry.",
        ) from exc


def _sanitize_snapshot(payload: Any) -> Any:
    if isinstance(payload, dict):
        sanitized: dict[str, Any] = {}
        for key, value in payload.items():
            normalized_key = str(key).lower().replace("-", "_")
            if normalized_key in SENSITIVE_KEYS:
                sanitized[key] = REDACTED
            else:
                sanitized[key] = _sanitize_snapshot(value)
        return sanitized
    if isinstance(payload, list):
        return [_sanitize_snapshot(item) for item in payload]
    if isinstance(payload, tuple):
        return [_sanitize_snapshot(item) for item in payload]
    if isinstance(payload, str):
        lowered = payload.lower()
        if lowered.startswith("basic ") or lowered.startswith("bearer ") or "authorization:" in lowered:
            return REDACTED
    return payload


def _safe_snapshot_text(payload: Any) -> str | None:
    if payload is None:
        return None
    try:
        return json.dumps(_sanitize_snapshot(payload), ensure_ascii=True, default=str)
    except TypeError:
        return json.dumps({"payload": str(payload)}, ensure_ascii=True)


def _parse_snapshot_text(snapshot_text: str | None) -> Any:
    if not snapshot_text:
        return None
    try:
        return json.loads(snapshot_text)
    except (TypeError, ValueError):
        return snapshot_text


def map_external_courier_status(provider: str, external_status: str | None) -> dict[str, Any]:
    del provider
    normalized = (external_status or "").strip().lower().replace(" ", "_")
    if not normalized:
        return {
            "normalized_external_status": None,
            "suggested_internal_status": None,
            "severity": "warning",
            "warning_message": "Courier provider did not return a recognizable external status.",
        }

    delivered_statuses = {"delivered", "completed", "delivered_to_customer"}
    cancelled_statuses = {"cancelled", "canceled"}
    failed_statuses = {"failed", "delivery_failed"}
    returned_statuses = {"returned", "return", "rto", "return_to_origin"}
    in_progress_statuses = {"in_transit", "picked_up", "assigned", "pending", "processing"}

    if normalized in delivered_statuses:
        return {
            "normalized_external_status": "delivered",
            "suggested_internal_status": "delivered",
            "severity": "info",
            "warning_message": None,
        }
    if normalized in cancelled_statuses:
        return {
            "normalized_external_status": "cancelled",
            "suggested_internal_status": "cancelled",
            "severity": "warning",
            "warning_message": None,
        }
    if normalized in failed_statuses:
        return {
            "normalized_external_status": "failed",
            "suggested_internal_status": "failed",
            "severity": "warning",
            "warning_message": None,
        }
    if normalized in returned_statuses:
        return {
            "normalized_external_status": "returned",
            "suggested_internal_status": "returned",
            "severity": "warning",
            "warning_message": None,
        }
    if normalized in in_progress_statuses:
        return {
            "normalized_external_status": normalized,
            "suggested_internal_status": None,
            "severity": "info",
            "warning_message": "External shipment is still in progress. No local status change is suggested.",
        }
    return {
        "normalized_external_status": normalized,
        "suggested_internal_status": None,
        "severity": "warning",
        "warning_message": f"External status '{normalized}' is not mapped to a safe local shipment status.",
    }


def _detect_status_sync_conflicts(
    shipment: Shipment,
    *,
    old_external_status: str | None,
    normalized_external_status: str | None,
    suggested_internal_status: str | None,
) -> list[str]:
    warnings: list[str] = []
    internal_status = (shipment.status or "").strip().lower()
    order_status = (shipment.order.status if shipment.order and shipment.order.status else "").strip().lower()
    reconciliation_status = (shipment.reconciliation_status or "").strip().lower()

    if normalized_external_status == "delivered" and internal_status not in {"ready_to_ship", "shipped", "in_transit", "delivered"}:
        warnings.append("External status is delivered, but the local shipment was not yet in a shipped-ready state.")
    if normalized_external_status in {"returned", "cancelled"} and order_status == "delivered":
        warnings.append("External status indicates return or cancellation, but the linked local order is already delivered.")
    if normalized_external_status == "failed" and reconciliation_status == "settled":
        warnings.append("External status is failed even though reconciliation is already settled locally.")
    if normalized_external_status != old_external_status and internal_status in {"delivered", "cancelled", "returned", "failed"}:
        warnings.append("External status changed after the shipment had already been manually closed locally.")
    if suggested_internal_status in {"cancelled", "failed", "returned"}:
        warnings.append("This external status can be risky to apply automatically. Review locally before changing internal shipment state.")
    return warnings


def _can_apply_safe_internal_status(
    shipment: Shipment,
    *,
    suggested_internal_status: str | None,
    warnings: list[str],
) -> tuple[bool, str | None]:
    if suggested_internal_status != "delivered":
        return False, None
    if warnings:
        return False, "Safe local status apply was skipped because the sync produced warning conditions."
    return True, None


def _touch_shipment_status_timestamps(shipment: Shipment) -> None:
    current_time = _now()
    if shipment.status in {"shipped", "in_transit", "delivered"} and shipment.shipped_at is None:
        shipment.shipped_at = current_time
    if shipment.status == "delivered" and shipment.delivered_at is None:
        shipment.delivered_at = current_time


def _build_setting_runtime_metadata(setting: CourierProviderSetting) -> None:
    setting._decrypted_api_key = _decrypt_for_runtime(setting.api_key_encrypted)
    setting._decrypted_api_secret = _decrypt_for_runtime(setting.api_secret_encrypted)
    setting._decrypted_merchant_id = _decrypt_for_runtime(setting.merchant_id_encrypted)
    setting._decrypted_username = _decrypt_for_runtime(setting.username_encrypted)
    setting._decrypted_password = _decrypt_for_runtime(setting.password_encrypted)


def _get_adapter(setting: CourierProviderSetting) -> BaseCourierAdapter:
    provider = _validate_provider(setting.provider)
    _build_setting_runtime_metadata(setting)
    if provider == "manual":
        return ManualCourierAdapter(provider=provider, setting=setting)
    if provider == "steadfast":
        return SteadfastCourierAdapter(provider=provider, setting=setting)
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"{PROVIDER_DISPLAY_NAMES[provider]} adapter is not implemented yet. This phase only ships the foundation and Steadfast structure.",
    )


def _append_shipment_event(
    shipment: Shipment,
    *,
    event_type: str,
    message: str,
    created_by_id,
) -> None:
    shipment.events.append(
        ShipmentEvent(
            event_type=event_type,
            message=message,
            created_by_id=created_by_id,
        )
    )


async def _create_api_log(
    db: AsyncSession,
    *,
    provider: str,
    action: str,
    status_value: str,
    shipment_id=None,
    external_id: str | None = None,
    request_snapshot: Any = None,
    response_snapshot: Any = None,
    message: str | None = None,
    created_by_id=None,
) -> CourierApiLog:
    log = CourierApiLog(
        provider=provider,
        action=action,
        status=status_value,
        shipment_id=shipment_id,
        external_id=external_id,
        request_snapshot=_safe_snapshot_text(request_snapshot),
        response_snapshot=_safe_snapshot_text(response_snapshot),
        message=message,
        created_by_id=created_by_id,
        started_at=_now(),
        finished_at=_now(),
    )
    db.add(log)
    await db.flush()
    return log


async def get_provider_setting(
    db: AsyncSession,
    provider: str,
    *,
    create_if_missing: bool = True,
) -> CourierProviderSetting:
    normalized = _validate_provider(provider)
    result = await db.execute(
        select(CourierProviderSetting).where(CourierProviderSetting.provider == normalized).limit(1)
    )
    setting = result.scalar_one_or_none()
    if setting is None and create_if_missing:
        setting = CourierProviderSetting(
            provider=normalized,
            display_name=PROVIDER_DISPLAY_NAMES[normalized],
        )
        db.add(setting)
        await db.flush()
    if setting is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Courier provider settings not found.")
    return setting


async def list_provider_settings(db: AsyncSession) -> list[CourierProviderSetting]:
    result = await db.execute(select(CourierProviderSetting).order_by(CourierProviderSetting.provider.asc()))
    existing = {setting.provider: setting for setting in result.scalars().all()}
    ordered: list[CourierProviderSetting] = []
    for provider in SUPPORTED_COURIER_PROVIDERS:
        if provider in existing:
            ordered.append(existing[provider])
        else:
            ordered.append(await get_provider_setting(db, provider, create_if_missing=True))
    return ordered


async def save_provider_setting(
    db: AsyncSession,
    provider: str,
    *,
    display_name: str | None = None,
    base_url: str | None = None,
    api_key: str | None = None,
    api_secret: str | None = None,
    merchant_id: str | None = None,
    username: str | None = None,
    password: str | None = None,
    is_active: bool | None = None,
    is_sandbox: bool | None = None,
) -> CourierProviderSetting:
    setting = await get_provider_setting(db, provider, create_if_missing=True)
    if display_name is not None:
        setting.display_name = display_name.strip() or PROVIDER_DISPLAY_NAMES[setting.provider]
    if base_url is not None:
        setting.base_url = _validate_base_url(base_url)
    if api_key is not None:
        setting.api_key_encrypted = encrypt_secret(api_key) if api_key else None
    if api_secret is not None:
        setting.api_secret_encrypted = encrypt_secret(api_secret) if api_secret else None
    if merchant_id is not None:
        setting.merchant_id_encrypted = encrypt_secret(merchant_id) if merchant_id else None
    if username is not None:
        setting.username_encrypted = encrypt_secret(username) if username else None
    if password is not None:
        setting.password_encrypted = encrypt_secret(password) if password else None
    if is_active is not None:
        setting.is_active = is_active
    if is_sandbox is not None:
        setting.is_sandbox = is_sandbox
    return setting


async def test_provider_connection(
    db: AsyncSession,
    provider: str,
    current_user: User,
) -> dict[str, Any]:
    setting = await get_provider_setting(db, provider, create_if_missing=True)
    tested_at = _now()
    setting.last_tested_at = tested_at
    try:
        adapter = _get_adapter(setting)
        result = await adapter.test_connection()
        setting.last_test_success = result.success
        setting.last_test_message = result.message
        await _create_api_log(
            db,
            provider=setting.provider,
            action="connection_test",
            status_value=result.status,
            message=result.message,
            request_snapshot=result.request_snapshot,
            response_snapshot=result.response_snapshot,
            created_by_id=current_user.id,
        )
    except HTTPException as exc:
        setting.last_test_success = False
        setting.last_test_message = str(exc.detail)
        await _create_api_log(
            db,
            provider=setting.provider,
            action="connection_test",
            status_value="failed",
            message=str(exc.detail),
            response_snapshot={"detail": str(exc.detail)},
            created_by_id=current_user.id,
        )
        result = None
    return {
        "provider": setting.provider,
        "success": result.success if result else False,
        "message": result.message if result else setting.last_test_message,
        "tested_at": tested_at,
    }


async def _get_shipment_for_integration(db: AsyncSession, shipment_id) -> Shipment:
    result = await db.execute(
        select(Shipment)
        .options(
            selectinload(Shipment.order).selectinload(Order.customer),
            selectinload(Shipment.order).selectinload(Order.items),
            selectinload(Shipment.courier),
            selectinload(Shipment.events),
        )
        .where(Shipment.id == shipment_id)
    )
    shipment = result.scalar_one_or_none()
    if shipment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")
    return shipment


def _build_send_payload(shipment: Shipment) -> dict[str, Any]:
    order = shipment.order
    customer = order.customer if order else None
    order_items = list(order.items) if order and order.items else []
    item_summary = ", ".join(
        str(item.product_name or item.sku or "Item").strip()
        for item in order_items[:5]
        if str(item.product_name or item.sku or "").strip()
    ) or None
    if item_summary and len(order_items) > 5:
        item_summary = f"{item_summary}, +{len(order_items) - 5} more"
    return {
        "shipment_number": shipment.shipment_number,
        "order_number": order.order_number if order else None,
        "recipient_name": shipment.recipient_name or (customer.name if customer else None),
        "recipient_phone": shipment.recipient_phone or (order.customer_phone if order else None),
        "delivery_address": shipment.delivery_address or (order.shipping_address if order else None),
        "delivery_charge": str(shipment.delivery_charge),
        "cod_amount": str(shipment.cod_amount),
        "courier_charge": str(shipment.courier_charge),
        "tracking_number": shipment.tracking_number,
        "notes": shipment.notes,
        "item_summary": item_summary,
        "item_count": len(order_items),
        "weight": None,
    }


async def send_shipment_to_provider(
    db: AsyncSession,
    shipment_id,
    provider: str,
    current_user: User,
) -> dict[str, Any]:
    shipment = await _get_shipment_for_integration(db, shipment_id)
    setting = await get_provider_setting(db, provider, create_if_missing=True)
    if not setting.is_active:
        await _create_api_log(
            db,
            provider=setting.provider,
            action="send_shipment",
            status_value="failed",
            shipment_id=shipment.id,
            message="Courier provider is inactive.",
            created_by_id=current_user.id,
        )
        return {
            "status": "failed",
            "provider": setting.provider,
            "shipment_id": shipment.id,
            "external_id": shipment.external_consignment_id,
            "external_tracking_number": shipment.external_tracking_number,
            "external_status": shipment.external_status,
            "sent_at": shipment.sent_to_courier_at,
            "message": "Courier provider is inactive.",
            "request_snapshot": None,
            "response_snapshot": None,
            "http_status": status.HTTP_400_BAD_REQUEST,
        }
    adapter = _get_adapter(setting)
    payload = _build_send_payload(shipment)
    try:
        result = await adapter.send_shipment(shipment, payload)
    except HTTPException as exc:
        await _create_api_log(
            db,
            provider=setting.provider,
            action="send_shipment",
            status_value="failed",
            shipment_id=shipment.id,
            message=str(exc.detail),
            request_snapshot=payload,
            response_snapshot={"detail": str(exc.detail)},
            created_by_id=current_user.id,
        )
        return {
            "status": "failed",
            "provider": setting.provider,
            "shipment_id": shipment.id,
            "external_id": shipment.external_consignment_id,
            "external_tracking_number": shipment.external_tracking_number,
            "external_status": shipment.external_status,
            "sent_at": shipment.sent_to_courier_at,
            "message": str(exc.detail),
            "request_snapshot": _sanitize_snapshot(payload),
            "response_snapshot": {"detail": str(exc.detail)},
            "http_status": exc.status_code,
        }

    if result.success:
        shipment.external_provider = setting.provider
        shipment.external_consignment_id = result.external_id
        shipment.external_tracking_number = result.tracking_number or shipment.external_tracking_number
        shipment.external_status = result.external_status
        shipment.external_synced_at = _now()
        shipment.sent_to_courier_at = _now()
        shipment.external_payload_snapshot = _safe_snapshot_text(
            {
                "provider": setting.provider,
                "send_payload": payload,
                "provider_response": result.response_snapshot,
            }
        )
        _append_shipment_event(
            shipment,
            event_type="sent_to_external_courier",
            message=f"Shipment sent to external courier provider {setting.display_name}.",
            created_by_id=current_user.id,
        )
    else:
        await _create_api_log(
            db,
            provider=setting.provider,
            action="send_shipment",
            status_value="failed",
            shipment_id=shipment.id,
            external_id=result.external_id,
            message=result.message,
            request_snapshot=result.request_snapshot,
            response_snapshot=result.response_snapshot,
            created_by_id=current_user.id,
        )
        return {
            "status": "failed",
            "provider": setting.provider,
            "shipment_id": shipment.id,
            "external_id": result.external_id,
            "external_tracking_number": result.tracking_number,
            "external_status": result.external_status,
            "sent_at": shipment.sent_to_courier_at,
            "message": result.message,
            "request_snapshot": _sanitize_snapshot(result.request_snapshot),
            "response_snapshot": _sanitize_snapshot(result.response_snapshot),
            "http_status": status.HTTP_502_BAD_GATEWAY,
        }

    await _create_api_log(
        db,
        provider=setting.provider,
        action="send_shipment",
        status_value=result.status,
        shipment_id=shipment.id,
        external_id=result.external_id,
        message=result.message,
        request_snapshot=result.request_snapshot,
        response_snapshot=result.response_snapshot,
        created_by_id=current_user.id,
    )

    return {
        "status": result.status,
        "provider": setting.provider,
        "shipment_id": shipment.id,
        "external_id": result.external_id,
        "external_tracking_number": result.tracking_number,
        "external_status": result.external_status,
        "sent_at": shipment.sent_to_courier_at,
        "message": result.message,
        "request_snapshot": _sanitize_snapshot(result.request_snapshot),
        "response_snapshot": _sanitize_snapshot(result.response_snapshot),
    }


async def sync_shipment_status(
    db: AsyncSession,
    shipment_id,
    current_user: User,
    *,
    provider: str | None = None,
    apply_safe_status: bool = False,
) -> dict[str, Any]:
    shipment = await _get_shipment_for_integration(db, shipment_id)
    provider_candidate = provider or shipment.external_provider
    if not provider_candidate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Shipment is not linked to an external courier provider yet. Send it to a provider first or specify a provider.",
        )
    provider_name = _validate_provider(provider_candidate)
    setting = await get_provider_setting(db, provider_name, create_if_missing=True)
    if not setting.is_active:
        await _create_api_log(
            db,
            provider=provider_name,
            action="status_sync",
            status_value="failed",
            shipment_id=shipment.id,
            external_id=shipment.external_consignment_id,
            message="Courier provider is inactive.",
            created_by_id=current_user.id,
        )
        return {
            "status": "failed",
            "provider": provider_name,
            "shipment_id": shipment.id,
            "external_id": shipment.external_consignment_id,
            "external_tracking_number": shipment.external_tracking_number,
            "external_status": shipment.external_status,
            "internal_status": shipment.status,
            "synced_at": shipment.external_synced_at,
            "message": "Courier provider is inactive.",
            "request_snapshot": None,
            "response_snapshot": None,
            "http_status": status.HTTP_400_BAD_REQUEST,
        }
    if not shipment.external_provider:
        shipment.external_provider = provider_name
    adapter = _get_adapter(setting)
    old_external_status = shipment.external_status
    old_internal_status = shipment.status
    request_snapshot = {
        "external_consignment_id": shipment.external_consignment_id,
        "tracking_number": shipment.external_tracking_number or shipment.tracking_number,
        "apply_safe_status": apply_safe_status,
    }
    try:
        result = await adapter.get_status(
            shipment=shipment,
            external_consignment_id=shipment.external_consignment_id,
            tracking_number=shipment.external_tracking_number or shipment.tracking_number,
        )
    except HTTPException as exc:
        await _create_api_log(
            db,
            provider=provider_name,
            action="status_sync",
            status_value="failed",
            shipment_id=shipment.id,
            external_id=shipment.external_consignment_id,
            message=str(exc.detail),
            request_snapshot=request_snapshot,
            response_snapshot={"detail": str(exc.detail)},
            created_by_id=current_user.id,
        )
        return {
            "status": "failed",
            "provider": provider_name,
            "shipment_id": shipment.id,
            "external_id": shipment.external_consignment_id,
            "external_tracking_number": shipment.external_tracking_number,
            "external_status": shipment.external_status,
            "internal_status": shipment.status,
            "synced_at": shipment.external_synced_at,
            "message": str(exc.detail),
            "request_snapshot": _sanitize_snapshot(request_snapshot),
            "response_snapshot": {"detail": str(exc.detail)},
            "http_status": exc.status_code,
        }

    if result.success:
        mapped_status = map_external_courier_status(provider_name, result.external_status)
        normalized_external_status = mapped_status["normalized_external_status"]
        suggested_internal_status = mapped_status["suggested_internal_status"]
        severity = mapped_status["severity"]
        warnings = _detect_status_sync_conflicts(
            shipment,
            old_external_status=old_external_status,
            normalized_external_status=normalized_external_status,
            suggested_internal_status=suggested_internal_status,
        )
        if mapped_status["warning_message"]:
            warnings.append(str(mapped_status["warning_message"]))

        shipment.external_provider = provider_name
        shipment.external_consignment_id = result.external_id or shipment.external_consignment_id
        shipment.external_tracking_number = result.tracking_number or shipment.external_tracking_number
        shipment.external_status = normalized_external_status or result.external_status or shipment.external_status
        shipment.external_synced_at = _now()
        internal_status_changed = False
        internal_apply_warning = None
        if apply_safe_status:
            can_apply, internal_apply_warning = _can_apply_safe_internal_status(
                shipment,
                suggested_internal_status=suggested_internal_status,
                warnings=warnings,
            )
            if can_apply and suggested_internal_status and suggested_internal_status != shipment.status:
                shipment.status = suggested_internal_status
                internal_status_changed = True
                _touch_shipment_status_timestamps(shipment)
        elif suggested_internal_status == "delivered":
            warnings.append("External delivered status was not applied locally because apply_safe_status is off.")
        if internal_apply_warning:
            warnings.append(internal_apply_warning)

        shipment.external_payload_snapshot = _safe_snapshot_text(
            {
                "provider": provider_name,
                "status_request": result.request_snapshot,
                "status_response": result.response_snapshot,
                "old_external_status": old_external_status,
                "new_external_status": shipment.external_status,
                "suggested_internal_status": suggested_internal_status,
                "internal_status_changed": internal_status_changed,
                "warnings": warnings,
                "severity": severity,
            }
        )
        event_parts = [
            f"External courier status synced for {provider_name}: {old_external_status or 'none'} -> {shipment.external_status or 'unknown'}.",
        ]
        if suggested_internal_status:
            event_parts.append(f"Suggested local status: {suggested_internal_status}.")
        if internal_status_changed:
            event_parts.append(f"Local shipment status changed: {old_internal_status} -> {shipment.status}.")
        if warnings:
            event_parts.append(f"Warnings: {' | '.join(warnings)}")
        _append_shipment_event(
            shipment,
            event_type="external_status_synced",
            message=" ".join(event_parts),
            created_by_id=current_user.id,
        )
    else:
        await _create_api_log(
            db,
            provider=provider_name,
            action="status_sync",
            status_value="failed",
            shipment_id=shipment.id,
            external_id=result.external_id or shipment.external_consignment_id,
            message=result.message,
            request_snapshot=result.request_snapshot,
            response_snapshot=result.response_snapshot,
            created_by_id=current_user.id,
        )
        return {
            "status": "failed",
            "provider": provider_name,
            "shipment_id": shipment.id,
            "external_id": shipment.external_consignment_id,
            "external_tracking_number": shipment.external_tracking_number,
            "external_status": shipment.external_status,
            "internal_status": shipment.status,
            "synced_at": shipment.external_synced_at,
            "message": result.message,
            "request_snapshot": _sanitize_snapshot(result.request_snapshot),
            "response_snapshot": _sanitize_snapshot(result.response_snapshot),
            "http_status": status.HTTP_502_BAD_GATEWAY,
        }

    log_message = result.message if not warnings else f"{result.message} Warnings: {' | '.join(warnings)}"
    await _create_api_log(
        db,
        provider=provider_name,
        action="status_sync",
        status_value=result.status,
        shipment_id=shipment.id,
        external_id=result.external_id or shipment.external_consignment_id,
        message=log_message,
        request_snapshot=result.request_snapshot,
        response_snapshot={
            "response": result.response_snapshot,
            "old_external_status": old_external_status,
            "new_external_status": shipment.external_status,
            "normalized_external_status": normalized_external_status,
            "suggested_internal_status": suggested_internal_status,
            "internal_status_changed": internal_status_changed,
            "warnings": warnings,
            "severity": severity,
        },
        created_by_id=current_user.id,
    )

    return {
        "status": result.status,
        "provider": provider_name,
        "shipment_id": shipment.id,
        "shipment_number": shipment.shipment_number,
        "external_id": shipment.external_consignment_id,
        "external_tracking_number": shipment.external_tracking_number,
        "old_external_status": old_external_status,
        "external_status": shipment.external_status,
        "normalized_external_status": normalized_external_status,
        "internal_status": shipment.status,
        "suggested_internal_status": suggested_internal_status,
        "internal_status_changed": internal_status_changed,
        "severity": severity,
        "warnings": warnings,
        "synced_at": shipment.external_synced_at,
        "message": result.message,
        "request_snapshot": _sanitize_snapshot(result.request_snapshot),
        "response_snapshot": _sanitize_snapshot(
            {
                "response": result.response_snapshot,
                "warnings": warnings,
                "severity": severity,
            }
        ),
        }


async def bulk_sync_shipment_statuses(
    db: AsyncSession,
    current_user: User,
    *,
    provider: str | None = None,
    shipment_status: str | None = None,
    limit: int = 20,
    apply_safe_status: bool = False,
) -> dict[str, Any]:
    stmt = (
        select(Shipment)
        .options(
            selectinload(Shipment.order),
            selectinload(Shipment.events),
        )
        .where(
            Shipment.external_provider.is_not(None),
            or_(Shipment.external_consignment_id.is_not(None), Shipment.external_tracking_number.is_not(None)),
        )
        .order_by(Shipment.updated_at.desc(), Shipment.created_at.desc())
        .limit(limit)
    )
    if provider:
        stmt = stmt.where(Shipment.external_provider == _validate_provider(provider))
    if shipment_status:
        stmt = stmt.where(Shipment.status == shipment_status)

    shipments = (await db.execute(stmt)).scalars().all()
    synced_count = 0
    skipped_count = 0
    failed_count = 0
    rows: list[dict[str, Any]] = []

    for shipment in shipments:
        provider_name = shipment.external_provider or provider
        if not provider_name:
            skipped_count += 1
            rows.append(
                {
                    "shipment_id": shipment.id,
                    "shipment_number": shipment.shipment_number,
                    "provider": None,
                    "old_external_status": shipment.external_status,
                    "new_external_status": shipment.external_status,
                    "internal_status_changed": False,
                    "message": "Shipment is not linked to an external courier provider yet.",
                    "warnings": ["Shipment is missing an external provider link."],
                    "status": "skipped",
                }
            )
            continue

        result = await sync_shipment_status(
            db,
            shipment.id,
            current_user,
            provider=provider_name,
            apply_safe_status=apply_safe_status,
        )

        row_status = result["status"]
        if row_status == "success":
            synced_count += 1
        elif row_status == "skipped":
            skipped_count += 1
        else:
            failed_count += 1

        rows.append(
            {
                "shipment_id": shipment.id,
                "shipment_number": shipment.shipment_number,
                "provider": result.get("provider") or provider_name,
                "old_external_status": result.get("old_external_status"),
                "new_external_status": result.get("external_status"),
                "internal_status_changed": bool(result.get("internal_status_changed")),
                "message": result.get("message") or "Courier status sync completed.",
                "warnings": result.get("warnings") or [],
                "status": row_status,
            }
        )

    return {
        "synced_count": synced_count,
        "skipped_count": skipped_count,
        "failed_count": failed_count,
        "rows": rows,
    }


async def count_recent_failed_api_logs(db: AsyncSession) -> int:
    return int(await db.scalar(select(func.count()).select_from(CourierApiLog).where(CourierApiLog.status == "failed")) or 0)


def provider_setting_metadata(setting: CourierProviderSetting) -> dict[str, Any]:
    credential_values = {
        "api_key": setting.api_key_encrypted,
        "api_secret": setting.api_secret_encrypted,
        "merchant_id": setting.merchant_id_encrypted,
        "username": setting.username_encrypted,
        "password": setting.password_encrypted,
    }
    masked_values: dict[str, str | None] = {}
    credentials_encrypted = True
    from app.core.crypto import mask_secret

    for field_name, stored_value in credential_values.items():
        decrypted_value = None
        if stored_value:
            try:
                decrypted_value = decrypt_secret(stored_value)
                credentials_encrypted = credentials_encrypted and is_encrypted_secret(stored_value)
            except ValueError:
                credentials_encrypted = False
                decrypted_value = None
        masked_values[f"{field_name}_masked"] = mask_secret(decrypted_value) if decrypted_value else None

    encryption_warning = None
    if not is_dedicated_secret_key_configured():
        encryption_warning = "Set FERNET_SECRET_KEY or APP_SECRET_KEY for a dedicated courier credential encryption key."
    if not credentials_encrypted and any(credential_values.values()):
        encryption_warning = "Stored courier credentials include legacy plaintext values. Save the provider settings again to re-encrypt them."

    return {
        "id": setting.id,
        "provider": setting.provider,
        "display_name": setting.display_name,
        "base_url": setting.base_url,
        "has_api_key": bool(setting.api_key_encrypted),
        "has_api_secret": bool(setting.api_secret_encrypted),
        "has_merchant_id": bool(setting.merchant_id_encrypted),
        "has_username": bool(setting.username_encrypted),
        "has_password": bool(setting.password_encrypted),
        "api_key_masked": masked_values["api_key_masked"],
        "api_secret_masked": masked_values["api_secret_masked"],
        "merchant_id_masked": masked_values["merchant_id_masked"],
        "username_masked": masked_values["username_masked"],
        "password_masked": masked_values["password_masked"],
        "credentials_encrypted": credentials_encrypted,
        "encryption_key_configured": is_dedicated_secret_key_configured(),
        "encryption_warning": encryption_warning,
        "is_active": setting.is_active,
        "is_sandbox": setting.is_sandbox,
        "last_tested_at": setting.last_tested_at,
        "last_test_success": setting.last_test_success,
        "last_test_message": setting.last_test_message,
        "created_at": setting.created_at,
        "updated_at": setting.updated_at,
    }


def courier_log_to_read_model_payload(log: CourierApiLog) -> dict[str, Any]:
    return {
        "id": log.id,
        "provider": log.provider,
        "action": log.action,
        "status": log.status,
        "shipment_id": log.shipment_id,
        "external_id": log.external_id,
        "request_snapshot": _parse_snapshot_text(log.request_snapshot),
        "response_snapshot": _parse_snapshot_text(log.response_snapshot),
        "message": log.message,
        "created_by_id": log.created_by_id,
        "started_at": log.started_at,
        "finished_at": log.finished_at,
        "created_at": log.created_at,
        "created_by": log.created_by,
    }
