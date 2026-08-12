import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CommerceAISettings(Base):
    __tablename__ = "commerce_ai_settings"
    __table_args__ = (
        UniqueConstraint("store_id", name="uq_commerce_ai_settings_store"),
        CheckConstraint("mode IN ('off','copilot','assist')", name="ck_commerce_ai_settings_mode"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, index=True)
    store_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False, index=True)
    enabled: Mapped[bool] = mapped_column(nullable=False, default=False, server_default="false")
    mode: Mapped[str] = mapped_column(String(20), nullable=False, default="off", server_default="off")
    tone: Mapped[str] = mapped_column(String(80), nullable=False, default="concise and helpful", server_default="concise and helpful")
    language_preferences: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    merchant_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    handoff_rules: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict, server_default="{}")
    disclose_ai: Mapped[bool] = mapped_column(nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class AIExecution(Base):
    __tablename__ = "ai_executions"
    __table_args__ = (
        UniqueConstraint("store_id", "idempotency_key", name="uq_ai_execution_idempotency"),
        CheckConstraint("mode IN ('copilot','assist')", name="ck_ai_executions_mode"),
        CheckConstraint("status IN ('queued','running','completed','handoff','blocked','failed','cancelled')", name="ck_ai_executions_status"),
        Index("ix_ai_executions_store_created", "store_id", "created_at"),
        Index("ix_ai_executions_conversation_created", "conversation_id", "created_at"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, index=True)
    store_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False, index=True)
    conversation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="RESTRICT"), nullable=False, index=True)
    triggering_message_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("conversation_messages.id", ondelete="RESTRICT"), nullable=False, index=True)
    idempotency_key: Mapped[str] = mapped_column(String(160), nullable=False)
    mode: Mapped[str] = mapped_column(String(20), nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued", server_default="queued", index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    handoff_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    tool_calls_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    response_message_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("conversation_messages.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    conversation = relationship("Conversation", foreign_keys=[conversation_id])
    triggering_message = relationship("ConversationMessage", foreign_keys=[triggering_message_id])
    tool_calls = relationship("AIToolCall", back_populates="execution", cascade="all, delete-orphan")
    suggestions = relationship("AIResponseSuggestion", back_populates="execution", cascade="all, delete-orphan")


class AIToolCall(Base):
    __tablename__ = "ai_tool_calls"
    __table_args__ = (
        CheckConstraint("status IN ('running','completed','rejected','failed')", name="ck_ai_tool_calls_status"),
        Index("ix_ai_tool_calls_execution_created", "execution_id", "created_at"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False, index=True)
    execution_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ai_executions.id", ondelete="CASCADE"), nullable=False, index=True)
    tool_key: Mapped[str] = mapped_column(String(80), nullable=False)
    sanitized_arguments: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict, server_default="{}")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="running", server_default="running")
    result_summary: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict, server_default="{}")
    error_category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    execution = relationship("AIExecution", back_populates="tool_calls")


class AIUsageEvent(Base):
    __tablename__ = "ai_usage_events"
    __table_args__ = (
        UniqueConstraint("execution_id", name="uq_ai_usage_event_execution"),
        Index("ix_ai_usage_events_store_occurred", "store_id", "occurred_at"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, index=True)
    store_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False, index=True)
    execution_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ai_executions.id", ondelete="RESTRICT"), nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model: Mapped[str] = mapped_column(String(120), nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    tool_calls: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    billable_units: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class AIResponseSuggestion(Base):
    __tablename__ = "ai_response_suggestions"
    __table_args__ = (
        UniqueConstraint("execution_id", name="uq_ai_response_suggestion_execution"),
        CheckConstraint("status IN ('suggested','accepted','rejected','superseded')", name="ck_ai_response_suggestions_status"),
        Index("ix_ai_response_suggestions_conversation", "conversation_id", "created_at"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False, index=True)
    execution_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ai_executions.id", ondelete="CASCADE"), nullable=False)
    conversation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="suggested", server_default="suggested")
    tool_summary: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    edited_before_send: Mapped[bool] = mapped_column(nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    execution = relationship("AIExecution", back_populates="suggestions")
