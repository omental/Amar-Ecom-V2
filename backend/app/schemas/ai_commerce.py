from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AISettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    enabled: bool
    mode: str
    tone: str
    language_preferences: list[str]
    merchant_instructions: str | None
    handoff_rules: dict
    disclose_ai: bool
    provider_available: bool
    provider: str | None
    model: str | None


class AISettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool
    mode: str = Field(pattern=r"^(off|copilot|assist)$")
    tone: str = Field(min_length=1, max_length=80)
    language_preferences: list[str] = Field(default_factory=list, max_length=5)
    merchant_instructions: str | None = Field(default=None, max_length=1000)
    handoff_rules: dict = Field(default_factory=dict)
    disclose_ai: bool = True


class GenerateAIInput(BaseModel):
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=100)


class ToolSummaryRead(BaseModel):
    key: str
    label: str
    status: str


class AISuggestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    execution_id: UUID
    conversation_id: UUID
    text: str
    status: str
    tool_summary: list[dict]
    accepted_at: datetime | None
    rejected_at: datetime | None
    edited_before_send: bool
    created_at: datetime


class UseSuggestionInput(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    idempotency_key: str = Field(min_length=8, max_length=100)


class AIExecutionRead(BaseModel):
    id: UUID
    conversation_id: UUID
    triggering_message_id: UUID
    mode: str
    provider: str
    model: str
    status: str
    started_at: datetime | None
    completed_at: datetime | None
    handoff_reason: str | None
    failure_reason: str | None
    input_tokens: int
    output_tokens: int
    tool_calls_count: int
    response_message_id: UUID | None
    created_at: datetime
    tool_summary: list[ToolSummaryRead]
    suggestion: AISuggestionRead | None = None


class AIUsageRead(BaseModel):
    feature: str = "ai_messages_monthly"
    usage: int
    limit: int | None
    remaining: int | None
    over_limit: bool


class ConversationAIStateRead(BaseModel):
    conversation_id: UUID
    handling_mode: str

