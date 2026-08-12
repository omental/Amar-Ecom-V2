from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.access_control import ActivityLog
from app.models.customer import Customer, CustomerActivity
from app.models.inventory import InventoryItem
from app.models.messaging import (
    Conversation,
    ConversationMessage,
    ConversationNote,
    ConversationOrderLink,
    ConversationReadState,
    ConversationTag,
    ConversationTagLink,
    CustomerChannelIdentity,
    MessagingChannel,
    MessagingChannelSecret,
    SavedReply,
)
from app.models.order import Order
from app.models.product import Product
from app.models.tenant import Store, StoreMember
from app.models.user import User
from app.services.messaging_provider import InboundMessage, configured_messaging_provider
from app.services.messaging_credentials import MessagingCredentialVault
from app.services.meta_graph import MetaProviderError
from app.services.meta_messaging import provider_send_eligibility, reply_window_ends_at
from app.services.notification_service import notify_admins
from app.services.store_domain_service import get_primary_domain, get_storefront_url_for_hostname


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _clean_text(value: str) -> str:
    # Messages are persisted and rendered as plain text. Removing NUL keeps
    # provider/database boundaries predictable without rewriting history.
    return value.replace("\x00", "").strip()


def _not_found(label: str = "Conversation") -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} not found")


async def _provider_for_channel(db: AsyncSession, channel: MessagingChannel):
    credentials = await MessagingCredentialVault(db).load_for_provider(channel) if channel.provider.startswith("meta_") else {}
    return configured_messaging_provider(channel.provider, credentials=credentials, metadata=channel.configuration_metadata)


async def ensure_test_channel(db: AsyncSession, store: Store) -> MessagingChannel:
    if settings.APP_ENV not in {"development", "test"}:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")
    channel = await db.scalar(select(MessagingChannel).where(
        MessagingChannel.store_id == store.id,
        MessagingChannel.provider == "test",
        MessagingChannel.external_account_ref == f"store:{store.id}",
    ))
    if channel is None:
        provider = configured_messaging_provider("test")
        channel = MessagingChannel(
            organization_id=store.organization_id,
            store_id=store.id,
            channel_type="test",
            name="Development Test Channel",
            status="connected",
            provider="test",
            external_account_ref=f"store:{store.id}",
            capabilities=provider.capabilities(),
            configuration_metadata={"development_only": True},
        )
        db.add(channel)
        await db.flush()
    return channel


async def get_conversation(db: AsyncSession, store_id: UUID, conversation_id: UUID) -> Conversation:
    item = await db.scalar(
        select(Conversation)
        .where(Conversation.id == conversation_id, Conversation.store_id == store_id)
        .options(
            selectinload(Conversation.channel).selectinload(MessagingChannel.secret),
            selectinload(Conversation.identity),
            selectinload(Conversation.customer),
            selectinload(Conversation.assigned_user),
            selectinload(Conversation.tag_links).selectinload(ConversationTagLink.tag),
        )
    )
    if item is None:
        raise _not_found()
    return item


