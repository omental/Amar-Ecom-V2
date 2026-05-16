from typing import Any

import httpx
from fastapi import HTTPException, status

from app.services.courier_adapters.base import AdapterResult, BaseCourierAdapter


# TODO: Confirm the exact production Steadfast endpoint paths before go-live.
STEADFAST_CREATE_ORDER_PATH = "/create_order"
STEADFAST_STATUS_BY_CONSIGNMENT_PATH = "/status_by_cid/{lookup_value}"
STEADFAST_STATUS_BY_TRACKING_PATH = "/status_by_trackingcode/{lookup_value}"


class SteadfastCourierAdapter(BaseCourierAdapter):
    def _build_base_url(self) -> str:
        base_url = (self.setting.base_url or "").strip().rstrip("/")
        if not base_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Steadfast base URL is missing. Save the provider base URL before testing or sending shipments.",
            )
        return base_url

    def _require_credentials(self) -> None:
        api_key = getattr(self.setting, "_decrypted_api_key", None)
        api_secret = getattr(self.setting, "_decrypted_api_secret", None)
        if api_key and api_secret:
            return

        username = getattr(self.setting, "_decrypted_username", None)
        password = getattr(self.setting, "_decrypted_password", None)
        if username and password:
            return

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Steadfast credentials are incomplete. Save an API key and API secret, "
                "or a username and password, before testing or sending shipments."
            ),
        )

    def _build_headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json"}
        self._require_credentials()
        api_key = getattr(self.setting, "_decrypted_api_key", None)
        api_secret = getattr(self.setting, "_decrypted_api_secret", None)
        merchant_id = getattr(self.setting, "_decrypted_merchant_id", None)
        username = getattr(self.setting, "_decrypted_username", None)
        password = getattr(self.setting, "_decrypted_password", None)

        if api_key:
            headers["Api-Key"] = api_key
        if api_secret:
            headers["Secret-Key"] = api_secret
        if merchant_id:
            headers["Merchant-Id"] = merchant_id
        if username and password:
            headers["Username"] = username
            headers["Password"] = password
        return headers

    async def _request(self, method: str, path: str, *, json_payload: dict[str, Any] | None = None) -> httpx.Response:
        url = f"{self._build_base_url()}{path}"
        headers = self._build_headers()
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            try:
                return await client.request(method, url, json=json_payload, headers=headers)
            except httpx.TimeoutException as exc:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="Courier provider request timed out. Check the provider base URL, credentials, and network availability.",
                ) from exc
            except httpx.InvalidURL as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Courier provider base URL is invalid. Use a full http:// or https:// URL.",
                ) from exc
            except httpx.HTTPError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Courier provider API is unavailable right now. Please try again shortly.",
                ) from exc

    @staticmethod
    def _parse_json(response: httpx.Response, fallback_message: str) -> dict[str, Any]:
        try:
            payload = response.json()
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=fallback_message,
            ) from exc
        if not isinstance(payload, dict):
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=fallback_message)
        return payload

    @staticmethod
    def _extract_payload_container(payload: dict[str, Any]) -> dict[str, Any]:
        for key in ("data", "result", "order", "consignment"):
            nested = payload.get(key)
            if isinstance(nested, dict):
                return nested
        return payload

    @staticmethod
    def _normalize_status(value: Any) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None

    @classmethod
    def _extract_send_result_fields(cls, payload: dict[str, Any]) -> tuple[str | None, str | None, str | None, str | None]:
        container = cls._extract_payload_container(payload)
        external_id = (
            container.get("consignment_id")
            or container.get("consignmentId")
            or container.get("id")
            or payload.get("consignment_id")
            or payload.get("consignmentId")
            or payload.get("id")
        )
        tracking_number = (
            container.get("tracking_code")
            or container.get("tracking_number")
            or container.get("trackingCode")
            or payload.get("tracking_code")
            or payload.get("tracking_number")
            or payload.get("trackingCode")
        )
        external_status = cls._normalize_status(
            container.get("status")
            or container.get("delivery_status")
            or container.get("deliveryStatus")
            or payload.get("status")
            or payload.get("delivery_status")
            or payload.get("deliveryStatus")
            or "submitted"
        )
        message = (
            container.get("message")
            or payload.get("message")
            or payload.get("msg")
            or payload.get("detail")
            or "Shipment sent to Steadfast successfully."
        )
        return (
            str(external_id) if external_id else None,
            str(tracking_number) if tracking_number else None,
            external_status,
            str(message),
        )

    @classmethod
    def _extract_status_fields(
        cls,
        payload: dict[str, Any],
        *,
        fallback_tracking_number: str | None,
        fallback_external_id: str | None,
    ) -> tuple[str | None, str | None, str | None, str]:
        container = cls._extract_payload_container(payload)
        external_id = (
            container.get("consignment_id")
            or container.get("consignmentId")
            or container.get("id")
            or fallback_external_id
        )
        tracking_number = (
            container.get("tracking_code")
            or container.get("tracking_number")
            or container.get("trackingCode")
            or payload.get("tracking_code")
            or payload.get("tracking_number")
            or payload.get("trackingCode")
            or fallback_tracking_number
        )
        external_status = cls._normalize_status(
            container.get("status")
            or container.get("delivery_status")
            or container.get("deliveryStatus")
            or payload.get("status")
            or payload.get("delivery_status")
            or payload.get("deliveryStatus")
        )
        message = (
            container.get("message")
            or payload.get("message")
            or payload.get("msg")
            or "Steadfast status synced successfully."
        )
        return (
            str(external_id) if external_id else None,
            str(tracking_number) if tracking_number else None,
            external_status,
            str(message),
        )

    def _build_create_payload(self, shipment: Any, payload: dict[str, Any]) -> dict[str, Any]:
        recipient_name = str(payload.get("recipient_name") or "").strip()
        recipient_phone = str(payload.get("recipient_phone") or "").strip()
        delivery_address = str(payload.get("delivery_address") or "").strip()
        invoice = str(payload.get("order_number") or payload.get("shipment_number") or "").strip()

        missing_fields: list[str] = []
        if not recipient_name:
            missing_fields.append("recipient name")
        if not recipient_phone:
            missing_fields.append("recipient phone")
        if not delivery_address:
            missing_fields.append("delivery address")
        if not invoice:
            missing_fields.append("invoice/order number")
        if missing_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Shipment is missing required Steadfast fields: {', '.join(missing_fields)}.",
            )

        item_summary = payload.get("item_summary")
        safe_payload: dict[str, Any] = {
            "invoice": invoice,
            "recipient_name": recipient_name,
            "recipient_phone": recipient_phone,
            "recipient_address": delivery_address,
            "cod_amount": str(payload.get("cod_amount") or "0"),
        }

        if item_summary:
            safe_payload["product_name"] = str(item_summary)
        if payload.get("notes"):
            safe_payload["note"] = str(payload["notes"])
        if payload.get("delivery_charge") not in {None, ""}:
            safe_payload["delivery_charge"] = str(payload["delivery_charge"])
        if payload.get("weight"):
            safe_payload["weight"] = str(payload["weight"])
        return safe_payload

    @staticmethod
    def _status_path(*, external_consignment_id: str | None, tracking_number: str | None) -> tuple[str, str]:
        if external_consignment_id:
            return (
                STEADFAST_STATUS_BY_CONSIGNMENT_PATH.format(lookup_value=external_consignment_id),
                external_consignment_id,
            )
        if tracking_number:
            return (
                STEADFAST_STATUS_BY_TRACKING_PATH.format(lookup_value=tracking_number),
                tracking_number,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Shipment is missing an external consignment ID or tracking number for Steadfast status sync.",
        )

    async def test_connection(self) -> AdapterResult:
        self._build_base_url()
        self._require_credentials()
        return AdapterResult(
            success=True,
            status="success",
            message=(
                "Steadfast configuration check passed. Base URL and credentials are present, "
                "but the production-safe test endpoint still needs confirmation before live deployment."
            ),
            request_snapshot={"mode": "configuration_check_only", "provider": "steadfast"},
            response_snapshot={
                "base_url_configured": True,
                "credentials_present": True,
                "sandbox_mode": bool(self.setting.is_sandbox),
            },
        )

    async def send_shipment(self, shipment: Any, payload: dict[str, Any]) -> AdapterResult:
        request_payload = self._build_create_payload(shipment, payload)
        response = await self._request("POST", STEADFAST_CREATE_ORDER_PATH, json_payload=request_payload)
        if response.status_code in {401, 403}:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Steadfast credentials were rejected while sending the shipment.",
            )
        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Steadfast returned status {response.status_code} while sending the shipment.",
            )
        response_payload = self._parse_json(response, "Steadfast returned a non-JSON shipment-send response.")
        external_id, tracking_number, external_status, message = self._extract_send_result_fields(response_payload)
        if not external_id and not tracking_number:
            return AdapterResult(
                success=False,
                status="failed",
                message=(
                    "Steadfast accepted the request but did not return a consignment ID or tracking number. "
                    "The shipment was not marked as sent locally."
                ),
                request_snapshot=request_payload,
                response_snapshot=response_payload,
            )
        return AdapterResult(
            success=True,
            status="success",
            message=message,
            external_id=external_id,
            tracking_number=tracking_number,
            external_status=external_status,
            request_snapshot=request_payload,
            response_snapshot=response_payload,
        )

    async def get_status(
        self,
        *,
        shipment: Any,
        external_consignment_id: str | None,
        tracking_number: str | None,
    ) -> AdapterResult:
        path, lookup_value = self._status_path(
            external_consignment_id=external_consignment_id,
            tracking_number=tracking_number,
        )
        response = await self._request("GET", path)
        if response.status_code in {401, 403}:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Steadfast credentials were rejected while syncing shipment status.",
            )
        if response.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Steadfast could not find that shipment reference.",
            )
        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Steadfast returned status {response.status_code} while syncing shipment status.",
            )
        response_payload = self._parse_json(response, "Steadfast returned a non-JSON status-sync response.")
        external_id, tracking_value, external_status, message = self._extract_status_fields(
            response_payload,
            fallback_tracking_number=tracking_number,
            fallback_external_id=external_consignment_id or lookup_value,
        )
        return AdapterResult(
            success=True,
            status="success",
            message=message,
            external_id=external_id,
            tracking_number=tracking_value,
            external_status=external_status,
            request_snapshot={"lookup_value": lookup_value, "path": path},
            response_snapshot=response_payload,
        )
