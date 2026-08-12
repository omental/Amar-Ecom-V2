from __future__ import annotations

import hashlib
import hmac
import json
from urllib.parse import quote
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user, get_entitlement_context, get_tenant_context, require_permission, require_platform_admin
from app.core.config import settings
from app.core.crypto import decrypt_secret
from app.core.tenant import TenantContext
from app.models.messaging import MessagingChannel, MessagingProviderEvent, MessagingTemplate
from app.models.user import User
from app.schemas.messaging import FacebookPageConnectInput, MetaConfigurationRead, MetaOAuthCallbackRead, MetaOAuthStartRead, TemplateRead, TemplateSendInput, WhatsAppConnectInput
from app.services.commercial_access_service import EntitlementService
from app.services.messaging_service import get_conversation
from app.services.meta_channel_service import MetaChannelHealthService, authorize_facebook_callback, connect_facebook_page, connect_whatsapp, create_facebook_oauth_state, disconnect_meta_channel, meta_configuration, send_whatsapp_template, sync_whatsapp_templates
from app.services.meta_graph import get_meta_graph_client
from app.services.meta_webhook_service import process_meta_payload, replay_meta_event
from app.services.ai_agent import execute_queued_ai_background


router = APIRouter()
webhook_router = APIRouter()
platform_router = APIRouter()
TenantDep = Annotated[TenantContext, Depends(get_tenant_context)]
ChannelManager = Annotated[User, Depends(require_permission("inbox", "channels"))]
CurrentUser = Annotated[User, Depends(get_current_user)]


def safe_channel(channel: MessagingChannel) -> dict:
    metadata = channel.configuration_metadata or {}
    return {"id": str(channel.id), "channel_type": channel.channel_type, "name": channel.name, "status": channel.status, "provider": channel.provider, "capabilities": channel.capabilities or {}, "metadata": {key: metadata.get(key) for key in ("page_name", "webhook_subscription", "health", "waba_name", "display_phone_number", "verified_name", "registration", "template_sync_status", "templates_last_synced_at") if metadata.get(key) is not None}}


@router.get("/meta/configuration", response_model=MetaConfigurationRead)
async def configuration(_tenant: TenantDep, _manager: ChannelManager):
    return meta_configuration()


@router.post("/meta/facebook/oauth/start", response_model=MetaOAuthStartRead)
async def facebook_start(db: DBSession, tenant: TenantDep, actor: ChannelManager, access: Annotated[EntitlementService, Depends(get_entitlement_context)]):
    await access.require_feature("facebook_messaging")
    raw, state_row = await create_facebook_oauth_state(db, store=tenant.store, user=actor)
    await db.commit()
    return MetaOAuthStartRead(authorization_url=get_meta_graph_client().authorization_url(raw), expires_at=state_row.expires_at)


@webhook_router.get("/oauth/callback", response_model=MetaOAuthCallbackRead)
async def facebook_callback(request: Request, db: DBSession, state: str = Query(min_length=20, max_length=500), code: str = Query(min_length=1, max_length=2048)):
    row, pages = await authorize_facebook_callback(db, state_value=state, code=code)
    await db.commit()
    if "text/html" in request.headers.get("accept", ""):
        return RedirectResponse(f"{settings.FRONTEND_URL.rstrip('/')}/dashboard/inbox/channels?facebook_flow={quote(str(row.id))}", status_code=303)
    return MetaOAuthCallbackRead(flow_id=row.id, pages=pages)


@router.get("/meta/facebook/oauth/{flow_id}/pages")
async def facebook_pages(flow_id: UUID, db: DBSession, tenant: TenantDep, actor: ChannelManager):
    from app.models.messaging import MessagingOAuthState
    flow = await db.scalar(select(MessagingOAuthState).where(MessagingOAuthState.id == flow_id, MessagingOAuthState.store_id == tenant.store.id, MessagingOAuthState.user_id == actor.id))
    if flow is None or flow.status != "authorized": raise HTTPException(status_code=404, detail="Facebook authorization not found")
    payload = json.loads(decrypt_secret(flow.encrypted_payload or "{}"))
    return [{"id": str(page.get("id")), "name": str(page.get("name") or "Facebook Page")} for page in payload.get("pages", []) if page.get("id")]


@router.post("/meta/facebook/connect")
async def facebook_connect(payload: FacebookPageConnectInput, db: DBSession, tenant: TenantDep, actor: ChannelManager, access: Annotated[EntitlementService, Depends(get_entitlement_context)]):
    await access.require_feature("facebook_messaging")
    channel = await connect_facebook_page(db, store=tenant.store, user=actor, flow_id=payload.flow_id, page_id=payload.page_id)
    await db.commit(); return safe_channel(channel)


@router.post("/meta/whatsapp/connect")
async def whatsapp_connect(payload: WhatsAppConnectInput, db: DBSession, tenant: TenantDep, actor: ChannelManager, access: Annotated[EntitlementService, Depends(get_entitlement_context)]):
    await access.require_feature("whatsapp_messaging")
    channel = await connect_whatsapp(db, store=tenant.store, user=actor, code=payload.code, waba_id=payload.waba_id, phone_number_id=payload.phone_number_id, registration_pin=payload.registration_pin)
    await db.commit(); return safe_channel(channel)


