from typing import Any

import httpx
from fastapi import HTTPException, status

from app.services.courier_adapters.base import AdapterResult, BaseCourierAdapter


class SteadfastCourierAdapter(BaseCourierAdapter):
    def _build_base_url(self) -> str:
        base_url = (self.setting.base_url or "").strip().rstrip("/")
        if not base_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Steadfast base URL is missing. Save the provider base URL before testing or sending shipments.",
            )
        return base_url

    def _build_headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json"}
        api_key = getattr(self.setting, "_decrypted_api_key", None)
        api_secret = getattr(self.setting, "_decrypted_api_secret", None)
        username = getattr(self.setting, "_decrypted_username", None)
        password = getattr(self.setting, "_decrypted_password", None)

        if api_key:
            headers["Api-Key"] = api_key
        if api_secret:
            headers["Secret-Key"] = api_secret
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

    async def test_connection(self) -> AdapterResult:
        # TODO: Confirm the production Steadfast health-check endpoint before live deployment.
        response = await self._request("GET", "/status")
        if response.status_code in {401, 403}:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Courier provider credentials were rejected. Check the saved API credentials.",
            )
        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Courier provider returned status {response.status_code} during connection test.",
            )
        payload = self._parse_json(response, "Courier provider returned an unreadable connection-test response.")
        return AdapterResult(
            success=True,
            status="success",
            message="Courier provider connection succeeded.",
            request_snapshot={"method": "GET", "path": "/status"},
            response_snapshot=payload,
        )

    async def send_shipment(self, shipment: Any, payload: dict[str, Any]) -> AdapterResult:
        # TODO: Confirm the production Steadfast consignment-create endpoint and response keys before live deployment.
        response = await self._request("POST", "/orders", json_payload=payload)
        if response.status_code in {401, 403}:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Courier provider credentials were rejected while sending the shipment.",
            )
        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Courier provider returned status {response.status_code} while sending the shipment.",
            )
        response_payload = self._parse_json(response, "Courier provider returned an unreadable shipment-send response.")
        external_id = response_payload.get("consignment_id") or response_payload.get("id") or response_payload.get("tracking_code")
        tracking_number = response_payload.get("tracking_code") or response_payload.get("tracking_number")
        external_status = response_payload.get("status") or "submitted"
        return AdapterResult(
            success=True,
            status="success",
            message="Shipment sent to courier provider successfully.",
            external_id=str(external_id) if external_id else None,
            tracking_number=str(tracking_number) if tracking_number else None,
            external_status=str(external_status) if external_status else None,
            request_snapshot=payload,
            response_snapshot=response_payload,
        )

    async def get_status(
        self,
        *,
        shipment: Any,
        external_consignment_id: str | None,
        tracking_number: str | None,
    ) -> AdapterResult:
        lookup_value = external_consignment_id or tracking_number
        if not lookup_value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Shipment is missing an external consignment ID or tracking number for courier status sync.",
            )

        # TODO: Confirm the production Steadfast status endpoint and query shape before live deployment.
        response = await self._request("GET", f"/orders/{lookup_value}")
        if response.status_code in {401, 403}:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Courier provider credentials were rejected while syncing shipment status.",
            )
        if response.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Courier provider could not find that shipment reference.",
            )
        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Courier provider returned status {response.status_code} while syncing shipment status.",
            )
        response_payload = self._parse_json(response, "Courier provider returned an unreadable status-sync response.")
        external_status = response_payload.get("status") or response_payload.get("delivery_status")
        tracking_value = response_payload.get("tracking_code") or response_payload.get("tracking_number") or tracking_number
        return AdapterResult(
            success=True,
            status="success",
            message="Courier provider status synced successfully.",
            external_id=str(external_consignment_id or response_payload.get("consignment_id") or lookup_value),
            tracking_number=str(tracking_value) if tracking_value else None,
            external_status=str(external_status) if external_status else None,
            request_snapshot={"lookup_value": lookup_value},
            response_snapshot=response_payload,
        )
