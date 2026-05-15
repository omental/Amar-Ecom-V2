from typing import Any

from app.services.courier_adapters.base import AdapterResult, BaseCourierAdapter


class ManualCourierAdapter(BaseCourierAdapter):
    async def test_connection(self) -> AdapterResult:
        return AdapterResult(
            success=True,
            status="success",
            message="Manual courier provider has no external API to test.",
            request_snapshot={"provider": self.provider},
            response_snapshot={"mode": "manual", "detail": "No external request performed."},
        )

    async def send_shipment(self, shipment: Any, payload: dict[str, Any]) -> AdapterResult:
        return AdapterResult(
            success=False,
            status="skipped",
            message="Manual courier provider does not send shipments to an external API.",
            request_snapshot=payload,
            response_snapshot={"mode": "manual", "detail": "Shipment send skipped."},
        )

    async def get_status(
        self,
        *,
        shipment: Any,
        external_consignment_id: str | None,
        tracking_number: str | None,
    ) -> AdapterResult:
        return AdapterResult(
            success=False,
            status="skipped",
            message="Manual courier provider does not have an external status API.",
            request_snapshot={
                "shipment_id": str(shipment.id),
                "external_consignment_id": external_consignment_id,
                "tracking_number": tracking_number,
            },
            response_snapshot={"mode": "manual", "detail": "Status sync skipped."},
        )
