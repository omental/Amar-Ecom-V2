from dataclasses import dataclass
from typing import Any


@dataclass
class AdapterResult:
    success: bool
    status: str
    message: str
    external_id: str | None = None
    tracking_number: str | None = None
    external_status: str | None = None
    shipment_status: str | None = None
    request_snapshot: Any = None
    response_snapshot: Any = None


class BaseCourierAdapter:
    def __init__(self, *, provider: str, setting: Any) -> None:
        self.provider = provider
        self.setting = setting

    async def test_connection(self) -> AdapterResult:
        raise NotImplementedError

    async def send_shipment(self, shipment: Any, payload: dict[str, Any]) -> AdapterResult:
        raise NotImplementedError

    async def get_status(
        self,
        *,
        shipment: Any,
        external_consignment_id: str | None,
        tracking_number: str | None,
    ) -> AdapterResult:
        raise NotImplementedError
