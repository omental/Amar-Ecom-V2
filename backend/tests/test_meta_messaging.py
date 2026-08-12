import asyncio
import hashlib
import hmac
import json
from urllib.parse import parse_qs, urlparse
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine
from app.core.tenant import tenant_scope
from app.main import app
from app.models.commercial import StorePlanAssignment
from app.models.messaging import ConversationMessage, MessagingChannel, MessagingProviderEvent
from app.models.tenant import Store
from tests.test_merchant_onboarding import _cleanup, _find_test_identities, _payload


def _signature(body: bytes) -> str:
    return "sha256=" + hmac.new((settings.META_APP_SECRET or "").encode(), body, hashlib.sha256).hexdigest()


def test_meta_connections_signed_webhooks_windows_templates_and_isolation() -> None:
    suffix = uuid.uuid4().hex[:10]
    slug_a, slug_b = f"meta-a-{suffix}", f"meta-b-{suffix}"
    original = (settings.META_APP_ID, settings.META_APP_SECRET, settings.META_OAUTH_REDIRECT_URI, settings.META_WEBHOOK_VERIFY_TOKEN, settings.META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID)
    settings.META_APP_ID = "test-app"; settings.META_APP_SECRET = "test-secret"; settings.META_OAUTH_REDIRECT_URI = "https://amar.test/api/v1/webhooks/meta/oauth/callback"; settings.META_WEBHOOK_VERIFY_TOKEN = "verify-test"; settings.META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID = "embedded-test"
    try:
        with TestClient(app) as client:
            signups = [client.post("/api/v1/onboarding/signup", json=_payload(suffix, email_prefix=f"meta-{key}", slug=slug)) for key, slug in (("a", slug_a), ("b", slug_b))]
            verified = [client.post("/api/v1/onboarding/verify-email", json={"token": item.json()["verification_token"]}).json() for item in signups]
            headers_a = {"Authorization": f"Bearer {verified[0]['access_token']}", "X-Amar-Store": slug_a}
            headers_b = {"Authorization": f"Bearer {verified[1]['access_token']}", "X-Amar-Store": slug_b}

            async def grant() -> None:
                async with AsyncSessionLocal() as db:
                    stores = list((await db.execute(select(Store).where(Store.slug.in_((slug_a, slug_b))).execution_options(include_all_stores=True))).scalars())
                    for store in stores:
                        with tenant_scope(store_id=store.id, organization_id=store.organization_id):
                            assignment = await db.scalar(select(StorePlanAssignment).where(StorePlanAssignment.store_id == store.id))
                            assignment.entitlement_snapshot = {**assignment.entitlement_snapshot, "facebook_messaging": True, "whatsapp_messaging": True}
                    await db.commit()
            asyncio.run(grant()); asyncio.run(engine.dispose())

            configured = client.get("/api/v1/admin/inbox/meta/configuration", headers=headers_a)
            assert configured.status_code == 200 and configured.json()["facebook_configured"] and configured.json()["whatsapp_configured"]
            started = client.post("/api/v1/admin/inbox/meta/facebook/oauth/start", headers=headers_a)
            assert started.status_code == 200, started.text
            state = parse_qs(urlparse(started.json()["authorization_url"]).query)["state"][0]
            callback = client.get("/api/v1/webhooks/meta/oauth/callback", params={"state": state, "code": "valid"}, headers={"Accept": "application/json"})
            assert callback.status_code == 200 and callback.json()["pages"][0]["id"] == "page-test-1"
            assert client.get("/api/v1/webhooks/meta/oauth/callback", params={"state": state, "code": "valid"}, headers={"Accept": "application/json"}).status_code == 400
            facebook = client.post("/api/v1/admin/inbox/meta/facebook/connect", headers=headers_a, json={"flow_id": callback.json()["flow_id"], "page_id": "page-test-1"})
            assert facebook.status_code == 200 and facebook.json()["status"] == "connected"
            assert client.post("/api/v1/admin/inbox/meta/facebook/connect", headers=headers_b, json={"flow_id": callback.json()["flow_id"], "page_id": "page-test-1"}).status_code in {400, 404}

            whatsapp = client.post("/api/v1/admin/inbox/meta/whatsapp/connect", headers=headers_a, json={"code": "valid", "waba_id": "waba-test-1", "phone_number_id": "phone-test-1", "registration_pin": "123456"})
            assert whatsapp.status_code == 200 and whatsapp.json()["status"] == "connected"
            whatsapp_id = whatsapp.json()["id"]
            assert client.post("/api/v1/admin/inbox/meta/whatsapp/connect", headers=headers_b, json={"code": "valid", "waba_id": "waba-test-1", "phone_number_id": "phone-test-1"}).status_code == 409

            assert client.get("/api/v1/webhooks/meta", params={"hub.mode": "subscribe", "hub.verify_token": "verify-test", "hub.challenge": "abc123"}).text == "abc123"
            facebook_message_ref = f"m-fb-{suffix}"
            whatsapp_message_ref = f"wamid.in.{suffix}"
            fb_payload = {"object": "page", "entry": [{"id": "page-test-1", "messaging": [{"sender": {"id": f"psid-{suffix}"}, "recipient": {"id": "page-test-1"}, "timestamp": 1786500000000, "message": {"mid": facebook_message_ref, "text": "Do you have XL?", "store_id": str(uuid.uuid4())}}]}]}
            raw = json.dumps(fb_payload, separators=(",", ":")).encode()
            invalid = client.post("/api/v1/webhooks/meta", content=raw, headers={"content-type": "application/json", "x-hub-signature-256": "sha256=bad"})
            assert invalid.status_code == 401
            assert client.post("/api/v1/webhooks/meta", content=raw, headers={"content-type": "application/json", "x-hub-signature-256": _signature(raw)}).status_code == 200
            assert client.post("/api/v1/webhooks/meta", content=raw, headers={"content-type": "application/json", "x-hub-signature-256": _signature(raw)}).status_code == 200

            wa_payload = {"object": "whatsapp_business_account", "entry": [{"id": "waba-test-1", "changes": [{"field": "messages", "value": {"metadata": {"phone_number_id": "phone-test-1"}, "contacts": [{"wa_id": f"88017{suffix[:8]}", "profile": {"name": "Asha"}}], "messages": [{"from": f"88017{suffix[:8]}", "id": whatsapp_message_ref, "timestamp": "1786500000", "type": "text", "text": {"body": "Is XL available?"}}]}}]}]}
            wa_raw = json.dumps(wa_payload, separators=(",", ":")).encode()
            assert client.post("/api/v1/webhooks/meta", content=wa_raw, headers={"content-type": "application/json", "x-hub-signature-256": _signature(wa_raw)}).status_code == 200
            listed = client.get("/api/v1/admin/inbox/conversations?view=all", headers=headers_a).json()
            assert listed["total"] == 2
            wa_conversation = next(item for item in listed["items"] if item["channel"]["channel_type"] == "whatsapp")
            assert wa_conversation["send_eligibility"]["can_send_freeform"] is True
            assert client.get(f"/api/v1/admin/inbox/conversations/{wa_conversation['id']}", headers=headers_b).status_code == 404

            synced = client.post(f"/api/v1/admin/inbox/meta/channels/{whatsapp_id}/templates/sync", headers=headers_a)
            assert synced.status_code == 200 and {item["status"] for item in synced.json()} == {"approved", "rejected"}
            approved = next(item for item in synced.json() if item["status"] == "approved")
            rejected = next(item for item in synced.json() if item["status"] == "rejected")
            sent = client.post(f"/api/v1/admin/inbox/conversations/{wa_conversation['id']}/template", headers=headers_a, json={"template_id": approved["id"], "variables": ["Asha", "#A100"], "idempotency_key": f"tpl:{suffix}"})
            assert sent.status_code == 200 and sent.json()["status"] == "sent"
            assert client.post(f"/api/v1/admin/inbox/conversations/{wa_conversation['id']}/template", headers=headers_a, json={"template_id": rejected["id"], "variables": [], "idempotency_key": f"tpl:{suffix}:bad"}).status_code == 409

            message_ref = sent.json()["provider_message_ref"]
            for value, timestamp in (("read", "1786500300"), ("sent", "1786500100"), ("delivered", "1786500200")):
                status_payload = {"entry": [{"changes": [{"value": {"metadata": {"phone_number_id": "phone-test-1"}, "statuses": [{"id": message_ref, "status": value, "timestamp": timestamp}]}}]}]}
                status_raw = json.dumps(status_payload, separators=(",", ":")).encode()
                assert client.post("/api/v1/webhooks/meta", content=status_raw, headers={"content-type": "application/json", "x-hub-signature-256": _signature(status_raw)}).status_code == 200
            assert client.post(f"/api/v1/admin/inbox/meta/channels/{whatsapp_id}/disconnect", headers=headers_a).status_code == 204
            assert client.get("/api/v1/admin/inbox/conversations?view=all", headers=headers_a).json()["total"] == 2

            unknown = {"entry": [{"id": "unknown-page", "messaging": [{"sender": {"id": "x"}, "message": {"mid": "unknown-mid", "text": "spoof", "store_id": str(verified[0].get("store_id", ""))}}]}]}
            unknown_raw = json.dumps(unknown, separators=(",", ":")).encode()
            assert client.post("/api/v1/webhooks/meta", content=unknown_raw, headers={"content-type": "application/json", "x-hub-signature-256": _signature(unknown_raw)}).status_code == 200

            async def assertions() -> None:
                async with AsyncSessionLocal() as db:
                    assert await db.scalar(select(func.count()).select_from(ConversationMessage).where(ConversationMessage.provider_message_ref == facebook_message_ref)) == 1
                    output = await db.scalar(select(ConversationMessage).where(ConversationMessage.provider_message_ref == message_ref).execution_options(include_all_stores=True))
                    assert output is not None and output.status == "read"
                    ignored = await db.scalar(select(MessagingProviderEvent).where(MessagingProviderEvent.external_asset_ref == "facebook:unknown-page").execution_options(include_all_stores=True))
                    assert ignored is not None and ignored.store_id is None and ignored.processing_status == "ignored"
                    channel = await db.scalar(select(MessagingChannel).where(MessagingChannel.id == uuid.UUID(whatsapp_id)).execution_options(include_all_stores=True))
                    assert channel is not None and channel.status == "disconnected"
            asyncio.run(assertions())
    finally:
        (settings.META_APP_ID, settings.META_APP_SECRET, settings.META_OAUTH_REDIRECT_URI, settings.META_WEBHOOK_VERIFY_TOKEN, settings.META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID) = original
        asyncio.run(engine.dispose())
        stores, organizations, users = asyncio.run(_find_test_identities((slug_a, slug_b)))
        if stores: asyncio.run(_cleanup(stores, organizations, users))
        asyncio.run(engine.dispose())
