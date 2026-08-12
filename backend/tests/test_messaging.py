import asyncio
from datetime import datetime, timezone
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.core.database import AsyncSessionLocal, engine
from app.core.tenant import tenant_scope
from app.main import app
from app.models.customer import Customer
from app.models.commercial import StorePlanAssignment
from app.models.messaging import Conversation, ConversationMessage, ConversationNote, ConversationReadState, MessagingChannel
from app.models.tenant import Store
from app.services.messaging_provider import InboundMessage, TestMessagingProvider as MessagingTestProvider, configured_messaging_provider
from app.services.messaging_credentials import MessagingCredentialVault
from app.services.messaging_service import ingest_inbound
from tests.test_merchant_onboarding import _cleanup, _find_test_identities, _payload


def test_unified_inbox_ingestion_reply_notes_commerce_and_isolation() -> None:
    suffix = uuid.uuid4().hex[:10]
    slug_a = f"inbox-a-{suffix}"
    slug_b = f"inbox-b-{suffix}"
    try:
        with TestClient(app) as client:
            signup_a = client.post("/api/v1/onboarding/signup", json=_payload(suffix, email_prefix="inbox-a", slug=slug_a))
            signup_b = client.post("/api/v1/onboarding/signup", json=_payload(suffix, email_prefix="inbox-b", slug=slug_b))
            assert signup_a.status_code == signup_b.status_code == 201
            verify_a = client.post("/api/v1/onboarding/verify-email", json={"token": signup_a.json()["verification_token"]}).json()
            verify_b = client.post("/api/v1/onboarding/verify-email", json={"token": signup_b.json()["verification_token"]}).json()
            headers_a = {"Authorization": f"Bearer {verify_a['access_token']}", "X-Amar-Store": slug_a}
            headers_b = {"Authorization": f"Bearer {verify_b['access_token']}", "X-Amar-Store": slug_b}

            channels_a = client.get("/api/v1/admin/inbox/channels", headers=headers_a)
            channels_b = client.get("/api/v1/admin/inbox/channels", headers=headers_b)
            assert channels_a.status_code == channels_b.status_code == 200
            channel_a_id = uuid.UUID(channels_a.json()[0]["id"])

            customer_a = client.post("/api/v1/customers", headers=headers_a, json={"name": "Inbox Customer A", "phone": f"017{suffix[:8]}"})
            customer_b = client.post("/api/v1/customers", headers=headers_b, json={"name": "Inbox Customer B", "phone": f"018{suffix[:8]}"})
            assert customer_a.status_code == customer_b.status_code == 201

            async def inbound_twice() -> tuple[uuid.UUID, uuid.UUID]:
                async with AsyncSessionLocal() as db:
                    store = await db.scalar(select(Store).where(Store.slug == slug_a).execution_options(include_all_stores=True))
                    channel = await db.scalar(select(MessagingChannel).where(MessagingChannel.id == channel_a_id).execution_options(include_all_stores=True))
                    assert store is not None and channel is not None
                    value = InboundMessage(
                        external_account_ref=channel.external_account_ref or "",
                        external_conversation_ref=f"thread:{suffix}", external_user_ref=f"visitor:{suffix}",
                        provider_message_ref=f"inbound:{suffix}:1", text="Do you have the black shirt?",
                        sent_at=datetime.now(timezone.utc), display_name="Visitor A", phone=f"017{suffix[:8]}",
                    )
                    with tenant_scope(store_id=store.id, organization_id=store.organization_id):
                        vault = MessagingCredentialVault(db)
                        secret = await vault.store(channel, {"access_token": f"private-{suffix}"})
                        assert f"private-{suffix}" not in secret.credentials_encrypted
                        assert await vault.load_for_provider(channel) == {"access_token": f"private-{suffix}"}
                        conversation, message, created = await ingest_inbound(db, channel=channel, value=value)
                        assert created is True
                        duplicate_conversation, duplicate_message, duplicate_created = await ingest_inbound(db, channel=channel, value=value)
                        assert duplicate_created is False and duplicate_message.id == message.id and duplicate_conversation.id == conversation.id
                        await db.commit()
                        return conversation.id, message.id

            conversation_id, inbound_message_id = asyncio.run(inbound_twice())
            asyncio.run(engine.dispose())
            masked_channel = client.get("/api/v1/admin/inbox/channels", headers=headers_a).json()[0]
            assert masked_channel["credentials_configured"] is True
            assert "access_token" not in masked_channel and f"private-{suffix}" not in str(masked_channel)

            listed = client.get("/api/v1/admin/inbox/conversations?view=all", headers=headers_a)
            assert listed.status_code == 200, listed.text
            assert listed.json()["total"] == 1
            assert listed.json()["items"][0]["unread"] is True
            assert listed.json()["items"][0]["last_message_preview"] == "Do you have the black shirt?"
            assert client.get(f"/api/v1/admin/inbox/conversations/{conversation_id}", headers=headers_b).status_code == 404
            assert client.post(f"/api/v1/admin/inbox/conversations/{conversation_id}/messages", headers=headers_b, json={"text": "attack", "idempotency_key": "web:cross-tenant"}).status_code == 404

            marked = client.post(f"/api/v1/admin/inbox/conversations/{conversation_id}/read", headers=headers_a)
            assert marked.status_code == 204
            reply = client.post(
                f"/api/v1/admin/inbox/conversations/{conversation_id}/messages", headers=headers_a,
                json={"text": "Yes, it is available.", "idempotency_key": f"web:{suffix}:reply"},
            )
            assert reply.status_code == 200, reply.text
            assert reply.json()["status"] == "sent" and reply.json()["direction"] == "outbound"
            duplicate_reply = client.post(
                f"/api/v1/admin/inbox/conversations/{conversation_id}/messages", headers=headers_a,
                json={"text": "changed text must not duplicate", "idempotency_key": f"web:{suffix}:reply"},
            )
            assert duplicate_reply.status_code == 200 and duplicate_reply.json()["id"] == reply.json()["id"]

            test_provider = configured_messaging_provider("test")
            assert isinstance(test_provider, MessagingTestProvider)
            test_provider.fail_sends = True
            failed = client.post(
                f"/api/v1/admin/inbox/conversations/{conversation_id}/messages", headers=headers_a,
                json={"text": "This send will retry.", "idempotency_key": f"web:{suffix}:failed"},
            )
            assert failed.status_code == 200 and failed.json()["status"] == "failed"
            test_provider.fail_sends = False
            retried = client.post(
                f"/api/v1/admin/inbox/conversations/{conversation_id}/messages/{failed.json()['id']}/retry", headers=headers_a,
            )
            assert retried.status_code == 200 and retried.json()["status"] == "sent" and retried.json()["id"] == failed.json()["id"]

            note = client.post(f"/api/v1/admin/inbox/conversations/{conversation_id}/notes", headers=headers_a, json={"content": "VIP prospect; follow up tomorrow."})
            assert note.status_code == 200
            thread = client.get(f"/api/v1/admin/inbox/conversations/{conversation_id}/messages", headers=headers_a)
            assert thread.status_code == 200 and len(thread.json()["items"]) == 3 and len(thread.json()["notes"]) == 1

            wrong_link = client.post(
                f"/api/v1/admin/inbox/conversations/{conversation_id}/link-customer", headers=headers_a,
                json={"customer_id": customer_b.json()["id"]},
            )
            assert wrong_link.status_code == 404
            good_link = client.post(
                f"/api/v1/admin/inbox/conversations/{conversation_id}/link-customer", headers=headers_a,
                json={"customer_id": customer_a.json()["id"]},
            )
            assert good_link.status_code == 204
            commerce = client.get(f"/api/v1/admin/inbox/conversations/{conversation_id}/commerce-context", headers=headers_a)
            assert commerce.status_code == 200 and commerce.json()["customer"]["id"] == customer_a.json()["id"]

            assert client.post(f"/api/v1/admin/inbox/conversations/{conversation_id}/resolve", headers=headers_a).status_code == 204

            async def reopen_and_assert_integrity() -> None:
                async with AsyncSessionLocal() as db:
                    store = await db.scalar(select(Store).where(Store.slug == slug_a).execution_options(include_all_stores=True))
                    channel = await db.scalar(select(MessagingChannel).where(MessagingChannel.id == channel_a_id).execution_options(include_all_stores=True))
                    assert store is not None and channel is not None
                    with tenant_scope(store_id=store.id, organization_id=store.organization_id):
                        conversation, _, _ = await ingest_inbound(db, channel=channel, value=InboundMessage(
                            external_account_ref=channel.external_account_ref or "", external_conversation_ref=f"thread:{suffix}",
                            external_user_ref=f"visitor:{suffix}", provider_message_ref=f"inbound:{suffix}:2",
                            text="Thank you", sent_at=datetime.now(timezone.utc), display_name="Visitor A",
                        ))
                        assert conversation.status == "open"
                        assert await db.scalar(select(func.count()).select_from(ConversationMessage).where(ConversationMessage.provider_message_ref == f"inbound:{suffix}:1")) == 1
                        assert await db.scalar(select(func.count()).select_from(ConversationNote).where(ConversationNote.conversation_id == conversation_id)) == 1
                        assert await db.scalar(select(func.count()).select_from(ConversationReadState).where(ConversationReadState.conversation_id == conversation_id)) == 1
                        await db.commit()

            asyncio.run(reopen_and_assert_integrity())
            asyncio.run(engine.dispose())

            async def remove_inbox_entitlement() -> None:
                async with AsyncSessionLocal() as db:
                    store = await db.scalar(select(Store).where(Store.slug == slug_a).execution_options(include_all_stores=True))
                    assert store is not None
                    with tenant_scope(store_id=store.id, organization_id=store.organization_id):
                        assignment = await db.scalar(select(StorePlanAssignment).where(StorePlanAssignment.store_id == store.id))
                        assert assignment is not None
                        assignment.entitlement_snapshot = {**assignment.entitlement_snapshot, "unified_inbox": False}
                        await db.commit()

            asyncio.run(remove_inbox_entitlement())
            asyncio.run(engine.dispose())
            preserved = client.get("/api/v1/admin/inbox/conversations?view=all", headers=headers_a)
            assert preserved.status_code == 200 and preserved.json()["total"] == 1
            restricted = client.post(
                f"/api/v1/admin/inbox/conversations/{conversation_id}/messages", headers=headers_a,
                json={"text": "Must be blocked without deleting history.", "idempotency_key": f"web:{suffix}:restricted"},
            )
            assert restricted.status_code == 403 and restricted.json()["detail"]["code"] == "ENTITLEMENT_REQUIRED"
    finally:
        provider = configured_messaging_provider("test")
        assert isinstance(provider, MessagingTestProvider)
        provider.fail_sends = False
        provider.sends.clear()
        provider.read_receipts.clear()
        asyncio.run(engine.dispose())
        stores, organizations, users = asyncio.run(_find_test_identities((slug_a, slug_b)))
        if stores:
            asyncio.run(_cleanup(stores, organizations, users))
        asyncio.run(engine.dispose())
