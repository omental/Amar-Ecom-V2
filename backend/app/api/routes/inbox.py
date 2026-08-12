from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DBSession, get_current_user, get_entitlement_context, get_tenant_context, require_entitlement, require_permission, require_platform_admin
from app.core.config import settings
from app.core.tenant import TenantContext, tenant_scope
from app.models.customer import Customer
from app.models.messaging import MessagingChannel, MessagingChannelSecret, SavedReply
from app.models.user import User
from app.schemas.messaging import (
    AddNoteInput,
    AssignInput,
    ChannelRead,
    CommerceContext,
    ConversationSummary,
    CreateCustomerInput,
    EventPollRead,
    IdentityRead,
    LinkCustomerInput,
    LinkOrderInput,
    MessageRead,
    NoteRead,
    PaginatedConversations,
    PaginatedMessages,
    PriorityInput,
    ProductContext,
    SavedReplyInput,
    SavedReplyRead,
    SendMessageInput,
    SnoozeInput,
    TagInput,
    TagRead,
    TestInboundInput,
)
from app.services.commercial_access_service import EntitlementService
from app.services.messaging_provider import InboundMessage
from app.services.messaging_service import (
    add_note,
    add_tag,
    assign_conversation,
    commerce_context,
    create_customer_from_conversation,
    ensure_test_channel,
    get_conversation,
    ingest_inbound,
    link_customer,
    link_order,
    list_assignees,
    list_conversations,
    list_messages,
    list_saved_replies,
    mark_read,
    poll_changed,
    retry_message,
    search_products,
    send_message,
    set_conversation_status,
)
from app.services.meta_messaging import provider_send_eligibility
from app.services.ai_agent import CommerceAIAgent, execute_queued_ai_background
from app.services.permission_service import user_has_permission


router = APIRouter()
platform_router = APIRouter()

TenantDep = Annotated[TenantContext, Depends(get_tenant_context)]
CurrentUser = Annotated[User, Depends(get_current_user)]
InboxViewer = Annotated[User, Depends(require_permission("inbox", "view"))]
InboxReply = Annotated[User, Depends(require_permission("inbox", "reply"))]
InboxAssign = Annotated[User, Depends(require_permission("inbox", "assign"))]
InboxManage = Annotated[User, Depends(require_permission("inbox", "manage"))]
InboxNotes = Annotated[User, Depends(require_permission("inbox", "notes"))]


def _channel_read(channel: MessagingChannel) -> ChannelRead:
    return ChannelRead(
        id=channel.id,
        channel_type=channel.channel_type,
        name=channel.name,
        status=channel.status,
        provider=channel.provider,
        capabilities={key: bool(value) for key, value in (channel.capabilities or {}).items()},
        external_account_configured=bool(channel.external_account_ref),
        credentials_configured=channel.secret is not None,
        metadata={key: channel.configuration_metadata.get(key) for key in ("page_name", "display_phone_number", "verified_name", "webhook_subscription", "health") if channel.configuration_metadata.get(key) is not None},
    )


def _conversation_read(item, previews: dict[UUID, str], unread_ids: set[UUID]) -> ConversationSummary:
    identity = None if item.identity is None else IdentityRead(
        id=item.identity.id,
        customer_id=item.identity.customer_id,
        display_name=item.identity.display_name,
        phone=item.identity.phone,
        email=item.identity.email,
        avatar_url=item.identity.avatar_url,
        status=item.identity.status,
    )
    return ConversationSummary(
        id=item.id,
        channel=_channel_read(item.channel),
        identity=identity,
        customer_id=item.customer_id,
        status=item.status,
        priority=item.priority,
        assigned_user_id=item.assigned_user_id,
        assigned_user_name=item.assigned_user.full_name if item.assigned_user else None,
        subject=item.subject,
        handling_mode=item.handling_mode,
        last_message_at=item.last_message_at,
        last_message_preview=previews.get(item.id),
        unread=item.id in unread_ids,
        tags=[TagRead(id=link.tag.id, name=link.tag.name, color=link.tag.color) for link in item.tag_links],
        send_eligibility=provider_send_eligibility(item.channel.channel_type, item.provider_reply_window_ends_at),
    )


def _message_read(item) -> MessageRead:
    return MessageRead(
        id=item.id,
        direction=item.direction,
        message_type=item.message_type,
        sender_type=item.sender_type,
        sender_user_id=item.sender_user_id,
        sender_name=item.sender_user.full_name if item.sender_user else None,
        text_content=item.text_content,
        reply_to_message_id=item.reply_to_message_id,
        status=item.status,
        failure_reason=item.failure_reason,
        sent_at=item.sent_at,
        delivered_at=item.delivered_at,
        read_at=item.read_at,
        failed_at=item.failed_at,
    )


