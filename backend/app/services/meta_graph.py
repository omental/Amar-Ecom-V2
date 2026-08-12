from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlencode

import httpx

from app.core.config import settings


ERROR_CODE_MAP = {
    4: "rate_limited", 10: "permission_denied", 100: "invalid_payload",
    190: "authorization_required", 200: "permission_denied", 551: "invalid_recipient",
}


class MetaProviderError(RuntimeError):
    def __init__(self, kind: str, message: str, *, retryable: bool = False, request_id: str | None = None) -> None:
        super().__init__(message)
        self.kind = kind
        self.retryable = retryable
        self.request_id = request_id


@dataclass(frozen=True, slots=True)
class MetaGraphResponse:
    data: dict[str, Any]
    request_id: str | None = None
    rate_limit: dict[str, str] = field(default_factory=dict)


class MetaGraphClient:
    """Typed, bounded Meta Graph boundary. Tokens and message bodies are never logged."""

    def __init__(self, *, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self.base_url = f"https://graph.facebook.com/{settings.META_GRAPH_API_VERSION.strip('/')}"
        self.transport = transport

    @property
    def configured(self) -> bool:
        return bool(settings.META_APP_ID and settings.META_APP_SECRET and settings.META_OAUTH_REDIRECT_URI)

    def authorization_url(self, state: str) -> str:
        if not self.configured:
            raise MetaProviderError("authorization_required", "Meta integration is not configured for this environment.")
        query = urlencode({
            "client_id": settings.META_APP_ID,
            "redirect_uri": settings.META_OAUTH_REDIRECT_URI,
            "state": state,
            "response_type": "code",
            "scope": "pages_show_list,pages_messaging,pages_manage_metadata,business_management,whatsapp_business_management,whatsapp_business_messaging",
        })
        return f"https://www.facebook.com/{settings.META_GRAPH_API_VERSION.strip('/')}/dialog/oauth?{query}"

    async def request(self, method: str, path: str, *, access_token: str | None = None, params: dict | None = None, json: dict | None = None) -> MetaGraphResponse:
        url = path if path.startswith("https://") else f"{self.base_url}/{path.lstrip('/')}"
        headers = {"Accept": "application/json"}
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"
        retries = max(0, settings.META_GRAPH_MAX_RETRIES)
        for attempt in range(retries + 1):
            try:
                async with httpx.AsyncClient(timeout=settings.META_GRAPH_TIMEOUT_SECONDS, transport=self.transport) as client:
                    response = await client.request(method, url, headers=headers, params=params, json=json)
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                if attempt < retries:
                    await asyncio.sleep(0.15 * (2 ** attempt))
                    continue
                raise MetaProviderError("provider_unavailable", "Meta is temporarily unavailable.", retryable=True) from exc
            request_id = response.headers.get("x-fb-trace-id") or response.headers.get("x-fb-request-id")
            rate_limit = {key: value for key, value in response.headers.items() if key.lower() in {"x-app-usage", "x-page-usage", "x-business-use-case-usage"}}
            try:
                payload = response.json()
            except ValueError:
                payload = {}
            if response.is_success:
                return MetaGraphResponse(data=payload if isinstance(payload, dict) else {}, request_id=request_id, rate_limit=rate_limit)
            error = payload.get("error", {}) if isinstance(payload, dict) else {}
            code = int(error.get("code", 0) or 0)
            kind = ERROR_CODE_MAP.get(code, "rate_limited" if response.status_code == 429 else "provider_unavailable" if response.status_code >= 500 else "unknown")
            retryable = kind in {"rate_limited", "provider_unavailable"}
            if retryable and attempt < retries:
                await asyncio.sleep(0.15 * (2 ** attempt))
                continue
            raise MetaProviderError(kind, "Meta could not complete this request.", retryable=retryable, request_id=request_id)
        raise MetaProviderError("unknown", "Meta could not complete this request.")

    async def exchange_code(self, code: str) -> str:
        result = await self.request("GET", "/oauth/access_token", params={
            "client_id": settings.META_APP_ID, "client_secret": settings.META_APP_SECRET,
            "redirect_uri": settings.META_OAUTH_REDIRECT_URI, "code": code,
        })
        token = result.data.get("access_token")
        if not isinstance(token, str) or not token:
            raise MetaProviderError("authorization_required", "Meta did not return a usable authorization.")
        return token

    async def list_pages(self, user_token: str) -> list[dict]:
        value = await self.request("GET", "/me/accounts", access_token=user_token, params={"fields": "id,name,access_token,tasks"})
        return [item for item in value.data.get("data", []) if isinstance(item, dict)]

    async def granted_permissions(self, user_token: str) -> set[str]:
        value = await self.request("GET", "/me/permissions", access_token=user_token)
        return {str(item.get("permission")) for item in value.data.get("data", []) if isinstance(item, dict) and item.get("status") == "granted"}

    async def page_permissions(self, page_id: str, page_token: str) -> set[str]:
        value = await self.request("GET", f"/{page_id}", access_token=page_token, params={"fields": "id,name"})
        if str(value.data.get("id")) != page_id:
            raise MetaProviderError("permission_denied", "The selected Page is not accessible.")
        # /me/accounts tasks plus successfully querying the Page are checked by
        # the connection service. These are the application permissions needed.
        return {"pages_messaging", "pages_manage_metadata"}

    async def subscribe_page(self, page_id: str, page_token: str) -> None:
        await self.request("POST", f"/{page_id}/subscribed_apps", access_token=page_token, params={"subscribed_fields": "messages,messaging_postbacks,message_deliveries,message_reads"})

    async def unsubscribe_page(self, page_id: str, page_token: str) -> None:
        await self.request("DELETE", f"/{page_id}/subscribed_apps", access_token=page_token)

    async def send_facebook_text(self, page_id: str, recipient_id: str, text: str, page_token: str) -> str:
        value = await self.request("POST", f"/{page_id}/messages", access_token=page_token, json={"recipient": {"id": recipient_id}, "messaging_type": "RESPONSE", "message": {"text": text}})
        return str(value.data.get("message_id") or "")

    async def verify_whatsapp_assets(self, *, waba_id: str, phone_number_id: str, access_token: str) -> tuple[dict, dict]:
        waba = (await self.request("GET", f"/{waba_id}", access_token=access_token, params={"fields": "id,name"})).data
        phone = (await self.request("GET", f"/{phone_number_id}", access_token=access_token, params={"fields": "id,display_phone_number,verified_name,quality_rating"})).data
        numbers = (await self.request("GET", f"/{waba_id}/phone_numbers", access_token=access_token, params={"fields": "id", "limit": 250})).data.get("data", [])
        if str(waba.get("id")) != waba_id or str(phone.get("id")) != phone_number_id or phone_number_id not in {str(item.get("id")) for item in numbers if isinstance(item, dict)}:
            raise MetaProviderError("permission_denied", "The WhatsApp assets could not be verified.")
        return waba, phone

    async def subscribe_waba(self, waba_id: str, access_token: str) -> None:
        await self.request("POST", f"/{waba_id}/subscribed_apps", access_token=access_token)

    async def register_phone(self, phone_number_id: str, access_token: str, pin: str) -> None:
        await self.request("POST", f"/{phone_number_id}/register", access_token=access_token, json={"messaging_product": "whatsapp", "pin": pin})

    async def send_whatsapp_text(self, phone_number_id: str, recipient: str, text: str, access_token: str) -> str:
        value = await self.request("POST", f"/{phone_number_id}/messages", access_token=access_token, json={"messaging_product": "whatsapp", "recipient_type": "individual", "to": recipient, "type": "text", "text": {"preview_url": True, "body": text}})
        messages = value.data.get("messages") or []
        return str(messages[0].get("id") if messages else "")

    async def list_whatsapp_templates(self, waba_id: str, access_token: str) -> list[dict]:
        value = await self.request("GET", f"/{waba_id}/message_templates", access_token=access_token, params={"fields": "id,name,language,status,category,components", "limit": 250})
        return [item for item in value.data.get("data", []) if isinstance(item, dict)]

    async def send_whatsapp_template(self, phone_number_id: str, recipient: str, name: str, language: str, components: list[dict], access_token: str) -> str:
        value = await self.request("POST", f"/{phone_number_id}/messages", access_token=access_token, json={"messaging_product": "whatsapp", "to": recipient, "type": "template", "template": {"name": name, "language": {"code": language}, "components": components}})
        messages = value.data.get("messages") or []
        return str(messages[0].get("id") if messages else "")


class TestMetaGraphClient(MetaGraphClient):
    """Deterministic contract adapter, forbidden by the factory in production."""
    def __init__(self) -> None:
        super().__init__()
        self.calls: list[tuple[str, str]] = []
        self.pages = [{"id": "page-test-1", "name": "Amar Test Page", "access_token": "page-test-token", "tasks": ["MODERATE", "MESSAGING"]}]
        self.templates = [
            {"id": "tpl-approved", "name": "order_update", "language": "en_US", "status": "APPROVED", "category": "UTILITY", "components": [{"type": "BODY", "text": "Hello {{1}}, order {{2}} is ready."}]},
            {"id": "tpl-rejected", "name": "bad_offer", "language": "en_US", "status": "REJECTED", "category": "MARKETING", "components": []},
        ]

    @property
    def configured(self) -> bool: return True
    def authorization_url(self, state: str) -> str: return f"https://facebook.test/oauth?state={state}"
    async def exchange_code(self, code: str) -> str:
        if code == "invalid": raise MetaProviderError("authorization_required", "Authorization failed.")
        return "test-user-token"
    async def list_pages(self, user_token: str) -> list[dict]: return self.pages
    async def granted_permissions(self, user_token: str) -> set[str]: return {"pages_show_list", "pages_messaging", "pages_manage_metadata"}
    async def page_permissions(self, page_id: str, page_token: str) -> set[str]: return {"pages_messaging", "pages_manage_metadata"}
    async def subscribe_page(self, page_id: str, page_token: str) -> None: self.calls.append(("subscribe_page", page_id))
    async def unsubscribe_page(self, page_id: str, page_token: str) -> None: self.calls.append(("unsubscribe_page", page_id))
    async def send_facebook_text(self, page_id: str, recipient_id: str, text: str, page_token: str) -> str:
        self.calls.append(("facebook_send", recipient_id)); return f"fb-out:{len(self.calls)}"
    async def verify_whatsapp_assets(self, *, waba_id: str, phone_number_id: str, access_token: str) -> tuple[dict, dict]:
        return {"id": waba_id, "name": "Amar Test WABA"}, {"id": phone_number_id, "display_phone_number": "+8801700000000", "verified_name": "Amar Test"}
    async def subscribe_waba(self, waba_id: str, access_token: str) -> None: self.calls.append(("subscribe_waba", waba_id))
    async def register_phone(self, phone_number_id: str, access_token: str, pin: str) -> None: self.calls.append(("register_phone", phone_number_id))
    async def send_whatsapp_text(self, phone_number_id: str, recipient: str, text: str, access_token: str) -> str:
        self.calls.append(("whatsapp_send", recipient)); return f"wamid.out:{len(self.calls)}"
    async def list_whatsapp_templates(self, waba_id: str, access_token: str) -> list[dict]: return self.templates
    async def send_whatsapp_template(self, phone_number_id: str, recipient: str, name: str, language: str, components: list[dict], access_token: str) -> str:
        self.calls.append(("template_send", name)); return f"wamid.template:{recipient}:{len(self.calls)}"


_test_meta_client = TestMetaGraphClient()


def get_meta_graph_client() -> MetaGraphClient:
    if settings.APP_ENV == "test":
        return _test_meta_client
    return MetaGraphClient()
