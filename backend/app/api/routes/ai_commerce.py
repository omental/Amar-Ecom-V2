from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_entitlement_context, get_tenant_context, require_permission, require_platform_admin
from app.core.config import settings
from app.core.tenant import TenantContext
from app.models.access_control import ActivityLog
from app.models.ai_commerce import AIExecution, AIResponseSuggestion
from app.models.messaging import Conversation, ConversationMessage
from app.models.user import User
from app.schemas.ai_commerce import (
    AIExecutionRead, AISettingsRead, AISettingsUpdate, AISuggestionRead, AIUsageRead,
    ConversationAIStateRead, GenerateAIInput, UseSuggestionInput,
)
from app.services.ai_agent import CommerceAIAgent, ensure_ai_settings
from app.services.ai_provider import AIProviderError, configured_ai_provider
from app.services.commercial_access_service import EntitlementService, UsageService, usage_result
from app.services.messaging_service import get_conversation, send_message


router = APIRouter()
platform_router = APIRouter()
TenantDep = Annotated[TenantContext, Depends(get_tenant_context)]
AIManager = Annotated[User, Depends(require_permission("inbox", "ai_manage"))]
AILogViewer = Annotated[User, Depends(require_permission("inbox", "ai_view_logs"))]
InboxReply = Annotated[User, Depends(require_permission("inbox", "reply"))]


def _provider_state() -> tuple[bool, str | None, str | None]:
    try:
        provider = configured_ai_provider()
        return True, provider.key, provider.model
    except AIProviderError:
        return False, None, None


def _suggestion(row: AIResponseSuggestion | None) -> AISuggestionRead | None:
    return None if row is None else AISuggestionRead.model_validate(row)


def _execution(row: AIExecution) -> AIExecutionRead:
    suggestion = next(iter(getattr(row, "suggestions", []) or []), None)
    tools = [{"key": tool.tool_key, "label": tool.tool_key.replace("_", " ").title(), "status": tool.status} for tool in row.tool_calls]
    return AIExecutionRead(
        id=row.id, conversation_id=row.conversation_id, triggering_message_id=row.triggering_message_id,
        mode=row.mode, provider=row.provider, model=row.model, status=row.status,
        started_at=row.started_at, completed_at=row.completed_at, handoff_reason=row.handoff_reason,
        failure_reason=row.failure_reason, input_tokens=row.input_tokens, output_tokens=row.output_tokens,
        tool_calls_count=row.tool_calls_count, response_message_id=row.response_message_id,
        created_at=row.created_at, tool_summary=tools, suggestion=_suggestion(suggestion),
    )


@router.get("/settings", response_model=AISettingsRead)
async def get_settings(db: DBSession, tenant: TenantDep, _actor: Annotated[User, Depends(require_permission("inbox", "view"))]):
    row = await ensure_ai_settings(db, store_id=tenant.store.id, organization_id=tenant.organization.id)
    available, provider, model = _provider_state()
    return AISettingsRead.model_validate({
        "enabled": row.enabled, "mode": row.mode, "tone": row.tone,
        "language_preferences": row.language_preferences, "merchant_instructions": row.merchant_instructions,
        "handoff_rules": row.handoff_rules, "disclose_ai": row.disclose_ai,
        "provider_available": available, "provider": provider, "model": model,
    })


@router.patch("/settings", response_model=AISettingsRead)
async def update_settings(payload: AISettingsUpdate, db: DBSession, tenant: TenantDep, actor: AIManager, access: Annotated[EntitlementService, Depends(get_entitlement_context)]):
    if payload.enabled or payload.mode != "off":
        await access.require_feature("ai_commerce")
        if not _provider_state()[0]:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"code": "AI_NOT_CONFIGURED", "message": "AI is not configured for this environment."})
    row = await ensure_ai_settings(db, store_id=tenant.store.id, organization_id=tenant.organization.id)
    previous = row.mode
    row.enabled = payload.enabled and payload.mode != "off"
    row.mode = payload.mode if row.enabled else "off"
    row.tone = payload.tone
    row.language_preferences = [item.strip()[:40] for item in payload.language_preferences if item.strip()]
    row.merchant_instructions = payload.merchant_instructions
    row.handoff_rules = payload.handoff_rules
    row.disclose_ai = payload.disclose_ai
    db.add(ActivityLog(
        organization_id=tenant.organization.id, user_id=actor.id,
        action="ai_enabled" if row.enabled and previous == "off" else "ai_disabled" if not row.enabled else "ai_mode_changed",
        module="inbox", entity_type="commerce_ai_settings", entity_id=str(row.id), message="Amar AI settings changed.",
    ))
    await db.commit()
    return await get_settings(db, tenant, actor)


