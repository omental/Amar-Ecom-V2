export type InboxChannel = {
  id: string;
  channel_type: string;
  name: string;
  status: "pending" | "connected" | "needs_attention" | "authorization_expired" | "permissions_revoked" | "webhook_error" | "registration_incomplete" | "provider_error" | "disconnected" | "error" | "disabled";
  provider: string;
  capabilities: Record<string, boolean>;
  external_account_configured: boolean;
  credentials_configured: boolean;
  metadata: Record<string, string>;
};

export type ChannelIdentity = {
  id: string;
  customer_id: string | null;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  status: string;
};

export type InboxTag = { id: string; name: string; color: string };

export type Conversation = {
  id: string;
  channel: InboxChannel;
  identity: ChannelIdentity | null;
  customer_id: string | null;
  status: "open" | "pending" | "resolved" | "snoozed";
  priority: "normal" | "high" | "urgent";
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  subject: string | null;
  handling_mode: "human" | "ai" | "paused";
  last_message_at: string | null;
  last_message_preview: string | null;
  unread: boolean;
  tags: InboxTag[];
  send_eligibility: { can_send_freeform: boolean; window_ends_at: string | null; remaining_seconds: number | null; reason: string | null };
};

export type MetaProviderErrorKind = "authorization_required" | "permission_denied" | "window_closed" | "template_required" | "template_rejected" | "rate_limited" | "invalid_recipient" | "provider_unavailable" | "invalid_payload" | "unknown";

export function providerErrorMessage(kind: MetaProviderErrorKind) {
  return ({ authorization_required: "Reconnect this channel to continue.", permission_denied: "Meta permissions need attention.", window_closed: "The Messenger reply window is closed.", template_required: "The WhatsApp customer-service window is closed. Send an approved template.", template_rejected: "This template is not approved for sending.", rate_limited: "Meta is rate limiting requests. Try again shortly.", invalid_recipient: "This recipient is not available.", provider_unavailable: "Meta is temporarily unavailable.", invalid_payload: "Meta rejected this message format.", unknown: "Meta could not complete the request." })[kind];
}

export function formatReplyWindow(remainingSeconds: number | null) {
  if (!remainingSeconds || remainingSeconds <= 0) return "Closed";
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  return `${hours}h ${minutes}m remaining`;
}

export type ConversationPage = {
  items: Conversation[];
  total: number;
  page: number;
  page_size: number;
  counts: { mine_unread?: number; unassigned?: number; open?: number };
};

export type ConversationMessage = {
  id: string;
  direction: "inbound" | "outbound";
  message_type: "text" | "image" | "file" | "system";
  sender_type: "customer" | "agent" | "system" | "future_ai" | "ai";
  sender_user_id: string | null;
  sender_name: string | null;
  text_content: string | null;
  reply_to_message_id: string | null;
  status: "received" | "queued" | "sent" | "delivered" | "read" | "failed";
  failure_reason: string | null;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
};

export type ConversationNote = { id: string; author_user_id: string; author_name: string; content: string; created_at: string };
export type ThreadPage = { items: ConversationMessage[]; notes: ConversationNote[]; total: number; page: number; page_size: number };
export type Assignee = { id: string; name: string; email: string };
export type CustomerSearchItem = { id: string; name: string; phone: string; email: string | null };
export type SavedReply = { id: string; title: string; content: string; category: string | null };
export type ContextOrder = { id: string; order_number: string; status: string; payment_status: string; total: string; created_at: string };
export type CommerceContext = {
  customer: null | { id: string; name: string; phone: string; email: string | null; customer_type: string | null; tags: string[]; notes: string | null; order_count: number; lifetime_value: string };
  recent_orders: ContextOrder[];
  linked_orders: ContextOrder[];
};
export type InboxProduct = { id: string; name: string; slug: string; sku: string; price: string; image_url: string | null; stock: number; variants: Array<Record<string, unknown>>; storefront_url: string };
export type MessagingTemplate = { id: string; name: string; language: string; category: string | null; status: string; components: Array<{ type?: string; text?: string }>; last_synced_at: string | null };

export function conversationName(conversation: Conversation) {
  return conversation.identity?.display_name || conversation.subject || conversation.identity?.phone || conversation.identity?.email || "Unknown customer";
}

export function formatInboxTime(value: string | null, now = new Date()) {
  if (!value) return "";
  const date = new Date(value);
  const elapsed = now.getTime() - date.getTime();
  if (elapsed < 60_000) return "now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function messageStatusLabel(status: ConversationMessage["status"]) {
  return ({ received: "Received", queued: "Sending…", sent: "Sent", delivered: "Delivered", read: "Read", failed: "Failed" })[status];
}

export function safeMessageText(value: string | null) {
  return (value ?? "").replace(/\0/g, "");
}

export function newMessageIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `web:${crypto.randomUUID()}`;
  return `web:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export function channelLabel(type: string) {
  return ({ website_chat: "Website Chat", facebook_messenger: "Facebook Messenger", whatsapp: "WhatsApp", instagram: "Instagram", email: "Email", test: "Test Channel" } as Record<string, string>)[type] ?? type.replaceAll("_", " ");
}