async def owned_channel(db, store_id: UUID, channel_id: UUID) -> MessagingChannel:
    row = await db.scalar(select(MessagingChannel).where(MessagingChannel.id == channel_id, MessagingChannel.store_id == store_id))
    if row is None: raise HTTPException(status_code=404, detail="Channel not found")
    return row


@router.post("/meta/channels/{channel_id}/disconnect", status_code=204)
async def disconnect(channel_id: UUID, db: DBSession, tenant: TenantDep, actor: ChannelManager):
    channel = await owned_channel(db, tenant.store.id, channel_id)
    await disconnect_meta_channel(db, channel=channel, actor=actor); await db.commit()


@router.get("/meta/channels/{channel_id}/health")
async def health(channel_id: UUID, db: DBSession, tenant: TenantDep, _actor: ChannelManager):
    channel = await owned_channel(db, tenant.store.id, channel_id)
    result = await MetaChannelHealthService(db).check(channel); await db.commit(); return result


@router.post("/meta/channels/{channel_id}/templates/sync", response_model=list[TemplateRead])
async def template_sync(channel_id: UUID, db: DBSession, tenant: TenantDep, actor: ChannelManager, access: Annotated[EntitlementService, Depends(get_entitlement_context)]):
    await access.require_feature("whatsapp_messaging")
    channel = await owned_channel(db, tenant.store.id, channel_id)
    rows = await sync_whatsapp_templates(db, channel=channel)
    from app.models.access_control import ActivityLog
    db.add(ActivityLog(organization_id=tenant.organization.id, user_id=actor.id, action="template_sync_completed", module="inbox", entity_type="messaging_channel", entity_id=str(channel.id), message="WhatsApp templates synchronized."))
    await db.commit(); return rows


@router.get("/meta/channels/{channel_id}/templates", response_model=list[TemplateRead])
async def templates(channel_id: UUID, db: DBSession, tenant: TenantDep, _actor: Annotated[User, Depends(require_permission("inbox", "reply"))]):
    await owned_channel(db, tenant.store.id, channel_id)
    return list((await db.execute(select(MessagingTemplate).where(MessagingTemplate.channel_id == channel_id).order_by(MessagingTemplate.name))).scalars().all())


@router.post("/conversations/{conversation_id}/template", response_model=dict)
async def template_send(conversation_id: UUID, payload: TemplateSendInput, db: DBSession, tenant: TenantDep, actor: Annotated[User, Depends(require_permission("inbox", "reply"))], access: Annotated[EntitlementService, Depends(get_entitlement_context)]):
    await access.require_feature("whatsapp_messaging")
    conversation = await get_conversation(db, tenant.store.id, conversation_id)
    template = await db.scalar(select(MessagingTemplate).where(MessagingTemplate.id == payload.template_id, MessagingTemplate.store_id == tenant.store.id))
    if template is None: raise HTTPException(status_code=404, detail="Template not found")
    message = await send_whatsapp_template(db, conversation=conversation, template=template, variables=payload.variables, actor=actor, idempotency_key=payload.idempotency_key)
    await db.commit(); return {"id": str(message.id), "status": message.status, "provider_message_ref": message.provider_message_ref}


@webhook_router.get("")
async def verify_webhook(request: Request):
    query = request.query_params
    if query.get("hub.mode") == "subscribe" and settings.META_WEBHOOK_VERIFY_TOKEN and hmac.compare_digest(query.get("hub.verify_token", ""), settings.META_WEBHOOK_VERIFY_TOKEN):
        return Response(content=query.get("hub.challenge", ""), media_type="text/plain")
    raise HTTPException(status_code=403, detail="Webhook verification failed")


@webhook_router.post("")
async def meta_webhook(request: Request, background_tasks: BackgroundTasks, db: DBSession):
    raw = await request.body()
    if len(raw) > settings.META_WEBHOOK_MAX_BYTES: raise HTTPException(status_code=413, detail="Webhook payload too large")
    signature = request.headers.get("x-hub-signature-256", "")
    if not settings.META_APP_SECRET or not signature.startswith("sha256="):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    expected = hmac.new(settings.META_APP_SECRET.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature[7:], expected): raise HTTPException(status_code=401, detail="Invalid webhook signature")
    try: payload = json.loads(raw)
    except (ValueError, UnicodeDecodeError): raise HTTPException(status_code=400, detail="Invalid webhook payload")
    _processed, queued_ai = await process_meta_payload(db, payload if isinstance(payload, dict) else {}); await db.commit()
    for execution_id in queued_ai:
        background_tasks.add_task(execute_queued_ai_background, execution_id)
    return {"received": True}


@platform_router.get("/events", dependencies=[Depends(require_platform_admin)])
async def events(db: DBSession):
    rows = list((await db.execute(select(MessagingProviderEvent).order_by(MessagingProviderEvent.received_at.desc()).limit(200).execution_options(include_all_stores=True))).scalars().all())
    return [{"id": str(row.id), "provider": row.provider, "event_type": row.event_type, "status": row.processing_status, "received_at": row.received_at} for row in rows]


@platform_router.post("/events/{event_id}/replay", dependencies=[Depends(require_platform_admin)])
async def replay(event_id: UUID, db: DBSession):
    event = await db.scalar(select(MessagingProviderEvent).where(MessagingProviderEvent.id == event_id).execution_options(include_all_stores=True))
    if event is None: raise HTTPException(status_code=404, detail="Event not found")
    await replay_meta_event(db, event); await db.commit(); return {"status": event.processing_status}