async def ingest_inbound(db: AsyncSession, *, channel: MessagingChannel, value: InboundMessage) -> tuple[Conversation, ConversationMessage, bool]:
    if channel.status != "connected" or channel.external_account_ref != value.external_account_ref:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Messaging channel is not connected")

    duplicate = await db.scalar(select(ConversationMessage).where(
        ConversationMessage.channel_id == channel.id,
        ConversationMessage.provider_message_ref == value.provider_message_ref,
    ))
    if duplicate is not None:
        conversation = await get_conversation(db, channel.store_id, duplicate.conversation_id)
        return conversation, duplicate, False

    identity = await db.scalar(select(CustomerChannelIdentity).where(
        CustomerChannelIdentity.channel_id == channel.id,
        CustomerChannelIdentity.external_user_ref == value.external_user_ref,
    ))
    if identity is None:
        customer_id = None
        if value.phone_verified and value.phone:
            customer_id = await db.scalar(select(Customer.id).where(Customer.store_id == channel.store_id, Customer.phone == value.phone))
        if customer_id is None and value.email_verified and value.email:
            customer_id = await db.scalar(select(Customer.id).where(
                Customer.store_id == channel.store_id,
                func.lower(Customer.email) == value.email.strip().lower(),
            ))
        identity = CustomerChannelIdentity(
            store_id=channel.store_id,
            channel_id=channel.id,
            customer_id=customer_id,
            external_user_ref=value.external_user_ref,
            display_name=value.display_name,
            phone=value.phone,
            email=value.email.strip().lower() if value.email else None,
            metadata_json={"phone_verified": value.phone_verified, "email_verified": value.email_verified},
            last_seen_at=value.sent_at,
        )
        db.add(identity)
        await db.flush()
    else:
        identity.last_seen_at = max(identity.last_seen_at or value.sent_at, value.sent_at)
        if value.display_name:
            identity.display_name = value.display_name

    conversation = await db.scalar(select(Conversation).where(
        Conversation.channel_id == channel.id,
        Conversation.external_conversation_ref == value.external_conversation_ref,
    ))
    created = conversation is None
    if conversation is None:
        conversation = Conversation(
            organization_id=channel.organization_id,
            store_id=channel.store_id,
            channel_id=channel.id,
            identity_id=identity.id,
            customer_id=identity.customer_id,
            external_conversation_ref=value.external_conversation_ref,
            status="open",
            subject=value.display_name or "New conversation",
            last_message_at=value.sent_at,
        )
        db.add(conversation)
        await db.flush()
    elif conversation.status == "resolved":
        conversation.status = "open"
        conversation.resolved_at = None
        conversation.snoozed_until = None
        db.add(ActivityLog(
            organization_id=channel.organization_id,
            action="conversation_reopened",
            module="inbox",
            entity_type="conversation",
            entity_id=str(conversation.id),
            message="Conversation reopened by a new inbound message.",
        ))

    message = ConversationMessage(
        store_id=channel.store_id,
        conversation_id=conversation.id,
        channel_id=channel.id,
        direction="inbound",
        message_type=value.message_type,
        sender_type="customer",
        external_sender_ref=value.external_user_ref,
        provider_message_ref=value.provider_message_ref,
        text_content=_clean_text(value.text),
        status="received",
        sent_at=value.sent_at,
        provider_metadata=value.metadata,
    )
    db.add(message)
    conversation.last_message_at = max(conversation.last_message_at or value.sent_at, value.sent_at)
    if channel.channel_type in {"facebook_messenger", "whatsapp"}:
        candidate_window = reply_window_ends_at(value.sent_at)
        conversation.provider_reply_window_ends_at = max(conversation.provider_reply_window_ends_at or candidate_window, candidate_window)
    await db.flush()
    await notify_admins(
        db,
        title="New inbox message",
        message=f"{identity.display_name or 'A customer'} sent a message.",
        link=f"/dashboard/inbox?conversation={conversation.id}",
        module="inbox",
        metadata={"conversation_id": str(conversation.id), "store_id": str(channel.store_id)},
    )
    return conversation, message, created


async def send_message(
    db: AsyncSession,
    *,
    conversation: Conversation,
    actor: User | None,
    text: str,
    idempotency_key: str,
    reply_to_message_id: UUID | None = None,
    sender_type: str = "agent",
) -> ConversationMessage:
    if sender_type not in {"agent", "ai"} or (sender_type == "agent" and actor is None):
        raise ValueError("A valid messaging sender principal is required")
    existing = await db.scalar(select(ConversationMessage).where(
        ConversationMessage.conversation_id == conversation.id,
        ConversationMessage.idempotency_key == idempotency_key,
    ))
    if existing is not None:
        return existing
    if conversation.channel.status != "connected":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Channel is not connected")
    eligibility = provider_send_eligibility(conversation.channel.channel_type, conversation.provider_reply_window_ends_at)
    if not eligibility["can_send_freeform"]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={
            "code": "PROVIDER_SEND_RESTRICTED", "reason": eligibility["reason"],
            "message": "Customer service window closed. Use an approved WhatsApp template." if eligibility["reason"] == "template_required" else "The Messenger reply window is closed.",
        })
    if reply_to_message_id is not None:
        reply = await db.scalar(select(ConversationMessage.id).where(
            ConversationMessage.id == reply_to_message_id,
            ConversationMessage.conversation_id == conversation.id,
        ))
        if reply is None:
            raise _not_found("Reply message")
    message = ConversationMessage(
        store_id=conversation.store_id,
        conversation_id=conversation.id,
        channel_id=conversation.channel_id,
        direction="outbound",
        message_type="text",
        sender_type=sender_type,
        sender_user_id=actor.id if actor else None,
        idempotency_key=idempotency_key,
        text_content=_clean_text(text),
        reply_to_message_id=reply_to_message_id,
        status="queued",
        sent_at=_now(),
    )
    db.add(message)
    await db.flush()
    try:
        provider = await _provider_for_channel(db, conversation.channel)
        result = await provider.send_message(
            external_conversation_ref=conversation.external_conversation_ref or str(conversation.id),
            text=message.text_content or "",
            idempotency_key=idempotency_key,
        )
        message.provider_message_ref = result.provider_message_ref
        message.status = result.status
        message.delivered_at = result.delivered_at
        message.read_at = result.read_at
        if conversation.first_response_at is None:
            conversation.first_response_at = message.sent_at
        conversation.last_message_at = message.sent_at
        db.add(ActivityLog(
            organization_id=conversation.organization_id,
            user_id=actor.id if actor else None,
            action="ai_response_sent" if sender_type == "ai" else "message_sent",
            module="inbox",
            entity_type="conversation",
            entity_id=str(conversation.id),
            message="Amar AI sent a grounded inbox reply." if sender_type == "ai" else "Agent sent an inbox reply.",
        ))
    except MetaProviderError as exc:
        message.status = "failed"
        message.failed_at = _now()
        message.failure_reason = exc.kind
        if exc.kind in {"authorization_required", "permission_denied"}:
            conversation.channel.status = "needs_attention"
        db.add(ActivityLog(
            organization_id=conversation.organization_id,
            user_id=actor.id if actor else None,
            action="message_failed",
            module="inbox",
            entity_type="conversation",
            entity_id=str(conversation.id),
            message="An inbox reply failed to send.",
        ))
    except Exception:
        message.status = "failed"
        message.failed_at = _now()
        message.failure_reason = "provider_unavailable"
    await db.flush()
    return message