@router.post("/conversations/{conversation_id}/generate", response_model=AIExecutionRead)
async def generate_reply(conversation_id: UUID, payload: GenerateAIInput, db: DBSession, tenant: TenantDep, _actor: InboxReply):
    conversation = await get_conversation(db, tenant.store.id, conversation_id)
    trigger = await db.scalar(select(ConversationMessage).where(
        ConversationMessage.conversation_id == conversation.id,
        ConversationMessage.direction == "inbound", ConversationMessage.sender_type == "customer",
    ).order_by(ConversationMessage.sent_at.desc(), ConversationMessage.id.desc()).limit(1))
    if trigger is None:
        raise HTTPException(status_code=409, detail="Conversation has no customer message to answer")
    execution = await CommerceAIAgent(db).generate(
        conversation=conversation, triggering_message=trigger, mode="copilot",
        idempotency_key=f"copilot:{payload.idempotency_key}" if payload.idempotency_key else None,
    )
    await db.commit()
    execution = await _load_execution(db, tenant.store.id, execution.id)
    return _execution(execution)


@router.get("/conversations/{conversation_id}/executions", response_model=list[AIExecutionRead])
async def executions(conversation_id: UUID, db: DBSession, tenant: TenantDep, _actor: AILogViewer, limit: int = Query(20, ge=1, le=100)):
    await get_conversation(db, tenant.store.id, conversation_id)
    rows = list((await db.execute(select(AIExecution).where(
        AIExecution.store_id == tenant.store.id, AIExecution.conversation_id == conversation_id,
    ).options(selectinload(AIExecution.tool_calls), selectinload(AIExecution.suggestions)).order_by(AIExecution.created_at.desc()).limit(limit))).scalars().all())
    return [_execution(row) for row in rows]


@router.post("/suggestions/{suggestion_id}/use", response_model=dict)
async def use_suggestion(suggestion_id: UUID, payload: UseSuggestionInput, db: DBSession, tenant: TenantDep, actor: InboxReply):
    suggestion = await db.scalar(select(AIResponseSuggestion).where(
        AIResponseSuggestion.id == suggestion_id, AIResponseSuggestion.store_id == tenant.store.id,
    ))
    if suggestion is None:
        raise HTTPException(status_code=404, detail="AI suggestion not found")
    if suggestion.status != "suggested":
        raise HTTPException(status_code=409, detail="AI suggestion is no longer available")
    conversation = await get_conversation(db, tenant.store.id, suggestion.conversation_id)
    message = await send_message(db, conversation=conversation, actor=actor, text=payload.text, idempotency_key=payload.idempotency_key)
    if message.status == "failed":
        raise HTTPException(status_code=409, detail={"code": "MESSAGE_SEND_FAILED", "reason": message.failure_reason})
    suggestion.status = "accepted"; suggestion.accepted_at = datetime.now(timezone.utc)
    suggestion.edited_before_send = payload.text.strip() != suggestion.text.strip()
    await db.commit()
    return {"message_id": str(message.id), "status": message.status}


@router.post("/suggestions/{suggestion_id}/reject", response_model=AISuggestionRead)
async def reject_suggestion(suggestion_id: UUID, db: DBSession, tenant: TenantDep, _actor: InboxReply):
    row = await db.scalar(select(AIResponseSuggestion).where(AIResponseSuggestion.id == suggestion_id, AIResponseSuggestion.store_id == tenant.store.id))
    if row is None:
        raise HTTPException(status_code=404, detail="AI suggestion not found")
    if row.status == "suggested":
        row.status = "rejected"; row.rejected_at = datetime.now(timezone.utc)
    await db.commit()
    return AISuggestionRead.model_validate(row)