@router.get("/channels", response_model=list[ChannelRead])
async def channels(db: DBSession, tenant: TenantDep, _viewer: InboxViewer):
    if settings.APP_ENV in {"development", "test"}:
        await ensure_test_channel(db, tenant.store)
        await db.commit()
    rows = list((await db.execute(select(MessagingChannel).where(
        MessagingChannel.store_id == tenant.store.id,
    ))).scalars().all())
    # Avoid exposing provider account references or credential material.
    for row in rows:
        secret = await db.scalar(select(MessagingChannelSecret).where(MessagingChannelSecret.channel_id == row.id))
        row.secret = secret
    return [_channel_read(row) for row in rows]


@router.get("/conversations", response_model=PaginatedConversations)
async def conversations(
    db: DBSession,
    tenant: TenantDep,
    viewer: InboxViewer,
    view: str = Query(default="all", pattern=r"^(mine|unassigned|all|resolved)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    q: str | None = Query(default=None, max_length=120),
    channel_id: UUID | None = None,
    priority: str | None = Query(default=None, pattern=r"^(normal|high|urgent)$"),
    tag_id: UUID | None = None,
    unread: bool = False,
):
    rows, total, counts, previews, unread_ids = await list_conversations(
        db, store_id=tenant.store.id, user_id=viewer.id, view=view, page=page, page_size=page_size,
        query=q, channel_id=channel_id, priority=priority, tag_id=tag_id, unread_only=unread,
    )
    return PaginatedConversations(
        items=[_conversation_read(item, previews, unread_ids) for item in rows],
        total=total, page=page, page_size=page_size, counts=counts,
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationSummary)
async def conversation_detail(conversation_id: UUID, db: DBSession, tenant: TenantDep, _viewer: InboxViewer):
    item = await get_conversation(db, tenant.store.id, conversation_id)
    _, _, _, previews, unread_ids = await list_conversations(
        db, store_id=tenant.store.id, user_id=tenant.user.id, view="all", page=1, page_size=100,
    )
    return _conversation_read(item, previews, unread_ids)


@router.get("/conversations/{conversation_id}/messages", response_model=PaginatedMessages)
async def messages(
    conversation_id: UUID, db: DBSession, tenant: TenantDep, _viewer: InboxViewer,
    page: int = Query(default=1, ge=1), page_size: int = Query(default=100, ge=1, le=200),
):
    item = await get_conversation(db, tenant.store.id, conversation_id)
    rows, notes, total = await list_messages(db, conversation_id=item.id, page=page, page_size=page_size)
    return PaginatedMessages(
        items=[_message_read(row) for row in rows],
        notes=[NoteRead(id=note.id, author_user_id=note.author_user_id, author_name=note.author.full_name, content=note.content, created_at=note.created_at) for note in notes],
        total=total, page=page, page_size=page_size,
    )


@router.post("/conversations/{conversation_id}/messages", response_model=MessageRead, dependencies=[Depends(require_entitlement("unified_inbox"))])
async def reply(conversation_id: UUID, payload: SendMessageInput, db: DBSession, tenant: TenantDep, actor: InboxReply, access: Annotated[EntitlementService, Depends(get_entitlement_context)]):
    conversation = await get_conversation(db, tenant.store.id, conversation_id)
    if conversation.channel.channel_type == "facebook_messenger":
        await access.require_feature("facebook_messaging")
    elif conversation.channel.channel_type == "whatsapp":
        await access.require_feature("whatsapp_messaging")
    message = await send_message(
        db, conversation=conversation, actor=actor, text=payload.text,
        idempotency_key=payload.idempotency_key, reply_to_message_id=payload.reply_to_message_id,
    )
    await db.commit()
    await db.refresh(message)
    return _message_read(message)


@router.post("/conversations/{conversation_id}/messages/{message_id}/retry", response_model=MessageRead, dependencies=[Depends(require_entitlement("unified_inbox"))])
async def retry(conversation_id: UUID, message_id: UUID, db: DBSession, tenant: TenantDep, actor: InboxReply):
    conversation = await get_conversation(db, tenant.store.id, conversation_id)
    message = await retry_message(db, conversation=conversation, message_id=message_id, actor=actor)
    await db.commit()
    return _message_read(message)


@router.post("/conversations/{conversation_id}/notes", response_model=NoteRead)
async def note(conversation_id: UUID, payload: AddNoteInput, db: DBSession, tenant: TenantDep, actor: InboxNotes):
    conversation = await get_conversation(db, tenant.store.id, conversation_id)
    item = await add_note(db, conversation=conversation, actor=actor, content=payload.content)
    await db.commit()
    return NoteRead(id=item.id, author_user_id=actor.id, author_name=actor.full_name, content=item.content, created_at=item.created_at)


@router.post("/conversations/{conversation_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def read(conversation_id: UUID, db: DBSession, tenant: TenantDep, viewer: InboxViewer):
    conversation = await get_conversation(db, tenant.store.id, conversation_id)
    await mark_read(db, conversation=conversation, user_id=viewer.id)
    await db.commit()


@router.post("/conversations/{conversation_id}/assign", response_model=ConversationSummary)
async def assign(conversation_id: UUID, payload: AssignInput, db: DBSession, tenant: TenantDep, actor: InboxAssign):
    conversation = await get_conversation(db, tenant.store.id, conversation_id)
    await assign_conversation(db, conversation=conversation, actor=actor, user_id=payload.user_id)
    await db.commit()
    conversation = await get_conversation(db, tenant.store.id, conversation_id)
    return _conversation_read(conversation, {}, set())


@router.post("/conversations/{conversation_id}/resolve", status_code=status.HTTP_204_NO_CONTENT)
async def resolve(conversation_id: UUID, db: DBSession, tenant: TenantDep, actor: InboxManage):
    conversation = await get_conversation(db, tenant.store.id, conversation_id)
    await set_conversation_status(db, conversation=conversation, actor=actor, value="resolved")
    await db.commit()


@router.post("/conversations/{conversation_id}/reopen", status_code=status.HTTP_204_NO_CONTENT)
async def reopen(conversation_id: UUID, db: DBSession, tenant: TenantDep, actor: InboxManage):
    conversation = await get_conversation(db, tenant.store.id, conversation_id)
    await set_conversation_status(db, conversation=conversation, actor=actor, value="open")
    await db.commit()


@router.post("/conversations/{conversation_id}/priority", status_code=status.HTTP_204_NO_CONTENT)
async def priority(conversation_id: UUID, payload: PriorityInput, db: DBSession, tenant: TenantDep, _actor: InboxManage):
    conversation = await get_conversation(db, tenant.store.id, conversation_id)
    conversation.priority = payload.priority
    await db.commit()


@router.post("/conversations/{conversation_id}/snooze", status_code=status.HTTP_204_NO_CONTENT)
async def snooze(conversation_id: UUID, payload: SnoozeInput, db: DBSession, tenant: TenantDep, _actor: InboxManage):
    conversation = await get_conversation(db, tenant.store.id, conversation_id)
    if payload.until <= datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail="Snooze time must be in the future")
    conversation.status = "snoozed"
    conversation.snoozed_until = payload.until
    await db.commit()


@router.post("/conversations/{conversation_id}/link-customer", status_code=status.HTTP_204_NO_CONTENT)
async def customer_link(conversation_id: UUID, payload: LinkCustomerInput, db: DBSession, tenant: TenantDep, actor: InboxManage):
    conversation = await get_conversation(db, tenant.store.id, conversation_id)
    await link_customer(db, conversation=conversation, actor=actor, customer_id=payload.customer_id)
    await db.commit()


@router.post("/conversations/{conversation_id}/create-customer", status_code=status.HTTP_201_CREATED)
async def customer_create(conversation_id: UUID, payload: CreateCustomerInput, db: DBSession, tenant: TenantDep, actor: InboxManage):
    if not await user_has_permission(db, actor, "customers", "create"):
        raise HTTPException(status_code=403, detail="Permission required: customers.create")
    conversation = await get_conversation(db, tenant.store.id, conversation_id)
    customer = await create_customer_from_conversation(db, conversation=conversation, actor=actor, name=payload.name, phone=payload.phone, email=payload.email)
    await db.commit()
    return {"id": customer.id, "name": customer.name, "phone": customer.phone, "email": customer.email}


@router.post("/conversations/{conversation_id}/link-order", status_code=status.HTTP_204_NO_CONTENT)
async def order_link(conversation_id: UUID, payload: LinkOrderInput, db: DBSession, tenant: TenantDep, actor: InboxManage):
    conversation = await get_conversation(db, tenant.store.id, conversation_id)
    await link_order(db, conversation=conversation, actor=actor, order_id=payload.order_id)
    await db.commit()


@router.post("/conversations/{conversation_id}/tags", response_model=TagRead)
async def tag(conversation_id: UUID, payload: TagInput, db: DBSession, tenant: TenantDep, _actor: InboxManage):
    conversation = await get_conversation(db, tenant.store.id, conversation_id)
    item = await add_tag(db, conversation=conversation, name=payload.name, color=payload.color)
    await db.commit()
    return TagRead(id=item.id, name=item.name, color=item.color)


@router.get("/conversations/{conversation_id}/commerce-context", response_model=CommerceContext)
async def context(conversation_id: UUID, db: DBSession, tenant: TenantDep, _viewer: InboxViewer):
    conversation = await get_conversation(db, tenant.store.id, conversation_id)
    value = await commerce_context(db, conversation=conversation)
    customer = value["customer"]
    def order_item(order):
        return {"id": order.id, "order_number": order.order_number, "status": order.status, "payment_status": order.payment_status, "total": order.total, "created_at": order.created_at}
    customer_item = None if customer is None else {
        "id": customer.id, "name": customer.name, "phone": customer.phone, "email": customer.email,
        "customer_type": customer.customer_type, "tags": [part.strip() for part in (customer.tags or "").split(",") if part.strip()],
        "notes": customer.notes, "order_count": value["order_count"], "lifetime_value": value["lifetime_value"],
    }
    return CommerceContext(customer=customer_item, recent_orders=[order_item(order) for order in value["recent_orders"]], linked_orders=[order_item(order) for order in value["linked_orders"]])


@router.get("/products", response_model=list[ProductContext])
async def products(q: str, db: DBSession, tenant: TenantDep, _viewer: InboxViewer):
    if not await user_has_permission(db, tenant.user, "products", "view"):
        raise HTTPException(status_code=403, detail="Permission required: products.view")
    rows = await search_products(db, store_id=tenant.store.id, query=q)
    return [ProductContext(
        id=row["product"].id, name=row["product"].name, slug=row["product"].slug, sku=row["product"].sku,
        price=row["product"].price, image_url=row["product"].image_url, stock=row["stock"], variants=row["variants"], storefront_url=row["storefront_url"],
    ) for row in rows]


@router.get("/customers")
async def customer_search(q: str, db: DBSession, tenant: TenantDep, _viewer: InboxViewer):
    pattern = f"%{q.strip()}%"
    rows = list((await db.execute(select(Customer).where(
        Customer.store_id == tenant.store.id,
        or_(Customer.name.ilike(pattern), Customer.phone.ilike(pattern), Customer.email.ilike(pattern)),
    ).order_by(Customer.name).limit(20))).scalars().all())
    return [{"id": row.id, "name": row.name, "phone": row.phone, "email": row.email} for row in rows]


@router.get("/assignees")
async def assignees(db: DBSession, tenant: TenantDep, _viewer: InboxViewer):
    return [{"id": user.id, "name": user.full_name, "email": user.email} for user in await list_assignees(db, store_id=tenant.store.id)]


@router.get("/saved-replies", response_model=list[SavedReplyRead])
async def saved_replies(db: DBSession, tenant: TenantDep, _viewer: InboxViewer, q: str | None = None):
    return await list_saved_replies(db, store_id=tenant.store.id, query=q)


@router.post("/saved-replies", response_model=SavedReplyRead, status_code=status.HTTP_201_CREATED)
async def saved_reply_create(payload: SavedReplyInput, db: DBSession, tenant: TenantDep, actor: InboxManage):
    item = SavedReply(store_id=tenant.store.id, title=payload.title.strip(), content=payload.content.strip(), category=payload.category, created_by_user_id=actor.id)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.get("/events", response_model=EventPollRead)
async def events(cursor: datetime, db: DBSession, tenant: TenantDep, _viewer: InboxViewer):
    changed, next_cursor = await poll_changed(db, store_id=tenant.store.id, cursor=cursor)
    return EventPollRead(changed=changed, cursor=next_cursor)


@platform_router.post("/test/inbound", dependencies=[Depends(require_platform_admin)])
async def test_inbound(payload: TestInboundInput, background_tasks: BackgroundTasks, db: DBSession):
    if settings.APP_ENV not in {"development", "test"}:
        raise HTTPException(status_code=404, detail="Not found")
    channel = await db.scalar(select(MessagingChannel).where(
        MessagingChannel.provider == "test",
        MessagingChannel.external_account_ref == payload.external_account_ref,
    ).execution_options(include_all_stores=True))
    if channel is None:
        raise HTTPException(status_code=404, detail="Channel not found")
    with tenant_scope(store_id=channel.store_id, organization_id=channel.organization_id):
        conversation, message, created = await ingest_inbound(db, channel=channel, value=InboundMessage(
            external_account_ref=payload.external_account_ref,
            external_conversation_ref=payload.external_conversation_ref,
            external_user_ref=payload.external_user_ref,
            provider_message_ref=payload.provider_message_ref,
            text=payload.text,
            sent_at=datetime.now(timezone.utc),
            display_name=payload.display_name,
            phone=payload.phone,
            email=payload.email,
        ))
        queued = await CommerceAIAgent(db).queue_for_inbound(conversation=conversation, message=message, newly_created=created)
        await db.commit()
    if queued is not None:
        background_tasks.add_task(execute_queued_ai_background, queued.id)
    return {"conversation_id": conversation.id, "message_id": message.id, "created": created}