async def retry_message(db: AsyncSession, *, conversation: Conversation, message_id: UUID, actor: User) -> ConversationMessage:
    message = await db.scalar(select(ConversationMessage).where(
        ConversationMessage.id == message_id,
        ConversationMessage.conversation_id == conversation.id,
        ConversationMessage.direction == "outbound",
    ))
    if message is None:
        raise _not_found("Message")
    if message.status != "failed" or not message.idempotency_key:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only failed messages can be retried")
    provider = await _provider_for_channel(db, conversation.channel)
    try:
        result = await provider.send_message(
            external_conversation_ref=conversation.external_conversation_ref or str(conversation.id),
            text=message.text_content or "",
            idempotency_key=message.idempotency_key,
        )
        message.provider_message_ref = result.provider_message_ref
        message.status = result.status
        message.failed_at = None
        message.failure_reason = None
        message.delivered_at = result.delivered_at
        message.read_at = result.read_at
    except MetaProviderError as exc:
        message.failed_at = _now()
        message.failure_reason = exc.kind
    except Exception:
        message.failed_at = _now()
        message.failure_reason = "provider_unavailable"
    await db.flush()
    return message


async def add_note(db: AsyncSession, *, conversation: Conversation, actor: User, content: str) -> ConversationNote:
    note = ConversationNote(
        store_id=conversation.store_id,
        conversation_id=conversation.id,
        author_user_id=actor.id,
        content=_clean_text(content),
    )
    db.add(note)
    db.add(ActivityLog(
        organization_id=conversation.organization_id,
        user_id=actor.id,
        action="internal_note_added",
        module="inbox",
        entity_type="conversation",
        entity_id=str(conversation.id),
        message="Internal note added to conversation.",
    ))
    await db.flush()
    return note


async def mark_read(db: AsyncSession, *, conversation: Conversation, user_id: UUID) -> ConversationReadState:
    latest = await db.scalar(select(ConversationMessage).where(
        ConversationMessage.conversation_id == conversation.id,
    ).order_by(ConversationMessage.sent_at.desc(), ConversationMessage.id.desc()).limit(1))
    state = await db.scalar(select(ConversationReadState).where(
        ConversationReadState.conversation_id == conversation.id,
        ConversationReadState.user_id == user_id,
    ))
    if state is None:
        state = ConversationReadState(store_id=conversation.store_id, conversation_id=conversation.id, user_id=user_id)
        db.add(state)
    state.last_read_message_id = latest.id if latest else None
    state.read_at = _now()
    if latest and conversation.channel.capabilities.get("read_receipts") and conversation.external_conversation_ref:
        await (await _provider_for_channel(db, conversation.channel)).mark_read(
            external_conversation_ref=conversation.external_conversation_ref,
            provider_message_ref=latest.provider_message_ref,
        )
    await db.flush()
    return state


