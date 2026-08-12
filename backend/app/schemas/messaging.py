from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ChannelRead(BaseModel):
    id: UUID
    channel_type: str
    name: str
    status: str
    provider: str
    capabilities: dict[str, bool]
    external_account_configured: bool
    credentials_configured: bool
    metadata: dict = Field(default_factory=dict)


class IdentityRead(BaseModel):
    id: UUID
    customer_id: UUID | None
    display_name: str | None
    phone: str | None
    email: str | None
    avatar_url: str | None
    status: str


class TagRead(BaseModel):
    id: UUID
    name: str
    color: str


class ConversationSummary(BaseModel):
    id: UUID
    channel: ChannelRead
    identity: IdentityRead | None
    customer_id: UUID | None
    status: str
    priority: str
    assigned_user_id: UUID | None
    assigned_user_name: str | None
    subject: str | None
    handling_mode: str
    last_message_at: datetime | None
    last_message_preview: str | None
    unread: bool
    tags: list[TagRead]
    send_eligibility: dict = Field(default_factory=dict)


class MetaConfigurationRead(BaseModel):
    configured: bool
    facebook_configured: bool
    whatsapp_configured: bool
    message: str | None = None
    app_id: str | None = None
    embedded_signup_config_id: str | None = None
    graph_api_version: str | None = None


class MetaOAuthStartRead(BaseModel):
    authorization_url: str
    expires_at: datetime


class MetaOAuthCallbackRead(BaseModel):
    flow_id: UUID
    pages: list[dict]


class FacebookPageConnectInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    flow_id: UUID
    page_id: str = Field(min_length=1, max_length=255)


class WhatsAppConnectInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=1, max_length=2048)
    waba_id: str = Field(min_length=1, max_length=255)
    phone_number_id: str = Field(min_length=1, max_length=255)
    registration_pin: str | None = Field(default=None, min_length=6, max_length=12)


class TemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    language: str
    category: str | None
    status: str
    components: list
    last_synced_at: datetime | None


class TemplateSendInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    template_id: UUID
    variables: list[str] = Field(default_factory=list, max_length=20)
    idempotency_key: str = Field(min_length=8, max_length=100, pattern=r"^[A-Za-z0-9._:-]+$")


class MessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    direction: str
    message_type: str
    sender_type: str
    sender_user_id: UUID | None
    sender_name: str | None = None
    text_content: str | None
    reply_to_message_id: UUID | None
    status: str
    failure_reason: str | None
    sent_at: datetime
    delivered_at: datetime | None
    read_at: datetime | None
    failed_at: datetime | None


class NoteRead(BaseModel):
    id: UUID
    author_user_id: UUID
    author_name: str
    content: str
    created_at: datetime


class PaginatedConversations(BaseModel):
    items: list[ConversationSummary]
    total: int
    page: int
    page_size: int
    counts: dict[str, int]


class PaginatedMessages(BaseModel):
    items: list[MessageRead]
    notes: list[NoteRead]
    total: int
    page: int
    page_size: int


class SendMessageInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=4000)
    idempotency_key: str = Field(min_length=8, max_length=100, pattern=r"^[A-Za-z0-9._:-]+$")
    reply_to_message_id: UUID | None = None


class AddNoteInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    content: str = Field(min_length=1, max_length=4000)


class AssignInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: UUID | None = None


class PriorityInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    priority: str = Field(pattern=r"^(normal|high|urgent)$")


class SnoozeInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    until: datetime


class LinkCustomerInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    customer_id: UUID


class CreateCustomerInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=3, max_length=50)
    email: str | None = Field(default=None, max_length=255)


class LinkOrderInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    order_id: UUID


class TagInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=80)
    color: str = Field(default="#64748b", pattern=r"^#[0-9a-fA-F]{6}$")


class SavedReplyInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=120)
    content: str = Field(min_length=1, max_length=4000)
    category: str | None = Field(default=None, max_length=80)


class SavedReplyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    title: str
    content: str
    category: str | None


class CustomerContext(BaseModel):
    id: UUID
    name: str
    phone: str
    email: str | None
    customer_type: str | None
    tags: list[str]
    notes: str | None
    order_count: int
    lifetime_value: Decimal


class OrderContext(BaseModel):
    id: UUID
    order_number: str
    status: str
    payment_status: str
    total: Decimal
    created_at: datetime


class ProductContext(BaseModel):
    id: UUID
    name: str
    slug: str
    sku: str
    price: Decimal
    image_url: str | None
    stock: int
    variants: list[dict]
    storefront_url: str


class CommerceContext(BaseModel):
    customer: CustomerContext | None
    recent_orders: list[OrderContext]
    linked_orders: list[OrderContext]


class EventPollRead(BaseModel):
    changed: bool
    cursor: datetime


class TestInboundInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    external_account_ref: str = Field(min_length=1, max_length=255)
    external_conversation_ref: str = Field(min_length=1, max_length=255)
    external_user_ref: str = Field(min_length=1, max_length=255)
    provider_message_ref: str = Field(min_length=1, max_length=255)
    text: str = Field(min_length=1, max_length=4000)
    display_name: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