@router.post("/conversations/{conversation_id}/takeover", response_model=ConversationAIStateRead)
async def takeover(conversation_id: UUID, db: DBSession, tenant: TenantDep, actor: InboxReply):
    conversation = await get_conversation(db, tenant.store.id, conversation_id)
    conversation.handling_mode = "human"
    db.add(ActivityLog(organization_id=tenant.organization.id, user_id=actor.id, action="ai_handoff", module="inbox", entity_type="conversation", entity_id=str(conversation.id), message="A human agent took over this conversation."))
    await db.commit()
    return ConversationAIStateRead(conversation_id=conversation.id, handling_mode=conversation.handling_mode)


@router.post("/conversations/{conversation_id}/resume", response_model=ConversationAIStateRead)
async def resume(conversation_id: UUID, db: DBSession, tenant: TenantDep, actor: AIManager, access: Annotated[EntitlementService, Depends(get_entitlement_context)]):
    await access.require_feature("ai_commerce")
    ai_settings = await ensure_ai_settings(db, store_id=tenant.store.id, organization_id=tenant.organization.id)
    if not ai_settings.enabled:
        raise HTTPException(status_code=409, detail="Enable Amar AI before resuming it")
    conversation = await get_conversation(db, tenant.store.id, conversation_id)
    conversation.handling_mode = "ai"
    db.add(ActivityLog(organization_id=tenant.organization.id, user_id=actor.id, action="ai_resumed", module="inbox", entity_type="conversation", entity_id=str(conversation.id), message="Amar AI was resumed for this conversation."))
    await db.commit()
    return ConversationAIStateRead(conversation_id=conversation.id, handling_mode=conversation.handling_mode)


@router.get("/usage", response_model=AIUsageRead)
async def usage(db: DBSession, tenant: TenantDep, _actor: Annotated[User, Depends(require_permission("inbox", "view"))], access: Annotated[EntitlementService, Depends(get_entitlement_context)]):
    current = await UsageService(db, store_id=tenant.store.id, organization_id=tenant.organization.id).get_usage("ai_messages_monthly")
    limit = await access.get_limit("ai_messages_monthly")
    result = usage_result("ai_messages_monthly", current, limit)
    return AIUsageRead(feature=result.feature, usage=int(result.usage), limit=None if result.limit is None else int(result.limit), remaining=None if result.remaining is None else int(result.remaining), over_limit=result.over_limit)


async def _load_execution(db, store_id: UUID, execution_id: UUID) -> AIExecution:
    row = await db.scalar(select(AIExecution).where(AIExecution.id == execution_id, AIExecution.store_id == store_id).options(selectinload(AIExecution.tool_calls), selectinload(AIExecution.suggestions)))
    if row is None:
        raise HTTPException(status_code=404, detail="AI execution not found")
    return row


@platform_router.get("/executions", dependencies=[Depends(require_platform_admin)])
async def platform_executions(db: DBSession, limit: int = Query(100, ge=1, le=500), status_filter: str | None = Query(default=None, alias="status")):
    statement = select(AIExecution).execution_options(include_all_stores=True).order_by(AIExecution.created_at.desc()).limit(limit)
    if status_filter:
        statement = statement.where(AIExecution.status == status_filter)
    rows = list((await db.execute(statement)).scalars().all())
    return [{
        "id": str(row.id), "organization_id": str(row.organization_id), "store_id": str(row.store_id),
        "conversation_id": str(row.conversation_id), "provider": row.provider, "model": row.model,
        "status": row.status, "failure_reason": row.failure_reason, "handoff_reason": row.handoff_reason,
        "tool_calls": row.tool_calls_count, "input_tokens": row.input_tokens,
        "output_tokens": row.output_tokens, "created_at": row.created_at,
    } for row in rows]