async def assign_conversation(db: AsyncSession, *, conversation: Conversation, actor: User, user_id: UUID | None) -> Conversation:
    if user_id is not None:
        membership = await db.scalar(select(StoreMember).where(
            StoreMember.store_id == conversation.store_id,
            StoreMember.user_id == user_id,
            StoreMember.status == "active",
        ).execution_options(include_all_stores=True))
        if membership is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Assignee does not have access to this Store")
    conversation.assigned_user_id = user_id
    db.add(ActivityLog(
        organization_id=conversation.organization_id,
        user_id=actor.id,
        action="conversation_assigned",
        module="inbox",
        entity_type="conversation",
        entity_id=str(conversation.id),
        message="Conversation assignment updated.",
    ))
    await db.flush()
    return conversation


async def set_conversation_status(db: AsyncSession, *, conversation: Conversation, actor: User, value: str) -> Conversation:
    if value not in {"open", "pending", "resolved"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid conversation status")
    conversation.status = value
    conversation.resolved_at = _now() if value == "resolved" else None
    conversation.snoozed_until = None
    action = "conversation_resolved" if value == "resolved" else "conversation_reopened"
    db.add(ActivityLog(
        organization_id=conversation.organization_id,
        user_id=actor.id,
        action=action,
        module="inbox",
        entity_type="conversation",
        entity_id=str(conversation.id),
        message=f"Conversation marked {value}.",
    ))
    await db.flush()
    return conversation


async def link_customer(db: AsyncSession, *, conversation: Conversation, actor: User, customer_id: UUID) -> Customer:
    customer = await db.scalar(select(Customer).where(Customer.id == customer_id, Customer.store_id == conversation.store_id))
    if customer is None:
        raise _not_found("Customer")
    conversation.customer_id = customer.id
    if conversation.identity:
        conversation.identity.customer_id = customer.id
    db.add(CustomerActivity(
        customer_id=customer.id,
        activity_type="inbox",
        title="Inbox conversation linked",
        description=f"Conversation {conversation.id} linked to this customer.",
        created_by_id=actor.id,
    ))
    db.add(ActivityLog(
        organization_id=conversation.organization_id,
        user_id=actor.id,
        action="customer_linked",
        module="inbox",
        entity_type="conversation",
        entity_id=str(conversation.id),
        message="Conversation linked to customer.",
    ))
    await db.flush()
    return customer


async def create_customer_from_conversation(
    db: AsyncSession, *, conversation: Conversation, actor: User, name: str, phone: str, email: str | None
) -> Customer:
    customer = Customer(name=name.strip(), phone=phone.strip(), email=email.strip().lower() if email else None)
    db.add(customer)
    await db.flush()
    await link_customer(db, conversation=conversation, actor=actor, customer_id=customer.id)
    return customer


async def link_order(db: AsyncSession, *, conversation: Conversation, actor: User, order_id: UUID) -> ConversationOrderLink:
    order = await db.scalar(select(Order).where(Order.id == order_id, Order.store_id == conversation.store_id))
    if order is None:
        raise _not_found("Order")
    existing = await db.scalar(select(ConversationOrderLink).where(
        ConversationOrderLink.conversation_id == conversation.id,
        ConversationOrderLink.order_id == order_id,
    ))
    if existing:
        return existing
    link = ConversationOrderLink(
        store_id=conversation.store_id,
        conversation_id=conversation.id,
        order_id=order_id,
        linked_by_user_id=actor.id,
    )
    db.add(link)
    await db.flush()
    return link


async def add_tag(db: AsyncSession, *, conversation: Conversation, name: str, color: str) -> ConversationTag:
    normalized = name.strip()
    tag = await db.scalar(select(ConversationTag).where(
        ConversationTag.store_id == conversation.store_id,
        func.lower(ConversationTag.name) == normalized.lower(),
    ))
    if tag is None:
        tag = ConversationTag(store_id=conversation.store_id, name=normalized, color=color)
        db.add(tag)
        await db.flush()
    existing = await db.scalar(select(ConversationTagLink.id).where(
        ConversationTagLink.conversation_id == conversation.id,
        ConversationTagLink.tag_id == tag.id,
    ))
    if existing is None:
        db.add(ConversationTagLink(store_id=conversation.store_id, conversation_id=conversation.id, tag_id=tag.id))
        await db.flush()
    return tag


async def list_conversations(
    db: AsyncSession, *, store_id: UUID, user_id: UUID, view: str, page: int, page_size: int,
    query: str | None = None, channel_id: UUID | None = None, priority: str | None = None,
    tag_id: UUID | None = None, unread_only: bool = False,
) -> tuple[list[Conversation], int, dict[str, int], dict[UUID, str], set[UUID]]:
    now = _now()
    base = select(Conversation).where(Conversation.store_id == store_id)
    if view == "mine":
        base = base.where(Conversation.assigned_user_id == user_id, Conversation.status.in_(("open", "pending", "snoozed")))
    elif view == "unassigned":
        base = base.where(Conversation.assigned_user_id.is_(None), Conversation.status.in_(("open", "pending", "snoozed")))
    elif view == "resolved":
        base = base.where(Conversation.status == "resolved")
    else:
        base = base.where(or_(Conversation.status != "snoozed", Conversation.snoozed_until <= now))
    if channel_id:
        base = base.where(Conversation.channel_id == channel_id)
    if priority:
        base = base.where(Conversation.priority == priority)
    if tag_id:
        base = base.join(ConversationTagLink).where(ConversationTagLink.tag_id == tag_id)
    if query:
        pattern = f"%{query.strip()}%"
        matching_messages = select(ConversationMessage.conversation_id).where(ConversationMessage.text_content.ilike(pattern))
        base = base.outerjoin(CustomerChannelIdentity, Conversation.identity_id == CustomerChannelIdentity.id).outerjoin(Customer, Conversation.customer_id == Customer.id).where(or_(
            Conversation.subject.ilike(pattern), CustomerChannelIdentity.display_name.ilike(pattern),
            CustomerChannelIdentity.phone.ilike(pattern), CustomerChannelIdentity.email.ilike(pattern),
            Customer.name.ilike(pattern), Customer.phone.ilike(pattern), Customer.email.ilike(pattern),
            Conversation.id.in_(matching_messages),
        ))
    unread_exists = select(ConversationMessage.id).outerjoin(
        ConversationReadState,
        and_(ConversationReadState.conversation_id == ConversationMessage.conversation_id, ConversationReadState.user_id == user_id),
    ).where(
        ConversationMessage.conversation_id == Conversation.id,
        ConversationMessage.direction == "inbound",
        or_(ConversationReadState.id.is_(None), ConversationMessage.sent_at > ConversationReadState.read_at),
    ).exists()
    if unread_only:
        base = base.where(unread_exists)
    total = int(await db.scalar(select(func.count()).select_from(base.order_by(None).subquery())) or 0)
    rows = list((await db.execute(
        base.options(
            selectinload(Conversation.channel).selectinload(MessagingChannel.secret),
            selectinload(Conversation.identity), selectinload(Conversation.assigned_user),
            selectinload(Conversation.tag_links).selectinload(ConversationTagLink.tag),
        ).order_by(Conversation.last_message_at.desc().nullslast(), Conversation.id.desc()).offset((page - 1) * page_size).limit(page_size)
    )).scalars().unique().all())
    ids = [item.id for item in rows]
    previews: dict[UUID, str] = {}
    unread_ids: set[UUID] = set()
    for conversation_id in ids:
        preview = await db.scalar(select(ConversationMessage.text_content).where(
            ConversationMessage.conversation_id == conversation_id,
        ).order_by(ConversationMessage.sent_at.desc(), ConversationMessage.id.desc()).limit(1))
        previews[conversation_id] = (preview or "")[:160]
        if await db.scalar(select(unread_exists).where(Conversation.id == conversation_id)):
            unread_ids.add(conversation_id)
    counts = {
        "mine_unread": int(await db.scalar(select(func.count()).select_from(Conversation).where(
            Conversation.store_id == store_id, Conversation.assigned_user_id == user_id,
            Conversation.status.in_(("open", "pending", "snoozed")), unread_exists,
        )) or 0),
        "unassigned": int(await db.scalar(select(func.count()).select_from(Conversation).where(
            Conversation.store_id == store_id, Conversation.assigned_user_id.is_(None),
            Conversation.status.in_(("open", "pending", "snoozed")),
        )) or 0),
        "open": int(await db.scalar(select(func.count()).select_from(Conversation).where(
            Conversation.store_id == store_id, Conversation.status.in_(("open", "pending", "snoozed")),
        )) or 0),
    }
    return rows, total, counts, previews, unread_ids


async def list_messages(db: AsyncSession, *, conversation_id: UUID, page: int, page_size: int) -> tuple[list[ConversationMessage], list[ConversationNote], int]:
    total = int(await db.scalar(select(func.count()).select_from(ConversationMessage).where(
        ConversationMessage.conversation_id == conversation_id,
    )) or 0)
    remaining = max(0, total - (page - 1) * page_size)
    page_limit = min(page_size, remaining)
    messages = list((await db.execute(select(ConversationMessage).where(
        ConversationMessage.conversation_id == conversation_id,
    ).options(selectinload(ConversationMessage.sender_user)).order_by(
        ConversationMessage.sent_at.asc(), ConversationMessage.id.asc(),
    ).offset(max(0, total - page * page_size)).limit(page_limit))).scalars().all())
    notes = list((await db.execute(select(ConversationNote).where(
        ConversationNote.conversation_id == conversation_id,
    ).options(selectinload(ConversationNote.author)).order_by(ConversationNote.created_at.asc()))).scalars().all())
    return messages, notes, total


async def commerce_context(db: AsyncSession, *, conversation: Conversation) -> dict:
    customer = None
    recent_orders: list[Order] = []
    if conversation.customer_id:
        customer = await db.scalar(select(Customer).where(Customer.id == conversation.customer_id, Customer.store_id == conversation.store_id))
        recent_orders = list((await db.execute(select(Order).where(
            Order.customer_id == conversation.customer_id, Order.store_id == conversation.store_id,
        ).order_by(Order.created_at.desc()).limit(5))).scalars().all())
    linked_orders = list((await db.execute(select(Order).join(
        ConversationOrderLink, ConversationOrderLink.order_id == Order.id,
    ).where(ConversationOrderLink.conversation_id == conversation.id, Order.store_id == conversation.store_id))).scalars().all())
    order_count = int(await db.scalar(select(func.count()).select_from(Order).where(
        Order.customer_id == conversation.customer_id, Order.store_id == conversation.store_id,
    )) or 0) if conversation.customer_id else 0
    lifetime_value = await db.scalar(select(func.coalesce(func.sum(Order.total), 0)).where(
        Order.customer_id == conversation.customer_id, Order.store_id == conversation.store_id,
    )) if conversation.customer_id else Decimal("0")
    return {"customer": customer, "recent_orders": recent_orders, "linked_orders": linked_orders, "order_count": order_count, "lifetime_value": lifetime_value or Decimal("0")}


async def search_products(db: AsyncSession, *, store_id: UUID, query: str, limit: int = 12) -> list[dict]:
    pattern = f"%{query.strip()}%"
    products = list((await db.execute(select(Product).where(
        Product.store_id == store_id,
        Product.status == "active",
        or_(Product.name.ilike(pattern), Product.sku.ilike(pattern), Product.slug.ilike(pattern)),
    ).options(selectinload(Product.variants), selectinload(Product.inventory_items)).order_by(Product.name).limit(limit))).scalars().unique().all())
    primary = await get_primary_domain(db, store_id)
    base = get_storefront_url_for_hostname(primary.hostname)
    result = []
    for product in products:
        stock = sum(item.quantity for item in product.inventory_items)
        result.append({
            "product": product,
            "stock": stock,
            "variants": [{"id": str(v.id), "name": v.name, "sku": v.sku, "price": v.price, "stock": v.stock_quantity} for v in product.variants],
            "storefront_url": f"{base}/products/{product.slug}",
        })
    return result


async def list_assignees(db: AsyncSession, *, store_id: UUID) -> list[User]:
    return list((await db.execute(select(User).join(StoreMember, StoreMember.user_id == User.id).where(
        StoreMember.store_id == store_id, StoreMember.status == "active", User.is_active.is_(True),
    ).execution_options(include_all_stores=True).order_by(User.full_name))).scalars().all())


async def list_saved_replies(db: AsyncSession, *, store_id: UUID, query: str | None = None) -> list[SavedReply]:
    statement = select(SavedReply).where(SavedReply.store_id == store_id)
    if query:
        pattern = f"%{query.strip()}%"
        statement = statement.where(or_(SavedReply.title.ilike(pattern), SavedReply.content.ilike(pattern)))
    return list((await db.execute(statement.order_by(SavedReply.title).limit(100))).scalars().all())


async def poll_changed(db: AsyncSession, *, store_id: UUID, cursor: datetime) -> tuple[bool, datetime]:
    conversation_time = await db.scalar(select(func.max(Conversation.updated_at)).where(Conversation.store_id == store_id))
    message_time = await db.scalar(select(func.max(ConversationMessage.created_at)).where(ConversationMessage.store_id == store_id))
    latest = max((value for value in (conversation_time, message_time, cursor) if value is not None))
    return latest > cursor, latest
